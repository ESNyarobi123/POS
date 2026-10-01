"use client";

import {
  directionOf,
  formatDeltaPct,
  type TrendDirection,
} from "./format";

type Props = {
  /** Percent change vs the previous window. `null` renders a neutral chip. */
  value: number | null | undefined;
  /** Force a direction (e.g. for derived momentum). Defaults to `value`. */
  direction?: TrendDirection;
  /** Set false when a rise is bad (e.g. refunds, costs). Defaults to true. */
  goodWhenUp?: boolean;
  /** Short context, e.g. `vs previous period`. */
  caption?: string;
  /** Accessible description of what is being compared. */
  srLabel?: string;
};

const arrowPaths: Record<TrendDirection, string> = {
  up: "M7 14l4-4 3 2 4-4M14 8h4v4",
  down: "M7 8l4 4 3-2 4 4M14 14h4v-4",
  flat: "M7 12h10",
};

function toneClasses(direction: TrendDirection, goodWhenUp: boolean) {
  if (direction === "flat") {
    return "bg-slate-100 text-slate-600 ring-slate-200";
  }
  const good = direction === "up" ? goodWhenUp : !goodWhenUp;
  return good
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : "bg-rose-50 text-rose-700 ring-rose-200";
}

function srDirection(direction: TrendDirection, goodWhenUp: boolean): string {
  if (direction === "flat") return "no change";
  const good = direction === "up" ? goodWhenUp : !goodWhenUp;
  const verb = direction === "up" ? "up" : "down";
  return `${verb} (${good ? "favourable" : "unfavourable"})`;
}

export function DeltaChip({
  value,
  direction,
  goodWhenUp = true,
  caption,
  srLabel,
}: Props) {
  const dir = direction ?? directionOf(value);
  const classes = toneClasses(dir, goodWhenUp);
  const text = formatDeltaPct(value);

  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ring-1 ring-inset ${classes}`}
        aria-label={
          srLabel ? `${srLabel}: ${text} ${srDirection(dir, goodWhenUp)}` : undefined
        }
      >
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d={arrowPaths[dir]} />
        </svg>
        {text}
      </span>
      {caption ? (
        <span className="text-[11px] text-gulio-muted">{caption}</span>
      ) : null}
    </span>
  );
}
