"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import type { ProductListItemDto } from "@gulio/contracts";
import { formatMoney } from "@/lib/money";
import {
  ProductImageField,
  productImagePreviewSrc,
} from "./ProductImageField";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (product: ProductListItemDto) => void;
};

type Step = 1 | 2 | 3;

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 1, label: "Basics" },
  { id: 2, label: "Variant" },
  { id: 3, label: "Media" },
];

const inputClass =
  "w-full rounded-xl border border-gulio-border bg-white px-3.5 py-2.5 text-sm text-gulio-text outline-none transition placeholder:text-gulio-muted/70 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

const btnSecondary =
  "min-h-10 min-w-[96px] rounded-md border-2 border-slate-200 bg-white font-semibold text-gulio-text shadow-sm transition-all duration-150 hover:border-slate-400 hover:bg-slate-50 hover:shadow data-[hover=true]:border-slate-400 data-[hover=true]:bg-slate-50";

const btnPrimary =
  "min-h-10 min-w-[112px] rounded-md border-2 border-teal-700 bg-teal-600 font-semibold text-white shadow-sm transition-all duration-150 hover:border-teal-800 hover:bg-teal-700 hover:shadow-md data-[hover=true]:bg-teal-700";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function normalizePrice(raw: string): string | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return String(Math.round(n));
}

