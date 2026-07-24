"use client";

import { useState } from "react";
import type { VariantSummaryDto } from "@gulio/contracts";
import { formatMoney } from "@/lib/money";

export type PosProductCardData = {
  productId: string;
  productName: string;
  categoryName: string | null;
  /** Prefer variant image, then product image. */
  imageUrl: string | null;
  variant: VariantSummaryDto;
};

const PLACEHOLDER_TINTS = [
  "bg-teal-50 text-teal-700",
  "bg-sky-50 text-sky-700",
  "bg-violet-50 text-violet-700",
  "bg-amber-50 text-amber-800",
  "bg-rose-50 text-rose-700",
  "bg-emerald-50 text-emerald-700",
] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function tintFor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash + key.charCodeAt(i) * (i + 1)) % 997;
  }
  return PLACEHOLDER_TINTS[hash % PLACEHOLDER_TINTS.length];
}

type Props = {
  card: PosProductCardData;
  onAdd: (card: PosProductCardData) => void;
};

function CardMedia({
  imageUrl,
  productName,
  tint,
}: {
  imageUrl: string | null;
  productName: string;
  tint: string;
}) {
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(imageUrl) && !broken;

  if (showImage && imageUrl) {
    return (
      <div className="relative h-28 w-full overflow-hidden rounded-lg bg-gulio-bg sm:h-32">
        {/* eslint-disable-next-line @next/next/no-img-element -- external seed URLs; avoid next/image domain config */}
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          onError={() => setBroken(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex h-28 w-full items-center justify-center rounded-lg text-2xl font-bold tracking-wide sm:h-32 ${tint}`}
      aria-hidden
    >
      {initials(productName)}
    </div>
  );
}

export function PosProductCard({ card, onAdd }: Props) {
  const tint = tintFor(card.categoryName ?? card.productId);

  return (
    <button
      type="button"
      onClick={() => onAdd(card)}
      className="pos-card group flex w-full flex-col overflow-hidden p-2.5 text-left transition hover:-translate-y-0.5 hover:border-gulio-primary hover:shadow-md active:scale-[0.98]"
    >
      <CardMedia
        imageUrl={card.imageUrl}
        productName={card.productName}
        tint={tint}
      />

      <div className="mt-2.5 flex min-w-0 flex-col px-0.5">
        <span className="line-clamp-2 text-sm font-semibold leading-snug text-gulio-text">
          {card.productName}
        </span>
        <span className="mt-0.5 truncate text-xs text-gulio-muted">
          {card.variant.name}
        </span>

        <span className="pos-price mt-2 text-lg">
          {formatMoney(card.variant.sellPrice)}
        </span>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex max-w-full truncate rounded-md bg-gulio-bg px-1.5 py-0.5 text-[11px] font-medium text-gulio-muted">
            {card.variant.sku}
          </span>
          {card.variant.requiresSerial && (
            <span className="inline-flex rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
              IMEI
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
