"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReceiptDto } from "@gulio/contracts";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { formatMoney } from "@/lib/money";

function ReceiptInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const saleId = searchParams.get("saleId");
  const { ready, token } = useAuth();

  const [receipt, setReceipt] = useState<ReceiptDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (!saleId) {
      setError("Missing saleId");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void apiFetch<ReceiptDto>(`/pos/sales/${encodeURIComponent(saleId)}/receipt`)
      .then((data) => {
        if (!cancelled) setReceipt(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Failed to load receipt",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, token, saleId, router]);

  if (loading) {
    return (
      <div className="mx-auto max-w-md p-8 text-sm text-gulio-muted">
        Loading receipt…
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="mx-auto max-w-md p-8">
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-gulio-error"
        >
          {error ?? "Receipt not found"}
        </div>
        <Link
          href="/pos"
          className="mt-4 inline-block text-sm text-gulio-primary underline"
        >
          Back to POS
        </Link>
      </div>
    );
  }

  const { sale, organization, branch, cashier, customer, fiscal } = receipt;
  const completed = sale.completedAt
    ? new Date(sale.completedAt).toLocaleString("en-TZ", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : new Date(receipt.printedAt).toLocaleString("en-TZ", {
        dateStyle: "medium",
        timeStyle: "short",
      });

  return (
    <div className="mx-auto max-w-md p-8">
      <div className="rounded-xl border border-gulio-border bg-gulio-card p-6 shadow-sm">
        <div className="border-b border-dashed border-gulio-border pb-4 text-center">
          <p className="text-lg font-bold text-gulio-primary">
            {organization.name}
          </p>
          <p className="text-xs text-gulio-muted">{branch.name}</p>
          <p className="mt-2 font-mono text-sm font-semibold">
            {sale.receiptNumber}
          </p>
          <p className="text-xs text-gulio-muted">{completed}</p>
        </div>

        <ul className="space-y-3 py-4">
          {sale.items.map((line) => (
            <li
              key={line.id}
              className="flex justify-between gap-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {line.name ?? line.sku ?? "Item"} ×
                  {Number(line.quantity)}
                </p>
                {line.sku && (
                  <p className="text-xs text-gulio-muted">{line.sku}</p>
                )}
                {line.serials.map((s) =>
                  s.serialNumber ? (
                    <p
                      key={s.serialUnitId}
                      className="font-mono text-[10px] text-gulio-muted"
                    >
                      {s.serialNumber}
                    </p>
                  ) : null,
                )}
              </div>
              <span className="tabular-nums">
                {formatMoney(line.lineTotal, organization.currencyCode)}
              </span>
            </li>
          ))}
        </ul>

        <div className="space-y-1 border-t border-dashed border-gulio-border pt-3 text-sm">
          <div className="flex justify-between text-gulio-muted">
            <span>Subtotal</span>
            <span className="tabular-nums">
              {formatMoney(sale.subtotal, organization.currencyCode)}
            </span>
          </div>
          {Number(sale.discountTotal) > 0 && (
            <div className="flex justify-between text-gulio-muted">
              <span>Discount</span>
              <span className="tabular-nums">
                −{formatMoney(sale.discountTotal, organization.currencyCode)}
              </span>
            </div>
          )}
          {Number(sale.taxTotal) > 0 && (
            <div className="flex justify-between text-gulio-muted">
              <span>Tax</span>
              <span className="tabular-nums">
                {formatMoney(sale.taxTotal, organization.currencyCode)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span className="tabular-nums">
              {formatMoney(sale.grandTotal, organization.currencyCode)}
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-1 border-t border-dashed border-gulio-border pt-3 text-sm">
          {sale.payments.map((p) => (
            <div key={p.id} className="flex justify-between">
              <span>
                {p.method.replace(/_/g, " ")}
                {p.reference ? ` · ${p.reference}` : ""}
              </span>
              <span className="tabular-nums">
                {formatMoney(p.amount, organization.currencyCode)}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-center text-xs text-gulio-warn">
          Fiscal: {sale.fiscalStatus}
          {fiscal?.externalRef ? ` · ${fiscal.externalRef}` : ""}
        </p>
        <p className="mt-1 text-center text-xs text-gulio-muted">
          Cashier: {cashier.fullName} · Customer:{" "}
          {customer?.name ?? "Walk-in"}
        </p>
      </div>

      <div className="mt-6 flex gap-3">
        <Link
          href="/pos"
          className="flex-1 rounded-lg bg-gulio-primary py-3 text-center text-sm font-semibold text-white hover:bg-gulio-primary-hover"
        >
          New sale
        </Link>
        <Link
          href="/returns"
          className="flex-1 rounded-lg border border-gulio-border bg-white py-3 text-center text-sm font-semibold"
        >
          Return
        </Link>
      </div>
    </div>
  );
}

export default function ReceiptPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md p-8 text-sm text-gulio-muted">
          Loading receipt…
        </div>
      }
    >
      <ReceiptInner />
    </Suspense>
  );
}
