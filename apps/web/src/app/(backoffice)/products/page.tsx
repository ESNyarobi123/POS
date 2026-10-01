"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
import { useBranchContext } from "@/lib/branch-context";
import { formatMoney } from "@/lib/money";
import {
  PermissionCode,
  RequirePermission,
  usePermissions,
} from "@/lib/permissions";
import {
  Store,
  Globe,
  Plus,
  AlertCircle,
  Boxes,
  ArrowRightLeft,
} from "lucide-react";

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
  const { ready, token } = useAuth();
  const { can, isOwner, isManager } = usePermissions();
  const canManageCatalog =
    can(PermissionCode.CATALOG_MANAGE) || isOwner() || isManager();

  const {
    selectedBranchId,
    setSelectedBranchId,
    isAllBranches,
    selectedBranch,
    allBranches,
    allWarehouses,
  } = useBranchContext();

  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "out_of_stock">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductListItemDto[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewProductId, setViewProductId] = useState<string | null>(null);
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [rawBalances, setRawBalances] = useState<Array<StockBalanceDto & { warehouseId: string }>>([]);
  const [sales, setSales] = useState<SaleDto[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setCreateOpen(true);
      router.replace("/products", { scroll: false });
    }
  }, [searchParams, router]);

  const rows = useMemo(() => flattenProducts(products), [products]);

  // Map warehouse to branch
  const warehouseToBranchMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of allWarehouses) {
      m.set(w.id, w.branchId);
    }
    return m;
  }, [allWarehouses]);

  // Comprehensive stock breakdown per variant across branches
  const variantStockMap = useMemo(() => {
    const variantBranchQuantities = new Map<string, Map<string, number>>();

    for (const b of rawBalances) {
      const branchId = warehouseToBranchMap.get(b.warehouseId);
      if (!branchId) continue;
      const vMap = variantBranchQuantities.get(b.variantId) ?? new Map<string, number>();
      const cur = vMap.get(branchId) ?? 0;
      vMap.set(branchId, cur + Math.max(0, Math.floor(Number(b.quantityOnHand))));
      variantBranchQuantities.set(b.variantId, vMap);
    }

    const m = new Map<
      string,
      {
        totalStock: number;
        branchStock: number;
        otherStock: number;
        otherBranchesSummary: string;
        branchBreakdown: Array<{
          branchId: string;
          branchName: string;
          branchCode: string;
          stock: number;
          isCurrent: boolean;
        }>;
      }
    >();

    for (const r of rows) {
      const vMap = variantBranchQuantities.get(r.key);
      let totalStock = 0;
      let branchStock = 0;
      let otherStock = 0;
      const breakdown: Array<{
        branchId: string;
        branchName: string;
        branchCode: string;
        stock: number;
        isCurrent: boolean;
      }> = [];

      const otherBranchNames: string[] = [];

      for (const br of allBranches) {
        const qty = vMap?.get(br.id) ?? 0;
        totalStock += qty;
        const isCurrent = Boolean(selectedBranchId && br.id === selectedBranchId);
        if (isCurrent) {
          branchStock += qty;
        } else {
          otherStock += qty;
          if (qty > 0) {
            otherBranchNames.push(`${br.name} (${qty})`);
          }
        }
        breakdown.push({
          branchId: br.id,
          branchName: br.name,
          branchCode: br.code,
          stock: qty,
          isCurrent,
        });
      }

      m.set(r.key, {
        totalStock,
        branchStock: selectedBranchId ? branchStock : totalStock,
        otherStock,
        otherBranchesSummary: otherBranchNames.join(", "),
        branchBreakdown: breakdown,
      });
    }

    return m;
  }, [rawBalances, rows, allBranches, selectedBranchId, warehouseToBranchMap]);

  // Balances map for legacy insight panel
  const balMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const [vId, info] of variantStockMap.entries()) {
      m.set(vId, isAllBranches ? info.totalStock : info.branchStock);
    }
    return m;
  }, [variantStockMap, isAllBranches]);

  // Filter rows based on stock status in current branch
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const info = variantStockMap.get(r.key);
      const activeStock = isAllBranches ? (info?.totalStock ?? 0) : (info?.branchStock ?? 0);
      if (stockFilter === "in_stock") return activeStock > 0;
      if (stockFilter === "out_of_stock") return activeStock <= 0;
      return true;
    });
  }, [rows, variantStockMap, isAllBranches, stockFilter]);

  const inStockCount = useMemo(() => {
    return rows.filter((r) => {
      const info = variantStockMap.get(r.key);
      const activeStock = isAllBranches ? (info?.totalStock ?? 0) : (info?.branchStock ?? 0);
      return activeStock > 0;
    }).length;
  }, [rows, variantStockMap, isAllBranches]);

  const outOfStockCount = rows.length - inStockCount;

  const selected = useMemo(
    () => rows.find((r) => r.key === selectedKey) ?? null,
    [rows, selectedKey],
  );

  const selectedBreakdown = useMemo(() => {
    if (!selectedKey) return undefined;
    return variantStockMap.get(selectedKey)?.branchBreakdown;
  }, [selectedKey, variantStockMap]);

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
      setSelectedKey((prev) => {
        const next = flattenProducts(res.items);
        return prev && next.some((r) => r.key === prev) ? prev : null;
      });

      // Fetch balances across all warehouses
      if (allWarehouses.length > 0) {
        try {
          const allBals = await Promise.all(
            allWarehouses.map((w) =>
              apiFetch<StockBalanceDto[]>(
                `/inventory/balances?warehouseId=${encodeURIComponent(w.id)}`,
              )
                .then((items) => items.map((it) => ({ ...it, warehouseId: w.id })))
                .catch(() => [] as Array<StockBalanceDto & { warehouseId: string }>),
            ),
          );
          setRawBalances(allBals.flat());
        } catch {
          setRawBalances([]);
        }
      } else {
        setRawBalances([]);
      }
    } catch (e) {
      setSales([]);
      setRawBalances([]);
      setProducts([]);
      setSelectedKey(null);
      setError(
        e instanceof ApiError
          ? e.message
          : "Could not load catalog from API",
      );
    } finally {
      setLoading(false);
    }
  }, [ready, token, query, allWarehouses]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const footer = useMemo(() => {
    if (loading) return "Loading…";
    return `${filteredRows.length} of ${rows.length} product variant${rows.length === 1 ? "" : "s"} · ↑↓ select · Esc clear`;
  }, [loading, filteredRows.length, rows.length]);

  const selectByIndex = useCallback(
    (index: number) => {
      if (filteredRows.length === 0) return;
      const i = Math.max(0, Math.min(filteredRows.length - 1, index));
      setSelectedKey(filteredRows[i].key);
    },
    [filteredRows],
  );

  const onListKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (filteredRows.length === 0) return;
      const idx = selectedKey
        ? filteredRows.findIndex((r) => r.key === selectedKey)
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
    [filteredRows, selectedKey, selectByIndex],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteProduct) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await apiFetch(`/catalog/products/${deleteProduct.id}/archive`, {
        method: "POST",
      });
      await loadCatalog();
      setDeleteProductId(null);
    } catch (e) {
      setDeleteError(
        e instanceof ApiError ? e.message : "Could not archive product",
      );
    } finally {
      setDeleteBusy(false);
    }
  }, [deleteProduct, loadCatalog]);

  return (
    <div className="flex min-h-[calc(100vh-7.5rem)] flex-col">
      <PageHeader
        title="Products"
        subtitle={
          selectedBranch
            ? `Catalog list · Stock filtered to ${selectedBranch.name} (${selectedBranch.code})`
            : "Catalog list · Consolidated stock across all branches & warehouses"
        }
        actions={
          <RequirePermission permission={PermissionCode.CATALOG_MANAGE}>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/categories"
                className="inline-flex min-h-touch items-center rounded-md border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-gulio-text shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
              >
                Categories
              </Link>
              <Link
                href="/inventory"
                className="inline-flex min-h-touch items-center rounded-md border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-gulio-text shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
              >
                Add stock
              </Link>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex min-h-touch items-center rounded-md border-2 border-teal-700 bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:border-teal-800 hover:bg-teal-700 hover:shadow-md"
              >
                New product
              </button>
            </div>
          </RequirePermission>
        }
      />

      {/* Branch Scope Banner */}
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              isAllBranches
                ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200"
                : "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
            }`}
          >
            {isAllBranches ? <Globe className="h-5 w-5" /> : <Store className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">
                {isAllBranches ? "All Branches (Consolidated View)" : `Branch: ${selectedBranch?.name ?? "Selected Branch"}`}
              </span>
              {!isAllBranches && selectedBranch?.code && (
                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700">
                  {selectedBranch.code}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {isAllBranches
                ? `Viewing consolidated catalog & stock aggregated across all ${allBranches.length} branch locations.`
                : `Displaying stock availability for ${selectedBranch?.name}. Items with 0 units are available at other branches or pending stock intake.`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isAllBranches ? (
            <>
              <Link
                href="/purchases/receive"
                className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-100"
              >
                <Plus className="h-3.5 w-3.5" />
                Receive Stock for {selectedBranch?.name}
              </Link>
              <button
                type="button"
                onClick={() => setSelectedBranchId(null)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                View All Branches
              </button>
            </>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {allBranches.length} Active Branches
            </span>
          )}
        </div>
      </div>

      {/* Search & Stock Filter Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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

        {/* Stock Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setStockFilter("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              stockFilter === "all"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Products ({rows.length})
          </button>
          <button
            type="button"
            onClick={() => setStockFilter("in_stock")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              stockFilter === "in_stock"
                ? "bg-emerald-700 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            In Stock at {isAllBranches ? "Any Branch" : (selectedBranch?.name ?? "Branch")} ({inStockCount})
          </button>
          <button
            type="button"
            onClick={() => setStockFilter("out_of_stock")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              stockFilter === "out_of_stock"
                ? "bg-rose-700 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Out of Stock ({outOfStockCount})
          </button>
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
          ) : filteredRows.length === 0 ? (
            <EmptyState
              title="No products match your filter"
              description={
                query
                  ? "Try a different search term."
                  : stockFilter === "in_stock"
                    ? `No products currently in stock at ${selectedBranch?.name ?? "this location"}. Click 'All Products' or receive stock in Purchases.`
                    : "No products found."
              }
              action={
                canManageCatalog && stockFilter !== "in_stock" ? (
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="rounded-md border-2 border-teal-700 bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-teal-800 hover:bg-teal-700"
                  >
                    New product
                  </button>
                ) : stockFilter === "in_stock" ? (
                  <button
                    type="button"
                    onClick={() => setStockFilter("all")}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Show All Catalog Products
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
                isAllBranches
                  ? "Total Stock"
                  : `Stock (${selectedBranch?.name ?? "Branch"})`,
                "Actions",
              ]}
              footer={footer}
              minWidthClassName="min-w-[680px]"
            >
              {filteredRows.map((p) => {
                const stockInfo = variantStockMap.get(p.key);
                const branchQty = stockInfo?.branchStock ?? 0;
                const totalQty = stockInfo?.totalStock ?? 0;
                const otherQty = stockInfo?.otherStock ?? 0;

                return (
                  <DataTableRow
                    key={p.key}
                    selected={p.key === selectedKey}
                    onClick={() =>
                      setSelectedKey((prev) => (prev === p.key ? null : p.key))
                    }
                    role="button"
                    tabIndex={-1}
                  >
                    <DataTableCell className="min-w-[190px] px-3.5 py-3">
                      <div className="flex items-center gap-2.5">
                        <ProductThumb imageUrl={p.imageUrl} name={p.name} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate font-semibold text-slate-900">
                              {p.name}
                            </p>
                            {p.tracksSerial && (
                              <span className="shrink-0 rounded bg-teal-50 px-1.5 py-0.2 text-[9px] font-bold text-teal-700 ring-1 ring-teal-200">
                                IMEI
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-gulio-muted">
                            {p.variant}
                          </p>
                        </div>
                      </div>
                    </DataTableCell>

                    <DataTableCell mono className="px-3 py-3 text-xs">
                      {p.sku}
                    </DataTableCell>

                    <DataTableCell className="px-3 py-3 text-xs text-slate-600">
                      {p.category}
                    </DataTableCell>

                    <DataTableCell tabular className="px-3 py-3 text-xs font-semibold text-slate-900">
                      {p.priceLabel}
                    </DataTableCell>

                    {/* Stock Level Column */}
                    <DataTableCell tabular className="px-3 py-3 text-xs">
                      {!isAllBranches && selectedBranch ? (
                        branchQty > 0 ? (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              {branchQty} in {selectedBranch.name}
                            </span>
                            {otherQty > 0 && (
                              <span className="text-[10px] text-slate-400">
                                +{otherQty} other branches
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 w-fit">
                              0 in {selectedBranch.name}
                            </span>
                            {otherQty > 0 ? (
                              <span className="text-[10px] font-medium text-slate-600">
                                ({otherQty} at {stockInfo?.otherBranchesSummary})
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">
                                Out of stock everywhere
                              </span>
                            )}
                          </div>
                        )
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                totalQty > 0 ? "bg-emerald-500" : "bg-slate-300"
                              }`}
                            />
                            <span className="font-bold text-slate-900">
                              {totalQty} total units
                            </span>
                          </div>
                          {totalQty > 0 ? (
                            <div className="flex flex-wrap gap-1 text-[10px] text-slate-500">
                              {stockInfo?.branchBreakdown
                                .filter((b) => b.stock > 0)
                                .map((b) => (
                                  <span
                                    key={b.branchId}
                                    className="rounded bg-slate-100 px-1 py-0.2 font-mono text-[9px] text-slate-700"
                                  >
                                    {b.branchCode}: {b.stock}
                                  </span>
                                ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400">
                              0 units in all branches
                            </span>
                          )}
                        </div>
                      )}
                    </DataTableCell>

                    <DataTableCell className="w-[1%] whitespace-nowrap px-3 py-3">
                      <ProductActionsDropdown
                        product={p}
                        canManage={canManageCatalog}
                        onView={() => openView(p.productId)}
                        onEdit={() => openEdit(p.productId)}
                        onDelete={() => openDelete(p.productId)}
                      />
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTable>
          )}
        </div>

        <div className="hidden lg:block lg:sticky lg:top-4 lg:max-h-[calc(100vh-6.5rem)] lg:self-start lg:overflow-y-auto">
          <ProductInsightPanel
            rows={rows}
            selected={selected}
            balances={balMap}
            sales={sales}
            branchBreakdown={selectedBreakdown}
            selectedBranchName={selectedBranch?.name}
            isAllBranches={isAllBranches}
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
          void loadCatalog();
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
