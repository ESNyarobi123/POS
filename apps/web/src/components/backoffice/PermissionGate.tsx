"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/lib/permissions";

type PermissionGateProps = {
  /** Single required permission. */
  permission?: string;
  /** Pass if any of these permissions is enough. */
  anyOf?: string[];
  children: ReactNode;
};

/**
 * Soft page guard — redirects to /access-denied when the user lacks permission.
 */
export function PermissionGate({
  permission,
  anyOf,
  children,
}: PermissionGateProps) {
  const router = useRouter();
  const { can, canAny } = usePermissions();

  const allowed = permission
    ? can(permission)
    : anyOf && anyOf.length > 0
      ? canAny(...anyOf)
      : false;

  const need = permission ?? anyOf?.[0] ?? "unknown";

  useEffect(() => {
    if (allowed) return;
    router.replace(`/access-denied?need=${encodeURIComponent(need)}`);
  }, [allowed, need, router]);

  if (!allowed) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-gulio-muted">Checking permissions…</p>
      </div>
    );
  }

  return <>{children}</>;
}

/** Inline access-denied panel for soft 403 handling without leaving the page. */
export function AccessDeniedPanel({
  need,
  message = "You don’t have access to this action.",
}: {
  need?: string;
  message?: string;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
    >
      <p className="font-medium">{message}</p>
      {need ? (
        <p className="mt-1 font-mono text-xs text-rose-800/80">
          Required: {need}
        </p>
      ) : null}
    </div>
  );
}
