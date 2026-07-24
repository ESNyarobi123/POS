"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  ProductListItemDto,
  ProductListResponse,
  SaleDto,
  StockBalanceDto,
} from "@gulio/contracts";
import {
  buildCategoryMix,
  buildInsights,
  buildLowStock,
  buildPaymentMix,
  buildRings,
  buildTopProducts,
  buildTrend,
  computeKpis,
  periodTargetMajor,
} from "@/components/backoffice/dashboard/analytics";
import { CategoryBars } from "@/components/backoffice/dashboard/CategoryBars";
import { InsightsCards } from "@/components/backoffice/dashboard/InsightsCards";
import { PaymentMixDonut } from "@/components/backoffice/dashboard/PaymentMixDonut";
import { ProgressRing } from "@/components/backoffice/dashboard/ProgressRing";
import { SalesTrendChart } from "@/components/backoffice/dashboard/SalesTrendChart";
import { TopProductsList } from "@/components/backoffice/dashboard/TopProductsList";
import type { DateRangeKey } from "@/components/backoffice/dashboard/types";
import { ProductThumb } from "@/components/backoffice/ProductThumb";
import { StatCard } from "@/components/backoffice/StatCard";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { formatMoney } from "@/lib/money";

const RANGE_PILLS: Array<{ key: DateRangeKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
];

function greetingForHour(h: number): string {
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function IconSales() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 19V5M4 19h16" strokeLinecap="round" />
      <path d="M8 15l3-4 3 2 4-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconOrders() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M9 5h10M9 12h10M9 19h10" strokeLinecap="round" />
      <circle cx="5" cy="5" r="1" fill="currentColor" />
      <circle cx="5" cy="12" r="1" fill="currentColor" />
      <circle cx="5" cy="19" r="1" fill="currentColor" />
    </svg>
  );
}

function IconTicket() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18M8 14h4" strokeLinecap="round" />
    </svg>
  );
}

function IconMargin() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 3v18M7 8l5-3 5 3M7 16l5 3 5-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconWarn() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
      <path
        d="M10.3 4.2L2.6 17.5A2 2 0 004.3 20.5h15.4a2 2 0 001.7-3L13.7 4.2a2 2 0 00-3.4 0z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconShift() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" />
    </svg>
  );
}

