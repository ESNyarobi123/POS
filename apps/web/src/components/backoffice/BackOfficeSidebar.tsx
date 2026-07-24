"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type SVGProps,
} from "react";
import { PermissionCode, usePermissions } from "@/lib/permissions";

const STORAGE_KEY = "gulio_bo_sidebar";

type NavAccent =
  | "indigo"
  | "teal"
  | "amber"
  | "sky"
  | "emerald"
  | "blue"
  | "rose"
  | "purple"
  | "slate"
  | "cyan"
  | "violet"
  | "orange";

type NavItem = {
  href: string;
  label: string;
  accent: NavAccent;
  icon: (props: SVGProps<SVGSVGElement>) => ReactNode;
  /** Match exact path only (e.g. /products vs /products/new). */
  exact?: boolean;
  /** Show when user has this permission. */
  permission?: string;
  /** Show when user has any of these permissions. */
  anyOf?: string[];
};

const accentMap: Record<
  NavAccent,
  { tile: string; tileActive: string; bar: string; text: string; bg: string }
> = {
  indigo: {
    tile: "bg-indigo-50 text-indigo-600",
    tileActive: "bg-indigo-100 text-indigo-700",
    bar: "bg-indigo-500",
    text: "text-indigo-800",
    bg: "bg-indigo-50/80",
  },
  teal: {
    tile: "bg-teal-50 text-teal-600",
    tileActive: "bg-teal-100 text-teal-700",
    bar: "bg-teal-500",
    text: "text-teal-800",
    bg: "bg-teal-50/80",
  },
  amber: {
    tile: "bg-amber-50 text-amber-600",
    tileActive: "bg-amber-100 text-amber-700",
    bar: "bg-amber-500",
    text: "text-amber-900",
    bg: "bg-amber-50/80",
  },
  sky: {
    tile: "bg-sky-50 text-sky-600",
    tileActive: "bg-sky-100 text-sky-700",
    bar: "bg-sky-500",
    text: "text-sky-800",
    bg: "bg-sky-50/80",
  },
  emerald: {
    tile: "bg-emerald-50 text-emerald-600",
    tileActive: "bg-emerald-100 text-emerald-700",
    bar: "bg-emerald-500",
    text: "text-emerald-900",
    bg: "bg-emerald-50/80",
  },
  blue: {
    tile: "bg-blue-50 text-blue-600",
    tileActive: "bg-blue-100 text-blue-700",
    bar: "bg-blue-500",
    text: "text-blue-800",
    bg: "bg-blue-50/80",
  },
  rose: {
    tile: "bg-rose-50 text-rose-600",
    tileActive: "bg-rose-100 text-rose-700",
    bar: "bg-rose-400",
    text: "text-rose-800",
    bg: "bg-rose-50/70",
  },
  purple: {
    tile: "bg-purple-50 text-purple-600",
    tileActive: "bg-purple-100 text-purple-700",
    bar: "bg-purple-500",
    text: "text-purple-800",
    bg: "bg-purple-50/80",
  },
  slate: {
    tile: "bg-slate-100 text-slate-600",
    tileActive: "bg-slate-200 text-slate-700",
    bar: "bg-slate-500",
    text: "text-slate-800",
    bg: "bg-slate-100/80",
  },
  cyan: {
    tile: "bg-cyan-50 text-cyan-600",
    tileActive: "bg-cyan-100 text-cyan-700",
    bar: "bg-cyan-500",
    text: "text-cyan-800",
    bg: "bg-cyan-50/80",
  },
  violet: {
    tile: "bg-violet-50 text-violet-600",
    tileActive: "bg-violet-100 text-violet-700",
    bar: "bg-violet-500",
    text: "text-violet-800",
    bg: "bg-violet-50/80",
  },
  orange: {
    tile: "bg-orange-50 text-orange-600",
    tileActive: "bg-orange-100 text-orange-700",
    bar: "bg-orange-500",
    text: "text-orange-900",
    bg: "bg-orange-50/80",
  },
};

