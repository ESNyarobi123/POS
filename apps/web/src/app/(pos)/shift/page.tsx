"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { RegisterSessionDto } from "@gulio/contracts";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { parseMoneyInput, formatMoney } from "@/lib/money";

/**
 * Manage current register shift — linked from TopBar "Shift open · …".
 */
export default function ManageShiftPage() {
  const router = useRouter();
  const { ready, token, shift, setShift, user } = useAuth();
  const [countedCash, setCountedCash] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [closedSummary, setClosedSummary] = useState<RegisterSessionDto | null>(
    null,
  );

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (!shift?.sessionId && !closedSummary) {
      router.replace("/shift/open");
    }
  }, [ready, token, shift, closedSummary, router]);

  async function onClose(e: FormEvent) {
    e.preventDefault();
    if (!shift?.sessionId) return;
    setError(null);
    let amount: string;
    try {
      amount = parseMoneyInput(countedCash || "0");
    } catch {
      setError("Enter a valid counted cash amount");
      return;
    }
    setClosing(true);
    try {
      const session = await apiFetch<RegisterSessionDto>(
        `/pos/shifts/${shift.sessionId}/close`,
        {
          method: "POST",
          body: { countedCash: amount },
        },
      );
      setShift(null);
      setClosedSummary(session);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not close shift",
      );
    } finally {
      setClosing(false);
    }
  }

  if (!ready || !token) {
    return (
      <div className="p-8 text-sm text-gulio-muted">Loading shift…</div>
    );
  }

  if (closedSummary) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="rounded-2xl border border-gulio-border bg-gulio-card p-6 shadow-sm">
          <p className="text-sm font-medium text-gulio-success">Shift closed</p>
          <h1 className="mt-1 text-2xl font-bold text-gulio-text">
            {closedSummary.registerId ? "Register session ended" : "Done"}
          </h1>
          <dl className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gulio-muted">Counted cash</dt>
              <dd className="font-semibold tabular-nums">
                {closedSummary.closingCountedCash != null
                  ? formatMoney(String(closedSummary.closingCountedCash))
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gulio-muted">Expected cash</dt>
              <dd className="font-semibold tabular-nums">
                {closedSummary.expectedCash != null
                  ? formatMoney(String(closedSummary.expectedCash))
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gulio-muted">Variance</dt>
              <dd
                className={`font-semibold tabular-nums ${
                  Number(closedSummary.variance ?? 0) < 0
                    ? "text-gulio-error"
                    : Number(closedSummary.variance ?? 0) > 0
                      ? "text-gulio-success"
                      : "text-gulio-text"
                }`}
              >
                {closedSummary.variance != null
                  ? formatMoney(String(closedSummary.variance))
                  : "—"}
              </dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/shift/open"
              className="rounded-xl bg-gulio-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-gulio-primary-hover"
            >
              Open new shift
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl border border-gulio-border px-4 py-2.5 text-sm font-medium text-gulio-text hover:bg-gulio-bg"
            >
              Back office
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="p-8 text-sm text-gulio-muted">Redirecting…</div>
    );
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <div className="rounded-2xl border border-gulio-border bg-gulio-card p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-gulio-success">
          Shift open
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gulio-text">
          {shift.registerName}
        </h1>
        <p className="mt-1 text-sm text-gulio-muted">
          {shift.branchName}
          {user?.fullName ? ` · ${user.fullName}` : ""}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link
            href="/pos"
            className="rounded-xl bg-gulio-primary px-4 py-3 text-center text-sm font-semibold text-white hover:bg-gulio-primary-hover"
          >
            Continue selling
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-gulio-border px-4 py-3 text-center text-sm font-medium text-gulio-text hover:bg-gulio-bg"
          >
            Back office
          </Link>
        </div>

        <form
          onSubmit={onClose}
          className="mt-8 border-t border-gulio-border pt-6"
        >
          <h2 className="text-sm font-semibold text-gulio-text">Close shift</h2>
          <p className="mt-1 text-xs text-gulio-muted">
            Count cash in drawer, then close. System compares to expected cash.
          </p>
          <label className="mt-4 block text-sm font-medium text-gulio-text">
            Counted cash (TZS)
            <input
              type="text"
              inputMode="decimal"
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
              placeholder="e.g. 125000"
              className="mt-1.5 w-full rounded-xl border border-gulio-border px-3.5 py-2.5 text-sm tabular-nums outline-none ring-gulio-primary focus:ring-2"
              required
            />
          </label>
          {error ? (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-gulio-error"
            >
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={closing}
            className="mt-4 w-full rounded-xl border border-rose-200 bg-rose-50 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
          >
            {closing ? "Closing…" : "Close shift"}
          </button>
        </form>
      </div>
    </div>
  );
}