export function ProductCreateModal({ isOpen, onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [variantName, setVariantName] = useState("");
  const [sku, setSku] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [barcode, setBarcode] = useState("");
  const [tracksSerial, setTracksSerial] = useState(true);
  const [imageUrl, setImageUrl] = useState("");
  const [previewBroken, setPreviewBroken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setName("");
    setBrand("");
    setCategory("");
    setDescription("");
    setVariantName("");
    setSku("");
    setSellPrice("");
    setBarcode("");
    setTracksSerial(true);
    setImageUrl("");
    setPreviewBroken(false);
    setError(null);
    setSaving(false);
  }, [isOpen]);

  const previewSrc = productImagePreviewSrc(imageUrl, previewBroken);
  const priceNormalized = normalizePrice(sellPrice);

  function validateStep(s: Step): string | null {
    if (s === 1) {
      if (!name.trim()) return "Product name is required";
      return null;
    }
    if (s === 2) {
      if (!variantName.trim()) return "Variant name is required";
      if (!sku.trim()) return "SKU is required";
      if (!priceNormalized) return "Enter a valid sell price";
      return null;
    }
    return null;
  }

  function goNext() {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((prev) => (prev < 3 ? ((prev + 1) as Step) : prev));
  }

  function goBack() {
    setError(null);
    setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev));
  }

  function goToStep(target: Step) {
    if (target === step) return;
    if (target < step) {
      setError(null);
      setStep(target);
      return;
    }
    // Only advance if current (and skipped) steps are valid
    for (let s = 1; s < target; s++) {
      const err = validateStep(s as Step);
      if (err) {
        setError(err);
        setStep(s as Step);
        return;
      }
    }
    setError(null);
    setStep(target);
  }

  async function handleCreate() {
    const err1 = validateStep(1);
    const err2 = validateStep(2);
    if (err1) {
      setStep(1);
      setError(err1);
      return;
    }
    if (err2) {
      setStep(2);
      setError(err2);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Create API not shipped yet — local catalog item for UI flow
      const id = `local-${Date.now()}`;
      const variantId = `${id}-v1`;
      const price = priceNormalized!;
      const created: ProductListItemDto = {
        id,
        name: name.trim(),
        description: description.trim() || null,
        imageUrl: imageUrl.trim() || null,
        isActive: true,
        brand: brand.trim()
          ? { id: `${id}-brand`, name: brand.trim() }
          : null,
        category: category.trim()
          ? { id: `${id}-cat`, name: category.trim(), parentId: null }
          : null,
        variants: [
          {
            id: variantId,
            sku: sku.trim().toUpperCase(),
            name: variantName.trim(),
            attributes: {},
            sellPrice: price,
            requiresSerial: tracksSerial,
            isActive: true,
            primaryBarcode: barcode.trim() || null,
            imageUrl: null,
          },
        ],
      };
      onCreated(created);
      onClose();
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
            <ModalHeader className="flex flex-col gap-3 !bg-white pb-3 pt-4">
              <div>
                <span className="text-base font-bold tracking-tight text-gulio-text">
                  New product
                </span>
                <p className="text-sm font-normal text-gulio-muted">
                  Step {step} of 3 — {STEPS[step - 1].label}
                </p>
              </div>

              <ol className="flex items-center gap-1.5" aria-label="Progress">
                {STEPS.map((s, i) => {
                  const active = s.id === step;
                  const done = s.id < step;
                  return (
                    <li key={s.id} className="flex min-w-0 flex-1 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => goToStep(s.id)}
                        className={`flex min-w-0 flex-1 items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition ${
                          active
                            ? "border-teal-600 bg-teal-50 text-teal-900"
                            : done
                              ? "border-teal-200 bg-white text-gulio-text hover:border-teal-400"
                              : "border-gulio-border bg-slate-50 text-gulio-muted"
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                            active || done
                              ? "bg-teal-600 text-white"
                              : "bg-white text-gulio-muted ring-1 ring-gulio-border"
                          }`}
                        >
                          {done ? "✓" : s.id}
                        </span>
                        <span className="truncate text-xs font-semibold">
                          {s.label}
                        </span>
                      </button>
                      {i < STEPS.length - 1 ? (
                        <span className="hidden h-px w-2 shrink-0 bg-gulio-border sm:block" />
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </ModalHeader>

            <ModalBody className="gap-4 !bg-white py-4">
              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
                  {error}
                </div>
              ) : null}

              {step === 1 ? (
                <div className="space-y-3.5">
                  <Field label="Product name" htmlFor="create-name" required>
                    <input
                      id="create-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Samsung Galaxy A07"
                      className={inputClass}
                      autoFocus
                    />
                  </Field>
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <Field label="Brand" htmlFor="create-brand">
                      <input
                        id="create-brand"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        placeholder="e.g. Samsung"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Category" htmlFor="create-category">
                      <input
                        id="create-category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        placeholder="e.g. Phones"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  <Field label="Description" htmlFor="create-description">
                    <textarea
                      id="create-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Optional note for staff…"
                      rows={2}
                      className={`${inputClass} min-h-[68px] resize-none`}
                    />
                  </Field>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-3.5">
                  <Field
                    label="Variant"
                    htmlFor="create-variant"
                    required
                    hint="Storage, color, or pack — e.g. 128GB · Black"
                  >
                    <input
                      id="create-variant"
                      value={variantName}
                      onChange={(e) => setVariantName(e.target.value)}
                      placeholder="128GB · Black"
                      className={inputClass}
                      autoFocus
                    />
                  </Field>
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <Field label="SKU" htmlFor="create-sku" required>
                      <input
                        id="create-sku"
                        value={sku}
                        onChange={(e) => setSku(e.target.value)}
                        placeholder="SAM-A07-128-BLK"
                        className={`${inputClass} font-mono text-[13px]`}
                      />
                    </Field>
                    <Field label="Sell price (TZS)" htmlFor="create-price" required>
                      <input
                        id="create-price"
                        inputMode="numeric"
                        value={sellPrice}
                        onChange={(e) => setSellPrice(e.target.value)}
                        placeholder="450,000"
                        className={`${inputClass} tabular-nums`}
                      />
                    </Field>
                  </div>
                  <Field label="Barcode" htmlFor="create-barcode">
                    <input
                      id="create-barcode"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder="Optional manufacturer or internal code"
                      className={`${inputClass} font-mono text-[13px]`}
                    />
                  </Field>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gulio-border bg-slate-50/80 px-3.5 py-3">
                    <input
                      type="checkbox"
                      checked={tracksSerial}
                      onChange={(e) => setTracksSerial(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gulio-border text-teal-600 focus:ring-teal-500"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-gulio-text">
                        Tracks IMEI / serial
                      </span>
                      <span className="mt-0.5 block text-xs text-gulio-muted">
                        Required before sale completes for phones & devices
                      </span>
                    </span>
                  </label>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-4">
                  <div className="flex gap-3.5">
                    <div className="relative h-[96px] w-[96px] shrink-0 overflow-hidden rounded-2xl border border-gulio-border bg-gulio-bg shadow-sm ring-1 ring-black/5">
                      {previewSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewSrc}
                          alt=""
                          className="h-full w-full object-cover"
                          onError={() => setPreviewBroken(true)}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gradient-to-br from-teal-50 to-slate-100">
                          <span className="text-xl font-bold text-teal-800/80">
                            {initials(name || "?")}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                      <p className="truncate text-sm font-bold text-gulio-text">
                        {name.trim() || "Untitled product"}
                      </p>
                      <p className="truncate text-xs text-gulio-muted">
                        {[brand.trim(), category.trim()]
                          .filter(Boolean)
                          .join(" · ") || "No brand / category"}
                      </p>
                      <p className="truncate text-xs text-gulio-muted">
                        {variantName.trim() || "—"} ·{" "}
                        <span className="font-mono">
                          {sku.trim().toUpperCase() || "SKU"}
                        </span>
                        {priceNormalized ? (
                          <>
                            {" "}
                            ·{" "}
                            <span className="font-semibold tabular-nums text-gulio-text">
                              {formatMoney(priceNormalized)}
                            </span>
                          </>
                        ) : null}
                      </p>
                      {tracksSerial ? (
                        <span className="inline-flex rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800">
                          IMEI tracked
                        </span>
                      ) : (
                        <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-gulio-muted">
                          Qty only
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gulio-border bg-slate-50/80 p-3">
                    <ProductImageField
                      id="create-product-image"
                      value={imageUrl}
                      onChange={setImageUrl}
                      previewBroken={previewBroken}
                      onBrokenChange={setPreviewBroken}
                      compact
                    />
                  </div>

                  <p className="text-xs text-gulio-muted">
                    Creates locally for now — catalog create API ships next.
                  </p>
                </div>
              ) : null}
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
              <div className="flex gap-2.5">
                {step > 1 ? (
                  <Button
                    variant="bordered"
                    radius="md"
                    onPress={goBack}
                    isDisabled={saving}
                    className={btnSecondary}
                  >
                    Back
                  </Button>
                ) : null}
                {step < 3 ? (
                  <Button
                    color="primary"
                    radius="md"
                    onPress={goNext}
                    className={btnPrimary}
                  >
                    Continue
                  </Button>
                ) : (
                  <Button
                    color="primary"
                    radius="md"
                    onPress={() => void handleCreate()}
                    isLoading={saving}
                    className={btnPrimary}
                  >
                    Create product
                  </Button>
                )}
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
