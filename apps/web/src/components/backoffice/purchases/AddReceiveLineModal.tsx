"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
} from "@heroui/react";
import type { ProductListItemDto, ProductListResponse } from "@gulio/contracts";
import { Field } from "@/components/backoffice/purchases/Field";
import { ProductThumb } from "@/components/backoffice/ProductThumb";
import { ApiError, apiFetch } from "@/lib/api";
import { formatMoney, lineTotal, parseMoneyInput } from "@/lib/money";

export type ReceiveLineDraft = {
  key: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  tracksSerial: boolean;
  quantity: number;
  /** Wholesale / buy price per unit — decimal string, never float. */
  unitCost: string;
  /** Catalog sell price captured for this receipt line — decimal string. */
  retailPrice: string;
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
  /** Already on the receive sheet — skip duplicates. */
  excludeVariantIds?: string[];
};

const inputClassNames = {
  label: "text-[10px] font-semibold uppercase tracking-wider text-gulio-muted",
  inputWrapper:
    "min-h-10 rounded-lg border border-gulio-border bg-white shadow-none data-[hover=true]:border-slate-300 group-data-[focus=true]:border-teal-500",
  input: "text-sm text-gulio-text",
} as const;

const btnSecondary =
  "min-h-10 min-w-[96px] rounded-md border-2 border-slate-200 bg-white font-semibold text-gulio-text shadow-sm transition-all duration-150 hover:border-slate-400 hover:bg-slate-50 data-[hover=true]:border-slate-400 data-[hover=true]:bg-slate-50";

const btnPrimary =
  "min-h-10 min-w-[132px] rounded-md border-2 border-teal-700 bg-teal-600 font-semibold text-white shadow-sm transition-all duration-150 hover:border-teal-800 hover:bg-teal-700 data-[hover=true]:bg-teal-700";

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

/** Display-only decimal subtraction (mirrors lib/format helpers, never the money path). */
function subtractDecimal(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return 0;
  return na - nb;
}

function isPositiveDecimal(raw: string): boolean {
  const n = Number(raw.replace(/,/g, "").trim());
  return Number.isFinite(n) && n > 0;
}

