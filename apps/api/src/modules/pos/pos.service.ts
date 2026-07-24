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
  ReturnStatus,
  SaleStatus,
  type Payment,
  type RegisterSession,
  type Sale,
  type SaleItem,
  type SaleItemSerial,
} from "@gulio/database";
import { PermissionCode } from "@gulio/contracts";
import type {
  CheckoutRequest,
  CloseShiftRequest,
  DecimalString,
  FiscalDocumentStubDto,
  OpenShiftRequest,
  PaymentDto,
  ReceiptDto,
  RegisterSessionDto,
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
}
