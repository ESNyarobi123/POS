"use client";

import { formatMoney } from "@/lib/money";
import type { MixSlice } from "./types";

type Props = {
  slices: MixSlice[];
  /** When true, values are money major units; otherwise relative shares. */
  asMoney?: boolean;
  fromLive?: boolean;
};

export function PaymentMixDonut({
  slices,
  asMoney = true,
  fromLive,
}: Props) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const size = 160;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  let cursor = 0;
  const arcs = slices.map((s) => {
    const frac = s.value / total;
    const len = frac * c;
    const dashoffset = c * 0.25 - cursor;
    cursor += len;
    return { ...s, frac, len, dashoffset };
  });

  return (
    <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="font-semibold text-gulio-text">Payment mix</h2>
        <p className="mt-0.5 text-xs text-gulio-muted">
          {fromLive ? "Tender from completed sales" : "Demo mix · Cash / MM / Card"}
        </p>
      </div>

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="#F1F5F9"
              strokeWidth={stroke}
            />
            {arcs.map((a) => (
              <circle
                key={a.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={a.color}
                strokeWidth={stroke}
                strokeDasharray={`${a.len} ${c - a.len}`}
                strokeDashoffset={a.dashoffset}
                className="transition-all duration-700 ease-out"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center px-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-gulio-muted">
              Mix
            </span>
            <span className="text-center text-sm font-bold tabular-nums text-gulio-text">
              {asMoney && fromLive ? formatMoney(total) : `${slices.length} ways`}
            </span>
          </div>
        </div>

        <ul className="w-full min-w-0 space-y-2.5">
          {arcs.map((a) => (
            <li key={a.key} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: a.color }}
                  aria-hidden
                />
                <span className="truncate text-sm text-gulio-text">{a.label}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-gulio-text">
                {Math.round(a.frac * 100)}%
                {asMoney && fromLive ? (
                  <span className="ml-2 text-xs font-normal text-gulio-muted">
                    {formatMoney(a.value)}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
