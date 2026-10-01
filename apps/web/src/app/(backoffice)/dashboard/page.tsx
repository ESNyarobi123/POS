"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DASHBOARD_NOT_YET_AVAILABLE,
  type DashboardComparisonDto,
  type DashboardFinancialsDto,
  type DashboardRangeKey,
  type DashboardSummaryResponse,
} from "@gulio/contracts";
import { BranchCompareBars } from "@/components/backoffice/dashboard/BranchCompareBars";
import { CategoryBars } from "@/components/backoffice/dashboard/CategoryBars";
import { FinancialSummaryGrid } from "@/components/backoffice/dashboard/FinancialSummaryGrid";
import { LowStockPanel } from "@/components/backoffice/dashboard/LowStockPanel";
import { PaymentMixDonut } from "@/components/backoffice/dashboard/PaymentMixDonut";
import { Phase2Section } from "@/components/backoffice/dashboard/Phase2Section";
import { QuickActionsStrip } from "@/components/backoffice/dashboard/QuickActionsStrip";
import { RangeSwitcher } from "@/components/backoffice/dashboard/RangeSwitcher";
import { RecentSalesPanel } from "@/components/backoffice/dashboard/RecentSalesPanel";
import { TopProductsList } from "@/components/backoffice/dashboard/TopProductsList";
import { TrendChart } from "@/components/backoffice/dashboard/TrendChart";
import { formatDateTime, toChartNumber } from "@/components/backoffice/dashboard/format";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { useBranchContext } from "@/lib/branch-context";

