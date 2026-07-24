import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  accent?: "teal" | "indigo" | "amber" | "rose" | "slate" | "emerald" | "purple";
  loading?: boolean;
};

const accentStyles: Record<
  NonNullable<StatCardProps["accent"]>,
  { tile: string; bar: string }
> = {
  teal: { tile: "bg-teal-50 text-teal-700", bar: "bg-teal-500" },
  indigo: { tile: "bg-indigo-50 text-indigo-700", bar: "bg-indigo-500" },
  amber: { tile: "bg-amber-50 text-amber-700", bar: "bg-amber-500" },
  rose: { tile: "bg-rose-50 text-rose-700", bar: "bg-rose-500" },
  slate: { tile: "bg-slate-100 text-slate-700", bar: "bg-slate-500" },
  emerald: { tile: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500" },
  purple: { tile: "bg-purple-50 text-purple-700", bar: "bg-purple-500" },
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = "teal",
  loading = false,
}: StatCardProps) {
  const styles = accentStyles[accent];

  return (
    <div className="relative overflow-hidden rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
      <div className={`absolute inset-y-0 left-0 w-1 ${styles.bar}`} aria-hidden />
      <div className="flex items-start justify-between gap-3 pl-1">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gulio-muted">{label}</p>
          {loading ? (
            <div className="mt-3 h-8 w-28 animate-pulse rounded-md bg-gulio-bg" />
          ) : (
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-gulio-text">
              {value}
            </p>
          )}
          {hint && !loading ? (
            <p className="mt-1.5 text-xs text-gulio-muted">{hint}</p>
          ) : null}
        </div>
        {icon ? (
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${styles.tile}`}
          >
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
