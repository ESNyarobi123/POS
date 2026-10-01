/**
 * Column model for the Receive-stock history table.
 *
 * The "Customize" popover in the filter toolbar reads/writes the visible keys.
 * Locked columns are the receipt identity + settlement state, so they can never
 * be hidden — a table with no invoice or status is not a usable receipt list.
 *
 * Column keys mirror the reference design:
 *   INVOICE · DATE · BRANCH · DISTRIBUTOR · PRODUCT · QTY · WHOLESALE · TOTAL
 *   · PAID DATE · PAID · PENDING · RETAIL · STATUS
 *
 * Only `receivedAt`, `total` and `pendingTotal` are sortable server-side
 * (`GoodsReceiptSort`) — every other column is display-only.
 */

import type { GoodsReceiptSort } from "@gulio/contracts";

export type ReceiptColumnKey =
  | "invoice"
  | "date"
  | "branch"
  | "distributor"
  | "product"
  | "qty"
  | "wholesale"
  | "total"
  | "paidDate"
  | "paid"
  | "pending"
  | "retail"
  | "status"
  | "open";

export type ReceiptColumnAlign = "start" | "center" | "end";

export type ReceiptColumnDef = {
  key: ReceiptColumnKey;
  label: string;
  /** Locked columns are always visible (identity + settlement state). */
  locked?: boolean;
  align?: ReceiptColumnAlign;
  /** Server sort key when the column can be sorted. */
  sortKey?: GoodsReceiptSort;
  width?: number;
  /** Structural column (row affordance) — never offered in the column picker. */
  hidden?: boolean;
};

export const RECEIPT_COLUMNS: readonly ReceiptColumnDef[] = [
  { key: "invoice", label: "Invoice", locked: true, width: 132 },
  { key: "date", label: "Date", sortKey: "receivedAt", width: 108 },
  { key: "branch", label: "Branch", width: 132 },
  { key: "distributor", label: "Distributor", width: 156 },
  { key: "product", label: "Product", locked: true, width: 260 },
  { key: "qty", label: "Qty", align: "end", width: 72 },
  { key: "wholesale", label: "Wholesale", align: "end", width: 116 },
  { key: "total", label: "Total", align: "end", sortKey: "total", width: 124 },
  { key: "paidDate", label: "Paid date", width: 108 },
  { key: "paid", label: "Paid", align: "end", width: 116 },
  { key: "pending", label: "Pending", align: "end", sortKey: "pendingTotal", width: 116 },
  { key: "retail", label: "Retail", align: "end", width: 116 },
  { key: "status", label: "Status", locked: true, align: "center", width: 104 },
  { key: "open", label: "", locked: true, align: "end", width: 44, hidden: true },
] as const;

export const DEFAULT_RECEIPT_COLUMNS: ReceiptColumnKey[] = RECEIPT_COLUMNS.map(
  (c) => c.key,
);

export const RECEIPT_COLUMNS_STORAGE_KEY = "gulio_receive_columns_v1";

export function loadVisibleReceiptColumns(): ReceiptColumnKey[] {
  if (typeof window === "undefined") return DEFAULT_RECEIPT_COLUMNS;
  try {
    const raw = window.localStorage.getItem(RECEIPT_COLUMNS_STORAGE_KEY);
    if (!raw) return DEFAULT_RECEIPT_COLUMNS;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_RECEIPT_COLUMNS;
    const valid = new Set<ReceiptColumnKey>(RECEIPT_COLUMNS.map((c) => c.key));
    const chosen = parsed.filter(
      (k): k is ReceiptColumnKey =>
        typeof k === "string" && valid.has(k as ReceiptColumnKey),
    );
    const locked = RECEIPT_COLUMNS.filter((c) => c.locked).map((c) => c.key);
    const merged = new Set<ReceiptColumnKey>([...locked, ...chosen]);
    return RECEIPT_COLUMNS.filter((c) => merged.has(c.key)).map((c) => c.key);
  } catch {
    return DEFAULT_RECEIPT_COLUMNS;
  }
}

export function saveVisibleReceiptColumns(keys: ReceiptColumnKey[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      RECEIPT_COLUMNS_STORAGE_KEY,
      JSON.stringify(keys),
    );
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

export function visibleReceiptColumns(
  keys: ReceiptColumnKey[],
): ReceiptColumnDef[] {
  const set = new Set(keys);
  return RECEIPT_COLUMNS.filter((c) => set.has(c.key));
}
