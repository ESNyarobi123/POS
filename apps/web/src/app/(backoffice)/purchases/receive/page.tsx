"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { SortDescriptor } from "@heroui/react";
import type {
  GoodsReceiptDto,
  GoodsReceiptListResponse,
  SupplierDto,
  SupplierListResponse,
} from "@gulio/contracts";
import { PageHeader } from "@/components/backoffice/PageHeader";
import { PermissionGate } from "@/components/backoffice/PermissionGate";
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
import { NewGoodsReceiptModal } from "@/components/backoffice/purchases/NewGoodsReceiptModal";
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
import { PermissionCode } from "@/lib/permissions";

const PAGE_SIZE = 20;

const btnPrimary =
  "inline-flex min-h-touch items-center rounded-md border-2 border-teal-700 bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:border-teal-800 hover:bg-teal-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50";

const btnSecondary =
  "inline-flex min-h-touch items-center rounded-md border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-gulio-text shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

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
  // The draft itself lives in NewGoodsReceiptModal; the page only owns the
  // open/closed state and the "posted" confirmation banner.
  const [receiptOpen, setReceiptOpen] = useState(false);
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

  // Distributor list in the shape the receipt modal's combobox expects.
  const receiptSupplierOptions = useMemo(
    () => supplierOptions.map((o) => ({ id: o.value, name: o.label })),
    [supplierOptions],
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
            <button
              type="button"
              onClick={() => setReceiptOpen(true)}
              className={btnPrimary}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New goods receipt
            </button>
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
              onClick={() => {
                setSuccess(null);
                setReceiptOpen(true);
              }}
              className={btnSecondary}
            >
              New receive
            </button>
          </div>
        </div>
      ) : null}

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
      {/* Receipt history — filters + table share one panel                 */}
      {/* ---------------------------------------------------------------- */}
      <div className="mb-5 overflow-hidden rounded-2xl border border-gulio-border bg-gulio-card shadow-sm">
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
      </div>

      <NewGoodsReceiptModal
        isOpen={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        warehouses={warehouses}
        suppliers={receiptSupplierOptions}
        suppliersLoading={suppliersLoading}
        onSupplierCreated={(created) => {
          setSuppliers((prev) => [
            created,
            ...prev.filter((s) => s.id !== created.id),
          ]);
        }}
        onPosted={(receipt) => {
          setSuccess({
            invoiceNumber: receipt.invoiceNumber,
            lines: receipt.lineCount,
            units: receipt.totalUnits,
            variantIds: Array.from(
              new Set(receipt.lines.map((l) => l.variantId)),
            ),
          });
          setReloadKey((k) => k + 1);
          if (receipt.supplierId) void loadSuppliers();
        }}
      />

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
