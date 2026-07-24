"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-store";

/** Soft auth gate — redirect to login when session is missing. */
export function BackOfficeAuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { ready, token } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace("/login");
    }
  }, [ready, token, router]);

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gulio-bg p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gulio-border border-t-gulio-primary" />
          <p className="text-sm text-gulio-muted">Loading back office…</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gulio-bg p-8">
        <p className="text-sm text-gulio-muted">Redirecting to sign in…</p>
      </div>
    );
  }

  return <>{children}</>;
}
