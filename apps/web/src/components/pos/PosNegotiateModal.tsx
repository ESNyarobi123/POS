"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { PriceOverridePolicyDto } from "@gulio/contracts";
import {
  formatMoney,
  parseMoneyInput,
  type DecimalString,
} from "@/lib/money";
import {
  cashierNeedsManagerPin,
  isNegotiatedPrice,
  percentBelowList,
} from "@/lib/price-override";
import type { PosCartLine } from "@/lib/pos-cart";

type Props = {
  line: PosCartLine;
  policy: PriceOverridePolicyDto;
  actorIsManager: boolean;
  onApply: (unitPrice: DecimalString) => void;
  onClose: () => void;
};

/** Compact popup over the cart — Apply closes it, never navigates away. */
export function PosNegotiateModal({
  line,
  policy,
  actorIsManager,
  onApply,
  onClose,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const list = line.listUnitPrice ?? line.unitPrice;
  const [raw, setRaw] = useState(() =>
    String(Math.round(Number(line.unitPrice) || 0)),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRaw(String(Math.round(Number(line.unitPrice) || 0)));
    setError(null);
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 30);
    return () => window.clearTimeout(t);
  }, [line.variantId, line.unitPrice, line.serialUnitIds?.[0]]);

  const charged = parseMoneyInput(raw);
  const chargedN = Number(charged);
  const listN = Number(list);
  const delta = listN - chargedN;
  const pct = percentBelowList(list, charged);
  const negotiated = isNegotiatedPrice(list, charged);
  const needsPin = cashierNeedsManagerPin(
    list,
    charged,
    policy,
    actorIsManager,
  );
  const aboveList = chargedN > listN + 0.0001;
  const blockedAbove = aboveList && !policy.allowAboveList;

  const hint = useMemo(() => {
    if (!negotiated) return "Same as list — catalog is unchanged.";
    if (blockedAbove) return "Selling above list is disabled in settings.";
    if (aboveList) return "Above list — extra margin, still audited.";
    if (needsPin) {
      return `Over ${policy.cashierMaxPercentBelowList}% — manager PIN at pay.`;
    }
    return `Within cashier ${policy.cashierMaxPercentBelowList}% limit.`;
  }, [
    negotiated,
    blockedAbove,
    aboveList,
    needsPin,
    policy.cashierMaxPercentBelowList,
  ]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!Number.isFinite(chargedN) || chargedN < 0) {
      setError("Enter a valid price");
      return;
    }
    if (blockedAbove) {
      setError("Selling above list is disabled");
      return;
    }
    onApply(charged);
    onClose();
  }

  return (
    <div
      className="absolute inset-0 z-30 flex items-end bg-slate-900/40 p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="negotiate-modal-title"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full overflow-hidden rounded-gulio border border-gulio-border bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-2 border-b border-gulio-border px-3.5 py-3">
          <div className="min-w-0">
            <h3
              id="negotiate-modal-title"
              className="text-sm font-semibold text-gulio-text"
            >
              Negotiated price
            </h3>
            <p className="mt-0.5 truncate text-xs text-gulio-muted">
              {line.productName}
              {line.variantName ? ` · ${line.variantName}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg text-gulio-muted hover:bg-gulio-bg hover:text-gulio-text"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-3 px-3.5 py-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-gulio border border-gulio-border bg-gulio-bg/70 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                List
              </p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-gulio-text">
                {formatMoney(list)}
              </p>
            </div>
            <div className="rounded-gulio border-2 border-gulio-primary bg-teal-50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-800">
                Charge now
              </p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-teal-950">
                {formatMoney(charged)}
              </p>
            </div>
          </div>

          <input
            ref={inputRef}
            id="pos-negotiate"
            aria-label="Negotiated unit price"
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setError(null);
            }}
            inputMode="decimal"
            placeholder="0"
            className="min-h-touch w-full rounded-gulio border border-gulio-border px-3 text-lg tabular-nums outline-none ring-gulio-primary focus:border-gulio-primary focus:ring-2"
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setRaw(String(Math.round(listN)));
                setError(null);
              }}
              className="min-h-touch rounded-gulio border border-gulio-border bg-transparent text-sm font-semibold text-gulio-muted transition hover:bg-white hover:text-gulio-text active:scale-[0.98]"
            >
              LIST
            </button>
            <button
              type="button"
              onClick={() => {
                const cap =
                  listN * (1 - policy.cashierMaxPercentBelowList / 100);
                setRaw(String(Math.round(cap)));
                setError(null);
              }}
              className="min-h-touch rounded-gulio border-2 border-gulio-primary bg-white text-sm font-semibold text-gulio-primary transition hover:bg-teal-50 active:scale-[0.98]"
            >
              −{policy.cashierMaxPercentBelowList}%
            </button>
          </div>

          {negotiated ? (
            <p className="text-xs tabular-nums text-gulio-muted">
              {delta > 0
                ? `${formatMoney(String(delta))} below list (${pct.toFixed(1)}%)`
                : `${formatMoney(String(Math.abs(delta)))} above list`}
            </p>
          ) : null}

          <p
            className={`rounded-lg px-2.5 py-1.5 text-[11px] ${
              blockedAbove
                ? "border border-red-200 bg-red-50 text-red-800"
                : needsPin
                  ? "border border-amber-200 bg-amber-50 text-amber-900"
                  : "text-gulio-muted"
            }`}
          >
            {hint}
          </p>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-gulio-error"
            >
              {error}
            </p>
          ) : null}

          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-touch rounded-gulio border border-gulio-border bg-transparent text-sm font-semibold text-gulio-muted transition hover:bg-white hover:text-gulio-text active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-touch rounded-gulio bg-gulio-success text-sm font-bold tracking-wide text-white shadow-sm ring-2 ring-green-600/20 transition hover:bg-green-700 active:scale-[0.98]"
            >
              APPLY
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
