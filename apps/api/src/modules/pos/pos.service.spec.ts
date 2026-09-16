import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { hashPassword } from "@gulio/auth";
import {
  FiscalDocumentStatus,
  FiscalStatus,
  PaymentMethod,
  Prisma,
  RegisterSessionStatus,
  ReturnDisposition,
  ReturnStatus,
  SaleStatus,
  SerialStatus,
} from "@gulio/database";
import { PermissionCode } from "@gulio/contracts";
import type { RequestUser } from "../auth/types/request-user";
import { InventoryService } from "../inventory/inventory.service";
import { PaymentsService } from "../payments/payments.service";
import { PosService } from "./pos.service";

const paymentsStub = {
  consumeCompletedIntent: jest.fn(),
  enqueueOpticEdgeCashIn: jest.fn().mockResolvedValue(undefined),
} as unknown as PaymentsService;
const ORG = "11111111-1111-1111-1111-111111111111";
const BRANCH = "22222222-2222-2222-2222-222222222222";
const WAREHOUSE = "33333333-3333-3333-3333-333333333333";
const REGISTER = "44444444-4444-4444-4444-444444444444";
const SESSION = "55555555-5555-5555-5555-555555555555";
const USER = "66666666-6666-6666-6666-666666666666";
const CABLE_VARIANT = "77777777-7777-7777-7777-777777777777";
const PHONE_VARIANT = "88888888-8888-8888-8888-888888888888";
const SERIAL_ID = "99999999-9999-9999-9999-999999999999";
const SALE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SALE_ITEM_CABLE = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const SALE_ITEM_PHONE = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const WRONG_SERIAL = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const MANAGER_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

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
    organization: { findUnique: jest.Mock };
    user: { findMany: jest.Mock };
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
              costPrice: new Prisma.Decimal("8000.0000"),
              tracksSerial: false,
              isActive: true,
            },
            {
              id: PHONE_VARIANT,
              organizationId: ORG,
              sku: "A07-128-BLK",
              name: "128GB Black",
              sellPrice: new Prisma.Decimal("360000.0000"),
              costPrice: new Prisma.Decimal("300000.0000"),
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
      organization: {
        findUnique: jest.fn(async () => ({ settings: {} })),
      },
      user: { findMany: jest.fn(async () => []) },
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
      paymentsStub,
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

  it("allows cashier 5% negotiated price without PIN", async () => {
    const result = await service.checkout(cashierUser(), "idem-nego-5", {
      registerSessionId: SESSION,
      branchId: BRANCH,
      warehouseId: WAREHOUSE,
      items: [
        {
          variantId: CABLE_VARIANT,
          quantity: 1,
          unitPrice: "14250.0000",
        },
      ],
      payments: [{ method: PaymentMethod.CASH, amount: "14250.0000" }],
    });

    expect(result.grandTotal).toBe("14250.0000");
    expect(result.items[0]?.negotiated).toBe(true);
    expect(result.items[0]?.listUnitPrice).toBe("15000.0000");
    expect(result.items[0]?.unitPrice).toBe("14250.0000");
  });

  it("requires manager PIN when cashier negotiates more than 5% below list", async () => {
    await expect(
      service.checkout(cashierUser(), "idem-nego-10", {
        registerSessionId: SESSION,
        branchId: BRANCH,
        warehouseId: WAREHOUSE,
        items: [
          { variantId: CABLE_VARIANT, quantity: 1, unitPrice: "9000.0000" },
        ],
        payments: [{ method: PaymentMethod.CASH, amount: "9000.0000" }],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(inventoryService.commitSaleMovement).not.toHaveBeenCalled();
  });

  it("rejects invalid manager PIN on deep negotiation", async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: MANAGER_ID, pinHash: await hashPassword("1234") },
    ]);

    await expect(
      service.checkout(cashierUser(), "idem-nego-bad-pin", {
        registerSessionId: SESSION,
        branchId: BRANCH,
        warehouseId: WAREHOUSE,
        managerPin: "0000",
        items: [
          { variantId: CABLE_VARIANT, quantity: 1, unitPrice: "9000.0000" },
        ],
        payments: [{ method: PaymentMethod.CASH, amount: "9000.0000" }],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("completes deep negotiation when manager PIN is valid", async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: MANAGER_ID, pinHash: await hashPassword("1234") },
    ]);

    const result = await service.checkout(cashierUser(), "idem-nego-pin", {
      registerSessionId: SESSION,
      branchId: BRANCH,
      warehouseId: WAREHOUSE,
      managerPin: "1234",
      items: [
        { variantId: CABLE_VARIANT, quantity: 1, unitPrice: "9000.0000" },
      ],
      payments: [{ method: PaymentMethod.CASH, amount: "9000.0000" }],
    });

    expect(result.grandTotal).toBe("9000.0000");
    expect(result.items[0]?.negotiated).toBe(true);
    const audit = prisma.auditLog.create.mock.calls.at(-1)?.[0]?.data;
    expect(audit.afterJson.approvedByUserId).toBe(MANAGER_ID);
    expect(audit.afterJson.priceOverrides).toHaveLength(1);
  });

  it("lets a manager override without PIN", async () => {
    const manager = cashierUser();
    manager.roles = ["MANAGER"];

    const result = await service.checkout(manager, "idem-nego-mgr", {
      registerSessionId: SESSION,
      branchId: BRANCH,
      warehouseId: WAREHOUSE,
      items: [
        { variantId: CABLE_VARIANT, quantity: 1, unitPrice: "9000.0000" },
      ],
      payments: [{ method: PaymentMethod.CASH, amount: "9000.0000" }],
    });

    expect(result.items[0]?.unitPrice).toBe("9000.0000");
  });

  it("blocks selling above list when org policy disables it", async () => {
    prisma.organization.findUnique.mockResolvedValue({
      settings: { priceOverride: { allowAboveList: false } },
    });

    await expect(
      service.checkout(cashierUser(), "idem-above", {
        registerSessionId: SESSION,
        branchId: BRANCH,
        warehouseId: WAREHOUSE,
        items: [
          { variantId: CABLE_VARIANT, quantity: 1, unitPrice: "20000.0000" },
        ],
        payments: [{ method: PaymentMethod.CASH, amount: "20000.0000" }],
      }),
    ).rejects.toMatchObject({ message: expect.stringMatching(/above list/i) });
  });
});

