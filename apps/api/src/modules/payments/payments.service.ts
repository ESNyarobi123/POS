import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  OpticEdgeCashInStatus,
  Prisma,
  RegisterSessionStatus,
  SelcomPaymentStatus,
  type SelcomPaymentIntent,
} from "@gulio/database";
import type {
  OpticEdgeChannelDto,
  OpticEdgeChannelsResponse,
  OpticEdgeCheckoutChannel,
  SelcomIntentDto,
  SelcomPushRequest,
} from "@gulio/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../auth/types/request-user";
import { SelcomService } from "../integrations/selcom/selcom.service";
import { OpticEdgeService } from "../integrations/opticedge/opticedge.service";
import {
  eatCalendarDate,
  OpticEdgeTransportError,
  pickOpticEdgeCashChannel,
} from "../integrations/opticedge/opticedge.client";
import {
  isOpticEdgeConfigured,
  parseStoredOpticEdgeSettings,
} from "../integrations/opticedge/opticedge.settings";
import {
  isSelcomConfigured,
  parseStoredSelcomSettings,
} from "../integrations/selcom/selcom.settings";
import {
  verifySelcomAuthorization,
  verifySelcomHmac,
} from "../integrations/selcom/selcom.client";
import {
  newSelcomOrderId,
  newSelcomTransid,
  normalizeTzMsisdn,
} from "../integrations/selcom/selcom.msisdn";

type Tx = Prisma.TransactionClient;

function toDecimal(value: string | number | Prisma.Decimal): Prisma.Decimal {
  try {
    const d = new Prisma.Decimal(value);
    if (d.isNaN()) throw new Error("nan");
    return d;
  } catch {
    throw new BadRequestException("Invalid amount");
  }
}

