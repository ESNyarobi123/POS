"use client";

import { FormEvent, RefObject } from "react";

type Props = {
  searchRef: RefObject<HTMLInputElement | null>;
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  disabled?: boolean;
  categories: string[];
  categoryFilter: string;
  onCategoryChange: (category: string) => void;
  error: string | null;
};

function BarcodeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 6v12M7 7v10M10 6v12M13 8v8M16 6v12M20 6v12" />
    </svg>
  );
}

export function PosSearchBar({
  searchRef,
  query,
  onQueryChange,
  onSubmit,
  disabled,
  categories,
  categoryFilter,
  onCategoryChange,
  error,
}: Props) {
  return (
    <div className="border-b border-gulio-border bg-gulio-card px-3 py-3">
      <form onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="pos-search">
          Search products
        </label>
        <div className="relative">
          <BarcodeIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gulio-muted" />
          <input
            ref={searchRef}
            id="pos-search"
            type="search"
            data-pos-search="true"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Scan barcode or search (F2)…"
            className="min-h-touch h-12 w-full rounded-gulio border border-gulio-border bg-white pl-11 pr-4 text-base shadow-sm outline-none ring-gulio-primary transition placeholder:text-gulio-muted/80 focus:border-gulio-primary focus:ring-2"
            autoFocus
            disabled={disabled}
          />
        </div>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {categories.map((cat) => {
          const selected = categoryFilter === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
              className={`min-h-9 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                selected
                  ? "bg-gulio-primary text-white shadow-sm"
                  : "border border-gulio-border bg-white text-gulio-muted hover:border-gulio-primary hover:text-gulio-primary"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-gulio-error"
        >
          {error}
        </div>
      )}
    </div>
  );
}
