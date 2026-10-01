import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  GoodsReceiptStatus,
  Prisma,
  type Supplier,
} from "@gulio/database";
import {
  GOODS_RECEIPT_SORTS,
  GOODS_RECEIPT_STATUSES,
  RECEIPT_PAYMENT_STATUSES,
  SUPPLIER_PAYMENT_METHODS,
  type CreateGoodsReceiptRequest,
  type CreateGoodsReceiptResponse,
  type CreateSupplierRequest,
  type DecimalString,
  type GoodsReceiptDto,
  type GoodsReceiptLineDto,
  type GoodsReceiptListQuery,
  type GoodsReceiptListResponse,
  type GoodsReceiptSort,
  type GoodsReceiptStatus as ContractGoodsReceiptStatus,
  type GoodsReceiptSummaryDto,
  type ReceiptPaymentStatus,
  type RecordSupplierPaymentRequest,
  type SupplierDto,
  type SupplierListResponse,
  type SupplierPaymentDto,
  type SupplierPaymentMethod,
  type UpdateSupplierRequest,
} from "@gulio/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { InventoryService } from "../inventory/inventory.service";
import type { RequestUser } from "../auth/types/request-user";

export type SupplierPaymentListQuery = {
  supplierId?: string;
  receiptId?: string;
  page?: number;
  pageSize?: number;
};

export type SupplierPaymentListResponse = {
  items: SupplierPaymentDto[];
  total: number;
  page: number;
  pageSize: number;
};

// ---------------------------------------------------------------------------
// Money / quantity helpers — Decimal only, never JS float.
// ---------------------------------------------------------------------------

function toDecimal(value: number | string | Prisma.Decimal): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

function toDecimalString(
  value: Prisma.Decimal | number | string | null | undefined,
): DecimalString {
  if (value === null || value === undefined) return "0.0000";
  return toDecimal(value).toFixed(4);
}

function floorZero(value: Prisma.Decimal): Prisma.Decimal {
  return value.lt(0) ? new Prisma.Decimal(0) : value;
}

function parseDecimal(
  value: string | number,
  field: string,
): Prisma.Decimal {
  let decimal: Prisma.Decimal;
  try {
    decimal = new Prisma.Decimal(value);
  } catch {
    throw new BadRequestException(`${field} must be a valid decimal number`);
  }
  if (!decimal.isFinite()) {
    throw new BadRequestException(`${field} must be a finite decimal number`);
  }
  return decimal;
}

function derivePaymentStatus(
  total: Prisma.Decimal,
  paidTotal: Prisma.Decimal,
): ReceiptPaymentStatus {
  if (paidTotal.lte(0)) return "PENDING";
  if (floorZero(total.minus(paidTotal)).lte(0)) return "PAID";
  return "PARTIAL";
}

