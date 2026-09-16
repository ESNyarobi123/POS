"use client";

import Link from "next/link";
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CheckoutRequest, OpticEdgeChannelsResponse, SaleDto } from "@gulio/contracts";
import { ApiError, apiFetch, getApiErrorCode } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { usePermissions } from "@/lib/permissions";
import {
  formatMoney,
  parseMoneyInput,
  payableAfterDiscount,
  payableAfterDiscountDecimal,
  sumLines,
} from "@/lib/money";
import {
  clearActiveSale,
  clearPendingBankChannel,
  loadCart,
  loadCustomer,
  loadDiscountAmount,
  loadPendingBankChannel,
  getPendingPaymentMethod,
  paymentMethodForChannel,
  pickCashChannel,
  saveLastSaleId,
  type PendingBankChannel,
  type PosCartCustomer,
  type PosCartLine,
} from "@/lib/pos-cart";
import {
  cashierNeedsManagerPin,
  isNegotiatedPrice,
  resolvePriceOverridePolicy,
} from "@/lib/price-override";
import { PosManagerPinModal } from "@/components/pos/PosManagerPinModal";
import { PosMobilePushPanel } from "@/components/pos/PosMobilePushPanel";

function methodFromQuery(
  raw: string | null,
): "cash" | "mobile" | "split" | "bank" {
  if (raw === "mobile" || raw === "split" || raw === "cash" || raw === "bank") {
    return raw;
  }
  return getPendingPaymentMethod();
}

function PaymentInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, token, shift, orgContext, online } = useAuth();
  const { isOwner, isManager } = usePermissions();
  const actorIsManager = isOwner() || isManager();
  const policy = resolvePriceOverridePolicy(
    orgContext?.settings?.priceOverride,
  );

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
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [manualMm, setManualMm] = useState(false);
  const [selcomOrderId, setSelcomOrderId] = useState<string | null>(null);
  const [bankChannel, setBankChannel] = useState<PendingBankChannel | null>(
    null,
  );
  const [cashChannel, setCashChannel] = useState<PendingBankChannel | null>(
    null,
  );
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
    setBankChannel(loadPendingBankChannel());
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

  useEffect(() => {
    if (!ready || !token || method !== "cash" || !online) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<OpticEdgeChannelsResponse>(
          "/payments/opticedge/channels",
        );
        if (cancelled) return;
        setCashChannel(pickCashChannel(data.channels));
      } catch {
        if (!cancelled) setCashChannel(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, token, method, online]);

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
  const needsManagerPin = cart.some((l) =>
    cashierNeedsManagerPin(
      l.listUnitPrice ?? l.unitPrice,
      l.unitPrice,
      policy,
      actorIsManager,
    ),
  );
  const negotiatedCount = cart.filter((l) =>
    isNegotiatedPrice(l.listUnitPrice, l.unitPrice),
  ).length;
  const change =
    method === "cash"
      ? Math.max(0, Number(parseMoneyInput(tendered)) - total)
      : 0;

  const selcom = orgContext?.settings?.selcom;
  const showMobilePad = method === "mobile" && !manualMm;

  async function completeSale(
    managerPin?: string,
    paidSelcomOrderId?: string,
  ) {
    if (!shift || cart.length === 0) return;
    setError(null);
    setPinError(null);
    setSubmitting(true);

    try {
      const payments: CheckoutRequest["payments"] = [];
      let opticedge: CheckoutRequest["opticedge"];
      if (method === "cash") {
        payments.push({
          method: "CASH",
          amount: totalDecimal,
          provider: cashChannel?.name,
          reference: cashChannel
            ? `oe-channel:${cashChannel.id}`
            : undefined,
        });
        if (cashChannel) {
          opticedge = {
            channelId: cashChannel.id,
            channelName: cashChannel.name,
            channelType: cashChannel.type,
          };
        }
      } else if (method === "bank") {
        const channel = bankChannel ?? loadPendingBankChannel();
        if (!channel) {
          throw new Error("Pick a payment channel first");
        }
        payments.push({
          method: paymentMethodForChannel(channel.type),
          amount: totalDecimal,
          provider: channel.name,
          reference: `oe-channel:${channel.id}`,
        });
        opticedge = {
          channelId: channel.id,
          channelName: channel.name,
          channelType: channel.type,
        };
      } else if (method === "mobile") {
        const orderId = paidSelcomOrderId ?? selcomOrderId;
        payments.push({
          method: "MOBILE_MONEY_MANUAL",
          amount: totalDecimal,
          reference: orderId || mmRef.trim() || undefined,
          provider: orderId ? "SELCOM" : "MANUAL",
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
        managerPin,
        items: cart.map((line) => ({
          variantId: line.variantId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          serialUnitIds: line.requiresSerial
            ? line.serialUnitIds
            : undefined,
        })),
        payments,
        opticedge,
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
      clearPendingBankChannel();
      router.push(`/pos/receipt?saleId=${encodeURIComponent(sale.id)}`);
    } catch (err) {
      const code = getApiErrorCode(err);
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Checkout failed";
      if (
        code === "MANAGER_PIN_REQUIRED" ||
        /manager pin required/i.test(message)
      ) {
        setPinOpen(true);
        setPinError(null);
        setError(message);
        return;
      }
      if (code === "INVALID_MANAGER_PIN") {
        setPinOpen(true);
        setPinError(message);
        return;
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const onSelcomPaid = useCallback(
    (orderId: string) => {
      setSelcomOrderId(orderId);
      if (needsManagerPin && !actorIsManager) {
        setPinOpen(true);
        setPinError(null);
        return;
      }
      void completeSale(undefined, orderId);
    },
    // completeSale closes over latest cart/total; this callback is only used once per paid intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [needsManagerPin, actorIsManager],
  );

  const title =
    method === "mobile"
      ? "Mobile money"
      : method === "split"
        ? "Split payment"
        : method === "bank"
          ? "Bank / channel"
          : "Cash payment";

  async function onComplete(e: FormEvent) {
    e.preventDefault();
    if (showMobilePad) return;
    if (needsManagerPin && !actorIsManager) {
      setPinOpen(true);
      setPinError(null);
      return;
    }
    await completeSale();
  }

  if (!ready || !token || !shift) {
    return (
      <div className="p-8 text-sm text-gulio-muted">Loading…</div>
    );
  }

  if (method === "mobile") {
    return (
      <div className="flex h-full min-h-0 bg-gulio-bg">
        <section className="flex min-w-0 flex-1 flex-col overflow-y-auto p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gulio-muted">
                Mobile money
              </p>
              <h1 className="mt-1 text-2xl font-bold text-gulio-text">
                Send payment push
              </h1>
              <p className="mt-1 text-sm text-gulio-muted">
                Enter the customer number on the pad, then send. They approve on
                the phone.
              </p>
            </div>
            <Link
              href="/pos"
              className="min-h-touch inline-flex items-center rounded-gulio border border-gulio-border bg-white px-3 text-sm font-semibold text-gulio-text hover:bg-gulio-bg"
            >
              Back to cart
            </Link>
          </div>

          <div className="rounded-gulio border border-gulio-border bg-white p-5 shadow-sm">
            <p className="text-sm text-gulio-muted">Amount due</p>
            <p className="mt-1 text-cart-total tabular-nums text-gulio-text">
              {formatMoney(totalDecimal)}
            </p>
            {(customer || discountN > 0 || negotiatedCount > 0) && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {customer && (
                  <span className="rounded-full bg-teal-50 px-2.5 py-1 font-medium text-teal-800 ring-1 ring-inset ring-teal-200">
                    {customer.name}
                    {customer.phone ? ` · ${customer.phone}` : ""}
                  </span>
                )}
                {discountN > 0 && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800 ring-1 ring-inset ring-amber-200 tabular-nums">
                    −{formatMoney(discountAmount)}
                  </span>
                )}
                {negotiatedCount > 0 && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                    {negotiatedCount} negotiated
                  </span>
                )}
              </div>
            )}
            <ul className="mt-4 max-h-48 space-y-1 overflow-auto text-sm text-gulio-muted">
              {cart.map((l, i) => (
                <li
                  key={`${l.variantId}-${i}`}
                  className="flex justify-between gap-2"
                >
                  <span>
                    {l.productName} ×{l.quantity}
                    {isNegotiatedPrice(l.listUnitPrice, l.unitPrice)
                      ? " · Negotiated"
                      : ""}
                  </span>
                  <span className="tabular-nums">
                    {formatMoney(String(Number(l.unitPrice) * l.quantity))}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {error ? (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-gulio-error"
            >
              {error}
            </div>
          ) : null}

          <button
            type="button"
            className="mt-4 self-start text-xs font-semibold text-gulio-muted underline"
            onClick={() => setManualMm((v) => !v)}
          >
            {manualMm
              ? "Use phone keypad / push"
              : "Record SMS confirmation code instead"}
          </button>

          {manualMm ? (
            <form
              onSubmit={onComplete}
              className="mt-3 rounded-gulio border border-gulio-border bg-white p-4 shadow-sm"
            >
              <label className="block text-sm font-medium" htmlFor="mm-ref">
                Confirmation code
              </label>
              <input
                id="mm-ref"
                placeholder="e.g. CDE1F2G3HI"
                value={mmRef}
                onChange={(e) => setMmRef(e.target.value)}
                className="mt-1 min-h-touch w-full rounded-gulio border border-gulio-border px-3 outline-none ring-gulio-primary focus:ring-2"
              />
              <button
                type="submit"
                disabled={submitting || cart.length === 0}
                className="mt-4 min-h-touch w-full rounded-gulio bg-gulio-primary text-sm font-semibold text-white hover:bg-gulio-primary-hover disabled:opacity-60"
              >
                {submitting ? "Completing sale…" : "Complete sale"}
              </button>
            </form>
          ) : null}
        </section>

        {!manualMm ? (
          <aside className="flex w-[380px] shrink-0 flex-col border-l border-gulio-border bg-gulio-card xl:w-[420px]">
            <PosMobilePushPanel
              amount={totalDecimal}
              registerSessionId={shift.sessionId}
              buyerName={customer?.name ?? undefined}
              initialPhone={customer?.phone}
              itemCount={cart.reduce((n, l) => n + l.quantity, 0)}
              online={online}
              configured={Boolean(selcom?.configured)}
              enabled={Boolean(selcom?.enabled)}
              submittingSale={submitting}
              onPaid={onSelcomPaid}
            />
          </aside>
        ) : null}

        <PosManagerPinModal
          isOpen={pinOpen}
          body="This negotiated price is outside cashier policy. Ask Owner or Manager to enter their PIN."
          confirmLabel="Approve price"
          submitting={submitting}
          error={pinError}
          onClose={() => {
            if (!submitting) setPinOpen(false);
          }}
          onConfirm={(pin) => {
            void completeSale(pin, selcomOrderId ?? undefined);
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto h-full max-w-xl overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gulio-text">{title}</h1>
          <p className="text-sm text-gulio-muted">
            {method === "bank"
              ? "Sale stays on POS, then cash-in is posted to OpticEdge"
              : method === "cash"
                ? "Tender cash here. Cash-in posts to the OpticEdge Cash channel"
                : "Checkout · cash or split"}
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

        {(customer || discountN > 0 || negotiatedCount > 0) && (
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
            {negotiatedCount > 0 && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                {negotiatedCount} negotiated
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
                {isNegotiatedPrice(l.listUnitPrice, l.unitPrice)
                  ? " · Negotiated"
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
            <div className="rounded-gulio border-2 border-emerald-600/30 bg-emerald-50 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                OpticEdge channel
              </p>
              <p className="mt-1 text-lg font-bold text-emerald-950">
                {cashChannel?.name ?? "Cash"}
              </p>
              <p className="mt-0.5 text-xs text-emerald-800">
                {cashChannel
                  ? `Linked · ${cashChannel.type} · id ${cashChannel.id}`
                  : online
                    ? "Linking to the OpticEdge Cash till…"
                    : "Offline — POS sale still completes; cash-in waits for connection."}
              </p>
            </div>
            <p className="text-xs text-gulio-muted">
              This sale stays on POS. After complete, cash-in posts to that Cash
              channel on OpticEdge.
            </p>
          </div>
        )}

        {method === "bank" && (
          <div className="mt-6 space-y-3">
            <div className="rounded-gulio border-2 border-gulio-primary bg-teal-50 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-800">
                Customer paid via
              </p>
              <p className="mt-1 text-lg font-bold text-teal-950">
                {bankChannel?.name ?? "No channel selected"}
              </p>
              <p className="mt-0.5 text-xs text-teal-800">
                {bankChannel
                  ? `${bankChannel.type === "cash" ? "Cash" : "Bank"} · ${bankChannel.currency}`
                  : "Go back and tap BANK to pick a channel."}
              </p>
            </div>
            <p className="text-xs text-gulio-muted">
              Complete records the sale here, then sends the same amount to
              OpticEdge on this channel.
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
          disabled={
            submitting ||
            cart.length === 0 ||
            (method === "bank" && !bankChannel)
          }
          className="mt-8 flex w-full items-center justify-center rounded-gulio bg-gulio-primary py-3.5 text-sm font-semibold text-white hover:bg-gulio-primary-hover disabled:opacity-60"
        >
          {submitting
            ? "Completing sale…"
            : method === "bank" && bankChannel
              ? `Complete · ${bankChannel.name}`
              : needsManagerPin
                ? "Complete sale · manager PIN"
                : "Complete sale"}
        </button>
      </form>

      <PosManagerPinModal
        isOpen={pinOpen}
        body="This negotiated price is outside cashier policy. Ask Owner or Manager to enter their PIN."
        confirmLabel="Approve price"
        submitting={submitting}
        error={pinError}
        onClose={() => {
          if (!submitting) setPinOpen(false);
        }}
        onConfirm={(pin) => {
          void completeSale(pin, selcomOrderId ?? undefined);
        }}
      />
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
