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
import type { ProductListItemDto, ProductListResponse } from "@gulio/contracts";
import { ProductThumb } from "@/components/backoffice/ProductThumb";
import { ApiError, apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/money";

export type ReceiveLineDraft = {
  key: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  tracksSerial: boolean;
  quantity: number;
  serialNumbers: string[];
};

type VariantOption = {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  price: string | null;
  imageUrl: string | null;
  tracksSerial: boolean;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (line: ReceiveLineDraft) => void;
  /** Already on the receive sheet — skip duplicates */
  excludeVariantIds?: string[];
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
        tracksSerial: v.requiresSerial,
      });
    }
  }
  return out;
}

function parseSerials(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function AddReceiveLineModal({
  isOpen,
  onClose,
  onAdd,
  excludeVariantIds = [],
}: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState<VariantOption[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<VariantOption | null>(null);
  const [qty, setQty] = useState("1");
  const [serialText, setSerialText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const excluded = useMemo(
    () => new Set(excludeVariantIds),
    [excludeVariantIds],
  );

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setQuery("");
    setSelected(null);
    setQty("1");
    setSerialText("");
    setError(null);

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
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = variants.filter((v) => !excluded.has(v.variantId));
    if (!q) return base.slice(0, 50);
    return base
      .filter(
        (v) =>
          v.productName.toLowerCase().includes(q) ||
          v.variantName.toLowerCase().includes(q) ||
          v.sku.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [variants, query, excluded]);

  const qtyNum = Number(qty.replace(/,/g, "").trim());
  const serials = parseSerials(serialText);

  function pick(v: VariantOption) {
    setSelected(v);
    setQty("1");
    setSerialText("");
    setError(null);
    setStep(2);
  }

  function confirmLine() {
    if (!selected) {
      setError("Select a variant");
      setStep(1);
      return;
    }
    if (!Number.isFinite(qtyNum) || qtyNum < 1 || !Number.isInteger(qtyNum)) {
      setError("Enter a whole quantity ≥ 1");
      return;
    }
    if (selected.tracksSerial && serials.length !== qtyNum) {
      setError(
        `Enter exactly ${qtyNum} IMEI/serial${qtyNum === 1 ? "" : "s"}`,
      );
      return;
    }
    onAdd({
      key: `${selected.variantId}-${Date.now()}`,
      variantId: selected.variantId,
      productName: selected.productName,
      variantName: selected.variantName,
      sku: selected.sku,
      imageUrl: selected.imageUrl,
      tracksSerial: selected.tracksSerial,
      quantity: qtyNum,
      serialNumbers: selected.tracksSerial ? serials : [],
    });
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="lg"
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
            <ModalHeader className="flex flex-col gap-1 !bg-white pb-3 pt-4">
              <span className="text-base font-bold tracking-tight">
                Add receive line
              </span>
              <span className="text-sm font-normal text-gulio-muted">
                {step === 1
                  ? "Step 1 · Choose variant"
                  : "Step 2 · Quantity & IMEI"}
              </span>
              <div className="mt-2 flex gap-1.5">
                <span
                  className={`h-1.5 flex-1 rounded-full ${
                    step >= 1 ? "bg-teal-600" : "bg-slate-200"
                  }`}
                />
                <span
                  className={`h-1.5 flex-1 rounded-full ${
                    step >= 2 ? "bg-teal-600" : "bg-slate-200"
                  }`}
                />
              </div>
            </ModalHeader>

            <ModalBody className="gap-4 !bg-white py-4">
              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
                  {error}
                </div>
              ) : null}

              {step === 1 ? (
                <div className="space-y-3">
                  <Field label="Search" htmlFor="recv-search">
                    <input
                      id="recv-search"
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Name, SKU, variant…"
                      className={inputClass}
                      autoFocus
                    />
                  </Field>
                  <div className="max-h-[300px] overflow-y-auto rounded-xl border border-gulio-border">
                    {loading ? (
                      <div className="space-y-2 p-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-12 animate-pulse rounded-lg bg-gulio-bg"
                          />
                        ))}
                      </div>
                    ) : filtered.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-gulio-muted">
                        No variants available
                      </p>
                    ) : (
                      <ul className="divide-y divide-gulio-border">
                        {filtered.map((v) => (
                          <li key={v.variantId}>
                            <button
                              type="button"
                              onClick={() => pick(v)}
                              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-teal-50/60"
                            >
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
                                  {v.price ? (
                                    <> · {formatMoney(v.price)}</>
                                  ) : null}
                                </p>
                              </div>
                              {v.tracksSerial ? (
                                <span className="shrink-0 rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800">
                                  IMEI
                                </span>
                              ) : (
                                <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-gulio-muted">
                                  Qty
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : null}

              {step === 2 && selected ? (
                <div className="space-y-3.5">
                  <div className="flex items-center gap-3 rounded-xl border border-gulio-border bg-slate-50/80 px-3.5 py-3">
                    <ProductThumb
                      imageUrl={selected.imageUrl}
                      name={selected.productName}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {selected.productName}
                      </p>
                      <p className="truncate text-xs text-gulio-muted">
                        {selected.variantName} ·{" "}
                        <span className="font-mono">{selected.sku}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStep(1);
                        setError(null);
                      }}
                      className="text-xs font-semibold text-teal-700 hover:underline"
                    >
                      Change
                    </button>
                  </div>

                  <Field label="Quantity" htmlFor="recv-qty" required>
                    <input
                      id="recv-qty"
                      inputMode="numeric"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      className={`${inputClass} tabular-nums`}
                      autoFocus={!selected.tracksSerial}
                    />
                  </Field>

                  {selected.tracksSerial ? (
                    <Field
                      label="IMEI / serials"
                      htmlFor="recv-serials"
                      required
                      hint={`One per line. Need exactly ${Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : "N"}.`}
                    >
                      <textarea
                        id="recv-serials"
                        value={serialText}
                        onChange={(e) => setSerialText(e.target.value)}
                        rows={4}
                        placeholder={"3509…\n3509…"}
                        className={`${inputClass} min-h-[100px] resize-y font-mono text-[13px]`}
                        autoFocus
                      />
                      <p className="mt-1 text-xs text-gulio-muted">
                        Entered:{" "}
                        <span className="font-semibold tabular-nums text-gulio-text">
                          {serials.length}
                        </span>
                      </p>
                    </Field>
                  ) : null}
                </div>
              ) : null}
            </ModalBody>

            <ModalFooter className="justify-between gap-2.5 !bg-white py-3.5">
              <Button
                variant="bordered"
                radius="md"
                onPress={onClose}
                className={btnSecondary}
              >
                Cancel
              </Button>
              <div className="flex gap-2.5">
                {step === 2 ? (
                  <Button
                    variant="bordered"
                    radius="md"
                    onPress={() => {
                      setStep(1);
                      setError(null);
                    }}
                    className={btnSecondary}
                  >
                    Back
                  </Button>
                ) : null}
                {step === 2 ? (
                  <Button
                    color="primary"
                    radius="md"
                    onPress={confirmLine}
                    className={btnPrimary}
                  >
                    Add to sheet
                  </Button>
                ) : null}
              </div>
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
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={htmlFor}
        className="block text-xs font-semibold uppercase tracking-wide text-gulio-muted"
      >
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-xs text-gulio-muted">{hint}</p> : null}
    </div>
  );
}
