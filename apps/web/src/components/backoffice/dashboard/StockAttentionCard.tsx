"use client";

import Link from "next/link";
import { Skeleton } from "@heroui/react";
import { formatCount } from "./format";

type Props = {
  lowStockCount: number;
  outOfStockCount: number;
  loading?: boolean;
  /** Layout hooks from the parent grid (e.g. spanning columns). */
  className?: string;
};

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10.3 4.2L2.6 17.5A2 2 0 004.3 20.5h15.4a2 2 0 001.7-3L13.7 4.2a2 2 0 00-3.4 0z" />
      <path d="M12 9.5v4M12 17h.01" />
    </svg>
  );
}

/**
 * Stock reorder status as a single card.
 *
 * Low-stock and out-of-stock counts are alerts, not financial figures, so they
 * get their own tone and a direct route into Inventory instead of competing
 * with the money cards for attention.
 */
export function StockAttentionCard({
  lowStockCount,
  outOfStockCount,
  loading = false,
  className = "",
}: Props) {
  const healthy = lowStockCount === 0 && outOfStockCount === 0;

  const tone = healthy
    ? {
        border: "border-emerald-200",
        bar: "bg-emerald-500",
        tile: "bg-emerald-50 text-emerald-700",
        eyebrow: "text-emerald-700",
      }
    : {
        border: "border-amber-200",
        bar: "bg-amber-500",
        tile: "bg-amber-50 text-amber-800",
        eyebrow: "text-amber-800",
      };

  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-xl border ${tone.border} bg-gulio-card p-5 shadow-sm transition hover:shadow-md ${className}`}
    >
      <span
        className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`}
        aria-hidden
      />
      <div className="flex flex-1 flex-col pl-1.5">
        <div className="flex items-start justify-between gap-2">
          <p
            className={`text-[11px] font-semibold uppercase tracking-wide ${tone.eyebrow}`}
          >
            Stock attention
          </p>
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone.tile}`}
          >
            {healthy ? <CheckIcon /> : <AlertIcon />}
          </span>
        </div>

        {loading ? (
          <Skeleton className="mt-2 h-8 w-32 rounded-md" />
        ) : healthy ? (
          <>
            <p className="mt-1.5 text-xl font-bold tracking-tight text-emerald-700">
              All levels healthy
            </p>
            <p className="mt-1 text-xs leading-snug text-gulio-muted">
              Every tracked variant is above its reorder point.
            </p>
          </>
        ) : (
          <>
            <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-gulio-text sm:text-[26px]">
              {formatCount(lowStockCount + outOfStockCount)}
              <span className="ml-1.5 text-sm font-semibold text-gulio-muted">
                need reorder
              </span>
            </p>
            <dl className="mt-4 space-y-2.5 border-t border-gulio-border pt-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-xs text-gulio-muted">Out of stock</dt>
                <dd
                  className={`text-sm font-bold tabular-nums ${
                    outOfStockCount > 0 ? "text-rose-700" : "text-gulio-muted"
                  }`}
                >
                  {formatCount(outOfStockCount)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-xs text-gulio-muted">
                  Low stock
                  <span className="ml-1 text-[10px]">
                    (≤ 5 available)
                  </span>
                </dt>
                <dd className="text-sm font-bold tabular-nums text-amber-700">
                  {formatCount(lowStockCount)}
                </dd>
              </div>
            </dl>
            <Link
              href="/inventory"
              className="mt-4 inline-flex min-h-9 items-center justify-center rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900 transition hover:bg-amber-50"
            >
              Review inventory
            </Link>
          </>
        )}
      </div>
    </article>
  );
}
