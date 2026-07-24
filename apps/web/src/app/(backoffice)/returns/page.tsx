"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/backoffice/PageHeader";
import { formatTzs, receiptMock } from "@/lib/mock-data";

export default function ReturnsPage() {
  const line = receiptMock.lines[0];
  const [done, setDone] = useState(false);

  return (
    <div>
      <PageHeader
        title="Return / refund"
        subtitle="IMEI returned must match IMEI sold · large refunds need manager PIN"
        actions={
          <Link
            href="/pos"
            className="inline-flex min-h-touch items-center rounded-xl border border-gulio-border bg-gulio-card px-4 py-2.5 text-sm font-medium hover:bg-gulio-bg"
          >
            Back to POS
          </Link>
        }
      />

      {done ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          Refund processed (mock). Serial status and stock would update via
          return ledger movements.
        </div>
      ) : null}

      <div className="mx-auto max-w-2xl space-y-4">
        <div className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
          <label className="mb-1.5 block text-sm font-medium" htmlFor="receipt">
            Search receipt
          </label>
          <input
            id="receipt"
            defaultValue={receiptMock.number}
            className="w-full rounded-xl border border-gulio-border px-3.5 py-2.5 text-sm outline-none ring-gulio-primary focus:ring-2"
          />
          <p className="mt-2 text-xs text-gulio-muted">
            {receiptMock.date} · {receiptMock.cashier} · {receiptMock.branch}
          </p>
        </div>

        <div className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-gulio-text">
            Select item
          </p>
          <div className="space-y-2">
            {receiptMock.lines.map((item, idx) => (
              <label
                key={`${item.productId}-${idx}`}
                className={`flex cursor-pointer gap-3 rounded-xl border p-3.5 transition ${
                  idx === 0
                    ? "border-rose-300 bg-rose-50/60"
                    : "border-gulio-border hover:bg-gulio-bg"
                }`}
              >
                <input
                  type="radio"
                  name="item"
                  defaultChecked={idx === 0}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gulio-text">
                    {item.name} · {item.variant}
                  </p>
                  {item.imei ? (
                    <p className="font-mono text-xs text-gulio-muted">
                      Sold IMEI {item.imei}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm font-semibold tabular-nums">
                    {formatTzs(item.unitPriceMinor)}
                    {item.qty > 1 ? ` × ${item.qty}` : ""}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="reason">
              Reason
            </label>
            <select
              id="reason"
              className="w-full rounded-xl border border-gulio-border px-3.5 py-2.5 text-sm"
              defaultValue="defective"
            >
              <option value="defective">Defective / DOA</option>
              <option value="wrong">Wrong item</option>
              <option value="customer">Customer change of mind</option>
              <option value="warranty">Warranty claim</option>
            </select>
          </div>
          {line.imei ? (
            <div>
              <label
                className="mb-1.5 block text-sm font-medium"
                htmlFor="ret-imei"
              >
                Scan returned IMEI (must match)
              </label>
              <input
                id="ret-imei"
                defaultValue={line.imei}
                className="w-full rounded-xl border border-gulio-border px-3.5 py-2.5 font-mono text-sm outline-none ring-gulio-primary focus:ring-2"
              />
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                className="mb-1.5 block text-sm font-medium"
                htmlFor="refund"
              >
                Refund method
              </label>
              <select
                id="refund"
                className="w-full rounded-xl border border-gulio-border px-3.5 py-2.5 text-sm"
                defaultValue="cash"
              >
                <option value="cash">Cash</option>
                <option value="mm">Mobile money</option>
                <option value="store-credit">Store credit</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="pin">
                Manager PIN
              </label>
              <input
                id="pin"
                type="password"
                placeholder="••••"
                className="w-full rounded-xl border border-gulio-border px-3.5 py-2.5 text-sm"
              />
              <p className="mt-1 text-xs text-gulio-muted">
                Required when refund exceeds threshold
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setDone(true)}
            className="inline-flex min-h-touch items-center rounded-xl bg-gulio-error px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
          >
            Process refund (mock)
          </button>
          <Link
            href="/dashboard"
            className="inline-flex min-h-touch items-center rounded-xl border border-gulio-border bg-gulio-card px-5 py-2.5 text-sm font-medium hover:bg-gulio-bg"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
