"use client";

import type { DashboardTopProductDto } from "@gulio/contracts";
import { ProductThumb } from "@/components/backoffice/ProductThumb";
import { formatCount, toChartNumber } from "./format";
import { formatMoney } from "@/lib/money";

type Props = {
  rows: DashboardTopProductDto[];
  loading?: boolean;
};

export function TopProductsList({ rows, loading = false }: Props) {
  const title = (
    <div>
      <h2 className="font-semibold text-gulio-text">Top selling</h2>
      <p className="mt-0.5 text-xs text-gulio-muted">
        {rows.length > 0
          ? "Bestsellers by revenue in range"
          : "No bestsellers in this range yet"}
      </p>
    </div>
  );

  if (loading) {
    return (
      <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
        {title}
        <div className="mt-4 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-gulio-bg" />
          ))}
        </div>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
        {title}
        <p className="mt-4 rounded-lg border border-dashed border-gulio-border bg-gulio-bg/40 px-3 py-8 text-center text-sm text-gulio-muted">
          Top products appear after completed sales.
        </p>
      </section>
    );
  }

  const maxRevenue = Math.max(...rows.map((r) => toChartNumber(r.revenue)), 1);

  return (
    <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
      {title}
      <ul className="mt-4 divide-y divide-gulio-border">
        {rows.map((row, i) => {
          const width = Math.max(4, Math.round((toChartNumber(row.revenue) / maxRevenue) * 100));
          return (
            <li key={row.productId} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <span className="w-4 shrink-0 text-xs font-semibold tabular-nums text-gulio-muted">
                  {i + 1}
                </span>
                <ProductThumb imageUrl={row.imageUrl} name={row.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gulio-text">
                    {row.name}
                  </p>
                  <p className="truncate text-xs text-gulio-muted">
                    {row.sku ?? "—"} · {formatCount(row.units)} sold ·{" "}
                    {formatMoney(row.grossProfit)} profit
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-emerald-700">
                  {formatMoney(row.revenue)}
                </p>
              </div>
              <div className="ml-7 mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-teal-500 transition-[width] duration-700 ease-out"
                  style={{ width: `${width}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
