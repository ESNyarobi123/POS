import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  Prisma,
  SerialStatus,
  StockMovementType,
  type StockBalance,
  type StockMovement,
  type SerialUnit,
} from "@gulio/database";
import type {
  CommitAdjustmentInput,
  CommitAdjustmentResult,
  CommitReturnMovementInput,
  CommitReturnMovementResult,
  CommitSaleMovementInput,
  CommitSaleMovementResult,
  CreateStockAdjustmentRequest,
  DecimalString,
  RemoveSerialUnitRequest,
  RemoveSerialUnitResult,
  SerialStatus as ContractSerialStatus,
  SerialUnitDto,
  StockBalanceDto,
  StockMovementDto,
  StockMovementType as ContractMovementType,
  UpdateSerialUnitRequest,
  VariantSerialPanelDto,
} from "@gulio/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/types/request-user";

/** Interactive transaction client passed by sales checkout / returns. */
export type InventoryTx = Prisma.TransactionClient;

function toDecimal(value: number | string | Prisma.Decimal): Prisma.Decimal {
  return value instanceof Prisma.Decimal
    ? value
    : new Prisma.Decimal(value);
}

function toDecimalString(value: Prisma.Decimal | number | string): DecimalString {
  return toDecimal(value).toFixed(4);
}

function availableQty(balance: {
  quantityOnHand: Prisma.Decimal;
  quantityReserved: Prisma.Decimal;
}): Prisma.Decimal {
  return balance.quantityOnHand.minus(balance.quantityReserved);
}

function mapMovement(row: StockMovement): StockMovementDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    warehouseId: row.warehouseId,
    variantId: row.variantId,
    movementType: row.movementType as ContractMovementType,
    quantityDelta: toDecimalString(row.quantityDelta),
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    serialUnitId: row.serialUnitId,
    createdByUserId: row.createdByUserId,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapBalance(row: StockBalance): StockBalanceDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    warehouseId: row.warehouseId,
    variantId: row.variantId,
    quantityOnHand: toDecimalString(row.quantityOnHand),
    quantityReserved: toDecimalString(row.quantityReserved),
    quantityAvailable: toDecimalString(availableQty(row)),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapSerial(row: SerialUnit): SerialUnitDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    variantId: row.variantId,
    warehouseId: row.warehouseId,
    serialNumber: row.serialNumber,
    status: row.status as ContractSerialStatus,
    currentSaleItemId: row.currentSaleItemId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const SERIAL_NUMBER_MAX_LEN = 64;

const REMOVABLE_OFF_HAND = new Set<SerialStatus>([
  SerialStatus.DAMAGED,
  SerialStatus.RETURNED,
  SerialStatus.IN_REPAIR,
  SerialStatus.SUPPLIER_RETURN,
]);

function assertOwner(user: RequestUser): void {
  const roles = (user.roles ?? []).map((role) => role.toUpperCase());
  if (!roles.includes("OWNER")) {
    throw new ForbiddenException(
      "Only the owner can inspect or edit serial units",
    );
  }
}

function requireReason(reason: string | undefined): string {
  const trimmed = reason?.trim() ?? "";
  if (trimmed.length < 3) {
    throw new BadRequestException("reason must be at least 3 characters");
  }
  return trimmed;
}

function normalizeSerialNumber(raw: string | undefined): string {
  const serialNumber = raw?.trim() ?? "";
  if (serialNumber.length < 1 || serialNumber.length > SERIAL_NUMBER_MAX_LEN) {
    throw new BadRequestException(
      `serialNumber must be 1–${SERIAL_NUMBER_MAX_LEN} characters`,
    );
  }
  return serialNumber;
}

function liveSerialNumberWhere(
  organizationId: string,
  serialNumber: string,
  excludeId?: string,
) {
  return {
    organizationId,
    serialNumber: { equals: serialNumber, mode: "insensitive" as const },
    status: { not: SerialStatus.REMOVED },
    ...(excludeId ? { id: { not: excludeId } } : {}),
  };
}

