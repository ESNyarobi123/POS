"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { Pencil, Trash2, X } from "lucide-react";
import type {
  RemoveSerialUnitResult,
  SerialStatus,
  SerialUnitDto,
  UpdateSerialUnitRequest,
  VariantSerialPanelDto,
} from "@gulio/contracts";
import { ProductThumb } from "@/components/backoffice/ProductThumb";
import { ApiError, apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { useToast } from "@/components/shared/Toast";

type Props = {
  isOpen: boolean;
  variantId: string | null;
  warehouseId: string;
  onClose: () => void;
  onStockChanged: () => void;
};

const inputClass =
  "w-full rounded-xl border border-gulio-border bg-white px-3.5 py-2.5 text-sm text-gulio-text outline-none transition placeholder:text-gulio-muted/70 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

const DELETABLE: ReadonlySet<SerialStatus> = new Set([
  "IN_STOCK",
  "DAMAGED",
  "RETURNED",
  "IN_REPAIR",
  "SUPPLIER_RETURN",
]);

function statusChip(status: SerialStatus): {
  color: "success" | "warning" | "danger" | "default" | "primary";
  label: string;
} {
  switch (status) {
    case "IN_STOCK":
      return { color: "success", label: "In stock" };
    case "RESERVED":
      return { color: "warning", label: "Reserved" };
    case "SOLD":
      return { color: "default", label: "Sold" };
    case "RETURNED":
      return { color: "primary", label: "Returned" };
    case "DAMAGED":
      return { color: "danger", label: "Damaged" };
    case "IN_REPAIR":
      return { color: "warning", label: "In repair" };
    case "SUPPLIER_RETURN":
      return { color: "warning", label: "Supplier return" };
    case "TRANSFERRED":
      return { color: "default", label: "Transferred" };
    case "REMOVED":
      return { color: "danger", label: "Removed" };
    default:
      return { color: "default", label: status };
  }
}

export function InventorySerialsModal({
  isOpen,
  variantId,
  warehouseId,
  onClose,
  onStockChanged,
}: Props) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<VariantSerialPanelDto | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editReason, setEditReason] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isOpen || !variantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<VariantSerialPanelDto>(
        `/inventory/variants/${encodeURIComponent(variantId)}/serials?warehouseId=${encodeURIComponent(warehouseId)}`,
      );
      setPanel(data);
    } catch (e) {
      setPanel(null);
      setError(
        e instanceof ApiError ? e.message : "Could not load product serials",
      );
    } finally {
      setLoading(false);
    }
  }, [isOpen, variantId, warehouseId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isOpen) {
      setPanel(null);
      setError(null);
      setEditingId(null);
      setRemovingId(null);
      setEditValue("");
      setEditReason("");
      setRemoveReason("");
      setBusyId(null);
    }
  }, [isOpen]);

  function startEdit(serial: SerialUnitDto) {
    setRemovingId(null);
    setEditingId(serial.id);
    setEditValue(serial.serialNumber);
    setEditReason("");
  }

  function startRemove(serial: SerialUnitDto) {
    setEditingId(null);
    setRemovingId(serial.id);
    setRemoveReason("");
  }

  async function saveEdit(serialId: string) {
    setBusyId(serialId);
    setError(null);
    try {
      const body: UpdateSerialUnitRequest = {
        serialNumber: editValue,
        reason: editReason,
      };
      await apiFetch<SerialUnitDto>(`/inventory/serials/${serialId}`, {
        method: "PATCH",
        body,
      });
      toast.success("IMEI updated", "The serial number was saved.");
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update serial");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmRemove(serialId: string) {
    setBusyId(serialId);
    setError(null);
    try {
      await apiFetch<RemoveSerialUnitResult>(
        `/inventory/serials/${serialId}/remove`,
        {
          method: "POST",
          body: { reason: removeReason },
        },
      );
      toast.success("Serial removed", "Stock ledger was updated.");
      setRemovingId(null);
      await load();
      onStockChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not remove serial");
    } finally {
      setBusyId(null);
    }
  }

  const title = panel?.productName ?? "Product serials";

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
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1 !bg-white">
              <span className="text-lg font-bold text-gulio-text">{title}</span>
              <span className="text-sm font-normal text-gulio-muted">
                {panel
                  ? [panel.brandName, panel.categoryName, panel.sku]
                      .filter(Boolean)
                      .join(" · ")
                  : "Owner-only IMEI inspector"}
              </span>
            </ModalHeader>
            <ModalBody className="gap-5 !bg-white py-5">
              {error ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </p>
              ) : null}

              {loading ? (
                <div className="space-y-3">
                  <div className="h-24 animate-pulse rounded-2xl bg-gulio-bg" />
                  <div className="h-20 animate-pulse rounded-xl bg-gulio-bg" />
                  <div className="h-20 animate-pulse rounded-xl bg-gulio-bg" />
                </div>
              ) : panel ? (
                <>
                  <div className="flex items-start gap-4">
                    <ProductThumb
                      imageUrl={panel.imageUrl}
                      name={panel.productName}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-base font-semibold text-gulio-text">
                        {panel.productName}
                      </p>
                      <p className="text-sm text-gulio-muted">
                        {panel.variantName}
                        {panel.tracksSerial ? " · IMEI tracked" : " · Quantity SKU"}
                      </p>
                      {panel.productDescription ? (
                        <p className="line-clamp-2 text-sm text-gulio-text/80">
                          {panel.productDescription}
                        </p>
                      ) : null}
                      <p className="text-sm font-semibold tabular-nums text-gulio-text">
                        {formatMoney(panel.sellPrice)}
                      </p>
                      <p className="text-sm text-gulio-muted">
                        {Number(panel.quantityAvailable)} available ·{" "}
                        {panel.warehouseName}
                      </p>
                    </div>
                  </div>

                  {!panel.tracksSerial ? (
                    <p className="rounded-xl border border-gulio-border bg-gulio-bg px-4 py-3 text-sm text-gulio-muted">
                      This SKU is not IMEI-tracked, so there is no serial list.
                    </p>
                  ) : panel.serials.length === 0 ? (
                    <p className="rounded-xl border border-gulio-border bg-gulio-bg px-4 py-3 text-sm text-gulio-muted">
                      No serials in this warehouse yet. Add stock with IMEIs to
                      populate this list.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {panel.serials.map((serial) => {
                        const chip = statusChip(serial.status);
                        const editing = editingId === serial.id;
                        const removing = removingId === serial.id;
                        const busy = busyId === serial.id;
                        const canDelete = DELETABLE.has(serial.status);
                        return (
                          <li
                            key={serial.id}
                            className="rounded-xl border border-gulio-border bg-white p-3.5 shadow-sm"
                          >
                            <div className="flex items-start gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="font-mono text-sm font-semibold tracking-wide text-gulio-text">
                                  {serial.serialNumber}
                                </p>
                                <div className="mt-1.5">
                                  <Chip size="sm" variant="flat" color={chip.color}>
                                    {chip.label}
                                  </Chip>
                                </div>
                              </div>
                              {serial.status !== "REMOVED" ? (
                                <div className="flex shrink-0 gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="flat"
                                    className="min-h-9 min-w-9 px-2"
                                    aria-label={`Edit ${serial.serialNumber}`}
                                    isDisabled={busy}
                                    onPress={() =>
                                      editing
                                        ? setEditingId(null)
                                        : startEdit(serial)
                                    }
                                  >
                                    {editing ? <X size={15} /> : <Pencil size={15} />}
                                  </Button>
                                  {canDelete ? (
                                    <Button
                                      size="sm"
                                      variant="flat"
                                      color="danger"
                                      className="min-h-9 min-w-9 px-2"
                                      aria-label={`Remove ${serial.serialNumber}`}
                                      isDisabled={busy}
                                      onPress={() =>
                                        removing
                                          ? setRemovingId(null)
                                          : startRemove(serial)
                                      }
                                    >
                                      {removing ? (
                                        <X size={15} />
                                      ) : (
                                        <Trash2 size={15} />
                                      )}
                                    </Button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>

                            {editing ? (
                              <div className="mt-3 space-y-2 border-t border-gulio-border pt-3">
                                <label className="block text-xs font-semibold text-gulio-muted">
                                  New IMEI / serial
                                  <input
                                    className={`${inputClass} mt-1`}
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    autoComplete="off"
                                  />
                                </label>
                                <label className="block text-xs font-semibold text-gulio-muted">
                                  Reason
                                  <input
                                    className={`${inputClass} mt-1`}
                                    value={editReason}
                                    onChange={(e) => setEditReason(e.target.value)}
                                    placeholder="Why is this serial changing?"
                                  />
                                </label>
                                <Button
                                  size="sm"
                                  color="primary"
                                  className="min-h-9 font-semibold"
                                  isLoading={busy}
                                  onPress={() => void saveEdit(serial.id)}
                                >
                                  Save serial
                                </Button>
                              </div>
                            ) : null}

                            {removing ? (
                              <div className="mt-3 space-y-2 border-t border-rose-100 pt-3">
                                <p className="text-xs text-rose-800">
                                  {serial.status === "IN_STOCK"
                                    ? "This writes the unit off the ledger (−1) and hides it. Sales history is kept."
                                    : "This hides the serial. On-hand qty does not change because it is not in stock."}
                                </p>
                                <label className="block text-xs font-semibold text-gulio-muted">
                                  Reason
                                  <input
                                    className={`${inputClass} mt-1`}
                                    value={removeReason}
                                    onChange={(e) =>
                                      setRemoveReason(e.target.value)
                                    }
                                    placeholder="Why remove this serial?"
                                  />
                                </label>
                                <Button
                                  size="sm"
                                  color="danger"
                                  className="min-h-9 font-semibold"
                                  isLoading={busy}
                                  onPress={() => void confirmRemove(serial.id)}
                                >
                                  Remove serial
                                </Button>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              ) : null}
            </ModalBody>
            <ModalFooter className="!bg-white">
              <Button
                variant="bordered"
                className="min-h-10 font-semibold"
                onPress={onClose}
              >
                Close
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
