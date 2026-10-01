"use client";

import type { GoodsReceiptSummaryDto } from "@gulio/contracts";
import { MoneyCard } from "@/components/backoffice/dashboard/MoneyCard";
import { MetricGrid } from "@/components/backoffice/dashboard/MetricGrid";
import { formatCount } from "@/components/backoffice/dashboard/format";
import { formatMoney } from "@/lib/money";

type Props = {
  /** Summary from `GoodsReceiptListResponse.summary`, over the active filters. */
  summary: GoodsReceiptSummaryDto | null;
  loading?: boolean;
  /** e.g. "30 days · All branches" — never a fabricated figure. */
  rangeLabel?: string;
};

const EMPTY_SUMMARY: GoodsReceiptSummaryDto = {
  receiptsCount: 0,
  unitsReceived: 0,
  totalValue: "0",
  paidTotal: "0",
  pendingTotal: "0",
  supplierCount: 0,
  potentialMargin: "0",
  serialUnits: 0,
};

/**
 * At-a-glance receipt financials, mirroring the reference screenshot's idea:
 * the list row values roll up into a handful of owner-facing figures.
 * Every number is rendered straight from the API decimal string.
 */
export function ReceiptSummaryStrip({
  summary,
  loading = false,
  rangeLabel,
}: Props) {
  const s = summary ?? EMPTY_SUMMARY;

  return (
    <section aria-label="Receipt summary" className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MoneyCard
          label="Stock value received"
          value={formatMoney(s.totalValue)}
          hint={`${formatCount(s.receiptsCount)} receipt${
            s.receiptsCount === 1 ? "" : "s"
          } · ${formatCount(s.unitsReceived)} units`}
          accent="teal"
          loading={loading}
          emphasise
        />
        <MoneyCard
          label="Paid to distributors"
          value={formatMoney(s.paidTotal)}
          hint="Settled against these receipts"
          accent="emerald"
          loading={loading}
        />
        <MoneyCard
          label="Outstanding balance"
          value={formatMoney(s.pendingTotal)}
          hint="Still owed on these receipts"
          accent="amber"
          loading={loading}
        />
        <MoneyCard
          label="Potential margin"
          value={formatMoney(s.potentialMargin)}
          hint="Retail − wholesale at received quantity"
          accent="sky"
          loading={loading}
        />
      </div>

      <MetricGrid
        title="Receipt detail"
        caption={rangeLabel}
        loading={loading}
        metrics={[
          { label: "Receipts", value: formatCount(s.receiptsCount) },
          { label: "Units received", value: formatCount(s.unitsReceived) },
          { label: "Distributors", value: formatCount(s.supplierCount) },
          {
            label: "Serial / IMEI units",
            value: formatCount(s.serialUnits),
            tone: s.serialUnits > 0 ? "positive" : "default",
          },
        ]}
      />
    </section>
  );
}
