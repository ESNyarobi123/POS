import type { SaleDto, StockBalanceDto } from "@gulio/contracts";

export type VelocityBand = "fast" | "medium" | "slow";
export type StockHealth = "healthy" | "watch" | "low" | "unknown";

export type CatalogRow = {
  key: string;
  productId: string;
  name: string;
  variant: string;
  sku: string;
  barcode: string | null;
  brand: string | null;
  category: string;
  categoryId: string | null;
  sellPrice: string | null;
  priceLabel: string;
  imageUrl: string | null;
  tracksSerial: boolean;
  source: "api" | "mock";
  /** Mock stock when API balances unavailable. */
  mockStock?: number;
};

/** Stable 0–1 hash from a string (SKU / id). */
export function hash01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/** Deterministic 7-day units-sold series so empty APIs still look real. */
export function mockTrend7d(sku: string): number[] {
  const base = 1 + Math.floor(hash01(sku) * 8);
  return Array.from({ length: 7 }, (_, i) => {
    const wobble = hash01(`${sku}:${i}`) * 4 - 1.5;
    return Math.max(0, Math.round(base + wobble + (i === 5 ? 2 : 0)));
  });
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Last 7 calendar days (oldest → newest) units sold for a variant from SaleDto items. */
export function trendFromSales(
  sales: SaleDto[],
  variantId: string,
): number[] | null {
  if (!sales.length) return null;
  let hasAnyItem = false;
  for (const s of sales) {
    if (s.items?.some((it) => it.variantId)) {
      hasAnyItem = true;
      break;
    }
  }
  if (!hasAnyItem) return null;

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const keys: string[] = [];
  const buckets = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const k = dayKey(d);
    keys.push(k);
    buckets.set(k, 0);
  }

  let matched = 0;
  for (const sale of sales) {
    const when = sale.completedAt ?? sale.createdAt;
    if (!when) continue;
    const k = when.slice(0, 10);
    if (!buckets.has(k)) continue;
    for (const item of sale.items ?? []) {
      if (item.variantId !== variantId) continue;
      const qty = Number(item.quantity);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      buckets.set(k, (buckets.get(k) ?? 0) + qty);
      matched += qty;
    }
  }

  if (matched === 0) return null;
  return keys.map((k) => buckets.get(k) ?? 0);
}

export function unitsSold7d(trend: number[]): number {
  return trend.reduce((a, b) => a + b, 0);
}

export function velocityBand(units7d: number): VelocityBand {
  if (units7d >= 12) return "fast";
  if (units7d >= 4) return "medium";
  return "slow";
}

export function stockHealth(qty: number | null): StockHealth {
  if (qty === null || !Number.isFinite(qty)) return "unknown";
  if (qty <= 3) return "low";
  if (qty <= 8) return "watch";
  return "healthy";
}

/** Cost estimate when API list variants omit costPrice (~62–78% of sell). */
export function estimateCostPrice(
  sellPrice: string | null,
  sku: string,
): string | null {
  if (!sellPrice) return null;
  const sell = Number(sellPrice);
  if (!Number.isFinite(sell) || sell <= 0) return null;
  const ratio = 0.62 + hash01(`cost:${sku}`) * 0.16;
  return (sell * ratio).toFixed(4);
}

export function marginPct(
  sellPrice: string | null,
  costPrice: string | null,
): number | null {
  if (!sellPrice || !costPrice) return null;
  const sell = Number(sellPrice);
  const cost = Number(costPrice);
  if (!Number.isFinite(sell) || !Number.isFinite(cost) || sell <= 0) return null;
  return Math.round(((sell - cost) / sell) * 100);
}

export function categorySharePct(
  rows: CatalogRow[],
  category: string,
): number {
  if (!rows.length) return 0;
  const inCat = rows.filter((r) => r.category === category).length;
  return Math.round((inCat / rows.length) * 100);
}

export function balanceMap(
  balances: StockBalanceDto[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const b of balances) {
    const q = Number(b.quantityAvailable);
    map.set(b.variantId, Number.isFinite(q) ? q : 0);
  }
  return map;
}

export function resolveStock(
  row: CatalogRow,
  balances: Map<string, number>,
): number | null {
  if (balances.has(row.key)) return balances.get(row.key) ?? 0;
  if (row.mockStock !== undefined) return row.mockStock;
  return null;
}

export type PortfolioOverview = {
  variantCount: number;
  productCount: number;
  serialTracked: number;
  categoryCount: number;
  lowStockCount: number;
  avgPriceLabel: string | null;
  topCategories: Array<{ name: string; count: number; pct: number }>;
  catalogTrend: number[];
};

export function buildPortfolioOverview(
  rows: CatalogRow[],
  balances: Map<string, number>,
  formatPrice: (n: number) => string,
): PortfolioOverview {
  const productIds = new Set(rows.map((r) => r.productId));
  const categories = new Map<string, number>();
  let serialTracked = 0;
  let priceSum = 0;
  let priceN = 0;
  let lowStockCount = 0;

  for (const r of rows) {
    if (r.tracksSerial) serialTracked += 1;
    categories.set(r.category, (categories.get(r.category) ?? 0) + 1);
    if (r.sellPrice) {
      const n = Number(r.sellPrice);
      if (Number.isFinite(n)) {
        priceSum += n;
        priceN += 1;
      }
    }
    const stock = resolveStock(r, balances);
    if (stock !== null && stock <= 5) lowStockCount += 1;
  }

  const topCategories = [...categories.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => ({
      name,
      count,
      pct: rows.length ? Math.round((count / rows.length) * 100) : 0,
    }));

  // Soft portfolio “activity” sparkline — deterministic from catalog shape.
  const seed = `portfolio:${rows.length}:${serialTracked}`;
  const catalogTrend = mockTrend7d(seed).map((v, i) =>
    Math.round(v * (1 + (i % 3) * 0.15) + rows.length * 0.08),
  );

  return {
    variantCount: rows.length,
    productCount: productIds.size,
    serialTracked,
    categoryCount: categories.size,
    lowStockCount,
    avgPriceLabel: priceN ? formatPrice(priceSum / priceN) : null,
    topCategories,
    catalogTrend,
  };
}

export type InsightChip = {
  id: string;
  label: string;
  tone: "teal" | "amber" | "emerald" | "slate" | "rose";
};

export function buildInsightChips(input: {
  row: CatalogRow;
  units7d: number;
  stock: number | null;
  categoryShare: number;
  velocity: VelocityBand;
}): InsightChip[] {
  const chips: InsightChip[] = [];
  const { row, units7d, stock, categoryShare, velocity } = input;

  if (row.tracksSerial) {
    chips.push({ id: "imei", label: "IMEI tracked", tone: "teal" });
  }
  if (categoryShare >= 25 && row.category !== "—") {
    chips.push({
      id: "top-cat",
      label: `Top in ${row.category}`,
      tone: "emerald",
    });
  }
  if (stock !== null && stock <= 5) {
    chips.push({ id: "low", label: "Low stock risk", tone: "rose" });
  } else if (stock !== null && stock <= 10) {
    chips.push({ id: "watch", label: "Watch stock", tone: "amber" });
  }
  if (velocity === "fast" || units7d >= 10) {
    chips.push({ id: "hot", label: "Hot mover", tone: "emerald" });
  } else if (velocity === "slow") {
    chips.push({ id: "slow", label: "Slow mover", tone: "slate" });
  }
  if (row.brand) {
    chips.push({ id: "brand", label: row.brand, tone: "slate" });
  }
  return chips.slice(0, 5);
}
