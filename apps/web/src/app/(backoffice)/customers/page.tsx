"use client";

import { useEffect, useMemo, useState } from "react";
import type { CustomerDto, CustomerListResponse } from "@gulio/contracts";
import { EmptyState } from "@/components/backoffice/EmptyState";
import { PageHeader } from "@/components/backoffice/PageHeader";
import {
  DataTable,
  DataTableCell,
  DataTableRow,
} from "@/components/backoffice/DataTable";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { customers as mockCustomers } from "@/lib/mock-data";

type Row = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: "api" | "mock";
};

export default function CustomersPage() {
  const { ready, token } = useAuth();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [usingMock, setUsingMock] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const path = debounced
          ? `/customers?q=${encodeURIComponent(debounced)}&limit=50`
          : "/customers?limit=50";
        const res = await apiFetch<CustomerListResponse>(path);
        if (cancelled) return;
        setRows(
          res.items.map((c: CustomerDto) => ({
            id: c.id,
            name: c.name,
            phone: c.phone ?? "—",
            email: c.email,
            source: "api" as const,
          })),
        );
        setUsingMock(false);
      } catch (e) {
        if (cancelled) return;
        setUsingMock(true);
        setError(
          e instanceof ApiError
            ? `${e.message} — showing mock customers`
            : "API unavailable — showing mock customers",
        );
        const q = debounced.toLowerCase();
        setRows(
          mockCustomers
            .filter(
              (c) =>
                !q ||
                c.name.toLowerCase().includes(q) ||
                c.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")),
            )
            .map((c) => ({
              id: c.id,
              name: c.name,
              phone: c.phone,
              email: null,
              source: "mock" as const,
            })),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, token, debounced]);

  const footer = useMemo(() => {
    const n = rows.length;
    return `${n} customer${n === 1 ? "" : "s"}${usingMock ? " · mock fallback" : " · live API"}`;
  }, [rows.length, usingMock]);

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="CRM — search by name, phone, or email"
        actions={
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex min-h-touch items-center rounded-xl bg-gulio-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gulio-primary-hover"
          >
            {showForm ? "Close form" : "Add customer"}
          </button>
        }
      />

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900"
        >
          {error}
        </div>
      ) : null}

      {showForm ? (
        <div className="mb-5 rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gulio-text">
            New customer (UI ready — create API next)
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" placeholder="Hassan Mwamba" />
            <Field label="Phone" placeholder="+255 …" />
            <Field label="Email" placeholder="optional" />
            <Field label="Notes" placeholder="Warranty / VIP" />
          </div>
          <button
            type="button"
            className="mt-4 rounded-xl bg-gulio-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-gulio-primary-hover"
            onClick={() => setShowForm(false)}
          >
            Save (coming soon)
          </button>
        </div>
      ) : null}

      <div className="mb-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or phone…"
          className="w-full max-w-md rounded-xl border border-gulio-border bg-gulio-card px-3.5 py-2.5 text-sm outline-none ring-gulio-primary focus:ring-2"
          aria-label="Search customers"
        />
      </div>

      {loading ? (
        <p className="text-sm text-gulio-muted">Loading customers…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No customers match"
          description="Try another search or add a new customer."
        />
      ) : (
        <DataTable
          columns={["Customer", "Phone", "Email", ""]}
          footer={footer}
        >
          {rows.map((c) => (
            <DataTableRow key={c.id}>
              <DataTableCell>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">
                    {c.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((p) => p[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                  <span className="font-medium text-gulio-text">{c.name}</span>
                </div>
              </DataTableCell>
              <DataTableCell tabular>{c.phone}</DataTableCell>
              <DataTableCell className="text-gulio-muted">
                {c.email ?? "—"}
              </DataTableCell>
              <DataTableCell className="text-right">
                <button
                  type="button"
                  className="text-sm font-medium text-gulio-primary hover:underline"
                >
                  View
                </button>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}
    </div>
  );
}

function Field({
  label,
  placeholder,
}: {
  label: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gulio-text">
        {label}
      </label>
      <input
        placeholder={placeholder}
        className="w-full rounded-xl border border-gulio-border px-3.5 py-2.5 text-sm outline-none ring-gulio-primary focus:ring-2"
      />
    </div>
  );
}
