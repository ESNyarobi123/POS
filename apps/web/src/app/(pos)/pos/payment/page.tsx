"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CheckoutRequest, SaleDto } from "@gulio/contracts";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import {
  formatMoney,
  parseMoneyInput,
  payableAfterDiscount,
  payableAfterDiscountDecimal,
  sumLines,
} from "@/lib/money";
import {
  clearActiveSale,
  loadCart,
  loadCustomer,
  loadDiscountAmount,
  getPendingPaymentMethod,
  saveLastSaleId,
  type PosCartCustomer,
  type PosCartLine,
} from "@/lib/pos-cart";

function methodFromQuery(raw: string | null): "cash" | "mobile" | "split" {
  if (raw === "mobile" || raw === "split" || raw === "cash") return raw;
  return getPendingPaymentMethod();
}

function PaymentInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, token, shift } = useAuth();

  const method = methodFromQuery(searchParams.get("method"));
  const [cart, setCart] = useState<PosCartLine[]>([]);
  const [customer, setCustomer] = useState<PosCartCustomer | null>(null);
  const [discountAmount, setDiscountAmount] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tendered, setTendered] = useState("");
  const [mmRef, setMmRef] = useState("");
  const [cashPart, setCashPart] = useState("");
  const [mmPart, setMmPart] = useState("");
  const idempotencyKey = useRef<string>("");

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (!shift?.sessionId) {
      router.replace("/shift/open");
      return;
    }
    const lines = loadCart();
    const cust = loadCustomer();
    const discount = loadDiscountAmount();
    setCart(lines);
    setCustomer(cust);
    setDiscountAmount(discount);
    if (lines.length === 0) {
      setError("Cart is empty — return to POS");
    }
    const due = payableAfterDiscount(sumLines(lines), discount);
    setTendered(String(Math.ceil(due)));
    setCashPart(String(Math.floor(due / 2)));
    setMmPart(String(Math.ceil(due / 2)));
    if (!idempotencyKey.current) {
      idempotencyKey.current = crypto.randomUUID();
    }
  }, [ready, token, shift, router]);

  const subtotal = useMemo(() => sumLines(cart), [cart]);
  const total = useMemo(
    () => payableAfterDiscount(subtotal, discountAmount),
    [subtotal, discountAmount],
  );
  const totalDecimal = useMemo(
    () => payableAfterDiscountDecimal(cart, discountAmount),
    [cart, discountAmount],
  );
  const discountN = Number(discountAmount) || 0;
  const change =
    method === "cash"
      ? Math.max(0, Number(parseMoneyInput(tendered)) - total)
      : 0;

  const title =
    method === "mobile"
      ? "Mobile money"
      : method === "split"
        ? "Split payment"
        : "Cash payment";

  async function onComplete(e: FormEvent) {
    e.preventDefault();
    if (!shift || cart.length === 0) return;
    setError(null);
    setSubmitting(true);

    try {
      const payments: CheckoutRequest["payments"] = [];
      if (method === "cash") {
        payments.push({
          method: "CASH",
          amount: totalDecimal,
        });
      } else if (method === "mobile") {
        payments.push({
          method: "MOBILE_MONEY_MANUAL",
          amount: totalDecimal,
          reference: mmRef.trim() || undefined,
          provider: "MANUAL",
        });
      } else {
        const cashAmt = parseMoneyInput(cashPart);
        const mmAmt = parseMoneyInput(mmPart);
        const sum = Number(cashAmt) + Number(mmAmt);
        if (Math.abs(sum - total) > 0.01) {
          throw new Error(
            `Split must equal total (${formatMoney(totalDecimal)})`,
          );
        }
        if (Number(cashAmt) > 0) {
          payments.push({ method: "CASH", amount: cashAmt });
        }
        if (Number(mmAmt) > 0) {
          payments.push({
            method: "MOBILE_MONEY_MANUAL",
            amount: mmAmt,
            reference: mmRef.trim() || undefined,
            provider: "MANUAL",
          });
        }
      }

      const body: CheckoutRequest = {
        registerSessionId: shift.sessionId,
        branchId: shift.branchId,
        warehouseId: shift.warehouseId,
        customerId: customer?.id,
        discountAmount:
          discountN > 0 ? parseMoneyInput(discountAmount) : undefined,
        items: cart.map((line) => ({
          variantId: line.variantId,
          quantity: line.quantity,
          serialUnitIds: line.requiresSerial
            ? line.serialUnitIds
            : undefined,
        })),
        payments,
      };

      const sale = await apiFetch<SaleDto>("/pos/checkout", {
        method: "POST",
        body,
        headers: {
          "Idempotency-Key": idempotencyKey.current,
        },
      });

      saveLastSaleId(sale.id);
      clearActiveSale();
      router.push(`/pos/receipt?saleId=${encodeURIComponent(sale.id)}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Checkout failed",
      );
      // Keep same idempotency key for safe retry
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || !token || !shift) {
    return (
      <div className="p-8 text-sm text-gulio-muted">Loading…</div>
    );
  }

  return (
    <div className="mx-auto max-w-xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gulio-text">{title}</h1>
          <p className="text-sm text-gulio-muted">
            Checkout via NestJS · Idempotency-Key set
          </p>
        </div>
        <Link href="/pos" className="text-sm text-gulio-primary underline">
          Back to cart
        </Link>
      </div>

      <form
        onSubmit={onComplete}
        className="rounded-xl border border-gulio-border bg-gulio-card p-6 shadow-sm"
      >
        <p className="text-sm text-gulio-muted">Amount due</p>
        <p className="mt-1 text-cart-total tabular-nums text-gulio-text">
          {formatMoney(totalDecimal)}
        </p>

        {(customer || discountN > 0) && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {customer && (
              <span className="rounded-full bg-teal-50 px-2.5 py-1 font-medium text-teal-800 ring-1 ring-inset ring-teal-200">
                {customer.name}
              </span>
            )}
            {discountN > 0 && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800 ring-1 ring-inset ring-amber-200 tabular-nums">
                Subtotal {formatMoney(String(subtotal))} · −
                {formatMoney(discountAmount)}
              </span>
            )}
          </div>
        )}

        <ul className="mt-4 max-h-40 space-y-1 overflow-auto text-sm text-gulio-muted">
          {cart.map((l, i) => (
            <li
              key={`${l.variantId}-${i}`}
              className="flex justify-between gap-2"
            >
              <span>
                {l.productName} ×{l.quantity}
                {l.serialNumbers?.[0]
                  ? ` · ${l.serialNumbers[0]}`
                  : ""}
              </span>
              <span className="tabular-nums">
                {formatMoney(String(Number(l.unitPrice) * l.quantity))}
              </span>
            </li>
          ))}
        </ul>

        {method === "cash" && (
          <div className="mt-6 space-y-3">
            <label className="block text-sm font-medium" htmlFor="tendered">
              Cash tendered
            </label>
            <input
              id="tendered"
              value={tendered}
              onChange={(e) => setTendered(e.target.value)}
              className="w-full rounded-lg border border-gulio-border px-3 py-3 text-lg tabular-nums outline-none ring-gulio-primary focus:ring-2"
            />
            <div className="flex justify-between rounded-lg bg-gulio-bg px-3 py-2 text-sm">
              <span className="text-gulio-muted">Change</span>
              <span className="font-semibold tabular-nums text-gulio-success">
                {formatMoney(String(change))}
              </span>
            </div>
          </div>
        )}

        {method === "mobile" && (
          <div className="mt-6 space-y-3">
            <label className="block text-sm font-medium" htmlFor="mm-ref">
              M-Pesa / Mixx reference
            </label>
            <input
              id="mm-ref"
              placeholder="Enter confirmation code"
              value={mmRef}
              onChange={(e) => setMmRef(e.target.value)}
              className="w-full rounded-lg border border-gulio-border px-3 py-3 outline-none ring-gulio-primary focus:ring-2"
            />
            <p className="text-xs text-gulio-muted">
              Recorded as MOBILE_MONEY_MANUAL.
            </p>
          </div>
        )}

        {method === "split" && (
          <div className="mt-6 space-y-3">
            <div>
              <label
                className="mb-1 block text-sm font-medium"
                htmlFor="cash-part"
              >
                Cash
              </label>
              <input
                id="cash-part"
                value={cashPart}
                onChange={(e) => setCashPart(e.target.value)}
                className="w-full rounded-lg border border-gulio-border px-3 py-2 tabular-nums outline-none ring-gulio-primary focus:ring-2"
              />
            </div>
            <div>
              <label
                className="mb-1 block text-sm font-medium"
                htmlFor="mm-part"
              >
                Mobile money
              </label>
              <input
                id="mm-part"
                value={mmPart}
                onChange={(e) => setMmPart(e.target.value)}
                className="w-full rounded-lg border border-gulio-border px-3 py-2 tabular-nums outline-none ring-gulio-primary focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="mm-ref-split">
                MM reference (optional)
              </label>
              <input
                id="mm-ref-split"
                value={mmRef}
                onChange={(e) => setMmRef(e.target.value)}
                className="w-full rounded-lg border border-gulio-border px-3 py-2 outline-none ring-gulio-primary focus:ring-2"
              />
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-gulio-error"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || cart.length === 0}
          className="mt-8 flex w-full items-center justify-center rounded-lg bg-gulio-primary py-3.5 text-sm font-semibold text-white hover:bg-gulio-primary-hover disabled:opacity-60"
        >
          {submitting ? "Completing sale…" : "Complete sale"}
        </button>
      </form>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-xl p-8 text-sm text-gulio-muted">
          Loading payment…
        </div>
      }
    >
      <PaymentInner />
    </Suspense>
  );
}
