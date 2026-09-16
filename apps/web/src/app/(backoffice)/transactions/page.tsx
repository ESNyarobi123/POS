"use client";

import { useEffect, useMemo, useState } from "react";
import type { SaleDto } from "@gulio/contracts";
import { PageHeader } from "@/components/backoffice/PageHeader";
import { PermissionGate } from "@/components/backoffice/PermissionGate";
import { StatCard } from "@/components/backoffice/StatCard";
import { TransactionDetailPanel } from "@/components/backoffice/transactions/TransactionDetailPanel";
import { TransactionLineThumb } from "@/components/backoffice/transactions/TransactionLineThumb";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { formatMoney } from "@/lib/money";
import { PermissionCode } from "@/lib/permissions";
import {
  formatSaleWhen,
  isNegotiatedSale,
  itemTitle,
  negotiatedBelowList,
  PAYMENT_LABELS,
  rangeStart,
  saleChannel,
  saleDeviceCount,
  salePaymentSummary,
  type RangeKey,
} from "@/lib/transaction-display";

export default function TransactionsPage() {
  return (
    <PermissionGate permission={PermissionCode.REPORTS_VIEW}>
      <TransactionsPageInner />
    </PermissionGate>
  );
}

function TransactionsPageInner() {
  const { ready, token } = useAuth();
  const [sales, setSales] = useState<SaleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>("7d");
  const [q, setQ] = useState("");
  const [cashier, setCashier] = useState("");
  const [channel, setChannel] = useState("");
  const [method, setMethod] = useState("");
  const [customer, setCustomer] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const from = rangeStart(range);
        const qs = new URLSearchParams({ limit: "200" });
        if (from) qs.set("from", from.toISOString());
        const rows = await apiFetch<SaleDto[]>(`/pos/sales?${qs.toString()}`);
        if (cancelled) return;
        setSales(rows);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiError ? err.message : "Could not load transactions",
        );
        setSales([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, token, range]);

  const cashiers = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sales) {
      if (s.cashierUserId && s.cashierName) {
        map.set(s.cashierUserId, s.cashierName);
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [sales]);

  const channels = useMemo(() => {
    const set = new Set<string>();
    for (const s of sales) {
      const name = saleChannel(s);
      if (name && name !== "—") set.add(name);
    }
    return [...set].sort();
  }, [sales]);

  const customers = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sales) {
      if (s.customerId && s.customerName) {
        map.set(s.customerId, s.customerName);
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [sales]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sales.filter((s) => {
      if (cashier && s.cashierUserId !== cashier) return false;
      if (customer && s.customerId !== customer) return false;
      if (method && !s.payments.some((p) => p.method === method)) return false;
      if (channel && saleChannel(s) !== channel) return false;
      if (!needle) return true;
      const hay = [
        s.receiptNumber,
        s.cashierName,
        s.customerName,
        s.customerPhone,
        saleChannel(s),
        salePaymentSummary(s),
        ...s.items.map(
          (i) =>
            `${i.productName ?? ""} ${i.name ?? ""} ${i.sku ?? ""} ${(i.serials ?? []).map((x) => x.serialNumber ?? "").join(" ")}`,
        ),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [sales, q, cashier, channel, method, customer]);

  const selected = filtered.find((s) => s.id === selectedId) ?? null;

  const total = filtered.reduce((sum, s) => sum + Number(s.grandTotal || 0), 0);
  const negotiatedCount = filtered.filter(isNegotiatedSale).length;
  const givenAway = filtered.reduce((sum, s) => sum + negotiatedBelowList(s), 0);
  const cashCount = filtered.filter((s) =>
    s.payments.some((p) => p.method === "CASH"),
  ).length;

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle="Live POS sales with cashier, channel, payment method, devices, and negotiated prices"
      />

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Sales"
          value={formatMoney(total)}
          hint={`${filtered.length} completed`}
          accent="indigo"
          loading={loading}
          icon={<KpiIcon kind="sales" />}
        />
        <StatCard
          label="Transactions"
          value={String(filtered.length)}
          hint={
            range === "today"
              ? "Today"
              : range === "7d"
                ? "Last 7 days"
                : range === "30d"
                  ? "Last 30 days"
                  : "All completed"
          }
          accent="teal"
          loading={loading}
          icon={<KpiIcon kind="count" />}
        />
        <StatCard
          label="Negotiated"
          value={String(negotiatedCount)}
          hint={`${formatMoney(givenAway)} below list`}
          accent="amber"
          loading={loading}
          icon={<KpiIcon kind="deal" />}
        />
        <StatCard
          label="Cash sales"
          value={String(cashCount)}
          hint="Posted toward OpticEdge Cash"
          accent="emerald"
          loading={loading}
          icon={<KpiIcon kind="cash" />}
        />
      </div>

      <div className="mt-5 rounded-2xl border border-gulio-border bg-white p-3.5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {(["today", "7d", "30d", "all"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={`min-h-9 rounded-full px-3 text-xs font-semibold ${
                range === key
                  ? "bg-gulio-primary text-white"
                  : "bg-gulio-bg text-gulio-muted hover:text-gulio-text"
              }`}
            >
              {key === "today"
                ? "Today"
                : key === "7d"
                  ? "7 days"
                  : key === "30d"
                    ? "30 days"
                    : "All"}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search receipt, cashier, customer, SKU, IMEI…"
            className="min-h-10 rounded-xl border border-gulio-border px-3 text-sm outline-none ring-gulio-primary focus:ring-2 xl:col-span-2"
          />
          <select
            value={cashier}
            onChange={(e) => setCashier(e.target.value)}
            className="min-h-10 rounded-xl border border-gulio-border bg-white px-3 text-sm outline-none ring-gulio-primary focus:ring-2"
          >
            <option value="">All cashiers</option>
            {cashiers.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="min-h-10 rounded-xl border border-gulio-border bg-white px-3 text-sm outline-none ring-gulio-primary focus:ring-2"
          >
            <option value="">All channels</option>
            {channels.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="min-h-10 rounded-xl border border-gulio-border bg-white px-3 text-sm outline-none ring-gulio-primary focus:ring-2"
          >
            <option value="">All methods</option>
            {Object.entries(PAYMENT_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2">
          <select
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className="min-h-10 w-full rounded-xl border border-gulio-border bg-white px-3 text-sm outline-none ring-gulio-primary focus:ring-2 sm:max-w-xs"
          >
            <option value="">All customers</option>
            {customers.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl bg-white ring-1 ring-gulio-border"
              />
            ))
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gulio-border bg-white px-5 py-12 text-center">
              <p className="text-sm font-semibold text-gulio-text">
                No transactions in this filter
              </p>
              <p className="mt-1 text-sm text-gulio-muted">
                Complete a POS sale or widen Today / cashier / channel.
              </p>
            </div>
          ) : (
            filtered.map((sale) => {
              const active = sale.id === selected?.id;
              const negotiated = isNegotiatedSale(sale);
              const first = sale.items[0];
              const more = sale.items.length - 1;
              const devices = saleDeviceCount(sale);
              const title = first ? itemTitle(first) : "No lines";
              return (
                <article
                  key={sale.id}
                  className={`rounded-2xl border bg-white p-4 shadow-sm transition ${
                    active
                      ? "border-gulio-primary ring-2 ring-teal-500/15"
                      : "border-gulio-border hover:border-teal-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <TransactionLineThumb
                      imageUrl={first?.imageUrl}
                      name={title}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gulio-text">
                            {sale.receiptNumber}
                          </p>
                          <p className="mt-0.5 text-xs text-gulio-muted">
                            {formatSaleWhen(sale.completedAt ?? sale.createdAt)}
                            {" · "}
                            {sale.cashierName ?? "Cashier"}
                            {sale.customerName ? ` · ${sale.customerName}` : ""}
                          </p>
                        </div>
                        <p className="shrink-0 text-base font-bold tabular-nums text-gulio-text">
                          {formatMoney(sale.grandTotal)}
                        </p>
                      </div>
                      <p className="mt-1 truncate text-sm text-gulio-muted">
                        {first
                          ? `${title} ×${Number(first.quantity)}`
                          : "No lines"}
                        {more > 0 ? ` +${more} more` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {salePaymentSummary(sale)}
                    </span>
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800 ring-1 ring-inset ring-teal-200">
                      {saleChannel(sale)}
                    </span>
                    {negotiated ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                        Negotiated
                      </span>
                    ) : null}
                    {devices > 0 ? (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-800 ring-1 ring-inset ring-indigo-200">
                        Device
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setSelectedId(sale.id)}
                      className="ml-auto min-h-8 rounded-lg border border-gulio-border px-2.5 text-xs font-semibold text-gulio-text hover:bg-gulio-bg"
                    >
                      View
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {selected ? (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-900/40 xl:hidden"
            aria-label="Close transaction details"
            onClick={() => setSelectedId(null)}
          />
        ) : null}
        <div
          className={
            selected
              ? "fixed inset-y-0 right-0 z-50 w-full max-w-md xl:sticky xl:top-4 xl:z-auto xl:w-auto xl:self-start"
              : "hidden xl:block xl:sticky xl:top-4 xl:self-start"
          }
        >
          <TransactionDetailPanel
            sale={selected}
            onClose={() => setSelectedId(null)}
          />
        </div>
      </div>
    </div>
  );
}

function KpiIcon({ kind }: { kind: "sales" | "count" | "deal" | "cash" }) {
  const d =
    kind === "sales"
      ? "M4 19V5M8 16v-7M12 16V8M16 16v-4M20 19H4"
      : kind === "count"
        ? "M8 7h8M8 12h8M8 17h5M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z"
        : kind === "deal"
          ? "M12 3v18M8 8h5a3 3 0 010 6H8m0 0h6a3 3 0 010 6H8"
          : "M4 10h16v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8zM8 10V8a4 4 0 118 0v2";
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
