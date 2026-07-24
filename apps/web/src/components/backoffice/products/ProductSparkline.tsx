"use client";

import { useId } from "react";

type Props = {
  values: number[];
  /** Stroke / fill accent */
  color?: string;
  height?: number;
  className?: string;
  label?: string;
};

/** Lightweight SVG sparkline for 7-day units sold. */
export function ProductSparkline({
  values,
  color = "#0D9488",
  height = 56,
  className = "",
  label,
}: Props) {
  const gradId = useId().replace(/:/g, "");
  const w = 220;
  const h = height;
  const pad = 4;
  const max = Math.max(1, ...values);
  const min = 0;
  const span = max - min || 1;

  const points = values.map((v, i) => {
    const x =
      pad + (i / Math.max(1, values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return { x, y, v };
  });

  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;
  const total = values.reduce((a, b) => a + b, 0);

  return (
    <div className={className}>
      {label ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <p className="text-xs font-medium text-gulio-muted">{label}</p>
          <p className="text-xs font-semibold tabular-nums text-gulio-text">
            {total} units · 7d
          </p>
        </div>
      ) : null}
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-14 w-full overflow-visible"
        role="img"
        aria-label={label ?? "Trend"}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#${gradId})`} />
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="drop-shadow-sm transition-all duration-500"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === points.length - 1 ? 3.5 : 2}
            fill={i === points.length - 1 ? color : "#fff"}
            stroke={color}
            strokeWidth="1.5"
          />
        ))}
      </svg>
      <div className="mt-0.5 flex justify-between text-[10px] text-gulio-muted">
        <span>6d ago</span>
        <span>Today</span>
      </div>
    </div>
  );
}
