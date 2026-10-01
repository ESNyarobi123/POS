import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@gulio/database";
import { PurchasingService } from "./purchasing.service";
import type { RequestUser } from "../auth/types/request-user";

const ORG = "11111111-1111-1111-1111-111111111111";
const USER = "99999999-9999-9999-9999-999999999999";
const SUPPLIER = "22222222-2222-2222-2222-222222222222";
const WAREHOUSE = "33333333-3333-3333-3333-333333333333";
const BRANCH = "44444444-4444-4444-4444-444444444444";
const VARIANT = "55555555-5555-5555-5555-555555555555";
const RECEIPT = "66666666-6666-6666-6666-666666666666";

const user: RequestUser = {
  userId: USER,
  organizationId: ORG,
  email: "owner@guliosmart.local",
  roles: ["OWNER"],
  permissions: ["stock.view", "stock.adjust"],
  branchIds: [BRANCH],
};

const NOW = new Date("2026-10-01T09:00:00.000Z");

function paymentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "pay-1",
    organizationId: ORG,
    supplierId: SUPPLIER,
    receiptId: null,
    amount: new Prisma.Decimal("1000"),
    method: "CASH",
    reference: null,
    note: null,
    paidAt: NOW,
    recordedByUserId: USER,
    createdAt: NOW,
    supplier: { name: "Distributor" },
    recordedBy: { fullName: "Owner" },
    ...overrides,
  };
}

function receiptLineRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "line-1",
    organizationId: ORG,
    receiptId: "gr-1",
    variantId: VARIANT,
    quantity: new Prisma.Decimal(2),
    unitCost: new Prisma.Decimal("1000"),
    retailPrice: new Prisma.Decimal("1500"),
    lineTotal: new Prisma.Decimal("2000"),
    tracksSerial: false,
    variant: {
      id: VARIANT,
      sku: "SKU-1",
      name: "128GB",
      imageUrl: null,
      product: { id: "prod-1", name: "Phone", imageUrl: null },
    },
    serials: [],
    ...overrides,
  };
}

function receiptRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "gr-1",
    organizationId: ORG,
    branchId: BRANCH,
    warehouseId: WAREHOUSE,
    supplierId: SUPPLIER,
    invoiceNumber: "INV-1",
    status: "POSTED",
    reason: null,
    notes: null,
    subtotal: new Prisma.Decimal("2000"),
    discountTotal: new Prisma.Decimal(0),
    taxTotal: new Prisma.Decimal(0),
    total: new Prisma.Decimal("2000"),
    receivedByUserId: USER,
    receivedAt: new Date("2026-01-02T00:00:00.000Z"),
    postedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    branch: { id: BRANCH, name: "Main" },
    warehouse: { id: WAREHOUSE, name: "Store" },
    supplier: { id: SUPPLIER, name: "Distributor" },
    receivedBy: { id: USER, fullName: "Owner" },
    lines: [receiptLineRow()],
    payments: [],
    ...overrides,
  };
}

function createService(
  prisma: unknown,
  inventory: unknown = {},
  audit: unknown = { log: jest.fn() },
) {
  return new PurchasingService(prisma as never, inventory as never, audit as never);
}

// ---------------------------------------------------------------------------
// Supplier payments
// ---------------------------------------------------------------------------