function rethrowLiveSerialConflict(err: unknown, serialNumber: string): never {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    throw new ConflictException(
      `Serial number already exists: ${serialNumber}`,
    );
  }
  throw err;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Append SALE ledger row(s), decrement StockBalance, mark serials SOLD.
   * Must run inside the caller's DB transaction (atomic checkout).
   */
  async commitSaleMovement(
    tx: InventoryTx,
    input: CommitSaleMovementInput,
  ): Promise<CommitSaleMovementResult> {
    const quantity = toDecimal(input.quantity);
    if (quantity.lte(0)) {
      throw new BadRequestException("Sale quantity must be positive");
    }

    const serialIds = input.serialUnitIds ?? [];
    if (serialIds.length > 0 && !quantity.equals(serialIds.length)) {
      throw new BadRequestException(
        "serialUnitIds length must equal quantity for serial-tracked sales",
      );
    }

    const balance = await this.lockBalance(
      tx,
      input.organizationId,
      input.warehouseId,
      input.variantId,
    );

    const available = availableQty(balance);
    if (available.lt(quantity)) {
      throw new UnprocessableEntityException({
        code: "INSUFFICIENT_STOCK",
        message: `Insufficient stock for variant ${input.variantId}`,
        available: toDecimalString(available),
        requested: toDecimalString(quantity),
      });
    }

    const movements: StockMovement[] = [];

    if (serialIds.length > 0) {
      for (const serialUnitId of serialIds) {
        await this.markSerialSold(tx, {
          serialUnitId,
          organizationId: input.organizationId,
          warehouseId: input.warehouseId,
          variantId: input.variantId,
          saleItemId: input.saleItemId,
        });

        const movement = await tx.stockMovement.create({
          data: {
            organizationId: input.organizationId,
            warehouseId: input.warehouseId,
            variantId: input.variantId,
            movementType: StockMovementType.SALE,
            quantityDelta: new Prisma.Decimal(-1),
            referenceType: "SaleItem",
            referenceId: input.saleItemId,
            serialUnitId,
            createdByUserId: input.createdByUserId,
            reason: `sale:${input.saleId}`,
          },
        });
        movements.push(movement);
      }
    } else {
      const movement = await tx.stockMovement.create({
        data: {
          organizationId: input.organizationId,
          warehouseId: input.warehouseId,
          variantId: input.variantId,
          movementType: StockMovementType.SALE,
          quantityDelta: quantity.negated(),
          referenceType: "SaleItem",
          referenceId: input.saleItemId,
          createdByUserId: input.createdByUserId,
          reason: `sale:${input.saleId}`,
        },
      });
      movements.push(movement);
    }

    const updated = await tx.stockBalance.update({
      where: { id: balance.id },
      data: {
        quantityOnHand: { decrement: quantity },
      },
    });

    return {
      movements: movements.map(mapMovement),
      balance: mapBalance(updated),
    };
  }

  /**
   * Append RETURN (and optional DAMAGE) movements.
   * Restock → balance +qty and serial IN_STOCK; otherwise serial RETURNED/DAMAGED.
   */
  async commitReturnMovement(
    tx: InventoryTx,
    input: CommitReturnMovementInput,
  ): Promise<CommitReturnMovementResult> {
    const quantity = toDecimal(input.quantity);
    if (quantity.lte(0)) {
      throw new BadRequestException("Return quantity must be positive");
    }

    const serialIds = input.serialUnitIds ?? [];
    if (serialIds.length > 0 && !quantity.equals(serialIds.length)) {
      throw new BadRequestException(
        "serialUnitIds length must equal quantity for serial-tracked returns",
      );
    }

    const disposition =
      input.disposition ?? (input.restock ? "RESTOCK" : "WRITE_OFF");
    const restock = input.restock || disposition === "RESTOCK";
    const movements: StockMovement[] = [];

    if (serialIds.length > 0) {
      for (const serialUnitId of serialIds) {
        const nextStatus = this.resolveReturnSerialStatus(restock, disposition);
        await this.markSerialReturned(tx, {
          serialUnitId,
          organizationId: input.organizationId,
          warehouseId: input.warehouseId,
          variantId: input.variantId,
          nextStatus,
          clearSaleLink: restock,
        });

        if (restock) {
          const movement = await tx.stockMovement.create({
            data: {
              organizationId: input.organizationId,
              warehouseId: input.warehouseId,
              variantId: input.variantId,
              movementType: StockMovementType.RETURN,
              quantityDelta: new Prisma.Decimal(1),
              referenceType: "Return",
              referenceId: input.returnId,
              serialUnitId,
              createdByUserId: input.createdByUserId,
              reason: input.returnItemId
                ? `returnItem:${input.returnItemId}`
                : undefined,
            },
          });
          movements.push(movement);
        } else if (disposition === "DAMAGE") {
          const movement = await tx.stockMovement.create({
            data: {
              organizationId: input.organizationId,
              warehouseId: input.warehouseId,
              variantId: input.variantId,
              movementType: StockMovementType.DAMAGE,
              quantityDelta: new Prisma.Decimal(0),
              referenceType: "Return",
              referenceId: input.returnId,
              serialUnitId,
              createdByUserId: input.createdByUserId,
              reason: "return_disposition:DAMAGE",
            },
          });
          movements.push(movement);
        } else {
          const movement = await tx.stockMovement.create({
            data: {
              organizationId: input.organizationId,
              warehouseId: input.warehouseId,
              variantId: input.variantId,
              movementType: StockMovementType.RETURN,
              quantityDelta: new Prisma.Decimal(0),
              referenceType: "Return",
              referenceId: input.returnId,
              serialUnitId,
              createdByUserId: input.createdByUserId,
              reason: `return_no_restock:${disposition}`,
            },
          });
          movements.push(movement);
        }
      }
    } else if (restock) {
      const movement = await tx.stockMovement.create({
        data: {
          organizationId: input.organizationId,
          warehouseId: input.warehouseId,
          variantId: input.variantId,
          movementType: StockMovementType.RETURN,
          quantityDelta: quantity,
          referenceType: "Return",
          referenceId: input.returnId,
          createdByUserId: input.createdByUserId,
          reason: input.returnItemId
            ? `returnItem:${input.returnItemId}`
            : undefined,
        },
      });
      movements.push(movement);
    } else if (disposition === "DAMAGE") {
      const movement = await tx.stockMovement.create({
        data: {
          organizationId: input.organizationId,
          warehouseId: input.warehouseId,
          variantId: input.variantId,
          movementType: StockMovementType.DAMAGE,
          quantityDelta: new Prisma.Decimal(0),
          referenceType: "Return",
          referenceId: input.returnId,
          createdByUserId: input.createdByUserId,
          reason: "return_disposition:DAMAGE",
        },
      });
      movements.push(movement);
    }

    let balance: StockBalance | null = null;
    if (restock) {
      balance = await this.ensureBalance(
        tx,
        input.organizationId,
        input.warehouseId,
        input.variantId,
      );
      balance = await tx.stockBalance.update({
        where: { id: balance.id },
        data: {
          quantityOnHand: { increment: quantity },
        },
      });
    } else {
      balance = await tx.stockBalance.findUnique({
        where: {
          warehouseId_variantId: {
            warehouseId: input.warehouseId,
            variantId: input.variantId,
          },
        },
      });
    }

    return {
      movements: movements.map(mapMovement),
      balance: balance ? mapBalance(balance) : null,
    };
  }

  /**
   * Path A MVP stock intake / write-down via ADJUSTMENT ledger rows.
   * Serial-tracked write-downs are rejected — use returns instead.
   */
  async commitAdjustment(
    tx: InventoryTx,
    input: CommitAdjustmentInput,
  ): Promise<CommitAdjustmentResult> {
    const quantityDelta = toDecimal(input.quantityDelta);
    if (quantityDelta.equals(0)) {
      throw new BadRequestException("quantityDelta must not be zero");
    }

    const reason = input.reason?.trim() ?? "";
    if (reason.length < 3) {
      throw new BadRequestException("reason must be at least 3 characters");
    }

    const variant = await tx.variant.findFirst({
      where: {
        id: input.variantId,
        organizationId: input.organizationId,
      },
    });
    if (!variant) {
      throw new NotFoundException(`Variant ${input.variantId} not found`);
    }

    const absDelta = quantityDelta.abs();
    const movements: StockMovement[] = [];
    const serials: SerialUnit[] = [];

    if (variant.tracksSerial) {
      if (quantityDelta.lt(0)) {
        throw new BadRequestException(
          "Serial-tracked write-downs via adjustment are not supported; use returns",
        );
      }

      const serialNumbers = (input.serialNumbers ?? [])
        .map((s: string) => s.trim())
        .filter(Boolean);
      if (!absDelta.equals(serialNumbers.length)) {
        throw new BadRequestException(
          "serialNumbers length must equal quantityDelta for serial-tracked intake",
        );
      }

      const uniqueSerials = new Set(
        serialNumbers.map((s: string) => s.toUpperCase()),
      );
      if (uniqueSerials.size !== serialNumbers.length) {
        throw new BadRequestException("serialNumbers must be unique");
      }

      for (const raw of serialNumbers) {
        const serialNumber = normalizeSerialNumber(raw);
        const clash = await tx.serialUnit.findFirst({
          where: liveSerialNumberWhere(input.organizationId, serialNumber),
        });
        if (clash) {
          throw new ConflictException(
            `Serial number already exists: ${serialNumber}`,
          );
        }

        let serial: SerialUnit;
        try {
          serial = await tx.serialUnit.create({
            data: {
              organizationId: input.organizationId,
              variantId: input.variantId,
              warehouseId: input.warehouseId,
              serialNumber,
              status: SerialStatus.IN_STOCK,
            },
          });
        } catch (err) {
          rethrowLiveSerialConflict(err, serialNumber);
        }
        serials.push(serial);

        const movement = await tx.stockMovement.create({
          data: {
            organizationId: input.organizationId,
            warehouseId: input.warehouseId,
            variantId: input.variantId,
            movementType: StockMovementType.ADJUSTMENT,
            quantityDelta: new Prisma.Decimal(1),
            referenceType: input.referenceType,
            referenceId: input.referenceId,
            serialUnitId: serial.id,
            createdByUserId: input.createdByUserId,
            reason,
          },
        });
        movements.push(movement);
      }
    } else {
      const movement = await tx.stockMovement.create({
        data: {
          organizationId: input.organizationId,
          warehouseId: input.warehouseId,
          variantId: input.variantId,
          movementType: StockMovementType.ADJUSTMENT,
          quantityDelta,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          createdByUserId: input.createdByUserId,
          reason,
        },
      });
      movements.push(movement);
    }

    let balance: StockBalance;
    if (quantityDelta.gt(0)) {
      balance = await this.ensureBalance(
        tx,
        input.organizationId,
        input.warehouseId,
        input.variantId,
      );
      balance = await tx.stockBalance.update({
        where: { id: balance.id },
        data: {
          quantityOnHand: { increment: absDelta },
        },
      });
    } else {
      balance = await this.lockBalance(
        tx,
        input.organizationId,
        input.warehouseId,
        input.variantId,
      );
      const available = availableQty(balance);
      if (available.lt(absDelta)) {
        throw new UnprocessableEntityException({
          code: "INSUFFICIENT_STOCK",
          message: `Insufficient stock for variant ${input.variantId}`,
          available: toDecimalString(available),
          requested: toDecimalString(absDelta),
        });
      }
      balance = await tx.stockBalance.update({
        where: { id: balance.id },
        data: {
          quantityOnHand: { decrement: absDelta },
        },
      });
    }

    return {
      movements: movements.map(mapMovement),
      balance: mapBalance(balance),
      serials: serials.map(mapSerial),
    };
  }

  /**
   * Org-scoped stock adjustment (Path A intake / non-serial write-down).
   */
  async createAdjustment(
    user: RequestUser,
    body: CreateStockAdjustmentRequest,
  ): Promise<CommitAdjustmentResult> {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: {
        id: body.warehouseId,
        organizationId: user.organizationId,
      },
    });
    if (!warehouse) {
      throw new NotFoundException("Warehouse not found");
    }

    const variant = await this.prisma.variant.findFirst({
      where: {
        id: body.variantId,
        organizationId: user.organizationId,
      },
    });
    if (!variant) {
      throw new NotFoundException("Variant not found");
    }

    const result = await this.prisma.$transaction(async (tx) =>
      this.commitAdjustment(tx, {
        organizationId: user.organizationId,
        warehouseId: body.warehouseId,
        variantId: body.variantId,
        quantityDelta: body.quantityDelta,
        reason: body.reason,
        serialNumbers: body.serialNumbers,
        createdByUserId: user.userId,
        referenceType: "StockAdjustment",
      }),
    );

    await this.audit.log({
      action: "stock.adjustment",
      entityType: "StockBalance",
      entityId: result.balance.id,
      userId: user.userId,
      orgId: user.organizationId,
      meta: {
        warehouseId: body.warehouseId,
        variantId: body.variantId,
        quantityDelta: body.quantityDelta,
        reason: body.reason.trim(),
        serialNumbers: body.serialNumbers ?? [],
        movementIds: result.movements.map((m: { id: string }) => m.id),
      },
    });

    return result;
  }

  async listAvailableSerials(
    organizationId: string,
    variantId: string,
    warehouseId: string,
    status: SerialStatus = SerialStatus.IN_STOCK,
  ): Promise<SerialUnitDto[]> {
    const rows = await this.prisma.serialUnit.findMany({
      where: { organizationId, variantId, warehouseId, status },
      orderBy: { serialNumber: "asc" },
    });
    return rows.map(mapSerial);
  }

  async getBalance(
    variantId: string,
    warehouseId: string,
  ): Promise<StockBalanceDto | null> {
    const row = await this.prisma.stockBalance.findUnique({
      where: {
        warehouseId_variantId: { warehouseId, variantId },
      },
    });
    return row ? mapBalance(row) : null;
  }

  async listBalances(
    organizationId: string,
    warehouseId: string,
  ): Promise<StockBalanceDto[]> {
    const rows = await this.prisma.stockBalance.findMany({
      where: { organizationId, warehouseId },
      orderBy: { variantId: "asc" },
    });
    return rows.map(mapBalance);
  }

  /**
   * Owner inspector: product titles + all serials for a SKU in one warehouse.
   */
  async getVariantSerialPanel(
    user: RequestUser,
    variantId: string,
    warehouseId: string,
    includeRemoved = false,
  ): Promise<VariantSerialPanelDto> {
    assertOwner(user);

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, organizationId: user.organizationId },
    });
    if (!warehouse) {
      throw new NotFoundException("Warehouse not found");
    }

    const variant = await this.prisma.variant.findFirst({
      where: { id: variantId, organizationId: user.organizationId },
      include: {
        product: {
          include: { brand: true, category: true },
        },
      },
    });
    if (!variant) {
      throw new NotFoundException("Variant not found");
    }

    const [balance, serials] = await Promise.all([
      this.prisma.stockBalance.findUnique({
        where: {
          warehouseId_variantId: { warehouseId, variantId },
        },
      }),
      this.prisma.serialUnit.findMany({
        where: {
          organizationId: user.organizationId,
          variantId,
          warehouseId,
          ...(includeRemoved ? {} : { status: { not: SerialStatus.REMOVED } }),
        },
        orderBy: [{ serialNumber: "asc" }],
      }),
    ]);

    const emptyQty = "0.0000";
    return {
      variantId: variant.id,
      productId: variant.product.id,
      productName: variant.product.name,
      productDescription: variant.product.description,
      brandName: variant.product.brand?.name ?? null,
      categoryName: variant.product.category?.name ?? null,
      variantName: variant.name,
      sku: variant.sku,
      imageUrl: variant.imageUrl ?? variant.product.imageUrl,
      tracksSerial: variant.tracksSerial,
      sellPrice: toDecimalString(variant.sellPrice),
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      quantityOnHand: balance ? toDecimalString(balance.quantityOnHand) : emptyQty,
      quantityReserved: balance
        ? toDecimalString(balance.quantityReserved)
        : emptyQty,
      quantityAvailable: balance
        ? toDecimalString(availableQty(balance))
        : emptyQty,
      serials: serials.map(mapSerial),
    };
  }

  /** Owner IMEI correction — unique per org; audited. Does not change stock qty. */
  async updateSerialUnit(
    user: RequestUser,
    serialId: string,
    body: UpdateSerialUnitRequest,
  ): Promise<SerialUnitDto> {
    assertOwner(user);
    const reason = requireReason(body.reason);
    const serialNumber = normalizeSerialNumber(body.serialNumber);

    const existing = await this.prisma.serialUnit.findFirst({
      where: { id: serialId, organizationId: user.organizationId },
    });
    if (!existing) {
      throw new NotFoundException("Serial unit not found");
    }
    if (existing.status === SerialStatus.REMOVED) {
      throw new UnprocessableEntityException({
        code: "SERIAL_REMOVED",
        message: "Cannot edit a removed serial unit",
      });
    }

    if (existing.serialNumber === serialNumber) {
      return mapSerial(existing);
    }

    const clash = await this.prisma.serialUnit.findFirst({
      where: liveSerialNumberWhere(
        user.organizationId,
        serialNumber,
        serialId,
      ),
    });
    if (clash) {
      throw new ConflictException(
        `Serial number already exists: ${serialNumber}`,
      );
    }

    let updated: SerialUnit;
    try {
      updated = await this.prisma.serialUnit.update({
        where: { id: existing.id },
        data: { serialNumber },
      });
    } catch (err) {
      rethrowLiveSerialConflict(err, serialNumber);
    }

    await this.audit.log({
      action: "stock.serial_fix",
      entityType: "SerialUnit",
      entityId: updated.id,
      userId: user.userId,
      orgId: user.organizationId,
      before: {
        serialNumber: existing.serialNumber,
        status: existing.status,
      },
      meta: {
        serialNumber: updated.serialNumber,
        status: updated.status,
        variantId: updated.variantId,
        warehouseId: updated.warehouseId,
        reason,
      },
    });

    return mapSerial(updated);
  }

  /**
   * Owner remove: IN_STOCK units write down via ADJUSTMENT −1 then status REMOVED.
   * Ledger rows are never deleted. Sold/reserved units cannot be removed.
   */
  async removeSerialUnit(
    user: RequestUser,
    serialId: string,
    body: RemoveSerialUnitRequest,
  ): Promise<RemoveSerialUnitResult> {
    assertOwner(user);
    const reason = requireReason(body.reason);

    const result = await this.prisma.$transaction(async (tx) => {
      const serial = await tx.serialUnit.findFirst({
        where: { id: serialId, organizationId: user.organizationId },
      });
      if (!serial) {
        throw new NotFoundException("Serial unit not found");
      }
      if (serial.status === SerialStatus.REMOVED) {
        throw new UnprocessableEntityException({
          code: "SERIAL_REMOVED",
          message: "Serial unit is already removed",
        });
      }
      if (
        serial.status === SerialStatus.SOLD ||
        serial.status === SerialStatus.RESERVED ||
        serial.status === SerialStatus.TRANSFERRED
      ) {
        throw new UnprocessableEntityException({
          code: "SERIAL_NOT_REMOVABLE",
          message: `Serial ${serial.serialNumber} is ${serial.status} and cannot be removed`,
        });
      }

      let movement: StockMovement | null = null;
      let balance: StockBalance | null = null;

      if (serial.status === SerialStatus.IN_STOCK) {
        const locked = await this.lockBalance(
          tx,
          user.organizationId,
          serial.warehouseId,
          serial.variantId,
        );
        const available = availableQty(locked);
        if (available.lt(1)) {
          throw new UnprocessableEntityException({
            code: "INSUFFICIENT_STOCK",
            message: `Insufficient stock to remove serial ${serial.serialNumber}`,
            available: toDecimalString(available),
            requested: "1.0000",
          });
        }

        movement = await tx.stockMovement.create({
          data: {
            organizationId: user.organizationId,
            warehouseId: serial.warehouseId,
            variantId: serial.variantId,
            movementType: StockMovementType.ADJUSTMENT,
            quantityDelta: new Prisma.Decimal(-1),
            referenceType: "SerialUnit",
            referenceId: serial.id,
            serialUnitId: serial.id,
            createdByUserId: user.userId,
            reason,
          },
        });

        balance = await tx.stockBalance.update({
          where: { id: locked.id },
          data: {
            quantityOnHand: { decrement: new Prisma.Decimal(1) },
          },
        });
      } else if (!REMOVABLE_OFF_HAND.has(serial.status)) {
        throw new UnprocessableEntityException({
          code: "SERIAL_NOT_REMOVABLE",
          message: `Serial ${serial.serialNumber} is ${serial.status} and cannot be removed`,
        });
      } else {
        balance = await tx.stockBalance.findUnique({
          where: {
            warehouseId_variantId: {
              warehouseId: serial.warehouseId,
              variantId: serial.variantId,
            },
          },
        });
      }

      const updated = await tx.serialUnit.update({
        where: { id: serial.id },
        data: { status: SerialStatus.REMOVED },
      });

      return {
        previousStatus: serial.status,
        serial: updated,
        movement,
        balance,
      };
    });

    await this.audit.log({
      action: "stock.serial_remove",
      entityType: "SerialUnit",
      entityId: result.serial.id,
      userId: user.userId,
      orgId: user.organizationId,
      before: { status: result.previousStatus },
      meta: {
        serialNumber: result.serial.serialNumber,
        status: result.serial.status,
        variantId: result.serial.variantId,
        warehouseId: result.serial.warehouseId,
        reason,
        movementId: result.movement?.id ?? null,
      },
    });

    return {
      serial: mapSerial(result.serial),
      movement: result.movement ? mapMovement(result.movement) : null,
      balance: result.balance ? mapBalance(result.balance) : null,
    };
  }

  private resolveReturnSerialStatus(
    restock: boolean,
    disposition: string,
  ): SerialStatus {
    if (restock) return SerialStatus.IN_STOCK;
    if (disposition === "DAMAGE") return SerialStatus.DAMAGED;
    if (disposition === "SUPPLIER_RETURN") return SerialStatus.SUPPLIER_RETURN;
    return SerialStatus.RETURNED;
  }

  private async lockBalance(
    tx: InventoryTx,
    organizationId: string,
    warehouseId: string,
    variantId: string,
  ): Promise<StockBalance> {
    const existing = await tx.stockBalance.findUnique({
      where: {
        warehouseId_variantId: { warehouseId, variantId },
      },
    });
    if (!existing) {
      throw new UnprocessableEntityException({
        code: "INSUFFICIENT_STOCK",
        message: `No stock balance for variant ${variantId}`,
        available: "0.0000",
        requested: undefined,
      });
    }
    if (existing.organizationId !== organizationId) {
      throw new BadRequestException("Stock balance organization mismatch");
    }
    // Row lock for concurrent checkout safety (PostgreSQL), then re-read via Prisma.
    await tx.$executeRaw`
      SELECT 1 FROM stock_balances WHERE id = ${existing.id}::uuid FOR UPDATE
    `;
    const locked = await tx.stockBalance.findUnique({
      where: { id: existing.id },
    });
    if (!locked) {
      throw new NotFoundException("Stock balance disappeared during lock");
    }
    return locked;
  }

  private async ensureBalance(
    tx: InventoryTx,
    organizationId: string,
    warehouseId: string,
    variantId: string,
  ): Promise<StockBalance> {
    const existing = await tx.stockBalance.findUnique({
      where: {
        warehouseId_variantId: { warehouseId, variantId },
      },
    });
    if (existing) return existing;
    return tx.stockBalance.create({
      data: {
        organizationId,
        warehouseId,
        variantId,
        quantityOnHand: new Prisma.Decimal(0),
        quantityReserved: new Prisma.Decimal(0),
      },
    });
  }

  private async markSerialSold(
    tx: InventoryTx,
    args: {
      serialUnitId: string;
      organizationId: string;
      warehouseId: string;
      variantId: string;
      saleItemId: string;
    },
  ): Promise<void> {
    const serial = await tx.serialUnit.findUnique({
      where: { id: args.serialUnitId },
    });
    if (!serial) {
      throw new NotFoundException(`Serial unit ${args.serialUnitId} not found`);
    }
    if (serial.organizationId !== args.organizationId) {
      throw new BadRequestException("Serial organization mismatch");
    }
    if (serial.variantId !== args.variantId) {
      throw new BadRequestException("Serial variant mismatch");
    }
    if (serial.warehouseId !== args.warehouseId) {
      throw new BadRequestException("Serial warehouse mismatch");
    }
    if (serial.status !== SerialStatus.IN_STOCK) {
      throw new UnprocessableEntityException({
        code: "SERIAL_NOT_IN_STOCK",
        message: `Serial ${serial.serialNumber} is ${serial.status}, expected IN_STOCK`,
      });
    }

    await tx.serialUnit.update({
      where: { id: serial.id },
      data: {
        status: SerialStatus.SOLD,
        currentSaleItemId: args.saleItemId,
      },
    });
  }

  private async markSerialReturned(
    tx: InventoryTx,
    args: {
      serialUnitId: string;
      organizationId: string;
      warehouseId: string;
      variantId: string;
      nextStatus: SerialStatus;
      clearSaleLink: boolean;
    },
  ): Promise<void> {
    const serial = await tx.serialUnit.findUnique({
      where: { id: args.serialUnitId },
    });
    if (!serial) {
      throw new NotFoundException(`Serial unit ${args.serialUnitId} not found`);
    }
    if (serial.organizationId !== args.organizationId) {
      throw new BadRequestException("Serial organization mismatch");
    }
    if (serial.variantId !== args.variantId) {
      throw new BadRequestException("Serial variant mismatch");
    }
    if (serial.status !== SerialStatus.SOLD && serial.status !== SerialStatus.RETURNED) {
      throw new UnprocessableEntityException({
        code: "SERIAL_NOT_RETURNABLE",
        message: `Serial ${serial.serialNumber} is ${serial.status}, expected SOLD`,
      });
    }

    await tx.serialUnit.update({
      where: { id: serial.id },
      data: {
        status: args.nextStatus,
        warehouseId: args.warehouseId,
        ...(args.clearSaleLink ? { currentSaleItemId: null } : {}),
      },
    });
  }
}
