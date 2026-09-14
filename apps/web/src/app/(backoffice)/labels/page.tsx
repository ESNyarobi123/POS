"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { buildLabelQrPayload } from "@gulio/barcode";
import type {
  EnsureVariantBarcodeResponse,
  ProductListResponse,
} from "@gulio/contracts";
import { EmptyState } from "@/components/backoffice/EmptyState";
import { PageHeader } from "@/components/backoffice/PageHeader";
import { CreateLabelsModal } from "@/components/backoffice/labels/CreateLabelsModal";
import {
  ProductLabelCard,
  type LabelItem,
} from "@/components/backoffice/labels/ProductLabelCard";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { formatMoney } from "@/lib/money";
import { PermissionCode, usePermissions } from "@/lib/permissions";

const btnPrimary =
  "inline-flex min-h-touch items-center rounded-md border-2 border-teal-700 bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:border-teal-800 hover:bg-teal-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50";

const btnSecondary =
  "inline-flex min-h-touch items-center rounded-md border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-gulio-text shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

type CatalogRow = {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  barcode: string | null;
  priceLabel: string | null;
  imageUrl: string | null;
};

export default function LabelsPage() {
  return (
    <Suspense
      fallback={
        <div className="h-40 animate-pulse rounded-xl bg-gulio-card" />
      }
    >
      <LabelsPageInner />
    </Suspense>
  );
}

