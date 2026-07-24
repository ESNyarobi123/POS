export type DateRangeKey = "today" | "7d" | "30d";

export type TrendPoint = {
  key: string;
  label: string;
  /** Integer major units (TZS) — never float chart math. */
  amountMajor: number;
};

export type MixSlice = {
  key: string;
  label: string;
  /** Integer major units or count. */
  value: number;
  color: string;
};

export type TopProductRow = {
  id: string;
  name: string;
  sku?: string;
  imageUrl: string | null;
  units: number;
  revenueMajor: number;
};

export type LowStockRow = {
  id: string;
  name: string;
  sku?: string;
  imageUrl: string | null;
  available: number;
  tracksSerial?: boolean;
};

export type InsightCard = {
  id: string;
  tone: "teal" | "amber" | "emerald" | "slate";
  title: string;
  body: string;
};

export type RingMetric = {
  label: string;
  /** 0–100 */
  pct: number;
  hint: string;
  color: string;
};
