"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type {
  ProductListItemDto,
  ProductListResponse,
  SaleDto,
  StockBalanceDto,
} from "@gulio/contracts";
import { ProductThumb } from "@/components/backoffice/ProductThumb";
import { EmptyState } from "@/components/backoffice/EmptyState";
import { PageHeader } from "@/components/backoffice/PageHeader";
import {
  DataTable,
  DataTableCell,
  DataTableRow,
} from "@/components/backoffice/DataTable";
import { ProductInsightPanel } from "@/components/backoffice/products/ProductInsightPanel";
import {
  balanceMap,
  type CatalogRow,
} from "@/components/backoffice/products/product-insights";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { formatMoney } from "@/lib/money";
import { formatTzs, products as mockProducts } from "@/lib/mock-data";
import {
  PermissionCode,
  RequirePermission,
  usePermissions,
} from "@/lib/permissions";

function flattenProducts(items: ProductListItemDto[]): CatalogRow[] {
  const rows: CatalogRow[] = [];
  for (const p of items) {
    if (p.variants.length === 0) {
      rows.push({
        key: p.id,
        productId: p.id,
        name: p.name,
        variant: "—",
        sku: "—",
        barcode: null,
        brand: p.brand?.name ?? null,
        category: p.category?.name ?? "—",
        categoryId: p.category?.id ?? null,
        sellPrice: null,
        priceLabel: "—",
        imageUrl: p.imageUrl,
        tracksSerial: false,
        source: "api",
      });
      continue;
    }
    for (const v of p.variants) {
      rows.push({
        key: v.id,
        productId: p.id,
        name: p.name,
        variant: v.name,
        sku: v.sku,
        barcode: v.primaryBarcode,
        brand: p.brand?.name ?? null,
        category: p.category?.name ?? "—",
        categoryId: p.category?.id ?? null,
        sellPrice: v.sellPrice,
        priceLabel: formatMoney(v.sellPrice),
        imageUrl: v.imageUrl ?? p.imageUrl,
        tracksSerial: v.requiresSerial,
        source: "api",
      });
    }
  }
  return rows;
}

