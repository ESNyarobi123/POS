"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { RegisterSessionDto } from "@gulio/contracts";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { parseMoneyInput } from "@/lib/money";
import type { PosShiftSession } from "@/lib/pos-session";

export default function OpenShiftPage() {
  const router = useRouter();
  const {
    ready,
    token,
    user,
    orgContext,
    shift,
    refreshOrgContext,
    setShift,
  } = useAuth();

  const [registerId, setRegisterId] = useState("");
  const [openingFloat, setOpeningFloat] = useState("100000");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingCtx, setLoadingCtx] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (shift?.sessionId) {
      router.replace("/pos");
      return;
    }
    if (!orgContext) {
      setLoadingCtx(true);
      void refreshOrgContext()
        .catch((err) => {
          setError(
            err instanceof ApiError ? err.message : "Failed to load registers",
          );
        })
        .finally(() => setLoadingCtx(false));
    }
  }, [ready, token, shift, orgContext, refreshOrgContext, router]);

  const registers = useMemo(
    () => (orgContext?.registers ?? []).filter((r) => r.isActive),
    [orgContext],
  );

  useEffect(() => {
    if (!registerId && registers.length > 0) {
      setRegisterId(registers[0].id);
    }
  }, [registers, registerId]);

  const selectedRegister = registers.find((r) => r.id === registerId);
  const branch = orgContext?.branches.find(
    (b) => b.id === selectedRegister?.branchId,
  );
  const warehouse =
    orgContext?.warehouses.find(
      (w) => w.branchId === selectedRegister?.branchId && w.isDefault,
    ) ??
    orgContext?.warehouses.find(
      (w) => w.branchId === selectedRegister?.branchId,
    );

  async function buildShiftSession(
    session: RegisterSessionDto,
  ): Promise<PosShiftSession> {
    const reg =
      orgContext?.registers.find((r) => r.id === session.registerId) ??
      selectedRegister;
    const br =
      orgContext?.branches.find((b) => b.id === session.branchId) ?? branch;
    const wh =
      orgContext?.warehouses.find(
        (w) => w.branchId === session.branchId && w.isDefault,
      ) ??
      orgContext?.warehouses.find((w) => w.branchId === session.branchId) ??
      warehouse;

    if (!reg || !br || !wh) {
      throw new Error("Missing branch/warehouse for register");
    }

    return {
      sessionId: session.id,
      registerId: reg.id,
      registerName: reg.name,
      branchId: br.id,
      branchName: br.name,
      warehouseId: wh.id,
      warehouseName: wh.name,
      openedAt: session.openedAt,
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!registerId) {
      setError("Select a register");
      return;
    }
    if (!warehouse) {
      setError("No warehouse found for this register’s branch");
      return;
    }

    setSubmitting(true);
    try {
      let session: RegisterSessionDto;
      try {
        session = await apiFetch<RegisterSessionDto>("/pos/shifts/open", {
          method: "POST",
          body: {
            registerId,
            openingFloat: parseMoneyInput(openingFloat),
          },
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          const current = await apiFetch<RegisterSessionDto | null>(
            `/pos/shifts/current?registerId=${encodeURIComponent(registerId)}`,
          );
          if (!current) {
            throw err;
          }
          session = current;
        } else {
          throw err;
        }
      }

      const posSession = await buildShiftSession(session);
      setShift(posSession);
      router.push("/pos");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not open shift",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || !token) {
    return (
      <div className="p-8 text-sm text-gulio-muted">Checking session…</div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-gulio-text">Open shift</h1>
        <p className="mt-1 text-sm text-gulio-muted">
          {orgContext?.organization.name ?? "Organization"} ·{" "}
          {user?.fullName ?? "Cashier"}
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="rounded-xl border border-gulio-border bg-gulio-card p-6 shadow-sm"
      >
        <label
          htmlFor="register"
          className="mb-1 block text-sm font-medium text-gulio-text"
        >
          Register
        </label>
        <select
          id="register"
          value={registerId}
          onChange={(e) => setRegisterId(e.target.value)}
          disabled={loadingCtx || registers.length === 0}
          className="mb-4 w-full rounded-lg border border-gulio-border bg-white px-3 py-2.5 text-gulio-text outline-none ring-gulio-primary focus:ring-2"
        >
          {registers.length === 0 && (
            <option value="">No registers available</option>
          )}
          {registers.map((r) => {
            const b = orgContext?.branches.find((x) => x.id === r.branchId);
            return (
              <option key={r.id} value={r.id}>
                {r.name} ({r.code})
                {b ? ` · ${b.name}` : ""}
              </option>
            );
          })}
        </select>

        <label
          htmlFor="opening-cash"
          className="mb-1 block text-sm font-medium text-gulio-text"
        >
          Opening cash (float)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gulio-muted">
            TZS
          </span>
          <input
            id="opening-cash"
            type="text"
            inputMode="numeric"
            value={openingFloat}
            onChange={(e) => setOpeningFloat(e.target.value)}
            className="w-full rounded-lg border border-gulio-border py-3 pl-12 pr-3 text-lg tabular-nums outline-none ring-gulio-primary focus:ring-2"
          />
        </div>
        <p className="mt-2 text-xs text-gulio-muted">
          Count drawer before selling. Variance is reported at close.
        </p>

        <div className="mt-6 space-y-2 rounded-lg bg-gulio-bg p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-gulio-muted">Cashier</span>
            <span className="font-medium">{user?.fullName ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gulio-muted">Branch</span>
            <span className="font-medium">{branch?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gulio-muted">Warehouse</span>
            <span className="font-medium">{warehouse?.name ?? "—"}</span>
          </div>
        </div>

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
          disabled={submitting || !registerId || !warehouse}
          className="mt-6 flex w-full items-center justify-center rounded-lg bg-gulio-primary py-3 text-sm font-semibold text-white hover:bg-gulio-primary-hover disabled:opacity-60"
        >
          {submitting ? "Opening…" : "Open shift & start selling"}
        </button>
      </form>

      <Link href="/login" className="text-center text-sm text-gulio-muted underline">
        Back to login
      </Link>
    </div>
  );
}
