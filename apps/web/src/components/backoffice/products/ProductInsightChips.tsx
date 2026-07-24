"use client";

import type { InsightChip } from "./product-insights";

const toneClass: Record<InsightChip["tone"], string> = {
  teal: "border-teal-200 bg-teal-50 text-teal-800",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
  rose: "border-rose-200 bg-rose-50 text-rose-800",
};

type Props = {
  chips: InsightChip[];
};

export function ProductInsightChips({ chips }: Props) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip.id}
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-transform duration-200 hover:-translate-y-0.5 ${toneClass[chip.tone]}`}
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}
