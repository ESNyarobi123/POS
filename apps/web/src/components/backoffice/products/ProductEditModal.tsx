"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import type { ProductListItemDto, UpdateProductRequest } from "@gulio/contracts";
import { formatMoney } from "@/lib/money";
import { ApiError, apiFetch } from "@/lib/api";
import {
  ProductImageField,
  productImagePreviewSrc,
} from "./ProductImageField";

type Props = {
  product: ProductListItemDto | null;
  isOpen: boolean;
  localOnly?: boolean;
  onClose: () => void;
  onSaved: (product: ProductListItemDto) => void;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const inputClass =
  "w-full rounded-xl border border-gulio-border bg-white px-3.5 py-2.5 text-sm text-gulio-text outline-none transition placeholder:text-gulio-muted/70 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

export function ProductEditModal({
  product,
  isOpen,
  localOnly = false,
  onClose,
  onSaved,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [previewBroken, setPreviewBroken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!product || !isOpen) return;
    setName(product.name);
    setDescription(product.description ?? "");
    setImageUrl(product.imageUrl ?? "");
    setPreviewBroken(false);
    setError(null);
    setSaving(false);
  }, [product, isOpen]);

  const trimmedUrl = imageUrl.trim();
  const previewSrc = productImagePreviewSrc(imageUrl, previewBroken);
  const variantCount = product?.variants.length ?? 0;
  const cheapest =
    variantCount > 0
      ? product!.variants.reduce((a, b) =>
          Number(a.sellPrice) <= Number(b.sellPrice) ? a : b,
        )
      : null;

  async function handleSave() {
    if (!product) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Product name is required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const body: UpdateProductRequest = {
        name: trimmedName,
        description: description.trim() || null,
        imageUrl: trimmedUrl || null,
      };

      if (localOnly) {
        onSaved({
          ...product,
          name: body.name ?? product.name,
          description: body.description ?? null,
          imageUrl: body.imageUrl ?? null,
        });
        onClose();
        return;
      }

      const updated = await apiFetch<ProductListItemDto>(
        `/catalog/products/${product.id}`,
        { method: "PATCH", body },
      );
      onSaved(updated);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save product");
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
        {() =>
          product ? (
            <>
              <ModalHeader className="flex flex-col gap-0.5 !bg-white pb-3 pt-4">
                <span className="text-base font-bold tracking-tight text-gulio-text">
                  Edit product
                </span>
                <span className="truncate text-sm font-normal text-gulio-muted">
                  {[product.brand?.name, product.category?.name]
                    .filter(Boolean)
                    .join(" · ") || "Catalog item"}
                </span>
              </ModalHeader>

              <ModalBody className="gap-4 !bg-white py-4">
                {error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
                    {error}
                  </div>
                ) : null}

                {/* Media + core fields */}
                <div className="flex gap-4">
                  <div className="relative h-[108px] w-[108px] shrink-0 overflow-hidden rounded-2xl border border-gulio-border bg-gulio-bg shadow-sm ring-1 ring-black/5">
                    {previewSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element -- catalog URLs / data URLs
                      <img
                        src={previewSrc}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={() => setPreviewBroken(true)}
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-teal-50 to-slate-100">
                        <span className="text-2xl font-bold tracking-tight text-teal-800/80">
                          {initials(name || product.name)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="space-y-1">
                      <label
                        htmlFor="edit-product-name"
                        className="block text-xs font-semibold uppercase tracking-wide text-gulio-muted"
                      >
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="edit-product-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Samsung Galaxy A07"
                        required
                        className={inputClass}
                        autoFocus
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="edit-product-description"
                        className="block text-xs font-semibold uppercase tracking-wide text-gulio-muted"
                      >
                        Description
                      </label>
                      <textarea
                        id="edit-product-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Short note for staff…"
                        rows={2}
                        className={`${inputClass} min-h-[68px] resize-none`}
                      />
                    </div>
                  </div>
                </div>

                {/* Image source — compact */}
                <div className="rounded-2xl border border-gulio-border bg-slate-50/80 p-3">
                  <ProductImageField
                    id="edit-product-image"
                    value={imageUrl}
                    onChange={setImageUrl}
                    previewBroken={previewBroken}
                    onBrokenChange={setPreviewBroken}
                    compact
                  />
                </div>

                {/* Variants — one line, not a full table */}
                <p className="text-xs leading-relaxed text-gulio-muted">
                  <span className="font-semibold text-gulio-text">
                    {variantCount} variant{variantCount === 1 ? "" : "s"}
                  </span>
                  {cheapest ? (
                    <>
                      {" "}
                      · from{" "}
                      <span className="tabular-nums font-medium text-gulio-text">
                        {formatMoney(cheapest.sellPrice)}
                      </span>
                    </>
                  ) : null}
                  <span className="text-gulio-muted/80">
                    {" "}
                    — SKU & price stay on variants
                  </span>
                </p>
              </ModalBody>

              <ModalFooter className="gap-2.5 !bg-white py-3.5">
                <Button
                  variant="bordered"
                  radius="md"
                  onPress={onClose}
                  isDisabled={saving}
                  className="min-h-10 min-w-[104px] rounded-md border-2 border-slate-200 bg-white font-semibold text-gulio-text shadow-sm transition-all duration-150 hover:border-slate-400 hover:bg-slate-50 hover:shadow data-[hover=true]:border-slate-400 data-[hover=true]:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  color="primary"
                  radius="md"
                  onPress={() => void handleSave()}
                  isLoading={saving}
                  className="min-h-10 min-w-[136px] rounded-md border-2 border-teal-700 bg-teal-600 font-semibold text-white shadow-sm transition-all duration-150 hover:border-teal-800 hover:bg-teal-700 hover:shadow-md data-[hover=true]:bg-teal-700"
                >
                  Save changes
                </Button>
              </ModalFooter>
            </>
          ) : null
        }
      </ModalContent>
    </Modal>
  );
}
