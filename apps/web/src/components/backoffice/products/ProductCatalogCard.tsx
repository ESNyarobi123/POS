"use client";

import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Chip,
} from "@heroui/react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ProductListItemDto } from "@gulio/contracts";
import { mediaSrc } from "@/lib/api";
import { formatMoney } from "@/lib/money";

type Props = {
  product: ProductListItemDto;
  canManage: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function priceLabel(product: ProductListItemDto): string {
  const prices = product.variants
    .map((v) => Number(v.sellPrice))
    .filter((n) => Number.isFinite(n));
  if (prices.length === 0) return "—";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return formatMoney(String(min));
  return `${formatMoney(String(min))} – ${formatMoney(String(max))}`;
}

export function ProductCatalogCard({
  product,
  canManage,
  onView,
  onEdit,
  onDelete,
}: Props) {
  const [broken, setBroken] = useState(false);
  const imageUrl = mediaSrc(
    product.imageUrl ?? product.variants[0]?.imageUrl ?? null,
  );
  const showImage = Boolean(imageUrl) && !broken;
  const tracksImei = product.variants.some((v) => v.requiresSerial);
  const variantCount = product.variants.length;

  return (
    <Card
      shadow="sm"
      className="h-full border border-gulio-border bg-gulio-card"
      classNames={{
        base: "overflow-hidden",
        footer: "gap-2 border-t border-gulio-border bg-gulio-bg/40 px-3 py-3",
      }}
    >
      <CardBody className="p-0">
        <button
          type="button"
          onClick={onView}
          className="block w-full text-left"
          aria-label={`View ${product.name}`}
        >
          <div className="relative aspect-[16/10] overflow-hidden bg-gulio-bg">
            {showImage && imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- catalog URLs
              <img
                src={imageUrl}
                alt=""
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
                onError={() => setBroken(true)}
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-teal-100/90 to-slate-100">
                <span className="text-3xl font-bold text-teal-800/80">
                  {initials(product.name)}
                </span>
              </div>
            )}
            <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
              {tracksImei ? (
                <Chip size="sm" color="primary" variant="solid">
                  IMEI
                </Chip>
              ) : null}
              <Chip size="sm" variant="flat" className="bg-white/90">
                {variantCount} variant{variantCount === 1 ? "" : "s"}
              </Chip>
            </div>
          </div>
          <div className="space-y-2 px-4 pb-3 pt-3.5">
            <div>
              <h3 className="line-clamp-1 text-base font-semibold text-gulio-text">
                {product.name}
              </h3>
              <p className="mt-0.5 line-clamp-1 text-xs text-gulio-muted">
                {[product.brand?.name, product.category?.name]
                  .filter(Boolean)
                  .join(" · ") || "Uncategorized"}
              </p>
            </div>
            <div className="flex items-end justify-between gap-2">
              <p className="text-lg font-bold tabular-nums tracking-tight text-gulio-text">
                {priceLabel(product)}
              </p>
              <p className="truncate font-mono text-[11px] text-gulio-muted">
                {product.variants[0]?.sku ?? "No SKU"}
              </p>
            </div>
          </div>
        </button>
      </CardBody>
      <CardFooter>
        <Button
          size="sm"
          variant="flat"
          color="primary"
          className="min-h-9 flex-1 font-semibold"
          startContent={<Eye size={15} />}
          onPress={onView}
        >
          View
        </Button>
        {canManage ? (
          <>
            <Button
              size="sm"
              variant="bordered"
              className="min-h-9 flex-1 font-semibold"
              startContent={<Pencil size={15} />}
              onPress={onEdit}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="flat"
              color="danger"
              className="min-h-9 flex-1 font-semibold"
              startContent={<Trash2 size={15} />}
              onPress={onDelete}
            >
              Delete
            </Button>
          </>
        ) : null}
      </CardFooter>
    </Card>
  );
}
