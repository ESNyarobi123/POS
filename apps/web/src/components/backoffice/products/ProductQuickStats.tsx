"use client";

import { formatMoney } from "@/lib/money";

type Props = {
  stock: number | null;
  sellPrice: string | null;
  costPrice: string | null;
  margin: number | null;
  costEstimated: boolean;
};

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-gulio-border/80 bg-white/80 px-3 py-2.5 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gulio-muted">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold tabular-nums text-gulio-text">{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-gulio-muted">{hint}</p> : null}
    </div>
  );
}

export function ProductQuickStats({
  stock,
  sellPrice,
  costPrice,
  margin,
  costEstimated,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat
        label="Stock"
        value={stock === null ? "—" : String(stock)}
        hint={stock === null ? "No balance yet" : "Available hint"}
      />
      <Stat
        label="Sell"
        value={sellPrice ? formatMoney(sellPrice) : "—"}
      />
      <Stat
        label="Cost"
        value={costPrice ? formatMoney(costPrice) : "—"}
        hint={costEstimated && costPrice ? "Estimated" : undefined}
      />
      <Stat
        label="Margin"
        value={margin === null ? "—" : `${margin}%`}
        hint={margin !== null ? "Est. gross" : undefined}
      />
    </div>
  );
}
