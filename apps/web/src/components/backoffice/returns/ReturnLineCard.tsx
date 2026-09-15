"use client";

import type {
  ReturnDisposition,
  ReturnableSaleItemDto,
} from "@gulio/contracts";
import { ScanLine, ShieldCheck, Smartphone } from "lucide-react";
import { formatMoney } from "@/lib/money";

export type LineDraft = {
  selected: boolean;
  quantity: number;
  disposition: ReturnDisposition;
  serialUnitId: string | null;
  imeiScan: string;
};

const DISPOSITIONS: Array<{
  value: ReturnDisposition;
  label: string;
  hint: string;
}> = [
  { value: "RESTOCK", label: "Restock", hint: "Back to sellable stock" },
  { value: "DAMAGE", label: "Damage", hint: "Not for resale" },
  { value: "WRITE_OFF", label: "Write-off", hint: "Remove from books" },
];

const inputClass =
  "w-full rounded-xl border border-gulio-border bg-white px-3.5 py-2.5 text-sm text-gulio-text outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

function normalizeImei(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

export function matchSoldImei(
  item: ReturnableSaleItemDto,
  scan: string,
): ReturnableSaleItemDto["serials"][number] | null {
  const needle = normalizeImei(scan);
  if (!needle) return null;
  return (
    item.serials.find(
      (s) => s.status === "SOLD" && normalizeImei(s.serialNumber) === needle,
    ) ?? null
  );
}

type Props = {
  item: ReturnableSaleItemDto;
  draft: LineDraft;
  onChange: (next: LineDraft) => void;
};

export function ReturnLineCard({ item, draft, onChange }: Props) {
  const returnable = Math.floor(Number(item.quantityReturnable));
  const disabled = returnable <= 0;
  const matched = item.tracksSerial
    ? matchSoldImei(item, draft.imeiScan)
    : null;
  const imeiTyped = Boolean(normalizeImei(draft.imeiScan));
  const imeiMismatch = imeiTyped && !matched;
  const soldSerials = item.serials.filter((s) => s.status === "SOLD");

  return (
    <div
      className={`rounded-xl border p-4 transition ${
        draft.selected
          ? "border-teal-300 bg-teal-50/40 shadow-sm"
          : "border-gulio-border bg-white"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <label className="flex cursor-pointer gap-3">
        <input
          type="checkbox"
          checked={draft.selected}
          disabled={disabled}
          onChange={(e) =>
            onChange({ ...draft, selected: e.target.checked })
          }
          className="mt-1.5 h-5 w-5 accent-teal-600"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-gulio-text">{item.productName}</p>
              <p className="text-sm text-gulio-muted">{item.variantName}</p>
            </div>
            <p className="text-sm font-bold tabular-nums text-gulio-text">
              {formatMoney(item.unitPrice)}
            </p>
          </div>
          <p className="mt-1 font-mono text-xs text-gulio-muted">
            {item.sku} · returnable {returnable}/
            {Math.floor(Number(item.quantitySold))}
            {item.tracksSerial ? " · IMEI tracked" : ""}
          </p>
          {disabled ? (
            <p className="mt-2 text-xs font-semibold text-gulio-muted">
              Nothing left to return on this line
            </p>
          ) : null}
        </div>
      </label>

      {draft.selected && !disabled ? (
        <div className="mt-4 space-y-4 border-t border-teal-200/70 pt-4">
          {item.tracksSerial ? (
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gulio-text">
                <ScanLine className="h-3.5 w-3.5 text-teal-700" />
                Scan returned IMEI — must match sold
              </label>
              <div className="relative">
                <Smartphone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gulio-muted" />
                <input
                  value={draft.imeiScan}
                  autoComplete="off"
                  placeholder="Scan or type IMEI…"
                  className={`${inputClass} min-h-touch pl-10 font-mono tracking-wide ${
                    matched
                      ? "border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500/20"
                      : imeiMismatch
                        ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
                        : ""
                  }`}
                  onChange={(e) => {
                    const imeiScan = e.target.value;
                    const hit = matchSoldImei(item, imeiScan);
                    onChange({
                      ...draft,
                      imeiScan,
                      serialUnitId: hit?.serialUnitId ?? null,
                      quantity: 1,
                    });
                  }}
                />
              </div>
              {matched ? (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Matches IMEI sold on this receipt
                </p>
              ) : imeiMismatch ? (
                <p className="mt-2 text-xs font-semibold text-red-700">
                  This IMEI was not sold on this line
                </p>
              ) : (
                <p className="mt-2 text-xs text-gulio-muted">
                  Device in hand must be the serial that left the store.
                </p>
              )}
              {soldSerials.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {soldSerials.map((s) => {
                    const active = draft.serialUnitId === s.serialUnitId;
                    return (
                      <button
                        key={s.serialUnitId}
                        type="button"
                        onClick={() =>
                          onChange({
                            ...draft,
                            imeiScan: s.serialNumber,
                            serialUnitId: s.serialUnitId,
                            quantity: 1,
                          })
                        }
                        className={`min-h-9 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] font-semibold transition ${
                          active
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : "border-gulio-border bg-white text-gulio-muted hover:border-teal-300"
                        }`}
                      >
                        {s.serialNumber}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gulio-muted">
                Quantity
              </label>
              <div className="inline-flex items-center gap-1 rounded-xl border border-gulio-border bg-white p-1">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={draft.quantity <= 1}
                  onClick={() =>
                    onChange({
                      ...draft,
                      quantity: Math.max(1, draft.quantity - 1),
                    })
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-semibold text-gulio-text hover:bg-slate-50 disabled:opacity-40"
                >
                  −
                </button>
                <span className="min-w-[2.5rem] text-center text-sm font-bold tabular-nums">
                  {draft.quantity}
                </span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  disabled={draft.quantity >= returnable}
                  onClick={() =>
                    onChange({
                      ...draft,
                      quantity: Math.min(returnable, draft.quantity + 1),
                    })
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-semibold text-gulio-text hover:bg-slate-50 disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs font-semibold text-gulio-muted">
              Disposition
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {DISPOSITIONS.map((opt) => {
                const on = draft.disposition === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    title={opt.hint}
                    onClick={() =>
                      onChange({ ...draft, disposition: opt.value })
                    }
                    className={`min-h-touch rounded-xl border px-2 py-2.5 text-center text-xs font-semibold transition ${
                      on
                        ? "border-teal-400 bg-white text-teal-900 shadow-sm"
                        : "border-gulio-border bg-gulio-bg text-gulio-muted hover:border-slate-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
