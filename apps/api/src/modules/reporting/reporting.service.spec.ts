import { ForbiddenException } from "@nestjs/common";
import {
  FiscalStatus,
  PaymentMethod,
  Prisma,
  SaleStatus,
} from "@gulio/database";
import { DASHBOARD_NOT_YET_AVAILABLE } from "@gulio/contracts";
import { ReportingService } from "./reporting.service";
import type { RequestUser } from "../auth/types/request-user";

const ORG = "11111111-1111-1111-1111-111111111111";
const BRANCH_A = "22222222-2222-2222-2222-222222222222";
const BRANCH_B = "33333333-3333-3333-3333-333333333333";
const OTHER_BRANCH = "99999999-9999-9999-9999-999999999999";
const WAREHOUSE_A = "44444444-4444-4444-4444-444444444444";
const PRODUCT_1 = "55555555-5555-5555-5555-555555555555";
const VARIANT_1 = "66666666-6666-6666-6666-666666666666";
const SESSION_1 = "77777777-7777-7777-7777-777777777777";

const user: RequestUser = {
  userId: "user-owner",
  organizationId: ORG,
  email: "owner@guliosmart.local",
  roles: ["OWNER"],
  permissions: ["reports.view"],
  branchIds: [BRANCH_A, BRANCH_B],
};

/** A window that always contains the deterministic fixture sale below. */
const customRange = {
  range: "custom" as const,
  from: "2026-09-29T00:00:00.000Z",
  to: "2026-10-01T00:00:00.000Z",
};

