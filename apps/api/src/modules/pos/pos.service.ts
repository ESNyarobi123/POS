import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  FiscalDocumentStatus,
  FiscalStatus,
  OutboxStatus,
  PaymentMethod,
  Prisma,
  RegisterSessionStatus,
  ReturnDisposition,
  ReturnStatus,
  SaleStatus,
  SerialStatus,
  type Payment,
  type RegisterSession,
  type Return,
  type ReturnItem,
  type Sale,
  type SaleItem,
  type SaleItemSerial,
} from "@gulio/database";
import { verifyPassword } from "@gulio/auth";
import { PermissionCode } from "@gulio/contracts";
import type {
  CheckoutRequest,
  CloseShiftRequest,
  CreateReturnRequest,
  DecimalString,
  FiscalDocumentStubDto,
  OpenShiftRequest,
  PaymentDto,
  ReceiptDto,
  RegisterSessionDto,
  ReturnableSaleDto,
  ReturnDto,
  ReturnListResponse,
  SaleDto,
  SaleItemDto,
} from "@gulio/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../auth/types/request-user";
import { InventoryService } from "../inventory/inventory.service";

type SaleWithRelations = Sale & {
  items: Array<
    SaleItem & {
      serials: Array<
        SaleItemSerial & {
          serialUnit?: { serialNumber: string } | null;
        }
      >;
      variant?: { sku: string; name: string } | null;
    }
  >;
  payments: Payment[];
  fiscalDocument?: {
    id: string;
    provider: string;
    status: FiscalDocumentStatus;
    externalRef: string | null;
    idempotencyKey: string;
  } | null;
  organization?: {
    id: string;
    name: string;
    slug: string;
    currencyCode: string;
  };
  branch?: { id: string; name: string; code: string };
  cashier?: { id: string; fullName: string };
  customer?: { id: string; name: string; phone: string | null } | null;
};

const SALE_INCLUDE = {
  items: {
    include: {
      serials: {
        include: { serialUnit: { select: { serialNumber: true } } },
      },
      variant: { select: { sku: true, name: true } },
    },
  },
  payments: true,
  fiscalDocument: true,
} as const;

const RETURNABLE_SALE_INCLUDE = {
  items: {
    include: {
      variant: {
        select: {
          id: true,
          sku: true,
          name: true,
          tracksSerial: true,
          product: { select: { name: true } },
        },
      },
      serials: {
        include: {
          serialUnit: {
            select: { id: true, serialNumber: true, status: true },
          },
        },
      },
      returnItems: {
        where: { returnDoc: { status: ReturnStatus.COMPLETED } },
        select: { quantity: true },
      },
    },
  },
} as const;

const RETURN_INCLUDE = {
  items: {
    include: {
      saleItem: { select: { variantId: true } },
    },
  },
  sale: { select: { receiptNumber: true } },
} as const;

/** MVP hardcoded threshold (TZS minor units as decimal). */
const LARGE_REFUND_THRESHOLD = new Prisma.Decimal("500000.0000");

const MANAGER_ROLES = new Set(["OWNER", "MANAGER"]);

type ReturnWithRelations = Return & {
  items: Array<
    ReturnItem & {
      saleItem?: { variantId: string } | null;
    }
  >;
  sale?: { receiptNumber: string } | null;
};

type PreparedReturnLine = {
  saleItemId: string;
  variantId: string;
  quantity: Prisma.Decimal;
  disposition: ReturnDisposition;
  refundAmount: Prisma.Decimal;
  serialUnitIds: string[];
  serialUnitId: string | null;
};

function toDecimal(value: number | string | Prisma.Decimal): Prisma.Decimal {
  return value instanceof Prisma.Decimal
    ? value
    : new Prisma.Decimal(value);
}

function toDecimalString(
  value: Prisma.Decimal | number | string | null | undefined,
): DecimalString {
  if (value === null || value === undefined) return "0.0000";
  return toDecimal(value).toFixed(4);
}

