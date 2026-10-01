"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Chip,
  Input,
  Select,
  SelectItem,
  type SortDescriptor,
} from "@heroui/react";
import type {
  CreateGoodsReceiptRequest,
  CreateGoodsReceiptResponse,
  CreateSupplierRequest,
  GoodsReceiptDto,
  GoodsReceiptListResponse,
  SupplierDto,
  SupplierListResponse,
} from "@gulio/contracts";
import { EmptyState } from "@/components/backoffice/EmptyState";
import { PageHeader } from "@/components/backoffice/PageHeader";
import { PermissionGate } from "@/components/backoffice/PermissionGate";
import { ProductThumb } from "@/components/backoffice/ProductThumb";
import {
  AddReceiveLineModal,
  type ReceiveLineDraft,
} from "@/components/backoffice/purchases/AddReceiveLineModal";
import {
  EMPTY_RECEIPT_FILTERS,
  ReceiptFiltersToolbar,
  type Option,
  type ReceiptFilterState,
} from "@/components/backoffice/purchases/ReceiptFiltersToolbar";
import { ReceiptDetailDrawer } from "@/components/backoffice/purchases/ReceiptDetailDrawer";
import { ReceiptHistoryTable } from "@/components/backoffice/purchases/ReceiptHistoryTable";
import { ReceiptSummaryStrip } from "@/components/backoffice/purchases/ReceiptSummaryStrip";
import { RecordPaymentModal } from "@/components/backoffice/purchases/RecordPaymentModal";
import {
  SupplierCombobox,
  type SupplierOption,
} from "@/components/backoffice/purchases/SupplierCombobox";
import {
  DEFAULT_RECEIPT_COLUMNS,
  RECEIPT_COLUMNS,
  loadVisibleReceiptColumns,
  saveVisibleReceiptColumns,
  visibleReceiptColumns,
  type ReceiptColumnKey,
} from "@/components/backoffice/purchases/receipt-columns";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { useBranchContext } from "@/lib/branch-context";
import { formatMoney, lineTotal, parseMoneyInput } from "@/lib/money";
import { PermissionCode } from "@/lib/permissions";
import { useToast } from "@/components/shared/Toast";

const PAGE_SIZE = 20;

const btnPrimary =
  "inline-flex min-h-touch items-center rounded-md border-2 border-teal-700 bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:border-teal-800 hover:bg-teal-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50";

const btnSecondary =
  "inline-flex min-h-touch items-center rounded-md border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-gulio-text shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

const fieldClassNames = {
  label: "text-[10px] font-semibold uppercase tracking-wider text-gulio-muted",
  inputWrapper:
    "min-h-10 rounded-lg border border-gulio-border bg-white shadow-none data-[hover=true]:border-slate-300 group-data-[focus=true]:border-teal-500",
  input: "text-sm text-gulio-text",
} as const;

const smallMetric =
  "rounded-lg border border-gulio-border bg-gulio-bg/60 px-3 py-2";

