"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SelcomIntentDto } from "@gulio/contracts";
import { ApiError, apiFetch, getApiErrorCode } from "@/lib/api";
import { formatMoney, type DecimalString } from "@/lib/money";

type Props = {
  amount: DecimalString;
  registerSessionId: string;
  buyerName?: string;
  initialPhone?: string | null;
  itemCount: number;
  online: boolean;
  configured: boolean;
  enabled: boolean;
  submittingSale: boolean;
  onPaid: (orderId: string) => void;
};

const PAD = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["back", "0", "clear"],
] as const;

const keyClass =
  "flex min-h-14 items-center justify-center rounded-gulio border border-gulio-border bg-white text-2xl font-semibold tabular-nums text-gulio-text shadow-sm transition hover:border-teal-300 hover:bg-teal-50 active:scale-[0.98] disabled:opacity-40";

const ghostKeyClass =
  "flex min-h-14 items-center justify-center rounded-gulio border border-gulio-border bg-transparent text-sm font-semibold text-gulio-muted transition hover:bg-white hover:text-gulio-text disabled:opacity-40";

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function prettyPhone(raw: string): string {
  const d = digitsOnly(raw);
  if (d.startsWith("255") && d.length > 3) {
    const rest = d.slice(3);
    return `255 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6, 9)}`.trim();
  }
  if (d.startsWith("0")) {
    return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 10)}`.trim();
  }
  return d;
}

export function PosMobilePushPanel({
  amount,
  registerSessionId,
  buyerName,
  initialPhone,
  itemCount,
  online,
  configured,
  enabled,
  submittingSale,
  onPaid,
}: Props) {
  const [phone, setPhone] = useState(() => digitsOnly(initialPhone ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<SelcomIntentDto | null>(null);
  const paidOnce = useRef(false);
  const live = online && enabled && configured;

  const waiting =
    intent?.status === "PENDING" ||
    intent?.status === "PUSHED" ||
    intent?.status === "RECONCILE";
  const paid = intent?.status === "COMPLETED";
  const failed =
    intent?.status === "FAILED" || intent?.status === "CANCELLED";

  useEffect(() => {
    if (initialPhone) setPhone(digitsOnly(initialPhone));
  }, [initialPhone]);

  useEffect(() => {
    if (!intent || !waiting) return;
    const id = window.setInterval(() => {
      void (async () => {
        try {
          const next = await apiFetch<SelcomIntentDto>(
            `/payments/selcom/${encodeURIComponent(intent.orderId)}?refresh=true`,
          );
          setIntent(next);
        } catch {
          /* keep waiting */
        }
      })();
    }, 3000);
    return () => window.clearInterval(id);
  }, [intent, waiting]);

  useEffect(() => {
    if (paid && intent && !paidOnce.current) {
      paidOnce.current = true;
      onPaid(intent.orderId);
    }
  }, [paid, intent, onPaid]);

  const canPush =
    live && !busy && !waiting && !paid && digitsOnly(phone).length >= 10;

  const statusCopy = useMemo(() => {
    if (!online) return "Browser offline — reconnect to send a push.";
    if (!configured || !enabled) {
      return "Form is ready. Save Selcom APIs in Settings, then this button sends the push.";
    }
    if (paid) return "Customer paid. Completing the sale…";
    if (waiting) {
      return intent?.message || "Ask the customer to approve on their phone.";
    }
    if (failed) return intent?.message || "Push failed. Check the number and try again.";
    return "Customer will get M-Pesa / Mixx / Airtel prompt on this number.";
  }, [online, configured, enabled, paid, waiting, failed, intent]);

  function press(key: string) {
    if (waiting || paid) return;
    setError(null);
    setPhone((prev) => digitsOnly(prev + key).slice(0, 12));
  }

  function backspace() {
    if (waiting || paid) return;
    setPhone((prev) => prev.slice(0, -1));
  }

  async function sendPush() {
    if (!live) {
      setError("Save Selcom API key, secret, vendor ID, and base URL in Settings first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await apiFetch<SelcomIntentDto>("/payments/selcom/push", {
        method: "POST",
        body: {
          msisdn: phone,
          amount,
          registerSessionId,
          buyerName,
          itemCount,
        },
      });
      setIntent(next);
    } catch (err) {
      const code = getApiErrorCode(err);
      const message =
        err instanceof ApiError
          ? err.message
          : "Could not send the payment prompt";
      setError(
        code === "SELCOM_NOT_CONFIGURED"
          ? "Save Selcom API details in Settings first."
          : message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-gulio-border px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gulio-muted">
          Customer number
        </p>
        <p className="mt-1 min-h-10 text-[28px] font-bold leading-tight tabular-nums tracking-wide text-gulio-text">
          {prettyPhone(phone) || (
            <span className="text-gulio-muted/50">07__ ___ ___</span>
          )}
        </p>
        <p className="mt-1 text-xs text-gulio-muted">
          M-Pesa · Mixx by Yas · Airtel Money
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 p-3">
        {PAD.flatMap((row) =>
          row.map((key) => {
            if (key === "back") {
              return (
                <button
                  key="back"
                  type="button"
                  onClick={backspace}
                  disabled={waiting || paid}
                  className={ghostKeyClass}
                >
                  ⌫
                </button>
              );
            }
            if (key === "clear") {
              return (
                <button
                  key="clear"
                  type="button"
                  onClick={() => {
                    setPhone("");
                    setError(null);
                  }}
                  disabled={waiting || paid}
                  className={ghostKeyClass}
                >
                  Clear
                </button>
              );
            }
            return (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                disabled={waiting || paid}
                className={keyClass}
              >
                {key}
              </button>
            );
          }),
        )}
      </div>

      <div className="mt-auto space-y-2 border-t border-gulio-border p-3">
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            failed || error
              ? "border border-red-200 bg-red-50 text-red-800"
              : paid
                ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                : waiting
                  ? "border border-amber-200 bg-amber-50 text-amber-950"
                  : live
                    ? "text-gulio-muted"
                    : "border border-amber-200 bg-amber-50 text-amber-950"
          }`}
        >
          {error ?? (
            waiting ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                {statusCopy}
              </span>
            ) : (
              statusCopy
            )
          )}
        </p>

        <button
          type="button"
          onClick={() => void sendPush()}
          disabled={busy || waiting || paid || submittingSale || digitsOnly(phone).length < 10}
          className="min-h-touch flex w-full items-center justify-center rounded-gulio bg-gulio-success text-sm font-bold tracking-wide text-white shadow-sm ring-2 ring-green-600/20 transition hover:bg-green-700 active:scale-[0.98] disabled:opacity-50"
        >
          {busy
            ? "Sending push…"
            : waiting
              ? "Waiting on phone…"
              : paid
                ? "Paid"
                : `Send push · ${formatMoney(amount)}`}
        </button>
      </div>
    </div>
  );
}