function LabelsPageInner() {
  const searchParams = useSearchParams();
  const { ready, token } = useAuth();
  const { can, isOwner, isManager } = usePermissions();
  const canPrint =
    can(PermissionCode.LABELS_PRINT) || isOwner() || isManager();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [query, setQuery] = useState("");
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [template, setTemplate] = useState<"standard" | "compact">("standard");
  const [showPrice, setShowPrice] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [preselect, setPreselect] = useState<string[]>([]);
  const [busyEnsure, setBusyEnsure] = useState(false);

  const loadCatalog = useCallback(async () => {
    if (!ready || !token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<ProductListResponse>(
        "/catalog/products?limit=200",
      );
      const rows: CatalogRow[] = [];
      for (const p of res.items) {
        for (const v of p.variants) {
          if (!v.isActive) continue;
          rows.push({
            variantId: v.id,
            productName: p.name,
            variantName: v.name,
            sku: v.sku,
            barcode: v.primaryBarcode,
            priceLabel: v.sellPrice != null ? formatMoney(v.sellPrice) : null,
            imageUrl: v.imageUrl ?? p.imageUrl,
          });
        }
      }
      setCatalog(rows);
    } catch (e) {
      setCatalog([]);
      setError(e instanceof ApiError ? e.message : "Could not load catalog");
    } finally {
      setLoading(false);
    }
  }, [ready, token]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  // Deep link: /labels?variantId= or /labels?variantIds=id1,id2
  useEffect(() => {
    if (!canPrint) return;
    const multi = searchParams.get("variantIds");
    const single = searchParams.get("variantId");
    const ids = [
      ...(multi
        ? multi
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : []),
      ...(single ? [single.trim()] : []),
    ];
    const unique = [...new Set(ids)];
    if (unique.length === 0) return;
    setPreselect(unique);
    setCreateOpen(true);
  }, [searchParams, canPrint]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (r) =>
        r.productName.toLowerCase().includes(q) ||
        r.variantName.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        (r.barcode?.toLowerCase().includes(q) ?? false),
    );
  }, [catalog, query]);

  const previewItem = useMemo(() => {
    if (labels.length === 0) return null;
    const key = selectedPreview ?? labels[0].key;
    return labels.find((l) => l.key === key) ?? labels[0];
  }, [labels, selectedPreview]);

  const printSheets = useMemo(() => {
    const sheets: LabelItem[] = [];
    for (const item of labels) {
      for (let i = 0; i < item.copies; i++) {
        sheets.push({ ...item, key: `${item.key}-c${i}` });
      }
    }
    return sheets;
  }, [labels]);

  async function quickAdd(row: CatalogRow) {
    if (!canPrint) return;
    setBusyEnsure(true);
    setError(null);
    try {
      const ensured = await apiFetch<EnsureVariantBarcodeResponse>(
        `/catalog/variants/${row.variantId}/ensure-barcode`,
        { method: "POST", body: {} },
      );
      const item: LabelItem = {
        key: `${row.variantId}-${Date.now()}`,
        variantId: row.variantId,
        productName: row.productName,
        variantName: row.variantName,
        sku: row.sku,
        barcode: ensured.barcode.value,
        qrPayload: ensured.qrPayload || buildLabelQrPayload(row.variantId),
        priceLabel: row.priceLabel,
        copies: 1,
      };
      setLabels((prev) => {
        const without = prev.filter((p) => p.variantId !== row.variantId);
        return [item, ...without];
      });
      setSelectedPreview(item.key);
      if (ensured.barcode.created) {
        setCatalog((prev) =>
          prev.map((c) =>
            c.variantId === row.variantId
              ? { ...c, barcode: ensured.barcode.value }
              : c,
          ),
        );
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not ensure barcode");
    } finally {
      setBusyEnsure(false);
    }
  }

  function handlePrint() {
    if (printSheets.length === 0) return;
    window.print();
  }

  if (!canPrint) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-900">
        You need <span className="font-semibold">labels.print</span> to create
        and print labels.
      </div>
    );
  }

  return (
    <div className="labels-page flex min-h-[calc(100vh-7.5rem)] flex-col">
      <div className="labels-no-print">
        <PageHeader
          title="Barcode labels"
          subtitle="Code 128 + QR (variant id only) — scan always fetches live price"
          actions={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setPreselect([]);
                  setCreateOpen(true);
                }}
                className={btnPrimary}
              >
                Create labels
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={printSheets.length === 0}
                className={btnSecondary}
              >
                Print ({printSheets.length})
              </button>
            </div>
          }
        />

        {error ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}
          </div>
        ) : null}
      </div>

      <div className="labels-no-print grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search catalog for labels…"
              className="min-w-[200px] flex-1 rounded-xl border border-gulio-border bg-gulio-card px-3.5 py-2.5 text-sm outline-none ring-gulio-primary focus:ring-2"
            />
            <div className="inline-flex rounded-md border-2 border-slate-200 bg-white p-0.5">
              {(
                [
                  ["standard", "Standard"],
                  ["compact", "Compact"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTemplate(key)}
                  className={`min-h-9 rounded px-3 text-sm font-semibold transition ${
                    template === key
                      ? "bg-teal-600 text-white"
                      : "text-gulio-muted hover:text-gulio-text"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-gulio-text">
              <input
                type="checkbox"
                checked={showPrice}
                onChange={(e) => setShowPrice(e.target.checked)}
                className="rounded border-gulio-border text-teal-600"
              />
              Shelf price
            </label>
          </div>

          {loading ? (
            <div className="space-y-2 rounded-xl border border-gulio-border bg-gulio-card p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-11 animate-pulse rounded-lg bg-gulio-bg"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No variants"
              description="Add products in catalog first, then create labels here."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-gulio-border bg-gulio-card shadow-sm">
              <ul className="max-h-[calc(100vh-16rem)] divide-y divide-gulio-border overflow-y-auto">
                {filtered.map((row) => {
                  const inTray = labels.some(
                    (l) => l.variantId === row.variantId,
                  );
                  return (
                    <li
                      key={row.variantId}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gulio-text">
                          {row.productName}
                        </p>
                        <p className="truncate text-xs text-gulio-muted">
                          {row.variantName} ·{" "}
                          <span className="font-mono">{row.sku}</span>
                          {row.barcode ? (
                            <>
                              {" "}
                              ·{" "}
                              <span className="font-mono">{row.barcode}</span>
                            </>
                          ) : (
                            <span className="text-amber-700">
                              {" "}
                              · no barcode yet
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busyEnsure}
                        onClick={() => void quickAdd(row)}
                        className={`shrink-0 rounded-md border-2 px-3 py-1.5 text-xs font-semibold transition ${
                          inTray
                            ? "border-teal-600 bg-teal-50 text-teal-800"
                            : "border-slate-200 bg-white text-gulio-text hover:border-teal-500 hover:bg-teal-50"
                        }`}
                      >
                        {inTray ? "In tray" : "Add label"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-xl border border-gulio-border bg-gulio-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gulio-text">
                Print tray
              </p>
              {labels.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setLabels([]);
                    setSelectedPreview(null);
                  }}
                  className="text-xs font-semibold text-gulio-muted hover:text-gulio-text"
                >
                  Clear
                </button>
              ) : null}
            </div>

            {labels.length === 0 ? (
              <p className="text-sm text-gulio-muted">
                Add labels from the list or use{" "}
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="font-semibold text-teal-700 hover:underline"
                >
                  Create labels
                </button>
                .
              </p>
            ) : (
              <ul className="mb-4 max-h-48 space-y-1 overflow-y-auto">
                {labels.map((l) => (
                  <li key={l.key}>
                    <button
                      type="button"
                      onClick={() => setSelectedPreview(l.key)}
                      className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition ${
                        previewItem?.key === l.key
                          ? "bg-teal-50 ring-1 ring-teal-200"
                          : "hover:bg-gulio-bg"
                      }`}
                    >
                      <span className="block truncate font-semibold">
                        {l.productName}
                      </span>
                      <span className="text-gulio-muted">
                        ×{l.copies} · {l.barcode}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {previewItem ? (
              <div className="flex justify-center border-t border-gulio-border pt-4">
                <ProductLabelCard
                  item={previewItem}
                  size={template}
                  showPrice={showPrice}
                />
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      {/* Print-only sheet */}
      <div className="labels-print-only hidden print:block">
        <div className="flex flex-wrap gap-3 p-4">
          {printSheets.map((item) => (
            <ProductLabelCard
              key={item.key}
              item={item}
              size={template}
              showPrice={showPrice}
            />
          ))}
        </div>
      </div>

      <CreateLabelsModal
        isOpen={createOpen}
        initialVariantIds={preselect}
        onClose={() => {
          setCreateOpen(false);
          setPreselect([]);
        }}
        onCreated={(items) => {
          setLabels((prev) => {
            const ids = new Set(items.map((i) => i.variantId));
            const kept = prev.filter((p) => !ids.has(p.variantId));
            return [...items, ...kept];
          });
          if (items[0]) setSelectedPreview(items[0].key);
          void loadCatalog();
        }}
      />
    </div>
  );
}
