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
  Select,
  SelectItem,
} from "@heroui/react";
import {
  Boxes,
  CalendarDays,
  ChevronDown,
  FileText,
  Hash,
  Plus,
  Receipt,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  Truck,
} from "lucide-react";
import type {
  CreateGoodsReceiptRequest,
  CreateGoodsReceiptResponse,
  CreateSupplierRequest,
  GoodsReceiptDto,
  SupplierDto,
} from "@gulio/contracts";
import { EmptyState } from "@/components/backoffice/EmptyState";
import { ProductThumb } from "@/components/backoffice/ProductThumb";
import {
  AddReceiveLineModal,
  type ReceiveLineDraft,
} from "@/components/backoffice/purchases/AddReceiveLineModal";
import { Field } from "@/components/backoffice/purchases/Field";
import {
  SupplierCombobox,
  type SupplierOption,
} from "@/components/backoffice/purchases/SupplierCombobox";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { formatMoney, lineTotal, parseMoneyInput } from "@/lib/money";
import { useToast } from "@/components/shared/Toast";

export type GoodsReceiptWarehouse = {
  id: string;
  name: string;
  isDefault: boolean;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  warehouses: GoodsReceiptWarehouse[];
  suppliers: SupplierOption[];
  suppliersLoading?: boolean;
  /** Keeps the page-level distributor list (used by the filter toolbar) fresh. */
  onSupplierCreated?: (supplier: SupplierDto) => void;
  /** Fires after the receipt is posted and stock has moved on the ledger. */
  onPosted: (receipt: GoodsReceiptDto) => void;
};

const DEFAULT_REASON = "Goods receive / intake";

const fieldClassNames = {
  label: "text-[10px] font-semibold uppercase tracking-wider text-gulio-muted",
  inputWrapper:
    "min-h-10 rounded-lg border border-gulio-border bg-white shadow-none data-[hover=true]:border-slate-300 group-data-[focus=true]:border-teal-500",
  input: "text-sm text-gulio-text",
} as const;

const btnPrimary =
  "min-h-10 rounded-md border-2 border-teal-700 bg-teal-600 px-4 font-semibold text-white shadow-sm transition hover:border-teal-800 hover:bg-teal-700 data-[hover=true]:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50";

const btnSecondary =
  "min-h-10 rounded-md border-2 border-slate-200 bg-white px-4 font-semibold text-gulio-text shadow-sm transition hover:border-slate-400 hover:bg-slate-50 data-[hover=true]:border-slate-400 data-[hover=true]:bg-slate-50";

const cardClass = "rounded-xl border border-gulio-border bg-gulio-card p-3.5 sm:p-4";

const metricClass = "rounded-lg border border-gulio-border bg-gulio-bg/60 px-3 py-2";

const sectionTitleClass =
  "flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gulio-muted";

