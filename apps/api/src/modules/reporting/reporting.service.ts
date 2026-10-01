/**
 * Reporting service — read-only owner dashboard aggregates.
 *
 * All figures are derived from live ledger / sales data, scoped to the
 * authenticated organization and the branches the user can see. Money is
 * handled exclusively with `Prisma.Decimal` and serialised as decimal strings;
 * no monetary value is ever computed with JS floats.
 */

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  PaymentMethod,
  Prisma,
  RegisterSessionStatus,
  ReturnStatus,
  SaleStatus,
} from "@gulio/database";
import { DASHBOARD_NOT_YET_AVAILABLE } from "@gulio/contracts";
import type {
  DashboardBranchRowDto,
  DashboardCategorySliceDto,
  DashboardComparisonDto,
  DashboardFinancialsDto,
  DashboardLowStockRowDto,
  DashboardPaymentSliceDto,
  DashboardRangeKey,
  DashboardRecentSaleDto,
  DashboardSummaryResponse,
  DashboardTopProductDto,
  DashboardTrendBucket,
  DashboardTrendPointDto,
} from "@gulio/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../auth/types/request-user";

/**
 * `Africa/Dar_es_Salaam` is a fixed UTC+03:00 offset with no daylight saving,
 * so the range maths below shifts instants into "local wall-clock expressed as
 * UTC" coordinates instead of pulling in a timezone dependency.
 */
const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

const LOW_STOCK_THRESHOLD = 5;
const LOW_STOCK_LIMIT = 8;
const TOP_PRODUCT_LIMIT = 6;
const CATEGORY_LIMIT = 6;
const RECENT_SALE_LIMIT = 8;
/** Defensive cap so a pathological `all` window can never loop forever. */
const TREND_BUCKET_GUARD = 1200;
const UNCATEGORISED = "Uncategorised";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Cash",
  MOBILE_MONEY_MANUAL: "Mobile Money",
  CARD: "Card",
  OTHER: "Other",
};

type ResolvedRange = {
  key: DashboardRangeKey;
  from: Date;
  to: Date;
  bucket: DashboardTrendBucket;
  label: string;
};

type ProductAggregate = {
  productId: string;
  name: string;
  sku: string | null;
  imageUrl: string | null;
  units: Prisma.Decimal;
  revenue: Prisma.Decimal;
  grossProfit: Prisma.Decimal;
};

function dec(
  value: Prisma.Decimal | string | number | null | undefined,
): Prisma.Decimal {
  if (value === null || value === undefined) return new Prisma.Decimal(0);
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

/** Serialise a Decimal(19,4) money value as a 2dp decimal string. */
function money(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function toLocal(date: Date): Date {
  return new Date(date.getTime() + TZ_OFFSET_MS);
}

function fromLocal(local: Date): Date {
  return new Date(local.getTime() - TZ_OFFSET_MS);
}

function startOfLocalDay(date: Date): Date {
  const local = toLocal(date);
  return fromLocal(
    new Date(
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()),
    ),
  );
}

function startOfLocalMonth(date: Date): Date {
  const local = toLocal(date);
  return fromLocal(
    new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1)),
  );
}

function startOfLocalYear(date: Date): Date {
  const local = toLocal(date);
  return fromLocal(new Date(Date.UTC(local.getUTCFullYear(), 0, 1)));
}

/** Monday-based week start. */
function startOfLocalWeek(date: Date): Date {
  const local = toLocal(date);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  return fromLocal(
    new Date(
      Date.UTC(
        local.getUTCFullYear(),
        local.getUTCMonth(),
        local.getUTCDate() - daysSinceMonday,
      ),
    ),
  );
}

function addLocalDays(date: Date, days: number): Date {
  const local = toLocal(date);
  local.setUTCDate(local.getUTCDate() + days);
  return fromLocal(local);
}

function addLocalMonths(date: Date, months: number): Date {
  const local = toLocal(date);
  local.setUTCMonth(local.getUTCMonth() + months);
  return fromLocal(local);
}

function dayKey(date: Date): string {
  const local = toLocal(date);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(
    local.getUTCDate(),
  )}`;
}

function hourKey(date: Date): string {
  const local = toLocal(date);
  return `${dayKey(date)}T${pad(local.getUTCHours())}`;
}

function monthKey(date: Date): string {
  const local = toLocal(date);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}`;
}

