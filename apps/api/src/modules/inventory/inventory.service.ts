import {
  BadRequestException,
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
  CommitReturnMovementInput,
  CommitReturnMovementResult,
  CommitSaleMovementInput,
  CommitSaleMovementResult,
  DecimalString,
  SerialStatus as ContractSerialStatus,
  SerialUnitDto,
  StockBalanceDto,
  StockMovementDto,
  StockMovementType as ContractMovementType,
} from "@gulio/contracts";
import { PrismaService } from "../../prisma/prisma.service";

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

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

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

  async listAvailableSerials(
    variantId: string,
    warehouseId: string,
    status: SerialStatus = SerialStatus.IN_STOCK,
  ): Promise<SerialUnitDto[]> {
    const rows = await this.prisma.serialUnit.findMany({
      where: { variantId, warehouseId, status },
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

  async listBalances(warehouseId: string): Promise<StockBalanceDto[]> {
    const rows = await this.prisma.stockBalance.findMany({
      where: { warehouseId },
      orderBy: { variantId: "asc" },
    });
    return rows.map(mapBalance);
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
