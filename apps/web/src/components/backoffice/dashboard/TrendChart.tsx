"use client";

import { useId, type ReactNode } from "react";
import type { DashboardTrendPointDto } from "@gulio/contracts";
import { DeltaChip } from "./DeltaChip";
import { directionOf, toChartNumber } from "./format";
import { formatMoney } from "@/lib/money";

type Props = {
  points: DashboardTrendPointDto[];
  /** `hour` | `day` | `month` — used for the axis caption. */
  bucket: string;
  rangeLabel: string;
  /** Authoritative totals from the API (decimal strings). */
  revenue: string;
  grossProfit: string;
  revenueChangePct: number | null;
  loading?: boolean;
};

const W = 760;
const H = 250;
const PAD_X = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 30;

function xAt(index: number, count: number): number {
  if (count <= 1) return PAD_X + (W - PAD_X * 2) / 2;
  return PAD_X + (index / (count - 1)) * (W - PAD_X * 2);
}

function yAt(value: number, max: number): number {
  const span = Math.max(max, 1);
  return PAD_TOP + (1 - value / span) * (H - PAD_TOP - PAD_BOTTOM);
}

function linePath(values: number[], max: number): string {
  return values
    .map((v, i) => {
      const cmd = i === 0 ? "M" : "L";
      return `${cmd} ${xAt(i, values.length).toFixed(1)} ${yAt(v, max).toFixed(1)}`;
    })
    .join(" ");
}

/** Momentum = second half of the range vs first half (real, transparent maths). */
function momentumPct(points: DashboardTrendPointDto[]): number | null {
  if (points.length < 4) return null;
  const mid = Math.floor(points.length / 2);
  const first = points
    .slice(0, mid)
    .reduce((sum, p) => sum + toChartNumber(p.revenue), 0);
  const second = points
    .slice(mid)
    .reduce((sum, p) => sum + toChartNumber(p.revenue), 0);
  if (first <= 0) return null;
  return ((second - first) / first) * 100;
}

function PanelShell({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
      {children}
    </section>
  );
}

export function TrendChart({
  points,
  bucket,
  rangeLabel,
  revenue,
  grossProfit,
  revenueChangePct,
  loading = false,
}: Props) {
  const gradientId = useId().replace(/[:]/g, "");

  const header = (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold text-gulio-text">Revenue trend</h2>
        <p className="mt-0.5 text-xs text-gulio-muted">
          Per {bucket} · {rangeLabel}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs text-gulio-muted">Period revenue</p>
        <div className="mt-0.5 flex items-center justify-end gap-2">
          <p className="text-lg font-bold tabular-nums text-gulio-text">
            {formatMoney(revenue)}
          </p>
        </div>
        <div className="mt-1 flex justify-end">
          {points.length > 0 ? (
            <DeltaChip
              value={revenueChangePct}
              caption="vs previous period"
              srLabel="Revenue change"
            />
          ) : null}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <PanelShell>
        {header}
        <div className="h-56 w-full animate-pulse rounded-lg bg-gulio-bg" />
      </PanelShell>
    );
  }

  if (points.length === 0) {
    return (
      <PanelShell>
        {header}
        <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-dashed border-gulio-border bg-gulio-bg/40 px-6 text-center">
          <p className="text-sm font-medium text-gulio-text">
            No sales in this period
          </p>
          <p className="mt-1 max-w-sm text-xs text-gulio-muted">
            The trend draws once completed sales land in the selected range.
          </p>
        </div>
      </PanelShell>
    );
  }

  const revenues = points.map((p) => toChartNumber(p.revenue));
  const profits = points.map((p) => toChartNumber(p.grossProfit));
  const max = Math.max(...revenues, ...profits, 1);

  const revenueLine = linePath(revenues, max);
  const profitLine = linePath(profits, max);
  const baseline = H - PAD_BOTTOM;
  const area = `${revenueLine} L ${xAt(points.length - 1, points.length).toFixed(1)} ${baseline} L ${xAt(0, points.length).toFixed(1)} ${baseline} Z`;

  const peakIndex = revenues.reduce(
    (best, v, i) => (v > revenues[best] ? i : best),
    0,
  );

  const midLabelIndex = Math.floor((points.length - 1) / 2);
  const labelIndexes = Array.from(
    new Set([0, midLabelIndex, points.length - 1].filter((i) => i >= 0)),
  );

  const momentum = momentumPct(points);
  const momentumDir = directionOf(momentum);

  return (
    <PanelShell>
      {header}

      <div className="mb-2 flex flex-wrap items-center gap-4">
        <span className="inline-flex items-center gap-1.5 text-xs text-gulio-muted">
          <span className="h-2 w-4 rounded-full bg-teal-500" aria-hidden />
          Revenue
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-gulio-muted">
          <span className="h-2 w-4 rounded-full bg-emerald-500" aria-hidden />
          Gross profit
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-56 w-full"
        role="img"
        aria-label={`Revenue and gross profit trend, ${rangeLabel}. Period revenue ${formatMoney(revenue)}, gross profit ${formatMoney(grossProfit)}.`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0D9488" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#0D9488" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD_TOP + t * (H - PAD_TOP - PAD_BOTTOM);
          return (
            <line
              key={t}
              x1={PAD_X}
              x2={W - PAD_X}
              y1={y}
              y2={y}
              stroke="#E2E8F0"
              strokeDasharray={t === 1 ? undefined : "4 4"}
            />
          );
        })}

        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={revenueLine}
          fill="none"
          stroke="#0D9488"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={profitLine}
          fill="none"
          stroke="#16A34A"
          strokeWidth="2"
          strokeDasharray="5 4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {revenues.map((v, i) => (
          <circle
            key={points[i].key}
            cx={xAt(i, points.length)}
            cy={yAt(v, max)}
            r={i === peakIndex ? 4 : 2.5}
            fill="#fff"
            stroke={i === peakIndex ? "#0D9488" : "#0D9488"}
            strokeWidth="2"
          />
        ))}
      </svg>

      <div className="mt-1 flex justify-between text-[10px] text-gulio-muted">
        {labelIndexes.map((i) => (
          <span key={points[i].key}>{points[i].label}</span>
        ))}
      </div>

      <div className="mt-4 grid gap-3 border-t border-gulio-border pt-3 sm:grid-cols-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gulio-muted">
            Gross profit in range
          </p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-gulio-text">
            {formatMoney(grossProfit)}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gulio-muted">
            Best {bucket}
          </p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-gulio-text">
            {points[peakIndex]?.label} ·{" "}
            {formatMoney(points[peakIndex]?.revenue ?? "0")}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gulio-muted">
            Momentum (2nd half vs 1st)
          </p>
          <div className="mt-0.5">
            {momentum === null ? (
              <span className="text-sm text-gulio-muted">
                Not enough data points
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <DeltaChip
                  value={momentum}
                  direction={momentumDir}
                  srLabel="Trend momentum"
                />
                <span className="text-xs text-gulio-muted">
                  revenue moving {momentumDir === "up" ? "up" : momentumDir === "down" ? "down" : "flat"}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
    </PanelShell>
  );
}