type SuccessState = {
  invoiceNumber: string | null;
  lines: number;
  units: number;
  variantIds: string[];
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function countActiveFilters(
  filters: ReceiptFilterState,
  workspaceBranchId: string | null,
): number {
  let count = 0;
  if (filters.search.trim()) count += 1;
  if (filters.supplierId) count += 1;
  // The workspace branch scope is context, not a user-applied filter.
  if (filters.branchId && filters.branchId !== (workspaceBranchId ?? "")) {
    count += 1;
  }
  if (filters.warehouseId) count += 1;
  if (filters.status) count += 1;
  if (filters.paymentStatus) count += 1;
  if (filters.from) count += 1;
  if (filters.to) count += 1;
  return count;
}

export default function ReceiveStockPage() {
  return (
    <PermissionGate permission={PermissionCode.STOCK_ADJUST}>
      <ReceiveStockPageInner />
    </PermissionGate>
  );
}

function ReceiveStockPageInner() {
  const { ready, token } = useAuth();
  const toast = useToast();
  const {
    selectedBranchId,
    selectedBranch,
    allBranches,
    allWarehouses,
    targetWarehouses,
  } = useBranchContext();

  // Branch-scoped warehouses from the shared branch context (UUID ids only).
  const warehouses = targetWarehouses;

  // ---- Receive form ------------------------------------------------------
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [lines, setLines] = useState<ReceiveLineDraft[]>([]);
  const [reason, setReason] = useState("Goods receive / intake");
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
  const [success, setSuccess] = useState<SuccessState | null>(null);

  // ---- Suppliers ---------------------------------------------------------
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);

  // ---- History -----------------------------------------------------------
  const [filters, setFilters] = useState<ReceiptFilterState>({
    ...EMPTY_RECEIPT_FILTERS,
  });
  const [page, setPage] = useState(1);
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "receivedAt",
    direction: "descending",
  });
  const [data, setData] = useState<GoodsReceiptListResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [visibleColumns, setVisibleColumns] = useState<ReceiptColumnKey[]>(
    DEFAULT_RECEIPT_COLUMNS,
  );

  // ---- Detail + payments -------------------------------------------------
  const [selectedReceipt, setSelectedReceipt] = useState<GoodsReceiptDto | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailRefreshToken, setDetailRefreshToken] = useState(0);
  const [paymentReceipt, setPaymentReceipt] = useState<GoodsReceiptDto | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const requestSeq = useRef(0);
  const debouncedSearch = useDebouncedValue(filters.search, 300);

  // Column preference persistence.
  useEffect(() => {
    setVisibleColumns(loadVisibleReceiptColumns());
  }, []);

  // Default warehouse (mirrors the previous behaviour).
  useEffect(() => {
    if (warehouses.length === 0) {
      setWarehouseId(null);
      return;
    }
    setWarehouseId((prev) => {
      if (prev && warehouses.some((w) => w.id === prev)) return prev;
      const def = warehouses.find((w) => w.isDefault) ?? warehouses[0];
      return def.id;
    });
  }, [warehouses]);

  const warehouse = useMemo(
    () => warehouses.find((w) => w.id === warehouseId) ?? null,
    [warehouses, warehouseId],
  );

  // Keep the history branch filter aligned with the global branch switcher.
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      branchId: selectedBranchId ?? "",
      warehouseId: "",
    }));
  }, [selectedBranchId]);

  const loadSuppliers = useCallback(async () => {
    if (!ready || !token) return;
    setSuppliersLoading(true);
    try {
      const res = await apiFetch<SupplierListResponse>(
        "/purchasing/suppliers?includeInactive=false",
      );
      setSuppliers(res.items);
    } catch {
      // Non-fatal: filters and the combobox fall back to free text.
    } finally {
      setSuppliersLoading(false);
    }
  }, [ready, token]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  const supplierOptions: Option[] = useMemo(
    () =>
      suppliers.map((s) => ({
        value: s.id,
        label: s.isActive ? s.name : `${s.name} (inactive)`,
      })),
    [suppliers],
  );

  const branchOptions: Option[] = useMemo(
    () => allBranches.map((b) => ({ value: b.id, label: b.name })),
    [allBranches],
  );

  const warehouseOptions: Option[] = useMemo(
    () =>
      allWarehouses
        .filter((w) => !filters.branchId || w.branchId === filters.branchId)
        .map((w) => ({ value: w.id, label: w.name })),
    [allWarehouses, filters.branchId],
  );

  // ---- History query -----------------------------------------------------
  const sortDef = useMemo(
    () => RECEIPT_COLUMNS.find((c) => c.key === String(sortDescriptor.column)),
    [sortDescriptor.column],
  );
  const sortKey = sortDef?.sortKey ?? "receivedAt";
  const sortDir = sortDescriptor.direction === "ascending" ? "asc" : "desc";

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    const search = debouncedSearch.trim();
    if (search) params.set("search", search);
    if (filters.supplierId) params.set("supplierId", filters.supplierId);
    if (filters.branchId) params.set("branchId", filters.branchId);
    if (filters.warehouseId) params.set("warehouseId", filters.warehouseId);
    if (filters.status) params.set("status", filters.status);
    if (filters.paymentStatus) params.set("paymentStatus", filters.paymentStatus);
    if (filters.from) {
      params.set("from", new Date(`${filters.from}T00:00:00`).toISOString());
    }
    if (filters.to) {
      params.set("to", new Date(`${filters.to}T23:59:59.999`).toISOString());
    }
    params.set("sort", sortKey);
    params.set("dir", sortDir);
    return params.toString();
  }, [debouncedSearch, filters, sortKey, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [queryString]);

  useEffect(() => {
    if (!ready || !token) return;
    const seq = ++requestSeq.current;
    setHistoryLoading(true);
    setHistoryError(null);
    void (async () => {
      try {
        const res = await apiFetch<GoodsReceiptListResponse>(
          `/purchasing/receipts?${queryString}&page=${page}&pageSize=${PAGE_SIZE}`,
        );
        if (seq === requestSeq.current) setData(res);
      } catch (e) {
        if (seq === requestSeq.current) {
          setHistoryError(
            e instanceof ApiError ? e.message : "Could not load receipt history",
          );
        }
      } finally {
        if (seq === requestSeq.current) setHistoryLoading(false);
      }
    })();
  }, [ready, token, queryString, page, reloadKey]);

  const activeFilterCount = useMemo(
    () => countActiveFilters(filters, selectedBranchId),
    [filters, selectedBranchId],
  );

  const columns = useMemo(
    () => visibleReceiptColumns(visibleColumns),
    [visibleColumns],
  );

  function toggleColumn(key: ReceiptColumnKey, visible: boolean) {
    setVisibleColumns((prev) => {
      const next = visible
        ? Array.from(new Set([...prev, key]))
        : prev.filter((k) => k !== key);
      const ordered = RECEIPT_COLUMNS.filter((c) => next.includes(c.key)).map(
        (c) => c.key,
      );
      saveVisibleReceiptColumns(ordered);
      return ordered;
    });
  }

  function resetColumns() {
    const defaults = [...DEFAULT_RECEIPT_COLUMNS];
    setVisibleColumns(defaults);
    saveVisibleReceiptColumns(defaults);
  }

  // ---- Receive sheet -----------------------------------------------------
  const totalUnits = lines.reduce((s, l) => s + l.quantity, 0);
  const serialLines = lines.filter((l) => l.tracksSerial).length;
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
      setSuppliers((prev) => [
        created,
        ...prev.filter((s) => s.id !== created.id),
      ]);
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
      setError("Select a warehouse");
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
        setError(`${line.sku}: quantity must be ≥ 1`);
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
    setSuccess(null);

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

      const variantIds = Array.from(
        new Set(res.receipt.lines.map((l) => l.variantId)),
      );
      setSuccess({
        invoiceNumber: res.receipt.invoiceNumber,
        lines: res.receipt.lineCount,
        units: res.receipt.totalUnits,
        variantIds,
      });
      setLines([]);
      setSupplierId(null);
      setSupplierName(null);
      setSupplierFreeText("");
      setInvoiceNumber("");
      setDiscountInput("");
      setTaxInput("");
      setNotes("");
      setReloadKey((k) => k + 1);
      if (res.receipt.supplierId) void loadSuppliers();
      toast.success(
        "Goods receipt posted",
        `${res.receipt.totalUnits} unit${
          res.receipt.totalUnits === 1 ? "" : "s"
        } added to stock through the ledger.`,
      );
    } catch (e) {
      toast.error(
        "Receive failed",
        e instanceof ApiError
          ? e.message
          : "Check the sheet and try again — nothing was posted.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const labelsHref =
    success && success.variantIds.length > 0
      ? `/labels?variantIds=${encodeURIComponent(success.variantIds.join(","))}`
      : "/labels";

  const summary = data?.summary ?? null;

  const rangeLabel = useMemo(() => {
    const parts: string[] = [];
    parts.push(selectedBranch ? selectedBranch.name : "All branches");
    if (filters.from && filters.to) parts.push(`${filters.from} → ${filters.to}`);
    else if (filters.from) parts.push(`From ${filters.from}`);
    else if (filters.to) parts.push(`To ${filters.to}`);
    return parts.join(" · ");
  }, [selectedBranch, filters.from, filters.to]);

  return (
    <div className="flex min-h-[calc(100vh-7.5rem)] flex-col">
      <PageHeader
        title="Receive stock"
        subtitle={
          selectedBranch
            ? `Purchasing workspace for ${selectedBranch.name} (${selectedBranch.code}) — receipts post straight to the stock ledger`
            : "Purchasing workspace — record goods receipts against distributors and track what is still owed"
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/inventory" className={btnSecondary}>
              Inventory
            </Link>
            <Link href="/labels" className={btnSecondary}>
              Labels
            </Link>
          </div>
        }
      />

      {success ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <span>
            Posted{" "}
            <span className="font-semibold tabular-nums">{success.units}</span>{" "}
            unit{success.units === 1 ? "" : "s"} across{" "}
            <span className="font-semibold tabular-nums">{success.lines}</span>{" "}
            line{success.lines === 1 ? "" : "s"}
            {success.invoiceNumber ? (
              <>
                {" "}
                on invoice{" "}
                <span className="font-mono font-semibold">
                  {success.invoiceNumber}
                </span>
              </>
            ) : null}{" "}
            via the stock ledger.
          </span>
          <div className="flex flex-wrap gap-2">
            <Link href={labelsHref} className={btnPrimary}>
              Create labels
            </Link>
            <button
              type="button"
              onClick={() => setSuccess(null)}
              className={btnSecondary}
            >
              New receive
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {/* New goods receipt                                                */}
      {/* ---------------------------------------------------------------- */}
      <section
        aria-label="New goods receipt"
        className="mb-5 rounded-xl border border-gulio-border bg-gulio-card p-4 shadow-sm sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold tracking-tight text-gulio-text">
              New goods receipt
            </h2>
            <p className="mt-0.5 text-xs text-gulio-muted">
              Stock enters the ledger when you post this receipt — nothing is
              written until then.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip
              size="sm"
              variant="flat"
              color="default"
              className="h-6 px-2 text-[10px] font-bold uppercase tracking-wide"
            >
              {lines.length} line{lines.length === 1 ? "" : "s"} · {totalUnits} unit
              {totalUnits === 1 ? "" : "s"}
            </Chip>
            {serialLines > 0 ? (
              <Chip
                size="sm"
                variant="flat"
                color="primary"
                className="h-6 px-2 text-[10px] font-bold uppercase tracking-wide"
              >
                {serialLines} serial-tracked
              </Chip>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <p className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-gulio-muted">
              Destination warehouse
              <Link
                href="/settings"
                className="text-[10px] font-semibold normal-case tracking-normal text-teal-600 hover:text-teal-800 hover:underline"
              >
                Manage →
              </Link>
            </p>
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
                classNames={{
                  trigger:
                    "min-h-10 rounded-lg border border-gulio-border bg-white shadow-none data-[hover=true]:border-slate-300",
                  value: "text-sm font-semibold text-gulio-text",
                  popoverContent: "rounded-xl border border-gulio-border",
                }}
              >
                {warehouses.map((w) => (
                  <SelectItem key={w.id}>
                    {w.name}
                    {w.isDefault ? " (Default)" : ""}
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
          </div>

          <SupplierCombobox
            suppliers={supplierOptions.map((o) => ({ id: o.value, name: o.label }))}
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

          <Input
            size="sm"
            label="Invoice number"
            placeholder="Supplier invoice / delivery note"
            value={invoiceNumber}
            onValueChange={setInvoiceNumber}
            classNames={fieldClassNames}
          />

          <Input
            size="sm"
            type="date"
            label="Received date"
            value={receivedDate}
            onValueChange={setReceivedDate}
            classNames={fieldClassNames}
          />

          <Input
            size="sm"
            label="Discount total"
            inputMode="decimal"
            placeholder="0"
            value={discountInput}
            onValueChange={setDiscountInput}
            classNames={fieldClassNames}
          />

          <Input
            size="sm"
            label="Tax total"
            inputMode="decimal"
            placeholder="0"
            value={taxInput}
            onValueChange={setTaxInput}
            classNames={fieldClassNames}
          />

          <Input
            isRequired
            size="sm"
            label="Reason"
            placeholder="e.g. Supplier delivery, opening stock…"
            value={reason}
            onValueChange={setReason}
            classNames={fieldClassNames}
            className="md:col-span-2"
          />

          <Input
            size="sm"
            label="Notes"
            placeholder="Optional note for the audit trail"
            value={notes}
            onValueChange={setNotes}
            classNames={fieldClassNames}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-gulio-text">Receive sheet</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              disabled={!warehouse}
              className={btnSecondary}
            >
              Add line
            </button>
          </div>
        </div>

        {lines.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No lines yet"
              description="Add products to receive into this warehouse. Serial-tracked devices need IMEIs before you can post."
              action={
                warehouse ? (
                  <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    className={btnPrimary}
                  >
                    Add line
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {lines.map((line) => {
              const lineTotalNumber = lineTotal(line.unitCost, line.quantity);
              return (
                <div
                  key={line.key}
                  className="rounded-xl border border-gulio-border bg-gulio-bg/40 p-3.5 sm:p-4"
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
                      <p className="mt-0.5 font-mono text-xs text-gulio-muted">
                        {line.sku}
                        {line.tracksSerial ? " · IMEI required" : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-end gap-3">
                      <div className="w-24">
                        <Input
                          size="sm"
                          label="Qty"
                          inputMode="numeric"
                          value={String(line.quantity)}
                          onValueChange={(next) => updateQty(line.key, next)}
                          classNames={fieldClassNames}
                          className="tabular-nums"
                        />
                      </div>
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
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        className="rounded-md border-2 border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-gulio-muted transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {line.tracksSerial ? (
                    <div className="mt-3">
                      <label className="mb-1.5 block text-xs font-medium text-gulio-muted">
                        IMEI / serials ({line.serialNumbers.length}/{line.quantity})
                      </label>
                      <textarea
                        value={line.serialNumbers.join("\n")}
                        onChange={(e) => updateSerials(line.key, e.target.value)}
                        rows={Math.min(4, Math.max(2, line.quantity))}
                        placeholder="One IMEI per line"
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

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <div className={smallMetric}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
              Subtotal
            </p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-gulio-text">
              {formatMoney(subtotalNumber)}
            </p>
          </div>
          <div className={smallMetric}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
              Discount
            </p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-amber-700">
              −{formatMoney(discountDecimal)}
            </p>
          </div>
          <div className={smallMetric}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
              Tax
            </p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-gulio-text">
              {formatMoney(taxDecimal)}
            </p>
          </div>
          <div className={smallMetric}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
              Receipt total
            </p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-teal-800">
              {formatMoney(totalNumber)}
            </p>
          </div>
          <div className={smallMetric}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
              Units
            </p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-gulio-text">
              {totalUnits}
            </p>
          </div>
          <div className={smallMetric}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
              Distributor
            </p>
            <p className="mt-0.5 truncate text-sm font-bold text-gulio-text">
              {supplierName ?? (supplierFreeText.trim() || "—")}
            </p>
          </div>
        </div>

        {lines.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void confirmReceive()}
              disabled={submitting || !warehouse}
              className={btnPrimary}
            >
              {submitting ? "Posting to ledger…" : "Confirm receive"}
            </button>
            <button
              type="button"
              onClick={() => setLines([])}
              disabled={submitting}
              className={btnSecondary}
            >
              Clear sheet
            </button>
          </div>
        ) : null}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Filters + search (directly below the receive form)               */}
      {/* ---------------------------------------------------------------- */}
      <div className="mb-5">
        <ReceiptFiltersToolbar
          value={filters}
          onChange={(patch) => {
            setFilters((prev) => ({ ...prev, ...patch }));
            setPage(1);
          }}
          onReset={() => {
            setFilters({ ...EMPTY_RECEIPT_FILTERS, branchId: selectedBranchId ?? "" });
            setPage(1);
          }}
          loading={historyLoading}
          activeCount={activeFilterCount}
          suppliers={supplierOptions}
          branches={branchOptions}
          warehouses={warehouseOptions}
          visibleColumns={visibleColumns}
          onToggleColumn={toggleColumn}
          onResetColumns={resetColumns}
        />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Summary strip                                                     */}
      {/* ---------------------------------------------------------------- */}
      <div className="mb-5">
        <ReceiptSummaryStrip
          summary={summary}
          loading={historyLoading && !data}
          rangeLabel={rangeLabel}
        />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Receipt history                                                   */}
      {/* ---------------------------------------------------------------- */}
      <ReceiptHistoryTable
        items={data?.items ?? []}
        columns={columns}
        loading={historyLoading}
        error={historyError}
        onRetry={() => setReloadKey((k) => k + 1)}
        sortDescriptor={sortDescriptor}
        onSortChange={(descriptor) => {
          setSortDescriptor(descriptor);
          setPage(1);
        }}
        page={page}
        pageSize={PAGE_SIZE}
        total={data?.total ?? 0}
        onPageChange={setPage}
        onOpenReceipt={(receipt) => {
          setSelectedReceipt(receipt);
          setDrawerOpen(true);
        }}
      />

      {warehouse ? (
        <AddReceiveLineModal
          isOpen={addOpen}
          onClose={() => setAddOpen(false)}
          excludeVariantIds={lines.map((l) => l.variantId)}
          onAdd={(line) => setLines((prev) => [...prev, line])}
        />
      ) : null}

      <ReceiptDetailDrawer
        isOpen={drawerOpen}
        receiptId={selectedReceipt?.id ?? null}
        fallback={selectedReceipt}
        refreshToken={detailRefreshToken}
        canRecordPayment
        onClose={() => setDrawerOpen(false)}
        onRecordPayment={(receipt) => {
          setPaymentReceipt(receipt);
          setPaymentOpen(true);
        }}
      />

      <RecordPaymentModal
        isOpen={paymentOpen}
        receipt={paymentReceipt}
        onClose={() => setPaymentOpen(false)}
        onSaved={() => {
          setDetailRefreshToken((t) => t + 1);
          setReloadKey((k) => k + 1);
        }}
      />
    </div>
  );
}
