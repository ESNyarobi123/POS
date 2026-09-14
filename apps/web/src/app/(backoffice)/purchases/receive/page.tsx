"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  CommitAdjustmentResult,
  CreateStockAdjustmentRequest,
} from "@gulio/contracts";
import { EmptyState } from "@/components/backoffice/EmptyState";
import { PageHeader } from "@/components/backoffice/PageHeader";
import { PermissionGate } from "@/components/backoffice/PermissionGate";
import { ProductThumb } from "@/components/backoffice/ProductThumb";
import {
  AddReceiveLineModal,
  type ReceiveLineDraft,
} from "@/components/backoffice/purchases/AddReceiveLineModal";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { PermissionCode } from "@/lib/permissions";

const btnPrimary =
  "inline-flex min-h-touch items-center rounded-md border-2 border-teal-700 bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:border-teal-800 hover:bg-teal-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50";

const btnSecondary =
  "inline-flex min-h-touch items-center rounded-md border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-gulio-text shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

type SuccessState = {
  lines: number;
  units: number;
  variantIds: string[];
};

export default function ReceiveStockPage() {
  return (
    <PermissionGate permission={PermissionCode.STOCK_ADJUST}>
      <ReceiveStockPageInner />
    </PermissionGate>
  );
}

function ReceiveStockPageInner() {
  const { ready, token, orgContext } = useAuth();
  const warehouses = orgContext?.warehouses ?? [];
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [lines, setLines] = useState<ReceiveLineDraft[]>([]);
  const [reason, setReason] = useState("Goods receive / intake");
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);

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

  const totalUnits = lines.reduce((s, l) => s + l.quantity, 0);
  const serialLines = lines.filter((l) => l.tracksSerial).length;

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function updateQty(key: string, raw: string) {
    const n = Number(raw.replace(/,/g, "").trim());
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) return l;
        if (l.tracksSerial) {
          // Keep serials; user must match count on confirm
          return { ...l, quantity: n };
        }
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
      if (line.tracksSerial && line.serialNumbers.length !== line.quantity) {
        setError(
          `${line.sku}: enter exactly ${line.quantity} IMEI/serial${line.quantity === 1 ? "" : "s"}`,
        );
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const postedVariantIds: string[] = [];
    let units = 0;

    try {
      for (const line of lines) {
        const body: CreateStockAdjustmentRequest = {
          warehouseId: warehouse.id,
          variantId: line.variantId,
          quantityDelta: line.quantity,
          reason: reason.trim(),
          ...(line.tracksSerial
            ? { serialNumbers: line.serialNumbers }
            : {}),
        };
        await apiFetch<CommitAdjustmentResult>("/inventory/adjustments", {
          method: "POST",
          body,
        });
        postedVariantIds.push(line.variantId);
        units += line.quantity;
      }

      setSuccess({
        lines: lines.length,
        units,
        variantIds: postedVariantIds,
      });
      setLines([]);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Receive failed — some lines may have posted; check inventory",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const labelsHref =
    success && success.variantIds.length > 0
      ? `/labels?variantIds=${encodeURIComponent(success.variantIds.join(","))}`
      : "/labels";

  return (
    <div className="flex min-h-[calc(100vh-7.5rem)] flex-col">
      <PageHeader
        title="Receive stock"
        subtitle="Path A intake — posts ADJUSTMENT to the ledger (PO receive comes in Phase 2)"
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
            Received{" "}
            <span className="font-semibold tabular-nums">{success.units}</span>{" "}
            unit{success.units === 1 ? "" : "s"} across{" "}
            <span className="font-semibold tabular-nums">{success.lines}</span>{" "}
            line{success.lines === 1 ? "" : "s"} via stock ledger.
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
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gulio-border bg-gulio-card px-4 py-3 shadow-sm">
          <p className="text-xs font-medium text-gulio-muted">Warehouse</p>
          {warehouses.length > 1 ? (
            <select
              value={warehouseId ?? ""}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="mt-1 w-full rounded-md border-2 border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold outline-none focus:border-teal-500"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-0.5 text-sm font-semibold text-gulio-text">
              {warehouse?.name ?? "No warehouse"}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-gulio-border bg-gulio-card px-4 py-3 shadow-sm">
          <p className="text-xs font-medium text-gulio-muted">Lines</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-gulio-text">
            {lines.length}
            {serialLines > 0 ? (
              <span className="ml-1 text-xs font-medium text-gulio-muted">
                · {serialLines} IMEI
              </span>
            ) : null}
          </p>
        </div>
        <div className="rounded-xl border border-gulio-border bg-gulio-card px-4 py-3 shadow-sm">
          <p className="text-xs font-medium text-gulio-muted">Units to post</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-teal-800">
            {totalUnits}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <label
          htmlFor="recv-reason"
          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gulio-muted"
        >
          Reason <span className="text-red-500">*</span>
        </label>
        <input
          id="recv-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Supplier delivery, opening stock…"
          className="w-full max-w-xl rounded-xl border border-gulio-border bg-white px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gulio-text">Receive sheet</p>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          disabled={!warehouse}
          className={btnPrimary}
        >
          Add line
        </button>
      </div>

      {lines.length === 0 ? (
        <EmptyState
          title="No lines yet"
          description="Add products to receive into this warehouse. Serial-tracked devices need IMEIs before confirm."
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
      ) : (
        <div className="space-y-3">
          {lines.map((line) => (
            <div
              key={line.key}
              className="rounded-xl border border-gulio-border bg-gulio-card p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-wrap items-start gap-3">
                <ProductThumb
                  imageUrl={line.imageUrl}
                  name={line.productName}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gulio-text">
                    {line.productName}
                  </p>
                  <p className="text-sm text-gulio-muted">{line.variantName}</p>
                  <p className="mt-0.5 font-mono text-xs text-gulio-muted">
                    {line.sku}
                    {line.tracksSerial ? " · IMEI required" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <label className="text-xs font-medium text-gulio-muted">
                    Qty
                  </label>
                  <input
                    inputMode="numeric"
                    value={String(line.quantity)}
                    onChange={(e) => updateQty(line.key, e.target.value)}
                    className="mt-1 w-20 rounded-lg border-2 border-slate-200 px-2 py-1.5 text-center text-sm font-semibold tabular-nums outline-none focus:border-teal-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(line.key)}
                  className="rounded-md border-2 border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-gulio-muted transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                >
                  Remove
                </button>
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
          ))}
        </div>
      )}

      {lines.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-3">
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

      {warehouse ? (
        <AddReceiveLineModal
          isOpen={addOpen}
          onClose={() => setAddOpen(false)}
          excludeVariantIds={lines.map((l) => l.variantId)}
          onAdd={(line) => setLines((prev) => [...prev, line])}
        />
      ) : null}
    </div>
  );
}
