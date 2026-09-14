"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
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
import { ProductActionsDropdown } from "@/components/backoffice/products/ProductActionsDropdown";
import { ProductCreateModal } from "@/components/backoffice/products/ProductCreateModal";
import { ProductDeleteModal } from "@/components/backoffice/products/ProductDeleteModal";
import { ProductEditModal } from "@/components/backoffice/products/ProductEditModal";
import { ProductInsightPanel } from "@/components/backoffice/products/ProductInsightPanel";
import { ProductViewModal } from "@/components/backoffice/products/ProductViewModal";
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

function mockCatalogProducts(query: string): ProductListItemDto[] {
  const q = query.trim().toLowerCase();
  return mockProducts
    .filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.variant.toLowerCase().includes(q),
    )
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: null,
      imageUrl: p.imageUrl ?? null,
      isActive: true,
      brand: null,
      category: { id: p.category, name: p.category, parentId: null },
      variants: [
        {
          id: `${p.id}-v`,
          sku: p.sku,
          name: p.variant,
          attributes: {},
          sellPrice: String(Math.trunc(p.priceMinor / 100)),
          requiresSerial: p.tracksSerial,
          isActive: true,
          primaryBarcode: p.barcode,
          imageUrl: p.imageUrl ?? null,
        },
      ],
    }));
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="h-40 animate-pulse rounded-xl bg-gulio-card" />
      }
    >
      <ProductsPageInner />
    </Suspense>
  );
}

function ProductsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, token, orgContext } = useAuth();
  const { can, isOwner, isManager } = usePermissions();
  const canManageCatalog =
    can(PermissionCode.CATALOG_MANAGE) || isOwner() || isManager();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductListItemDto[]>([]);
  const [usingMock, setUsingMock] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewProductId, setViewProductId] = useState<string | null>(null);
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [balances, setBalances] = useState<StockBalanceDto[]>([]);
  const [sales, setSales] = useState<SaleDto[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setCreateOpen(true);
      router.replace("/products", { scroll: false });
    }
  }, [searchParams, router]);

  const warehouseId = useMemo(() => {
    const warehouses = orgContext?.warehouses ?? [];
    const def = warehouses.find((w) => w.isDefault) ?? warehouses[0];
    return def?.id ?? null;
  }, [orgContext]);

  const balMap = useMemo(() => balanceMap(balances), [balances]);
  const rows = useMemo(() => flattenProducts(products), [products]);

  const selected = useMemo(
    () => rows.find((r) => r.key === selectedKey) ?? null,
    [rows, selectedKey],
  );

  const viewProduct = useMemo(
    () => products.find((p) => p.id === viewProductId) ?? null,
    [products, viewProductId],
  );

  const editProduct = useMemo(
    () => products.find((p) => p.id === editProductId) ?? null,
    [products, editProductId],
  );

  const deleteProduct = useMemo(
    () => products.find((p) => p.id === deleteProductId) ?? null,
    [products, deleteProductId],
  );

  const selectProductInPortfolio = useCallback(
    (productId: string) => {
      const match = rows.find((r) => r.productId === productId);
      if (match) setSelectedKey(match.key);
    },
    [rows],
  );

  const openView = useCallback(
    (productId: string) => {
      selectProductInPortfolio(productId);
      setViewProductId(productId);
    },
    [selectProductInPortfolio],
  );

  const openEdit = useCallback(
    (productId: string) => {
      selectProductInPortfolio(productId);
      setEditProductId(productId);
    },
    [selectProductInPortfolio],
  );

  const openDelete = useCallback(
    (productId: string) => {
      setDeleteError(null);
      setDeleteProductId(productId);
    },
    [],
  );

  const loadCatalog = useCallback(async () => {
    if (!ready || !token) return;
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
      setProducts(res.items);
      setSales(salesRes);
      setUsingMock(false);
      setSelectedKey((prev) => {
        const next = flattenProducts(res.items);
        return prev && next.some((r) => r.key === prev) ? prev : null;
      });

      if (warehouseId) {
        try {
          const bal = await apiFetch<StockBalanceDto[]>(
            `/inventory/balances?warehouseId=${encodeURIComponent(warehouseId)}`,
          );
          setBalances(bal);
        } catch {
          setBalances([]);
        }
      } else {
        setBalances([]);
      }
    } catch (e) {
      setUsingMock(true);
      setSales([]);
      setBalances([]);
      setError(
        e instanceof ApiError
          ? `${e.message} — showing mock catalog`
          : "API unavailable — showing mock catalog",
      );
      const mockItems = mockCatalogProducts(query);
      setProducts(mockItems);
      setSelectedKey((prev) => {
        const next = flattenProducts(mockItems);
        return prev && next.some((r) => r.key === prev) ? prev : null;
      });
    } finally {
      setLoading(false);
    }
  }, [ready, token, query, warehouseId]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const footer = useMemo(() => {
    if (loading) return "Loading…";
    return `${products.length} product${products.length === 1 ? "" : "s"} · ${
      rows.length
    } variant${rows.length === 1 ? "" : "s"}${
      usingMock ? " · mock data" : ""
    } · ↑↓ select · Esc clear`;
  }, [loading, products.length, rows.length, usingMock]);

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

  const confirmDelete = useCallback(async () => {
    if (!deleteProduct) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      if (usingMock) {
        setProducts((prev) => prev.filter((p) => p.id !== deleteProduct.id));
      } else {
        await apiFetch(`/catalog/products/${deleteProduct.id}/archive`, {
          method: "POST",
        });
        await loadCatalog();
      }
      setDeleteProductId(null);
    } catch (e) {
      setDeleteError(
        e instanceof ApiError ? e.message : "Could not archive product",
      );
    } finally {
      setDeleteBusy(false);
    }
  }, [deleteProduct, usingMock, loadCatalog]);

  return (
    <div className="flex min-h-[calc(100vh-7.5rem)] flex-col">
      <PageHeader
        title="Products"
        subtitle="Catalog list — view, edit, or archive each product"
        actions={
          <RequirePermission permission={PermissionCode.CATALOG_MANAGE}>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex min-h-touch items-center rounded-md border-2 border-teal-700 bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:border-teal-800 hover:bg-teal-700 hover:shadow-md"
            >
              New product
            </button>
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

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
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
          ) : products.length === 0 ? (
            <EmptyState
              title="No products found"
              description={
                query
                  ? "Try a different search term."
                  : "Add your first product to start selling."
              }
              action={
                canManageCatalog ? (
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="rounded-md border-2 border-teal-700 bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-teal-800 hover:bg-teal-700"
                  >
                    New product
                  </button>
                ) : undefined
              }
            />
          ) : (
            <DataTable
              columns={[
                "Product",
                "SKU",
                "Category",
                "Price",
                "Serial",
                "Actions",
              ]}
              footer={footer}
              minWidthClassName="min-w-[820px]"
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
                  <DataTableCell className="min-w-[220px] px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <ProductThumb imageUrl={p.imageUrl} name={p.name} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gulio-text">
                          {p.name}
                        </p>
                        <p className="truncate text-xs text-gulio-muted">
                          {p.variant}
                        </p>
                      </div>
                    </div>
                  </DataTableCell>
                  <DataTableCell mono className="px-5 py-3.5">
                    {p.sku}
                  </DataTableCell>
                  <DataTableCell className="px-5 py-3.5">
                    {p.category}
                  </DataTableCell>
                  <DataTableCell tabular className="px-5 py-3.5 font-medium">
                    {p.priceLabel}
                  </DataTableCell>
                  <DataTableCell className="px-5 py-3.5">
                    {p.tracksSerial ? (
                      <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-gulio-primary">
                        IMEI
                      </span>
                    ) : (
                      <span className="text-xs text-gulio-muted">Qty</span>
                    )}
                  </DataTableCell>
                  <DataTableCell className="w-[1%] whitespace-nowrap px-5 py-3.5">
                    <ProductActionsDropdown
                      product={p}
                      canManage={canManageCatalog}
                      onView={() => openView(p.productId)}
                      onEdit={() => openEdit(p.productId)}
                      onDelete={() => openDelete(p.productId)}
                    />
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTable>
          )}
        </div>

        <div className="hidden lg:block lg:sticky lg:top-4 lg:max-h-[calc(100vh-6.5rem)] lg:self-start lg:overflow-y-auto">
          <ProductInsightPanel
            rows={rows}
            selected={selected}
            balances={balMap}
            sales={sales}
            onClearSelection={() => setSelectedKey(null)}
          />
        </div>
      </div>

      <ProductCreateModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => {
          setProducts((prev) => [created, ...prev]);
          setSelectedKey(created.variants[0]?.id ?? created.id);
        }}
      />

      <ProductViewModal
        product={viewProduct}
        isOpen={Boolean(viewProduct)}
        onClose={() => setViewProductId(null)}
        canManage={canManageCatalog}
        onEdit={() => {
          if (viewProduct) openEdit(viewProduct.id);
        }}
      />

      <ProductEditModal
        product={editProduct}
        isOpen={Boolean(editProduct)}
        localOnly={usingMock}
        onClose={() => setEditProductId(null)}
        onSaved={(updated) => {
          setProducts((prev) =>
            prev.map((p) => (p.id === updated.id ? updated : p)),
          );
        }}
      />

      <ProductDeleteModal
        productName={deleteProduct?.name ?? ""}
        isOpen={Boolean(deleteProduct)}
        busy={deleteBusy}
        error={deleteError}
        onClose={() => {
          if (deleteBusy) return;
          setDeleteProductId(null);
          setDeleteError(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
