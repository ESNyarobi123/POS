"use client";

import type { StockHealth, VelocityBand } from "./product-insights";

type Props = {
  categoryShare: number;
  categoryName: string;
  velocity: VelocityBand;
  stockHealth: StockHealth;
  units7d: number;
};

const velocityMeta: Record<
  VelocityBand,
  { label: string; pct: number; color: string }
> = {
  fast: { label: "Fast", pct: 88, color: "#16A34A" },
  medium: { label: "Medium", pct: 55, color: "#0D9488" },
  slow: { label: "Slow", pct: 28, color: "#64748B" },
};

const healthMeta: Record<
  StockHealth,
  { label: string; pct: number; color: string }
> = {
  healthy: { label: "Healthy", pct: 86, color: "#16A34A" },
  watch: { label: "Watch", pct: 48, color: "#F59E0B" },
  low: { label: "At risk", pct: 22, color: "#DC2626" },
  unknown: { label: "Unknown", pct: 0, color: "#94A3B8" },
};

function Ring({
  pct,
  color,
  label,
  hint,
}: {
  pct: number;
  color: string;
  label: string;
  hint: string;
}) {
  const size = 72;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const offset = c - (clamped / 100) * c;

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold tabular-nums text-gulio-text">
            {clamped}%
          </span>
        </div>
      </div>
      <p className="mt-2 text-xs font-semibold text-gulio-text">{label}</p>
      <p className="text-[10px] text-gulio-muted">{hint}</p>
    </div>
  );
}

function Bar({
  label,
  valueLabel,
  pct,
  color,
}: {
  label: string;
  valueLabel: string;
  pct: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-gulio-muted">{label}</span>
        <span className="font-semibold tabular-nums text-gulio-text">
          {valueLabel}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${Math.max(4, Math.min(100, pct))}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

export function ProductPerformance({
  categoryShare,
  categoryName,
  velocity,
  stockHealth: health,
  units7d,
}: Props) {
  const vel = velocityMeta[velocity];
  const st = healthMeta[health];

  return (
    <div className="space-y-4 rounded-2xl border border-gulio-border bg-white/90 p-3.5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gulio-muted">
        Performance
      </p>
      <div className="flex justify-around gap-2">
        <Ring
          pct={categoryShare}
          color="#0D9488"
          label="Category"
          hint={categoryName === "—" ? "Share of catalog" : `of ${categoryName}`}
        />
        <Ring
          pct={vel.pct}
          color={vel.color}
          label="Velocity"
          hint={`${vel.label} · ${units7d}/7d`}
        />
        <Ring
          pct={st.pct || 8}
          color={st.color}
          label="Stock"
          hint={st.label}
        />
      </div>
      <div className="space-y-2.5 border-t border-gulio-border/70 pt-3">
        <Bar
          label="Category share"
          valueLabel={`${categoryShare}%`}
          pct={categoryShare}
          color="#0D9488"
        />
        <Bar
          label="Sell-through pace"
          valueLabel={vel.label}
          pct={vel.pct}
          color={vel.color}
        />
        <Bar
          label="Stock health"
          valueLabel={st.label}
          pct={st.pct || 8}
          color={st.color}
        />
      </div>
    </div>
  );
}
