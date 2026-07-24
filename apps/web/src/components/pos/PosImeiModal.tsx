"use client";

import type { SerialUnitDto, VariantSummaryDto } from "@gulio/contracts";

type Props = {
  productName: string;
  variant: VariantSummaryDto;
  serials: SerialUnitDto[];
  onSelect: (serial: SerialUnitDto) => void;
  onClose: () => void;
};

export function PosImeiModal({
  productName,
  variant,
  serials,
  onSelect,
  onClose,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="imei-modal-title"
    >
      <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-gulio-border bg-gulio-card shadow-xl">
        <div className="border-b border-gulio-border px-5 py-4">
          <h3
            id="imei-modal-title"
            className="text-lg font-semibold text-gulio-text"
          >
            Select IMEI / serial
          </h3>
          <p className="mt-1 text-sm text-gulio-muted">
            {productName} · {variant.name}
          </p>
        </div>

        <ul className="flex-1 space-y-2 overflow-auto px-4 py-4">
          {serials.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s)}
                className="flex min-h-14 w-full items-center rounded-xl border border-gulio-border px-4 py-3 text-left font-mono text-sm text-gulio-text transition hover:border-gulio-primary hover:bg-teal-50 hover:shadow-sm active:scale-[0.99]"
              >
                {s.serialNumber}
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
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