function IconDashboard(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function IconProducts(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" strokeLinejoin="round" />
      <path d="M3 8l9 5 9-5M12 13v10" strokeLinecap="round" />
    </svg>
  );
}

function IconInventory(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M4 7h16v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" strokeLinejoin="round" />
      <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round" />
      <path d="M8 12h8M8 16h5" strokeLinecap="round" />
    </svg>
  );
}

function IconLabels(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M4 6h10l6 6-6 6H4V6z" strokeLinejoin="round" />
      <circle cx="9" cy="12" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconReceive(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M12 3v12m0 0l-4-4m4 4l4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" />
    </svg>
  );
}

function IconCustomers(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 19c0-3 2.5-5 6-5s6 2 6 5" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M21 19c0-2.2-1.5-3.8-3.5-4.4" strokeLinecap="round" />
    </svg>
  );
}

function IconReturns(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M9 14H4v-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 9a9 9 0 11-1.5 5.5" strokeLinecap="round" />
    </svg>
  );
}

function IconReports(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M4 19V5M4 19h16" strokeLinecap="round" />
      <path d="M8 16v-5M12 16V8M16 16v-3" strokeLinecap="round" />
    </svg>
  );
}

function IconSettings(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconScanner(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2" strokeLinecap="round" />
      <path d="M7 12h10" strokeLinecap="round" />
    </svg>
  );
}

function IconEmployees(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 19c0-2.8 2.2-5 6-5s6 2.2 6 5" strokeLinecap="round" />
      <path d="M16 11l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconAudit(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M8 4h8a2 2 0 012 2v14l-6-3-6 3V6a2 2 0 012-2z" strokeLinejoin="round" />
      <path d="M10 9h4M10 13h4" strokeLinecap="round" />
    </svg>
  );
}

function IconPos(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M7 20h10M8 9h3M8 13h8" strokeLinecap="round" />
    </svg>
  );
}

function IconPanel(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
  );
}

