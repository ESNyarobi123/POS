"use client";

import type { ReactNode } from "react";

/**
 * Label-above field wrapper used across the purchasing workspace.
 *
 * HeroUI's `labelPlacement="inside"` renders the label at the same baseline as
 * the placeholder, which reads as overlapping text in dense back-office forms.
 * Rendering the label as its own line removes that entirely and keeps every
 * control on a predictable, scannable grid.
 */
export function Field({
  label,
  hint,
  required,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gulio-muted"
      >
        {label}
        {required ? (
          <span aria-hidden className="text-rose-500">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[11px] text-gulio-muted">{hint}</p> : null}
    </div>
  );
}

/** Shared classNames so every purchasing control has identical chrome. */
export const fieldClassNames = {
  inputWrapper:
    "min-h-10 rounded-lg border border-gulio-border bg-white shadow-none data-[hover=true]:border-slate-300 group-data-[focus=true]:border-teal-500",
  input: "text-sm text-gulio-text",
  label: "hidden",
} as const;

export const selectClassNames = {
  trigger:
    "min-h-10 h-10 rounded-lg border border-gulio-border bg-white px-3 py-0 shadow-none data-[hover=true]:border-slate-300",
  value: "text-sm text-gulio-text",
  popoverContent: "rounded-xl border border-gulio-border",
  label: "hidden",
} as const;
