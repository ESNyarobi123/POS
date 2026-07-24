import { UnprocessableEntityException } from "@nestjs/common";
import { Prisma, SerialStatus, StockMovementType } from "@gulio/database";
import { InventoryService } from "./inventory.service";

type MockBalance = {
  id: string;
  organizationId: string;
  warehouseId: string;
  variantId: string;
  quantityOnHand: Prisma.Decimal;
  quantityReserved: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
};

function createTxMock(initial: MockBalance) {
  let balance = { ...initial };
  const movements: Array<Record<string, unknown>> = [];

  const tx = {
    stockBalance: {
      findUnique: jest.fn(async ({ where }: { where: { id?: string; warehouseId_variantId?: { warehouseId: string; variantId: string } } }) => {
        if (where.id && where.id === balance.id) return { ...balance };
        if (
          where.warehouseId_variantId &&
          where.warehouseId_variantId.warehouseId === balance.warehouseId &&
          where.warehouseId_variantId.variantId === balance.variantId
        ) {
          return { ...balance };
        }
        return null;
      }),
      update: jest.fn(async ({ data }: { data: { quantityOnHand: { decrement?: Prisma.Decimal; increment?: Prisma.Decimal } } }) => {
        if (data.quantityOnHand?.decrement) {
          balance = {
            ...balance,
            quantityOnHand: balance.quantityOnHand.minus(data.quantityOnHand.decrement),
            updatedAt: new Date(),
          };
        }
        if (data.quantityOnHand?.increment) {
          balance = {
            ...balance,
            quantityOnHand: balance.quantityOnHand.plus(data.quantityOnHand.increment),
            updatedAt: new Date(),
          };
        }
        return { ...balance };
      }),
      create: jest.fn(),
    },
    stockMovement: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `mov-${movements.length + 1}`,
          createdAt: new Date(),
          serialUnitId: null,
          createdByUserId: null,
          reason: null,
          ...data,
        };
        movements.push(row);
        return row;
      }),
    },
    serialUnit: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $executeRaw: jest.fn(async () => 1),
  };

  return { tx, getBalance: () => balance, movements };
}

describe("InventoryService.commitSaleMovement", () => {
  const orgId = "11111111-1111-1111-1111-111111111111";
  const branchId = "22222222-2222-2222-2222-222222222222";
  const warehouseId = "33333333-3333-3333-3333-333333333333";
  const variantId = "44444444-4444-4444-4444-444444444444";
  const saleId = "55555555-5555-5555-5555-555555555555";
  const saleItemId = "66666666-6666-6666-6666-666666666666";

  const baseBalance: MockBalance = {
    id: "bal-1",
    organizationId: orgId,
    warehouseId,
    variantId,
    quantityOnHand: new Prisma.Decimal(10),
    quantityReserved: new Prisma.Decimal(0),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("creates SALE movement and decrements on-hand (happy path)", async () => {
    const { tx, getBalance, movements } = createTxMock(baseBalance);
    const service = new InventoryService({} as never);

    const result = await service.commitSaleMovement(tx as never, {
      organizationId: orgId,
      branchId,
      warehouseId,
      variantId,
      quantity: 3,
      saleId,
      saleItemId,
    });

    expect(result.movements).toHaveLength(1);
    expect(result.movements[0].movementType).toBe(StockMovementType.SALE);
    expect(result.movements[0].quantityDelta).toBe("-3.0000");
    expect(result.balance.quantityOnHand).toBe("7.0000");
    expect(result.balance.quantityAvailable).toBe("7.0000");
    expect(getBalance().quantityOnHand.equals(7)).toBe(true);
    expect(movements[0].movementType).toBe(StockMovementType.SALE);
    expect(tx.$executeRaw).toHaveBeenCalled();
  });

  it("throws INSUFFICIENT_STOCK when available < requested", async () => {
    const low = {
      ...baseBalance,
      quantityOnHand: new Prisma.Decimal(2),
      quantityReserved: new Prisma.Decimal(1),
    };
    const { tx } = createTxMock(low);
    const service = new InventoryService({} as never);

    await expect(
      service.commitSaleMovement(tx as never, {
        organizationId: orgId,
        branchId,
        warehouseId,
        variantId,
        quantity: 2,
        saleId,
        saleItemId,
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    try {
      await service.commitSaleMovement(tx as never, {
        organizationId: orgId,
        branchId,
        warehouseId,
        variantId,
        quantity: 2,
        saleId,
        saleItemId,
      });
    } catch (err) {
      const response = (err as UnprocessableEntityException).getResponse() as {
        code: string;
        available: string;
      };
      expect(response.code).toBe("INSUFFICIENT_STOCK");
      expect(response.available).toBe("1.0000");
    }
  });

  it("rejects serial that is not IN_STOCK", async () => {
    const { tx } = createTxMock(baseBalance);
    tx.serialUnit.findUnique = jest.fn(async () => ({
      id: "serial-1",
      organizationId: orgId,
      warehouseId,
      variantId,
      serialNumber: "IMEI-1",
      status: SerialStatus.SOLD,
      currentSaleItemId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const service = new InventoryService({} as never);

    await expect(
      service.commitSaleMovement(tx as never, {
        organizationId: orgId,
        branchId,
        warehouseId,
        variantId,
        quantity: 1,
        saleId,
        saleItemId,
        serialUnitIds: ["serial-1"],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
