"use client";

import Link from "next/link";
import { Chip } from "@heroui/react";
import type { DashboardRecentSaleDto } from "@gulio/contracts";
import {
  formatDateTime,
  paymentMethodLabel,
  saleStatusLabel,
} from "./format";
import { formatMoney } from "@/lib/money";

type Props = {
  sales: DashboardRecentSaleDto[];
  loading?: boolean;
};

function statusTone(status: string): "success" | "warning" | "danger" | "default" {
  const s = status.toUpperCase();
  if (s === "COMPLETED" || s === "PAID") return "success";
  if (s === "PENDING" || s === "HELD" || s === "DRAFT") return "warning";
  if (s === "VOID" || s === "REFUNDED" || s === "CANCELLED") return "danger";
  return "default";
}

export function RecentSalesPanel({ sales, loading = false }: Props) {
  return (
    <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-gulio-text">Recent sales</h2>
          <p className="mt-0.5 text-xs text-gulio-muted">
            Latest completed checkouts
          </p>
        </div>
        <Link
          href="/transactions"
          className="text-sm font-medium text-gulio-primary hover:underline"
        >
          All transactions
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-gulio-bg" />
          ))}
        </div>
      ) : sales.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gulio-border bg-gulio-bg/40 px-4 py-8 text-center">
          <p className="text-sm font-medium text-gulio-text">No sales yet</p>
          <p className="mt-1 text-xs text-gulio-muted">
            Completed checkouts appear here as soon as you sell.
          </p>
          <Link
            href="/pos"
            className="mt-4 inline-flex min-h-9 items-center rounded-xl bg-gulio-primary px-4 text-sm font-semibold text-white hover:bg-gulio-primary-hover"
          >
            Go to POS
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-gulio-border">
          {sales.map((sale) => (
            <li
              key={sale.id}
              className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium text-gulio-text">
                    {sale.receiptNumber}
                  </p>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={statusTone(sale.status)}
                    className="h-5 px-1.5 text-[10px] font-bold"
                  >
                    {saleStatusLabel(sale.status)}
                  </Chip>
                  {sale.negotiated ? (
                    <Chip
                      size="sm"
                      variant="flat"
                      color="warning"
                      className="h-5 px-1.5 text-[10px] font-bold"
                    >
                      Negotiated
                    </Chip>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-xs text-gulio-muted">
                  {formatDateTime(sale.completedAt)}
                  {sale.paymentMethod
                    ? ` · ${paymentMethodLabel(sale.paymentMethod)}`
                    : ""}
                  {sale.branchName ? ` · ${sale.branchName}` : ""}
                  {sale.cashierName ? ` · ${sale.cashierName}` : ""}
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
  );
}
