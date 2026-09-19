"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import type {
  ProductListResponse,
  StockBalanceDto,
} from "@gulio/contracts";
import { EmptyState } from "@/components/backoffice/EmptyState";
import { PageHeader } from "@/components/backoffice/PageHeader";
import {
  DataTable,
  DataTableCell,
  DataTableRow,
} from "@/components/backoffice/DataTable";
import { ProductThumb } from "@/components/backoffice/ProductThumb";
import { StatCard } from "@/components/backoffice/StatCard";
import { AddStockModal } from "@/components/backoffice/inventory/AddStockModal";
import { InventorySerialsModal } from "@/components/backoffice/inventory/InventorySerialsModal";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { formatMoney } from "@/lib/money";
import {
  PermissionCode,
  usePermissions,
} from "@/lib/permissions";

type InvRow = {
  id: string;
  variantId: string;
  sku: string;
  name: string;
  variant: string;
  warehouse: string;
  imageUrl: string | null;
  qty: number;
  reserved: number;
  available: number;
  priceLabel: string | null;
  tracksSerial: boolean;
  low: boolean;
};

const LOW_THRESHOLD = 5;

const btnPrimary =
  "inline-flex min-h-touch items-center rounded-md border-2 border-teal-700 bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:border-teal-800 hover:bg-teal-700 hover:shadow-md";