export function NewGoodsReceiptModal({
  isOpen,
  onClose,
  warehouses,
  suppliers,
  suppliersLoading = false,
  onSupplierCreated,
  onPosted,
}: Props) {
  const { ready, token } = useAuth();
  const toast = useToast();

  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [lines, setLines] = useState<ReceiveLineDraft[]>([]);
  const [reason, setReason] = useState(DEFAULT_REASON);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [taxInput, setTaxInput] = useState("");
  const [notes, setNotes] = useState("");
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState<string | null>(null);
  const [supplierFreeText, setSupplierFreeText] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(true);

  // Fresh draft every time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setLines([]);
    setReason(DEFAULT_REASON);
    setInvoiceNumber("");
    setReceivedDate("");
    setDiscountInput("");
    setTaxInput("");
    setNotes("");
    setSupplierId(null);
    setSupplierName(null);
    setSupplierFreeText("");
    setAddOpen(false);
    setSubmitting(false);
    setError(null);
    setDetailsOpen(true);
  }, [isOpen]);

  // Default destination warehouse.
  useEffect(() => {
    if (!isOpen) return;
    setWarehouseId((prev) => {
      if (prev && warehouses.some((w) => w.id === prev)) return prev;
      if (warehouses.length === 0) return null;
      return (warehouses.find((w) => w.isDefault) ?? warehouses[0]).id;
    });
  }, [isOpen, warehouses]);

  const warehouse = useMemo(
    () => warehouses.find((w) => w.id === warehouseId) ?? null,
    [warehouses, warehouseId],
  );

  const totalUnits = lines.reduce((s, l) => s + l.quantity, 0);
  const serialLines = lines.filter((l) => l.tracksSerial).length;
  const serialUnits = lines
    .filter((l) => l.tracksSerial)
    .reduce((s, l) => s + l.quantity, 0);
  const subtotalNumber = lines.reduce(
    (sum, l) => sum + lineTotal(l.unitCost, l.quantity),
    0,
  );
  const discountDecimal = parseMoneyInput(discountInput);
  const taxDecimal = parseMoneyInput(taxInput);
  const totalNumber = Math.max(
    0,
    subtotalNumber - Number(discountDecimal) + Number(taxDecimal),
  );

  const serialsReady = lines
    .filter((l) => l.tracksSerial)
    .every((l) => l.serialNumbers.length === l.quantity);
  const canPost =
    Boolean(warehouse) &&
    lines.length > 0 &&
    reason.trim().length >= 3 &&
    serialsReady &&
    !submitting;

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function updateQty(key: string, raw: string) {
    const n = Number(raw.replace(/,/g, "").trim());
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) return l;
        return { ...l, quantity: n };
      }),
    );
  }

  function updateSerials(key: string, raw: string) {
    const serials = raw
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, serialNumbers: serials } : l)),
    );
  }

  async function createSupplier(name: string): Promise<SupplierOption | null> {
    const body: CreateSupplierRequest = { name };
    try {
      const created = await apiFetch<SupplierDto>("/purchasing/suppliers", {
        method: "POST",
        body,
      });
      onSupplierCreated?.(created);
      return { id: created.id, name: created.name };
    } catch (e) {
      toast.error(
        "Could not create distributor",
        e instanceof ApiError ? e.message : "Try again, or pick an existing one.",
      );
      return null;
    }
  }

  async function confirmReceive() {
    if (!ready || !token) return;
    if (!warehouse) {
      setError("Select a destination warehouse");
      return;
    }
    if (lines.length === 0) {
      setError("Add at least one receive line");
      return;
    }
    if (reason.trim().length < 3) {
      setError("Reason must be at least 3 characters");
      return;
    }
    for (const line of lines) {
      if (line.quantity < 1) {
        setError(`${line.sku}: quantity must be at least 1`);
        return;
      }
      if (!Number.isFinite(Number(line.unitCost)) || Number(line.unitCost) <= 0) {
        setError(`${line.sku}: enter the wholesale / unit cost`);
        return;
      }
      if (line.tracksSerial && line.serialNumbers.length !== line.quantity) {
        setError(
          `${line.sku}: enter exactly ${line.quantity} IMEI/serial${
            line.quantity === 1 ? "" : "s"
          }`,
        );
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const body: CreateGoodsReceiptRequest = {
        warehouseId: warehouse.id,
        supplierId,
        supplierName: supplierId ? null : supplierFreeText.trim() || supplierName,
        invoiceNumber: invoiceNumber.trim() || null,
        reason: reason.trim(),
        notes: notes.trim() || null,
        discountTotal: discountDecimal,
        taxTotal: taxDecimal,
        ...(receivedDate
          ? { receivedAt: new Date(`${receivedDate}T12:00:00`).toISOString() }
          : {}),
        lines: lines.map((line) => ({
          variantId: line.variantId,
          quantity: line.quantity,
          unitCost: line.unitCost,
          retailPrice: line.retailPrice,
          ...(line.tracksSerial ? { serialNumbers: line.serialNumbers } : {}),
        })),
      };

      const res = await apiFetch<CreateGoodsReceiptResponse>(
        "/purchasing/receipts",
        { method: "POST", body },
      );

      toast.success(
        "Goods receipt posted",
        `${res.receipt.totalUnits} unit${
          res.receipt.totalUnits === 1 ? "" : "s"
        } added to stock through the ledger.`,
      );
      onPosted(res.receipt);
      onClose();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Receive failed — check the sheet and try again. Nothing was posted.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open && !submitting) onClose();
        }}
        size="5xl"
        scrollBehavior="inside"
        placement="center"
        isDismissable={!submitting}
        hideCloseButton={submitting}
        classNames={{
          backdrop: "bg-slate-900/50 backdrop-opacity-100",
          base: "!bg-gulio-bg border border-gulio-border text-gulio-text shadow-2xl",
          header: "!bg-gulio-card border-b border-gulio-border",
          body: "!bg-gulio-bg",
          footer: "!bg-gulio-card border-t border-gulio-border",
        }}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-0.5 pb-3 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-white">
                <Truck className="h-4 w-4" />
              </span>
              <h2 className="text-base font-bold tracking-tight">
                New goods receipt
              </h2>
              <Chip
                size="sm"
                variant="flat"
                color="default"
                className="h-5 px-1.5 text-[10px] font-bold uppercase tracking-wide"
              >
                {lines.length} line{lines.length === 1 ? "" : "s"} · {totalUnits} unit
                {totalUnits === 1 ? "" : "s"}
              </Chip>
              {serialUnits > 0 ? (
                <Chip
                  size="sm"
                  variant="flat"
                  color="primary"
                  className="h-5 px-1.5 text-[10px] font-bold uppercase tracking-wide"
                >
                  {serialUnits} IMEI
                </Chip>
              ) : null}
            </div>
            <p className="text-xs font-normal text-gulio-muted">
              Stock enters the ledger when you post — nothing is written until then.
            </p>
          </ModalHeader>

          <ModalBody className="gap-4 py-4">
            {error ? (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
              >
                {error}
              </div>
            ) : null}

            {/* ---------------- Delivery details ---------------- */}
            <section className={cardClass}>
              <button
                type="button"
                onClick={() => setDetailsOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2"
              >
                <span className={sectionTitleClass}>
                  <Store className="h-3.5 w-3.5" />
                  Delivery details
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-gulio-muted transition-transform ${
                    detailsOpen ? "" : "-rotate-90"
                  }`}
                />
              </button>

              {detailsOpen ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <Field label="Destination warehouse" required>
                    {warehouses.length > 1 ? (
                      <Select
                        size="sm"
                        aria-label="Destination warehouse"
                        selectedKeys={new Set([warehouseId ?? ""])}
                        onSelectionChange={(keys) => {
                          if (keys === "all") return;
                          const first = Array.from(keys)[0];
                          if (first != null) setWarehouseId(String(first));
                        }}
                        classNames={fieldClassNames}
                      >
                        {warehouses.map((w) => (
                          <SelectItem key={w.id}>
                            {w.name}
                            {w.isDefault ? " (default)" : ""}
                          </SelectItem>
                        ))}
                      </Select>
                    ) : (
                      <div className="flex min-h-10 items-center justify-between rounded-lg border border-gulio-border bg-white px-3">
                        <span className="text-sm font-semibold text-gulio-text">
                          {warehouse?.name ?? "Main Store Default"}
                        </span>
                        <span className="rounded bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700 ring-1 ring-teal-200">
                          Default
                        </span>
                      </div>
                    )}
                  </Field>

                  <SupplierCombobox
                    suppliers={suppliers}
                    value={supplierId}
                    valueName={supplierName}
                    loading={suppliersLoading}
                    onChange={(next) => {
                      setSupplierId(next.id);
                      setSupplierName(next.name);
                      if (next.name) setSupplierFreeText(next.name);
                    }}
                    onInputValueChange={setSupplierFreeText}
                    onCreate={createSupplier}
                  />

                  <Field label="Invoice number">
                    <Input
                      size="sm"
                      aria-label="Invoice number"
                      value={invoiceNumber}
                      onValueChange={setInvoiceNumber}
                      startContent={
                        <FileText className="h-3.5 w-3.5 shrink-0 text-gulio-muted" />
                      }
                      classNames={fieldClassNames}
                    />
                  </Field>

                  <Field label="Received date">
                    <Input
                      size="sm"
                      type="date"
                      aria-label="Received date"
                      value={receivedDate}
                      onValueChange={setReceivedDate}
                      startContent={
                        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-gulio-muted" />
                      }
                      classNames={fieldClassNames}
                    />
                  </Field>

                  <Field
                    label="Discount total"
                    hint="Money is never floated — posted as a decimal string."
                  >
                    <Input
                      size="sm"
                      inputMode="decimal"
                      aria-label="Discount total"
                      placeholder="0"
                      value={discountInput}
                      onValueChange={setDiscountInput}
                      classNames={fieldClassNames}
                      className="tabular-nums"
                    />
                  </Field>

                  <Field label="Tax total">
                    <Input
                      size="sm"
                      inputMode="decimal"
                      aria-label="Tax total"
                      placeholder="0"
                      value={taxInput}
                      onValueChange={setTaxInput}
                      classNames={fieldClassNames}
                      className="tabular-nums"
                    />
                  </Field>

                  <Field label="Reason" required className="md:col-span-2">
                    <Input
                      size="sm"
                      aria-label="Reason"
                      placeholder="e.g. Supplier delivery, opening stock…"
                      value={reason}
                      onValueChange={setReason}
                      classNames={fieldClassNames}
                    />
                  </Field>

                  <Field label="Notes" hint="Optional — stored on the receipt for audit.">
                    <Input
                      size="sm"
                      aria-label="Notes"
                      placeholder="Anything worth remembering"
                      value={notes}
                      onValueChange={setNotes}
                      classNames={fieldClassNames}
                    />
                  </Field>
                </div>
              ) : null}
            </section>

            {/* ---------------- Receive sheet ---------------- */}
            <section className={cardClass}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={sectionTitleClass}>
                  <Boxes className="h-3.5 w-3.5" />
                  Receive sheet
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {serialLines > 0 ? (
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                        serialsReady ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {serialsReady ? "Serials complete" : "Serials pending"}
                    </span>
                  ) : null}
                  <Button
                    size="sm"
                    radius="md"
                    variant="bordered"
                    isDisabled={!warehouse}
                    onPress={() => setAddOpen(true)}
                    startContent={<Plus className="h-3.5 w-3.5" />}
                    className={btnSecondary}
                  >
                    Add line
                  </Button>
                </div>
              </div>

              {lines.length === 0 ? (
                <div className="mt-3">
                  <EmptyState
                    title="No lines yet"
                    description="Add products to receive into this warehouse. Serial-tracked devices need IMEIs before you can post."
                    action={
                      warehouse ? (
                        <Button
                          size="sm"
                          radius="md"
                          onPress={() => setAddOpen(true)}
                          startContent={<Plus className="h-3.5 w-3.5" />}
                          className={btnPrimary}
                        >
                          Add line
                        </Button>
                      ) : undefined
                    }
                  />
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {lines.map((line) => {
                    const lineTotalNumber = lineTotal(line.unitCost, line.quantity);
                    const serialsOk =
                      !line.tracksSerial ||
                      line.serialNumbers.length === line.quantity;
                    return (
                      <div
                        key={line.key}
                        className={`rounded-xl border bg-gulio-bg/40 p-3.5 ${
                          serialsOk ? "border-gulio-border" : "border-amber-300"
                        }`}
                      >
                        <div className="flex flex-wrap items-start gap-3">
                          <ProductThumb imageUrl={line.imageUrl} name={line.productName} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-gulio-text">
                              {line.productName}
                            </p>
                            <p className="truncate text-sm text-gulio-muted">
                              {line.variantName}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1 font-mono text-xs text-gulio-muted">
                              <Hash className="h-3 w-3" />
                              {line.sku}
                              {line.tracksSerial ? " · IMEI required" : ""}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-end gap-3">
                            <Field label="Qty" className="w-24">
                              <Input
                                size="sm"
                                aria-label="Quantity"
                                inputMode="numeric"
                                value={String(line.quantity)}
                                onValueChange={(next) => updateQty(line.key, next)}
                                classNames={fieldClassNames}
                                className="tabular-nums"
                              />
                            </Field>
                            <div className="text-right">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                                Wholesale
                              </p>
                              <p className="text-sm font-semibold tabular-nums text-gulio-text">
                                {formatMoney(line.unitCost)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                                Retail
                              </p>
                              <p className="text-sm tabular-nums text-gulio-muted">
                                {formatMoney(line.retailPrice)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                                Line total
                              </p>
                              <p className="text-sm font-bold tabular-nums text-gulio-text">
                                {formatMoney(lineTotalNumber)}
                              </p>
                            </div>
                            <Button
                              isIconOnly
                              size="sm"
                              radius="md"
                              variant="bordered"
                              aria-label={`Remove ${line.sku}`}
                              onPress={() => removeLine(line.key)}
                              className="min-h-9 border-2 border-slate-200 bg-white text-gulio-muted hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {line.tracksSerial ? (
                          <div className="mt-3">
                            <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-gulio-muted">
                              <span>IMEI / serials</span>
                              <span
                                className={`font-semibold tabular-nums ${
                                  serialsOk ? "text-emerald-700" : "text-amber-700"
                                }`}
                              >
                                {line.serialNumbers.length}/{line.quantity}
                              </span>
                            </label>
                            <textarea
                              value={line.serialNumbers.join("\n")}
                              onChange={(e) => updateSerials(line.key, e.target.value)}
                              rows={Math.min(4, Math.max(2, line.quantity))}
                              placeholder="One IMEI per line — paste a list to fill fast"
                              className="w-full rounded-xl border border-gulio-border px-3.5 py-2.5 font-mono text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                            />
                          </div>
                        ) : (
                          <p className="mt-3 text-xs text-gulio-muted">
                            Quantity item — no serial scan required
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ---------------- Amounts ---------------- */}
            <section className={cardClass}>
              <span className={sectionTitleClass}>
                <Receipt className="h-3.5 w-3.5" />
                Amounts
              </span>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                <div className={metricClass}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                    Subtotal
                  </p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-gulio-text">
                    {formatMoney(subtotalNumber)}
                  </p>
                </div>
                <div className={metricClass}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                    Discount
                  </p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-amber-700">
                    −{formatMoney(discountDecimal)}
                  </p>
                </div>
                <div className={metricClass}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                    Tax
                  </p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-gulio-text">
                    {formatMoney(taxDecimal)}
                  </p>
                </div>
                <div className={metricClass}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                    Receipt total
                  </p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-teal-800">
                    {formatMoney(totalNumber)}
                  </p>
                </div>
                <div className={metricClass}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                    Units
                  </p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-gulio-text">
                    {totalUnits}
                  </p>
                </div>
                <div className={metricClass}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                    Distributor
                  </p>
                  <p className="mt-0.5 truncate text-sm font-bold text-gulio-text">
                    {supplierName ?? (supplierFreeText.trim() || "—")}
                  </p>
                </div>
              </div>
            </section>
          </ModalBody>

          <ModalFooter className="justify-between gap-2.5 py-3.5">
            <p className="flex items-center gap-1.5 text-xs text-gulio-muted">
              <Sparkles className="h-3.5 w-3.5 text-teal-600" />
              <span className="font-semibold tabular-nums text-gulio-text">
                {formatMoney(totalNumber)}
              </span>
              <span>
                · {totalUnits} unit{totalUnits === 1 ? "" : "s"} across {lines.length}{" "}
                line{lines.length === 1 ? "" : "s"}
              </span>
            </p>
            <div className="flex items-center gap-2.5">
              <Button
                radius="md"
                variant="bordered"
                isDisabled={submitting}
                onPress={onClose}
                className={btnSecondary}
              >
                Cancel
              </Button>
              <Button
                radius="md"
                isDisabled={!canPost}
                isLoading={submitting}
                onPress={() => void confirmReceive()}
                className={btnPrimary}
              >
                {submitting ? "Posting to ledger…" : "Confirm receive"}
              </Button>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {warehouse ? (
        <AddReceiveLineModal
          isOpen={addOpen}
          onClose={() => setAddOpen(false)}
          excludeVariantIds={lines.map((l) => l.variantId)}
          onAdd={(line) => setLines((prev) => [...prev, line])}
        />
      ) : null}
    </>
  );
}
