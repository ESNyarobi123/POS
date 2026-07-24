"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { usePermissions } from "@/lib/permissions";

function AccessDeniedBody() {
  const search = useSearchParams();
  const need = search.get("need");
  const { isOwner, isManager, isCashierOnly } = usePermissions();

  const homeHref =
    isOwner() || isManager()
      ? "/dashboard"
      : isCashierOnly()
        ? "/shift/open"
        : "/dashboard";

  return (
    <div className="flex min-h-[calc(100vh-7.5rem)] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-gulio-border bg-gulio-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            className="h-7 w-7"
            aria-hidden
          >
            <path
              d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z"
              strokeLinejoin="round"
            />
            <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gulio-text">
          You don’t have access
        </h1>
        <p className="mt-2 text-sm text-gulio-muted">
          This area needs a permission your account doesn’t include. Ask an
          owner or manager if you need it unlocked.
        </p>
        {need ? (
          <p className="mt-4 rounded-xl bg-gulio-bg px-3 py-2 font-mono text-xs text-gulio-text">
            Required: {need}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href={homeHref}
            className="inline-flex min-h-touch items-center justify-center rounded-xl bg-gulio-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-gulio-primary-hover"
          >
            Go back
          </Link>
          <Link
            href="/pos"
            className="inline-flex min-h-touch items-center justify-center rounded-xl border border-gulio-border bg-white px-4 py-2.5 text-sm font-medium text-gulio-text hover:bg-gulio-bg"
          >
            Open POS
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AccessDeniedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-gulio-muted">
          Checking access…
        </div>
      }
    >
      <AccessDeniedBody />
    </Suspense>
  );
}
