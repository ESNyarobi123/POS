"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
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

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gulio-bg p-6">
      {/* Logo Banner Outside Form */}
      <div className="w-full max-w-md mb-6 rounded-2xl bg-[#0f172a] p-8 text-center shadow-xl">
        <div className="relative mx-auto mb-3 h-14 w-full max-w-[220px]">
          <Image
            src="/logo.png"
            alt="GulioSmart Logo"
            fill
            className="object-contain"
            priority
          />
        </div>
        <p className="text-sm font-medium text-slate-300">
          Sell smarter. Track everything. Grow everywhere.
        </p>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-gulio-border bg-gulio-card p-8 shadow-2xl shadow-gulio-primary/5">
        {isMounted ? (
          <form className="space-y-5" onSubmit={onSubmit} suppressHydrationWarning>
            <div suppressHydrationWarning className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-[13px] font-semibold text-slate-700"
              >
                Email address
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-4 text-sm text-slate-900 transition-all hover:bg-slate-50 focus:border-gulio-primary focus:bg-white focus:outline-none focus:ring-4 focus:ring-gulio-primary/10"
                />
              </div>
            </div>
            
            <div suppressHydrationWarning className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-[13px] font-semibold text-slate-700"
              >
                Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-4 text-sm text-slate-900 transition-all hover:bg-slate-50 focus:border-gulio-primary focus:bg-white focus:outline-none focus:ring-4 focus:ring-gulio-primary/10"
                />
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !ready}
              className="mt-2 flex w-full items-center justify-center rounded-xl bg-gulio-primary py-3.5 text-sm font-semibold text-white shadow-lg shadow-gulio-primary/30 transition-all hover:bg-gulio-primary-hover hover:shadow-xl hover:shadow-gulio-primary/40 focus:outline-none focus:ring-4 focus:ring-gulio-primary/20 disabled:opacity-60 disabled:hover:shadow-none"
            >
              {submitting ? "Signing in…" : "Sign in to Dashboard"}
            </button>
          </form>
        ) : (
          <div className="h-[250px] w-full animate-pulse rounded-lg bg-gulio-bg/50"></div>
        )}

        <div className="mt-8">
          <button
            type="button"
            onClick={() => setShowDemo((v) => !v)}
            className="w-full text-center text-xs font-medium text-slate-400 transition-colors hover:text-slate-600"
          >
            {showDemo ? "Hide demo accounts" : "Need a demo account?"}
          </button>
          {showDemo ? (
            <div className="mt-3 space-y-2 rounded-xl border border-gulio-border bg-gulio-bg/80 p-3">
              <p className="text-[11px] text-gulio-muted">
                Password for all:{" "}
                <span className="font-mono">Password123!</span>
                <br />
                Owner/Manager PIN (large refunds):{" "}
                <span className="font-mono">1234</span>
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
