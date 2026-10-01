"use client";

import type { DashboardBranchRowDto } from "@gulio/contracts";
import { formatCount, formatPct, toChartNumber } from "./format";
import { formatMoney } from "@/lib/money";

type Props = {
  rows: DashboardBranchRowDto[];
  loading?: boolean;
};

export function BranchCompareBars({ rows, loading = false }: Props) {
  const title = (
    <div>
      <h2 className="font-semibold text-gulio-text">Branch comparison</h2>
      <p className="mt-0.5 text-xs text-gulio-muted">
        Revenue and gross profit per location
      </p>
    </div>
  );

  if (loading) {
    return (
      <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
        {title}
        <div className="mt-4 space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-gulio-bg" />
          ))}
        </div>
      </section>
    );
  }

  // A single branch has nothing to compare against.
  if (rows.length < 2) return null;

  const sorted = [...rows].sort(
    (a, b) => toChartNumber(b.revenue) - toChartNumber(a.revenue),
  );
  const maxRevenue = Math.max(...sorted.map((r) => toChartNumber(r.revenue)), 1);
  const totalRevenue = sorted.reduce((sum, r) => sum + toChartNumber(r.revenue), 0);

  return (
    <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
      {title}
      <ul className="mt-4 space-y-4">
        {sorted.map((row, i) => {
          const revenue = toChartNumber(row.revenue);
          const profit = toChartNumber(row.grossProfit);
          const revenueWidth = Math.max(4, Math.round((revenue / maxRevenue) * 100));
          const profitWidth = Math.max(
            revenue > 0 ? 2 : 0,
            Math.round((profit / maxRevenue) * 100),
          );
          const share = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
          const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;

          return (
            <li key={row.branchId}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      i === 0
                        ? "bg-teal-100 text-teal-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span className="truncate text-sm font-semibold text-gulio-text">
                    {row.name}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-bold tabular-nums text-gulio-text">
                    {formatMoney(row.revenue)}
                  </span>
                  <span className="block text-[11px] tabular-nums text-gulio-muted">
                    {formatCount(row.orders)} orders · {formatPct(share, 0)} of revenue
                  </span>
                </span>
              </div>

              <div className="space-y-1">
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-teal-500 transition-[width] duration-700 ease-out"
                    style={{ width: `${revenueWidth}%` }}
                  />
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-[width] duration-700 ease-out"
                    style={{ width: `${profitWidth}%` }}
                  />
                </div>
              </div>

              <p className="mt-1 text-[11px] tabular-nums text-gulio-muted">
                Gross profit {formatMoney(row.grossProfit)}
                {revenue > 0 ? ` · ${formatPct(marginPct)} margin` : ""}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-gulio-border pt-3 text-xs text-gulio-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-teal-500" aria-hidden />
          Revenue
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-emerald-500" aria-hidden />
          Gross profit
        </span>
      </div>
    </section>
  );
}
