"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  formatMoney,
  parseMoneyInput,
  type DecimalString,
} from "@/lib/money";

type Props = {
  subtotal: number;
  discountAmount: DecimalString;
  onApply: (amount: DecimalString) => void;
  onClear: () => void;
  onClose: () => void;
};

export function PosDiscountModal({
  subtotal,
  discountAmount,
  onApply,
  onClear,
  onClose,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState(() => {
    const n = Number(discountAmount);
    return Number.isFinite(n) && n > 0 ? String(Math.round(n)) : "";
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    const amount = parseMoneyInput(raw);
    const n = Number(amount);
    if (n < 0) {
      setError("Discount cannot be negative");
      return;
    }
    if (n > subtotal + 0.0001) {
      setError(`Discount cannot exceed ${formatMoney(String(subtotal))}`);
      return;
    }
    if (n === 0) {
      onClear();
      onClose();
      return;
    }
    onApply(amount);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="discount-modal-title"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-gulio-border bg-gulio-card shadow-xl">
        <div className="border-b border-gulio-border px-5 py-4">
          <h3
            id="discount-modal-title"
            className="text-lg font-semibold text-gulio-text"
          >
            Cart discount
          </h3>
          <p className="mt-1 text-sm text-gulio-muted">
            Subtotal {formatMoney(String(subtotal))} · amount in TZS
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 px-5 py-4">
          <div>
            <label
              htmlFor="pos-discount"
              className="mb-1 block text-sm font-medium text-gulio-text"
            >
              Discount amount
            </label>
            <input
              ref={inputRef}
              id="pos-discount"
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                setError(null);
              }}
              inputMode="decimal"
              placeholder="0"
              className="w-full rounded-xl border border-gulio-border px-3 py-3 text-lg tabular-nums outline-none ring-gulio-primary focus:ring-2"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-gulio-error"
            >
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onClear();
                onClose();
              }}
              className="min-h-11 flex-1 rounded-xl border border-gulio-border text-sm font-medium text-gulio-muted transition hover:bg-gulio-bg"
            >
              Clear
            </button>
            <button
              type="submit"
              className="min-h-11 flex-1 rounded-xl bg-gulio-primary text-sm font-semibold text-white transition hover:bg-gulio-primary-hover"
            >
              Apply
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