describe("PosService.createReturn", () => {
  let prisma: {
    sale: { findFirst: jest.Mock };
    warehouse: { findFirst: jest.Mock };
    returnItem: { findMany: jest.Mock };
    return: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
    auditLog: { findFirst: jest.Mock; create: jest.Mock };
    user: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let inventoryService: { commitReturnMovement: jest.Mock };
  let service: PosService;
  let managerPinHash: string;

  beforeAll(async () => {
    managerPinHash = await hashPassword("1234");
  });

  const completedSale = {
    id: SALE_ID,
    organizationId: ORG,
    branchId: BRANCH,
    warehouseId: WAREHOUSE,
    receiptNumber: "RCP-00000001",
    status: SaleStatus.COMPLETED,
    grandTotal: new Prisma.Decimal("390000.0000"),
    items: [
      {
        id: SALE_ITEM_CABLE,
        variantId: CABLE_VARIANT,
        quantity: new Prisma.Decimal(2),
        unitPrice: new Prisma.Decimal("15000.0000"),
        lineTotal: new Prisma.Decimal("30000.0000"),
        tracksSerial: false,
        serials: [],
        returnItems: [],
        variant: {
          id: CABLE_VARIANT,
          sku: "USB-C-CABLE",
          name: "USB-C Cable",
          tracksSerial: false,
          product: { name: "USB-C Cable" },
        },
      },
      {
        id: SALE_ITEM_PHONE,
        variantId: PHONE_VARIANT,
        quantity: new Prisma.Decimal(1),
        unitPrice: new Prisma.Decimal("360000.0000"),
        lineTotal: new Prisma.Decimal("360000.0000"),
        tracksSerial: true,
        serials: [
          {
            saleItemId: SALE_ITEM_PHONE,
            serialUnitId: SERIAL_ID,
            serialUnit: {
              id: SERIAL_ID,
              serialNumber: "860000000000001",
              status: SerialStatus.SOLD,
            },
          },
        ],
        returnItems: [],
        variant: {
          id: PHONE_VARIANT,
          sku: "A07-128-BLK",
          name: "128GB Black",
          tracksSerial: true,
          product: { name: "Galaxy A07" },
        },
      },
    ],
  };

  beforeEach(() => {
    let returnSeq = 0;
    let returnItemSeq = 0;
    const createdReturnItems: Array<Record<string, unknown>> = [];
    let pendingReturn: Record<string, unknown> | null = null;

    const tx = {
      return: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          returnSeq += 1;
          createdReturnItems.length = 0;
          pendingReturn = {
            id: `return-${returnSeq}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            processedAt: null,
            items: [],
            sale: { receiptNumber: completedSale.receiptNumber },
          };
          return pendingReturn;
        }),
        update: jest.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Record<string, unknown>;
          }) => ({
            id: where.id,
            organizationId: ORG,
            saleId: SALE_ID,
            branchId: BRANCH,
            processedByUserId: USER,
            reasonCode: pendingReturn?.reasonCode ?? "DEFECTIVE",
            refundTotal: pendingReturn?.refundTotal ?? new Prisma.Decimal("15000.0000"),
            status: data.status ?? ReturnStatus.COMPLETED,
            processedAt: data.processedAt ?? new Date(),
            createdAt: pendingReturn?.createdAt ?? new Date(),
            items: createdReturnItems.map((item) => ({
              ...item,
              saleItem: {
                variantId:
                  item.saleItemId === SALE_ITEM_CABLE
                    ? CABLE_VARIANT
                    : PHONE_VARIANT,
              },
            })),
            sale: { receiptNumber: completedSale.receiptNumber },
          }),
        ),
      },
      returnItem: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          returnItemSeq += 1;
          const row = {
            id: `return-item-${returnItemSeq}`,
            ...data,
          };
          createdReturnItems.push(row);
          return row;
        }),
      },
      auditLog: {
        create: jest.fn(async () => ({ id: "audit-return" })),
      },
    };

    prisma = {
      sale: {
        findFirst: jest.fn(async () => completedSale),
      },
      warehouse: {
        findFirst: jest.fn(async () => ({
          id: WAREHOUSE,
          organizationId: ORG,
          branchId: BRANCH,
        })),
      },
      returnItem: {
        findMany: jest.fn(async () => []),
      },
      return: {
        findFirst: jest.fn(),
        create: tx.return.create,
        update: tx.return.update,
      },
      auditLog: {
        findFirst: jest.fn(async () => null),
        create: tx.auditLog.create,
      },
      user: {
        findMany: jest.fn(async () => [
          { id: MANAGER_ID, pinHash: managerPinHash },
        ]),
      },
      $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    };

    inventoryService = {
      commitReturnMovement: jest.fn(async () => ({
        movements: [],
        balance: null,
      })),
    };

    service = new PosService(
      prisma as never,
      inventoryService as unknown as InventoryService,
      paymentsStub,
    );
  });

  it("creates a completed return for a non-serial line", async () => {
    const result = await service.createReturn(cashierUser(), "idem-return-1", {
      saleId: SALE_ID,
      warehouseId: WAREHOUSE,
      reasonCode: "DEFECTIVE",
      refundMethod: "CASH",
      items: [
        {
          saleItemId: SALE_ITEM_CABLE,
          quantity: 1,
          disposition: "RESTOCK",
        },
      ],
    });

    expect(result.status).toBe(ReturnStatus.COMPLETED);
    expect(result.refundTotal).toBe("15000.0000");
    expect(result.refundMethod).toBe("CASH");
    expect(result.restockedVariantIds).toEqual([CABLE_VARIANT]);
    expect(inventoryService.commitReturnMovement).toHaveBeenCalledTimes(1);
    expect(inventoryService.commitReturnMovement).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        variantId: CABLE_VARIANT,
        restock: true,
        disposition: ReturnDisposition.RESTOCK,
      }),
    );
  });

  it("creates a return for a serial-tracked phone with matching IMEI", async () => {
    const result = await service.createReturn(cashierUser(), "idem-return-phone", {
      saleId: SALE_ID,
      warehouseId: WAREHOUSE,
      reasonCode: "CHANGED_MIND",
      refundMethod: "CASH",
      items: [
        {
          saleItemId: SALE_ITEM_PHONE,
          quantity: 1,
          disposition: "RESTOCK",
          serialUnitIds: [SERIAL_ID],
        },
      ],
    });

    expect(result.status).toBe(ReturnStatus.COMPLETED);
    expect(result.refundTotal).toBe("360000.0000");
    expect(inventoryService.commitReturnMovement).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        serialUnitIds: [SERIAL_ID],
        restock: true,
      }),
    );
  });

  it("rejects IMEI not sold on the line", async () => {
    await expect(
      service.createReturn(cashierUser(), "idem-bad-serial", {
        saleId: SALE_ID,
        warehouseId: WAREHOUSE,
        reasonCode: "DEFECTIVE",
        refundMethod: "CASH",
        items: [
          {
            saleItemId: SALE_ITEM_PHONE,
            quantity: 1,
            disposition: "RESTOCK",
            serialUnitIds: [WRONG_SERIAL],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    expect(inventoryService.commitReturnMovement).not.toHaveBeenCalled();
  });

  it("rejects return quantity above returnable", async () => {
    await expect(
      service.createReturn(cashierUser(), "idem-over-qty", {
        saleId: SALE_ID,
        warehouseId: WAREHOUSE,
        reasonCode: "DEFECTIVE",
        refundMethod: "CASH",
        items: [
          {
            saleItemId: SALE_ITEM_CABLE,
            quantity: 3,
            disposition: "RESTOCK",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    expect(inventoryService.commitReturnMovement).not.toHaveBeenCalled();
  });

  it("requires manager PIN above large-refund threshold", async () => {
    await expect(
      service.createReturn(cashierUser(), "idem-large", {
        saleId: SALE_ID,
        warehouseId: WAREHOUSE,
        reasonCode: "CHANGED_MIND",
        refundMethod: "CASH",
        items: [
          {
            saleItemId: SALE_ITEM_PHONE,
            quantity: 1,
            disposition: "RESTOCK",
            serialUnitIds: [SERIAL_ID],
            refundAmount: "500000.0000",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(inventoryService.commitReturnMovement).not.toHaveBeenCalled();
  });

  it("rejects invalid manager PIN on large refund", async () => {
    await expect(
      service.createReturn(cashierUser(), "idem-large-bad-pin", {
        saleId: SALE_ID,
        warehouseId: WAREHOUSE,
        reasonCode: "CHANGED_MIND",
        refundMethod: "CASH",
        managerPin: "0000",
        items: [
          {
            saleItemId: SALE_ITEM_PHONE,
            quantity: 1,
            disposition: "RESTOCK",
            serialUnitIds: [SERIAL_ID],
            refundAmount: "500000.0000",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(inventoryService.commitReturnMovement).not.toHaveBeenCalled();
  });

  it("allows large refund when manager PIN matches", async () => {
    const result = await service.createReturn(cashierUser(), "idem-large-pin", {
      saleId: SALE_ID,
      warehouseId: WAREHOUSE,
      reasonCode: "CHANGED_MIND",
      refundMethod: "CASH",
      managerPin: "1234",
      items: [
        {
          saleItemId: SALE_ITEM_PHONE,
          quantity: 1,
          disposition: "RESTOCK",
          serialUnitIds: [SERIAL_ID],
          refundAmount: "500000.0000",
        },
      ],
    });

    expect(result.refundTotal).toBe("500000.0000");
    expect(inventoryService.commitReturnMovement).toHaveBeenCalled();
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
      paymentsStub,
    );

    await expect(
      service.openShift(cashierUser(), {
        registerId: REGISTER,
        openingFloat: "10000.0000",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