function IconChevron(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    accent: "indigo",
    icon: IconDashboard,
    exact: true,
    anyOf: [PermissionCode.REPORTS_VIEW, PermissionCode.POS_SELL],
  },
  {
    href: "/products",
    label: "Products",
    accent: "teal",
    icon: IconProducts,
    permission: PermissionCode.CATALOG_VIEW,
  },
  {
    href: "/inventory",
    label: "Inventory",
    accent: "amber",
    icon: IconInventory,
    permission: PermissionCode.STOCK_VIEW,
  },
  {
    href: "/labels",
    label: "Labels",
    accent: "sky",
    icon: IconLabels,
    permission: PermissionCode.LABELS_PRINT,
  },
  {
    href: "/purchases/receive",
    label: "Receive stock",
    accent: "emerald",
    icon: IconReceive,
    permission: PermissionCode.STOCK_ADJUST,
  },
  {
    href: "/customers",
    label: "Customers",
    accent: "blue",
    icon: IconCustomers,
    permission: PermissionCode.CUSTOMERS_MANAGE,
  },
  {
    href: "/returns",
    label: "Returns",
    accent: "rose",
    icon: IconReturns,
    permission: PermissionCode.POS_RETURN,
  },
  {
    href: "/reports",
    label: "Reports",
    accent: "purple",
    icon: IconReports,
    permission: PermissionCode.REPORTS_VIEW,
  },
  {
    href: "/employees",
    label: "Employees",
    accent: "violet",
    icon: IconEmployees,
    permission: PermissionCode.USERS_MANAGE,
  },
  {
    href: "/audit-logs",
    label: "Audit logs",
    accent: "orange",
    icon: IconAudit,
    permission: PermissionCode.AUDIT_VIEW,
  },
  {
    href: "/settings",
    label: "Settings",
    accent: "slate",
    icon: IconSettings,
    permission: PermissionCode.SETTINGS_MANAGE,
  },
  {
    href: "/scan/price",
    label: "Scanner",
    accent: "cyan",
    icon: IconScanner,
    anyOf: [PermissionCode.CATALOG_VIEW, PermissionCode.POS_SELL],
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) {
    return pathname === item.href || pathname === `${item.href}/`;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function itemVisible(
  item: NavItem,
  can: (code: string) => boolean,
  canAny: (...codes: string[]) => boolean,
): boolean {
  if (item.permission) return can(item.permission);
  if (item.anyOf && item.anyOf.length > 0) return canAny(...item.anyOf);
  return true;
}

export function BackOfficeSidebar() {
  const pathname = usePathname();
  const { can, canAny, isOwner, isManager } = usePermissions();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const visibleItems = useMemo(
    () => navItems.filter((item) => itemVisible(item, can, canAny)),
    [can, canAny],
  );

  const showOpenPos = can(PermissionCode.POS_SELL) || isOwner() || isManager();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "collapsed") setCollapsed(true);
      else if (raw === "expanded") setCollapsed(false);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "collapsed" : "expanded");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <aside
      className={`relative flex h-full shrink-0 flex-col border-r border-gulio-border bg-gulio-card ease-out ${
        hydrated ? "transition-[width] duration-300" : ""
      } ${collapsed ? "w-[72px]" : "w-[260px]"}`}
      aria-label="Back office navigation"
    >
      {/* Brand + toggle */}
      <div
        className={`flex h-14 items-center gap-2 border-b border-gulio-border px-3 ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        <Link
          href="/dashboard"
          className={`flex min-w-0 items-center gap-2.5 ${collapsed ? "" : "flex-1"}`}
          title="GulioSmart Back office"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gulio-primary text-sm font-bold text-white shadow-sm">
            G
          </span>
          {!collapsed ? (
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold text-gulio-text">
                GulioSmart
              </span>
              <span className="block truncate text-[11px] text-gulio-muted">
                Back office
              </span>
            </span>
          ) : null}
        </Link>
        {!collapsed ? (
          <button
            type="button"
            onClick={toggle}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gulio-muted transition hover:bg-gulio-bg hover:text-gulio-text"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <IconChevron className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {collapsed ? (
        <div className="flex justify-center border-b border-gulio-border py-2">
          <button
            type="button"
            onClick={toggle}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gulio-muted transition hover:bg-gulio-bg hover:text-gulio-text"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <IconPanel className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Nav */}
      <nav className="bo-sidebar-nav flex-1 space-y-0.5 px-2 py-3">
        {visibleItems.map((item) => {
          const active = isActive(pathname, item);
          const colors = accentMap[item.accent];
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`group relative flex items-center gap-3 rounded-xl transition-colors ${
                collapsed ? "justify-center px-0 py-2" : "px-2 py-2"
              } ${
                active
                  ? `${colors.bg} ${colors.text}`
                  : "text-gulio-text hover:bg-gulio-bg"
              }`}
            >
              {active ? (
                <span
                  className={`absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full ${colors.bar}`}
                  aria-hidden
                />
              ) : null}
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                  active ? colors.tileActive : colors.tile
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
              </span>
              {!collapsed ? (
                <span
                  className={`truncate text-sm ${
                    active ? "font-semibold" : "font-medium"
                  }`}
                >
                  {item.label}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Open POS — Owner/Manager always; others need pos.sell */}
      {showOpenPos ? (
        <div className="border-t border-gulio-border p-3">
          <Link
            href="/pos"
            title="Open POS"
            className={`flex items-center justify-center gap-2 rounded-xl bg-gulio-primary text-sm font-semibold text-white shadow-sm transition hover:bg-gulio-primary-hover ${
              collapsed ? "h-11 w-11 mx-auto p-0" : "min-h-11 px-3 py-2.5"
            }`}
          >
            <IconPos className="h-5 w-5 shrink-0" />
            {!collapsed ? <span>Open POS</span> : null}
          </Link>
        </div>
      ) : null}
    </aside>
  );
}
