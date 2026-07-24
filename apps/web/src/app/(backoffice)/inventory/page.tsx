"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { StatCard } from "@/components/backoffice/StatCard";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { formatMoney } from "@/lib/money";
import { formatTzs, stockRows as mockStock } from "@/lib/mock-data";

type InvRow = {
  id: string;
  sku: string;
  name: string;
  variant: string;
  warehouse: string;
  qty: number;
  priceLabel: string | null;
  low: boolean;
};

const LOW_THRESHOLD = 5;

export default function InventoryPage() {
  const { ready, token, orgContext } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<InvRow[]>([]);
  const [usingMock, setUsingMock] = useState(false);

  const warehouse = useMemo(() => {
    const list = orgContext?.warehouses ?? [];
    return list.find((w) => w.isDefault) ?? list[0] ?? null;
  }, [orgContext]);

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);

      if (!warehouse) {
        setUsingMock(true);
        setRows(
          mockStock.map((r) => ({
            id: r.id,
            sku: r.sku,
            name: r.name,
            variant: r.variant,
            warehouse: r.warehouse,
            qty: r.stock,
            priceLabel: formatTzs(r.priceMinor),
            low: r.status === "low",
          })),
        );
        setError("No warehouse in org context — showing mock balances");
        setLoading(false);
        return;
      }

      try {
        const [balances, products] = await Promise.all([
          apiFetch<StockBalanceDto[]>(
            `/inventory/balances?warehouseId=${encodeURIComponent(warehouse.id)}`,
          ),
          apiFetch<ProductListResponse>("/catalog/products?limit=200").catch(
            () => ({ items: [] }) as ProductListResponse,
          ),
        ]);
        if (cancelled) return;

        const variantMeta = new Map<
          string,
          { sku: string; name: string; variant: string; price: string | null }
        >();
        for (const p of products.items) {
          for (const v of p.variants) {
            variantMeta.set(v.id, {
              sku: v.sku,
              name: p.name,
              variant: v.name,
              price: v.sellPrice,
            });
          }
        }

        const mapped: InvRow[] = balances.map((b) => {
          const meta = variantMeta.get(b.variantId);
          const qty = Number(b.quantityOnHand);
          return {
            id: b.id,
            sku: meta?.sku ?? b.variantId.slice(0, 8),
            name: meta?.name ?? "Unknown variant",
            variant: meta?.variant ?? b.variantId,
            warehouse: warehouse.name,
            qty: Number.isFinite(qty) ? qty : 0,
            priceLabel: meta?.price != null ? formatMoney(meta.price) : null,
            low: Number(b.quantityAvailable) <= LOW_THRESHOLD,
          };
        });

        setRows(mapped);
        setUsingMock(false);
        if (mapped.length === 0) {
          setError(null);
        }
      } catch (e) {
        if (cancelled) return;
        setUsingMock(true);
        setError(
          e instanceof ApiError
            ? `${e.message} — showing mock balances`
            : "Could not load balances — showing mock",
        );
        setRows(
          mockStock.map((r) => ({
            id: r.id,
            sku: r.sku,
            name: r.name,
            variant: r.variant,
            warehouse: r.warehouse,
            qty: r.stock,
            priceLabel: formatTzs(r.priceMinor),
            low: r.status === "low",
          })),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, token, warehouse]);

  const lowCount = rows.filter((r) => r.low).length;
  const totalUnits = rows.reduce((s, r) => s + r.qty, 0);

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Stock balances are read-only here — mutations only via the ledger"
        actions={
          <Link
            href="/purchases/receive"
            className="inline-flex min-h-touch items-center rounded-xl bg-gulio-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gulio-primary-hover"
          >
            Receive stock
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
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

      {error ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3 rounded-xl border border-gulio-border bg-gulio-card p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-gulio-bg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No stock balances"
          description="Receive purchase stock or complete a sale to create ledger balances."
          action={
            <Link
              href="/purchases/receive"
              className="rounded-xl bg-gulio-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-gulio-primary-hover"
            >
              Receive stock
            </Link>
          }
        />
      ) : (
        <DataTable
          columns={["SKU", "Product", "Warehouse", "On hand", "Price", "Status"]}
          footer={`${rows.length} rows${usingMock ? " · mock data" : ""} · ledger projection`}
        >
          {rows.map((row) => (
            <DataTableRow key={row.id} warn={row.low}>
              <DataTableCell mono>{row.sku}</DataTableCell>
              <DataTableCell>
                <span className="font-medium text-gulio-text">{row.name}</span>
                <span className="block text-xs text-gulio-muted">
                  {row.variant}
                </span>
              </DataTableCell>
              <DataTableCell>{row.warehouse}</DataTableCell>
              <DataTableCell tabular className="font-semibold">
                {row.qty}
              </DataTableCell>
              <DataTableCell tabular>
                {row.priceLabel ?? "—"}
              </DataTableCell>
              <DataTableCell>
                {row.low ? (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-gulio-warn">
                    Low stock
                  </span>
                ) : (
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-gulio-success">
                    OK
                  </span>
                )}
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}
    </div>
  );
}
