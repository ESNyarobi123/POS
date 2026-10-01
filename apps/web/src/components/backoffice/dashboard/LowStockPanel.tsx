"use client";

import Link from "next/link";
import type { DashboardLowStockRowDto } from "@gulio/contracts";
import { ProductThumb } from "@/components/backoffice/ProductThumb";
import { formatCount } from "./format";

type Props = {
  rows: DashboardLowStockRowDto[];
  loading?: boolean;
};

export function LowStockPanel({ rows, loading = false }: Props) {
  return (
    <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-gulio-text">Low stock alerts</h2>
          <p className="mt-0.5 text-xs text-gulio-muted">
            Reorder these before they run out
          </p>
        </div>
        <Link
          href="/inventory"
          className="text-sm font-medium text-gulio-primary hover:underline"
        >
          Inventory
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-gulio-bg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gulio-border bg-gulio-bg/40 px-3 py-8 text-center text-sm text-gulio-muted">
          Nothing urgent — every tracked variant is above its reorder point.
        </p>
      ) : (
        <ul className="divide-y divide-gulio-border">
          {rows.map((row) => (
            <li key={row.variantId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <ProductThumb imageUrl={row.imageUrl} name={row.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gulio-text">
                  {row.name}
                </p>
                <p className="truncate text-xs text-gulio-muted">
                  {row.sku ?? "—"}
                  {row.tracksSerial ? " · IMEI / serial" : ""}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold tabular-nums ${
                  row.available <= 0
                    ? "bg-rose-50 text-rose-700"
                    : row.available <= 2
                      ? "bg-amber-50 text-amber-800"
                      : "bg-sky-50 text-sky-700"
                }`}
              >
                {row.available <= 0
                  ? "Out"
                  : `${formatCount(row.available)} left`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
