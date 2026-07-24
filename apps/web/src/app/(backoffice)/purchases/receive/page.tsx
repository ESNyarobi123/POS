"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/backoffice/PageHeader";
import { PermissionGate } from "@/components/backoffice/PermissionGate";
import { PermissionCode } from "@/lib/permissions";

const receiveLines = [
  {
    sku: "SAM-A55-256-NVY",
    name: "Samsung Galaxy A55",
    variant: "256GB · Navy",
    ordered: 10,
    received: 6,
    imeiNeeded: true,
  },
  {
    sku: "ACC-USBC-1M-WHT",
    name: "USB-C Cable 1m",
    variant: "White",
    ordered: 50,
    received: 50,
    imeiNeeded: false,
  },
  {
    sku: "APL-APP2-USBC",
    name: "AirPods Pro 2",
    variant: "USB-C",
    ordered: 8,
    received: 0,
    imeiNeeded: true,
  },
];

export default function ReceiveStockPage() {
  return (
    <PermissionGate permission={PermissionCode.STOCK_ADJUST}>
      <ReceiveStockPageInner />
    </PermissionGate>
  );
}

function ReceiveStockPageInner() {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div>
      <PageHeader
        title="Receive stock"
        subtitle="PO-PO-2026-0182 · partial receive preview (Phase 2 purchasing API)"
        actions={
          <Link
            href="/labels"
            className="inline-flex min-h-touch items-center rounded-xl border border-gulio-border bg-gulio-card px-4 py-2.5 text-sm font-medium hover:bg-gulio-bg"
          >
            Print labels
          </Link>
        }
      />

      {confirmed ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Receive recorded (mock). Stock movements would post via the inventory
          ledger — never mutate product.stock directly.
        </div>
      ) : null}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <InfoChip label="Supplier" value="TechHub TZ Ltd" />
        <InfoChip label="Warehouse" value="Main" />
        <InfoChip label="Status" value="Partial" accent />
      </div>

      <div className="space-y-3">
        {receiveLines.map((line) => {
          const pct = Math.round((line.received / line.ordered) * 100);
          return (
            <div
              key={line.sku}
              className="rounded-xl border border-gulio-border bg-gulio-card p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gulio-text">{line.name}</p>
                  <p className="text-sm text-gulio-muted">{line.variant}</p>
                  <p className="mt-1 font-mono text-xs text-gulio-muted">
                    {line.sku}
                  </p>
                </div>
                <div className="text-right">
                  <label className="text-xs font-medium text-gulio-muted">
                    Receiving qty
                  </label>
                  <div className="mt-1 flex items-center justify-end gap-2">
                    <input
                      className="w-16 rounded-lg border border-gulio-border px-2 py-1.5 text-center text-sm tabular-nums outline-none ring-gulio-primary focus:ring-2"
                      defaultValue={line.received}
                      inputMode="numeric"
                    />
                    <span className="text-sm tabular-nums text-gulio-muted">
                      / {line.ordered}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[11px] text-gulio-muted">
                  <span>Progress</span>
                  <span className="tabular-nums">{pct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-gulio-bg">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {line.imeiNeeded ? (
                <div className="mt-4">
                  <label className="mb-1.5 block text-xs font-medium text-gulio-muted">
                    Scan IMEI (required for serial-tracked items)
                  </label>
                  <input
                    placeholder="356938035643809"
                    className="w-full rounded-xl border border-gulio-border px-3.5 py-2.5 font-mono text-sm outline-none ring-gulio-primary focus:ring-2"
                  />
                </div>
              ) : (
                <p className="mt-3 text-xs text-gulio-muted">
                  Quantity item — no serial scan required
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setConfirmed(true)}
          className="inline-flex min-h-touch items-center rounded-xl bg-gulio-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gulio-primary-hover"
        >
          Confirm receive (mock)
        </button>
        <Link
          href="/inventory"
          className="inline-flex min-h-touch items-center rounded-xl border border-gulio-border bg-gulio-card px-5 py-2.5 text-sm font-medium hover:bg-gulio-bg"
        >
          View inventory
        </Link>
      </div>
    </div>
  );
}

function InfoChip({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gulio-border bg-gulio-card px-4 py-3 shadow-sm">
      <p className="text-xs font-medium text-gulio-muted">{label}</p>
      <p
        className={`mt-0.5 text-sm font-semibold ${
          accent ? "text-emerald-700" : "text-gulio-text"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
