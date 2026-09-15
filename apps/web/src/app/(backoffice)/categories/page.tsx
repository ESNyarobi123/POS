"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CategoryDto,
  CategoryListResponse,
  CreateCategoryRequest,
} from "@gulio/contracts";
import { EmptyState } from "@/components/backoffice/EmptyState";
import { PageHeader } from "@/components/backoffice/PageHeader";
import {
  DataTable,
  DataTableCell,
  DataTableRow,
} from "@/components/backoffice/DataTable";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import {
  PermissionCode,
  RequirePermission,
  usePermissions,
} from "@/lib/permissions";

const inputClass =
  "w-full rounded-xl border border-gulio-border bg-white px-3.5 py-2.5 text-sm text-gulio-text outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

const btnPrimary =
  "inline-flex min-h-touch items-center rounded-md border-2 border-teal-700 bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:border-teal-800 hover:bg-teal-700";

const btnSecondary =
  "inline-flex min-h-touch items-center rounded-md border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-gulio-text shadow-sm transition hover:border-slate-400 hover:bg-slate-50";

export default function CategoriesPage() {
  const { ready, token } = useAuth();
  const { can, isOwner, isManager } = usePermissions();
  const canManage =
    can(PermissionCode.CATALOG_MANAGE) || isOwner() || isManager();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CategoryDto[]>([]);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const load = useCallback(async () => {
    if (!ready || !token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<CategoryListResponse>("/catalog/categories");
      setItems(res.items);
    } catch (e) {
      setItems([]);
      setError(
        e instanceof ApiError ? e.message : "Could not load categories",
      );
    } finally {
      setLoading(false);
    }
  }, [ready, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) => c.name.toLowerCase().includes(q));
  }, [items, query]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError("Category name is required");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const body: CreateCategoryRequest = { name: trimmed };
      await apiFetch<CategoryDto>("/catalog/categories", {
        method: "POST",
        body,
      });
      setName("");
      await load();
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Could not create category",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRename(id: string) {
    const trimmed = editName.trim();
    if (!trimmed) return;
    setEditBusy(true);
    setFormError(null);
    try {
      await apiFetch<CategoryDto>(`/catalog/categories/${id}`, {
        method: "PATCH",
        body: { name: trimmed },
      });
      setEditingId(null);
      setEditName("");
      await load();
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Could not rename category",
      );
    } finally {
      setEditBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Organize products — pick these when adding phones, laptops, accessories"
        actions={
          canManage ? (
            <RequirePermission permission={PermissionCode.CATALOG_MANAGE}>
              <Link href="/products" className={btnSecondary}>
                Back to products
              </Link>
            </RequirePermission>
          ) : null
        }
      />

      {canManage ? (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="mb-6 rounded-xl border border-gulio-border bg-gulio-card p-4"
        >
          <p className="mb-3 text-sm font-semibold text-gulio-text">
            Add category
          </p>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Phones, Laptops, Accessories"
              className={`${inputClass} min-w-[220px] flex-1`}
              disabled={saving}
            />
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? "Saving…" : "Create category"}
            </button>
          </div>
          {formError ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {formError}
            </p>
          ) : null}
        </form>
      ) : null}

      <div className="mb-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search categories…"
          className={inputClass}
          aria-label="Search categories"
        />
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-gulio-card" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Create Phones, Laptops, Audio, or Accessories so cashiers can find products faster."
        />
      ) : (
        <DataTable
          columns={canManage ? ["Name", "Actions"] : ["Name"]}
          footer={`${filtered.length} categor${filtered.length === 1 ? "y" : "ies"}`}
        >
          {filtered.map((c) => (
            <DataTableRow key={c.id}>
              <DataTableCell className="px-5 py-3.5">
                {editingId === c.id ? (
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={inputClass}
                    autoFocus
                    disabled={editBusy}
                  />
                ) : (
                  <span className="font-medium text-gulio-text">{c.name}</span>
                )}
              </DataTableCell>
              {canManage ? (
                <DataTableCell className="w-[1%] whitespace-nowrap px-5 py-3.5">
                  {editingId === c.id ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={btnPrimary}
                        disabled={editBusy}
                        onClick={() => void handleRename(c.id)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className={btnSecondary}
                        disabled={editBusy}
                        onClick={() => {
                          setEditingId(null);
                          setEditName("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() => {
                        setEditingId(c.id);
                        setEditName(c.name);
                        setFormError(null);
                      }}
                    >
                      Rename
                    </button>
                  )}
                </DataTableCell>
              ) : null}
            </DataTableRow>
          ))}
        </DataTable>
      )}
    </div>
  );
}
