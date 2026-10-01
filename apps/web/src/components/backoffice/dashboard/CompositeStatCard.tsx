"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@heroui/react";
import type { MoneyCardAccent } from "./MoneyCard";

export type CompositeRowTone = "default" | "positive" | "warn" | "danger";

export type CompositeRow = {
  label: string;
  value: string;
  hint?: string;
  tone?: CompositeRowTone;
};

type Props = {
  label: string;
  /** Headline figure for the card. */
  value: string;
  hint?: string;
  accent?: MoneyCardAccent;
  /** Small pill beside the label, e.g. `Current`. */
  tag?: string;
  icon?: ReactNode;
  rows?: CompositeRow[];
  /** Optional footer slot (CTA / status line). */
  footer?: ReactNode;
  loading?: boolean;
};

const accentStyles: Record<MoneyCardAccent, { bar: string; tag: string }> = {
  teal: { bar: "bg-teal-500", tag: "bg-teal-50 text-teal-700" },
  emerald: { bar: "bg-emerald-500", tag: "bg-emerald-50 text-emerald-700" },
  amber: { bar: "bg-amber-500", tag: "bg-amber-50 text-amber-800" },
  sky: { bar: "bg-sky-500", tag: "bg-sky-50 text-sky-700" },
  indigo: { bar: "bg-indigo-500", tag: "bg-indigo-50 text-indigo-700" },
  rose: { bar: "bg-rose-500", tag: "bg-rose-50 text-rose-700" },
  slate: { bar: "bg-slate-400", tag: "bg-slate-100 text-slate-600" },
};

const rowTone: Record<CompositeRowTone, string> = {
  default: "text-gulio-text",
  positive: "text-emerald-700",
  warn: "text-amber-700",
  danger: "text-rose-700",
};

/**
 * One headline figure plus its supporting breakdown on a single surface.
 *
 * Replaces what were several equal-weight sibling cards: the owner reads the
 * number that matters first, then the detail underneath it.
 */
export function CompositeStatCard({
  label,
  value,
  hint,
  accent = "teal",
  tag,
  icon,
  rows = [],
  footer,
  loading = false,
}: Props) {
  const styles = accentStyles[accent];

  return (
    <article className="relative flex flex-col overflow-hidden rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm transition hover:shadow-md">
      <span
        className={`absolute inset-y-0 left-0 w-1 ${styles.bar}`}
        aria-hidden
      />
      <div className="flex flex-1 flex-col pl-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gulio-muted">
            {label}
          </p>
          <span className="flex shrink-0 items-center gap-1.5">
            {tag ? (
              <span
                className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${styles.tag}`}
              >
                {tag}
              </span>
            ) : null}
            {icon}
          </span>
        </div>

        {loading ? (
          <Skeleton className="mt-2 h-8 w-36 rounded-md" />
        ) : (
          <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-gulio-text sm:text-[26px]">
            {value}
          </p>
        )}

        {hint && !loading ? (
          <p className="mt-1 text-xs leading-snug text-gulio-muted">{hint}</p>
        ) : null}

        {rows.length > 0 ? (
          <dl className="mt-4 space-y-2.5 border-t border-gulio-border pt-3.5">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-3"
              >
                <dt className="min-w-0 shrink truncate text-xs text-gulio-muted">
                  {row.label}
                </dt>
                <dd className="shrink-0 text-right">
                  {loading ? (
                    <Skeleton className="h-4 w-20 rounded" />
                  ) : (
                    <>
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          rowTone[row.tone ?? "default"]
                        }`}
                      >
                        {row.value}
                      </span>
                      {row.hint ? (
                        <span className="block text-[10px] text-gulio-muted">
                          {row.hint}
                        </span>
                      ) : null}
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {footer ? <div className="mt-4 pt-1">{footer}</div> : null}
      </div>
    </article>
  );
}
