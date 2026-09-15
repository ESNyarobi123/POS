"use client";

import Link from "next/link";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import type {
  CreateReturnRequest,
  ReturnDto,
  ReturnListResponse,
  ReturnableSaleDto,
  ReturnableSaleItemDto,
} from "@gulio/contracts";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Lock,
  Receipt,
  RotateCcw,
  ScanLine,
  Search,
  Smartphone,
} from "lucide-react";
import { EmptyState } from "@/components/backoffice/EmptyState";
import { PageHeader } from "@/components/backoffice/PageHeader";
import { PermissionGate } from "@/components/backoffice/PermissionGate";
import { StatCard } from "@/components/backoffice/StatCard";
import {
  DataTable,
  DataTableCell,
  DataTableRow,
} from "@/components/backoffice/DataTable";
import { ManagerPinModal } from "@/components/backoffice/returns/ManagerPinModal";
import { ReturnFlowStepper } from "@/components/backoffice/returns/ReturnFlowStepper";
import {
  ReturnLineCard,
  matchSoldImei,
  type LineDraft,
} from "@/components/backoffice/returns/ReturnLineCard";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { formatMoney } from "@/lib/money";
import { PermissionCode, usePermissions } from "@/lib/permissions";

const LARGE_REFUND_TZS = 500_000;

const btnPrimary =
  "inline-flex min-h-touch items-center justify-center gap-2 rounded-md border-2 border-teal-700 bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:border-teal-800 hover:bg-teal-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50";

const btnDanger =
  "inline-flex min-h-touch w-full items-center justify-center gap-2 rounded-md border-2 border-red-700 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:border-red-800 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50";

const btnSecondary =
  "inline-flex min-h-touch items-center justify-center gap-2 rounded-md border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-gulio-text shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

const inputClass =
  "w-full rounded-xl border border-gulio-border bg-white px-3.5 py-2.5 text-sm text-gulio-text outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

const REASONS = [
  { value: "DEFECTIVE", label: "Defective / DOA" },
  { value: "WRONG_ITEM", label: "Wrong item" },
  { value: "CHANGED_MIND", label: "Change of mind" },
  { value: "WARRANTY", label: "Warranty claim" },
] as const;

const REASON_LABEL: Record<string, string> = {
  DEFECTIVE: "Defective / DOA",
  WRONG_ITEM: "Wrong item",
  CHANGED_MIND: "Change of mind",
  WARRANTY: "Warranty",
};

/** Proportional line refund in whole TZS (display estimate; API is source of truth). */
function estimateLineRefund(
  lineTotal: string,
  quantitySold: string,
  qtyReturning: number,
): number {
  const line = Number(lineTotal);
  const sold = Number(quantitySold);
  if (!Number.isFinite(line) || !Number.isFinite(sold) || sold <= 0) return 0;
  return Math.round((line * qtyReturning) / sold);
}

export default function ReturnsPage() {
  return (
    <PermissionGate permission={PermissionCode.POS_RETURN}>
      <Suspense
        fallback={
          <div className="h-40 animate-pulse rounded-xl bg-gulio-card" />
        }
      >
        <ReturnsPageInner />
      </Suspense>
    </PermissionGate>
  );
}