function parseOptionalDate(
  value: string | undefined | null,
  field: string,
): Date | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${field} must be a valid ISO date`);
  }
  return parsed;
}

function normalizeNullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function optionalUuid(
  value: string | null | undefined,
  field: string,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (!UUID_RE.test(trimmed)) {
    throw new BadRequestException(`${field} must be a valid UUID`);
  }
  return trimmed;
}

function requireUuid(value: string | null | undefined, field: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new BadRequestException(`${field} is required`);
  }
  if (!UUID_RE.test(trimmed)) {
    throw new BadRequestException(`${field} must be a valid UUID`);
  }
  return trimmed;
}

function parsePageSize(query: { page?: number; pageSize?: number }): {
  page: number;
  pageSize: number;
} {
  const rawPage = Number(query.page ?? 1);
  const rawPageSize = Number(query.pageSize ?? 20);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize >= 1
      ? Math.min(Math.floor(rawPageSize), 200)
      : 20;
  return { page, pageSize };
}

// ---------------------------------------------------------------------------
// Prisma include shapes
// ---------------------------------------------------------------------------

const PAYMENT_INCLUDE = {
  supplier: { select: { name: true } },
  recordedBy: { select: { fullName: true } },
} as const;

const RECEIPT_INCLUDE = {
  branch: { select: { id: true, name: true } },
  warehouse: { select: { id: true, name: true } },
  supplier: { select: { id: true, name: true } },
  receivedBy: { select: { id: true, fullName: true } },
  lines: {
    include: {
      variant: {
        include: {
          product: { select: { id: true, name: true, imageUrl: true } },
        },
      },
      serials: {
        include: { serialUnit: { select: { serialNumber: true } } },
      },
    },
  },
  payments: { include: PAYMENT_INCLUDE },
} as const;

type PaymentWithRelations = Prisma.SupplierPaymentGetPayload<{
  include: typeof PAYMENT_INCLUDE;
}>;

type ReceiptWithRelations = Prisma.GoodsReceiptGetPayload<{
  include: typeof RECEIPT_INCLUDE;
}>;

type PreparedReceipt = {
  row: ReceiptWithRelations;
  paidTotal: Prisma.Decimal;
  pendingTotal: Prisma.Decimal;
};

function mapPayment(payment: PaymentWithRelations): SupplierPaymentDto {
  return {
    id: payment.id,
    supplierId: payment.supplierId,
    supplierName: payment.supplier?.name ?? null,
    receiptId: payment.receiptId,
    amount: toDecimalString(payment.amount),
    method: payment.method as SupplierPaymentMethod,
    reference: payment.reference,
    note: payment.note,
    paidAt: payment.paidAt.toISOString(),
    recordedByName: payment.recordedBy?.fullName ?? null,
  };
}

function prepareReceipt(row: ReceiptWithRelations): PreparedReceipt {
  const paidTotal = row.payments.reduce(
    (acc, payment) => acc.plus(payment.amount),
    new Prisma.Decimal(0),
  );
  return {
    row,
    paidTotal,
    pendingTotal: floorZero(row.total.minus(paidTotal)),
  };
}

function mapReceipt(prepared: PreparedReceipt): GoodsReceiptDto {
  const { row, paidTotal, pendingTotal } = prepared;

  const lines: GoodsReceiptLineDto[] = row.lines.map((line) => {
    const marginPerUnit = line.retailPrice.minus(line.unitCost);
    return {
      id: line.id,
      variantId: line.variantId,
      productId: line.variant.product.id,
      productName: line.variant.product.name,
      variantName: line.variant.name,
      sku: line.variant.sku,
      imageUrl: line.variant.imageUrl ?? line.variant.product.imageUrl,
      quantity: toDecimalString(line.quantity),
      unitCost: toDecimalString(line.unitCost),
      retailPrice: toDecimalString(line.retailPrice),
      lineTotal: toDecimalString(line.lineTotal),
      marginPerUnit: toDecimalString(marginPerUnit),
      potentialMargin: toDecimalString(marginPerUnit.times(line.quantity)),
      tracksSerial: line.tracksSerial,
      serialNumbers: line.serials.map(
        (serial) => serial.serialUnit.serialNumber,
      ),
    };
  });

  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    status: row.status as ContractGoodsReceiptStatus,
    paymentStatus: derivePaymentStatus(row.total, paidTotal),
    branchId: row.branchId,
    branchName: row.branch.name,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouse.name,
    supplierId: row.supplierId,
    supplierName: row.supplier?.name ?? null,
    reason: row.reason,
    notes: row.notes,
    subtotal: toDecimalString(row.subtotal),
    discountTotal: toDecimalString(row.discountTotal),
    taxTotal: toDecimalString(row.taxTotal),
    total: toDecimalString(row.total),
    paidTotal: toDecimalString(paidTotal),
    pendingTotal: toDecimalString(pendingTotal),
    totalUnits: row.lines.reduce((acc, line) => acc + Number(line.quantity), 0),
    lineCount: row.lines.length,
    receivedAt: row.receivedAt.toISOString(),
    postedAt: row.postedAt ? row.postedAt.toISOString() : null,
    receivedByName: row.receivedBy?.fullName ?? null,
    lines,
    payments: row.payments.map((payment) => mapPayment(payment)),
  };
}

const RECEIPT_ORDER: Prisma.GoodsReceiptOrderByWithRelationInput[] = [
  { receivedAt: "desc" },
  { createdAt: "desc" },
];

@Injectable()
export class PurchasingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // Suppliers
  // -------------------------------------------------------------------------

  async listSuppliers(
    user: RequestUser,
    query: { search?: string; includeInactive?: boolean } = {},
  ): Promise<SupplierListResponse> {
    const search = query.search?.trim();
    const suppliers = await this.prisma.supplier.findMany({
      where: {
        organizationId: user.organizationId,
        ...(query.includeInactive ? {} : { isActive: true }),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
    });

    return { items: await this.attachSupplierStats(user.organizationId, suppliers) };
  }

  async createSupplier(
    user: RequestUser,
    body: CreateSupplierRequest,
  ): Promise<SupplierDto> {
    const name = body.name?.trim();
    if (!name) {
      throw new BadRequestException("Supplier name is required");
    }

    let supplier: Supplier;
    try {
      supplier = await this.prisma.supplier.create({
        data: {
          organizationId: user.organizationId,
          name,
          phone: normalizeNullable(body.phone),
          email: normalizeNullable(body.email),
          address: normalizeNullable(body.address),
          notes: normalizeNullable(body.notes),
        },
      });
    } catch (err) {
      rethrowSupplierNameConflict(err, name);
    }

    const [dto] = await this.attachSupplierStats(user.organizationId, [
      supplier,
    ]);
    return dto;
  }

  async updateSupplier(
    user: RequestUser,
    supplierId: string,
    body: UpdateSupplierRequest,
  ): Promise<SupplierDto> {
    const existing = await this.prisma.supplier.findFirst({
      where: { id: supplierId, organizationId: user.organizationId },
    });
    if (!existing) {
      throw new NotFoundException("Supplier not found");
    }

    const data: Prisma.SupplierUpdateInput = {};
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) {
        throw new BadRequestException("Supplier name cannot be empty");
      }
      data.name = name;
    }
    if (body.phone !== undefined) data.phone = normalizeNullable(body.phone);
    if (body.email !== undefined) data.email = normalizeNullable(body.email);
    if (body.address !== undefined) {
      data.address = normalizeNullable(body.address);
    }
    if (body.notes !== undefined) data.notes = normalizeNullable(body.notes);
    if (body.isActive !== undefined) data.isActive = body.isActive;

    let updated: Supplier;
    try {
      updated = await this.prisma.supplier.update({
        where: { id: existing.id },
        data,
      });
    } catch (err) {
      rethrowSupplierNameConflict(err, data.name as string | undefined);
    }

    const [dto] = await this.attachSupplierStats(user.organizationId, [updated]);
    return dto;
  }

  /**
   * Lifetime received / paid / pending + receipt count and last delivery,
   * derived from receipts and payments (never stored, so it cannot drift).
   */
  private async attachSupplierStats(
    organizationId: string,
    suppliers: Supplier[],
  ): Promise<SupplierDto[]> {
    if (suppliers.length === 0) return [];
    const ids = suppliers.map((supplier) => supplier.id);
    const zero = new Prisma.Decimal(0);

    const [receiptAgg, paymentAgg] = await Promise.all([
      this.prisma.goodsReceipt.groupBy({
        by: ["supplierId"],
        where: {
          organizationId,
          supplierId: { in: ids },
          status: GoodsReceiptStatus.POSTED,
        },
        _sum: { total: true },
        _count: { _all: true },
        _max: { receivedAt: true },
      }),
      this.prisma.supplierPayment.groupBy({
        by: ["supplierId"],
        where: { organizationId, supplierId: { in: ids } },
        _sum: { amount: true },
      }),
    ]);

    const receivedBySupplier = new Map<
      string,
      { total: Prisma.Decimal; count: number; lastReceivedAt: Date | null }
    >();
    for (const row of receiptAgg) {
      if (!row.supplierId) continue;
      receivedBySupplier.set(row.supplierId, {
        total: row._sum.total ?? zero,
        count: row._count._all,
        lastReceivedAt: row._max.receivedAt ?? null,
      });
    }

    const paidBySupplier = new Map<string, Prisma.Decimal>();
    for (const row of paymentAgg) {
      paidBySupplier.set(row.supplierId, row._sum.amount ?? zero);
    }

    return suppliers.map((supplier) => {
      const received = receivedBySupplier.get(supplier.id);
      const totalReceived = received?.total ?? zero;
      const totalPaid = paidBySupplier.get(supplier.id) ?? zero;
      return {
        id: supplier.id,
        name: supplier.name,
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address,
        notes: supplier.notes,
        isActive: supplier.isActive,
        totalReceived: toDecimalString(totalReceived),
        totalPaid: toDecimalString(totalPaid),
        totalPending: toDecimalString(
          floorZero(totalReceived.minus(totalPaid)),
        ),
        receiptsCount: received?.count ?? 0,
        lastReceivedAt: received?.lastReceivedAt
          ? received.lastReceivedAt.toISOString()
          : null,
        createdAt: supplier.createdAt.toISOString(),
      };
    });
  }

  // -------------------------------------------------------------------------
  // Goods receipts
  // -------------------------------------------------------------------------

  async listReceipts(
    user: RequestUser,
    query: GoodsReceiptListQuery = {},
  ): Promise<GoodsReceiptListResponse> {
    const search = query.search?.trim();
    const status = parseEnum(
      query.status,
      GOODS_RECEIPT_STATUSES,
      "status",
    ) as ContractGoodsReceiptStatus | undefined;
    const paymentStatus = parseEnum(
      query.paymentStatus,
      RECEIPT_PAYMENT_STATUSES,
      "paymentStatus",
    ) as ReceiptPaymentStatus | undefined;
    const sort = parseEnum(
      query.sort,
      GOODS_RECEIPT_SORTS,
      "sort",
    ) as GoodsReceiptSort | undefined;
    const dir = query.dir === "asc" ? "asc" : "desc";
    const supplierId = optionalUuid(query.supplierId, "supplierId");
    const branchId = optionalUuid(query.branchId, "branchId");
    const warehouseId = optionalUuid(query.warehouseId, "warehouseId");

    const from = parseOptionalDate(query.from, "from");
    const to = parseOptionalDate(query.to, "to");
    const receivedAtRange =
      from || to
        ? {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          }
        : undefined;

    const where: Prisma.GoodsReceiptWhereInput = {
      organizationId: user.organizationId,
      ...(supplierId ? { supplierId } : {}),
      ...(branchId ? { branchId } : {}),
      ...(warehouseId ? { warehouseId } : {}),
      ...(status ? { status } : {}),
      ...(receivedAtRange ? { receivedAt: receivedAtRange } : {}),
      ...(search
        ? {
            OR: [
              { invoiceNumber: { contains: search, mode: "insensitive" } },
              {
                supplier: {
                  name: { contains: search, mode: "insensitive" },
                },
              },
              {
                lines: {
                  some: {
                    variant: {
                      sku: { contains: search, mode: "insensitive" },
                    },
                  },
                },
              },
              {
                lines: {
                  some: {
                    variant: {
                      name: { contains: search, mode: "insensitive" },
                    },
                  },
                },
              },
              {
                lines: {
                  some: {
                    variant: {
                      product: {
                        name: { contains: search, mode: "insensitive" },
                      },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.goodsReceipt.findMany({
      where,
      orderBy: RECEIPT_ORDER,
      include: RECEIPT_INCLUDE,
    });

    let prepared = rows.map((row) => prepareReceipt(row));

    if (paymentStatus) {
      prepared = prepared.filter(
        (item) =>
          derivePaymentStatus(item.row.total, item.paidTotal) === paymentStatus,
      );
    }

    prepared = sortReceipts(prepared, sort ?? "receivedAt", dir);

    const summary = buildSummary(prepared);
    const { page, pageSize } = parsePageSize(query);
    const start = (page - 1) * pageSize;
    const items = prepared
      .slice(start, start + pageSize)
      .map((item) => mapReceipt(item));

    return { items, total: prepared.length, page, pageSize, summary };
  }

  async getReceipt(
    user: RequestUser,
    receiptId: string,
  ): Promise<GoodsReceiptDto> {
    const row = await this.prisma.goodsReceipt.findFirst({
      where: { id: receiptId, organizationId: user.organizationId },
      include: RECEIPT_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException("Goods receipt not found");
    }
    return mapReceipt(prepareReceipt(row));
  }

  /**
   * Post a goods receipt. Supplier + receipt + lines + PURCHASE_RECEIPT ledger
   * movements + serial links + POSTED status all commit in ONE transaction:
   * a duplicate IMEI or a bad variant rolls the whole delivery back.
   */
  async createReceipt(
    user: RequestUser,
    body: CreateGoodsReceiptRequest,
  ): Promise<CreateGoodsReceiptResponse> {
    const inputs = body.lines ?? [];
    if (inputs.length === 0) {
      throw new BadRequestException("A receipt needs at least one line");
    }

    const warehouseId = requireUuid(body.warehouseId, "warehouseId");
    const invoiceNumber = normalizeNullable(body.invoiceNumber);
    const reason = normalizeNullable(body.reason);
    const notes = normalizeNullable(body.notes);
    const movementReason = invoiceNumber ?? reason ?? "Purchase receipt";

    const discountTotal =
      body.discountTotal === undefined || body.discountTotal === null
        ? new Prisma.Decimal(0)
        : parseDecimal(body.discountTotal, "discountTotal");
    const taxTotal =
      body.taxTotal === undefined || body.taxTotal === null
        ? new Prisma.Decimal(0)
        : parseDecimal(body.taxTotal, "taxTotal");
    if (discountTotal.lt(0)) {
      throw new BadRequestException("discountTotal cannot be negative");
    }
    if (taxTotal.lt(0)) {
      throw new BadRequestException("taxTotal cannot be negative");
    }

    const receivedAt =
      parseOptionalDate(body.receivedAt, "receivedAt") ?? new Date();

    let result: CreateGoodsReceiptResponse;
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const warehouse = await tx.warehouse.findFirst({
          where: {
            id: warehouseId,
            organizationId: user.organizationId,
          },
          select: { id: true, branchId: true },
        });
        if (!warehouse) {
          throw new NotFoundException("Warehouse not found");
        }

        const supplierId = await this.resolveSupplierId(tx, user, body);

        const receipt = await tx.goodsReceipt.create({
          data: {
            organizationId: user.organizationId,
            branchId: warehouse.branchId,
            warehouseId: warehouse.id,
            supplierId,
            invoiceNumber,
            status: GoodsReceiptStatus.DRAFT,
            reason,
            notes,
            receivedByUserId: user.userId,
            receivedAt,
          },
        });

        let subtotal = new Prisma.Decimal(0);
        const movementResults: CreateGoodsReceiptResponse["movements"] = [];

        for (const input of inputs) {
          const variantId = requireUuid(input.variantId, "variantId");
          const variant = await tx.variant.findFirst({
            where: {
              id: variantId,
              organizationId: user.organizationId,
            },
            select: { id: true, tracksSerial: true, sellPrice: true },
          });
          if (!variant) {
            throw new NotFoundException(
              `Variant ${input.variantId} not found`,
            );
          }

          const quantity = parseDecimal(input.quantity, "quantity");
          if (!quantity.isInteger() || quantity.lte(0)) {
            throw new BadRequestException(
              "quantity must be a whole number greater than zero",
            );
          }
          const unitCost = parseDecimal(input.unitCost, "unitCost");
          if (unitCost.lt(0)) {
            throw new BadRequestException("unitCost cannot be negative");
          }
          const retailPrice =
            input.retailPrice === undefined || input.retailPrice === null
              ? variant.sellPrice
              : parseDecimal(input.retailPrice, "retailPrice");

          const lineTotal = unitCost.times(quantity);
          subtotal = subtotal.plus(lineTotal);

          const line = await tx.goodsReceiptLine.create({
            data: {
              organizationId: user.organizationId,
              receiptId: receipt.id,
              variantId: variant.id,
              quantity,
              unitCost,
              retailPrice,
              lineTotal,
              tracksSerial: variant.tracksSerial,
            },
          });

          const serialNumbers = (input.serialNumbers ?? [])
            .map((serial) => serial.trim())
            .filter(Boolean);

          const committed = await this.inventoryService.commitPurchaseReceipt(
            tx,
            {
              organizationId: user.organizationId,
              warehouseId: warehouse.id,
              variantId: variant.id,
              quantity: quantity.toFixed(4),
              reason: movementReason,
              serialNumbers,
              createdByUserId: user.userId,
              referenceType: "GoodsReceipt",
              referenceId: receipt.id,
            },
          );

          for (const serial of committed.serials) {
            await tx.goodsReceiptSerial.create({
              data: { receiptLineId: line.id, serialUnitId: serial.id },
            });
          }

          for (const movement of committed.movements) {
            movementResults.push({
              id: movement.id,
              variantId: movement.variantId,
              quantityDelta: movement.quantityDelta,
              movementType: movement.movementType,
            });
          }
        }

        const total = subtotal.minus(discountTotal).plus(taxTotal);
        await tx.goodsReceipt.update({
          where: { id: receipt.id },
          data: {
            subtotal,
            discountTotal,
            taxTotal,
            total,
            status: GoodsReceiptStatus.POSTED,
            postedAt: new Date(),
          },
        });

        const full = await tx.goodsReceipt.findUniqueOrThrow({
          where: { id: receipt.id },
          include: RECEIPT_INCLUDE,
        });

        return {
          receipt: mapReceipt(prepareReceipt(full)),
          movements: movementResults,
        };
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException(
          "A receipt with this invoice number already exists",
        );
      }
      throw err;
    }

    await this.audit.log({
      action: "purchasing.receipt.posted",
      entityType: "GoodsReceipt",
      entityId: result.receipt.id,
      userId: user.userId,
      orgId: user.organizationId,
      meta: {
        invoiceNumber,
        supplierId: result.receipt.supplierId,
        warehouseId: result.receipt.warehouseId,
        total: result.receipt.total,
        lineCount: result.receipt.lineCount,
        totalUnits: result.receipt.totalUnits,
        movementIds: result.movements.map((movement) => movement.id),
      },
    });

    return result;
  }

  /** Existing supplier (org-checked) or find-or-create by (org, name). */
  private async resolveSupplierId(
    tx: Prisma.TransactionClient,
    user: RequestUser,
    body: CreateGoodsReceiptRequest,
  ): Promise<string | null> {
    const supplierId = optionalUuid(body.supplierId, "supplierId");
    if (supplierId) {
      const supplier = await tx.supplier.findFirst({
        where: { id: supplierId, organizationId: user.organizationId },
        select: { id: true },
      });
      if (!supplier) {
        throw new NotFoundException("Supplier not found");
      }
      return supplier.id;
    }

    const supplierName = body.supplierName?.trim();
    if (!supplierName) return null;

    const supplier = await tx.supplier.upsert({
      where: {
        organizationId_name: {
          organizationId: user.organizationId,
          name: supplierName,
        },
      },
      update: {},
      create: { organizationId: user.organizationId, name: supplierName },
      select: { id: true },
    });
    return supplier.id;
  }

  // -------------------------------------------------------------------------
  // Supplier payments
  // -------------------------------------------------------------------------

  async listPayments(
    user: RequestUser,
    query: SupplierPaymentListQuery = {},
  ): Promise<SupplierPaymentListResponse> {
    const { page, pageSize } = parsePageSize(query);
    const supplierId = optionalUuid(query.supplierId, "supplierId");
    const receiptId = optionalUuid(query.receiptId, "receiptId");
    const where: Prisma.SupplierPaymentWhereInput = {
      organizationId: user.organizationId,
      ...(supplierId ? { supplierId } : {}),
      ...(receiptId ? { receiptId } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.supplierPayment.count({ where }),
      this.prisma.supplierPayment.findMany({
        where,
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: PAYMENT_INCLUDE,
      }),
    ]);

    return {
      items: rows.map((row) => mapPayment(row)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Record a supplier payment. With `receiptId` a single row settles that
   * invoice; without it the amount is allocated to the supplier's oldest
   * outstanding receipts first, then any remainder as an on-account credit.
   */
  async recordPayment(
    user: RequestUser,
    body: RecordSupplierPaymentRequest,
  ): Promise<SupplierPaymentDto> {
    const amount = parseDecimal(body.amount, "amount");
    if (amount.lte(0)) {
      throw new BadRequestException("amount must be greater than zero");
    }
    if (
      !SUPPLIER_PAYMENT_METHODS.includes(
        body.method as SupplierPaymentMethod,
      )
    ) {
      throw new BadRequestException("Invalid payment method");
    }
    const paidAt =
      parseOptionalDate(body.paidAt, "paidAt") ?? new Date();
    const reference = normalizeNullable(body.reference);
    const note = normalizeNullable(body.note);
    const supplierId = requireUuid(body.supplierId, "supplierId");
    const receiptId = optionalUuid(body.receiptId, "receiptId");

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!supplier) {
      throw new NotFoundException("Supplier not found");
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const base = {
        organizationId: user.organizationId,
        supplierId: supplier.id,
        method: body.method as SupplierPaymentMethod,
        reference,
        note,
        paidAt,
        recordedByUserId: user.userId,
      };

      if (receiptId) {
        const receipt = await tx.goodsReceipt.findFirst({
          where: {
            id: receiptId,
            organizationId: user.organizationId,
            supplierId: supplier.id,
          },
          select: { id: true },
        });
        if (!receipt) {
          throw new NotFoundException(
            "Goods receipt not found for this supplier",
          );
        }
        const row = await tx.supplierPayment.create({
          data: { ...base, receiptId: receipt.id, amount },
        });
        return [row];
      }

      const receipts = await tx.goodsReceipt.findMany({
        where: {
          organizationId: user.organizationId,
          supplierId: supplier.id,
          status: GoodsReceiptStatus.POSTED,
        },
        orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }],
        select: { id: true, total: true },
      });

      const paidAgg = await tx.supplierPayment.groupBy({
        by: ["receiptId"],
        where: {
          organizationId: user.organizationId,
          supplierId: supplier.id,
          receiptId: { not: null },
        },
        _sum: { amount: true },
      });
      const paidByReceipt = new Map<string, Prisma.Decimal>();
      for (const row of paidAgg) {
        if (row.receiptId) {
          paidByReceipt.set(
            row.receiptId,
            row._sum.amount ?? new Prisma.Decimal(0),
          );
        }
      }

      let remaining = amount;
      const rows: Awaited<ReturnType<typeof tx.supplierPayment.create>>[] = [];

      for (const receipt of receipts) {
        if (remaining.lte(0)) break;
        const paid = paidByReceipt.get(receipt.id) ?? new Prisma.Decimal(0);
        const pending = receipt.total.minus(paid);
        if (pending.lte(0)) continue;
        const slice = remaining.lt(pending) ? remaining : pending;
        const row = await tx.supplierPayment.create({
          data: { ...base, receiptId: receipt.id, amount: slice },
        });
        rows.push(row);
        remaining = remaining.minus(slice);
      }

      if (remaining.gt(0)) {
        const row = await tx.supplierPayment.create({
          data: { ...base, receiptId: null, amount: remaining },
        });
        rows.push(row);
      }

      return rows;
    });

    const createdIds = created.map((row) => row.id);
    const hydrated = await this.prisma.supplierPayment.findMany({
      where: { id: { in: createdIds } },
      include: PAYMENT_INCLUDE,
    });
    const primary =
      hydrated.find((row) => row.id === createdIds[0]) ?? hydrated[0];
    if (!primary) {
      throw new NotFoundException("Payment could not be recorded");
    }

    await this.audit.log({
      action: "purchasing.payment.recorded",
      entityType: "SupplierPayment",
      entityId: primary.id,
      userId: user.userId,
      orgId: user.organizationId,
      meta: {
        supplierId: supplier.id,
        requestedAmount: toDecimalString(amount),
        method: body.method,
        receiptId: receiptId ?? null,
        allocations: created.map((row) => ({
          paymentId: row.id,
          receiptId: row.receiptId,
          amount: toDecimalString(row.amount),
        })),
      },
    });

    return mapPayment(primary);
  }
}

// ---------------------------------------------------------------------------
// Free helpers
// ---------------------------------------------------------------------------

function sortReceipts(
  items: PreparedReceipt[],
  sort: GoodsReceiptSort,
  dir: "asc" | "desc",
): PreparedReceipt[] {
  const multiplier = dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    let cmp: number;
    if (sort === "total") {
      cmp = a.row.total.cmp(b.row.total);
    } else if (sort === "pendingTotal") {
      cmp = a.pendingTotal.cmp(b.pendingTotal);
    } else {
      cmp = a.row.receivedAt.getTime() - b.row.receivedAt.getTime();
    }
    if (cmp === 0) {
      cmp = a.row.createdAt.getTime() - b.row.createdAt.getTime();
    }
    if (cmp === 0) {
      cmp = a.row.id.localeCompare(b.row.id);
    }
    return cmp * multiplier;
  });
}

function buildSummary(items: PreparedReceipt[]): GoodsReceiptSummaryDto {
  const zero = new Prisma.Decimal(0);
  let unitsReceived = 0;
  let serialUnits = 0;
  let totalValue = zero;
  let paidTotal = zero;
  let pendingTotal = zero;
  let potentialMargin = zero;
  const suppliers = new Set<string>();

  for (const item of items) {
    totalValue = totalValue.plus(item.row.total);
    paidTotal = paidTotal.plus(item.paidTotal);
    pendingTotal = pendingTotal.plus(item.pendingTotal);
    if (item.row.supplierId) suppliers.add(item.row.supplierId);

    for (const line of item.row.lines) {
      unitsReceived += Number(line.quantity);
      serialUnits += line.serials.length;
      potentialMargin = potentialMargin.plus(
        line.retailPrice.minus(line.unitCost).times(line.quantity),
      );
    }
  }

  return {
    receiptsCount: items.length,
    unitsReceived,
    totalValue: toDecimalString(totalValue),
    paidTotal: toDecimalString(paidTotal),
    pendingTotal: toDecimalString(pendingTotal),
    supplierCount: suppliers.size,
    potentialMargin: toDecimalString(potentialMargin),
    serialUnits,
  };
}

function parseEnum<T extends readonly string[]>(
  value: string | undefined,
  allowed: T,
  field: string,
): T[number] | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (!allowed.includes(value)) {
    throw new BadRequestException(
      `${field} must be one of: ${allowed.join(", ")}`,
    );
  }
  return value as T[number];
}

function rethrowSupplierNameConflict(
  err: unknown,
  name: string | undefined,
): never {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    throw new ConflictException(
      `A supplier named "${name ?? ""}" already exists`,
    );
  }
  throw err;
}