function toAmountString(value: Prisma.Decimal): string {
  return value.toFixed(4);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly selcom: SelcomService,
    private readonly opticedge: OpticEdgeService,
  ) {}

  async startSelcomPush(
    user: RequestUser,
    body: SelcomPushRequest,
  ): Promise<SelcomIntentDto> {
    const org = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { settings: true, slug: true, currencyCode: true },
    });
    if (!org) throw new NotFoundException("Organization not found");

    const stored = parseStoredSelcomSettings(org.settings);
    if (!stored.enabled || !isSelcomConfigured(stored)) {
      throw new ServiceUnavailableException({
        code: "SELCOM_NOT_CONFIGURED",
        message:
          "Selcom is not configured. Owner must save API details in Settings.",
      });
    }

    if (!body.registerSessionId) {
      throw new BadRequestException("registerSessionId is required");
    }
    const session = await this.prisma.registerSession.findFirst({
      where: {
        id: body.registerSessionId,
        organizationId: user.organizationId,
        status: RegisterSessionStatus.OPEN,
      },
    });
    if (!session) {
      throw new BadRequestException("Open register session is required");
    }

    let msisdn: string;
    try {
      msisdn = normalizeTzMsisdn(body.msisdn ?? "");
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : "Invalid phone number",
      );
    }

    const amount = toDecimal(body.amount);
    if (amount.lte(0)) {
      throw new BadRequestException("Amount must be positive");
    }

    const orderId = newSelcomOrderId();
    const pushTransid = newSelcomTransid("PUSH");
    const currency = org.currencyCode || "TZS";
    const itemCount = Math.max(1, Math.floor(Number(body.itemCount) || 1));
    const buyerName = (body.buyerName ?? "").trim() || "Walk-in customer";
    const buyerEmail =
      (body.buyerEmail ?? "").trim() ||
      `pos+${org.slug.replace(/[^a-z0-9-]/gi, "")}@guliosmart.local`;

    const intent = await this.prisma.selcomPaymentIntent.create({
      data: {
        organizationId: user.organizationId,
        registerSessionId: session.id,
        cashierUserId: user.userId,
        orderId,
        pushTransid,
        msisdn,
        amount,
        currency,
        status: SelcomPaymentStatus.PENDING,
        lastMessage: "Sending push to customer phone",
      },
    });

    const result = await this.selcom.createOrderAndPush({
      stored,
      orderId,
      pushTransid,
      vendor: stored.merchantId,
      msisdn,
      amount,
      currency,
      buyerName,
      buyerEmail,
      itemCount,
      buyerRemarks: `POS sale ${orderId}`,
      merchantRemarks: `session ${session.id}`,
    });

    if (result.transportUnknown) {
      const updated = await this.prisma.selcomPaymentIntent.update({
        where: { id: intent.id },
        data: {
          status: SelcomPaymentStatus.RECONCILE,
          lastMessage:
            "Push submitted; waiting for Selcom. Keep this screen open.",
          providerPayload: result.order as Prisma.InputJsonValue,
        },
      });
      return this.toDto(updated);
    }

    const orderCode = String(result.order.resultcode ?? "");
    if (orderCode && orderCode !== "000") {
      const updated = await this.prisma.selcomPaymentIntent.update({
        where: { id: intent.id },
        data: {
          status: SelcomPaymentStatus.FAILED,
          lastMessage: String(
            result.order.message ?? "Selcom rejected the order",
          ),
          providerPayload: result.order as Prisma.InputJsonValue,
        },
      });
      throw new BadGatewayException({
        code: "SELCOM_ORDER_REJECTED",
        message: updated.lastMessage,
        orderId,
      });
    }

    const pushCode = String(result.push?.resultcode ?? "111");
    const pushMessage = String(
      result.push?.message ?? "Approve the payment on the customer phone",
    );
    const failed =
      pushCode !== "000" &&
      pushCode !== "111" &&
      pushCode !== "927";

    const updated = await this.prisma.selcomPaymentIntent.update({
      where: { id: intent.id },
      data: {
        status: failed
          ? SelcomPaymentStatus.FAILED
          : SelcomPaymentStatus.PUSHED,
        lastMessage: pushMessage,
        providerPayload: {
          order: result.order,
          push: result.push,
        } as Prisma.InputJsonValue,
      },
    });

    if (failed) {
      throw new BadGatewayException({
        code: "SELCOM_PUSH_FAILED",
        message: pushMessage,
        orderId,
      });
    }

    return this.toDto(updated);
  }

  async getSelcomIntent(
    user: RequestUser,
    orderId: string,
    refresh: boolean,
  ): Promise<SelcomIntentDto> {
    const intent = await this.prisma.selcomPaymentIntent.findFirst({
      where: { organizationId: user.organizationId, orderId },
    });
    if (!intent) throw new NotFoundException("Payment request not found");

    if (
      refresh &&
      (intent.status === SelcomPaymentStatus.PENDING ||
        intent.status === SelcomPaymentStatus.PUSHED ||
        intent.status === SelcomPaymentStatus.RECONCILE)
    ) {
      await this.refreshFromSelcom(intent);
      const latest = await this.prisma.selcomPaymentIntent.findFirstOrThrow({
        where: { id: intent.id },
      });
      return this.toDto(latest);
    }

    return this.toDto(intent);
  }

  async handleCheckoutWebhook(
    headers: {
      authorization?: string;
      digest?: string;
      timestamp?: string;
      signedFields?: string;
    },
    payload: Record<string, unknown>,
  ): Promise<{ resultcode: string; result: string; message: string }> {
    const orderId = String(payload.order_id ?? "");
    if (!orderId) {
      throw new BadRequestException("Missing order_id");
    }

    const intent = await this.prisma.selcomPaymentIntent.findUnique({
      where: { orderId },
    });
    if (!intent) {
      return { resultcode: "000", result: "SUCCESS", message: "Accepted" };
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: intent.organizationId },
      select: { settings: true },
    });
    const stored = parseStoredSelcomSettings(org?.settings);
    if (!isSelcomConfigured(stored)) {
      return { resultcode: "000", result: "SUCCESS", message: "Accepted" };
    }

    if (
      !headers.authorization ||
      !headers.digest ||
      !headers.timestamp ||
      !headers.signedFields
    ) {
      throw new UnauthorizedException("Missing Selcom signature headers");
    }
    if (!verifySelcomAuthorization(headers.authorization, stored.apiKey)) {
      throw new UnauthorizedException("Invalid authorization");
    }
    if (
      !verifySelcomHmac({
        payload,
        apiSecret: stored.apiSecret,
        timestamp: headers.timestamp,
        digest: headers.digest,
        signedFieldsHeader: headers.signedFields,
      })
    ) {
      throw new UnauthorizedException("Invalid signature");
    }

    await this.applyProviderStatus(intent.id, {
      paymentStatus: String(payload.payment_status ?? ""),
      resultcode: String(payload.resultcode ?? ""),
      amount: payload.amount,
      reference: payload.reference != null ? String(payload.reference) : null,
      transid: payload.transid != null ? String(payload.transid) : null,
      channel: payload.channel != null ? String(payload.channel) : null,
      payload,
    });

    return { resultcode: "000", result: "SUCCESS", message: "Accepted" };
  }

  async consumeCompletedIntent(
    tx: Tx,
    input: {
      organizationId: string;
      orderId: string;
      amount: Prisma.Decimal;
      saleId: string;
    },
  ): Promise<void> {
    const intent = await tx.selcomPaymentIntent.findFirst({
      where: {
        organizationId: input.organizationId,
        orderId: input.orderId,
      },
    });
    if (!intent) {
      throw new UnprocessableEntityException({
        code: "SELCOM_INTENT_MISSING",
        message: "Selcom payment was not found for this order",
      });
    }
    if (intent.saleId && intent.saleId !== input.saleId) {
      throw new ConflictException({
        code: "SELCOM_INTENT_USED",
        message: "This Selcom payment was already used on another sale",
      });
    }
    if (intent.status !== SelcomPaymentStatus.COMPLETED) {
      throw new UnprocessableEntityException({
        code: "SELCOM_NOT_PAID",
        message: "Wait until the customer approves the push payment",
      });
    }
    if (!intent.amount.equals(input.amount)) {
      throw new UnprocessableEntityException({
        code: "SELCOM_AMOUNT_MISMATCH",
        message: "Selcom amount does not match this sale",
      });
    }
    if (!intent.saleId) {
      await tx.selcomPaymentIntent.update({
        where: { id: intent.id },
        data: { saleId: input.saleId },
      });
    }
  }

  private async refreshFromSelcom(intent: SelcomPaymentIntent): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: intent.organizationId },
      select: { settings: true },
    });
    const stored = parseStoredSelcomSettings(org?.settings);
    if (!isSelcomConfigured(stored)) return;

    try {
      const response = await this.selcom.queryOrder(stored, intent.orderId);
      const rows = Array.isArray(response.data) ? response.data : [];
      const item = asRecord(rows[0]) ?? response;
      await this.applyProviderStatus(intent.id, {
        paymentStatus: String(item.payment_status ?? ""),
        resultcode: String(item.resultcode ?? response.resultcode ?? ""),
        amount: item.amount,
        reference: item.reference != null ? String(item.reference) : null,
        transid: item.transid != null ? String(item.transid) : null,
        channel: item.channel != null ? String(item.channel) : null,
        payload: response,
      });
    } catch {
      // Keep PENDING/PUSHED — cashier continues polling.
    }
  }

  private async applyProviderStatus(
    intentId: string,
    event: {
      paymentStatus: string;
      resultcode: string;
      amount: unknown;
      reference: string | null;
      transid: string | null;
      channel: string | null;
      payload: unknown;
    },
  ): Promise<void> {
    const intent = await this.prisma.selcomPaymentIntent.findUnique({
      where: { id: intentId },
    });
    if (!intent) return;
    if (
      intent.status === SelcomPaymentStatus.COMPLETED ||
      intent.status === SelcomPaymentStatus.FAILED ||
      intent.status === SelcomPaymentStatus.CANCELLED
    ) {
      return;
    }

    const status = event.paymentStatus.toUpperCase();
    if (status === "COMPLETED" && (event.resultcode === "000" || !event.resultcode)) {
      if (event.amount != null && event.amount !== "") {
        try {
          const paid = new Prisma.Decimal(String(event.amount)).toDecimalPlaces(0);
          if (!paid.equals(intent.amount.toDecimalPlaces(0))) {
            await this.prisma.selcomPaymentIntent.update({
              where: { id: intent.id },
              data: {
                status: SelcomPaymentStatus.RECONCILE,
                lastMessage: "Amount from Selcom does not match this sale",
                providerPayload: event.payload as Prisma.InputJsonValue,
              },
            });
            return;
          }
        } catch {
          /* ignore parse; still complete if status is COMPLETED */
        }
      }
      await this.prisma.selcomPaymentIntent.update({
        where: { id: intent.id },
        data: {
          status: SelcomPaymentStatus.COMPLETED,
          providerReference: event.reference,
          providerTransid: event.transid,
          channel: event.channel,
          lastMessage: "Customer paid. Complete the sale.",
          completedAt: new Date(),
          providerPayload: event.payload as Prisma.InputJsonValue,
        },
      });
      return;
    }

    if (
      status === "CANCELLED" ||
      status === "USERCANCELLED" ||
      status === "REJECTED"
    ) {
      await this.prisma.selcomPaymentIntent.update({
        where: { id: intent.id },
        data: {
          status:
            status === "REJECTED"
              ? SelcomPaymentStatus.FAILED
              : SelcomPaymentStatus.CANCELLED,
          lastMessage:
            status === "REJECTED"
              ? "Payment was rejected"
              : "Customer cancelled on the phone",
          providerPayload: event.payload as Prisma.InputJsonValue,
        },
      });
    }
  }

  private toDto(intent: SelcomPaymentIntent): SelcomIntentDto {
    return {
      orderId: intent.orderId,
      status: intent.status,
      msisdn: intent.msisdn,
      amount: toAmountString(intent.amount),
      currency: intent.currency,
      message: intent.lastMessage ?? "",
      channel: intent.channel,
      reference: intent.providerReference,
    };
  }

  async listOpticEdgeChannels(
    user: RequestUser,
  ): Promise<OpticEdgeChannelsResponse> {
    const stored = await this.opticedge.loadStored(user.organizationId);
    const configured = isOpticEdgeConfigured(stored);
    const enabled = stored.enabled && configured;
    if (!enabled) {
      return { enabled: stored.enabled, configured, channels: [] };
    }
    const channels = await this.opticedge.listChannels(user.organizationId);
    void this.flushPendingOpticEdgeCashIns(user.organizationId).catch(() => undefined);
    return { enabled, configured, channels };
  }

  async enqueueOpticEdgeCashIn(
    user: RequestUser,
    input: {
      saleId: string;
      channel?: OpticEdgeCheckoutChannel;
    },
  ): Promise<void> {
    const stored = await this.opticedge.loadStored(user.organizationId);
    if (!stored.enabled || !isOpticEdgeConfigured(stored)) {
      return;
    }

    const sale = await this.prisma.sale.findFirst({
      where: { id: input.saleId, organizationId: user.organizationId },
      include: {
        payments: true,
        customer: { select: { phone: true } },
      },
    });
    if (!sale) return;

    const existing = await this.prisma.opticEdgeCashIn.findUnique({
      where: { saleId: sale.id },
    });
    if (existing?.status === OpticEdgeCashInStatus.SENT) {
      return;
    }

    const channel = await this.resolveOpticEdgeChannel(
      user.organizationId,
      sale.payments,
      input.channel,
    );
    if (!channel) return;

    const row =
      existing ??
      (await this.prisma.opticEdgeCashIn.create({
        data: {
          organizationId: user.organizationId,
          saleId: sale.id,
          channelId: channel.id,
          channelName: channel.name,
          channelType: channel.type,
          amount: sale.grandTotal,
          reference: sale.receiptNumber,
          status: OpticEdgeCashInStatus.PENDING,
        },
      }));

    await this.postOpticEdgeCashIn(row.id);
    await this.flushPendingOpticEdgeCashIns(user.organizationId);
  }

  private async resolveOpticEdgeChannel(
    organizationId: string,
    payments: Array<{ method: string }>,
    hint?: OpticEdgeCheckoutChannel,
  ): Promise<OpticEdgeChannelDto | null> {
    let live: OpticEdgeChannelDto[] = [];
    try {
      live = await this.opticedge.listChannels(organizationId);
    } catch (err) {
      this.logger.warn(
        `OpticEdge channels unavailable: ${err instanceof Error ? err.message : "error"}`,
      );
    }

    if (hint && Number.isInteger(hint.channelId) && hint.channelId > 0) {
      const matched = live.find((c) => c.id === hint.channelId);
      if (matched) return matched;
      return {
        id: hint.channelId,
        name: hint.channelName?.trim() || `Channel ${hint.channelId}`,
        type: (hint.channelType || "other").toLowerCase(),
        currency: "TZS",
      };
    }

    const cashOnly =
      payments.length === 1 && payments[0]?.method === "CASH";
    if (!cashOnly) return null;

    return pickOpticEdgeCashChannel(live);
  }

  private async postOpticEdgeCashIn(id: string): Promise<void> {
    const row = await this.prisma.opticEdgeCashIn.findUnique({
      where: { id },
      include: {
        sale: {
          include: {
            payments: true,
            customer: { select: { phone: true } },
          },
        },
      },
    });
    if (!row || row.status === OpticEdgeCashInStatus.SENT) return;

    const stored = parseStoredOpticEdgeSettings(
      (
        await this.prisma.organization.findUnique({
          where: { id: row.organizationId },
          select: { settings: true },
        })
      )?.settings,
    );

    const request = {
      reference: row.reference,
      channelId: row.channelId,
      amount: row.amount,
      description: `POS sale ${row.reference}`,
      saleDate: eatCalendarDate(row.sale.completedAt ?? row.createdAt),
      metadata: {
        sale_id: row.saleId,
        receipt_number: row.reference,
        customer_phone: row.sale.customer?.phone ?? undefined,
        pos_branch_id: row.sale.branchId,
        payment_method: row.sale.payments[0]?.method ?? null,
        channel_name: row.channelName,
      },
    };

    try {
      const result = await this.opticedge.createCashIn(stored, request);
      await this.prisma.opticEdgeCashIn.update({
        where: { id: row.id },
        data: {
          status: OpticEdgeCashInStatus.SENT,
          externalId: result.id,
          replayed: result.replayed,
          attempts: { increment: 1 },
          lastError: null,
          requestJson: {
            reference: request.reference,
            channel_id: request.channelId,
            amount: request.amount.toFixed(4),
            sale_date: request.saleDate,
          } as Prisma.InputJsonValue,
          responseJson: result.raw as Prisma.InputJsonValue,
          sentAt: new Date(),
        },
      });
    } catch (err) {
      const message =
        err instanceof OpticEdgeTransportError
          ? err.message
          : err instanceof Error
            ? err.message
            : "OpticEdge cash-in failed";
      this.logger.warn(`OpticEdge cash-in ${row.reference}: ${message}`);
      await this.prisma.opticEdgeCashIn.update({
        where: { id: row.id },
        data: {
          status: OpticEdgeCashInStatus.FAILED,
          attempts: { increment: 1 },
          lastError: message.slice(0, 500),
          requestJson: {
            reference: request.reference,
            channel_id: request.channelId,
            amount: request.amount.toFixed(4),
            sale_date: request.saleDate,
          } as Prisma.InputJsonValue,
        },
      });
    }
  }

  private async flushPendingOpticEdgeCashIns(
    organizationId: string,
  ): Promise<void> {
    const pending = await this.prisma.opticEdgeCashIn.findMany({
      where: {
        organizationId,
        status: {
          in: [OpticEdgeCashInStatus.PENDING, OpticEdgeCashInStatus.FAILED],
        },
      },
      orderBy: { createdAt: "asc" },
      take: 8,
    });
    for (const row of pending) {
      if (row.attempts >= 8) continue;
      await this.postOpticEdgeCashIn(row.id);
    }
  }
}