function bucketKey(bucket: DashboardTrendBucket, date: Date): string {
  if (bucket === "hour") return hourKey(date);
  if (bucket === "month") return monthKey(date);
  return dayKey(date);
}

function dayLabel(date: Date): string {
  const local = toLocal(date);
  return `${WEEKDAYS[local.getUTCDay()]} ${local.getUTCDate()}`;
}

function hourLabel(date: Date): string {
  const local = toLocal(date);
  return `${pad(local.getUTCHours())}:00`;
}

function monthLabel(date: Date): string {
  const local = toLocal(date);
  return MONTHS[local.getUTCMonth()];
}

function humanDate(date: Date): string {
  const local = toLocal(date);
  return `${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]} ${local.getUTCFullYear()}`;
}

function parseIsoDate(value?: string): Date | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/** `Math.round((next - prev) / prev × 100)`, null when the previous value is 0. */
function changePct(
  next: Prisma.Decimal,
  previous: Prisma.Decimal,
): number | null {
  if (previous.isZero()) return null;
  return Math.round(next.minus(previous).div(previous).times(100).toNumber());
}

function sharePct(part: Prisma.Decimal, total: Prisma.Decimal): number {
  if (total.lte(0)) return 0;
  return Math.round(part.div(total).times(100).toNumber());
}

/** Descending Decimal sort without ever coercing money to a JS float. */
function byDecimalDesc(a: Prisma.Decimal, b: Prisma.Decimal): number {
  if (a.gt(b)) return -1;
  if (a.lt(b)) return 1;
  return 0;
}

const DASHBOARD_SALE_SELECT = Prisma.validator<Prisma.SaleSelect>()({
  id: true,
  receiptNumber: true,
  grandTotal: true,
  discountTotal: true,
  taxTotal: true,
  status: true,
  fiscalStatus: true,
  completedAt: true,
  branchId: true,
  branch: { select: { id: true, name: true } },
  cashier: { select: { fullName: true } },
  items: {
    select: {
      variantId: true,
      quantity: true,
      unitPrice: true,
      listUnitPrice: true,
      lineTotal: true,
      variant: {
        select: {
          id: true,
          sku: true,
          name: true,
          imageUrl: true,
          costPrice: true,
          productId: true,
          product: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              category: { select: { name: true } },
            },
          },
        },
      },
    },
  },
  payments: { select: { method: true, amount: true } },
});

type DashboardSaleRow = Prisma.SaleGetPayload<{
  select: typeof DASHBOARD_SALE_SELECT;
}>;

const COMPARISON_SALE_SELECT = Prisma.validator<Prisma.SaleSelect>()({
  grandTotal: true,
  items: {
    select: { quantity: true, variant: { select: { costPrice: true } } },
  },
});

type ComparisonSaleRow = Prisma.SaleGetPayload<{
  select: typeof COMPARISON_SALE_SELECT;
}>;

const BALANCE_SELECT = Prisma.validator<Prisma.StockBalanceSelect>()({
  quantityOnHand: true,
  quantityReserved: true,
  variant: {
    select: {
      id: true,
      sku: true,
      name: true,
      costPrice: true,
      sellPrice: true,
      tracksSerial: true,
      imageUrl: true,
      product: { select: { id: true, name: true, imageUrl: true } },
    },
  },
});

type BalanceRow = Prisma.StockBalanceGetPayload<{
  select: typeof BALANCE_SELECT;
}>;

function saleCogs(sale: DashboardSaleRow): Prisma.Decimal {
  let total = dec(0);
  for (const item of sale.items) {
    total = total.plus(dec(item.quantity).times(dec(item.variant?.costPrice)));
  }
  return total;
}