export default function ProductsPage() {
  const { ready, token, orgContext } = useAuth();
  const { can } = usePermissions();
  const canManageCatalog = can(PermissionCode.CATALOG_MANAGE);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [usingMock, setUsingMock] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [balances, setBalances] = useState<StockBalanceDto[]>([]);
  const [sales, setSales] = useState<SaleDto[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const warehouseId = useMemo(() => {
    const warehouses = orgContext?.warehouses ?? [];
    const def = warehouses.find((w) => w.isDefault) ?? warehouses[0];
    return def?.id ?? null;
  }, [orgContext]);

  const balMap = useMemo(() => balanceMap(balances), [balances]);

  const selected = useMemo(
    () => rows.find((r) => r.key === selectedKey) ?? null,
    [rows, selectedKey],
  );

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const q = query.trim();
        const path = q
          ? `/catalog/products?q=${encodeURIComponent(q)}&limit=100`
          : "/catalog/products?limit=100";
        const [res, salesRes] = await Promise.all([
          apiFetch<ProductListResponse>(path),
          apiFetch<SaleDto[]>("/pos/sales?limit=50").catch(() => [] as SaleDto[]),
        ]);
        if (cancelled) return;
        const next = flattenProducts(res.items);
        setRows(next);
        setSales(salesRes);
        setUsingMock(false);
        setSelectedKey((prev) =>
          prev && next.some((r) => r.key === prev) ? prev : null,
        );

        if (warehouseId) {
          try {
            const bal = await apiFetch<StockBalanceDto[]>(
              `/inventory/balances?warehouseId=${encodeURIComponent(warehouseId)}`,
            );
            if (!cancelled) setBalances(bal);
          } catch {
            if (!cancelled) setBalances([]);
          }
        } else {
          setBalances([]);
        }
      } catch (e) {
        if (cancelled) return;
        setUsingMock(true);
        setSales([]);
        setBalances([]);
        setError(
          e instanceof ApiError
            ? `${e.message} — showing mock catalog`
            : "API unavailable — showing mock catalog",
        );
        const q = query.trim().toLowerCase();
        const mockRows: CatalogRow[] = mockProducts
          .filter(
            (p) =>
              !q ||
              p.name.toLowerCase().includes(q) ||
              p.sku.toLowerCase().includes(q) ||
              p.variant.toLowerCase().includes(q),
          )
          .map((p) => ({
            key: p.id,
            productId: p.id,
            name: p.name,
            variant: p.variant,
            sku: p.sku,
            barcode: p.barcode,
            brand: null,
            category: p.category,
            categoryId: null,
            sellPrice: String(Math.trunc(p.priceMinor / 100)),
            priceLabel: formatTzs(p.priceMinor),
            imageUrl: p.imageUrl ?? null,
            tracksSerial: p.tracksSerial,
            source: "mock" as const,
            mockStock: p.stock,
          }));
        setRows(mockRows);
        setSelectedKey((prev) =>
          prev && mockRows.some((r) => r.key === prev) ? prev : null,
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, token, query, warehouseId]);

  const footer = useMemo(() => {
    if (loading) return "Loading…";
    return `${rows.length} variant${rows.length === 1 ? "" : "s"}${
      usingMock ? " · mock data" : ""
    } · ↑↓ select · Esc clear`;
  }, [loading, rows.length, usingMock]);

  const selectByIndex = useCallback(
    (index: number) => {
      if (rows.length === 0) return;
      const i = Math.max(0, Math.min(rows.length - 1, index));
      setSelectedKey(rows[i].key);
    },
    [rows],
  );

  const onListKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (rows.length === 0) return;
      const idx = selectedKey
        ? rows.findIndex((r) => r.key === selectedKey)
        : -1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectByIndex(idx < 0 ? 0 : idx + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectByIndex(idx < 0 ? 0 : idx - 1);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setSelectedKey(null);
      } else if (e.key === "Enter" && idx < 0) {
        e.preventDefault();
        selectByIndex(0);
      }
    },
    [rows, selectedKey, selectByIndex],
  );

  return (
    <div className="flex min-h-[calc(100vh-7.5rem)] flex-col">
      <PageHeader
        title="Products"
        subtitle="Live catalog with a sticky insight dock — select a variant for analytics & actions"
        actions={
          <RequirePermission permission={PermissionCode.CATALOG_MANAGE}>
            <Link
              href="/products/new"
              className="inline-flex min-h-touch items-center rounded-xl bg-gulio-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gulio-primary-hover"
            >
              New product
            </Link>
          </RequirePermission>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, SKU, variant…"
            className="w-full rounded-xl border border-gulio-border bg-gulio-card px-3.5 py-2.5 text-sm outline-none ring-gulio-primary focus:ring-2"
            aria-label="Search products"
          />
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
        <div
          ref={listRef}
          className="min-w-0 outline-none"
          tabIndex={0}
          onKeyDown={onListKeyDown}
          aria-label="Product catalog list"
        >
          {loading ? (
            <div className="overflow-hidden rounded-xl border border-gulio-border bg-gulio-card p-4">
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded-lg bg-gulio-bg"
                  />
                ))}
              </div>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="No products found"
              description={
                query
                  ? "Try a different search term."
                  : "Add your first product to start selling."
              }
              action={
                canManageCatalog ? (
                  <Link
                    href="/products/new"
                    className="rounded-xl bg-gulio-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-gulio-primary-hover"
                  >
                    New product
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <DataTable
              columns={["Product", "SKU", "Category", "Price", "Serial"]}
              footer={footer}
              minWidthClassName="min-w-[520px]"
            >
              {rows.map((p) => (
                <DataTableRow
                  key={p.key}
                  selected={p.key === selectedKey}
                  onClick={() =>
                    setSelectedKey((prev) => (prev === p.key ? null : p.key))
                  }
                  role="button"
                  tabIndex={-1}
                >
                  <DataTableCell>
                    <div className="flex items-center gap-3">
                      <ProductThumb imageUrl={p.imageUrl} name={p.name} />
                      <div className="min-w-0">
                        <p className="font-medium text-gulio-text">{p.name}</p>
                        <p className="text-xs text-gulio-muted">{p.variant}</p>
                      </div>
                    </div>
                  </DataTableCell>
                  <DataTableCell mono>{p.sku}</DataTableCell>
                  <DataTableCell>{p.category}</DataTableCell>
                  <DataTableCell tabular className="font-medium">
                    {p.priceLabel}
                  </DataTableCell>
                  <DataTableCell>
                    {p.tracksSerial ? (
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-gulio-primary">
                        IMEI
                      </span>
                    ) : (
                      <span className="text-xs text-gulio-muted">Qty</span>
                    )}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTable>
          )}
        </div>

        <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-6.5rem)] lg:self-start lg:overflow-y-auto">
          <ProductInsightPanel
            rows={rows}
            selected={selected}
            balances={balMap}
            sales={sales}
            onClearSelection={() => setSelectedKey(null)}
          />
        </div>
      </div>
    </div>
  );
}
