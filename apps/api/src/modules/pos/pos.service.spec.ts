import {
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  FiscalDocumentStatus,
  FiscalStatus,
  PaymentMethod,
  Prisma,
  RegisterSessionStatus,
  SaleStatus,
} from "@gulio/database";
import { PermissionCode } from "@gulio/contracts";
import type { RequestUser } from "../auth/types/request-user";
import { InventoryService } from "../inventory/inventory.service";
import { PosService } from "./pos.service";
const ORG = "11111111-1111-1111-1111-111111111111";
const BRANCH = "22222222-2222-2222-2222-222222222222";
const WAREHOUSE = "33333333-3333-3333-3333-333333333333";
const REGISTER = "44444444-4444-4444-4444-444444444444";
const SESSION = "55555555-5555-5555-5555-555555555555";
const USER = "66666666-6666-6666-6666-666666666666";
const CABLE_VARIANT = "77777777-7777-7777-7777-777777777777";
const PHONE_VARIANT = "88888888-8888-8888-8888-888888888888";
const SERIAL_ID = "99999999-9999-9999-9999-999999999999";

function cashierUser(extraPerms: string[] = []): RequestUser {
  return {
    userId: USER,
    organizationId: ORG,
    email: "cashier@guliosmart.local",
    roles: ["CASHIER"],
    permissions: [
      PermissionCode.SHIFT_OPEN_OWN,
      PermissionCode.POS_SELL,
      PermissionCode.POS_DISCOUNT,
      PermissionCode.POS_PRICE_OVERRIDE,
      ...extraPerms,
    ],
    branchIds: [BRANCH],
  };
}

