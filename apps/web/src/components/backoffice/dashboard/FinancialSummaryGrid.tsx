"use client";

import type { DashboardComparisonDto, DashboardFinancialsDto } from "@gulio/contracts";
import { formatCount, formatPct, isZeroAmount, ratioPct } from "./format";
import { CompositeStatCard } from "./CompositeStatCard";
import { DeltaChip } from "./DeltaChip";
import { MetricGrid, type MetricGridItem } from "./MetricGrid";
import { MoneyCard, type MoneyCardAccent } from "./MoneyCard";
import { StockAttentionCard } from "./StockAttentionCard";
import { formatMoney } from "@/lib/money";

type Props = {
  financial: DashboardFinancialsDto;
  comparison: DashboardComparisonDto;
  /** Human range caption, e.g. `28 Sep 2026 → 30 Sep 2026`. */
  rangeLabel: string;
  loading?: boolean;
};

function GroupHeading({
  title,
  caption,
  accent,
  aside,
}: {
  title: string;
  caption: string;
  accent: MoneyCardAccent;
  aside?: string;
}) {
  const dot: Record<MoneyCardAccent, string> = {
    teal: "bg-teal-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    sky: "bg-sky-500",
    indigo: "bg-indigo-500",
    rose: "bg-rose-500",
    slate: "bg-slate-400",
  };

  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h3 className="flex items-center gap-2 text-sm font-bold text-gulio-text">
        <span className={`h-2 w-2 rounded-full ${dot[accent]}`} aria-hidden />
        {title}
        <span className="font-normal text-gulio-muted">· {caption}</span>
      </h3>
      {aside ? (
        <p className="text-xs font-medium tabular-nums text-gulio-muted">
          {aside}
        </p>
      ) : null}
    </div>
  );
}

function BoxIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 text-gulio-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
      <path d="M3 8l9 5 9-5M12 13v8" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 text-gulio-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M16 14h2" />
    </svg>
  );
}

export function FinancialSummaryGrid({
  financial,
  comparison,
  rangeLabel,
  loading = false,
}: Props) {
  const prevCaption = "vs previous period";

  /**
   * Supporting detail, deliberately demoted to one quiet matrix. These used to
   * be full-weight cards competing with revenue and profit for the eye.
   */
  const salesDetail: MetricGridItem[] = [
    {
      label: "Net sales",
      value: formatMoney(financial.netSales),
      hint: "Revenue − refunds",
    },
    {
      label: "Cost of goods sold",
      value: formatMoney(financial.cogs),
      hint: "Sold qty × cost price",
    },
    {
      label: "Average ticket",
      value: formatMoney(financial.avgTicket),
      hint: "Revenue ÷ orders",
    },
    {
      label: "Units sold",
      value: formatCount(financial.unitsSold),
      hint: "Units on sale lines",
    },
    {
      label: "Discounts given",
      value: formatMoney(financial.discountsGiven),
      hint: "Negotiated reductions",
      tone: isZeroAmount(financial.discountsGiven) ? "default" : "warn",
    },
    {
      label: "Tax collected",
      value: formatMoney(financial.taxCollected),
      hint: "Passed to the authority",
    },
    {
      label: "Refunds",
      value: formatMoney(financial.refunds),
      hint: "Processed returns",
      tone: isZeroAmount(financial.refunds) ? "default" : "danger",
    },
    {
      label: "Discount rate",
      value: `${formatPct(ratioPct(financial.discountsGiven, financial.revenue))}`,
      hint: "of revenue",
      tone: isZeroAmount(financial.discountsGiven) ? "default" : "warn",
    },
  ];

  return (
    <div className="space-y-8">
      {/* ── Sales & profit ──────────────────────────────────────────── */}
      <section aria-label="Sales and profit">
        <GroupHeading
          title="Sales & profit"
          caption={rangeLabel}
          accent="teal"
          aside={
            loading
              ? undefined
              : `${formatCount(financial.orders)} order${
                  financial.orders === 1 ? "" : "s"
                } · ${formatPct(financial.grossMarginPct)} margin`
          }
        />

        {/* Headline row — the four numbers an owner checks first. */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MoneyCard
            label="Revenue"
            value={formatMoney(financial.revenue)}
            accent="teal"
            emphasise
            hint="Grand total of completed sales in range"
            loading={loading}
            delta={
              <DeltaChip
                value={comparison.revenueChangePct}
                caption={prevCaption}
                srLabel="Revenue change"
              />
            }
          />
          <MoneyCard
            label="Gross profit"
            value={formatMoney(financial.grossProfit)}
            accent="emerald"
            emphasise
            hint="Revenue − cost of goods sold"
            loading={loading}
            delta={
              <DeltaChip
                value={comparison.grossProfitChangePct}
                caption={prevCaption}
                srLabel="Gross profit change"
              />
            }
          />
          <MoneyCard
            label="Gross margin"
            value={formatPct(financial.grossMarginPct)}
            accent="emerald"
            emphasise
            hint="Gross profit ÷ revenue"
            loading={loading}
            progress={financial.grossMarginPct}
          />
          <MoneyCard
            label="Orders"
            value={formatCount(financial.orders)}
            accent="sky"
            emphasise
            hint="Completed transactions in range"
            loading={loading}
            delta={
              <DeltaChip
                value={comparison.ordersChangePct}
                caption={prevCaption}
                srLabel="Orders change"
              />
            }
          />
        </div>

        <div className="mt-3">
          <MetricGrid
            title="Supporting detail"
            caption="Derived from the same completed sales"
            metrics={salesDetail}
            loading={loading}
          />
        </div>
      </section>

      {/* ── Stock & cash ────────────────────────────────────────────── */}
      <section aria-label="Stock and cash">
        <GroupHeading
          title="Stock & cash"
          caption="Live position, not range-bound"
          accent="emerald"
          aside={loading ? undefined : `${formatCount(financial.stockUnits)} units on hand`}
        />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <CompositeStatCard
            label="Inventory value"
            value={formatMoney(financial.stockInHandValue)}
            accent="emerald"
            tag="Current"
            icon={<BoxIcon />}
            hint="Warehouse cost basis (qty × cost price)"
            loading={loading}
            rows={[
              {
                label: "Retail value",
                value: formatMoney(financial.stockRetailValue),
                hint: "at current sell price",
              },
              {
                label: "Units on hand",
                value: formatCount(financial.stockUnits),
              },
              {
                label: "Serial-tracked",
                value: formatCount(financial.serialTrackedUnits),
                hint: "IMEI units",
              },
            ]}
          />

          <CompositeStatCard
            label="Cash in hand"
            value={formatMoney(financial.cashInHand)}
            accent="amber"
            tag="Current"
            icon={<WalletIcon />}
            hint="Drawer float + net cash on open shifts"
            loading={loading}
            rows={[
              {
                label: "Open shifts",
                value: formatCount(financial.openShifts),
              },
              {
                label: "Total value",
                value: formatMoney(financial.totalValue),
                hint: "inventory + cash",
              },
            ]}
            footer={
              <p className="text-[10px] leading-snug text-gulio-muted">
                Cash refunds are not deducted from the drawer figure yet.
              </p>
            }
          />

          <StockAttentionCard
            lowStockCount={financial.lowStockCount}
            outOfStockCount={financial.outOfStockCount}
            loading={loading}
            className="md:col-span-2 xl:col-span-1"
          />
        </div>
      </section>
    </div>
  );
}