function comparisonSaleCogs(sale: ComparisonSaleRow): Prisma.Decimal {
  let total = dec(0);
  for (const item of sale.items) {
    total = total.plus(dec(item.quantity).times(dec(item.variant?.costPrice)));
  }
  return total;
}

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(
    user: RequestUser,
    query: {
      range: DashboardRangeKey;
      branchId?: string;
      from?: string;
      to?: string;
    },
  ): Promise<DashboardSummaryResponse> {
    const now = new Date();
    await this.assertBranchAccess(user, query.branchId);

    const range = await this.resolveRange(user, query, now);
    const branchScope = query.branchId
      ? { branchId: query.branchId }
      : { branchId: { in: user.branchIds } };
    const branchIdScope = query.branchId
      ? { id: query.branchId }
      : { id: { in: user.branchIds } };

    const sales = await this.prisma.sale.findMany({
      where: {
        organizationId: user.organizationId,
        status: SaleStatus.COMPLETED,
        ...branchScope,
        completedAt: { gte: range.from, lte: range.to },
      },
      orderBy: { completedAt: "desc" },
      select: DASHBOARD_SALE_SELECT,
    });

    const returnsAgg = await this.prisma.return.aggregate({
      where: {
        organizationId: user.organizationId,
        status: ReturnStatus.COMPLETED,
        ...branchScope,
        processedAt: { gte: range.from, lte: range.to },
      },
      _sum: { refundTotal: true },
    });

    const warehouses = await this.prisma.warehouse.findMany({
      where: { organizationId: user.organizationId, ...branchScope },
      select: { id: true, branchId: true },
    });
    const warehouseIds = warehouses.map((warehouse) => warehouse.id);

    const balances = await this.prisma.stockBalance.findMany({
      where: {
        organizationId: user.organizationId,
        warehouseId: { in: warehouseIds },
      },
      select: BALANCE_SELECT,
    });

    const openSessions = await this.prisma.registerSession.findMany({
      where: {
        organizationId: user.organizationId,
        status: RegisterSessionStatus.OPEN,
        ...branchScope,
      },
      select: { id: true, openingFloat: true },
    });

    let cashFromSales = dec(0);
    if (openSessions.length > 0) {
      // NOTE: `Return` has no tender-method column, so cash refunds cannot be
      // netted out of the drawer figure yet. This adds only cash tender on
      // completed sales for the currently open sessions (plus opening floats).
      const cashAgg = await this.prisma.payment.aggregate({
        where: {
          organizationId: user.organizationId,
          method: PaymentMethod.CASH,
          sale: {
            status: SaleStatus.COMPLETED,
            registerSessionId: { in: openSessions.map((session) => session.id) },
          },
        },
        _sum: { amount: true },
      });
      cashFromSales = dec(cashAgg._sum.amount);
    }

    const branches = await this.prisma.branch.findMany({
      where: { organizationId: user.organizationId, ...branchIdScope },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    const financial = this.buildFinancials(sales, returnsAgg._sum.refundTotal, {
      balances,
      openSessions,
      cashFromSales,
    });

    const trend = this.buildTrend(sales, range);
    const { paymentMix, categoryMix, topProducts } = await this.buildMixAndTop(
      user.organizationId,
      sales,
    );
    const branchBreakdown = this.buildBranchBreakdown(branches, sales);
    const lowStock = this.buildLowStock(balances);
    const recentSales = this.buildRecentSales(sales);
    const comparison = await this.buildComparison(
      user.organizationId,
      branchScope,
      range,
      financial,
    );

    return {
      range: {
        key: range.key,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        label: range.label,
        bucket: range.bucket,
      },
      branchId: query.branchId ?? null,
      generatedAt: now.toISOString(),
      financial,
      comparison,
      trend,
      paymentMix,
      categoryMix,
      topProducts,
      branchBreakdown,
      lowStock,
      recentSales,
      notYetAvailable: [...DASHBOARD_NOT_YET_AVAILABLE],
    };
  }

  /** A provided branch must sit inside the user's branch scope; unknown = 404. */
  private async assertBranchAccess(
    user: RequestUser,
    branchId?: string,
  ): Promise<void> {
    if (!branchId) return;
    if (!user.branchIds.includes(branchId)) {
      throw new ForbiddenException("Branch is not in your scope");
    }
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!branch) {
      throw new NotFoundException("Branch not found");
    }
  }

  private async resolveRange(
    user: RequestUser,
    query: {
      range: DashboardRangeKey;
      branchId?: string;
      from?: string;
      to?: string;
    },
    now: Date,
  ): Promise<ResolvedRange> {
    const branchScope = query.branchId
      ? { branchId: query.branchId }
      : { branchId: { in: user.branchIds } };

    let key: DashboardRangeKey = query.range;
    let from: Date;
    let to = now;
    let bucket: DashboardTrendBucket;

    switch (query.range) {
      case "today":
        from = startOfLocalDay(now);
        bucket = "hour";
        break;
      case "7d":
        from = addLocalDays(startOfLocalDay(now), -6);
        bucket = "day";
        break;
      case "30d":
        from = addLocalDays(startOfLocalDay(now), -29);
        bucket = "day";
        break;
      case "this_week":
        from = startOfLocalWeek(now);
        bucket = "day";
        break;
      case "this_month":
        from = startOfLocalMonth(now);
        bucket = "day";
        break;
      case "this_year":
        from = startOfLocalYear(now);
        bucket = "month";
        break;
      case "all": {
        const earliest = await this.prisma.sale.aggregate({
          where: {
            organizationId: user.organizationId,
            status: SaleStatus.COMPLETED,
            ...branchScope,
          },
          _min: { completedAt: true },
        });
        from =
          earliest._min.completedAt ?? new Date(Date.UTC(1970, 0, 1));
        bucket = "month";
        break;
      }
      case "custom": {
        const parsedFrom = parseIsoDate(query.from);
        const parsedTo = parseIsoDate(query.to);
        if (parsedFrom && parsedTo && parsedFrom.getTime() < parsedTo.getTime()) {
          from = parsedFrom;
          to = parsedTo;
          bucket = dayKey(from) === dayKey(to) ? "hour" : "day";
        } else {
          // Invalid / incomplete custom window falls back to the last 7 days.
          key = "7d";
          from = addLocalDays(startOfLocalDay(now), -6);
          to = now;
          bucket = "day";
        }
        break;
      }
      default:
        key = "7d";
        from = addLocalDays(startOfLocalDay(now), -6);
        to = now;
        bucket = "day";
    }

    return {
      key,
      from,
      to,
      bucket,
      label: `${humanDate(from)} → ${humanDate(to)}`,
    };
  }

  private buildFinancials(
    sales: DashboardSaleRow[],
    refundSum: Prisma.Decimal | null,
    extras: {
      balances: BalanceRow[];
      openSessions: Array<{ openingFloat: Prisma.Decimal | number | string }>;
      cashFromSales: Prisma.Decimal;
    },
  ): DashboardFinancialsDto {
    let revenue = dec(0);
    let cogs = dec(0);
    let discountsGiven = dec(0);
    let taxCollected = dec(0);
    let unitsSold = dec(0);

    for (const sale of sales) {
      revenue = revenue.plus(dec(sale.grandTotal));
      cogs = cogs.plus(saleCogs(sale));
      discountsGiven = discountsGiven.plus(dec(sale.discountTotal));
      taxCollected = taxCollected.plus(dec(sale.taxTotal));
      for (const item of sale.items) {
        unitsSold = unitsSold.plus(dec(item.quantity));
      }
    }

    const grossProfit = revenue.minus(cogs);
    const refunds = dec(refundSum);
    const netSales = revenue.minus(refunds);
    const orders = sales.length;
    const avgTicket = orders === 0 ? dec(0) : revenue.div(orders);
    const grossMarginPct = revenue.isZero()
      ? 0
      : Math.round(grossProfit.div(revenue).times(100).toNumber());

    let stockInHandValue = dec(0);
    let stockRetailValue = dec(0);
    let stockUnits = dec(0);
    let serialTrackedUnits = dec(0);
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const balance of extras.balances) {
      const onHand = dec(balance.quantityOnHand);
      const available = onHand.minus(dec(balance.quantityReserved));
      stockInHandValue = stockInHandValue.plus(
        onHand.times(dec(balance.variant?.costPrice)),
      );
      stockRetailValue = stockRetailValue.plus(
        onHand.times(dec(balance.variant?.sellPrice)),
      );
      stockUnits = stockUnits.plus(onHand);
      if (balance.variant?.tracksSerial) {
        serialTrackedUnits = serialTrackedUnits.plus(onHand);
      }

      const availableNumber = available.toNumber();
      if (availableNumber <= 0) {
        outOfStockCount += 1;
      } else if (availableNumber <= LOW_STOCK_THRESHOLD) {
        lowStockCount += 1;
      }
    }

    const openingFloatTotal = extras.openSessions.reduce(
      (sum, session) => sum.plus(dec(session.openingFloat)),
      dec(0),
    );
    const cashInHand = openingFloatTotal.plus(extras.cashFromSales);
    const totalValue = stockInHandValue.plus(cashInHand);

    return {
      revenue: money(revenue),
      cogs: money(cogs),
      grossProfit: money(grossProfit),
      grossMarginPct,
      discountsGiven: money(discountsGiven),
      taxCollected: money(taxCollected),
      refunds: money(refunds),
      netSales: money(netSales),
      orders,
      avgTicket: money(avgTicket),
      unitsSold: unitsSold.toNumber(),
      stockInHandValue: money(stockInHandValue),
      stockUnits: stockUnits.toNumber(),
      stockRetailValue: money(stockRetailValue),
      cashInHand: money(cashInHand),
      openShifts: extras.openSessions.length,
      totalValue: money(totalValue),
      lowStockCount,
      outOfStockCount,
      serialTrackedUnits: serialTrackedUnits.toNumber(),
    };
  }

  private buildTrend(
    sales: DashboardSaleRow[],
    range: ResolvedRange,
  ): DashboardTrendPointDto[] {
    const buckets = this.generateBuckets(range);
    const map = new Map<
      string,
      { revenue: Prisma.Decimal; cogs: Prisma.Decimal; orders: number }
    >();
    for (const bucket of buckets) {
      map.set(bucket.key, { revenue: dec(0), cogs: dec(0), orders: 0 });
    }

    for (const sale of sales) {
      if (!sale.completedAt) continue;
      const entry = map.get(bucketKey(range.bucket, sale.completedAt));
      if (!entry) continue;
      entry.revenue = entry.revenue.plus(dec(sale.grandTotal));
      entry.cogs = entry.cogs.plus(saleCogs(sale));
      entry.orders += 1;
    }

    return buckets.map((bucket) => {
      const entry = map.get(bucket.key)!;
      return {
        key: bucket.key,
        label: bucket.label,
        revenue: money(entry.revenue),
        cogs: money(entry.cogs),
        grossProfit: money(entry.revenue.minus(entry.cogs)),
        orders: entry.orders,
      };
    });
  }

  /** Contiguous, zero-filled buckets covering the whole resolved range. */
  private generateBuckets(
    range: ResolvedRange,
  ): Array<{ key: string; label: string }> {
    const buckets: Array<{ key: string; label: string }> = [];
    let guard = 0;

    if (range.bucket === "hour") {
      let cursor = range.from;
      while (cursor.getTime() <= range.to.getTime() && guard < TREND_BUCKET_GUARD) {
        buckets.push({ key: hourKey(cursor), label: hourLabel(cursor) });
        cursor = new Date(cursor.getTime() + 60 * 60 * 1000);
        guard += 1;
      }
      return buckets;
    }

    if (range.bucket === "month") {
      let cursor = startOfLocalMonth(range.from);
      while (cursor.getTime() <= range.to.getTime() && guard < TREND_BUCKET_GUARD) {
        buckets.push({ key: monthKey(cursor), label: monthLabel(cursor) });
        cursor = addLocalMonths(cursor, 1);
        guard += 1;
      }
      return buckets;
    }

    let cursor = startOfLocalDay(range.from);
    while (cursor.getTime() <= range.to.getTime() && guard < TREND_BUCKET_GUARD) {
      buckets.push({ key: dayKey(cursor), label: dayLabel(cursor) });
      cursor = addLocalDays(cursor, 1);
      guard += 1;
    }
    return buckets;
  }

  private async buildMixAndTop(
    organizationId: string,
    sales: DashboardSaleRow[],
  ): Promise<{
    paymentMix: DashboardPaymentSliceDto[];
    categoryMix: DashboardCategorySliceDto[];
    topProducts: DashboardTopProductDto[];
  }> {
    const paymentTotals = new Map<string, Prisma.Decimal>();
    const categoryTotals = new Map<string, Prisma.Decimal>();
    const productTotals = new Map<string, ProductAggregate>();

    for (const sale of sales) {
      for (const payment of sale.payments) {
        paymentTotals.set(
          payment.method,
          (paymentTotals.get(payment.method) ?? dec(0)).plus(
            dec(payment.amount),
          ),
        );
      }

      for (const item of sale.items) {
        const lineTotal = dec(item.lineTotal);
        const category = item.variant?.product?.category?.name ?? UNCATEGORISED;
        categoryTotals.set(
          category,
          (categoryTotals.get(category) ?? dec(0)).plus(lineTotal),
        );

        const productId =
          item.variant?.product?.id ?? item.variant?.productId ?? item.variantId;
        const lineCogs = dec(item.quantity).times(dec(item.variant?.costPrice));
        const existing = productTotals.get(productId) ?? {
          productId,
          name: item.variant?.product?.name ?? item.variant?.name ?? "",
          sku: item.variant?.sku ?? null,
          imageUrl:
            item.variant?.imageUrl ??
            item.variant?.product?.imageUrl ??
            null,
          units: dec(0),
          revenue: dec(0),
          grossProfit: dec(0),
        };
        existing.units = existing.units.plus(dec(item.quantity));
        existing.revenue = existing.revenue.plus(lineTotal);
        existing.grossProfit = existing.grossProfit.plus(lineTotal.minus(lineCogs));
        productTotals.set(productId, existing);
      }
    }

    const tenderTotal = [...paymentTotals.values()].reduce(
      (sum, amount) => sum.plus(amount),
      dec(0),
    );
    const paymentMix = [...paymentTotals.entries()]
      .sort((a, b) => byDecimalDesc(a[1], b[1]))
      .map(([method, amount]) => ({
        method,
        label: PAYMENT_LABELS[method] ?? method,
        amount: money(amount),
        pct: sharePct(amount, tenderTotal),
      }));

    const categoryTotal = [...categoryTotals.values()].reduce(
      (sum, amount) => sum.plus(amount),
      dec(0),
    );
    const categoryMix = [...categoryTotals.entries()]
      .sort((a, b) => byDecimalDesc(a[1], b[1]))
      .slice(0, CATEGORY_LIMIT)
      .map(([label, amount]) => ({
        label,
        revenue: money(amount),
        pct: sharePct(amount, categoryTotal),
      }));

    const topRows = [...productTotals.values()]
      .sort((a, b) => byDecimalDesc(a.revenue, b.revenue))
      .slice(0, TOP_PRODUCT_LIMIT);

    const defaultSku = await this.lookupDefaultSkus(
      organizationId,
      topRows.map((row) => row.productId),
    );

    const topProducts = topRows.map((row) => ({
      productId: row.productId,
      name: row.name,
      sku: defaultSku.get(row.productId) ?? row.sku,
      imageUrl: row.imageUrl,
      units: row.units.toNumber(),
      revenue: money(row.revenue),
      grossProfit: money(row.grossProfit),
    }));

    return { paymentMix, categoryMix, topProducts };
  }

  /** Product's default/first variant sku, for the top-product list. */
  private async lookupDefaultSkus(
    organizationId: string,
    productIds: string[],
  ): Promise<Map<string, string>> {
    if (productIds.length === 0) return new Map();
    const variants = await this.prisma.variant.findMany({
      where: { organizationId, productId: { in: productIds } },
      orderBy: [{ createdAt: "asc" }, { sku: "asc" }],
      select: { productId: true, sku: true },
    });
    const map = new Map<string, string>();
    for (const variant of variants) {
      if (!map.has(variant.productId)) map.set(variant.productId, variant.sku);
    }
    return map;
  }

  private buildBranchBreakdown(
    branches: Array<{ id: string; name: string }>,
    sales: DashboardSaleRow[],
  ): DashboardBranchRowDto[] {
    const revenueByBranch = new Map<string, Prisma.Decimal>();
    const grossByBranch = new Map<string, Prisma.Decimal>();
    const ordersByBranch = new Map<string, number>();

    for (const sale of sales) {
      const revenue = dec(sale.grandTotal);
      const gross = revenue.minus(saleCogs(sale));
      revenueByBranch.set(
        sale.branchId,
        (revenueByBranch.get(sale.branchId) ?? dec(0)).plus(revenue),
      );
      grossByBranch.set(
        sale.branchId,
        (grossByBranch.get(sale.branchId) ?? dec(0)).plus(gross),
      );
      ordersByBranch.set(
        sale.branchId,
        (ordersByBranch.get(sale.branchId) ?? 0) + 1,
      );
    }

    return branches.map((branch) => ({
      branchId: branch.id,
      name: branch.name,
      revenue: money(revenueByBranch.get(branch.id) ?? dec(0)),
      orders: ordersByBranch.get(branch.id) ?? 0,
      grossProfit: money(grossByBranch.get(branch.id) ?? dec(0)),
    }));
  }

  private buildLowStock(balances: BalanceRow[]): DashboardLowStockRowDto[] {
    const rows: DashboardLowStockRowDto[] = [];
    for (const balance of balances) {
      const available = dec(balance.quantityOnHand).minus(
        dec(balance.quantityReserved),
      );
      const availableNumber = available.toNumber();
      if (availableNumber <= 0 || availableNumber > LOW_STOCK_THRESHOLD) continue;
      rows.push({
        variantId: balance.variant.id,
        productId: balance.variant.product?.id ?? null,
        name: balance.variant.product?.name ?? balance.variant.name,
        sku: balance.variant.sku ?? null,
        imageUrl:
          balance.variant.imageUrl ?? balance.variant.product?.imageUrl ?? null,
        available: availableNumber,
        tracksSerial: Boolean(balance.variant.tracksSerial),
      });
    }
    rows.sort((a, b) => a.available - b.available);
    return rows.slice(0, LOW_STOCK_LIMIT);
  }

  private buildRecentSales(sales: DashboardSaleRow[]): DashboardRecentSaleDto[] {
    return sales.slice(0, RECENT_SALE_LIMIT).map((sale) => ({
      id: sale.id,
      receiptNumber: sale.receiptNumber,
      grandTotal: money(dec(sale.grandTotal)),
      status: sale.status,
      fiscalStatus: sale.fiscalStatus,
      completedAt: sale.completedAt ? sale.completedAt.toISOString() : null,
      branchName: sale.branch?.name ?? null,
      cashierName: sale.cashier?.fullName ?? null,
      paymentMethod: sale.payments[0]?.method ?? null,
      negotiated: sale.items.some(
        (item) =>
          !dec(item.unitPrice).equals(dec(item.listUnitPrice)),
      ),
    }));
  }

  private async buildComparison(
    organizationId: string,
    branchScope: { branchId: string } | { branchId: { in: string[] } },
    range: ResolvedRange,
    financial: DashboardFinancialsDto,
  ): Promise<DashboardComparisonDto> {
    const durationMs = range.to.getTime() - range.from.getTime();
    const previousTo = range.from;
    const previousFrom = new Date(range.from.getTime() - durationMs);

    const previousSales = await this.prisma.sale.findMany({
      where: {
        organizationId,
        status: SaleStatus.COMPLETED,
        ...branchScope,
        // Half-open window `[previousFrom, range.from)` so a sale landing exactly
        // on the boundary is counted once, in the current window only. With
        // `lte` the boundary sale was double-counted — for `range=all` (whose
        // `from` is the earliest sale) that made every delta read 0% instead of
        // "no previous data".
        completedAt: { gte: previousFrom, lt: previousTo },
      },
      select: COMPARISON_SALE_SELECT,
    });

    let previousRevenue = dec(0);
    let previousCogs = dec(0);
    for (const sale of previousSales) {
      previousRevenue = previousRevenue.plus(dec(sale.grandTotal));
      previousCogs = previousCogs.plus(comparisonSaleCogs(sale));
    }
    const previousGrossProfit = previousRevenue.minus(previousCogs);

    return {
      from: previousFrom.toISOString(),
      to: previousTo.toISOString(),
      revenue: money(previousRevenue),
      grossProfit: money(previousGrossProfit),
      orders: previousSales.length,
      revenueChangePct: changePct(dec(financial.revenue), previousRevenue),
      grossProfitChangePct: changePct(
        dec(financial.grossProfit),
        previousGrossProfit,
      ),
      ordersChangePct: changePct(
        new Prisma.Decimal(financial.orders),
        new Prisma.Decimal(previousSales.length),
      ),
    };
  }
}
