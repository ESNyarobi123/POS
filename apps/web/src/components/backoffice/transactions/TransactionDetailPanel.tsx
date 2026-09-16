"use client";

import type { SaleDto } from "@gulio/contracts";
import { formatMoney } from "@/lib/money";
import {
  cashInLabel,
  formatSaleWhen,
  isNegotiatedSale,
  itemTitle,
  negotiatedBelowList,
  PAYMENT_LABELS,
  saleChannel,
  saleDeviceCount,
  salePaymentSummary,
} from "@/lib/transaction-display";
import { TransactionLineThumb } from "./TransactionLineThumb";

type Props = {
  sale: SaleDto | null;
  onClose: () => void;
};

export function TransactionDetailPanel({ sale, onClose }: Props) {
  if (!sale) {
    return (
      <aside className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-gulio-border bg-white px-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-gulio-text">Select a transaction</p>
        <p className="mt-1 max-w-xs text-sm text-gulio-muted">
          Open View on a sale to see products, images, cashier, channel, and
          negotiated prices.
        </p>
      </aside>
    );
  }

  const negotiated = isNegotiatedSale(sale);
  const given = negotiatedBelowList(sale);
  const devices = saleDeviceCount(sale);
  const posted = cashInLabel(sale.cashInStatus);

  return (
    <aside className="flex h-full max-h-[100dvh] flex-col overflow-hidden rounded-none border-0 bg-white shadow-2xl xl:max-h-[calc(100vh-8rem)] xl:rounded-2xl xl:border xl:border-gulio-border xl:shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-gulio-border px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
            Transaction
          </p>
          <h2 className="truncate text-base font-bold text-gulio-text">
            {sale.receiptNumber}
          </h2>
          <p className="mt-0.5 text-xs text-gulio-muted">
            {formatSaleWhen(sale.completedAt ?? sale.createdAt)}
            {sale.branchName ? ` · ${sale.branchName}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-gulio-muted hover:bg-gulio-bg hover:text-gulio-text"
          aria-label="Close details"
        >
          ×
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3.5">
        <p className="text-sm text-gulio-muted">Amount</p>
        <p className="text-2xl font-bold tabular-nums text-gulio-text">
          {formatMoney(sale.grandTotal)}
        </p>
        {Number(sale.discountTotal) > 0 ? (
          <p className="mt-0.5 text-xs tabular-nums text-amber-700">
            Discount −{formatMoney(sale.discountTotal)}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
            {salePaymentSummary(sale)}
          </span>
          <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-800 ring-1 ring-inset ring-teal-200">
            {saleChannel(sale)}
            {sale.channelType ? ` · ${sale.channelType}` : ""}
          </span>
          {negotiated ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
              Negotiated · {formatMoney(given)} below list
            </span>
          ) : null}
          {devices > 0 ? (
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-800 ring-1 ring-inset ring-indigo-200">
              {devices} device{devices === 1 ? "" : "s"}
            </span>
          ) : null}
          {posted ? (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                sale.cashInStatus === "FAILED"
                  ? "bg-rose-50 text-rose-800 ring-rose-200"
                  : sale.cashInStatus === "PENDING"
                    ? "bg-amber-50 text-amber-800 ring-amber-200"
                    : "bg-emerald-50 text-emerald-800 ring-emerald-200"
              }`}
            >
              OpticEdge · {posted}
            </span>
          ) : null}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-gulio-bg/80 px-3 py-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
              Cashier
            </dt>
            <dd className="mt-0.5 font-medium text-gulio-text">
              {sale.cashierName ?? "—"}
            </dd>
          </div>
          <div className="rounded-xl bg-gulio-bg/80 px-3 py-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
              Customer
            </dt>
            <dd className="mt-0.5 font-medium text-gulio-text">
              {sale.customerName ?? "Walk-in"}
            </dd>
            {sale.customerPhone ? (
              <dd className="text-xs text-gulio-muted">{sale.customerPhone}</dd>
            ) : null}
          </div>
        </dl>

        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
            Payments
          </p>
          {sale.payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-gulio-border px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium text-gulio-text">
                  {PAYMENT_LABELS[p.method]}
                </span>
                {p.provider ? (
                  <span className="text-gulio-muted"> · {p.provider}</span>
                ) : null}
                {p.reference ? (
                  <span className="mt-0.5 block font-mono text-[10px] text-gulio-muted">
                    {p.reference}
                  </span>
                ) : null}
              </span>
              <span className="tabular-nums font-semibold">
                {formatMoney(p.amount)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
            Products
          </p>
          <ul className="mt-2 space-y-2">
            {sale.items.map((item) => {
              const title = itemTitle(item);
              const imeis = (item.serials ?? [])
                .map((s) => s.serialNumber)
                .filter(Boolean);
              return (
                <li
                  key={item.id}
                  className="flex gap-3 rounded-xl border border-gulio-border p-2.5"
                >
                  <TransactionLineThumb imageUrl={item.imageUrl} name={title} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gulio-text">
                      {title}
                    </p>
                    <p className="truncate text-xs text-gulio-muted">
                      {item.name && item.productName && item.name !== item.productName
                        ? item.name
                        : item.sku}
                    </p>
                    {imeis.length > 0 ? (
                      <p className="mt-0.5 font-mono text-[10px] text-indigo-700">
                        IMEI {imeis.join(" · ")}
                      </p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs tabular-nums text-gulio-muted">
                        ×{Number(item.quantity)} · {formatMoney(item.unitPrice)}
                      </span>
                      {item.negotiated ? (
                        <>
                          <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800 ring-1 ring-inset ring-amber-200">
                            Negotiated
                          </span>
                          <span className="text-[10px] tabular-nums text-gulio-muted line-through">
                            {formatMoney(item.listUnitPrice)}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <p className="shrink-0 text-sm font-bold tabular-nums text-gulio-text">
                    {formatMoney(item.lineTotal)}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </aside>
  );
}
