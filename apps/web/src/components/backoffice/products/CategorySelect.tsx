"use client";

import { useEffect, useState } from "react";
import type {
  CategoryDto,
  CategoryListResponse,
  CreateCategoryRequest,
} from "@gulio/contracts";
import { ApiError, apiFetch } from "@/lib/api";

const inputClass =
  "w-full rounded-xl border border-gulio-border bg-white px-3.5 py-2.5 text-sm text-gulio-text outline-none transition placeholder:text-gulio-muted/70 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

type Props = {
  id: string;
  value: string;
  onChange: (categoryId: string) => void;
  disabled?: boolean;
  allowCreate?: boolean;
};

/** Select existing category; optionally create a new one inline. */
export function CategorySelect({
  id,
  value,
  onChange,
  disabled,
  allowCreate = true,
}: Props) {
  const [items, setItems] = useState<CategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"pick" | "new">("pick");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<CategoryListResponse>("/catalog/categories");
        if (!cancelled) setItems(res.items);
      } catch (e) {
        if (!cancelled) {
          setItems([]);
          setError(
            e instanceof ApiError ? e.message : "Could not load categories",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function createCategory() {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError("Category name is required");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const body: CreateCategoryRequest = { name: trimmed };
      const created = await apiFetch<CategoryDto>("/catalog/categories", {
        method: "POST",
        body,
      });
      setItems((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      onChange(created.id);
      setNewName("");
      setMode("pick");
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not create category",
      );
    } finally {
      setCreating(false);
    }
  }

  if (mode === "new" && allowCreate) {
    return (
      <div className="space-y-2">
        <input
          id={id}
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name"
          className={inputClass}
          disabled={disabled || creating}
          autoFocus
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled || creating}
            onClick={() => void createCategory()}
            className="rounded-md border-2 border-teal-700 bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Save category"}
          </button>
          <button
            type="button"
            disabled={creating}
            onClick={() => {
              setMode("pick");
              setError(null);
            }}
            className="rounded-md border-2 border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-gulio-text hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
        {error ? <p className="text-xs text-red-700">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading}
        className={inputClass}
      >
        <option value="">{loading ? "Loading…" : "Select category"}</option>
        {items.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {allowCreate ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setMode("new");
            setError(null);
          }}
          className="text-xs font-semibold text-teal-700 hover:text-teal-900"
        >
          + Add new category
        </button>
      ) : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