function isNonNegativeDecimal(raw: string): boolean {
  const n = Number(raw.replace(/,/g, "").trim());
  return Number.isFinite(n) && n >= 0;
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
  const [unitCost, setUnitCost] = useState("");
  const [retailPrice, setRetailPrice] = useState("");
  const [serialText, setSerialText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const excluded = useMemo(() => new Set(excludeVariantIds), [excludeVariantIds]);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setQuery("");
    setSelected(null);
    setQty("1");
    setUnitCost("");
    setRetailPrice("");
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
          setError(e instanceof ApiError ? e.message : "Could not load catalog");
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

  // Display-only derived figures. The authoritative totals are recomputed by the
  // API when the receipt is posted; unit cost / retail price stay decimal strings.
  const safeQty = Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 0;
  const lineTotalNumber = isPositiveDecimal(unitCost)
    ? lineTotal(parseMoneyInput(unitCost), safeQty)
    : 0;
  const marginPerUnit = subtractDecimal(retailPrice, unitCost);
  const potentialMargin = marginPerUnit * safeQty;

  function pick(v: VariantOption) {
    setSelected(v);
    setQty("1");
    setUnitCost("");
    setRetailPrice(v.price ?? "");
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
    if (!isPositiveDecimal(unitCost)) {
      setError("Enter the wholesale / unit cost charged by the supplier");
      return;
    }
    if (!isNonNegativeDecimal(retailPrice)) {
      setError("Enter a retail price (0 or more)");
      return;
    }
    if (selected.tracksSerial && serials.length !== qtyNum) {
      setError(
        `Enter exactly ${qtyNum} IMEI/serial${qtyNum === 1 ? "" : "s"} — you have ${serials.length}.`,
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
      unitCost: parseMoneyInput(unitCost),
      retailPrice: parseMoneyInput(retailPrice),
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
            <ModalHeader className="flex flex-col gap-1 !bg-white pb-3 pt-4">
              <span className="text-base font-bold tracking-tight">
                Add receive line
              </span>
              <span className="text-sm font-normal text-gulio-muted">
                {step === 1
                  ? "Step 1 · Choose variant"
                  : "Step 2 · Quantity, cost & IMEI"}
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
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
                >
                  {error}
                </div>
              ) : null}

              {step === 1 ? (
                <div className="space-y-3">
                  <Input
                    autoFocus
                    size="sm"
                    type="search"
                    aria-label="Search catalog"
                    placeholder="Name, SKU, variant…"
                    value={query}
                    onValueChange={setQuery}
                    isClearable
                    classNames={inputClassNames}
                  />
                  <div className="max-h-[340px] overflow-y-auto rounded-xl border border-gulio-border">
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
                              <ProductThumb imageUrl={v.imageUrl} name={v.productName} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">
                                  {v.productName}
                                </p>
                                <p className="truncate text-xs text-gulio-muted">
                                  {v.variantName} ·{" "}
                                  <span className="font-mono">{v.sku}</span>
                                  {v.price ? <> · {formatMoney(v.price)}</> : null}
                                </p>
                              </div>
                              {v.tracksSerial ? (
                                <Chip
                                  size="sm"
                                  variant="flat"
                                  color="primary"
                                  className="h-5 shrink-0 px-1.5 text-[10px] font-semibold"
                                >
                                  IMEI
                                </Chip>
                              ) : (
                                <Chip
                                  size="sm"
                                  variant="flat"
                                  color="default"
                                  className="h-5 shrink-0 px-1.5 text-[10px] font-semibold"
                                >
                                  Qty
                                </Chip>
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
                <div className="space-y-4">
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
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Chip
                        size="sm"
                        variant="flat"
                        color={selected.tracksSerial ? "primary" : "default"}
                        className="h-5 px-1.5 text-[10px] font-semibold"
                      >
                        {selected.tracksSerial ? "Serial-tracked" : "Quantity item"}
                      </Chip>
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
                  </div>

                  <section aria-label="Quantity and pricing" className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gulio-muted">
                      Quantity & pricing
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="Quantity" required>
                        <Input
                          isRequired
                          autoFocus={!selected.tracksSerial}
                          size="sm"
                          aria-label="Quantity"
                          inputMode="numeric"
                          value={qty}
                          onValueChange={setQty}
                          classNames={inputClassNames}
                          className="tabular-nums"
                        />
                      </Field>
                      <Field label="Unit cost / wholesale" required>
                        <Input
                          isRequired
                          size="sm"
                          aria-label="Unit cost / wholesale"
                          inputMode="decimal"
                          placeholder="e.g. 288000"
                          value={unitCost}
                          onValueChange={setUnitCost}
                          classNames={inputClassNames}
                          className="tabular-nums"
                        />
                      </Field>
                      <Field label="Retail price">
                        <Input
                          size="sm"
                          aria-label="Retail price"
                          inputMode="decimal"
                          placeholder="Prefilled from catalogue"
                          value={retailPrice}
                          onValueChange={setRetailPrice}
                          classNames={inputClassNames}
                          className="tabular-nums"
                        />
                      </Field>
                    </div>

                    <div className="grid gap-2 rounded-xl border border-gulio-border bg-gulio-bg/60 px-3.5 py-3 sm:grid-cols-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                          Line total
                        </p>
                        <p className="mt-0.5 text-base font-bold tabular-nums text-gulio-text">
                          {formatMoney(lineTotalNumber)}
                        </p>
                        <p className="text-[11px] text-gulio-muted">
                          qty × unit cost
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                          Margin / unit
                        </p>
                        <p
                          className={`mt-0.5 text-base font-bold tabular-nums ${
                            marginPerUnit >= 0 ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {formatMoney(marginPerUnit)}
                        </p>
                        <p className="text-[11px] text-gulio-muted">
                          retail − unit cost
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                          Potential margin
                        </p>
                        <p
                          className={`mt-0.5 text-base font-bold tabular-nums ${
                            potentialMargin >= 0
                              ? "text-emerald-700"
                              : "text-rose-700"
                          }`}
                        >
                          {formatMoney(potentialMargin)}
                        </p>
                        <p className="text-[11px] text-gulio-muted">
                          margin / unit × qty
                        </p>
                      </div>
                    </div>
                  </section>

                  {selected.tracksSerial ? (
                    <section aria-label="IMEI and serials" className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gulio-muted">
                          IMEI / serial numbers
                        </p>
                        <span
                          className={`text-xs font-semibold tabular-nums ${
                            serials.length === qtyNum
                              ? "text-emerald-700"
                              : "text-amber-700"
                          }`}
                        >
                          {serials.length} / {Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : "N"}
                        </span>
                      </div>
                      <Textarea
                        autoFocus
                        minRows={4}
                        placeholder={"One IMEI per line (paste a list)\n3509…\n3509…"}
                        value={serialText}
                        onValueChange={setSerialText}
                        classNames={{
                          ...inputClassNames,
                          input: "font-mono text-[13px]",
                        }}
                      />
                      <p className="text-xs text-gulio-muted">
                        Required for serial-tracked devices — one serial per unit,
                        newline, comma or semicolon separated.
                      </p>
                    </section>
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
