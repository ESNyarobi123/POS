"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { CustomerDto, CustomerListResponse } from "@gulio/contracts";
import { ApiError, apiFetch } from "@/lib/api";
import type { PosCartCustomer } from "@/lib/pos-cart";

type Props = {
  selected: PosCartCustomer | null;
  onSelect: (customer: PosCartCustomer) => void;
  onClear: () => void;
  onClose: () => void;
};

export function PosCustomerModal({
  selected,
  onSelect,
  onClear,
  onClose,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<CustomerDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      const qs = q.trim()
        ? `?q=${encodeURIComponent(q.trim())}&limit=20`
        : "?limit=20";
      void apiFetch<CustomerListResponse>(`/customers${qs}`)
        .then((res) => {
          if (!cancelled) setItems(res.items);
        })
        .catch((err) => {
          if (!cancelled) {
            setError(
              err instanceof ApiError
                ? err.message
                : "Failed to load customers",
            );
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [q]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-modal-title"
    >
      <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-gulio-border bg-gulio-card shadow-xl">
        <div className="border-b border-gulio-border px-5 py-4">
          <h3
            id="customer-modal-title"
            className="text-lg font-semibold text-gulio-text"
          >
            Customer
          </h3>
          <p className="mt-1 text-sm text-gulio-muted">
            Search and attach a customer to this sale
          </p>
        </div>

        <form onSubmit={onSubmit} className="border-b border-gulio-border px-4 py-3">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name or phone…"
            className="w-full rounded-xl border border-gulio-border px-3 py-2.5 text-sm outline-none ring-gulio-primary focus:ring-2"
            autoComplete="off"
          />
        </form>

        {selected && (
          <div className="flex items-center justify-between gap-2 border-b border-gulio-border bg-teal-50/60 px-4 py-2.5 text-sm">
            <span className="truncate text-gulio-text">
              Selected: <strong>{selected.name}</strong>
              {selected.phone ? ` · ${selected.phone}` : ""}
            </span>
            <button
              type="button"
              onClick={onClear}
              className="shrink-0 text-xs font-medium text-gulio-error hover:underline"
            >
              Remove
            </button>
          </div>
        )}

        <ul className="flex-1 space-y-1.5 overflow-auto px-4 py-3">
          {loading && (
            <li className="py-6 text-center text-sm text-gulio-muted">
              Searching…
            </li>
          )}
          {!loading && error && (
            <li className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-gulio-error">
              {error}
            </li>
          )}
          {!loading && !error && items.length === 0 && (
            <li className="py-6 text-center text-sm text-gulio-muted">
              No customers found
            </li>
          )}
          {!loading &&
            items.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() =>
                    onSelect({
                      id: c.id,
                      name: c.name,
                      phone: c.phone,
                    })
                  }
                  className="flex min-h-12 w-full flex-col items-start rounded-xl border border-gulio-border px-4 py-2.5 text-left transition hover:border-gulio-primary hover:bg-teal-50 active:scale-[0.99]"
                >
                  <span className="text-sm font-semibold text-gulio-text">
                    {c.name}
                  </span>
                  <span className="text-xs text-gulio-muted">
                    {c.phone ?? "No phone"}
                  </span>
                </button>
              </li>
            ))}
        </ul>

        <div className="border-t border-gulio-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 w-full items-center justify-center rounded-xl border border-gulio-border text-sm font-medium text-gulio-muted transition hover:bg-gulio-bg hover:text-gulio-text"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
