"use client";

import { Skeleton } from "@heroui/react";

export type MetricTone = "default" | "positive" | "warn" | "danger";

export type MetricGridItem = {
  label: string;
  value: string;
  /** Micro explanation under the value. */
  hint?: string;
  tone?: MetricTone;
};

type Props = {
  title: string;
  caption?: string;
  metrics: MetricGridItem[];
  loading?: boolean;
};

const valueTone: Record<MetricTone, string> = {
  default: "text-gulio-text",
  positive: "text-emerald-700",
  warn: "text-amber-700",
  danger: "text-rose-700",
};

/**
 * Compact supporting-detail matrix.
 *
 * Collapses what used to be a row of full-weight cards into one quiet panel:
 * hairline-separated cells on a single surface, so the hero row above keeps
 * all of the visual weight. Deliberately has no accent bars or shadows.
 */
export function MetricGrid({ title, caption, metrics, loading = false }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-gulio-border bg-gulio-card shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gulio-border px-4 py-3 sm:px-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gulio-muted">
          {title}
        </h4>
        {caption ? (
          <p className="text-[11px] text-gulio-muted">{caption}</p>
        ) : null}
      </div>

      {/*
       * Hairline separators come from the container's background showing through
       * `gap-px`. That only works when the last row is full, so the column
       * counts are deliberately limited to 2 and 4 — keep the metric count even.
       */}
      {loading ? (
        <div className="grid grid-cols-2 gap-px bg-gulio-border xl:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.label} className="bg-gulio-card px-4 py-3.5">
              <Skeleton className="h-2.5 w-16 rounded" />
              <Skeleton className="mt-2.5 h-5 w-20 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <dl className="grid grid-cols-2 gap-px bg-gulio-border xl:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.label} className="bg-gulio-card px-4 py-3.5">
              <dt className="truncate text-[10px] font-semibold uppercase tracking-wider text-gulio-muted">
                {m.label}
              </dt>
              <dd
                title={m.value}
                className={`mt-1 truncate text-sm font-bold tabular-nums tracking-tight sm:text-base ${
                  valueTone[m.tone ?? "default"]
                }`}
              >
                {m.value}
              </dd>
              {m.hint ? (
                <p className="mt-0.5 truncate text-[11px] text-gulio-muted">
                  {m.hint}
                </p>
              ) : null}
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
