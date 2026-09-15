"use client";

import { Code128Barcode } from "./Code128Barcode";
import { LabelQrCode } from "./LabelQrCode";

export type LabelItem = {
  key: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  barcode: string;
  qrPayload: string;
  priceLabel: string | null;
  copies: number;
};

type Props = {
  item: LabelItem;
  /** standard | compact */
  size?: "standard" | "compact";
  showPrice?: boolean;
};

export function ProductLabelCard({
  item,
  size = "standard",
  showPrice = true,
}: Props) {
  const compact = size === "compact";

  return (
    <div
      className={`label-sheet-item break-inside-avoid rounded-lg border-2 border-slate-800 bg-white text-center text-gulio-text ${
        compact ? "w-[168px] p-2.5" : "w-[240px] p-3.5"
      }`}
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-teal-700">
        GulioSmart
      </p>
      <p
        className={`mt-1 font-bold leading-tight ${
          compact ? "text-[11px]" : "text-sm"
        }`}
      >
        {item.productName}
      </p>
      <p className={`text-gulio-muted ${compact ? "text-[9px]" : "text-[11px]"}`}>
        {item.variantName}
      </p>
      {showPrice && item.priceLabel ? (
        <p
          className={`mt-1 font-semibold tabular-nums ${
            compact ? "text-[11px]" : "text-sm"
          }`}
        >
          {item.priceLabel}
          <span className="ml-1 text-[9px] font-normal text-gulio-muted">
            (shelf)
          </span>
        </p>
      ) : null}

      <div className={`mt-2 ${compact ? "px-0.5" : "px-1"}`}>
        <Code128Barcode
          value={item.barcode}
          height={compact ? 36 : 48}
          displayValue={false}
        />
      </div>
      <p className="mt-1 font-mono text-[9px] tracking-tight text-gulio-text">
        {item.barcode}
      </p>

      <div className="mt-2 flex flex-col items-center gap-1">
        <LabelQrCode payload={item.qrPayload} size={compact ? 52 : 68} />
        <p className="max-w-full truncate px-1 text-[8px] text-gulio-muted">
          Scan → live price · never from QR
        </p>
      </div>
    </div>
  );
}
