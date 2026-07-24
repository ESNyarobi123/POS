"use client";

import type { MixSlice } from "./types";

type Props = {
  slices: MixSlice[];
  fromLive?: boolean;
};

export function CategoryBars({ slices, fromLive }: Props) {
  const max = Math.max(...slices.map((s) => s.value), 1);
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;

  return (
    <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="font-semibold text-gulio-text">Category mix</h2>
        <p className="mt-0.5 text-xs text-gulio-muted">
          {fromLive
            ? "Revenue by electronics category"
            : "Demo mix · Phones / Accessories / Laptops / Audio"}
        </p>
      </div>

      <ul className="space-y-3.5">
        {slices.map((s) => {
          const pct = Math.round((s.value / total) * 100);
          const widthPct = Math.max(6, Math.round((s.value / max) * 100));
          return (
            <li key={s.key}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gulio-text">
                  {s.label}
                </span>
                <span className="text-sm font-semibold tabular-nums text-gulio-muted">
                  {pct}%
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{ width: `${widthPct}%`, backgroundColor: s.color }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
