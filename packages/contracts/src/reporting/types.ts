/**
 * Reporting / analytics contracts — read-only dashboard aggregates.
 *
 * Money and quantity are decimal strings (never JS float).
 * Every figure here is derived from real ledger data; metrics whose models do
 * not exist yet (payables, receivables, expenses, commission) are listed in
 * `DashboardSummaryResponse.notYetAvailable` instead of being faked.
 */

import type { DecimalString } from "../inventory/types";

/** Preset windows offered by the owner dashboard range switcher. */
export const DASHBOARD_RANGES = [
  "today",
  "7d",
  "30d",
  "this_week",
  "this_month",
  "this_year",
  "all",
  "custom",
] as const;
export type DashboardRangeKey = (typeof DASHBOARD_RANGES)[number];

export type DashboardTrendBucket = "hour" | "day" | "month";

/** One point on the revenue / profit trend line. */
export type DashboardTrendPointDto = {
  /** Stable key: `YYYY-MM-DD` for day buckets, `YYYY-MM-DDTHH` for hours. */
  key: string;
  /** Short axis label, e.g. `Mon 12`, `14:00`, `Jan`. */
  label: string;
  revenue: DecimalString;
  cogs: DecimalString;
  grossProfit: DecimalString;
  orders: number;
};

export type DashboardPaymentSliceDto = {
  method: string;
  label: string;
  amount: DecimalString;
  /** Share of tender in this period, 0–100, rounded. */
  pct: number;
};

export type DashboardCategorySliceDto = {
  label: string;
  revenue: DecimalString;
  /** Share of revenue in this period, 0–100, rounded. */
  pct: number;
};

export type DashboardTopProductDto = {
  productId: string;
  name: string;
  sku: string | null;
  imageUrl: string | null;
  units: number;
  revenue: DecimalString;
  grossProfit: DecimalString;
};

export type DashboardBranchRowDto = {
  branchId: string;
  name: string;
  revenue: DecimalString;
  orders: number;
  grossProfit: DecimalString;
};

export type DashboardLowStockRowDto = {
  variantId: string;
  productId: string | null;
  name: string;
  sku: string | null;
  imageUrl: string | null;
  available: number;
  tracksSerial: boolean;
};

export type DashboardRecentSaleDto = {
  id: string;
  receiptNumber: string;
  grandTotal: DecimalString;
  status: string;
  fiscalStatus: string;
  completedAt: string | null;
  branchName: string | null;
  cashierName: string | null;
  paymentMethod: string | null;
  negotiated: boolean;
};

/** Headline money figures for the Financial Summary card grid. */
export type DashboardFinancialsDto = {
  /** Completed sales grand total in range. */
  revenue: DecimalString;
  /** Cost of goods sold: Σ(line qty × variant.cost_price). */
  cogs: DecimalString;
  /** revenue − cogs. */
  grossProfit: DecimalString;
  /** grossProfit / revenue × 100, rounded. 0 when revenue is 0. */
  grossMarginPct: number;
  /** Σ sale.discount_total — value given away on negotiated lines. */
  discountsGiven: DecimalString;
  /** Σ sale.tax_total — collected on behalf of the tax authority. */
  taxCollected: DecimalString;
  /** Σ return.refund_total for processed returns in range. */
  refunds: DecimalString;
  /** revenue − refunds. */
  netSales: DecimalString;
  orders: number;
  /** revenue / orders, rounded. */
  avgTicket: DecimalString;
  /** Units sold in range. */
  unitsSold: number;

  /** Σ quantity_on_hand × variant.cost_price across scoped warehouses. */
  stockInHandValue: DecimalString;
  /** Σ quantity_on_hand (units) across scoped warehouses. */
  stockUnits: number;
  /** Σ quantity_on_hand × variant.sell_price across scoped warehouses. */
  stockRetailValue: DecimalString;

  /** Cash drawer float + net cash taken, for currently OPEN register sessions. */
  cashInHand: DecimalString;
  /** Open sessions contributing to cashInHand. */
  openShifts: number;

  /** stockInHandValue + cashInHand. */
  totalValue: DecimalString;

  lowStockCount: number;
  outOfStockCount: number;
  /** Serial-tracked units currently on hand. */
  serialTrackedUnits: number;
};

/** Same headline figures for the window immediately before the selected one. */
export type DashboardComparisonDto = {
  from: string;
  to: string;
  revenue: DecimalString;
  grossProfit: DecimalString;
  orders: number;
  /** revenue change vs previous window, %, null when previous revenue is 0. */
  revenueChangePct: number | null;
  /** grossProfit change vs previous window, %, null when previous is 0. */
  grossProfitChangePct: number | null;
  /** orders change vs previous window, %, null when previous is 0. */
  ordersChangePct: number | null;
};

export type DashboardRangeMetaDto = {
  key: DashboardRangeKey;
  /** Inclusive ISO start. */
  from: string;
  /** Inclusive ISO end. */
  to: string;
  /** Human label, e.g. `28 Sep 2026 → 30 Sep 2026`. */
  label: string;
  bucket: DashboardTrendBucket;
};

export type DashboardSummaryResponse = {
  range: DashboardRangeMetaDto;
  /** null = consolidated across every branch the user can see. */
  branchId: string | null;
  generatedAt: string;

  financial: DashboardFinancialsDto;
  comparison: DashboardComparisonDto;

  trend: DashboardTrendPointDto[];
  paymentMix: DashboardPaymentSliceDto[];
  categoryMix: DashboardCategorySliceDto[];
  topProducts: DashboardTopProductDto[];
  branchBreakdown: DashboardBranchRowDto[];
  lowStock: DashboardLowStockRowDto[];
  recentSales: DashboardRecentSaleDto[];

  /**
   * Metrics shown in the reference design that this codebase cannot compute
   * yet because the owning models do not exist (purchasing / expenses).
   * The UI renders these as clearly-labelled Phase 2 placeholders.
   */
  notYetAvailable: string[];
};

export const DASHBOARD_NOT_YET_AVAILABLE = [
  "payables",
  "receivables",
  "totalExpenses",
  "commissionPayouts",
  "purchaseBuyPrice",
] as const;