export default function DashboardPage() {
  const { ready, token, shift, orgContext, online, user } = useAuth();
  const [range, setRange] = useState<DateRangeKey>("7d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductListItemDto[]>([]);
  const [sales, setSales] = useState<SaleDto[]>([]);
  const [balances, setBalances] = useState<StockBalanceDto[]>([]);

  const warehouseId = useMemo(() => {
    const warehouses = orgContext?.warehouses ?? [];
    const def = warehouses.find((w) => w.isDefault) ?? warehouses[0];
    return def?.id ?? null;
  }, [orgContext]);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [productRes, salesRes] = await Promise.all([
          apiFetch<ProductListResponse>("/catalog/products?limit=100").catch(
            () => ({ items: [] as ProductListItemDto[] }),
          ),
          apiFetch<SaleDto[]>("/pos/sales?limit=50").catch(() => [] as SaleDto[]),
        ]);

        if (cancelled) return;
        setProducts(productRes.items);
        setSales(salesRes);

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
        if (!cancelled) {
          setError(
            e instanceof ApiError
              ? e.message
              : "Could not load dashboard — showing rich demo analytics",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, token, warehouseId]);

  const lowStockRows = useMemo(
    () => buildLowStock(balances, products),
    [balances, products],
  );

  const kpis = useMemo(
    () =>
      computeKpis({
        sales,
        range,
        lowStockCount: balances.length ? lowStockRows.length : null,
        shiftOpen: Boolean(shift),
        productCount: products.length || null,
      }),
    [sales, range, balances.length, lowStockRows.length, shift, products.length],
  );

  const trend = useMemo(() => buildTrend(sales, range), [sales, range]);
  const paymentMix = useMemo(
    () => buildPaymentMix(sales, range),
    [sales, range],
  );
  const categoryMix = useMemo(
    () => buildCategoryMix(sales, products, range),
    [sales, products, range],
  );
  const topProducts = useMemo(
    () => buildTopProducts(sales, products, range),
    [sales, products, range],
  );
  const rings = useMemo(
    () =>
      buildRings({
        balances,
        sales,
        range,
        salesMajor: kpis.salesMajor,
        targetMajor: periodTargetMajor(range),
      }),
    [balances, sales, range, kpis.salesMajor],
  );
  const insights = useMemo(
    () =>
      buildInsights({
        categoryMix: categoryMix.slices,
        lowStock: lowStockRows,
        paymentMix: paymentMix.slices,
        kpis,
        fromLive: kpis.fromLive,
      }),
    [categoryMix.slices, lowStockRows, paymentMix.slices, kpis],
  );

  const recentSales = useMemo(
    () =>
      [...sales]
        .filter((s) => s.status === "COMPLETED")
        .sort((a, b) => {
          const ta = new Date(a.completedAt ?? a.createdAt).getTime();
          const tb = new Date(b.completedAt ?? b.createdAt).getTime();
          return tb - ta;
        })
        .slice(0, 8),
    [sales],
  );

  const branchName =
    shift?.branchName ??
    orgContext?.branches.find((b) => b.isActive)?.name ??
    "your branch";

  const firstName = (user?.fullName ?? "Manager").split(/\s+/)[0];
  const greeting = greetingForHour(new Date().getHours());
  const todayLabel = new Date().toLocaleDateString("en-TZ", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-teal-700">
            GulioSmart · Back Office
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gulio-text sm:text-3xl">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-gulio-muted">
            {branchName} · {todayLabel}
            {!online ? " · offline" : ""}
            {!kpis.fromLive ? " · demo analytics blended in" : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-xl border border-gulio-border bg-gulio-card p-1 shadow-sm"
            role="group"
            aria-label="Date range"
          >
            {RANGE_PILLS.map((pill) => {
              const active = range === pill.key;
              return (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => setRange(pill.key)}
                  className={`min-h-9 rounded-lg px-3.5 text-sm font-semibold transition ${
                    active
                      ? "bg-gulio-primary text-white shadow-sm"
                      : "text-gulio-muted hover:bg-gulio-bg hover:text-gulio-text"
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
          <Link
            href="/pos"
            className="inline-flex min-h-touch items-center rounded-xl bg-gulio-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gulio-primary-hover"
          >
            Open POS
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label={range === "today" ? "Sales today" : "Sales"}
          value={formatMoney(kpis.salesMajor)}
          hint={kpis.fromLive ? "Completed checkouts" : "Demo period total"}
          accent="teal"
          icon={<IconSales />}
          loading={loading && Boolean(token)}
        />
        <StatCard
          label="Orders"
          value={String(kpis.orders)}
          hint="Completed transactions"
          accent="indigo"
          icon={<IconOrders />}
          loading={loading && Boolean(token)}
        />
        <StatCard
          label="Avg ticket"
          value={formatMoney(kpis.avgTicketMajor)}
          hint="Incl. tax"
          accent="purple"
          icon={<IconTicket />}
          loading={loading && Boolean(token)}
        />
        <StatCard
          label="Gross margin"
          value={`${kpis.marginPct}%`}
          hint="Estimated · cost data pending"
          accent="emerald"
          icon={<IconMargin />}
          loading={loading && Boolean(token)}
        />
        <StatCard
          label="Low stock"
          value={String(kpis.lowStock)}
          hint="≤ 5 units available"
          accent="amber"
          icon={<IconWarn />}
          loading={loading && Boolean(token)}
        />
        <StatCard
          label="Open shift"
          value={kpis.openShift ? "Open" : "None"}
          hint={
            shift
              ? `${shift.registerName} · ${shift.branchName}`
              : "Open a shift from POS"
          }
          accent={kpis.openShift ? "emerald" : "slate"}
          icon={<IconShift />}
          loading={!ready}
        />
      </div>

      {/* Insights */}
      <div className="mt-6">
        <InsightsCards cards={insights} />
      </div>

      {/* Charts row */}
      <div className="mt-6 grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <SalesTrendChart points={trend.points} fromLive={trend.fromLive} />
        </div>
        <div className="xl:col-span-2">
          <PaymentMixDonut
            slices={paymentMix.slices}
            asMoney={paymentMix.fromLive}
            fromLive={paymentMix.fromLive}
          />
        </div>
      </div>

      {/* Rings + category */}
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm lg:col-span-3">
          <div className="mb-5">
            <h2 className="font-semibold text-gulio-text">Health rings</h2>
            <p className="mt-0.5 text-xs text-gulio-muted">
              Stock · target · IMEI / serial share
            </p>
          </div>
          <div className="flex flex-wrap items-start justify-around gap-6">
            {rings.map((r) => (
              <ProgressRing
                key={r.label}
                pct={r.pct}
                label={r.label}
                hint={r.hint}
                color={r.color}
              />
            ))}
          </div>
        </section>
        <div className="lg:col-span-2">
          <CategoryBars
            slices={categoryMix.slices}
            fromLive={categoryMix.fromLive}
          />
        </div>
      </div>

      {/* Lists */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <TopProductsList
          rows={topProducts.rows}
          fromLive={topProducts.fromLive}
        />

        <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-gulio-text">Recent sales</h2>
              <p className="mt-0.5 text-xs text-gulio-muted">
                GET /pos/sales · last 50
              </p>
            </div>
            <Link
              href="/reports"
              className="text-sm font-medium text-gulio-primary hover:underline"
            >
              Reports
            </Link>
          </div>
          {loading && token ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-lg bg-gulio-bg"
                />
              ))}
            </div>
          ) : recentSales.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gulio-border bg-gulio-bg/40 px-4 py-8 text-center">
              <p className="text-sm font-medium text-gulio-text">No sales yet</p>
              <p className="mt-1 text-xs text-gulio-muted">
                Completed checkouts appear here. Demo KPIs still fill the boards above.
              </p>
              <Link
                href="/pos"
                className="mt-4 inline-flex rounded-xl bg-gulio-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-gulio-primary-hover"
              >
                Go to POS
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-gulio-border">
              {recentSales.map((sale) => (
                <li
                  key={sale.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gulio-text">
                      {sale.receiptNumber}
                    </p>
                    <p className="text-xs text-gulio-muted">
                      {sale.completedAt
                        ? new Date(sale.completedAt).toLocaleString("en-TZ", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : sale.status}
                      {sale.payments?.[0]
                        ? ` · ${sale.payments[0].method === "MOBILE_MONEY_MANUAL" ? "MM" : sale.payments[0].method}`
                        : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-emerald-700">
                    {formatMoney(sale.grandTotal)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-gulio-text">Low stock alerts</h2>
              <p className="mt-0.5 text-xs text-gulio-muted">
                Inventory balances · ≤ 5 available
              </p>
            </div>
            <Link
              href="/inventory"
              className="text-sm font-medium text-gulio-primary hover:underline"
            >
              Inventory
            </Link>
          </div>
          <ul className="divide-y divide-gulio-border">
            {lowStockRows.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <ProductThumb imageUrl={row.imageUrl} name={row.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gulio-text">
                    {row.name}
                  </p>
                  <p className="truncate text-xs text-gulio-muted">
                    {row.sku ?? "—"}
                    {row.tracksSerial ? " · IMEI" : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold tabular-nums ${
                    row.available <= 2
                      ? "bg-red-50 text-red-700"
                      : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {row.available} left
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Quick actions strip */}
      <section className="mt-4 rounded-xl border border-gulio-border bg-gulio-card p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            { href: "/products/new", label: "Add product" },
            { href: "/purchases/receive", label: "Receive stock" },
            { href: "/labels", label: "Print labels" },
            { href: "/inventory", label: "Inventory" },
            { href: "/returns", label: "Returns" },
            { href: "/reports", label: "Reports" },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="inline-flex min-h-9 items-center rounded-lg border border-gulio-border bg-gulio-bg/60 px-3.5 text-sm font-medium text-gulio-text transition hover:border-teal-200 hover:bg-teal-50/60"
            >
              {a.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
