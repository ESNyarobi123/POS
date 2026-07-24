"use client";

import { formatMoney, sumLines } from "@/lib/money";
import type { HeldSale } from "@/lib/pos-cart";

type Props = {
  heldSales: HeldSale[];
  onResume: (held: HeldSale) => void;
  onDiscard: (id: string) => void;
  onClose: () => void;
};

export function PosHeldSalesModal({
  heldSales,
  onResume,
  onDiscard,
  onClose,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="held-modal-title"
    >
      <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-gulio-border bg-gulio-card shadow-xl">
        <div className="border-b border-gulio-border px-5 py-4">
          <h3
            id="held-modal-title"
            className="text-lg font-semibold text-gulio-text"
          >
            Held sales
          </h3>
          <p className="mt-1 text-sm text-gulio-muted">
            Resume or discard a parked cart
          </p>
        </div>

        <ul className="flex-1 space-y-2 overflow-auto px-4 py-4">
          {heldSales.length === 0 ? (
            <li className="py-8 text-center text-sm text-gulio-muted">
              No held sales
            </li>
          ) : (
            heldSales.map((h) => {
              const sub = sumLines(h.cart);
              const disc = Number(h.discountAmount) || 0;
              const due = Math.max(0, sub - disc);
              const when = new Date(h.createdAt).toLocaleTimeString("en-TZ", {
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <li
                  key={h.id}
                  className="rounded-xl border border-gulio-border bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gulio-text">
                        {h.label}
                      </p>
                      <p className="mt-0.5 text-xs text-gulio-muted">
                        {when}
                        {h.customer ? ` · ${h.customer.name}` : ""}
                        {disc > 0
                          ? ` · −${formatMoney(h.discountAmount)}`
                          : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-bold tabular-nums text-gulio-text">
                      {formatMoney(String(due))}
                    </p>
                  </div>
                  <div className="mt-2.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onResume(h)}
                      className="min-h-10 flex-1 rounded-lg bg-gulio-primary text-xs font-semibold text-white transition hover:bg-gulio-primary-hover"
                    >
                      Resume
                    </button>
                    <button
                      type="button"
                      onClick={() => onDiscard(h.id)}
                      className="min-h-10 rounded-lg border border-gulio-border px-3 text-xs font-medium text-gulio-error transition hover:bg-red-50"
                    >
                      Discard
                    </button>
                  </div>
                </li>
              );
            })
          )}
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
