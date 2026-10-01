"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type Action = { href: string; label: string; icon: ReactNode };

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const ACTIONS: Action[] = [
  {
    href: "/products/new",
    label: "Add product",
    icon: (
      <Icon>
        <path d="M12 5v14M5 12h14" />
      </Icon>
    ),
  },
  {
    href: "/purchases/receive",
    label: "Receive stock",
    icon: (
      <Icon>
        <path d="M3 9l9-5 9 5-9 5-9-5z" />
        <path d="M3 9v6l9 5 9-5V9" />
        <path d="M12 14v6" />
      </Icon>
    ),
  },
  {
    href: "/labels",
    label: "Print labels",
    icon: (
      <Icon>
        <path d="M4 5h16v10H4zM8 19h8M12 15v4" />
      </Icon>
    ),
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: (
      <Icon>
        <path d="M4 7h16v12H4zM4 7l2-3h12l2 3M9 12h6" />
      </Icon>
    ),
  },
  {
    href: "/returns",
    label: "Returns",
    icon: (
      <Icon>
        <path d="M9 14l-4-4 4-4" />
        <path d="M5 10h11a4 4 0 010 8h-3" />
      </Icon>
    ),
  },
  {
    href: "/reports",
    label: "Reports",
    icon: (
      <Icon>
        <path d="M4 19V5M4 19h16" />
        <path d="M8 16v-5M12 16V8M16 16v-3" />
      </Icon>
    ),
  },
];

export function QuickActionsStrip() {
  return (
    <section
      className="rounded-xl border border-gulio-border bg-gulio-card p-4 shadow-sm"
      aria-label="Quick actions"
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-gulio-text">Quick actions</h2>
        <p className="hidden text-xs text-gulio-muted sm:block">
          Jump straight into the daily tasks
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-gulio-border bg-gulio-bg/60 px-3.5 text-sm font-medium text-gulio-text transition hover:border-teal-200 hover:bg-teal-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
          >
            {a.icon}
            {a.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
