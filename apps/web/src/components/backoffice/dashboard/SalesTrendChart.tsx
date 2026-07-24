"use client";

import { formatMoney } from "@/lib/money";
import type { TrendPoint } from "./types";

type Props = {
  points: TrendPoint[];
  fromLive?: boolean;
};

export function SalesTrendChart({ points, fromLive }: Props) {
  const w = 640;
  const h = 220;
  const padX = 12;
  const padY = 20;
  const max = Math.max(...points.map((p) => p.amountMajor), 1);
  const min = 0;
  const span = Math.max(max - min, 1);

  const coords = points.map((p, i) => {
    const x =
      padX +
      (points.length === 1
        ? (w - padX * 2) / 2
        : (i / (points.length - 1)) * (w - padX * 2));
    const y = padY + (1 - (p.amountMajor - min) / span) * (h - padY * 2);
    return { x, y, ...p };
  });

  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");

  const area = `${line} L ${coords[coords.length - 1]?.x.toFixed(1) ?? padX} ${(h - padY).toFixed(1)} L ${coords[0]?.x.toFixed(1) ?? padX} ${(h - padY).toFixed(1)} Z`;

  const total = points.reduce((a, p) => a + p.amountMajor, 0);
  const peak = points.reduce(
    (best, p) => (p.amountMajor > best.amountMajor ? p : best),
    points[0],
  );

  return (
    <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gulio-text">Sales trend</h2>
          <p className="mt-0.5 text-xs text-gulio-muted">
            {fromLive ? "From completed POS sales" : "Demo trend · live when sales sync"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gulio-muted">Period total</p>
          <p className="text-lg font-bold tabular-nums text-gulio-text">
            {formatMoney(total)}
          </p>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="h-48 w-full overflow-visible"
          role="img"
          aria-label="Sales trend chart"
        >
          <defs>
            <linearGradient id="gulioSalesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0D9488" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#0D9488" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((t) => {
            const y = padY + t * (h - padY * 2);
            return (
              <line
                key={t}
                x1={padX}
                x2={w - padX}
                y1={y}
                y2={y}
                stroke="#E2E8F0"
                strokeDasharray="4 4"
              />
            );
          })}
          <path d={area} fill="url(#gulioSalesFill)" />
          <path
            d={line}
            fill="none"
            stroke="#0D9488"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {coords.map((c) => (
            <circle
              key={c.key}
              cx={c.x}
              cy={c.y}
              r={c.key === peak?.key ? 4.5 : 3}
              fill="#fff"
              stroke={c.key === peak?.key ? "#16A34A" : "#0D9488"}
              strokeWidth="2"
            />
          ))}
        </svg>
        <div className="mt-1 flex justify-between px-0.5 text-[10px] text-gulio-muted">
          <span>{points[0]?.label}</span>
          <span className="hidden sm:inline">
            {points[Math.floor(points.length / 2)]?.label}
          </span>
          <span>{points[points.length - 1]?.label}</span>
        </div>
      </div>
    </section>
  );
}
