"use client";

import { ProductThumb } from "@/components/backoffice/ProductThumb";
import { formatMoney } from "@/lib/money";
import type { TopProductRow } from "./types";

type Props = {
  rows: TopProductRow[];
  fromLive?: boolean;
};

export function TopProductsList({ rows }: Props) {
  return (
    <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-gulio-text">Top selling</h2>
          <p className="mt-0.5 text-xs text-gulio-muted">
            {rows.length > 0 ? "By revenue in period" : "No bestsellers yet"}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gulio-border bg-gulio-bg/40 px-3 py-8 text-center text-sm text-gulio-muted">
          Top products appear after completed sales.
        </p>
      ) : (
        <ul className="divide-y divide-gulio-border">
          {rows.map((row, i) => (
            <li
              key={row.id}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span className="w-5 shrink-0 text-xs font-semibold tabular-nums text-gulio-muted">
                {i + 1}
              </span>
              <ProductThumb imageUrl={row.imageUrl} name={row.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gulio-text">
                  {row.name}
                </p>
                <p className="truncate text-xs text-gulio-muted">
                  {row.sku ?? "—"} · {row.units} sold
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-emerald-700">
                {formatMoney(row.revenueMajor)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
