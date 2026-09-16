"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { SaleDto } from "@gulio/contracts";
import { PageHeader } from "@/components/backoffice/PageHeader";
import { StatCard } from "@/components/backoffice/StatCard";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { formatMoney } from "@/lib/money";
import { reportKpis } from "@/lib/mock-data";
import { TransactionLineThumb } from "@/components/backoffice/transactions/TransactionLineThumb";
import {
  formatSaleWhen,
  isNegotiatedSale,
  itemTitle,
  negotiatedBelowList,
  rangeStart,
  saleChannel,
  saleDeviceCount,
  salePaymentSummary,
} from "@/lib/transaction-display";

const HOUR_BARS = [40, 55, 35, 70, 90, 65, 80, 45, 60, 75, 50, 30];
const CATEGORY_BARS = [
  { label: "Phones", pct: 48, color: "bg-purple-500" },
  { label: "Laptops", pct: 22, color: "bg-indigo-500" },
  { label: "Audio", pct: 14, color: "bg-teal-500" },
  { label: "Accessories", pct: 16, color: "bg-sky-500" },
];

function isSameLocalDay(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function ReportsPage() {
  const { ready, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [todaySales, setTodaySales] = useState<SaleDto[]>([]);
  const [recentSales, setRecentSales] = useState<SaleDto[]>([]);
  const [liveKpis, setLiveKpis] = useState<
    Array<{ label: string; value: string; hint: string }> | null
  >(null);

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        const from = rangeStart("7d");
        const qs = new URLSearchParams({ limit: "200" });
        if (from) qs.set("from", from.toISOString());
        const sales = await apiFetch<SaleDto[]>(`/pos/sales?${qs.toString()}`);
        if (cancelled) return;
        const completed = sales.filter((s) => s.status === "COMPLETED");
        const today = completed.filter((s) =>
          isSameLocalDay(s.completedAt ?? s.createdAt),
        );
        setTodaySales(today);
        setRecentSales(completed);
        const total = today.reduce((sum, s) => sum + Number(s.grandTotal || 0), 0);
        const avg = today.length ? total / today.length : 0;
        const negotiatedSales = today.filter((s) => isNegotiatedSale(s));
        const givenAway = negotiatedSales.reduce(
          (sum, s) => sum + negotiatedBelowList(s),
          0,
        );
        setLiveKpis([
          {
            label: "Today sales",
            value: formatMoney(total),
            hint: `${today.length} transactions`,
          },
          {
            label: "Transactions",
            value: String(today.length),
            hint: "Completed today",
          },
          {
            label: "Avg ticket",
            value: formatMoney(avg),
            hint: "Incl. tax",
          },
          {
            label: "Negotiated",
            value: String(negotiatedSales.length),
            hint: `${formatMoney(givenAway)} below list`,
          },
        ]);
      } catch {
        if (!cancelled) {
          setLiveKpis(null);
          setTodaySales([]);
          setRecentSales([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, token]);

  const kpis = useMemo(() => {
    if (liveKpis) return liveKpis;
    return reportKpis.slice(0, 4);
  }, [liveKpis]);

  const accents = ["indigo", "teal", "purple", "amber"] as const;

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Today sales with live transaction breakdown · Transaction menu has full filters"
        actions={
          <Link
            href="/transactions"
            className="inline-flex min-h-10 items-center rounded-xl bg-gulio-primary px-4 text-sm font-semibold text-white hover:bg-gulio-primary-hover"
          >
            Open transactions
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi, i) => (
          <StatCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            hint={kpi.hint}
            accent={accents[i % accents.length]}
            loading={loading && !liveKpis}
          />
        ))}
      </div>

      {!liveKpis && !loading ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Could not load live sales — showing mock KPIs below the charts.
        </div>
      ) : null}

      <section className="mt-8 rounded-2xl border border-gulio-border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gulio-text">
              {todaySales.length > 0 ? "Today sales" : "Latest sales"}
            </h2>
            <p className="mt-0.5 text-xs text-gulio-muted">
              {todaySales.length > 0
                ? "Each sale: cashier, payment, OpticEdge channel, devices, negotiated"
                : "No completed sales today yet — showing the last 7 days"}
            </p>
          </div>
          <Link
            href="/transactions"
            className="text-sm font-medium text-gulio-primary hover:underline"
          >
            View all
          </Link>
        </div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-gulio-bg" />
            ))}
          </div>
        ) : (todaySales.length > 0 ? todaySales : recentSales).length === 0 ? (
          <p className="rounded-xl bg-gulio-bg/70 px-4 py-8 text-center text-sm text-gulio-muted">
            No completed sales yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {(todaySales.length > 0 ? todaySales : recentSales)
              .slice(0, 12)
              .map((sale) => {
                const first = sale.items[0];
                const title = first ? itemTitle(first) : "No lines";
                const devices = saleDeviceCount(sale);
                return (
                  <li
                    key={sale.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-gulio-border px-3.5 py-3"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <TransactionLineThumb
                        imageUrl={first?.imageUrl}
                        name={title}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-gulio-text">
                          {sale.receiptNumber}
                          <span className="ml-2 text-xs font-normal text-gulio-muted">
                            {formatSaleWhen(sale.completedAt ?? sale.createdAt)}
                          </span>
                        </p>
                        <p className="mt-0.5 truncate text-xs text-gulio-muted">
                          {sale.cashierName ?? "Cashier"}
                          {sale.customerName ? ` · ${sale.customerName}` : ""}
                          {` · ${title}`}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                            {salePaymentSummary(sale)}
                          </span>
                          <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-800 ring-1 ring-inset ring-teal-200">
                            {saleChannel(sale)}
                          </span>
                          {isNegotiatedSale(sale) ? (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                              Negotiated
                            </span>
                          ) : null}
                          {devices > 0 ? (
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-800 ring-1 ring-inset ring-indigo-200">
                              Device
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <p className="shrink-0 text-sm font-bold tabular-nums text-gulio-text">
                      {formatMoney(sale.grandTotal)}
                    </p>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold text-gulio-text">Sales by hour</h2>
            <span className="text-xs text-gulio-muted">Mock pattern</span>
          </div>
          <p className="mb-4 text-xs text-gulio-muted">08:00 – 19:00</p>
          <div className="flex h-40 items-end gap-1.5 sm:gap-2">
            {HOUR_BARS.map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-purple-600 to-purple-400/80 transition-all"
                  style={{ height: `${h}%` }}
                  title={`Hour ${i + 8}:00`}
                />
                <span className="text-[9px] tabular-nums text-gulio-muted">
                  {i + 8}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold text-gulio-text">Mix by category</h2>
            <span className="text-xs text-gulio-muted">Illustrative</span>
          </div>
          <p className="mb-5 text-xs text-gulio-muted">Share of units sold</p>
          <div className="space-y-4">
            {CATEGORY_BARS.map((row) => (
              <div key={row.label}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="font-medium text-gulio-text">{row.label}</span>
                  <span className="tabular-nums text-gulio-muted">
                    {row.pct}%
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-gulio-bg">
                  <div
                    className={`h-full rounded-full ${row.color}`}
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {!liveKpis ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reportKpis.slice(4).map((kpi) => (
            <StatCard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              hint={kpi.hint}
              accent="slate"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
