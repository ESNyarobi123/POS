"use client";

import { Chip, Tooltip } from "@heroui/react";

type Props = {
  /** Keys from `DashboardSummaryResponse.notYetAvailable`. */
  keys: string[];
};

type Phase2Metric = { label: string; description: string };

const METRICS: Record<string, Phase2Metric> = {
  payables: {
    label: "Payables",
    description:
      "Money owed to suppliers for purchase orders. Needs the purchasing module.",
  },
  receivables: {
    label: "Receivables",
    description:
      "Money owed to you by customers and credit accounts. Needs customer credit ledgers.",
  },
  totalExpenses: {
    label: "Total expenses",
    description:
      "Operating costs and approved expense claims. Needs the expenses module.",
  },
  commissionPayouts: {
    label: "Commission payouts",
    description:
      "Agent and platform commission paid out. Needs the commissions module.",
  },
  purchaseBuyPrice: {
    label: "Purchase buy price",
    description:
      "Actual buy price of received stock over the range. Needs goods-receipt costing.",
  },
};

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
    </svg>
  );
}

export function Phase2Section({ keys }: Props) {
  const items = keys
    .map((key) => ({ key, metric: METRICS[key] }))
    .filter((item): item is { key: string; metric: Phase2Metric } =>
      Boolean(item.metric),
    );

  if (items.length === 0) return null;

  return (
    <section
      className="rounded-xl border border-dashed border-gulio-border bg-gulio-bg/40 p-5"
      aria-label="Coming with purchasing (Phase 2)"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-gulio-text">
            Coming with Purchasing
            <Chip
              size="sm"
              variant="flat"
              color="default"
              className="h-5 px-1.5 text-[10px] font-bold uppercase tracking-wide"
            >
              Phase 2
            </Chip>
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-gulio-muted">
            These owner metrics need the suppliers, purchase-orders and expenses
            modules, which are not built yet. They are shown here as placeholders
            so the picture is complete — no numbers are estimated or faked.
          </p>
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map(({ key, metric }) => (
          <li
            key={key}
            className="rounded-xl border border-dashed border-gulio-border bg-white/60 p-4"
            aria-disabled
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gulio-muted">
                {metric.label}
              </p>
              <div className="flex items-center gap-1.5">
                <Chip
                  size="sm"
                  variant="flat"
                  color="warning"
                  className="h-5 px-1.5 text-[10px] font-bold uppercase tracking-wide"
                >
                  Phase 2
                </Chip>
                <Tooltip content={metric.description} placement="top" delay={150}>
                  <button
                    type="button"
                    aria-label={`About ${metric.label}`}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-gulio-muted transition hover:text-gulio-text focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
                  >
                    <InfoIcon />
                  </button>
                </Tooltip>
              </div>
            </div>
            <p className="mt-2 text-xl font-bold tracking-tight text-slate-400">
              Not tracked yet
            </p>
            <p className="mt-1.5 text-xs leading-snug text-gulio-muted">
              {metric.description}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