function ReturnsPageInner() {
  const searchParams = useSearchParams();
  const { ready, token, orgContext } = useAuth();
  const { can, isOwner, isManager } = usePermissions();
  const canLarge =
    can(PermissionCode.POS_LARGE_REFUND) || isOwner() || isManager();

  const warehouses = orgContext?.warehouses ?? [];
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "create">("list");
  const [returns, setReturns] = useState<ReturnDto[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [receiptQuery, setReceiptQuery] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [sale, setSale] = useState<ReturnableSaleDto | null>(null);
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>({});
  const [reasonCode, setReasonCode] = useState<string>("DEFECTIVE");
  const [refundMethod, setRefundMethod] = useState<
    "CASH" | "MOBILE_MONEY_MANUAL"
  >("CASH");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<ReturnDto | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    if (warehouses.length === 0) {
      setWarehouseId(null);
      return;
    }
    setWarehouseId((prev) => {
      if (prev && warehouses.some((w) => w.id === prev)) return prev;
      return (warehouses.find((w) => w.isDefault) ?? warehouses[0]).id;
    });
  }, [warehouses]);

  const loadReturns = useCallback(async () => {
    if (!ready || !token) return;
    setListLoading(true);
    setListError(null);
    try {
      const res = await apiFetch<ReturnListResponse>("/pos/returns?limit=30");
      setReturns(res.items);
    } catch (e) {
      setReturns([]);
      setListError(
        e instanceof ApiError ? e.message : "Could not load returns",
      );
    } finally {
      setListLoading(false);
    }
  }, [ready, token]);

  useEffect(() => {
    void loadReturns();
  }, [loadReturns]);

  useEffect(() => {
    const r = searchParams.get("receipt");
    if (!r) return;
    setReceiptQuery(r);
    setMode("create");
  }, [searchParams]);

  useEffect(() => {
    if (mode !== "create" || !receiptQuery.trim() || sale) return;
    if (!searchParams.get("receipt")) return;
    void lookupSale(receiptQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot deep link lookup
  }, [mode, receiptQuery, searchParams]);

  function initDrafts(items: ReturnableSaleItemDto[]) {
    const next: Record<string, LineDraft> = {};
    for (const item of items) {
      const returnable = Math.floor(Number(item.quantityReturnable));
      next[item.saleItemId] = {
        selected: returnable > 0 && items.length === 1,
        quantity: returnable > 0 ? 1 : 0,
        disposition: "RESTOCK",
        serialUnitId: null,
        imeiScan: "",
      };
    }
    setDrafts(next);
  }

  async function lookupSale(override?: string) {
    const q = (override ?? receiptQuery).trim();
    if (!q) {
      setFormError("Enter a receipt number");
      return;
    }
    setLookupLoading(true);
    setFormError(null);
    setSale(null);
    setSuccess(null);
    try {
      const found = await apiFetch<ReturnableSaleDto>(
        `/pos/returns/lookup-sale?receiptNumber=${encodeURIComponent(q)}`,
      );
      setSale(found);
      initDrafts(found.items);
      if (found.warehouseId) setWarehouseId(found.warehouseId);
    } catch (e) {
      setFormError(
        e instanceof ApiError ? e.message : "Receipt not found",
      );
    } finally {
      setLookupLoading(false);
    }
  }

  const selectedLines = useMemo(() => {
    if (!sale) return [];
    return sale.items.filter((item) => drafts[item.saleItemId]?.selected);
  }, [sale, drafts]);

  const estimatedRefund = useMemo(() => {
    if (!sale) return 0;
    let total = 0;
    for (const item of sale.items) {
      const d = drafts[item.saleItemId];
      if (!d?.selected || d.quantity < 1) continue;
      total += estimateLineRefund(item.lineTotal, item.quantitySold, d.quantity);
    }
    return total;
  }, [sale, drafts]);

  const flowStep: 1 | 2 | 3 = !sale
    ? 1
    : selectedLines.length === 0
      ? 2
      : 3;

  const needsLargePerm = estimatedRefund >= LARGE_REFUND_TZS;
  const imeiPending = selectedLines.some((item) => {
    if (!item.tracksSerial) return false;
    const d = drafts[item.saleItemId];
    return !d?.serialUnitId;
  });

  function validateDraft(): string | null {
    if (!sale || !warehouseId) {
      return "Lookup a receipt and select a warehouse";
    }
    if (selectedLines.length === 0) {
      return "Select at least one item to return";
    }
    for (const item of selectedLines) {
      const d = drafts[item.saleItemId];
      if (!d) continue;
      const returnable = Math.floor(Number(item.quantityReturnable));
      if (d.quantity < 1 || d.quantity > returnable) {
        return `${item.sku}: quantity must be 1–${returnable}`;
      }
      if (item.tracksSerial) {
        const matched = matchSoldImei(item, d.imeiScan);
        if (!d.serialUnitId || !matched) {
          return `${item.sku}: scan the IMEI that was sold — it must match`;
        }
        if (d.quantity !== 1) {
          return `${item.sku}: serial items return 1 unit at a time`;
        }
      }
    }
    return null;
  }

  function requestProcess() {
    const err = validateDraft();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    if (needsLargePerm) {
      setPinError(null);
      setPinOpen(true);
      return;
    }
    void submitReturn();
  }

  async function submitReturn(managerPin?: string) {
    if (!sale || !warehouseId) return;
    const err = validateDraft();
    if (err) {
      setFormError(err);
      setPinOpen(false);
      return;
    }

    const items: CreateReturnRequest["items"] = [];
    for (const item of selectedLines) {
      const d = drafts[item.saleItemId];
      if (!d) continue;
      items.push({
        saleItemId: item.saleItemId,
        quantity: d.quantity,
        disposition: d.disposition,
        ...(item.tracksSerial && d.serialUnitId
          ? { serialUnitIds: [d.serialUnitId] }
          : {}),
      });
    }

    setSubmitting(true);
    setFormError(null);
    setPinError(null);
    try {
      const body: CreateReturnRequest = {
        saleId: sale.saleId,
        warehouseId,
        reasonCode,
        refundMethod,
        items,
        ...(managerPin ? { managerPin } : {}),
      };
      const result = await apiFetch<ReturnDto>("/pos/returns", {
        method: "POST",
        body,
        headers: {
          "Idempotency-Key": `ret-${sale.saleId}-${Date.now()}`,
        },
      });
      setSuccess(result);
      setSale(null);
      setDrafts({});
      setPinOpen(false);
      void loadReturns();
    } catch (e) {
      const message =
        e instanceof ApiError ? e.message : "Could not process return";
      if (pinOpen) setPinError(message);
      else setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const labelsHref =
    success && success.restockedVariantIds.length > 0
      ? `/labels?variantIds=${encodeURIComponent(success.restockedVariantIds.join(","))}`
      : null;

  const refundedTotal = returns.reduce(
    (sum, r) => sum + Math.round(Number(r.refundTotal || 0)),
    0,
  );
  const restockCount = returns.filter(
    (r) => r.restockedVariantIds.length > 0,
  ).length;

  return (
    <div className="flex min-h-[calc(100vh-7.5rem)] flex-col">
      <PageHeader
        title="Returns / refunds"
        subtitle="Lookup → select lines → disposition → confirm. IMEI must match the sold device."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/pos" className={btnSecondary}>
              POS register
            </Link>
            {mode === "list" ? (
              <button
                type="button"
                onClick={() => {
                  setMode("create");
                  setSuccess(null);
                  setFormError(null);
                }}
                className={btnPrimary}
              >
                <RotateCcw className="h-4 w-4" />
                New return
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode("list");
                  setSuccess(null);
                  setFormError(null);
                }}
                className={btnSecondary}
              >
                <ArrowLeft className="h-4 w-4" />
                All returns
              </button>
            )}
          </div>
        }
      />

      {mode === "list" ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Recent returns"
              value={listLoading ? "—" : String(returns.length)}
              hint="Last 30 processed"
              accent="rose"
              loading={listLoading}
              icon={<RotateCcw className="h-5 w-5" />}
            />
            <StatCard
              label="Refunded"
              value={listLoading ? "—" : formatMoney(refundedTotal)}
              hint="Sum of listed refunds"
              accent="amber"
              loading={listLoading}
              icon={<Banknote className="h-5 w-5" />}
            />
            <StatCard
              label="Ready for labels"
              value={listLoading ? "—" : String(restockCount)}
              hint="Restocked devices"
              accent="teal"
              loading={listLoading}
              icon={<ScanLine className="h-5 w-5" />}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <PolicyChip
              icon={<Smartphone className="h-4 w-4" />}
              title="IMEI must match sold"
              body="Scan the device in hand. The serial has to be the one on the original receipt."
            />
            <PolicyChip
              icon={<Lock className="h-4 w-4" />}
              title="Large refunds need manager PIN"
              body={`Refunds of ${formatMoney(LARGE_REFUND_TZS)} or more pause for Owner/Manager PIN.`}
            />
          </div>

          {listError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {listError}
            </div>
          ) : null}

          {listLoading ? (
            <div className="space-y-2 rounded-xl border border-gulio-border bg-gulio-card p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-11 animate-pulse rounded-lg bg-gulio-bg"
                />
              ))}
            </div>
          ) : returns.length === 0 ? (
            <EmptyState
              title="No returns yet"
              description="Look up a completed receipt, match any sold IMEI, then refund. Cashiers can start this with pos.return."
              icon={<RotateCcw className="h-6 w-6" />}
              action={
                <button
                  type="button"
                  onClick={() => setMode("create")}
                  className={btnPrimary}
                >
                  New return
                </button>
              }
            />
          ) : (
            <DataTable
              columns={[
                "Receipt",
                "Refund",
                "Reason",
                "Status",
                "When",
                "Labels",
              ]}
              footer={`${returns.length} recent returns`}
              minWidthClassName="min-w-[720px]"
            >
              {returns.map((r) => (
                <DataTableRow key={r.id}>
                  <DataTableCell mono className="px-5 py-3.5 font-semibold">
                    {r.receiptNumber}
                  </DataTableCell>
                  <DataTableCell
                    tabular
                    className="px-5 py-3.5 font-semibold text-rose-700"
                  >
                    {formatMoney(r.refundTotal)}
                  </DataTableCell>
                  <DataTableCell className="px-5 py-3.5">
                    {REASON_LABEL[r.reasonCode ?? ""] ?? r.reasonCode ?? "—"}
                  </DataTableCell>
                  <DataTableCell className="px-5 py-3.5">
                    <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
                      {r.status}
                    </span>
                  </DataTableCell>
                  <DataTableCell className="px-5 py-3.5 text-xs text-gulio-muted">
                    {r.processedAt
                      ? new Date(r.processedAt).toLocaleString()
                      : "—"}
                  </DataTableCell>
                  <DataTableCell className="px-5 py-3.5">
                    {r.restockedVariantIds.length > 0 ? (
                      <Link
                        href={`/labels?variantIds=${encodeURIComponent(r.restockedVariantIds.join(","))}`}
                        className="text-xs font-semibold text-teal-700 hover:underline"
                      >
                        Create labels
                      </Link>
                    ) : (
                      <span className="text-xs text-gulio-muted">—</span>
                    )}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTable>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {success ? (
            <div className="overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/80 p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <CheckCircle2 className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-emerald-950">
                    Refund {formatMoney(success.refundTotal)} processed
                  </p>
                  <p className="mt-1 text-sm text-emerald-800/90">
                    Receipt {success.receiptNumber} ·{" "}
                    {REASON_LABEL[success.reasonCode ?? ""] ??
                      success.reasonCode}{" "}
                    ·{" "}
                    {success.refundMethod === "MOBILE_MONEY_MANUAL"
                      ? "Mobile money"
                      : "Cash"}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {labelsHref ? (
                      <Link href={labelsHref} className={btnPrimary}>
                        Create labels (restocked)
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setSuccess(null);
                        setReceiptQuery("");
                      }}
                      className={btnSecondary}
                    >
                      Another return
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("list");
                        setSuccess(null);
                      }}
                      className={btnSecondary}
                    >
                      View list
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!success ? <ReturnFlowStepper current={flowStep} /> : null}

          {formError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {formError}
            </div>
          ) : null}

          {!success ? (
            <div className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1">
                  <label
                    htmlFor="receipt-search"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gulio-muted"
                  >
                    Receipt number
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gulio-muted" />
                    <input
                      id="receipt-search"
                      value={receiptQuery}
                      onChange={(e) => setReceiptQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void lookupSale();
                        }
                      }}
                      placeholder="RCP-…"
                      className={`${inputClass} min-h-touch pl-10 font-mono`}
                      autoFocus={!sale}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void lookupSale()}
                  disabled={lookupLoading}
                  className={btnPrimary}
                >
                  {lookupLoading ? "Looking up…" : "Lookup"}
                </button>
              </div>
              {!sale ? (
                <p className="mt-3 text-sm text-gulio-muted">
                  Scan or type the receipt from the original sale to continue.
                </p>
              ) : null}
            </div>
          ) : null}

          {sale && !success ? (
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gulio-border bg-gulio-card px-5 py-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                      <Receipt className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-mono text-sm font-bold text-gulio-text">
                        {sale.receiptNumber}
                      </p>
                      <p className="text-xs text-gulio-muted">
                        Sold {formatMoney(sale.grandTotal)}
                        {sale.completedAt
                          ? ` · ${new Date(sale.completedAt).toLocaleString()}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {imeiPending ? (
                      <span className="rounded-md bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                        IMEI required
                      </span>
                    ) : null}
                    <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {sale.items.length} line
                      {sale.items.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
                  <div className="mb-4">
                    <h3 className="font-semibold text-gulio-text">
                      Select what comes back
                    </h3>
                    <p className="mt-0.5 text-sm text-gulio-muted">
                      Tick lines, set disposition, and match IMEI when required.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {sale.items.map((item) => {
                      const d = drafts[item.saleItemId];
                      if (!d) return null;
                      return (
                        <ReturnLineCard
                          key={item.saleItemId}
                          item={item}
                          draft={d}
                          onChange={(next) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [item.saleItemId]: next,
                            }))
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              <aside className="space-y-4 lg:sticky lg:top-4">
                <div className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
                  <h3 className="font-semibold text-gulio-text">Confirm refund</h3>
                  <p className="mt-0.5 text-sm text-gulio-muted">
                    Reason, method, then process.
                  </p>

                  <p className="mb-2 mt-4 text-xs font-semibold text-gulio-muted">
                    Reason
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {REASONS.map((r) => {
                      const on = reasonCode === r.value;
                      return (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setReasonCode(r.value)}
                          className={`min-h-touch rounded-xl border px-2.5 py-2.5 text-left text-xs font-semibold transition ${
                            on
                              ? "border-teal-400 bg-teal-50 text-teal-900"
                              : "border-gulio-border bg-white text-gulio-muted hover:border-slate-300"
                          }`}
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </div>

                  <p className="mb-2 mt-4 text-xs font-semibold text-gulio-muted">
                    Refund method
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setRefundMethod("CASH")}
                      className={`min-h-touch rounded-xl border px-2.5 py-2.5 text-left text-xs font-semibold transition ${
                        refundMethod === "CASH"
                          ? "border-teal-400 bg-teal-50 text-teal-900"
                          : "border-gulio-border bg-white text-gulio-muted"
                      }`}
                    >
                      Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setRefundMethod("MOBILE_MONEY_MANUAL")}
                      className={`min-h-touch rounded-xl border px-2.5 py-2.5 text-left text-xs font-semibold transition ${
                        refundMethod === "MOBILE_MONEY_MANUAL"
                          ? "border-teal-400 bg-teal-50 text-teal-900"
                          : "border-gulio-border bg-white text-gulio-muted"
                      }`}
                    >
                      Mobile money
                    </button>
                  </div>

                  {warehouses.length > 1 ? (
                    <div className="mt-4">
                      <label className="mb-1.5 block text-xs font-semibold text-gulio-muted">
                        Restock warehouse
                      </label>
                      <select
                        value={warehouseId ?? ""}
                        onChange={(e) => setWarehouseId(e.target.value)}
                        className={`${inputClass} min-h-touch`}
                      >
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  <div className="mt-5 rounded-xl bg-gulio-bg px-4 py-4">
                    <p className="text-xs font-medium text-gulio-muted">
                      Estimated refund
                    </p>
                    <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-gulio-text">
                      {formatMoney(estimatedRefund)}
                    </p>
                    {needsLargePerm ? (
                      <p
                        className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${
                          canLarge ? "text-amber-700" : "text-rose-700"
                        }`}
                      >
                        <Lock className="h-3.5 w-3.5" />
                        {canLarge
                          ? "Large refund — confirm with your PIN"
                          : "Large refund — manager PIN required"}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-gulio-muted">
                        Under {formatMoney(LARGE_REFUND_TZS)} — cashier can
                        complete
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => requestProcess()}
                    disabled={submitting || selectedLines.length === 0}
                    className={`${btnDanger} mt-4`}
                  >
                    {submitting
                      ? "Processing…"
                      : needsLargePerm
                        ? "Continue · manager PIN"
                        : "Process refund"}
                  </button>
                </div>
              </aside>
            </div>
          ) : null}
        </div>
      )}

      <ManagerPinModal
        isOpen={pinOpen}
        amount={estimatedRefund}
        cashierNeedsManager={!canLarge}
        submitting={submitting}
        error={pinError}
        onClose={() => {
          if (submitting) return;
          setPinOpen(false);
          setPinError(null);
        }}
        onConfirm={(pin) => {
          void submitReturn(pin);
        }}
      />
    </div>
  );
}

function PolicyChip({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-gulio-border bg-gulio-card p-4 shadow-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold text-gulio-text">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-gulio-muted">{body}</p>
      </div>
    </div>
  );
}