function greetingForHour(h: number): string {
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Stable zero-shape used only to keep the card grid mounted while loading. */
const EMPTY_FINANCIAL: DashboardFinancialsDto = {
  revenue: "0",
  cogs: "0",
  grossProfit: "0",
  grossMarginPct: 0,
  discountsGiven: "0",
  taxCollected: "0",
  refunds: "0",
  netSales: "0",
  orders: 0,
  avgTicket: "0",
  unitsSold: 0,
  stockInHandValue: "0",
  stockUnits: 0,
  stockRetailValue: "0",
  cashInHand: "0",
  openShifts: 0,
  totalValue: "0",
  lowStockCount: 0,
  outOfStockCount: 0,
  serialTrackedUnits: 0,
};

const EMPTY_COMPARISON: DashboardComparisonDto = {
  from: "",
  to: "",
  revenue: "0",
  grossProfit: "0",
  orders: 0,
  revenueChangePct: null,
  grossProfitChangePct: null,
  ordersChangePct: null,
};

export default function DashboardPage() {
  const { ready, token, shift, online, user } = useAuth();
  const { selectedBranchId, selectedBranch, isAllBranches, allBranches } =
    useBranchContext();

  const [range, setRange] = useState<DashboardRangeKey>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<DashboardSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const customReady =
    range !== "custom" || (Boolean(customFrom) && Boolean(customTo));

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      setLoading(false);
      return;
    }
    if (!customReady) return;

    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("range", range);
        if (selectedBranchId) params.set("branchId", selectedBranchId);
        if (range === "custom") {
          params.set("from", customFrom);
          params.set("to", customTo);
        }
        const res = await apiFetch<DashboardSummaryResponse>(
          `/reporting/dashboard?${params.toString()}`,
        );
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof ApiError
              ? e.message
              : "Could not load the dashboard metrics",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, token, range, selectedBranchId, customFrom, customTo, customReady, reloadKey]);

  const handleRangeChange = useCallback((key: DashboardRangeKey) => {
    setRange(key);
  }, []);

  const handleApplyCustom = useCallback((from: string, to: string) => {
    setCustomFrom(from);
    setCustomTo(to);
    setRange("custom");
  }, []);

  const showSkeleton = loading && !data;
  const refreshing = loading && Boolean(data);

  const branchDisplayName = isAllBranches
    ? "All Branches (Consolidated)"
    : (selectedBranch?.name ??
      shift?.branchName ??
      allBranches.find((b) => b.isActive)?.name ??
      "Selected Branch");

  const firstName = (user?.fullName ?? "Manager").split(/\s+/)[0];
  const greeting = greetingForHour(new Date().getHours());
  const todayLabel = new Date().toLocaleDateString("en-TZ", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const rangeLabel = data?.range.label ?? "the selected range";
  const hasSales = (data?.financial.orders ?? 0) > 0;
  const noDataAtAll =
    Boolean(data) &&
    !hasSales &&
    (data?.financial.stockUnits ?? 0) === 0 &&
    toChartNumber(data?.financial.stockInHandValue) === 0;

  const phase2Keys = useMemo(
    () => data?.notYetAvailable ?? [...DASHBOARD_NOT_YET_AVAILABLE],
    [data],
  );

  const branchRows = data?.branchBreakdown ?? [];
  const showBranchCompare = branchRows.length >= 2;

  return (
    <div className="pb-8">
      {/* Header ------------------------------------------------------- */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-teal-700">
            GulioSmart · Back Office
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gulio-text sm:text-3xl">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-gulio-muted">
            {branchDisplayName} · {todayLabel}
            {!online ? " · offline" : ""}
          </p>
          {selectedBranchId ? (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
              Viewing: {branchDisplayName}
            </span>
          ) : (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-800">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
              All Branches — combined view
            </span>
          )}
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <RangeSwitcher
            value={range}
            onChange={handleRangeChange}
            customFrom={customFrom}
            customTo={customTo}
            onApplyCustom={handleApplyCustom}
            busy={refreshing}
          />
          <p className="text-xs text-gulio-muted">
            <span className="font-semibold uppercase tracking-wide">
              Financial range
            </span>
            {" · "}
            {customReady ? rangeLabel : "choose from & to, then apply"}
            {refreshing ? (
              <span className="ml-2 inline-flex items-center gap-1 text-teal-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" />
                updating…
              </span>
            ) : null}
          </p>
          <Link
            href="/pos"
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-gulio-primary px-4 text-sm font-semibold text-white shadow-sm hover:bg-gulio-primary-hover sm:w-auto"
          >
            Open POS
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
          >
            Try again
          </button>
        </div>
      ) : null}

      {noDataAtAll && !error ? (
        <div className="mb-6 rounded-xl border border-teal-200 bg-teal-50/60 px-4 py-3 text-sm text-teal-900">
          <p className="font-semibold">Your dashboard is ready to fill up</p>
          <p className="mt-0.5 text-teal-800">
            Add products and complete your first sale — revenue, profit and stock
            analytics will appear here automatically.
          </p>
        </div>
      ) : null}

      {/* Financial summary — hero ------------------------------------- */}
      <section className="mb-6" aria-label="Financial summary">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-gulio-text">
              Financial summary
            </h2>
            <p className="mt-0.5 text-sm text-gulio-muted">
              Sales, profit, stock and cash — {rangeLabel}
            </p>
          </div>
          {data ? (
            <p className="text-xs text-gulio-muted">
              Updated {formatDateTime(data.generatedAt)}
              {data.branchId ? "" : " · all branches"}
            </p>
          ) : null}
        </div>
        <FinancialSummaryGrid
          financial={data?.financial ?? EMPTY_FINANCIAL}
          comparison={data?.comparison ?? EMPTY_COMPARISON}
          rangeLabel={rangeLabel}
          loading={showSkeleton}
        />
      </section>

      {/* Trend + payment mix ------------------------------------------ */}
      <div className="mb-4 grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <TrendChart
            points={data?.trend ?? []}
            bucket={data?.range.bucket ?? "day"}
            rangeLabel={rangeLabel}
            revenue={data?.financial.revenue ?? "0"}
            grossProfit={data?.financial.grossProfit ?? "0"}
            revenueChangePct={data?.comparison.revenueChangePct ?? null}
            loading={showSkeleton}
          />
        </div>
        <div className="xl:col-span-2">
          <PaymentMixDonut
            slices={data?.paymentMix ?? []}
            loading={showSkeleton}
          />
        </div>
      </div>

      {/* Branch comparison + category mix ----------------------------- */}
      <div
        className={`mb-4 grid gap-4 ${showBranchCompare ? "lg:grid-cols-2" : ""}`}
      >
        {showBranchCompare ? (
          <BranchCompareBars rows={branchRows} loading={showSkeleton} />
        ) : null}
        <CategoryBars slices={data?.categoryMix ?? []} loading={showSkeleton} />
      </div>

      {/* Operational panels ------------------------------------------- */}
      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <TopProductsList rows={data?.topProducts ?? []} loading={showSkeleton} />
        <RecentSalesPanel
          sales={data?.recentSales ?? []}
          loading={showSkeleton}
        />
        <LowStockPanel rows={data?.lowStock ?? []} loading={showSkeleton} />
      </div>

      {/* Phase 2 placeholders ----------------------------------------- */}
      <div className="mb-4">
        <Phase2Section keys={phase2Keys} />
      </div>

      {/* Quick actions ------------------------------------------------ */}
      <QuickActionsStrip />
    </div>
  );
}
