"use client";

import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import type { DashboardRangeKey } from "@gulio/contracts";

type PresetKey = Exclude<DashboardRangeKey, "custom">;

const PILLS: Array<{ key: PresetKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "this_week", label: "This week" },
  { key: "this_month", label: "This month" },
  { key: "this_year", label: "This year" },
  { key: "all", label: "All time" },
];

type Props = {
  value: DashboardRangeKey;
  onChange: (key: DashboardRangeKey) => void;
  customFrom: string;
  customTo: string;
  onApplyCustom: (from: string, to: string) => void;
  /** Disable the custom Apply while a request is in flight. */
  busy?: boolean;
};

const fieldClass =
  "w-full rounded-lg border border-gulio-border bg-white px-2.5 py-1.5 text-xs text-gulio-text outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

export function RangeSwitcher({
  value,
  onChange,
  customFrom,
  customTo,
  onApplyCustom,
  busy = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(customFrom);
  const [to, setTo] = useState(customTo);

  // Keep the popover inputs in sync when the applied range changes externally.
  useEffect(() => setFrom(customFrom), [customFrom]);
  useEffect(() => setTo(customTo), [customTo]);

  const invalid = Boolean(from && to && from > to);
  const canApply = Boolean(from && to) && !invalid && !busy;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="inline-flex flex-wrap rounded-xl border border-gulio-border bg-gulio-card p-1 shadow-sm"
        role="group"
        aria-label="Dashboard date range"
      >
        {PILLS.map((pill) => {
          const active = value === pill.key;
          return (
            <button
              key={pill.key}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(pill.key)}
              className={`min-h-9 rounded-lg px-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 ${
                active
                  ? "bg-gulio-primary text-white shadow-sm"
                  : "text-gulio-muted hover:bg-gulio-bg hover:text-gulio-text"
              }`}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      <Popover
        placement="bottom-end"
        isOpen={open}
        onOpenChange={setOpen}
        showArrow
      >
        <PopoverTrigger>
          <button
            type="button"
            aria-pressed={value === "custom"}
            aria-haspopup="dialog"
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3.5 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 ${
              value === "custom"
                ? "border-teal-200 bg-teal-50 text-teal-800"
                : "border-gulio-border bg-gulio-card text-gulio-text hover:bg-gulio-bg"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              aria-hidden
            >
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
            </svg>
            Custom
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-4">
          <p className="text-sm font-semibold text-gulio-text">Custom range</p>
          <p className="mt-0.5 text-xs text-gulio-muted">
            Pick a start and end date, then apply.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gulio-muted">
                From
              </span>
              <input
                type="date"
                className={fieldClass}
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gulio-muted">
                To
              </span>
              <input
                type="date"
                className={fieldClass}
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </div>
          {invalid ? (
            <p className="mt-2 text-xs font-medium text-rose-600" role="alert">
              Start date must be on or before the end date.
            </p>
          ) : null}
          <button
            type="button"
            disabled={!canApply}
            onClick={() => {
              if (!canApply) return;
              onApplyCustom(from, to);
              setOpen(false);
            }}
            className="mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-gulio-primary px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gulio-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Applying…" : "Apply range"}
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