function moneyEquals(a: Prisma.Decimal, b: Prisma.Decimal): boolean {
  return a.equals(b);
}

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async openShift(
    user: RequestUser,
    body: OpenShiftRequest,
  ): Promise<RegisterSessionDto> {
    if (!body.registerId) {
      throw new BadRequestException("registerId is required");
    }
    const openingFloat = toDecimal(body.openingFloat ?? "0");
    if (openingFloat.lt(0)) {
      throw new BadRequestException("openingFloat must be >= 0");
    }

    const register = await this.prisma.register.findFirst({
      where: {
        id: body.registerId,
        organizationId: user.organizationId,
        isActive: true,
      },
    });
    if (!register) {
      throw new NotFoundException("Register not found");
    }

    const existing = await this.prisma.registerSession.findFirst({
      where: {
        registerId: register.id,
        organizationId: user.organizationId,
        status: RegisterSessionStatus.OPEN,
      },
    });
    if (existing) {
      throw new ConflictException({
        code: "SHIFT_ALREADY_OPEN",
        message: "Register already has an open shift",
        sessionId: existing.id,
      });
    }

    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.registerSession.create({
        data: {
          organizationId: user.organizationId,
          registerId: register.id,
          branchId: register.branchId,
          openedByUserId: user.userId,
          status: RegisterSessionStatus.OPEN,
          openingFloat,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.userId,
          action: "shift.open",
          entityType: "RegisterSession",
          entityId: created.id,
          afterJson: {
            registerId: register.id,
            openingFloat: toDecimalString(openingFloat),
          },
        },
      });

      return created;
    });

    return this.mapSession(session);
  }

  async closeShift(
    user: RequestUser,
    sessionId: string,
    body: CloseShiftRequest,
  ): Promise<RegisterSessionDto> {
    const countedCash = toDecimal(body.countedCash);
    if (countedCash.lt(0)) {
      throw new BadRequestException("countedCash must be >= 0");
    }

    const session = await this.prisma.registerSession.findFirst({
      where: { id: sessionId, organizationId: user.organizationId },
    });
    if (!session) {
      throw new NotFoundException("Shift session not found");
    }
    if (session.status !== RegisterSessionStatus.OPEN) {
      throw new ConflictException("Shift is already closed");
    }

    const canCloseAny = user.permissions.includes(
      PermissionCode.SHIFT_OPEN_ANY,
    );
    if (!canCloseAny && session.openedByUserId !== user.userId) {
      throw new ForbiddenException(
        "Only the opening cashier or a manager can close this shift",
      );
    }

    const { expectedCash, cashSales, cashRefunds } =
      await this.computeExpectedCash(session);

    const variance = countedCash.minus(expectedCash);

    const updated = await this.prisma.$transaction(async (tx) => {
      const closed = await tx.registerSession.update({
        where: { id: session.id },
        data: {
          status: RegisterSessionStatus.CLOSED,
          closedByUserId: user.userId,
          closingCountedCash: countedCash,
          expectedCash,
          variance,
          closedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.userId,
          action: "shift.close",
          entityType: "RegisterSession",
          entityId: closed.id,
          afterJson: {
            countedCash: toDecimalString(countedCash),
            expectedCash: toDecimalString(expectedCash),
            variance: toDecimalString(variance),
            cashSales: toDecimalString(cashSales),
            cashRefunds: toDecimalString(cashRefunds),
          },
        },
      });

      return closed;
    });

    return this.mapSession(updated);
  }

  async getCurrentShift(
    user: RequestUser,
    registerId: string,
  ): Promise<RegisterSessionDto | null> {
    if (!registerId) {
      throw new BadRequestException("registerId is required");
    }
    const session = await this.prisma.registerSession.findFirst({
      where: {
        registerId,
        organizationId: user.organizationId,
        status: RegisterSessionStatus.OPEN,
      },
      orderBy: { openedAt: "desc" },
    });
    return session ? this.mapSession(session) : null;
  }

  async checkout(
    user: RequestUser,
    idempotencyKey: string,
    body: CheckoutRequest,
  ): Promise<SaleDto> {
    const key = idempotencyKey?.trim();
    if (!key) {
      throw new BadRequestException("Idempotency-Key header is required");
    }
    if (!body.items?.length) {
      throw new BadRequestException("At least one line item is required");
    }
    if (!body.payments?.length) {
      throw new BadRequestException("At least one payment is required");
    }

    const existing = await this.prisma.sale.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: user.organizationId,
          idempotencyKey: key,
        },
      },
      include: SALE_INCLUDE,
    });
    if (existing) {
      return this.mapSale(existing);
    }

    const discountTotal = toDecimal(body.discountAmount ?? "0");
    if (discountTotal.lt(0)) {
      throw new BadRequestException("discountAmount must be >= 0");
    }
    if (
      discountTotal.gt(0) &&
      !user.permissions.includes(PermissionCode.POS_DISCOUNT)
    ) {
      throw new ForbiddenException("Missing permission: pos.discount");
    }

    try {
      const sale = await this.prisma.$transaction(async (tx) => {
        const session = await tx.registerSession.findFirst({
          where: {
            id: body.registerSessionId,
            organizationId: user.organizationId,
          },
        });
        if (!session) {
          throw new NotFoundException("Register session not found");
        }
        if (session.status !== RegisterSessionStatus.OPEN) {
          throw new UnprocessableEntityException({
            code: "SHIFT_NOT_OPEN",
            message: "Checkout requires an open register shift",
          });
        }
        if (session.branchId !== body.branchId) {
          throw new BadRequestException(
            "branchId does not match register session branch",
          );
        }

        const warehouse = await tx.warehouse.findFirst({
          where: {
            id: body.warehouseId,
            organizationId: user.organizationId,
            branchId: body.branchId,
          },
        });
        if (!warehouse) {
          throw new NotFoundException(
            "Warehouse not found for organization/branch",
          );
        }

        if (body.customerId) {
          const customer = await tx.customer.findFirst({
            where: {
              id: body.customerId,
              organizationId: user.organizationId,
            },
          });
          if (!customer) {
            throw new NotFoundException("Customer not found");
          }
        }

        const variantIds = [...new Set(body.items.map((i) => i.variantId))];
        const variants = await tx.variant.findMany({
          where: {
            id: { in: variantIds },
            organizationId: user.organizationId,
            isActive: true,
          },
        });
        const variantById = new Map(variants.map((v) => [v.id, v]));
        if (variants.length !== variantIds.length) {
          const missing = variantIds.filter((id) => !variantById.has(id));
          throw new NotFoundException(`Variants not found: ${missing.join(", ")}`);
        }

        const priceOverrides: Array<{
          variantId: string;
          catalogPrice: string;
          overridePrice: string;
        }> = [];

        let subtotal = new Prisma.Decimal(0);
        const preparedLines: Array<{
          variantId: string;
          quantity: Prisma.Decimal;
          unitPrice: Prisma.Decimal;
          lineTotal: Prisma.Decimal;
          tracksSerial: boolean;
          serialUnitIds: string[];
        }> = [];

        for (const line of body.items) {
          const variant = variantById.get(line.variantId)!;
          const quantity = toDecimal(line.quantity);
          if (!quantity.isInteger() || quantity.lte(0)) {
            throw new BadRequestException(
              `Quantity must be a positive integer for variant ${line.variantId}`,
            );
          }

          const catalogPrice = toDecimal(variant.sellPrice);
          let unitPrice = catalogPrice;
          if (line.unitPrice !== undefined && line.unitPrice !== null) {
            unitPrice = toDecimal(line.unitPrice);
            if (unitPrice.lt(0)) {
              throw new BadRequestException("unitPrice must be >= 0");
            }
            if (!moneyEquals(unitPrice, catalogPrice)) {
              if (
                !user.permissions.includes(PermissionCode.POS_PRICE_OVERRIDE)
              ) {
                throw new ForbiddenException(
                  "Missing permission: pos.price_override",
                );
              }
              priceOverrides.push({
                variantId: variant.id,
                catalogPrice: toDecimalString(catalogPrice),
                overridePrice: toDecimalString(unitPrice),
              });
            }
          }

          const serialUnitIds = line.serialUnitIds ?? [];
          if (variant.tracksSerial) {
            if (serialUnitIds.length !== quantity.toNumber()) {
              throw new UnprocessableEntityException({
                code: "SERIAL_REQUIRED",
                message: `Variant ${variant.sku} requires ${quantity.toFixed(0)} serialUnitIds`,
                variantId: variant.id,
              });
            }
          } else if (serialUnitIds.length > 0) {
            throw new BadRequestException(
              `Variant ${variant.sku} does not track serials`,
            );
          }

          const lineTotal = unitPrice.times(quantity);
          subtotal = subtotal.plus(lineTotal);
          preparedLines.push({
            variantId: variant.id,
            quantity,
            unitPrice,
            lineTotal,
            tracksSerial: variant.tracksSerial,
            serialUnitIds,
          });
        }

        if (discountTotal.gt(subtotal)) {
          throw new BadRequestException(
            "discountAmount cannot exceed subtotal",
          );
        }

        const taxTotal = new Prisma.Decimal(0);
        const grandTotal = subtotal.minus(discountTotal).plus(taxTotal);

        let paymentsSum = new Prisma.Decimal(0);
        const preparedPayments: Array<{
          method: PaymentMethod;
          amount: Prisma.Decimal;
          reference?: string;
          provider?: string;
        }> = [];

        for (const pay of body.payments) {
          const amount = toDecimal(pay.amount);
          if (amount.lte(0)) {
            throw new BadRequestException("Payment amount must be positive");
          }
          if (
            !Object.values(PaymentMethod).includes(pay.method as PaymentMethod)
          ) {
            throw new BadRequestException(
              `Invalid payment method: ${pay.method}`,
            );
          }
          paymentsSum = paymentsSum.plus(amount);
          preparedPayments.push({
            method: pay.method as PaymentMethod,
            amount,
            reference: pay.reference,
            provider: pay.provider,
          });
        }

        if (!moneyEquals(paymentsSum, grandTotal)) {
          throw new UnprocessableEntityException({
            code: "PAYMENT_MISMATCH",
            message: "Payment sum must equal grand total",
            paymentsSum: toDecimalString(paymentsSum),
            grandTotal: toDecimalString(grandTotal),
          });
        }

        const receiptNumber = await this.nextReceiptNumber(
          tx,
          user.organizationId,
        );

        const sale = await tx.sale.create({
          data: {
            organizationId: user.organizationId,
            branchId: body.branchId,
            warehouseId: body.warehouseId,
            registerId: session.registerId,
            registerSessionId: session.id,
            cashierUserId: user.userId,
            customerId: body.customerId ?? null,
            receiptNumber,
            status: SaleStatus.COMPLETED,
            fiscalStatus: FiscalStatus.FISCAL_PENDING,
            idempotencyKey: key,
            subtotal,
            discountTotal,
            taxTotal,
            grandTotal,
            completedAt: new Date(),
          },
        });

        const createdItems: Array<{
          id: string;
          variantId: string;
          quantity: Prisma.Decimal;
          serialUnitIds: string[];
        }> = [];

        for (const line of preparedLines) {
          const item = await tx.saleItem.create({
            data: {
              organizationId: user.organizationId,
              saleId: sale.id,
              variantId: line.variantId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discountAmount: new Prisma.Decimal(0),
              taxAmount: new Prisma.Decimal(0),
              lineTotal: line.lineTotal,
              tracksSerial: line.tracksSerial,
            },
          });

          if (line.serialUnitIds.length > 0) {
            await tx.saleItemSerial.createMany({
              data: line.serialUnitIds.map((serialUnitId) => ({
                saleItemId: item.id,
                serialUnitId,
              })),
            });
          }

          createdItems.push({
            id: item.id,
            variantId: line.variantId,
            quantity: line.quantity,
            serialUnitIds: line.serialUnitIds,
          });
        }

        for (const pay of preparedPayments) {
          await tx.payment.create({
            data: {
              organizationId: user.organizationId,
              saleId: sale.id,
              method: pay.method,
              amount: pay.amount,
              reference: pay.reference ?? null,
              provider: pay.provider ?? null,
            },
          });
        }

        for (const item of createdItems) {
          await this.inventoryService.commitSaleMovement(tx, {
            organizationId: user.organizationId,
            branchId: body.branchId,
            warehouseId: body.warehouseId,
            variantId: item.variantId,
            quantity: toDecimalString(item.quantity),
            saleId: sale.id,
            saleItemId: item.id,
            serialUnitIds:
              item.serialUnitIds.length > 0 ? item.serialUnitIds : undefined,
            createdByUserId: user.userId,
          });
        }

        await tx.fiscalDocument.create({
          data: {
            organizationId: user.organizationId,
            saleId: sale.id,
            provider: "Mock",
            status: FiscalDocumentStatus.PENDING,
            idempotencyKey: `fiscal:${key}`,
            requestJson: {
              receiptNumber,
              grandTotal: toDecimalString(grandTotal),
            },
          },
        });

        await tx.outboxEvent.create({
          data: {
            organizationId: user.organizationId,
            eventType: "SALE_COMPLETED",
            aggregateId: sale.id,
            payload: {
              saleId: sale.id,
              receiptNumber,
              branchId: body.branchId,
              warehouseId: body.warehouseId,
              grandTotal: toDecimalString(grandTotal),
              note: body.note ?? null,
            },
            status: OutboxStatus.PENDING,
          },
        });

        await tx.auditLog.create({
          data: {
            organizationId: user.organizationId,
            actorUserId: user.userId,
            action: "sale.checkout",
            entityType: "Sale",
            entityId: sale.id,
            afterJson: {
              receiptNumber,
              grandTotal: toDecimalString(grandTotal),
              discountTotal: toDecimalString(discountTotal),
              itemCount: preparedLines.length,
              note: body.note ?? null,
              priceOverrides:
                priceOverrides.length > 0 ? priceOverrides : undefined,
            },
          },
        });

        return tx.sale.findUniqueOrThrow({
          where: { id: sale.id },
          include: SALE_INCLUDE,
        });
      });

      return this.mapSale(sale);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const raced = await this.prisma.sale.findUnique({
          where: {
            organizationId_idempotencyKey: {
              organizationId: user.organizationId,
              idempotencyKey: key,
            },
          },
          include: SALE_INCLUDE,
        });
        if (raced) {
          return this.mapSale(raced);
        }
      }
      throw err;
    }
  }

  async getReceipt(user: RequestUser, saleId: string): Promise<ReceiptDto> {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, organizationId: user.organizationId },
      include: {
        ...SALE_INCLUDE,
        organization: {
          select: { id: true, name: true, slug: true, currencyCode: true },
        },
        branch: { select: { id: true, name: true, code: true } },
        cashier: { select: { id: true, fullName: true } },
        customer: { select: { id: true, name: true, phone: true } },
      },
    });
    if (!sale) {
      throw new NotFoundException("Sale not found");
    }

    return {
      sale: this.mapSale(sale),
      organization: sale.organization!,
      branch: sale.branch!,
      cashier: sale.cashier!,
      customer: sale.customer
        ? {
            id: sale.customer.id,
            name: sale.customer.name,
            phone: sale.customer.phone,
          }
        : null,
      fiscal: sale.fiscalDocument
        ? this.mapFiscal(sale.fiscalDocument)
        : null,
      printedAt: new Date().toISOString(),
    };
  }

  async listRecentSales(
    user: RequestUser,
    limit = 20,
  ): Promise<SaleDto[]> {
    const take = Math.min(Math.max(limit, 1), 100);
    const sales = await this.prisma.sale.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
      take,
      include: SALE_INCLUDE,
    });
    return sales.map((s) => this.mapSale(s));
  }

  async getReturnableSaleByReceipt(
    user: RequestUser,
    receiptNumber: string,
  ): Promise<ReturnableSaleDto> {
    const trimmed = receiptNumber?.trim();
    if (!trimmed) {
      throw new BadRequestException("receiptNumber is required");
    }

    const sale = await this.prisma.sale.findFirst({
      where: {
        organizationId: user.organizationId,
        receiptNumber: trimmed,
        status: SaleStatus.COMPLETED,
      },
      include: RETURNABLE_SALE_INCLUDE,
    });
    if (!sale) {
      throw new NotFoundException("Completed sale not found for receipt");
    }

    return this.mapReturnableSale(sale);
  }

  async listReturns(
    user: RequestUser,
    limit = 20,
  ): Promise<ReturnListResponse> {
    const take = Math.min(Math.max(limit, 1), 100);
    const rows = await this.prisma.return.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ processedAt: "desc" }, { createdAt: "desc" }],
      take,
      include: RETURN_INCLUDE,
    });
    return {
      items: rows.map((row) => this.mapReturn(row, null)),
    };
  }

  async createReturn(
    user: RequestUser,
    idempotencyKey: string | undefined,
    body: CreateReturnRequest,
  ): Promise<ReturnDto> {
    const key = idempotencyKey?.trim();
    if (key) {
      const prior = await this.findReturnByIdempotencyKey(
        user.organizationId,
        key,
      );
      if (prior) {
        return this.mapReturn(prior, body.refundMethod);
      }
    }

    if (!body.saleId) {
      throw new BadRequestException("saleId is required");
    }
    if (!body.warehouseId) {
      throw new BadRequestException("warehouseId is required");
    }
    if (!body.reasonCode?.trim()) {
      throw new BadRequestException("reasonCode is required");
    }
    if (!body.items?.length) {
      throw new BadRequestException("At least one return line is required");
    }
    if (
      body.refundMethod !== "CASH" &&
      body.refundMethod !== "MOBILE_MONEY_MANUAL"
    ) {
      throw new BadRequestException(
        "refundMethod must be CASH or MOBILE_MONEY_MANUAL",
      );
    }

    const sale = await this.prisma.sale.findFirst({
      where: {
        id: body.saleId,
        organizationId: user.organizationId,
        status: SaleStatus.COMPLETED,
      },
      include: RETURNABLE_SALE_INCLUDE,
    });
    if (!sale) {
      throw new NotFoundException("Completed sale not found");
    }

    const warehouse = await this.prisma.warehouse.findFirst({
      where: {
        id: body.warehouseId,
        organizationId: user.organizationId,
      },
    });
    if (!warehouse) {
      throw new NotFoundException("Warehouse not found");
    }

    const saleItemById = new Map(sale.items.map((item) => [item.id, item]));
    const alreadyReturnedByItem = await this.sumCompletedReturnsBySaleItem(
      sale.id,
    );

    const preparedLines: PreparedReturnLine[] = [];
    let refundTotal = new Prisma.Decimal(0);

    for (const line of body.items) {
      const saleItem = saleItemById.get(line.saleItemId);
      if (!saleItem) {
        throw new NotFoundException(
          `Sale item not found on sale: ${line.saleItemId}`,
        );
      }

      const qty = toDecimal(line.quantity);
      if (!qty.isInteger() || qty.lte(0)) {
        throw new BadRequestException(
          `Return quantity must be a positive integer for saleItem ${line.saleItemId}`,
        );
      }

      const soldQty = toDecimal(saleItem.quantity);
      const alreadyReturned =
        alreadyReturnedByItem.get(line.saleItemId) ?? new Prisma.Decimal(0);
      const returnable = soldQty.minus(alreadyReturned);
      if (qty.gt(returnable)) {
        throw new UnprocessableEntityException({
          code: "RETURN_QTY_EXCEEDS_RETURNABLE",
          message: `Cannot return ${qty.toFixed(0)} units; only ${returnable.toFixed(0)} returnable for sale item ${line.saleItemId}`,
          saleItemId: line.saleItemId,
          quantityReturnable: toDecimalString(returnable),
        });
      }

      const disposition = this.parseReturnDisposition(line.disposition);
      const serialUnitIds = line.serialUnitIds ?? [];

      if (saleItem.tracksSerial) {
        if (serialUnitIds.length !== qty.toNumber()) {
          throw new UnprocessableEntityException({
            code: "SERIAL_REQUIRED",
            message: `Serial-tracked item requires ${qty.toFixed(0)} serialUnitIds`,
            saleItemId: line.saleItemId,
          });
        }

        const soldSerialIds = new Set(
          saleItem.serials.map((s) => s.serialUnitId),
        );
        for (const serialUnitId of serialUnitIds) {
          if (!soldSerialIds.has(serialUnitId)) {
            throw new UnprocessableEntityException({
              code: "SERIAL_NOT_ON_SALE",
              message: `Serial ${serialUnitId} was not sold on this line`,
              saleItemId: line.saleItemId,
              serialUnitId,
            });
          }
          const link = saleItem.serials.find(
            (s) => s.serialUnitId === serialUnitId,
          );
          if (link?.serialUnit?.status !== SerialStatus.SOLD) {
            throw new UnprocessableEntityException({
              code: "SERIAL_NOT_SOLD",
              message: `Serial ${serialUnitId} is not in SOLD status`,
              saleItemId: line.saleItemId,
              serialUnitId,
              status: link?.serialUnit?.status,
            });
          }
        }
      } else if (serialUnitIds.length > 0) {
        throw new BadRequestException(
          `Sale item ${line.saleItemId} does not track serials`,
        );
      }

      const lineRefund =
        line.refundAmount !== undefined
          ? toDecimal(line.refundAmount)
          : toDecimal(saleItem.lineTotal).times(qty).div(soldQty);
      if (lineRefund.lt(0)) {
        throw new BadRequestException("refundAmount must be >= 0");
      }
      refundTotal = refundTotal.plus(lineRefund);

      if (saleItem.tracksSerial) {
        const perUnitRefund = lineRefund.div(qty);
        for (const serialUnitId of serialUnitIds) {
          preparedLines.push({
            saleItemId: saleItem.id,
            variantId: saleItem.variantId,
            quantity: new Prisma.Decimal(1),
            disposition,
            refundAmount: perUnitRefund,
            serialUnitIds: [serialUnitId],
            serialUnitId,
          });
        }
      } else {
        preparedLines.push({
          saleItemId: saleItem.id,
          variantId: saleItem.variantId,
          quantity: qty,
          disposition,
          refundAmount: lineRefund,
          serialUnitIds: [],
          serialUnitId: null,
        });
      }
    }

    let approvedByUserId: string | null = null;
    if (refundTotal.gte(LARGE_REFUND_THRESHOLD)) {
      const pin = body.managerPin?.trim() ?? "";
      if (!pin) {
        throw new ForbiddenException(
          "Manager PIN required for refunds of TZS 500,000 or more",
        );
      }
      const approver = await this.verifyManagerPin(user.organizationId, pin);
      if (!approver) {
        throw new ForbiddenException("Invalid manager PIN");
      }
      approvedByUserId = approver.id;
    }

    const returnDoc = await this.prisma.$transaction(async (tx) => {
      const created = await tx.return.create({
        data: {
          organizationId: user.organizationId,
          saleId: sale.id,
          branchId: sale.branchId,
          processedByUserId: user.userId,
          approvedByUserId,
          status: ReturnStatus.PENDING,
          refundTotal,
          reasonCode: body.reasonCode.trim(),
        },
      });

      const createdItems: Array<ReturnItem & { variantId: string }> = [];

      for (const line of preparedLines) {
        const item = await tx.returnItem.create({
          data: {
            returnId: created.id,
            saleItemId: line.saleItemId,
            serialUnitId: line.serialUnitId,
            quantity: line.quantity,
            disposition: line.disposition,
            refundAmount: line.refundAmount,
          },
        });

        await this.inventoryService.commitReturnMovement(tx, {
          organizationId: user.organizationId,
          branchId: sale.branchId,
          warehouseId: body.warehouseId,
          variantId: line.variantId,
          quantity: toDecimalString(line.quantity),
          returnId: created.id,
          returnItemId: item.id,
          saleItemId: line.saleItemId,
          serialUnitIds:
            line.serialUnitIds.length > 0 ? line.serialUnitIds : undefined,
          restock: line.disposition === ReturnDisposition.RESTOCK,
          disposition: line.disposition,
          createdByUserId: user.userId,
        });

        createdItems.push({ ...item, variantId: line.variantId });
      }

      const completed = await tx.return.update({
        where: { id: created.id },
        data: {
          status: ReturnStatus.COMPLETED,
          processedAt: new Date(),
        },
        include: RETURN_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.userId,
          action: "stock.return",
          entityType: "Return",
          entityId: completed.id,
          afterJson: {
            saleId: sale.id,
            receiptNumber: sale.receiptNumber,
            refundTotal: toDecimalString(refundTotal),
            warehouseId: body.warehouseId,
            itemCount: preparedLines.length,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.userId,
          action: "pos.return.create",
          entityType: "Return",
          entityId: completed.id,
          afterJson: {
            saleId: sale.id,
            receiptNumber: sale.receiptNumber,
            refundTotal: toDecimalString(refundTotal),
            refundMethod: body.refundMethod,
            reasonCode: body.reasonCode.trim(),
            idempotencyKey: key ?? null,
            approvedByUserId,
            largeRefund: refundTotal.gte(LARGE_REFUND_THRESHOLD),
          },
        },
      });

      return completed;
    });

    return this.mapReturn(returnDoc, body.refundMethod);
  }

  private async computeExpectedCash(session: RegisterSession): Promise<{
    expectedCash: Prisma.Decimal;
    cashSales: Prisma.Decimal;
    cashRefunds: Prisma.Decimal;
  }> {
    const cashAgg = await this.prisma.payment.aggregate({
      where: {
        organizationId: session.organizationId,
        method: PaymentMethod.CASH,
        sale: {
          registerSessionId: session.id,
          status: SaleStatus.COMPLETED,
        },
      },
      _sum: { amount: true },
    });

    const refundAgg = await this.prisma.return.aggregate({
      where: {
        organizationId: session.organizationId,
        status: ReturnStatus.COMPLETED,
        sale: { registerSessionId: session.id },
      },
      _sum: { refundTotal: true },
    });

    const cashSales = toDecimal(cashAgg._sum.amount ?? 0);
    const cashRefunds = toDecimal(refundAgg._sum.refundTotal ?? 0);
    const expectedCash = toDecimal(session.openingFloat)
      .plus(cashSales)
      .minus(cashRefunds);

    return { expectedCash, cashSales, cashRefunds };
  }

  private async nextReceiptNumber(
    tx: Prisma.TransactionClient,
    organizationId: string,
  ): Promise<string> {
    const count = await tx.sale.count({ where: { organizationId } });
    const seq = String(count + 1).padStart(8, "0");
    const candidate = `RCP-${seq}`;
    const clash = await tx.sale.findUnique({
      where: {
        organizationId_receiptNumber: { organizationId, receiptNumber: candidate },
      },
      select: { id: true },
    });
    if (!clash) return candidate;
    return `RCP-${seq}-${Date.now().toString(36).toUpperCase()}`;
  }

  private mapSession(row: RegisterSession): RegisterSessionDto {
    return {
      id: row.id,
      organizationId: row.organizationId,
      registerId: row.registerId,
      branchId: row.branchId,
      openedByUserId: row.openedByUserId,
      closedByUserId: row.closedByUserId,
      status: row.status,
      openingFloat: toDecimalString(row.openingFloat),
      closingCountedCash:
        row.closingCountedCash === null
          ? null
          : toDecimalString(row.closingCountedCash),
      expectedCash:
        row.expectedCash === null ? null : toDecimalString(row.expectedCash),
      variance: row.variance === null ? null : toDecimalString(row.variance),
      openedAt: row.openedAt.toISOString(),
      closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    };
  }

  private mapSale(row: SaleWithRelations): SaleDto {
    return {
      id: row.id,
      organizationId: row.organizationId,
      branchId: row.branchId,
      warehouseId: row.warehouseId,
      registerId: row.registerId,
      registerSessionId: row.registerSessionId,
      cashierUserId: row.cashierUserId,
      customerId: row.customerId,
      receiptNumber: row.receiptNumber,
      status: row.status,
      fiscalStatus: row.fiscalStatus,
      idempotencyKey: row.idempotencyKey,
      subtotal: toDecimalString(row.subtotal),
      discountTotal: toDecimalString(row.discountTotal),
      taxTotal: toDecimalString(row.taxTotal),
      grandTotal: toDecimalString(row.grandTotal),
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      items: (row.items ?? []).map((item) => this.mapSaleItem(item)),
      payments: (row.payments ?? []).map((p) => this.mapPayment(p)),
    };
  }

  private mapSaleItem(
    item: SaleItem & {
      serials?: Array<
        SaleItemSerial & { serialUnit?: { serialNumber: string } | null }
      >;
      variant?: { sku: string; name: string } | null;
    },
  ): SaleItemDto {
    return {
      id: item.id,
      variantId: item.variantId,
      quantity: toDecimalString(item.quantity),
      unitPrice: toDecimalString(item.unitPrice),
      discountAmount: toDecimalString(item.discountAmount),
      taxAmount: toDecimalString(item.taxAmount),
      lineTotal: toDecimalString(item.lineTotal),
      tracksSerial: item.tracksSerial,
      serials: (item.serials ?? []).map((s) => ({
        serialUnitId: s.serialUnitId,
        serialNumber: s.serialUnit?.serialNumber,
      })),
      sku: item.variant?.sku,
      name: item.variant?.name,
    };
  }

  private mapPayment(row: Payment): PaymentDto {
    return {
      id: row.id,
      method: row.method,
      amount: toDecimalString(row.amount),
      provider: row.provider,
      reference: row.reference,
      paidAt: row.paidAt.toISOString(),
    };
  }

  private mapFiscal(row: {
    id: string;
    provider: string;
    status: FiscalDocumentStatus;
    externalRef: string | null;
    idempotencyKey: string;
  }): FiscalDocumentStubDto {
    return {
      id: row.id,
      provider: row.provider,
      status: row.status,
      externalRef: row.externalRef,
      idempotencyKey: row.idempotencyKey,
    };
  }

  private mapReturnableSale(
    sale: Sale & {
      items: Array<
        SaleItem & {
          variant?: {
            id: string;
            sku: string;
            name: string;
            tracksSerial: boolean;
            product?: { name: string } | null;
          } | null;
          serials: Array<
            SaleItemSerial & {
              serialUnit?: {
                id: string;
                serialNumber: string;
                status: SerialStatus;
              } | null;
            }
          >;
          returnItems: Array<{ quantity: Prisma.Decimal }>;
        }
      >;
    },
  ): ReturnableSaleDto {
    return {
      saleId: sale.id,
      receiptNumber: sale.receiptNumber,
      completedAt: sale.completedAt ? sale.completedAt.toISOString() : null,
      branchId: sale.branchId,
      warehouseId: sale.warehouseId,
      grandTotal: toDecimalString(sale.grandTotal),
      items: sale.items.map((item) => {
        const soldQty = toDecimal(item.quantity);
        const alreadyReturned = item.returnItems.reduce(
          (sum, ri) => sum.plus(toDecimal(ri.quantity)),
          new Prisma.Decimal(0),
        );
        const returnable = soldQty.minus(alreadyReturned);

        return {
          saleItemId: item.id,
          variantId: item.variantId,
          productName: item.variant?.product?.name ?? "",
          variantName: item.variant?.name ?? "",
          sku: item.variant?.sku ?? "",
          quantitySold: toDecimalString(soldQty),
          quantityAlreadyReturned: toDecimalString(alreadyReturned),
          quantityReturnable: toDecimalString(returnable.lt(0) ? 0 : returnable),
          unitPrice: toDecimalString(item.unitPrice),
          lineTotal: toDecimalString(item.lineTotal),
          tracksSerial: item.tracksSerial,
          serials: item.serials
            .filter((s) => s.serialUnit?.status === SerialStatus.SOLD)
            .map((s) => ({
              serialUnitId: s.serialUnitId,
              serialNumber: s.serialUnit?.serialNumber ?? "",
              status: s.serialUnit?.status ?? "",
            })),
        };
      }),
    };
  }

  private mapReturn(
    row: ReturnWithRelations,
    refundMethod: string | null,
  ): ReturnDto {
    const restockedVariantIds = [
      ...new Set(
        row.items
          .filter((i) => i.disposition === ReturnDisposition.RESTOCK)
          .map((i) => i.saleItem?.variantId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    return {
      id: row.id,
      saleId: row.saleId,
      receiptNumber: row.sale?.receiptNumber ?? "",
      status: row.status,
      refundTotal: toDecimalString(row.refundTotal),
      reasonCode: row.reasonCode,
      refundMethod,
      processedAt: row.processedAt ? row.processedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      items: row.items.map((item) => ({
        id: item.id,
        saleItemId: item.saleItemId,
        quantity: toDecimalString(item.quantity),
        disposition: item.disposition,
        refundAmount: toDecimalString(item.refundAmount),
        serialUnitId: item.serialUnitId,
      })),
      restockedVariantIds,
    };
  }

  private async findReturnByIdempotencyKey(
    organizationId: string,
    idempotencyKey: string,
  ): Promise<ReturnWithRelations | null> {
    const audit = await this.prisma.auditLog.findFirst({
      where: {
        organizationId,
        action: "pos.return.create",
        afterJson: {
          path: ["idempotencyKey"],
          equals: idempotencyKey,
        },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!audit?.entityId) {
      return null;
    }

    return this.prisma.return.findFirst({
      where: { id: audit.entityId, organizationId },
      include: RETURN_INCLUDE,
    });
  }

  private async sumCompletedReturnsBySaleItem(
    saleId: string,
  ): Promise<Map<string, Prisma.Decimal>> {
    const rows = await this.prisma.returnItem.findMany({
      where: {
        saleItem: { saleId },
        returnDoc: { status: ReturnStatus.COMPLETED },
      },
      select: { saleItemId: true, quantity: true },
    });

    const map = new Map<string, Prisma.Decimal>();
    for (const row of rows) {
      const prev = map.get(row.saleItemId) ?? new Prisma.Decimal(0);
      map.set(row.saleItemId, prev.plus(toDecimal(row.quantity)));
    }
    return map;
  }

  private parseReturnDisposition(value: string): ReturnDisposition {
    if (
      !Object.values(ReturnDisposition).includes(value as ReturnDisposition)
    ) {
      throw new BadRequestException(`Invalid disposition: ${value}`);
    }
    return value as ReturnDisposition;
  }

  private async verifyManagerPin(
    organizationId: string,
    pin: string,
  ): Promise<{ id: string } | null> {
    const candidates = await this.prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
        pinHash: { not: null },
        userRoles: {
          some: { role: { code: { in: [...MANAGER_ROLES] } } },
        },
      },
      select: { id: true, pinHash: true },
    });

    for (const candidate of candidates) {
      if (!candidate.pinHash) continue;
      const ok = await verifyPassword(pin, candidate.pinHash);
      if (ok) return { id: candidate.id };
    }
    return null;
  }
}
