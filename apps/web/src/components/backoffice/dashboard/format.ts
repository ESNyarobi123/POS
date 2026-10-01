import type { DecimalString } from "@gulio/contracts";

/**
 * Convert a decimal money string to a number for **chart geometry only**
 * (pixel positions, bar widths, arc angles).
 *
 * Never use the result for a displayed money total — those always render the
 * original decimal string through `formatMoney`. This keeps JS float maths off
 * the money path (AGENTS.md rule 7).
 */
export function toChartNumber(
  value: DecimalString | number | null | undefined,
): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Thousands-separated integer count. */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return Math.round(value).toLocaleString("en-TZ");
}

/** Percentage from an already-rounded API number (`grossMarginPct`, `pct`). */
export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  const rounded =
    Math.abs(value) >= 100 ? Math.round(value) : Number(value.toFixed(digits));
  return `${rounded}%`;
}

/** Signed percentage for delta chips, e.g. `+12.4%` / `−3%`. */
export function formatDeltaPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatPct(Math.abs(value))}`;
}

/** True when a decimal money string represents zero (e.g. `"0.00"`). */
export function isZeroAmount(
  value: DecimalString | number | null | undefined,
): boolean {
  return toChartNumber(value) === 0;
}

/**
 * `part ÷ total` as a rounded percentage, or `null` when the total is zero.
 *
 * For derived indicators only (e.g. discount rate). Displayed money totals must
 * keep rendering the original decimal strings through `formatMoney`.
 */
export function ratioPct(
  part: DecimalString | number | null | undefined,
  total: DecimalString | number | null | undefined,
): number | null {
  const t = toChartNumber(total);
  if (t === 0) return null;
  return Math.round((toChartNumber(part) / t) * 100);
}

export type TrendDirection = "up" | "down" | "flat";

/** Classify a percent change into a direction. `null` is treated as flat. */
export function directionOf(
  value: number | null | undefined,
  threshold = 0.05,
): TrendDirection {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "flat";
  }
  if (value > threshold) return "up";
  if (value < -threshold) return "down";
  return "flat";
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Cash",
  MOBILE_MONEY_MANUAL: "Mobile money",
  MOBILE_MONEY: "Mobile money",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  CREDIT: "Store credit",
  OTHER: "Other",
};

export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return "—";
  return PAYMENT_LABELS[method] ?? method.replaceAll("_", " ").toLowerCase();
}

/** Palette for payment-method donut arcs — locked app colours, no purple theming. */
export const PAYMENT_COLORS: Record<string, string> = {
  CASH: "#0D9488",
  MOBILE_MONEY_MANUAL: "#16A34A",
  MOBILE_MONEY: "#16A34A",
  CARD: "#0284C7",
  BANK_TRANSFER: "#475569",
  CREDIT: "#F59E0B",
  OTHER: "#94A3B8",
};

export const CATEGORY_COLORS = [
  "#0D9488",
  "#0284C7",
  "#F59E0B",
  "#16A34A",
  "#E11D48",
  "#475569",
];

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-TZ", { dateStyle: "medium", timeStyle: "short" });
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-TZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Human label for a raw sale status enum. */
export function saleStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}
