"use client";

import type { ReactNode } from "react";
import { PermissionCode } from "@gulio/contracts";
import { useAuth } from "./auth-store";

export { PermissionCode };

function normalizeRoles(roles: string[] | undefined): string[] {
  return (roles ?? []).map((r) => r.toUpperCase());
}

function permissionSet(permissions: string[] | undefined): Set<string> {
  return new Set(permissions ?? []);
}

export type PermissionHelpers = {
  permissions: string[];
  roles: string[];
  can: (code: string) => boolean;
  canAny: (...codes: string[]) => boolean;
  canAll: (...codes: string[]) => boolean;
  isOwner: () => boolean;
  isManager: () => boolean;
  isCashier: () => boolean;
  /** Cashier without OWNER/MANAGER — POS-first login. */
  isCashierOnly: () => boolean;
};

export function usePermissions(): PermissionHelpers {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];
  const roles = normalizeRoles(user?.roles);
  const set = permissionSet(permissions);

  const can = (code: string) => set.has(code);
  const canAny = (...codes: string[]) =>
    codes.length === 0 ? false : codes.some((c) => set.has(c));
  const canAll = (...codes: string[]) =>
    codes.length === 0 ? true : codes.every((c) => set.has(c));
  const isOwner = () => roles.includes("OWNER");
  const isManager = () => roles.includes("MANAGER");
  const isCashier = () => roles.includes("CASHIER");
  const isCashierOnly = () => isCashier() && !isOwner() && !isManager();

  return {
    permissions,
    roles,
    can,
    canAny,
    canAll,
    isOwner,
    isManager,
    isCashier,
    isCashierOnly,
  };
}

/** Post-login destination by role. */
export function loginRedirectPath(roles: string[] | undefined): string {
  const normalized = normalizeRoles(roles);
  if (normalized.includes("OWNER") || normalized.includes("MANAGER")) {
    return "/dashboard";
  }
  return "/shift/open";
}

type RouterLike = { replace: (href: string) => void };

export function redirectIfCannot(
  router: RouterLike,
  permission: string | string[],
  helpers: Pick<PermissionHelpers, "can" | "canAny">,
): boolean {
  const codes = Array.isArray(permission) ? permission : [permission];
  const ok =
    codes.length === 1
      ? helpers.can(codes[0]!)
      : helpers.canAny(...codes);
  if (ok) return false;
  const need = codes[0] ?? "unknown";
  router.replace(`/access-denied?need=${encodeURIComponent(need)}`);
  return true;
}

type RequirePermissionProps = {
  permission?: string;
  anyOf?: string[];
  children: ReactNode;
  fallback?: ReactNode;
};

/** Conditionally render children when the signed-in user has permission. */
export function RequirePermission({
  permission,
  anyOf,
  children,
  fallback = null,
}: RequirePermissionProps) {
  const { can, canAny } = usePermissions();
  const allowed = permission
    ? can(permission)
    : anyOf && anyOf.length > 0
      ? canAny(...anyOf)
      : false;
  return <>{allowed ? children : fallback}</>;
}

/** Common POS permission codes for the employee editor checklist. */
export const COMMON_POS_PERMISSIONS: ReadonlyArray<{
  code: string;
  label: string;
  group: string;
}> = [
  { code: PermissionCode.POS_SELL, label: "Sell at POS", group: "POS" },
  { code: PermissionCode.POS_DISCOUNT, label: "Apply discounts", group: "POS" },
  {
    code: PermissionCode.POS_PRICE_OVERRIDE,
    label: "Price override",
    group: "POS",
  },
  { code: PermissionCode.POS_HOLD, label: "Hold / resume sale", group: "POS" },
  { code: PermissionCode.POS_VOID, label: "Void sale", group: "POS" },
  { code: PermissionCode.POS_RETURN, label: "Returns / refunds", group: "POS" },
  {
    code: PermissionCode.POS_LARGE_REFUND,
    label: "Large refunds",
    group: "POS",
  },
  {
    code: PermissionCode.POS_DRAWER_OPEN,
    label: "Open cash drawer",
    group: "POS",
  },
  {
    code: PermissionCode.SHIFT_OPEN_OWN,
    label: "Open own shift",
    group: "Shifts",
  },
  {
    code: PermissionCode.SHIFT_OPEN_ANY,
    label: "Open any shift",
    group: "Shifts",
  },
  { code: PermissionCode.CATALOG_VIEW, label: "View catalog", group: "Catalog" },
  {
    code: PermissionCode.CATALOG_MANAGE,
    label: "Manage catalog",
    group: "Catalog",
  },
  {
    code: PermissionCode.CATALOG_IMPORT,
    label: "Import catalog CSV",
    group: "Catalog",
  },
  { code: PermissionCode.LABELS_PRINT, label: "Print labels", group: "Catalog" },
  { code: PermissionCode.STOCK_VIEW, label: "View stock", group: "Inventory" },
  {
    code: PermissionCode.STOCK_ADJUST,
    label: "Adjust stock",
    group: "Inventory",
  },
  {
    code: PermissionCode.STOCK_SERIAL_FIX,
    label: "Fix serial / IMEI",
    group: "Inventory",
  },
  {
    code: PermissionCode.STOCK_COUNT,
    label: "Inventory count",
    group: "Inventory",
  },
  {
    code: PermissionCode.CUSTOMERS_MANAGE,
    label: "Manage customers",
    group: "CRM",
  },
  { code: PermissionCode.REPORTS_VIEW, label: "View reports", group: "Admin" },
  {
    code: PermissionCode.SETTINGS_MANAGE,
    label: "Manage settings",
    group: "Admin",
  },
  {
    code: PermissionCode.USERS_MANAGE,
    label: "Manage employees",
    group: "Admin",
  },
  { code: PermissionCode.AUDIT_VIEW, label: "View audit logs", group: "Admin" },
  {
    code: PermissionCode.REGISTERS_MANAGE,
    label: "Manage registers",
    group: "Admin",
  },
  {
    code: PermissionCode.ORG_MANAGE,
    label: "Manage organization",
    group: "Admin",
  },
];