describe("PosService.checkout", () => {
  let prisma: {
    sale: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      create: jest.Mock;
      count: jest.Mock;
    };
    registerSession: { findFirst: jest.Mock };
    warehouse: { findFirst: jest.Mock };
    customer: { findFirst: jest.Mock };
    variant: { findMany: jest.Mock };
    saleItem: { create: jest.Mock };
    saleItemSerial: { createMany: jest.Mock };
    payment: { create: jest.Mock };
    fiscalDocument: { create: jest.Mock };
    outboxEvent: { create: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let inventoryService: { commitSaleMovement: jest.Mock };
  let service: PosService;
  let saleStore: Map<string, Record<string, unknown>>;

  beforeEach(() => {
    saleStore = new Map();
    let saleItemSeq = 0;

    const openSession = {
      id: SESSION,
      organizationId: ORG,
      registerId: REGISTER,
      branchId: BRANCH,
      openedByUserId: USER,
      status: RegisterSessionStatus.OPEN,
      openingFloat: new Prisma.Decimal(50000),
    };

    const tx = {
      registerSession: {
        findFirst: jest.fn(async () => openSession),
      },
      warehouse: {
        findFirst: jest.fn(async () => ({
          id: WAREHOUSE,
          organizationId: ORG,
          branchId: BRANCH,
        })),
      },
      customer: { findFirst: jest.fn() },
      variant: {
        findMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) => {
          const all = [
            {
              id: CABLE_VARIANT,
              organizationId: ORG,
              sku: "USB-C-CABLE",
              name: "USB-C Cable",
              sellPrice: new Prisma.Decimal("15000.0000"),
              tracksSerial: false,
              isActive: true,
            },
            {
              id: PHONE_VARIANT,
              organizationId: ORG,
              sku: "A07-128-BLK",
              name: "128GB Black",
              sellPrice: new Prisma.Decimal("360000.0000"),
              tracksSerial: true,
              isActive: true,
            },
          ];
          return all.filter((v) => where.id.in.includes(v.id));
        }),
      },
      sale: {
        count: jest.fn(async () => saleStore.size),
        findUnique: jest.fn(
          async ({
            where,
          }: {
            where: {
              organizationId_receiptNumber?: {
                organizationId: string;
                receiptNumber: string;
              };
              organizationId_idempotencyKey?: {
                organizationId: string;
                idempotencyKey: string;
              };
            };
          }) => {
            if (where.organizationId_idempotencyKey) {
              const key = where.organizationId_idempotencyKey.idempotencyKey;
              for (const s of saleStore.values()) {
                if (s.idempotencyKey === key) return s;
              }
              return null;
            }
            return null;
          },
        ),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const id = `sale-${saleStore.size + 1}`;
          const row = {
            id,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            items: [] as unknown[],
            payments: [] as unknown[],
            fiscalDocument: null as unknown,
          };
          saleStore.set(id, row);
          return row;
        }),
        findUniqueOrThrow: jest.fn(async ({ where }: { where: { id: string } }) => {
          const row = saleStore.get(where.id);
          if (!row) throw new Error("missing sale");
          return row;
        }),
      },
      saleItem: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          saleItemSeq += 1;
          const item = {
            id: `item-${saleItemSeq}`,
            ...data,
            serials: [] as unknown[],
            variant: {
              sku: data.variantId === PHONE_VARIANT ? "A07-128-BLK" : "USB-C-CABLE",
              name: data.variantId === PHONE_VARIANT ? "128GB Black" : "USB-C Cable",
            },
          };
          const sale = saleStore.get(data.saleId as string);
          if (sale) {
            (sale.items as unknown[]).push(item);
          }
          return item;
        }),
      },
      saleItemSerial: {
        createMany: jest.fn(async ({ data }: { data: Array<{ saleItemId: string; serialUnitId: string }> }) => {
          for (const row of data) {
            for (const sale of saleStore.values()) {
              const items = sale.items as Array<Record<string, unknown>>;
              const item = items.find((i) => i.id === row.saleItemId);
              if (item) {
                (item.serials as unknown[]).push({
                  saleItemId: row.saleItemId,
                  serialUnitId: row.serialUnitId,
                  serialUnit: { serialNumber: "860000000000001" },
                });
              }
            }
          }
          return { count: data.length };
        }),
      },
      payment: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const pay = {
            id: `pay-${Date.now()}-${Math.random()}`,
            ...data,
            paidAt: new Date(),
            createdAt: new Date(),
            provider: data.provider ?? null,
            reference: data.reference ?? null,
          };
          const sale = saleStore.get(data.saleId as string);
          if (sale) {
            (sale.payments as unknown[]).push(pay);
          }
          return pay;
        }),
      },
      fiscalDocument: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const doc = {
            id: "fiscal-1",
            ...data,
            status: data.status ?? FiscalDocumentStatus.PENDING,
            externalRef: null,
          };
          const sale = saleStore.get(data.saleId as string);
          if (sale) {
            sale.fiscalDocument = doc;
            sale.fiscalStatus = FiscalStatus.FISCAL_PENDING;
          }
          return doc;
        }),
      },
      outboxEvent: { create: jest.fn(async () => ({ id: "outbox-1" })) },
      auditLog: { create: jest.fn(async () => ({ id: "audit-1" })) },
    };

    prisma = {
      sale: {
        findUnique: jest.fn(async ({ where }: { where: { organizationId_idempotencyKey: { idempotencyKey: string } } }) => {
          const key = where.organizationId_idempotencyKey.idempotencyKey;
          for (const s of saleStore.values()) {
            if (s.idempotencyKey === key) return s;
          }
          return null;
        }),
        findUniqueOrThrow: tx.sale.findUniqueOrThrow,
        create: tx.sale.create,
        count: tx.sale.count,
      },
      registerSession: { findFirst: tx.registerSession.findFirst },
      warehouse: { findFirst: tx.warehouse.findFirst },
      customer: { findFirst: tx.customer.findFirst },
      variant: { findMany: tx.variant.findMany },
      saleItem: { create: tx.saleItem.create },
      saleItemSerial: { createMany: tx.saleItemSerial.createMany },
      payment: { create: tx.payment.create },
      fiscalDocument: { create: tx.fiscalDocument.create },
      outboxEvent: { create: tx.outboxEvent.create },
      auditLog: { create: tx.auditLog.create },
      $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    };

    inventoryService = {
      commitSaleMovement: jest.fn(async () => ({
        movements: [],
        balance: {
          id: "bal",
          organizationId: ORG,
          warehouseId: WAREHOUSE,
          variantId: CABLE_VARIANT,
          quantityOnHand: "19.0000",
          quantityReserved: "0.0000",
          quantityAvailable: "19.0000",
          updatedAt: new Date().toISOString(),
        },
      })),
    };

    service = new PosService(
      prisma as never,
      inventoryService as unknown as InventoryService,
    );
  });

  it("checks out accessory (no serial) and phone (with serial)", async () => {
    const result = await service.checkout(cashierUser(), "idem-mixed-1", {
      registerSessionId: SESSION,
      branchId: BRANCH,
      warehouseId: WAREHOUSE,
      items: [
        { variantId: CABLE_VARIANT, quantity: 2 },
        {
          variantId: PHONE_VARIANT,
          quantity: 1,
          serialUnitIds: [SERIAL_ID],
        },
      ],
      payments: [
        {
          method: PaymentMethod.CASH,
          amount: "390000.0000",
        },
      ],
    });

    expect(result.status).toBe(SaleStatus.COMPLETED);
    expect(result.receiptNumber).toMatch(/^RCP-/);
    expect(result.grandTotal).toBe("390000.0000");
    expect(result.items).toHaveLength(2);
    expect(result.payments).toHaveLength(1);
    expect(inventoryService.commitSaleMovement).toHaveBeenCalledTimes(2);

    const phoneCall = inventoryService.commitSaleMovement.mock.calls.find(
      (c) => c[1].variantId === PHONE_VARIANT,
    );
    expect(phoneCall?.[1].serialUnitIds).toEqual([SERIAL_ID]);

    const cableCall = inventoryService.commitSaleMovement.mock.calls.find(
      (c) => c[1].variantId === CABLE_VARIANT,
    );
    expect(cableCall?.[1].serialUnitIds).toBeUndefined();
  });

  it("rejects serial-tracked phone without serialUnitIds", async () => {
    await expect(
      service.checkout(cashierUser(), "idem-no-serial", {
        registerSessionId: SESSION,
        branchId: BRANCH,
        warehouseId: WAREHOUSE,
        items: [{ variantId: PHONE_VARIANT, quantity: 1 }],
        payments: [{ method: PaymentMethod.CASH, amount: "360000.0000" }],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    expect(inventoryService.commitSaleMovement).not.toHaveBeenCalled();
  });

  it("returns the same sale on idempotent second call", async () => {
    const first = await service.checkout(cashierUser(), "idem-same", {
      registerSessionId: SESSION,
      branchId: BRANCH,
      warehouseId: WAREHOUSE,
      items: [{ variantId: CABLE_VARIANT, quantity: 1 }],
      payments: [{ method: PaymentMethod.CASH, amount: "15000.0000" }],
    });

    const second = await service.checkout(cashierUser(), "idem-same", {
      registerSessionId: SESSION,
      branchId: BRANCH,
      warehouseId: WAREHOUSE,
      items: [{ variantId: CABLE_VARIANT, quantity: 1 }],
      payments: [{ method: PaymentMethod.CASH, amount: "15000.0000" }],
    });

    expect(second.id).toBe(first.id);
    expect(second.receiptNumber).toBe(first.receiptNumber);
    expect(inventoryService.commitSaleMovement).toHaveBeenCalledTimes(1);
  });
});

describe("PosService.openShift", () => {
  it("rejects when register already has an open session", async () => {
    const prisma = {
      register: {
        findFirst: jest.fn(async () => ({
          id: REGISTER,
          organizationId: ORG,
          branchId: BRANCH,
          isActive: true,
        })),
      },
      registerSession: {
        findFirst: jest.fn(async () => ({
          id: SESSION,
          status: RegisterSessionStatus.OPEN,
        })),
      },
      $transaction: jest.fn(),
    };
    const service = new PosService(
      prisma as never,
      { commitSaleMovement: jest.fn() } as never,
    );

    await expect(
      service.openShift(cashierUser(), {
        registerId: REGISTER,
        openingFloat: "10000.0000",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
