"use client";

import { Skeleton } from "@heroui/react";
import type { ReactNode } from "react";

export type MoneyCardAccent =
  | "teal"
  | "emerald"
  | "amber"
  | "sky"
  | "indigo"
  | "rose"
  | "slate";

const accentStyles: Record<MoneyCardAccent, { bar: string; tag: string }> = {
  teal: { bar: "bg-teal-500", tag: "bg-teal-50 text-teal-700" },
  emerald: { bar: "bg-emerald-500", tag: "bg-emerald-50 text-emerald-700" },
  amber: { bar: "bg-amber-500", tag: "bg-amber-50 text-amber-800" },
  sky: { bar: "bg-sky-500", tag: "bg-sky-50 text-sky-700" },
  indigo: { bar: "bg-indigo-500", tag: "bg-indigo-50 text-indigo-700" },
  rose: { bar: "bg-rose-500", tag: "bg-rose-50 text-rose-700" },
  slate: { bar: "bg-slate-400", tag: "bg-slate-100 text-slate-600" },
};

type Props = {
  label: string;
  value: string;
  /** Short explanatory sub-line, reference-design style. */
  hint?: string;
  accent?: MoneyCardAccent;
  /** Small pill on the right of the label (e.g. `Current`). */
  tag?: string;
  /** Delta chip / direction indicator. */
  delta?: ReactNode;
  /**
   * Optional 0–100 bar under the value. Used for the gross-margin card, where
   * the percentage is objectively "n out of 100" — not a target we invented.
   */
  progress?: number | null;
  icon?: ReactNode;
  loading?: boolean;
  /** Emphasise as a headline card (larger value). */
  emphasise?: boolean;
};

export function MoneyCard({
  label,
  value,
  hint,
  accent = "teal",
  tag,
  delta,
  progress = null,
  icon,
  loading = false,
  emphasise = false,
}: Props) {
  const styles = accentStyles[accent];

  return (
    <article className="relative overflow-hidden rounded-xl border border-gulio-border bg-gulio-card p-4 shadow-sm transition hover:shadow-md sm:p-5">
      <span
        className={`absolute inset-y-0 left-0 w-1 ${styles.bar}`}
        aria-hidden
      />
      <div className="pl-1.5">
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
          <Skeleton className="mt-2 h-7 w-28 rounded-md" />
        ) : (
          <p
            className={`mt-1.5 font-bold tabular-nums tracking-tight text-gulio-text ${
              emphasise ? "text-2xl sm:text-[26px]" : "text-xl sm:text-2xl"
            }`}
          >
            {value}
          </p>
        )}

        {typeof progress === "number" && !loading ? (
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${styles.bar} transition-[width] duration-700 ease-out`}
              style={{
                width: `${Math.max(0, Math.min(100, progress))}%`,
              }}
            />
          </div>
        ) : null}

        {delta ? <div className="mt-2">{delta}</div> : null}

        {hint && !loading ? (
          <p className="mt-1.5 text-xs leading-snug text-gulio-muted">{hint}</p>
        ) : null}
      </div>
    </article>
  );
}
