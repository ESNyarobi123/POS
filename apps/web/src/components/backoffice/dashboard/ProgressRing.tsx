"use client";

type Props = {
  pct: number;
  label: string;
  hint?: string;
  color?: string;
  size?: number;
  stroke?: number;
};

export function ProgressRing({
  pct,
  label,
  hint,
  color = "#0D9488",
  size = 112,
  stroke = 10,
}: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
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
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold tabular-nums text-gulio-text">
            {clamped}%
          </span>
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold text-gulio-text">{label}</p>
      {hint ? <p className="mt-0.5 max-w-[10rem] text-xs text-gulio-muted">{hint}</p> : null}
    </div>
  );
}
