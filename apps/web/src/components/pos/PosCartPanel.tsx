"use client";

import { useState } from "react";
import {
  formatMoney,
  lineTotal,
  payableAfterDiscount,
  type DecimalString,
} from "@/lib/money";
import type {
  PendingPaymentMethod,
  PosCartCustomer,
  PosCartLine,
} from "@/lib/pos-cart";

type Props = {
  cart: PosCartLine[];
  total: number;
  online: boolean;
  customer: PosCartCustomer | null;
  discountAmount: DecimalString;
  heldCount: number;
  onClear: () => void;
  onRemove: (index: number) => void;
  onQtyChange: (index: number, quantity: number) => void;
  onPay: (method: PendingPaymentMethod) => void;
  onOpenCustomer: () => void;
  onOpenDiscount: () => void;
  onOpenHeld: () => void;
  onClearCustomer: () => void;
  onClearDiscount: () => void;
};

function CartEmptyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="8" y="12" width="32" height="24" rx="3" />
      <path d="M16 20h16M16 26h10" />
      <path d="M20 8v4M28 8v4" />
    </svg>
  );
}

function CartThumb({
  imageUrl,
  name,
}: {
  imageUrl?: string | null;
  name: string;
}) {
  const [broken, setBroken] = useState(false);
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  if (!imageUrl || broken) {
    return (
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-50 to-sky-50 text-[11px] font-bold text-teal-700 ring-1 ring-inset ring-gulio-border"
        aria-hidden
      >
        {initials || "?"}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-inset ring-gulio-border"
    />
  );
}

export function PosCartPanel({
  cart,
  total,
  online,
  customer,
  discountAmount,
  heldCount,
  onClear,
  onRemove,
  onQtyChange,
  onPay,
  onOpenCustomer,
  onOpenDiscount,
  onOpenHeld,
  onClearCustomer,
  onClearDiscount,
}: Props) {
  const itemCount = cart.reduce((n, l) => n + l.quantity, 0);
  const discountN = Number(discountAmount) || 0;
  const payable = payableAfterDiscount(total, discountAmount);

  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-l border-gulio-border bg-gulio-card xl:w-[400px]">
      <div className="flex items-center justify-between border-b border-gulio-border px-3.5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gulio-text">Cart</h2>
          <span className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-gulio-primary px-2 text-xs font-semibold text-white tabular-nums">
            {itemCount}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenHeld}
            className="min-h-8 rounded-lg px-2 text-xs font-medium text-gulio-muted transition hover:bg-gulio-bg hover:text-gulio-text"
          >
            Held sales{heldCount > 0 ? ` (${heldCount})` : ""}
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={cart.length === 0 && !customer && discountN <= 0}
            className="min-h-8 rounded-lg px-2 text-xs font-medium text-gulio-muted transition hover:bg-red-50 hover:text-gulio-error disabled:pointer-events-none disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </div>

      {(customer || discountN > 0) && (
        <div className="flex flex-wrap gap-1.5 border-b border-gulio-border px-3 py-2">
          {customer ? (
            <span className="inline-flex max-w-full items-center gap-0.5 rounded-full bg-teal-50 py-0.5 pl-2.5 pr-1 text-[11px] font-medium text-teal-800 ring-1 ring-inset ring-teal-200">
              <button
                type="button"
                onClick={onOpenCustomer}
                className="truncate hover:underline"
              >
                {customer.name}
              </button>
              <button
                type="button"
                aria-label="Remove customer"
                onClick={onClearCustomer}
                className="rounded-full px-1.5 hover:bg-teal-100"
              >
                ×
              </button>
            </span>
          ) : null}
          {discountN > 0 ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 py-0.5 pl-2.5 pr-1 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200 tabular-nums">
              <button
                type="button"
                onClick={onOpenDiscount}
                className="hover:underline"
              >
                −{formatMoney(discountAmount)}
              </button>
              <button
                type="button"
                aria-label="Clear discount"
                onClick={onClearDiscount}
                className="rounded-full px-1.5 hover:bg-amber-100"
              >
                ×
              </button>
            </span>
          ) : null}
        </div>
      )}

      <div className="flex-1 overflow-auto px-2.5 py-2">
        {cart.length === 0 ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center px-6 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gulio-bg text-gulio-muted">
              <CartEmptyIcon className="h-8 w-8" />
            </div>
            <p className="text-sm font-medium text-gulio-text">Cart is empty</p>
            <p className="mt-1 text-sm text-gulio-muted">
              Scan barcode or tap a product
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {cart.map((line, i) => (
              <li
                key={`${line.variantId}-${line.serialUnitIds?.[0] ?? i}`}
                className="rounded-xl border border-gulio-border bg-white p-2 shadow-sm transition hover:border-teal-200/80"
              >
                <div className="flex gap-2.5">
                  <CartThumb
                    imageUrl={line.imageUrl}
                    name={line.productName}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold leading-snug text-gulio-text">
                          {line.productName}
                        </p>
                        <p className="truncate text-[11px] text-gulio-muted">
                          {line.variantName}
                        </p>
                      </div>
                      <p className="shrink-0 text-[13px] font-bold tabular-nums text-gulio-text">
                        {formatMoney(
                          String(lineTotal(line.unitPrice, line.quantity)),
                        )}
                      </p>
                    </div>

                    {line.serialNumbers?.[0] ? (
                      <p className="mt-0.5 truncate font-mono text-[10px] text-amber-700">
                        IMEI {line.serialNumbers[0]}
                      </p>
                    ) : null}

                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      {line.requiresSerial ? (
                        <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                          ×1 · IMEI
                        </span>
                      ) : (
                        <div className="inline-flex items-center rounded-lg border border-gulio-border bg-gulio-bg">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            className="flex h-7 w-7 items-center justify-center text-sm font-medium text-gulio-text transition hover:bg-white"
                            onClick={() =>
                              onQtyChange(i, Math.max(1, line.quantity - 1))
                            }
                          >
                            −
                          </button>
                          <span className="min-w-[1.5rem] text-center text-xs font-semibold tabular-nums">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            className="flex h-7 w-7 items-center justify-center text-sm font-medium text-gulio-text transition hover:bg-white"
                            onClick={() => onQtyChange(i, line.quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        {!line.requiresSerial ? (
                          <span className="text-[10px] text-gulio-muted tabular-nums">
                            @ {formatMoney(line.unitPrice)}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          className="text-[11px] font-medium text-gulio-error hover:underline"
                          onClick={() => onRemove(i)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-gulio-border bg-gulio-bg/80 p-3.5">
        {discountN > 0 && (
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
            <span className="text-gulio-muted">Subtotal</span>
            <span className="tabular-nums text-gulio-muted">
              {formatMoney(String(total))}
            </span>
          </div>
        )}
        {discountN > 0 && (
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
            <span className="text-amber-700">Discount</span>
            <span className="tabular-nums text-amber-700">
              −{formatMoney(discountAmount)}
            </span>
          </div>
        )}
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-gulio-muted">Total</span>
          <span className="text-cart-total tabular-nums text-gulio-text">
            {formatMoney(String(payable))}
          </span>
        </div>

        <div className="grid grid-cols-[2fr_1fr_1fr] gap-2">
          <button
            type="button"
            onClick={() => onPay("cash")}
            disabled={cart.length === 0}
            className="min-h-touch rounded-gulio bg-gulio-success text-center text-sm font-bold tracking-wide text-white shadow-sm ring-2 ring-green-600/20 transition hover:bg-green-700 active:scale-[0.98] disabled:opacity-50"
          >
            CASH
          </button>
          <button
            type="button"
            onClick={() => onPay("mobile")}
            disabled={cart.length === 0}
            className="min-h-touch rounded-gulio border-2 border-gulio-primary bg-white text-center text-sm font-semibold text-gulio-primary transition hover:bg-teal-50 active:scale-[0.98] disabled:opacity-50"
          >
            MOBILE
          </button>
          <button
            type="button"
            onClick={() => onPay("split")}
            disabled={cart.length === 0}
            className="min-h-touch rounded-gulio border border-gulio-border bg-transparent text-center text-sm font-semibold text-gulio-muted transition hover:bg-white hover:text-gulio-text active:scale-[0.98] disabled:opacity-50"
          >
            SPLIT
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-gulio-muted">
          F9 Payment · {online ? "API connected" : "Browser offline"}
        </p>
      </div>
    </aside>
  );
}
