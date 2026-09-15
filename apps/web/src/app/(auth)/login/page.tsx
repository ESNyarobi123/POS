"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ApiError, API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { loginRedirectPath } from "@/lib/permissions";

const DEMO_ACCOUNTS = [
  { role: "Owner", email: "owner@guliosmart.local", hint: "Full catalog & reports" },
  { role: "Manager", email: "manager@guliosmart.local", hint: "Stock, staff, returns" },
  { role: "Cashier", email: "cashier@guliosmart.local", hint: "POS register" },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const { ready, token, user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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
    <div className="relative min-h-screen overflow-hidden bg-[#07131a] text-white">
      {/* Atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 15% 20%, rgba(13,148,136,0.35), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 80%, rgba(15,23,42,0.9), transparent 50%), linear-gradient(160deg, #07131a 0%, #0c1f28 45%, #0a1620 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col lg:flex-row">
        {/* Brand plane — first viewport hero */}
        <section className="flex flex-1 flex-col justify-between px-8 pb-10 pt-12 sm:px-12 lg:max-w-[54%] lg:px-16 lg:py-16">
          <div
            className="animate-[fadeRise_0.7s_ease-out_both]"
            style={{ animationDelay: "0ms" }}
          >
            <div className="relative h-12 w-[200px] sm:h-14 sm:w-[240px]">
              <Image
                src="/logo.png"
                alt="GulioSmart"
                fill
                className="object-contain object-left"
                priority
              />
            </div>
          </div>

          <div className="mt-16 max-w-lg lg:mt-0">
            <p
              className="mb-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-teal-300/90 animate-[fadeRise_0.7s_ease-out_both]"
              style={{ animationDelay: "80ms" }}
            >
              Retail OS
            </p>
            <h1
              className="text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.25rem] animate-[fadeRise_0.75s_ease-out_both]"
              style={{ animationDelay: "140ms" }}
            >
              GulioSmart
            </h1>
            <p
              className="mt-5 max-w-md text-base leading-relaxed text-slate-300 sm:text-lg animate-[fadeRise_0.8s_ease-out_both]"
              style={{ animationDelay: "220ms" }}
            >
              Sell smarter. Track everything. Grow everywhere.
            </p>
            <ul
              className="mt-10 space-y-3 text-sm text-slate-400 animate-[fadeRise_0.85s_ease-out_both]"
              style={{ animationDelay: "300ms" }}
            >
              <li className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                IMEI-tracked devices &amp; live stock ledger
              </li>
              <li className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                POS, back office, and mobile scanner
              </li>
              <li className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                Cash, mobile money, returns &amp; warranty
              </li>
            </ul>
          </div>

          <p className="mt-12 hidden text-xs text-slate-500 lg:block">
            Electronics retail · Tanzania
          </p>
        </section>

        {/* Sign-in panel */}
        <section className="flex flex-1 items-end px-6 pb-10 sm:px-10 lg:items-center lg:px-12 lg:py-16">
          <div
            className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.97] p-7 text-slate-900 shadow-2xl shadow-black/40 backdrop-blur-sm sm:p-9 animate-[fadeRise_0.8s_ease-out_both]"
            style={{ animationDelay: "180ms" }}
          >
            <div className="mb-7">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                Sign in
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">
                Use your store account to open the register or back office.
              </p>
            </div>

            {mounted ? (
              <form className="space-y-4" onSubmit={onSubmit} suppressHydrationWarning>
                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="block text-[13px] font-semibold text-slate-700"
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
                    placeholder="you@store.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/15"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="password"
                    className="block text-[13px] font-semibold text-slate-700"
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
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/15"
                  />
                </div>

                {error ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
                  >
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting || !ready}
                  className="mt-1 flex w-full items-center justify-center rounded-xl bg-teal-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-teal-600/25 transition hover:bg-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-500/25 disabled:opacity-60"
                >
                  {submitting ? "Signing in…" : "Continue"}
                </button>
              </form>
            ) : (
              <div className="h-[220px] animate-pulse rounded-xl bg-slate-100" />
            )}

            <div className="mt-7 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={() => setShowDemo((v) => !v)}
                className="w-full text-center text-xs font-medium text-slate-400 transition hover:text-slate-600"
              >
                {showDemo ? "Hide demo accounts" : "Need a demo account?"}
              </button>
              {showDemo ? (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    Password:{" "}
                    <span className="font-mono text-slate-700">Password123!</span>
                    {" · "}
                    Manager PIN:{" "}
                    <span className="font-mono text-slate-700">1234</span>
                  </p>
                  {DEMO_ACCOUNTS.map((a) => (
                    <button
                      key={a.email}
                      type="button"
                      onClick={() => {
                        setEmail(a.email);
                        setPassword("Password123!");
                      }}
                      className="flex w-full flex-col gap-0.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left transition hover:border-teal-400/60 hover:bg-teal-50/40"
                    >
                      <span className="text-xs font-semibold text-slate-900">
                        {a.role}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {a.email}
                      </span>
                      <span className="text-[11px] text-slate-400">{a.hint}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <p className="mt-5 text-center text-[10px] text-slate-400">
              API {API_BASE_URL}
            </p>
          </div>
        </section>
      </div>

      <style jsx global>{`
        @keyframes fadeRise {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
