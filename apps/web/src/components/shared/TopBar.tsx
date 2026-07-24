"use client";

import Link from "next/link";
import type { ReactNode, SVGProps } from "react";
import { useAuth } from "@/lib/auth-store";
import { API_BASE_URL } from "@/lib/api";
import { PermissionCode, usePermissions } from "@/lib/permissions";

type TopBarProps = {
  showBackOfficeLink?: boolean;
  showPosLink?: boolean;
};

type ChipTone = "brand" | "branch" | "cashier" | "shiftOn" | "shiftOff";

const chipTone: Record<
  ChipTone,
  { wrap: string; icon: string; label: string }
> = {
  brand: {
    wrap: "border-teal-200/80 bg-gradient-to-b from-teal-50 to-white text-teal-800 shadow-sm shadow-teal-900/5 hover:border-teal-300 hover:from-teal-100/80",
    icon: "bg-gulio-primary text-white shadow-sm shadow-teal-900/20",
    label: "text-teal-900",
  },
  branch: {
    wrap: "border-sky-200/80 bg-gradient-to-b from-sky-50 to-white text-sky-900 shadow-sm shadow-sky-900/5 hover:border-sky-300 hover:from-sky-100/70",
    icon: "bg-sky-500 text-white",
    label: "text-sky-950",
  },
  cashier: {
    wrap: "border-indigo-200/80 bg-gradient-to-b from-indigo-50 to-white text-indigo-900 shadow-sm shadow-indigo-900/5 hover:border-indigo-300 hover:from-indigo-100/70",
    icon: "bg-indigo-500 text-white",
    label: "text-indigo-950",
  },
  shiftOn: {
    wrap: "border-emerald-200/90 bg-gradient-to-b from-emerald-50 to-white text-emerald-900 shadow-sm shadow-emerald-900/5 hover:border-emerald-300 hover:from-emerald-100/80",
    icon: "bg-gulio-success text-white",
    label: "text-emerald-950",
  },
  shiftOff: {
    wrap: "border-amber-200/90 bg-gradient-to-b from-amber-50 to-white text-amber-900 shadow-sm shadow-amber-900/5 hover:border-amber-300 hover:from-amber-100/80",
    icon: "bg-gulio-warn text-white",
    label: "text-amber-950",
  },
};

function HeaderButton({
  href,
  title,
  tone,
  icon,
  eyebrow,
  label,
  className = "",
}: {
  href: string;
  title: string;
  tone: ChipTone;
  icon: ReactNode;
  eyebrow?: string;
  label: string;
  className?: string;
}) {
  const t = chipTone[tone];
  return (
    <Link
      href={href}
      title={title}
      className={`group inline-flex max-w-[220px] items-center gap-2 rounded-xl border px-2.5 py-1.5 transition active:scale-[0.98] ${t.wrap} ${className}`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${t.icon}`}
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0 text-left leading-tight">
        {eyebrow ? (
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-gulio-muted/90">
            {eyebrow}
          </span>
        ) : null}
        <span className={`block truncate text-[13px] font-semibold ${t.label}`}>
          {label}
        </span>
      </span>
      <Chevron className="ml-0.5 h-3.5 w-3.5 shrink-0 opacity-40 transition group-hover:opacity-70" />
    </Link>
  );
}

function GhostBtn({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 items-center rounded-lg border border-gulio-border bg-white px-2.5 text-xs font-semibold text-gulio-text shadow-sm transition hover:border-gulio-primary/40 hover:bg-gulio-bg"
    >
      {children}
    </Link>
  );
}

export function TopBar({
  showBackOfficeLink = true,
  showPosLink = false,
}: TopBarProps) {
  const { user, orgContext, shift, online, logout } = useAuth();
  const { can, isOwner, isManager } = usePermissions();

  const branchName =
    shift?.branchName ??
    orgContext?.branches.find((b) => b.isActive)?.name ??
    "—";
  const cashier = user?.fullName ?? "Guest";
  const shiftHref = shift ? "/shift" : "/shift/open";
  const settingsHref = can(PermissionCode.SETTINGS_MANAGE)
    ? "/settings"
    : isOwner() || isManager()
      ? "/dashboard"
      : "/shift/open";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-gulio-border bg-gulio-card/95 px-3 backdrop-blur sm:px-4">
      <nav
        className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Context"
      >
        <HeaderButton
          href={shift ? "/pos" : "/shift/open"}
          title="Go to POS register"
          tone="brand"
          eyebrow="Register"
          label="GulioSmart POS"
          icon={<IconStore className="h-3.5 w-3.5" />}
          className="shrink-0"
        />
        <HeaderButton
          href={settingsHref}
          title={
            can(PermissionCode.SETTINGS_MANAGE)
              ? "Branch & organization settings"
              : "Branch context"
          }
          tone="branch"
          eyebrow="Branch"
          label={branchName}
          icon={<IconBuilding className="h-3.5 w-3.5" />}
          className="shrink-0"
        />
        <HeaderButton
          href={settingsHref}
          title={
            can(PermissionCode.SETTINGS_MANAGE)
              ? "Signed-in user — open settings"
              : "Signed-in user"
          }
          tone="cashier"
          eyebrow="Cashier"
          label={cashier}
          icon={<IconUser className="h-3.5 w-3.5" />}
          className="hidden shrink-0 sm:inline-flex"
        />
        <HeaderButton
          href={shiftHref}
          title={
            shift
              ? "View or close this register shift"
              : "Open a register shift to start selling"
          }
          tone={shift ? "shiftOn" : "shiftOff"}
          eyebrow="Shift"
          label={
            shift ? `Open · ${shift.registerName}` : "No open shift"
          }
          icon={
            shift ? (
              <IconPulse className="h-3.5 w-3.5" />
            ) : (
              <IconClock className="h-3.5 w-3.5" />
            )
          }
          className="hidden shrink-0 md:inline-flex"
        />
      </nav>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {showPosLink && (
          <GhostBtn href={shift ? "/pos" : "/shift/open"}>POS</GhostBtn>
        )}
        {showBackOfficeLink && (
          <GhostBtn href="/dashboard">Back office</GhostBtn>
        )}
        <span
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold ${
            online
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
          title={API_BASE_URL}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              online ? "bg-gulio-success" : "bg-gulio-error"
            } ${online ? "animate-pulse" : ""}`}
            aria-hidden
          />
          {online ? "Online" : "Offline"}
        </span>
        {user && (
          <button
            type="button"
            onClick={() => {
              logout();
              window.location.href = "/login";
            }}
            className="inline-flex h-8 items-center rounded-lg border border-gulio-border bg-white px-2.5 text-xs font-semibold text-gulio-muted shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
          >
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}

function Chevron(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L10.94 10 7.23 6.29a.75.75 0 111.06-1.06l4.24 4.24a.75.75 0 010 1.06l-4.24 4.24a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconStore(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M3 9l1-5h16l1 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 9h18v11a1 1 0 01-1 1H4a1 1 0 01-1-1V9z" strokeLinejoin="round" />
      <path d="M9 20v-6h6v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBuilding(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M4 21V5a1 1 0 011-1h8a1 1 0 011 1v16" strokeLinejoin="round" />
      <path d="M14 10h5a1 1 0 011 1v10" strokeLinejoin="round" />
      <path d="M8 8h2M8 12h2M8 16h2M17 14h1M17 17h1" strokeLinecap="round" />
    </svg>
  );
}

function IconUser(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0114 0" strokeLinecap="round" />
    </svg>
  );
}

function IconPulse(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path
        d="M3 12h3l2-5 3 10 2-5h8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