export default function InventoryPage() {
  const { ready, token, orgContext } = useAuth();
  const { can, isOwner, isManager } = usePermissions();
  const canView =
    can(PermissionCode.STOCK_VIEW) || isOwner() || isManager();
  const canAdjust =
    can(PermissionCode.STOCK_ADJUST) || isOwner() || isManager();
  const canInspectSerials = isOwner();

  const warehouses = orgContext?.warehouses ?? [];
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<InvRow[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "ok">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [serialsVariantId, setSerialsVariantId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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

  const loadBalances = useCallback(async () => {
    if (!ready || !token) return;
    if (!warehouse) {
      setLoading(false);
      setRows([]);
      setError("No warehouse in org context — assign a warehouse to continue");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [balances, products] = await Promise.all([
        apiFetch<StockBalanceDto[]>(
          `/inventory/balances?warehouseId=${encodeURIComponent(warehouse.id)}`,
        ),
        apiFetch<ProductListResponse>("/catalog/products?limit=200").catch(
          () => ({ items: [] }) as ProductListResponse,
        ),
      ]);

      const variantMeta = new Map<
        string,
        {
          sku: string;
          name: string;
          variant: string;
          price: string | null;
          imageUrl: string | null;
          tracksSerial: boolean;
        }
      >();
      for (const p of products.items) {
        for (const v of p.variants) {
          variantMeta.set(v.id, {
            sku: v.sku,
            name: p.name,
            variant: v.name,
            price: v.sellPrice,
            imageUrl: v.imageUrl ?? p.imageUrl,
            tracksSerial: v.requiresSerial,
          });
        }
      }

      const mapped: InvRow[] = balances.map((b) => {
        const meta = variantMeta.get(b.variantId);
        const qty = Number(b.quantityOnHand);
        const reserved = Number(b.quantityReserved);
        const available = Number(b.quantityAvailable);
        return {
          id: b.id,
          variantId: b.variantId,
          sku: meta?.sku ?? b.variantId.slice(0, 8),
          name: meta?.name ?? "Unknown variant",
          variant: meta?.variant ?? "—",
          warehouse: warehouse.name,
          imageUrl: meta?.imageUrl ?? null,
          qty: Number.isFinite(qty) ? qty : 0,
          reserved: Number.isFinite(reserved) ? reserved : 0,
          available: Number.isFinite(available) ? available : 0,
          priceLabel: meta?.price != null ? formatMoney(meta.price) : null,
          tracksSerial: meta?.tracksSerial ?? false,
          low: (Number.isFinite(available) ? available : 0) <= LOW_THRESHOLD,
        };
      });

      setRows(mapped);
    } catch (e) {
      setRows([]);
      setError(
        e instanceof ApiError ? e.message : "Could not load stock balances",
      );
    } finally {
      setLoading(false);
    }
  }, [ready, token, warehouse]);

  useEffect(() => {
    void loadBalances();
  }, [loadBalances, reloadKey]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "low" && !r.low) return false;
      if (filter === "ok" && r.low) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.variant.toLowerCase().includes(q)
      );
    });
  }, [rows, query, filter]);

  const lowCount = rows.filter((r) => r.low).length;
  const totalUnits = rows.reduce((s, r) => s + r.qty, 0);

  if (!canView) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-900">
        You need <span className="font-semibold">stock.view</span> to open
        inventory.
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-7.5rem)] flex-col">
      <PageHeader
        title="Inventory"
        subtitle="Live warehouse balances — stock changes only via the ledger"
        actions={
          canAdjust ? (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              disabled={!warehouse}
              className={`${btnPrimary} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Add stock
            </button>
          ) : undefined
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="SKUs tracked"
          value={loading ? "—" : String(rows.length)}
          accent="amber"
          loading={loading}
        />
        <StatCard
          label="Units on hand"
          value={loading ? "—" : String(totalUnits)}
          accent="teal"
          loading={loading}
        />
        <StatCard
          label="Low stock"
          value={loading ? "—" : String(lowCount)}
          hint={`≤ ${LOW_THRESHOLD} available`}
          accent="rose"
          loading={loading}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {warehouses.length > 1 ? (
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium text-gulio-muted">Warehouse</span>
            <select
              value={warehouseId ?? ""}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="min-h-10 rounded-md border-2 border-slate-200 bg-white px-3 text-sm font-semibold text-gulio-text outline-none transition hover:border-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
          </label>
        ) : warehouse ? (
          <span className="rounded-md border border-gulio-border bg-white px-3 py-2 text-sm font-medium text-gulio-text">
            {warehouse.name}
          </span>
        ) : null}

        <div className="relative min-w-[200px] flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search SKU, product, variant…"
            className="w-full rounded-xl border border-gulio-border bg-gulio-card px-3.5 py-2.5 text-sm outline-none ring-gulio-primary focus:ring-2"
            aria-label="Search inventory"
          />
        </div>

        <div
          className="inline-flex rounded-md border-2 border-slate-200 bg-white p-0.5"
          role="group"
          aria-label="Stock filter"
        >
          {(
            [
              ["all", "All"],
              ["low", "Low"],
              ["ok", "OK"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`min-h-9 rounded px-3 text-sm font-semibold transition ${
                filter === key
                  ? "bg-teal-600 text-white"
                  : "text-gulio-muted hover:text-gulio-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="rounded-md border-2 border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3 rounded-xl border border-gulio-border bg-gulio-card p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-gulio-bg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No stock balances yet"
          description="Add opening stock to the ledger for this warehouse. Purchase-order receive comes in Phase 2."
          action={
            canAdjust && warehouse ? (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className={btnPrimary}
              >
                Add stock
              </button>
            ) : undefined
          }
        />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          title="No matching rows"
          description="Try another search or filter."
        />
      ) : (
        <DataTable
          columns={[
            "Product",
            "SKU",
            "On hand",
            "Available",
            "Price",
            "Status",
          ]}
          footer={`${filteredRows.length} of ${rows.length} rows · ${warehouse?.name ?? "warehouse"} · ledger projection`}
          minWidthClassName="min-w-[780px]"
        >
          {filteredRows.map((row) => (
            <DataTableRow key={row.id} warn={row.low}>
              <DataTableCell className="min-w-[220px] px-5 py-3.5">
                <div className="flex items-center gap-3">
                  {canInspectSerials ? (
                    <button
                      type="button"
                      onClick={() => setSerialsVariantId(row.variantId)}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-2 border-slate-200 bg-white text-teal-700 transition hover:border-teal-500 hover:bg-teal-50"
                      aria-label={`View serials for ${row.name}`}
                      title="View serials"
                    >
                      <Eye size={16} strokeWidth={2.25} />
                    </button>
                  ) : null}
                  <ProductThumb imageUrl={row.imageUrl} name={row.name} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gulio-text">
                      {row.name}
                    </p>
                    <p className="truncate text-xs text-gulio-muted">
                      {row.variant}
                      {row.tracksSerial ? " · IMEI" : ""}
                    </p>
                  </div>
                </div>
              </DataTableCell>
              <DataTableCell mono className="px-5 py-3.5">
                {row.sku}
              </DataTableCell>
              <DataTableCell tabular className="px-5 py-3.5 font-semibold">
                {row.qty}
              </DataTableCell>
              <DataTableCell tabular className="px-5 py-3.5">
                {row.available}
                {row.reserved > 0 ? (
                  <span className="ml-1 text-xs text-gulio-muted">
                    ({row.reserved} reserved)
                  </span>
                ) : null}
              </DataTableCell>
              <DataTableCell tabular className="px-5 py-3.5">
                {row.priceLabel ?? "—"}
              </DataTableCell>
              <DataTableCell className="px-5 py-3.5">
                {row.low ? (
                  <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-gulio-warn">
                    Low stock
                  </span>
                ) : (
                  <span className="rounded-md bg-green-50 px-2.5 py-1 text-xs font-semibold text-gulio-success">
                    OK
                  </span>
                )}
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}

      {warehouse && canAdjust ? (
        <AddStockModal
          isOpen={addOpen}
          warehouseId={warehouse.id}
          warehouseName={warehouse.name}
          onClose={() => setAddOpen(false)}
          onSaved={() => setReloadKey((k) => k + 1)}
        />
      ) : null}

      {warehouse && canInspectSerials ? (
        <InventorySerialsModal
          isOpen={serialsVariantId !== null}
          variantId={serialsVariantId}
          warehouseId={warehouse.id}
          onClose={() => setSerialsVariantId(null)}
          onStockChanged={() => setReloadKey((k) => k + 1)}
        />
      ) : null}
    </div>
  );
}
