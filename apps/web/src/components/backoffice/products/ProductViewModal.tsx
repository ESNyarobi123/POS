"use client";

import {
  Button,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import type { ProductListItemDto } from "@gulio/contracts";
import { mediaSrc } from "@/lib/api";
import { formatMoney } from "@/lib/money";

type Props = {
  product: ProductListItemDto | null;
  isOpen: boolean;
  onClose: () => void;
  canManage: boolean;
  onEdit?: () => void;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function ProductViewModal({
  product,
  isOpen,
  onClose,
  canManage,
  onEdit,
}: Props) {
  const imageUrl = mediaSrc(
    product?.imageUrl ?? product?.variants[0]?.imageUrl ?? null,
  );

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
        backdrop: "bg-slate-900/50 backdrop-opacity-100",
        wrapper: "overflow-hidden",
        base: "!bg-white border border-gulio-border text-gulio-text shadow-2xl",
        header: "!bg-white border-b border-gulio-border",
        body: "!bg-white",
        footer: "!bg-white border-t border-gulio-border",
      }}
    >
      <ModalContent className="!bg-white" style={{ backgroundColor: "#ffffff" }}>
        {() =>
          product ? (
            <>
              <ModalHeader className="flex flex-col gap-1 !bg-white">
                <span className="text-lg font-bold text-gulio-text">
                  {product.name}
                </span>
                <span className="text-sm font-normal text-gulio-muted">
                  {[product.brand?.name, product.category?.name]
                    .filter(Boolean)
                    .join(" · ") || "Uncategorized"}
                </span>
              </ModalHeader>
              <ModalBody className="gap-5 !bg-white py-5">
                <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
                  <div className="aspect-square overflow-hidden rounded-2xl border border-gulio-border bg-gulio-bg">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- catalog URLs
                      <img
                        src={imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-teal-100 to-slate-100 text-3xl font-bold text-teal-800">
                        {initials(product.name)}
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm leading-relaxed text-gulio-text">
                      {product.description || "No description yet."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Chip size="sm" variant="flat" color="primary">
                        {product.variants.length} variant
                        {product.variants.length === 1 ? "" : "s"}
                      </Chip>
                      {product.variants.some((v) => v.requiresSerial) ? (
                        <Chip size="sm" variant="flat" color="warning">
                          IMEI tracked
                        </Chip>
                      ) : (
                        <Chip size="sm" variant="flat">
                          Quantity SKU
                        </Chip>
                      )}
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-gulio-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gulio-bg text-xs uppercase tracking-wide text-gulio-muted">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">Variant</th>
                        <th className="px-3 py-2.5 font-medium">SKU</th>
                        <th className="px-3 py-2.5 font-medium">Barcode</th>
                        <th className="px-3 py-2.5 text-right font-medium">
                          Price
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {product.variants.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-4 text-center text-gulio-muted"
                          >
                            No active variants
                          </td>
                        </tr>
                      ) : (
                        product.variants.map((v) => (
                          <tr
                            key={v.id}
                            className="border-t border-gulio-border"
                          >
                            <td className="px-3 py-2.5 font-medium text-gulio-text">
                              {v.name}
                              {v.requiresSerial ? (
                                <span className="ml-2 text-[10px] font-semibold uppercase text-teal-700">
                                  IMEI
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xs">
                              {v.sku}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xs text-gulio-muted">
                              {v.primaryBarcode ?? "—"}
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                              {formatMoney(v.sellPrice)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </ModalBody>
              <ModalFooter className="!bg-white">
                <Button
                  variant="light"
                  radius="lg"
                  onPress={onClose}
                  className="min-h-10 font-medium"
                >
                  Close
                </Button>
                {canManage && onEdit ? (
                  <Button
                    color="primary"
                    radius="lg"
                    className="min-h-10 font-semibold"
                    onPress={() => {
                      onClose();
                      onEdit();
                    }}
                  >
                    Edit product
                  </Button>
                ) : null}
              </ModalFooter>
            </>
          ) : null
        }
      </ModalContent>
    </Modal>
  );
}
