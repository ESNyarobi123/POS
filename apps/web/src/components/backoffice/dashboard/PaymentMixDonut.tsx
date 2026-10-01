"use client";

import type { DashboardPaymentSliceDto } from "@gulio/contracts";
import { CATEGORY_COLORS, PAYMENT_COLORS, formatPct } from "./format";
import { formatMoney } from "@/lib/money";

type Props = {
  slices: DashboardPaymentSliceDto[];
  loading?: boolean;
};

const SIZE = 168;
const STROKE = 24;

export function PaymentMixDonut({ slices, loading = false }: Props) {
  const title = (
    <div>
      <h2 className="font-semibold text-gulio-text">Payment mix</h2>
      <p className="mt-0.5 text-xs text-gulio-muted">
        {slices.length > 0
          ? "Tender composition for the selected range"
          : "No payments recorded in this range"}
      </p>
    </div>
  );

  if (loading) {
    return (
      <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
        {title}
        <div className="mt-4 h-44 animate-pulse rounded-lg bg-gulio-bg" />
      </section>
    );
  }

  if (slices.length === 0) {
    return (
      <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
        {title}
        <p className="mt-4 rounded-lg border border-dashed border-gulio-border bg-gulio-bg/40 px-3 py-8 text-center text-sm text-gulio-muted">
          Complete a sale to see the cash / mobile money / card split.
        </p>
      </section>
    );
  }

  const totalPct = slices.reduce((sum, s) => sum + Math.max(0, s.pct), 0) || 1;
  const r = (SIZE - STROKE) / 2;
  const c = 2 * Math.PI * r;

  const arcs = slices.map((s, i) => {
    const frac = Math.max(0, s.pct) / totalPct;
    return {
      ...s,
      frac,
      color: PAYMENT_COLORS[s.method] ?? CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    };
  });

  let cursor = 0;
  const withOffset = arcs.map((a) => {
    const len = a.frac * c;
    const dashoffset = c * 0.25 - cursor;
    cursor += len;
    return { ...a, len, dashoffset };
  });

  const top = withOffset.reduce((best, s) => (s.pct > best.pct ? s : best), withOffset[0]);

  return (
    <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
      {title}

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg
            width={SIZE}
            height={SIZE}
            className="-rotate-90"
            role="img"
            aria-label={`Payment mix: ${withOffset.map((a) => `${a.label} ${formatPct(a.pct)}`).join(", ")}`}
          >
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={r}
              fill="none"
              stroke="#F1F5F9"
              strokeWidth={STROKE}
            />
            {withOffset.map((a) => (
              <circle
                key={a.method}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={r}
                fill="none"
                stroke={a.color}
                strokeWidth={STROKE}
                strokeDasharray={`${a.len} ${c - a.len}`}
                strokeDashoffset={a.dashoffset}
                className="transition-all duration-700 ease-out"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
            <span className="text-[10px] font-medium uppercase tracking-wide text-gulio-muted">
              Top method
            </span>
            <span className="text-sm font-bold text-gulio-text">{top.label}</span>
            <span className="text-lg font-bold tabular-nums text-teal-700">
              {formatPct(top.pct)}
            </span>
          </div>
        </div>

        <ul className="w-full min-w-0 space-y-2.5">
          {withOffset.map((a) => (
            <li key={a.method} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: a.color }}
                  aria-hidden
                />
                <span className="truncate text-sm text-gulio-text">{a.label}</span>
              </span>
              <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-gulio-text">
                {formatPct(a.pct)}
                <span className="ml-2 text-xs font-normal text-gulio-muted">
                  {formatMoney(a.amount)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
