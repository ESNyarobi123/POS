"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { formatMoney } from "@/lib/money";
import { ProductHeroCard } from "./ProductHeroCard";
import { ProductInsightChips } from "./ProductInsightChips";
import { ProductPerformance } from "./ProductPerformance";
import { ProductQuickStats } from "./ProductQuickStats";
import { ProductSparkline } from "./ProductSparkline";
import {
  buildInsightChips,
  buildPortfolioOverview,
  categorySharePct,
  estimateCostPrice,
  marginPct,
  mockTrend7d,
  resolveStock,
  stockHealth,
  trendFromSales,
  unitsSold7d,
  velocityBand,
  type CatalogRow,
} from "./product-insights";
import type { SaleDto } from "@gulio/contracts";

export type BranchStockEntry = {
  branchId: string;
  branchName: string;
  branchCode: string;
  stock: number;
  isCurrent: boolean;
};

type Props = {
  rows: CatalogRow[];
  selected: CatalogRow | null;
  balances: Map<string, number>;
  sales: SaleDto[];
  onClearSelection?: () => void;
  branchBreakdown?: BranchStockEntry[];
  selectedBranchName?: string | null;
  isAllBranches?: boolean;
};

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function ProductInsightPanel({
  rows,
  selected,
  balances,
  sales,
  onClearSelection,
  branchBreakdown,
  selectedBranchName,
  isAllBranches,
}: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  const portfolio = useMemo(
    () =>
      buildPortfolioOverview(rows, balances, (n) =>
        formatMoney(n.toFixed(4)),
      ),
    [rows, balances],
  );

  const handleCopy = useCallback(async (label: string, value: string) => {
    if (!value || value === "—") return;
    const ok = await copyText(value);
    if (ok) {
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1600);
    }
  }, []);

  if (!selected) {
    return (
      <aside
        className="flex h-full flex-col gap-4 rounded-2xl border border-gulio-border bg-gradient-to-b from-white to-slate-50/80 p-5 shadow-sm"
        aria-label="Catalog portfolio overview"
      >
        <header className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">
            Portfolio
          </p>
          <h2 className="text-lg font-bold tracking-tight text-gulio-text">
            Catalog overview
          </h2>
          <p className="text-xs text-gulio-muted">
            Select a row to open product insights, trends, and quick actions.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-2">
          {[
            {
              label: "Variants",
              value: String(portfolio.variantCount),
              hint: `${portfolio.productCount} products`,
            },
            {
              label: "IMEI SKUs",
              value: String(portfolio.serialTracked),
              hint: "Serial tracked",
            },
            {
              label: "Categories",
              value: String(portfolio.categoryCount),
              hint: "Active groups",
            },
            {
              label: "Low stock",
              value: String(portfolio.lowStockCount),
              hint: "≤ 5 available",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-gulio-border/80 bg-white px-3 py-2.5 shadow-sm"
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-gulio-muted">
                {s.label}
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums text-gulio-text">
                {s.value}
              </p>
              <p className="text-[10px] text-gulio-muted">{s.hint}</p>
            </div>
          ))}
        </div>

        {portfolio.avgPriceLabel ? (
          <div className="rounded-xl border border-teal-100 bg-teal-50/50 px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-teal-800/80">
              Avg sell price
            </p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-gulio-text">
              {portfolio.avgPriceLabel}
            </p>
          </div>
        ) : null}

        <ProductSparkline
          values={portfolio.catalogTrend}
          label="Catalog activity (indicative)"
          color="#0D9488"
        />

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gulio-muted">
            Top categories
          </p>
          {portfolio.topCategories.length === 0 ? (
            <p className="text-xs text-gulio-muted">No categories yet.</p>
          ) : (
            portfolio.topCategories.map((c) => (
              <div key={c.name}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-gulio-text">{c.name}</span>
                  <span className="tabular-nums text-gulio-muted">
                    {c.count} · {c.pct}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-teal-500 transition-all duration-700"
                    style={{ width: `${Math.max(6, c.pct)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    );
  }

  const fromSales = trendFromSales(sales, selected.key);
  const trend = fromSales ?? mockTrend7d(selected.sku || selected.key);
  const trendSource = fromSales ? "From recent sales" : "Projected from SKU";
  const units = unitsSold7d(trend);
  const velocity = velocityBand(units);
  const stock = resolveStock(selected, balances);
  const health = stockHealth(stock);
  const share = categorySharePct(rows, selected.category);
  const cost = estimateCostPrice(selected.sellPrice, selected.sku);
  const margin = marginPct(selected.sellPrice, cost);
  const chips = buildInsightChips({
    row: selected,
    units7d: units,
    stock,
    categoryShare: share,
    velocity,
  });
  const copyTarget = selected.barcode || selected.sku;

  return (
    <aside
      className="flex h-full flex-col gap-4 rounded-2xl border border-teal-200/70 bg-gradient-to-b from-white via-teal-50/20 to-slate-50/60 p-5 shadow-md transition-shadow duration-300"
      aria-label={`Insights for ${selected.name}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">
            Product dock
          </p>
          <h2 className="text-sm font-bold text-gulio-text">Insights</h2>
        </div>
        {onClearSelection ? (
          <button
            type="button"
            onClick={onClearSelection}
            className="rounded-lg px-2 py-1 text-xs font-medium text-gulio-muted hover:bg-white hover:text-gulio-text"
          >
            Clear
          </button>
        ) : null}
      </header>

      <div
        key={selected.key}
        className="space-y-4 opacity-0 [animation:productDockIn_280ms_ease-out_forwards]"
      >
        <ProductHeroCard row={selected} />

        {/* Branch Inventory Breakdown */}
        {branchBreakdown && branchBreakdown.length > 0 && (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                Stock by Location
              </span>
              <span className="text-[11px] font-semibold text-teal-700">
                {branchBreakdown.reduce((acc, b) => acc + b.stock, 0)} Total Units
              </span>
            </div>

            <div className="mt-2.5 space-y-1.5">
              {branchBreakdown.map((b) => (
                <div
                  key={b.branchId}
                  className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition ${
                    b.isCurrent
                      ? "bg-teal-50/80 border border-teal-200/70 font-semibold"
                      : "bg-slate-50 border border-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        b.stock > 0 ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    />
                    <span className="truncate text-slate-800">
                      {b.branchName}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      ({b.branchCode})
                    </span>
                    {b.isCurrent && (
                      <span className="rounded bg-teal-200/60 px-1 text-[9px] font-bold text-teal-900">
                        Current
                      </span>
                    )}
                  </div>

                  <span
                    className={`tabular-nums font-bold ${
                      b.stock > 0 ? "text-slate-900" : "text-rose-600"
                    }`}
                  >
                    {b.stock} units
                  </span>
                </div>
              ))}
            </div>

            {selectedBranchName && !isAllBranches && (
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Stock at {selectedBranchName}:
                </span>
                <span className="text-xs font-bold text-slate-900">
                  {branchBreakdown.find((b) => b.isCurrent)?.stock ?? 0} units
                </span>
              </div>
            )}
          </div>
        )}

        <ProductInsightChips chips={chips} />
        <ProductQuickStats
          stock={stock}
          sellPrice={selected.sellPrice}
          costPrice={cost}
          margin={margin}
          costEstimated
        />
        <div className="rounded-2xl border border-gulio-border bg-white/90 p-3.5 shadow-sm">
          <ProductSparkline
            values={trend}
            label={`Units sold · ${trendSource}`}
            color="#0D9488"
          />
        </div>
        <ProductPerformance
          categoryShare={share}
          categoryName={selected.category}
          velocity={velocity}
          stockHealth={health}
          units7d={units}
        />

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gulio-muted">
            Actions
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href={`/products/new`}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-gulio-border bg-white px-3 text-xs font-semibold text-gulio-text shadow-sm hover:bg-gulio-bg"
              title="Edit flow stub — opens new product for now"
            >
              Edit
            </Link>
            <Link
              href={`/labels?variantId=${encodeURIComponent(selected.key)}`}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-gulio-primary px-3 text-xs font-semibold text-white shadow-sm hover:bg-gulio-primary-hover"
            >
              Print label
            </Link>
            <button
              type="button"
              onClick={() => void handleCopy("SKU", copyTarget)}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-gulio-border bg-white px-3 text-xs font-semibold text-gulio-text shadow-sm hover:bg-gulio-bg"
            >
              {copied === "SKU" ? "Copied!" : "Copy SKU / barcode"}
            </button>
            <Link
              href="/pos"
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-teal-200 bg-teal-50 px-3 text-xs font-semibold text-teal-900 shadow-sm hover:bg-teal-100"
            >
              View on POS
            </Link>
          </div>
          <p className="text-[10px] leading-relaxed text-gulio-muted">
            Open the register and search{" "}
            <span className="font-mono font-medium text-gulio-text">
              {selected.sku}
            </span>{" "}
            (F2) to sell this variant.
          </p>
        </div>
      </div>
    </aside>
  );
}
