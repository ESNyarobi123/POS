"use client";

import type { DashboardCategorySliceDto } from "@gulio/contracts";
import { CATEGORY_COLORS, formatPct } from "./format";
import { formatMoney } from "@/lib/money";

type Props = {
  slices: DashboardCategorySliceDto[];
  loading?: boolean;
};

export function CategoryBars({ slices, loading = false }: Props) {
  const title = (
    <div>
      <h2 className="font-semibold text-gulio-text">Category mix</h2>
      <p className="mt-0.5 text-xs text-gulio-muted">
        {slices.length > 0
          ? "Revenue share by product category"
          : "No category revenue in this range"}
      </p>
    </div>
  );

  if (loading) {
    return (
      <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
        {title}
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded-lg bg-gulio-bg" />
          ))}
        </div>
      </section>
    );
  }

  if (slices.length === 0) {
    return (
      <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
        {title}
        <p className="mt-4 rounded-lg border border-dashed border-gulio-border bg-gulio-bg/40 px-3 py-8 text-center text-sm text-gulio-muted">
          Sell products to see category mix.
        </p>
      </section>
    );
  }

  const maxPct = Math.max(...slices.map((s) => s.pct), 1);

  return (
    <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
      {title}
      <ul className="mt-4 space-y-3.5">
        {slices.map((s, i) => {
          const width = Math.max(6, Math.round((s.pct / maxPct) * 100));
          const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
          return (
            <li key={s.label}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-gulio-text">
                  {s.label}
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-gulio-muted">
                  {formatPct(s.pct)}
                  <span className="ml-2 font-normal">
                    {formatMoney(s.revenue)}
                  </span>
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{ width: `${width}%`, backgroundColor: color }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
