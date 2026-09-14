"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { buildLabelQrPayload } from "@gulio/barcode";
import type {
  EnsureVariantBarcodeResponse,
  ProductListItemDto,
  ProductListResponse,
} from "@gulio/contracts";
import { ProductThumb } from "@/components/backoffice/ProductThumb";
import { ApiError, apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import type { LabelItem } from "./ProductLabelCard";

type VariantOption = {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  price: string | null;
  imageUrl: string | null;
  primaryBarcode: string | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (items: LabelItem[]) => void;
  /** Pre-select these variant ids when opening */
  initialVariantIds?: string[];
};

const inputClass =
  "w-full rounded-xl border border-gulio-border bg-white px-3.5 py-2.5 text-sm text-gulio-text outline-none transition placeholder:text-gulio-muted/70 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

const btnSecondary =
  "min-h-10 min-w-[96px] rounded-md border-2 border-slate-200 bg-white font-semibold text-gulio-text shadow-sm transition-all duration-150 hover:border-slate-400 hover:bg-slate-50 data-[hover=true]:border-slate-400 data-[hover=true]:bg-slate-50";

const btnPrimary =
  "min-h-10 min-w-[112px] rounded-md border-2 border-teal-700 bg-teal-600 font-semibold text-white shadow-sm transition-all duration-150 hover:border-teal-800 hover:bg-teal-700 data-[hover=true]:bg-teal-700";

function flatten(items: ProductListItemDto[]): VariantOption[] {
  const out: VariantOption[] = [];
  for (const p of items) {
    for (const v of p.variants) {
      if (!v.isActive) continue;
      out.push({
        variantId: v.id,
        productName: p.name,
        variantName: v.name,
        sku: v.sku,
        price: v.sellPrice,
        imageUrl: v.imageUrl ?? p.imageUrl,
        primaryBarcode: v.primaryBarcode,
      });
    }
  }
  return out;
}

export function CreateLabelsModal({
  isOpen,
  onClose,
  onCreated,
  initialVariantIds = [],
}: Props) {
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState<VariantOption[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copies, setCopies] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setCopies("1");
    setError(null);
    setSaving(false);
    setSelected(new Set(initialVariantIds));

    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await apiFetch<ProductListResponse>(
          "/catalog/products?limit=200",
        );
        if (!cancelled) setVariants(flatten(res.items));
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof ApiError ? e.message : "Could not load catalog",
          );
          setVariants([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, initialVariantIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return variants.slice(0, 60);
    return variants
      .filter(
        (v) =>
          v.productName.toLowerCase().includes(q) ||
          v.variantName.toLowerCase().includes(q) ||
          v.sku.toLowerCase().includes(q) ||
          (v.primaryBarcode?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 60);
  }, [variants, query]);

  const copiesNum = Number(copies.replace(/,/g, "").trim());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (selected.size === 0) {
      setError("Select at least one variant");
      return;
    }
    if (!Number.isFinite(copiesNum) || copiesNum < 1 || !Number.isInteger(copiesNum)) {
      setError("Copies must be a whole number ≥ 1");
      return;
    }
    if (copiesNum > 50) {
      setError("Max 50 copies per variant");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const picked = variants.filter((v) => selected.has(v.variantId));
      const items: LabelItem[] = [];

      for (const v of picked) {
        const ensured = await apiFetch<EnsureVariantBarcodeResponse>(
          `/catalog/variants/${v.variantId}/ensure-barcode`,
          { method: "POST", body: {} },
        );
        items.push({
          key: `${v.variantId}-${Date.now()}-${items.length}`,
          variantId: v.variantId,
          productName: v.productName,
          variantName: v.variantName,
          sku: v.sku,
          barcode: ensured.barcode.value,
          qrPayload: ensured.qrPayload || buildLabelQrPayload(v.variantId),
          priceLabel: v.price != null ? formatMoney(v.price) : null,
          copies: copiesNum,
        });
      }

      onCreated(items);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create labels");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
      size="2xl"
      scrollBehavior="inside"
      placement="center"
      classNames={{
        backdrop: "bg-slate-900/45 backdrop-opacity-100",
        wrapper: "overflow-hidden",
        base: "!bg-white border border-gulio-border text-gulio-text shadow-2xl",
        header: "!bg-white border-b border-gulio-border/80",
        body: "!bg-white",
        footer: "!bg-white border-t border-gulio-border/80",
      }}
    >
      <ModalContent className="!bg-white" style={{ backgroundColor: "#ffffff" }}>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-0.5 !bg-white pb-3 pt-4">
              <span className="text-base font-bold tracking-tight">
                Create labels
              </span>
              <span className="text-sm font-normal text-gulio-muted">
                Select variants · ensure Code 128 · QR = variant id only
              </span>
            </ModalHeader>

            <ModalBody className="gap-4 !bg-white py-4">
              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
                  {error}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                <Field label="Search" htmlFor="label-search">
                  <input
                    id="label-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Name, SKU, barcode…"
                    className={inputClass}
                    autoFocus
                  />
                </Field>
                <Field label="Copies each" htmlFor="label-copies">
                  <input
                    id="label-copies"
                    inputMode="numeric"
                    value={copies}
                    onChange={(e) => setCopies(e.target.value)}
                    className={`${inputClass} tabular-nums`}
                  />
                </Field>
              </div>

              <div className="max-h-[340px] overflow-y-auto rounded-xl border border-gulio-border">
                {loading ? (
                  <div className="space-y-2 p-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-12 animate-pulse rounded-lg bg-gulio-bg"
                      />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-gulio-muted">
                    No variants found
                  </p>
                ) : (
                  <ul className="divide-y divide-gulio-border">
                    {filtered.map((v) => {
                      const on = selected.has(v.variantId);
                      return (
                        <li key={v.variantId}>
                          <button
                            type="button"
                            onClick={() => toggle(v.variantId)}
                            className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition ${
                              on ? "bg-teal-50/80" : "hover:bg-slate-50"
                            }`}
                          >
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-[10px] font-bold ${
                                on
                                  ? "border-teal-600 bg-teal-600 text-white"
                                  : "border-slate-300 bg-white text-transparent"
                              }`}
                            >
                              ✓
                            </span>
                            <ProductThumb
                              imageUrl={v.imageUrl}
                              name={v.productName}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">
                                {v.productName}
                              </p>
                              <p className="truncate text-xs text-gulio-muted">
                                {v.variantName} ·{" "}
                                <span className="font-mono">{v.sku}</span>
                                {v.primaryBarcode ? (
                                  <>
                                    {" "}
                                    ·{" "}
                                    <span className="font-mono">
                                      {v.primaryBarcode}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-amber-700">
                                    {" "}
                                    · will create Code 128
                                  </span>
                                )}
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <p className="text-xs text-gulio-muted">
                Selected:{" "}
                <span className="font-semibold text-gulio-text">
                  {selected.size}
                </span>{" "}
                · shelf price is display-only; QR never carries price
              </p>
            </ModalBody>

            <ModalFooter className="justify-between gap-2.5 !bg-white py-3.5">
              <Button
                variant="bordered"
                radius="md"
                onPress={onClose}
                isDisabled={saving}
                className={btnSecondary}
              >
                Cancel
              </Button>
              <Button
                color="primary"
                radius="md"
                onPress={() => void handleCreate()}
                isLoading={saving}
                className={btnPrimary}
              >
                Create labels
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={htmlFor}
        className="block text-xs font-semibold uppercase tracking-wide text-gulio-muted"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
