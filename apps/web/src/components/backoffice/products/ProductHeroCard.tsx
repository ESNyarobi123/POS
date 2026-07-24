"use client";

import { useState } from "react";
import type { CatalogRow } from "./product-insights";

type Props = {
  row: CatalogRow;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function ProductHeroCard({ row }: Props) {
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(row.imageUrl) && !broken;

  return (
    <div className="overflow-hidden rounded-2xl border border-gulio-border bg-gradient-to-br from-white via-teal-50/40 to-slate-50 shadow-sm transition-all duration-300">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-gulio-bg">
        {showImage && row.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external seed URLs
          <img
            src={row.imageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-100/80 to-slate-100">
            <span className="text-4xl font-bold tracking-tight text-teal-700/80">
              {initials(row.name)}
            </span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-white drop-shadow-sm">
              {row.name}
            </p>
            <p className="truncate text-xs text-white/85">{row.variant}</p>
          </div>
          {row.tracksSerial ? (
            <span className="shrink-0 rounded-full bg-teal-500/95 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-sm">
              IMEI
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-2.5 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-gulio-muted">
          {row.brand ? (
            <span className="rounded-lg bg-gulio-bg px-2 py-1 font-medium text-gulio-text">
              {row.brand}
            </span>
          ) : null}
          <span className="rounded-lg bg-gulio-bg px-2 py-1">{row.category}</span>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-gulio-muted">
              Sell price
            </p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-gulio-text">
              {row.priceLabel}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gulio-muted">
              SKU
            </p>
            <p className="font-mono text-xs font-semibold text-gulio-text">
              {row.sku}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