describe("PurchasingService.recordPayment", () => {
  it("allocates across oldest outstanding receipts first", async () => {
    const creates: Array<Record<string, unknown>> = [];
    const tx = {
      goodsReceipt: {
        findMany: jest.fn(async () => [
          { id: "gr-old", total: new Prisma.Decimal("2000") },
          { id: "gr-new", total: new Prisma.Decimal("1000") },
        ]),
      },
      supplierPayment: {
        groupBy: jest.fn(async () => []),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: `pay-${creates.length + 1}`, ...data };
          creates.push(row);
          return row;
        }),
      },
    };
    const prisma = {
      supplier: { findFirst: jest.fn(async () => ({ id: SUPPLIER })) },
      $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
      supplierPayment: {
        findMany: jest.fn(async () =>
          creates.map((row) => ({ ...row, supplier: { name: "Distributor" }, recordedBy: { fullName: "Owner" } })),
        ),
      },
    };
    const audit = { log: jest.fn() };
    const service = createService(prisma, {}, audit);

    const result = await service.recordPayment(user, {
      supplierId: SUPPLIER,
      amount: "2500.0000",
      method: "CASH",
    });

    expect(creates).toHaveLength(2);
    expect(creates[0]).toMatchObject({
      receiptId: "gr-old",
      recordedByUserId: USER,
    });
    expect((creates[0].amount as Prisma.Decimal).toFixed(4)).toBe("2000.0000");
    expect(creates[1]).toMatchObject({ receiptId: "gr-new" });
    expect((creates[1].amount as Prisma.Decimal).toFixed(4)).toBe("500.0000");
    expect(result.amount).toBe("2000.0000");
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "purchasing.payment.recorded" }),
    );
  });

  it("caps at each receipt's pending balance and posts the excess on account", async () => {
    const creates: Array<Record<string, unknown>> = [];
    const tx = {
      goodsReceipt: {
        findMany: jest.fn(async () => [
          { id: "gr-1", total: new Prisma.Decimal("2000") },
        ]),
      },
      supplierPayment: {
        groupBy: jest.fn(async () => [
          { receiptId: "gr-1", _sum: { amount: new Prisma.Decimal("1500") } },
        ]),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: `pay-${creates.length + 1}`, ...data };
          creates.push(row);
          return row;
        }),
      },
    };
    const prisma = {
      supplier: { findFirst: jest.fn(async () => ({ id: SUPPLIER })) },
      $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
      supplierPayment: {
        findMany: jest.fn(async () =>
          creates.map((row) => ({ ...row, supplier: { name: "Distributor" }, recordedBy: { fullName: "Owner" } })),
        ),
      },
    };
    const service = createService(prisma);

    await service.recordPayment(user, {
      supplierId: SUPPLIER,
      amount: "800",
      method: "BANK_TRANSFER",
    });

    expect(creates).toHaveLength(2);
    expect(creates[0]).toMatchObject({ receiptId: "gr-1" });
    expect((creates[0].amount as Prisma.Decimal).toFixed(4)).toBe("500.0000");
    expect(creates[1]).toMatchObject({ receiptId: null });
    expect((creates[1].amount as Prisma.Decimal).toFixed(4)).toBe("300.0000");
  });

  it("writes one row when a receiptId is given and it belongs to the supplier", async () => {
    const creates: Array<Record<string, unknown>> = [];
    const tx = {
      goodsReceipt: {
        findFirst: jest.fn(async () => ({ id: RECEIPT })),
      },
      supplierPayment: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: "pay-1", ...data };
          creates.push(row);
          return row;
        }),
      },
    };
    const prisma = {
      supplier: { findFirst: jest.fn(async () => ({ id: SUPPLIER })) },
      $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
      supplierPayment: {
        findMany: jest.fn(async () => [
          paymentRow({ receiptId: RECEIPT, amount: new Prisma.Decimal("500") }),
        ]),
      },
    };
    const service = createService(prisma);

    const result = await service.recordPayment(user, {
      supplierId: SUPPLIER,
      receiptId: RECEIPT,
      amount: "500",
      method: "CASH",
    });

    expect(tx.goodsReceipt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: RECEIPT,
          organizationId: ORG,
          supplierId: SUPPLIER,
        }),
      }),
    );
    expect(creates).toHaveLength(1);
    expect(creates[0]).toMatchObject({ receiptId: RECEIPT });
    expect(result.receiptId).toBe(RECEIPT);
  });

  it("rejects a receipt that belongs to another supplier", async () => {
    const tx = {
      goodsReceipt: { findFirst: jest.fn(async () => null) },
      supplierPayment: { create: jest.fn() },
    };
    const prisma = {
      supplier: { findFirst: jest.fn(async () => ({ id: SUPPLIER })) },
      $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const service = createService(prisma);

    await expect(
      service.recordPayment(user, {
        supplierId: SUPPLIER,
        receiptId: RECEIPT,
        amount: "100",
        method: "CASH",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.supplierPayment.create).not.toHaveBeenCalled();
  });

  it("rejects a non-positive amount before touching the database", async () => {
    const prisma = { $transaction: jest.fn() };
    const service = createService(prisma);

    await expect(
      service.recordPayment(user, {
        supplierId: SUPPLIER,
        amount: "0",
        method: "CASH",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Receipt DTO + derived payment status
// ---------------------------------------------------------------------------

describe("PurchasingService.getReceipt", () => {
  it("derives PARTIAL payment status and line margins from payments", async () => {
    const prisma = {
      goodsReceipt: {
        findFirst: jest.fn(async () =>
          receiptRow({
            payments: [paymentRow({ receiptId: "gr-1", amount: new Prisma.Decimal("1000") })],
          }),
        ),
      },
    };
    const service = createService(prisma);

    const receipt = await service.getReceipt(user, "gr-1");

    expect(receipt.paymentStatus).toBe("PARTIAL");
    expect(receipt.paidTotal).toBe("1000.0000");
    expect(receipt.pendingTotal).toBe("1000.0000");
    expect(receipt.lines[0].marginPerUnit).toBe("500.0000");
    expect(receipt.lines[0].potentialMargin).toBe("1000.0000");
    expect(receipt.totalUnits).toBe(2);
  });

  it("reports PAID when settled and PENDING when nothing is paid", async () => {
    const fullyPaid = createService({
      goodsReceipt: {
        findFirst: jest.fn(async () =>
          receiptRow({
            payments: [paymentRow({ receiptId: "gr-1", amount: new Prisma.Decimal("2000") })],
          }),
        ),
      },
    });
    const unpaid = createService({
      goodsReceipt: { findFirst: jest.fn(async () => receiptRow()) },
    });

    expect((await fullyPaid.getReceipt(user, "gr-1")).paymentStatus).toBe("PAID");
    expect((await unpaid.getReceipt(user, "gr-1")).paymentStatus).toBe("PENDING");
  });
});

// ---------------------------------------------------------------------------
// List + summary
// ---------------------------------------------------------------------------

describe("PurchasingService.listReceipts", () => {
  const older = receiptRow({
    id: "gr-old",
    supplierId: null,
    total: new Prisma.Decimal("1000"),
    receivedAt: new Date("2026-01-01T00:00:00.000Z"),
    lines: [
      receiptLineRow({
        id: "line-old",
        quantity: new Prisma.Decimal(1),
        unitCost: new Prisma.Decimal("500"),
        retailPrice: new Prisma.Decimal("800"),
        lineTotal: new Prisma.Decimal("500"),
      }),
    ],
    payments: [paymentRow({ id: "pay-old", receiptId: "gr-old", amount: new Prisma.Decimal("1000") })],
  });

  const newer = receiptRow({
    id: "gr-new",
    total: new Prisma.Decimal("2000"),
    receivedAt: new Date("2026-01-02T00:00:00.000Z"),
    lines: [
      receiptLineRow({
        id: "line-new",
        tracksSerial: true,
        serials: [{ serialUnit: { serialNumber: "IMEI-1" } }],
      }),
    ],
  });

  it("defaults to receivedAt desc and computes the summary over the whole filtered set", async () => {
    const prisma = {
      goodsReceipt: { findMany: jest.fn(async () => [newer, older]) },
    };
    const service = createService(prisma);

    const result = await service.listReceipts(user, { page: 1, pageSize: 1 });

    expect(result.total).toBe(2);
    expect(result.pageSize).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("gr-new");
    expect(result.summary).toMatchObject({
      receiptsCount: 2,
      unitsReceived: 3,
      totalValue: "3000.0000",
      paidTotal: "1000.0000",
      pendingTotal: "2000.0000",
      supplierCount: 1,
      potentialMargin: "1300.0000",
      serialUnits: 1,
    });
  });

  it("filters by derived paymentStatus before summarising", async () => {
    const prisma = {
      goodsReceipt: { findMany: jest.fn(async () => [newer, older]) },
    };
    const service = createService(prisma);

    const result = await service.listReceipts(user, { paymentStatus: "PAID" });

    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe("gr-old");
    expect(result.summary.receiptsCount).toBe(1);
    expect(result.summary.pendingTotal).toBe("0.0000");
  });

  it("sorts by pendingTotal ascending when asked", async () => {
    const prisma = {
      goodsReceipt: { findMany: jest.fn(async () => [newer, older]) },
    };
    const service = createService(prisma);

    const result = await service.listReceipts(user, {
      sort: "pendingTotal",
      dir: "asc",
    });

    expect(result.items.map((item) => item.id)).toEqual(["gr-old", "gr-new"]);
  });
});

// ---------------------------------------------------------------------------
// Posting a receipt is atomic and drives the inventory ledger
// ---------------------------------------------------------------------------

describe("PurchasingService.createReceipt", () => {
  function createTxMock(options: {
    tracksSerial?: boolean;
    serials?: Array<{ id: string }>;
    commitThrows?: unknown;
  } = {}) {
    const tx = {
      warehouse: {
        findFirst: jest.fn(async () => ({ id: WAREHOUSE, branchId: BRANCH })),
      },
      supplier: {
        upsert: jest.fn(async () => ({ id: SUPPLIER })),
        findFirst: jest.fn(async () => ({ id: SUPPLIER })),
      },
      goodsReceipt: {
        create: jest.fn(async () => ({ id: "gr-1" })),
        update: jest.fn(async () => ({ id: "gr-1" })),
        findUniqueOrThrow: jest.fn(async () =>
          receiptRow({
            lines: [
              receiptLineRow({
                tracksSerial: options.tracksSerial ?? false,
                serials: (options.serials ?? []).map((serial, index) => ({
                  serialUnit: { serialNumber: `IMEI-${index + 1}` },
                })),
              }),
            ],
          }),
        ),
      },
      variant: {
        findFirst: jest.fn(async () => ({
          id: VARIANT,
          tracksSerial: options.tracksSerial ?? false,
          sellPrice: new Prisma.Decimal("1500"),
        })),
      },
      goodsReceiptLine: {
        create: jest.fn(async () => ({ id: "line-1" })),
      },
      goodsReceiptSerial: {
        create: jest.fn(async () => ({})),
      },
    };
    const inventory = {
      commitPurchaseReceipt: options.commitThrows
        ? jest.fn(async () => {
            throw options.commitThrows;
          })
        : jest.fn(async () => ({
            movements: [
              {
                id: "mov-1",
                variantId: VARIANT,
                quantityDelta: "2.0000",
                movementType: "PURCHASE_RECEIPT",
              },
            ],
            balance: { id: "bal-1" },
            serials: options.serials ?? [],
          })),
    };
    const prisma = {
      $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    return { tx, inventory, prisma };
  }

  it("commits receipt, ledger, serial links and POSTED status in one transaction", async () => {
    const { tx, inventory, prisma } = createTxMock({
      tracksSerial: true,
      serials: [{ id: "serial-1" }, { id: "serial-2" }],
    });
    const audit = { log: jest.fn() };
    const service = createService(prisma, inventory, audit);

    const result = await service.createReceipt(user, {
      warehouseId: WAREHOUSE,
      supplierName: "Distributor",
      invoiceNumber: "INV-500",
      lines: [
        {
          variantId: VARIANT,
          quantity: 2,
          unitCost: "1000.0000",
          retailPrice: "1500.0000",
          serialNumbers: ["IMEI-1", "IMEI-2"],
        },
      ],
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.goodsReceipt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DRAFT", invoiceNumber: "INV-500" }),
      }),
    );
    expect(inventory.commitPurchaseReceipt).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        referenceType: "GoodsReceipt",
        referenceId: "gr-1",
        reason: "INV-500",
        quantity: "2.0000",
        serialNumbers: ["IMEI-1", "IMEI-2"],
        warehouseId: WAREHOUSE,
      }),
    );
    expect(tx.goodsReceiptSerial.create).toHaveBeenCalledTimes(2);
    expect(tx.goodsReceipt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "POSTED",
          subtotal: expect.any(Prisma.Decimal),
          total: expect.any(Prisma.Decimal),
        }),
      }),
    );
    expect(result.receipt.id).toBe("gr-1");
    expect(result.movements).toEqual([
      {
        id: "mov-1",
        variantId: VARIANT,
        quantityDelta: "2.0000",
        movementType: "PURCHASE_RECEIPT",
      },
    ]);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "purchasing.receipt.posted",
        entityId: "gr-1",
      }),
    );
  });

  it("propagates a duplicate IMEI and writes no audit / no POSTED update", async () => {
    const { tx, inventory, prisma } = createTxMock({
      tracksSerial: true,
      commitThrows: new ConflictException("Serial number already exists: IMEI-1"),
    });
    const audit = { log: jest.fn() };
    const service = createService(prisma, inventory, audit);

    await expect(
      service.createReceipt(user, {
        warehouseId: WAREHOUSE,
        supplierId: SUPPLIER,
        lines: [
          {
            variantId: VARIANT,
            quantity: 1,
            unitCost: "1000",
            serialNumbers: ["IMEI-1"],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.goodsReceipt.update).not.toHaveBeenCalled();
    expect(tx.goodsReceiptSerial.create).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it("rejects an empty line list", async () => {
    const service = createService({}, {});
    await expect(
      service.createReceipt(user, { warehouseId: WAREHOUSE, lines: [] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
