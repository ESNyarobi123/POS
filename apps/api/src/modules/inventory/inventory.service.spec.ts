import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Prisma, SerialStatus, StockMovementType } from "@gulio/database";
import { InventoryService } from "./inventory.service";
import type { RequestUser } from "../auth/types/request-user";

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

function createTxMock(
  initial: MockBalance | null,
  options?: {
    tracksSerial?: boolean;
    variantId?: string;
    organizationId?: string;
  },
) {
  let balance = initial ? { ...initial } : null;
  const movements: Array<Record<string, unknown>> = [];
  const serials: Array<Record<string, unknown>> = [];
  const variantId =
    options?.variantId ??
    initial?.variantId ??
    "44444444-4444-4444-4444-444444444444";
  const organizationId =
    options?.organizationId ??
    initial?.organizationId ??
    "11111111-1111-1111-1111-111111111111";

  const tx = {
    variant: {
      findFirst: jest.fn(async () => ({
        id: variantId,
        organizationId,
        tracksSerial: options?.tracksSerial ?? false,
      })),
    },
    stockBalance: {
      findUnique: jest.fn(
        async ({
          where,
        }: {
          where: {
            id?: string;
            warehouseId_variantId?: { warehouseId: string; variantId: string };
          };
        }) => {
          if (!balance) return null;
          if (where.id && where.id === balance.id) return { ...balance };
          if (
            where.warehouseId_variantId &&
            where.warehouseId_variantId.warehouseId === balance.warehouseId &&
            where.warehouseId_variantId.variantId === balance.variantId
          ) {
            return { ...balance };
          }
          return null;
        },
      ),
      update: jest.fn(
        async ({
          data,
        }: {
          data: {
            quantityOnHand: {
              decrement?: Prisma.Decimal;
              increment?: Prisma.Decimal;
            };
          };
        }) => {
          if (!balance) throw new Error("no balance");
          if (data.quantityOnHand?.decrement) {
            balance = {
              ...balance,
              quantityOnHand: balance.quantityOnHand.minus(
                data.quantityOnHand.decrement,
              ),
              updatedAt: new Date(),
            };
          }
          if (data.quantityOnHand?.increment) {
            balance = {
              ...balance,
              quantityOnHand: balance.quantityOnHand.plus(
                data.quantityOnHand.increment,
              ),
              updatedAt: new Date(),
            };
          }
          return { ...balance };
        },
      ),
      create: jest.fn(
        async ({
          data,
        }: {
          data: {
            organizationId: string;
            warehouseId: string;
            variantId: string;
            quantityOnHand: Prisma.Decimal;
            quantityReserved: Prisma.Decimal;
          };
        }) => {
          balance = {
            id: "bal-created",
            organizationId: data.organizationId,
            warehouseId: data.warehouseId,
            variantId: data.variantId,
            quantityOnHand: data.quantityOnHand,
            quantityReserved: data.quantityReserved,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          return { ...balance };
        },
      ),
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
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `serial-${serials.length + 1}`,
          currentSaleItemId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        serials.push(row);
        return row;
      }),
    },
    $executeRaw: jest.fn(async () => 1),
  };

  return {
    tx,
    getBalance: () => balance,
    movements,
    serials,
  };
}

