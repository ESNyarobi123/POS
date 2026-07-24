"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { loginRedirectPath } from "@/lib/permissions";

const DEMO_ACCOUNTS = [
  { role: "Owner", email: "owner@guliosmart.local" },
  { role: "Manager", email: "manager@guliosmart.local" },
  { role: "Cashier", email: "cashier@guliosmart.local" },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const { ready, token, user, login } = useAuth();
  const [email, setEmail] = useState("cashier@guliosmart.local");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    if (ready && token) {
      router.replace(loginRedirectPath(user?.roles));
    }
  }, [ready, token, user?.roles, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loggedIn = await login(email.trim(), password);
      router.push(loginRedirectPath(loggedIn.roles));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Login failed",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gulio-bg p-6">
      <div className="w-full max-w-md rounded-xl border border-gulio-border bg-gulio-card p-8 shadow-sm">
        <div className="mb-8 text-center">
          <p className="text-2xl font-bold text-gulio-primary">GulioSmart POS</p>
          <p className="mt-1 text-sm text-gulio-muted">
            Sell smarter. Track everything. Grow everywhere.
          </p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-gulio-text"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-gulio-border bg-white px-3 py-2.5 text-gulio-text outline-none ring-gulio-primary focus:ring-2"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-gulio-text"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-gulio-border bg-white px-3 py-2.5 text-gulio-text outline-none ring-gulio-primary focus:ring-2"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-gulio-error"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !ready}
            className="flex w-full items-center justify-center rounded-lg bg-gulio-primary py-3 text-sm font-semibold text-white hover:bg-gulio-primary-hover disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowDemo((v) => !v)}
            className="w-full text-center text-xs font-medium text-gulio-muted hover:text-gulio-text"
          >
            {showDemo ? "Hide demo accounts" : "Demo accounts"}
          </button>
          {showDemo ? (
            <div className="mt-3 space-y-2 rounded-xl border border-gulio-border bg-gulio-bg/80 p-3">
              <p className="text-[11px] text-gulio-muted">
                Password for all:{" "}
                <span className="font-mono">Password123!</span>
              </p>
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword("Password123!");
                  }}
                  className="flex w-full items-center justify-between rounded-lg border border-gulio-border bg-white px-3 py-2 text-left text-xs hover:border-gulio-primary/40"
                >
                  <span className="font-semibold text-gulio-text">{a.role}</span>
                  <span className="font-mono text-gulio-muted">{a.email}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <p className="mt-6 text-center text-xs text-gulio-muted">
          API: {API_BASE_URL}
        </p>
      </div>
    </div>
  );
}