function createPrismaMock() {
  return {
    branch: {
      findFirst: jest.fn(async () => ({ id: BRANCH_A })),
      findMany: jest.fn(async () => [] as Array<{ id: string; name: string }>),
    },
    warehouse: {
      findMany: jest.fn(
        async () => [] as Array<{ id: string; branchId: string }>,
      ),
    },
    sale: {
      findMany: jest.fn(async () => [] as unknown[]),
      aggregate: jest.fn(async () => ({ _min: { completedAt: null } })),
    },
    return: {
      aggregate: jest.fn(async () => ({ _sum: { refundTotal: null } })),
    },
    stockBalance: { findMany: jest.fn(async () => [] as unknown[]) },
    registerSession: { findMany: jest.fn(async () => [] as unknown[]) },
    payment: { aggregate: jest.fn(async () => ({ _sum: { amount: null } })) },
    variant: { findMany: jest.fn(async () => [] as unknown[]) },
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

function createService(prisma: PrismaMock): ReportingService {
  return new ReportingService(prisma as never);
}

function fixtureSale() {
  return {
    id: "sale-1",
    receiptNumber: "RCP-00000001",
    grandTotal: new Prisma.Decimal(1000),
    discountTotal: new Prisma.Decimal(100),
    taxTotal: new Prisma.Decimal(50),
    status: SaleStatus.COMPLETED,
    fiscalStatus: FiscalStatus.FISCAL_PENDING,
    completedAt: new Date("2026-09-30T10:00:00.000Z"),
    branchId: BRANCH_A,
    branch: { id: BRANCH_A, name: "Main" },
    cashier: { fullName: "Asha" },
    items: [
      {
        variantId: VARIANT_1,
        quantity: new Prisma.Decimal(2),
        unitPrice: new Prisma.Decimal(500),
        listUnitPrice: new Prisma.Decimal(500),
        lineTotal: new Prisma.Decimal(1000),
        variant: {
          id: VARIANT_1,
          sku: "SKU-1",
          name: "Black",
          imageUrl: null,
          costPrice: new Prisma.Decimal(300),
          productId: PRODUCT_1,
          product: {
            id: PRODUCT_1,
            name: "Phone",
            imageUrl: null,
            category: { name: "Phones" },
          },
        },
      },
    ],
    payments: [
      { method: PaymentMethod.CASH, amount: new Prisma.Decimal(600) },
      {
        method: PaymentMethod.MOBILE_MONEY_MANUAL,
        amount: new Prisma.Decimal(400),
      },
    ],
  };
}

function fixturePreviousSale() {
  return {
    grandTotal: new Prisma.Decimal(800),
    items: [
      {
        quantity: new Prisma.Decimal(1),
        variant: { costPrice: new Prisma.Decimal(300) },
      },
    ],
  };
}

function fixtureBalance() {
  return {
    quantityOnHand: new Prisma.Decimal(3),
    quantityReserved: new Prisma.Decimal(0),
    variant: {
      id: VARIANT_1,
      sku: "SKU-1",
      name: "Black",
      costPrice: new Prisma.Decimal(300),
      sellPrice: new Prisma.Decimal(500),
      tracksSerial: true,
      imageUrl: null,
      product: { id: PRODUCT_1, name: "Phone", imageUrl: null },
    },
  };
}

describe("ReportingService.getDashboard", () => {
  it("returns a fully-populated all-zero response for an empty org without throwing", async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);

    const result = await service.getDashboard(user, { range: "7d" });

    expect(result.financial.revenue).toBe("0.00");
    expect(result.financial.cogs).toBe("0.00");
    expect(result.financial.grossProfit).toBe("0.00");
    expect(result.financial.grossMarginPct).toBe(0);
    expect(result.financial.discountsGiven).toBe("0.00");
    expect(result.financial.taxCollected).toBe("0.00");
    expect(result.financial.refunds).toBe("0.00");
    expect(result.financial.netSales).toBe("0.00");
    expect(result.financial.orders).toBe(0);
    expect(result.financial.avgTicket).toBe("0.00");
    expect(result.financial.stockInHandValue).toBe("0.00");
    expect(result.financial.stockRetailValue).toBe("0.00");
    expect(result.financial.cashInHand).toBe("0.00");
    expect(result.financial.totalValue).toBe("0.00");
    expect(result.financial.openShifts).toBe(0);
    expect(result.financial.lowStockCount).toBe(0);
    expect(result.financial.outOfStockCount).toBe(0);
    expect(result.financial.serialTrackedUnits).toBe(0);

    expect(result.comparison.revenue).toBe("0.00");
    expect(result.comparison.grossProfit).toBe("0.00");
    expect(result.comparison.orders).toBe(0);
    expect(result.comparison.revenueChangePct).toBeNull();
    expect(result.comparison.grossProfitChangePct).toBeNull();
    expect(result.comparison.ordersChangePct).toBeNull();

    expect(result.range.key).toBe("7d");
    expect(result.range.bucket).toBe("day");
    expect(result.branchId).toBeNull();
    expect(result.trend).toHaveLength(7);
    expect(result.trend.every((point) => point.revenue === "0.00")).toBe(true);
    expect(result.paymentMix).toEqual([]);
    expect(result.categoryMix).toEqual([]);
    expect(result.topProducts).toEqual([]);
    expect(result.branchBreakdown).toEqual([]);
    expect(result.lowStock).toEqual([]);
    expect(result.recentSales).toEqual([]);
    expect(result.notYetAvailable).toEqual([...DASHBOARD_NOT_YET_AVAILABLE]);
  });

  it("computes revenue, COGS, gross profit, margin and mixes from real rows", async () => {
    const prisma = createPrismaMock();
    prisma.sale.findMany
      .mockResolvedValueOnce([fixtureSale()] as never)
      .mockResolvedValueOnce([fixturePreviousSale()] as never);
    prisma.stockBalance.findMany.mockResolvedValue([fixtureBalance()] as never);
    prisma.registerSession.findMany.mockResolvedValue([
      { id: SESSION_1, openingFloat: new Prisma.Decimal(200) },
    ] as never);
    prisma.payment.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal(600) },
    } as never);
    prisma.branch.findMany.mockResolvedValue([
      { id: BRANCH_A, name: "Main" },
      { id: BRANCH_B, name: "Second" },
    ] as never);
    prisma.variant.findMany.mockResolvedValue([
      { productId: PRODUCT_1, sku: "SKU-1" },
    ] as never);

    const service = createService(prisma);
    const result = await service.getDashboard(user, customRange);

    // Revenue 1000, COGS 2 × 300 = 600, gross 400 → 40%.
    expect(result.financial.revenue).toBe("1000.00");
    expect(result.financial.cogs).toBe("600.00");
    expect(result.financial.grossProfit).toBe("400.00");
    expect(result.financial.grossMarginPct).toBe(40);
    expect(result.financial.discountsGiven).toBe("100.00");
    expect(result.financial.taxCollected).toBe("50.00");
    expect(result.financial.netSales).toBe("1000.00");
    expect(result.financial.orders).toBe(1);
    expect(result.financial.avgTicket).toBe("1000.00");
    expect(result.financial.unitsSold).toBe(2);

    // Stock: 3 on hand × 300 cost, × 500 retail.
    expect(result.financial.stockInHandValue).toBe("900.00");
    expect(result.financial.stockRetailValue).toBe("1500.00");
    expect(result.financial.stockUnits).toBe(3);
    expect(result.financial.serialTrackedUnits).toBe(3);
    expect(result.financial.lowStockCount).toBe(1);
    expect(result.financial.outOfStockCount).toBe(0);
    // Drawer: 200 float + 600 cash tender.
    expect(result.financial.cashInHand).toBe("800.00");
    expect(result.financial.openShifts).toBe(1);
    expect(result.financial.totalValue).toBe("1700.00");

    // Previous window: revenue 800, gross 500, 1 order.
    expect(result.comparison.revenue).toBe("800.00");
    expect(result.comparison.grossProfit).toBe("500.00");
    expect(result.comparison.orders).toBe(1);
    expect(result.comparison.revenueChangePct).toBe(25);
    expect(result.comparison.grossProfitChangePct).toBe(-20);
    expect(result.comparison.ordersChangePct).toBe(0);

    // Trend is zero-filled, three days in the custom window.
    expect(result.trend).toHaveLength(3);
    const day = result.trend.find((point) => point.key === "2026-09-30");
    expect(day?.revenue).toBe("1000.00");
    expect(day?.cogs).toBe("600.00");
    expect(day?.grossProfit).toBe("400.00");
    expect(day?.orders).toBe(1);

    expect(result.paymentMix).toEqual([
      { method: "CASH", label: "Cash", amount: "600.00", pct: 60 },
      {
        method: "MOBILE_MONEY_MANUAL",
        label: "Mobile Money",
        amount: "400.00",
        pct: 40,
      },
    ]);
    expect(result.categoryMix).toEqual([
      { label: "Phones", revenue: "1000.00", pct: 100 },
    ]);
    expect(result.topProducts).toEqual([
      {
        productId: PRODUCT_1,
        name: "Phone",
        sku: "SKU-1",
        imageUrl: null,
        units: 2,
        revenue: "1000.00",
        grossProfit: "400.00",
      },
    ]);
    expect(result.branchBreakdown).toEqual([
      {
        branchId: BRANCH_A,
        name: "Main",
        revenue: "1000.00",
        orders: 1,
        grossProfit: "400.00",
      },
      {
        branchId: BRANCH_B,
        name: "Second",
        revenue: "0.00",
        orders: 0,
        grossProfit: "0.00",
      },
    ]);
    expect(result.lowStock).toHaveLength(1);
    expect(result.lowStock[0]).toMatchObject({
      variantId: VARIANT_1,
      available: 3,
      tracksSerial: true,
    });
    expect(result.recentSales).toHaveLength(1);
    expect(result.recentSales[0]).toMatchObject({
      receiptNumber: "RCP-00000001",
      grandTotal: "1000.00",
      paymentMethod: "CASH",
      negotiated: false,
    });
  });

  it("throws ForbiddenException for a branch outside the user's scope", async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);

    await expect(
      service.getDashboard(user, { range: "7d", branchId: OTHER_BRANCH }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.sale.findMany).not.toHaveBeenCalled();
  });

  it("returns null percentage changes when the previous window has no sales", async () => {
    const prisma = createPrismaMock();
    prisma.sale.findMany
      .mockResolvedValueOnce([fixtureSale()] as never)
      .mockResolvedValueOnce([] as never);

    const service = createService(prisma);
    const result = await service.getDashboard(user, customRange);

    expect(result.financial.revenue).toBe("1000.00");
    expect(result.comparison.revenue).toBe("0.00");
    expect(result.comparison.revenueChangePct).toBeNull();
    expect(result.comparison.grossProfitChangePct).toBeNull();
    expect(result.comparison.ordersChangePct).toBeNull();
  });

  it("uses a half-open previous window so the boundary sale is not double-counted", async () => {
    const prisma = createPrismaMock();
    prisma.sale.findMany
      .mockResolvedValueOnce([fixtureSale()] as never)
      .mockResolvedValueOnce([] as never);

    const service = createService(prisma);
    const result = await service.getDashboard(user, customRange);

    // Call 0 is the current window, call 1 is the comparison window.
    const calls = prisma.sale.findMany.mock.calls as unknown as Array<
      [{ where: { completedAt: { gte: Date; lt?: Date; lte?: Date } } }]
    >;
    const previousWhere = calls[1][0];
    expect(previousWhere.where.completedAt.lt).toEqual(
      new Date(customRange.from),
    );
    expect(previousWhere.where.completedAt.lte).toBeUndefined();

    // The reported comparison window therefore ends exactly at the range start
    // and contains no sales, giving a neutral (null) delta instead of 0%.
    expect(result.comparison.to).toBe(new Date(customRange.from).toISOString());
    expect(result.comparison.revenueChangePct).toBeNull();
  });
});