function createService() {
  return new InventoryService({} as never, { log: jest.fn() } as never);
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
    const service = createService();

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
    expect(getBalance()!.quantityOnHand.equals(7)).toBe(true);
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
    const service = createService();

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

    const service = createService();

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

describe("InventoryService.commitAdjustment", () => {
  const orgId = "11111111-1111-1111-1111-111111111111";
  const warehouseId = "33333333-3333-3333-3333-333333333333";
  const variantId = "44444444-4444-4444-4444-444444444444";

  const baseBalance: MockBalance = {
    id: "bal-1",
    organizationId: orgId,
    warehouseId,
    variantId,
    quantityOnHand: new Prisma.Decimal(5),
    quantityReserved: new Prisma.Decimal(0),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("creates ADJUSTMENT and increments on-hand for non-serial intake", async () => {
    const { tx, getBalance, movements } = createTxMock(baseBalance, {
      tracksSerial: false,
    });
    const service = createService();

    const result = await service.commitAdjustment(tx as never, {
      organizationId: orgId,
      warehouseId,
      variantId,
      quantityDelta: 4,
      reason: "Opening stock",
    });

    expect(result.movements).toHaveLength(1);
    expect(result.movements[0].movementType).toBe(StockMovementType.ADJUSTMENT);
    expect(result.movements[0].quantityDelta).toBe("4.0000");
    expect(result.movements[0].reason).toBe("Opening stock");
    expect(result.balance.quantityOnHand).toBe("9.0000");
    expect(result.serials).toHaveLength(0);
    expect(getBalance()!.quantityOnHand.equals(9)).toBe(true);
    expect(movements[0].movementType).toBe(StockMovementType.ADJUSTMENT);
  });

  it("throws INSUFFICIENT_STOCK on negative adjustment when available < |delta|", async () => {
    const { tx } = createTxMock(baseBalance, { tracksSerial: false });
    const service = createService();

    await expect(
      service.commitAdjustment(tx as never, {
        organizationId: orgId,
        warehouseId,
        variantId,
        quantityDelta: -6,
        reason: "Write-down",
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    try {
      await service.commitAdjustment(tx as never, {
        organizationId: orgId,
        warehouseId,
        variantId,
        quantityDelta: -6,
        reason: "Write-down",
      });
    } catch (err) {
      const response = (err as UnprocessableEntityException).getResponse() as {
        code: string;
        available: string;
      };
      expect(response.code).toBe("INSUFFICIENT_STOCK");
      expect(response.available).toBe("5.0000");
    }
  });

  it("creates serial units and one ADJUSTMENT movement per serial on intake", async () => {
    const { tx, getBalance, movements, serials } = createTxMock(null, {
      tracksSerial: true,
      variantId,
      organizationId: orgId,
    });

    const service = createService();

    const result = await service.commitAdjustment(tx as never, {
      organizationId: orgId,
      warehouseId,
      variantId,
      quantityDelta: 2,
      reason: "IMEI intake",
      serialNumbers: ["IMEI-1001", "IMEI-1002"],
    });

    expect(result.serials).toHaveLength(2);
    expect(result.serials[0].serialNumber).toBe("IMEI-1001");
    expect(result.serials[0].status).toBe(SerialStatus.IN_STOCK);
    expect(result.movements).toHaveLength(2);
    expect(result.movements.every((m: { movementType: string }) => m.movementType === "ADJUSTMENT")).toBe(
      true,
    );
    expect(result.movements.every((m: { quantityDelta: string }) => m.quantityDelta === "1.0000")).toBe(
      true,
    );
    expect(result.balance.quantityOnHand).toBe("2.0000");
    expect(getBalance()!.quantityOnHand.equals(2)).toBe(true);
    expect(serials).toHaveLength(2);
    expect(movements).toHaveLength(2);
    expect(tx.stockBalance.create).toHaveBeenCalled();
  });
});

const orgId = "11111111-1111-1111-1111-111111111111";
const warehouseId = "33333333-3333-3333-3333-333333333333";
const variantId = "44444444-4444-4444-4444-444444444444";
const serialId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const ownerUser: RequestUser = {
  userId: "user-owner",
  organizationId: orgId,
  email: "owner@guliosmart.local",
  roles: ["OWNER"],
  permissions: ["stock.serial_fix"],
  branchIds: [],
};

const managerUser: RequestUser = {
  ...ownerUser,
  userId: "user-manager",
  email: "manager@guliosmart.local",
  roles: ["MANAGER"],
};

function serialRow(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-09-19T12:00:00.000Z");
  return {
    id: serialId,
    organizationId: orgId,
    variantId,
    warehouseId,
    serialNumber: "860000000000001",
    status: SerialStatus.IN_STOCK,
    currentSaleItemId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("InventoryService owner serial panel", () => {
  it("rejects non-owner", async () => {
    const service = new InventoryService(
      {} as never,
      { log: jest.fn() } as never,
    );
    await expect(
      service.getVariantSerialPanel(managerUser, variantId, warehouseId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("returns product titles and serials for the warehouse", async () => {
    const serial = serialRow();
    const prisma = {
      warehouse: {
        findFirst: jest.fn(async () => ({
          id: warehouseId,
          name: "Main Store",
          organizationId: orgId,
        })),
      },
      variant: {
        findFirst: jest.fn(async () => ({
          id: variantId,
          sku: "GUL-A07-128",
          name: "128GB Black",
          tracksSerial: true,
          sellPrice: new Prisma.Decimal("1850000"),
          imageUrl: null,
          product: {
            id: "prod-1",
            name: "iPhone 15",
            description: "Demo phone",
            imageUrl: "https://img.example/p.png",
            brand: { name: "Apple" },
            category: { name: "Phones" },
          },
        })),
      },
      stockBalance: {
        findUnique: jest.fn(async () => ({
          id: "bal-1",
          organizationId: orgId,
          warehouseId,
          variantId,
          quantityOnHand: new Prisma.Decimal(2),
          quantityReserved: new Prisma.Decimal(0),
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
      serialUnit: {
        findMany: jest.fn(async () => [serial]),
      },
    };
    const service = new InventoryService(
      prisma as never,
      { log: jest.fn() } as never,
    );

    const panel = await service.getVariantSerialPanel(
      ownerUser,
      variantId,
      warehouseId,
    );

    expect(panel.productName).toBe("iPhone 15");
    expect(panel.sku).toBe("GUL-A07-128");
    expect(panel.tracksSerial).toBe(true);
    expect(panel.quantityOnHand).toBe("2.0000");
    expect(panel.serials).toHaveLength(1);
    expect(panel.serials[0].serialNumber).toBe("860000000000001");
    expect(prisma.serialUnit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: SerialStatus.REMOVED },
        }),
      }),
    );
  });
});

describe("InventoryService.updateSerialUnit", () => {
  it("rejects non-owner", async () => {
    const service = new InventoryService(
      {} as never,
      { log: jest.fn() } as never,
    );
    await expect(
      service.updateSerialUnit(managerUser, serialId, {
        serialNumber: "860000000000099",
        reason: "typo",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("updates IMEI and writes audit", async () => {
    const existing = serialRow();
    const updated = serialRow({ serialNumber: "860000000000099" });
    const prisma = {
      serialUnit: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(existing)
          .mockResolvedValueOnce(null),
        update: jest.fn(async () => updated),
      },
    };
    const audit = { log: jest.fn() };
    const service = new InventoryService(prisma as never, audit as never);

    const result = await service.updateSerialUnit(ownerUser, serialId, {
      serialNumber: "860000000000099",
      reason: "Corrected IMEI typo",
    });

    expect(result.serialNumber).toBe("860000000000099");
    expect(prisma.serialUnit.update).toHaveBeenCalledWith({
      where: { id: serialId },
      data: { serialNumber: "860000000000099" },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "stock.serial_fix",
        entityId: serialId,
        before: expect.objectContaining({ serialNumber: "860000000000001" }),
      }),
    );
  });

  it("rejects duplicate serial numbers", async () => {
    const existing = serialRow();
    const prisma = {
      serialUnit: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(existing)
          .mockResolvedValueOnce(serialRow({ id: "other" })),
        update: jest.fn(),
      },
    };
    const service = new InventoryService(
      prisma as never,
      { log: jest.fn() } as never,
    );

    await expect(
      service.updateSerialUnit(ownerUser, serialId, {
        serialNumber: "860000000000002",
        reason: "reassign",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.serialUnit.update).not.toHaveBeenCalled();
  });
});

describe("InventoryService.removeSerialUnit", () => {
  const baseBalance: MockBalance = {
    id: "bal-1",
    organizationId: orgId,
    warehouseId,
    variantId,
    quantityOnHand: new Prisma.Decimal(3),
    quantityReserved: new Prisma.Decimal(0),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("rejects sold serials", async () => {
    const { tx } = createTxMock(baseBalance);
    tx.serialUnit.findFirst = jest.fn(async () =>
      serialRow({ status: SerialStatus.SOLD }),
    );
    const prisma = {
      $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const service = new InventoryService(
      prisma as never,
      { log: jest.fn() } as never,
    );

    await expect(
      service.removeSerialUnit(ownerUser, serialId, {
        reason: "Wrong IMEI entered",
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("writes ADJUSTMENT -1 and marks IN_STOCK serial REMOVED", async () => {
    const { tx, getBalance, movements } = createTxMock(baseBalance);
    const existing = serialRow();
    tx.serialUnit.findFirst = jest.fn(async () => existing);
    tx.serialUnit.update = jest.fn(async () =>
      serialRow({ status: SerialStatus.REMOVED }),
    );
    const audit = { log: jest.fn() };
    const prisma = {
      $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const service = new InventoryService(prisma as never, audit as never);

    const result = await service.removeSerialUnit(ownerUser, serialId, {
      reason: "Wrong IMEI entered",
    });

    expect(result.serial.status).toBe(SerialStatus.REMOVED);
    expect(result.movement?.movementType).toBe(StockMovementType.ADJUSTMENT);
    expect(result.movement?.quantityDelta).toBe("-1.0000");
    expect(result.balance?.quantityOnHand).toBe("2.0000");
    expect(getBalance()!.quantityOnHand.equals(2)).toBe(true);
    expect(movements).toHaveLength(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "stock.serial_remove" }),
    );
  });

  it("returns not found when serial is missing", async () => {
    const { tx } = createTxMock(baseBalance);
    tx.serialUnit.findFirst = jest.fn(async () => null);
    const prisma = {
      $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const service = new InventoryService(
      prisma as never,
      { log: jest.fn() } as never,
    );

    await expect(
      service.removeSerialUnit(ownerUser, serialId, {
        reason: "cleanup unit",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
