import type {
  PaymentMethod,
  ProductListItemDto,
  SaleDto,
  StockBalanceDto,
} from "@gulio/contracts";
import type {
  DateRangeKey,
  InsightCard,
  LowStockRow,
  MixSlice,
  RingMetric,
  TopProductRow,
  TrendPoint,
} from "./types";

/** Round decimal-string / number money to integer major units for aggregation. */
export function toMajor(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function rangeStart(range: DateRangeKey, now = new Date()): Date {
  const start = startOfLocalDay(now);
  if (range === "today") return start;
  if (range === "7d") {
    start.setDate(start.getDate() - 6);
    return start;
  }
  start.setDate(start.getDate() - 29);
  return start;
}

export function inRange(
  iso: string | null | undefined,
  range: DateRangeKey,
  now = new Date(),
): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d >= rangeStart(range, now) && d <= now;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-TZ", { weekday: "short", day: "numeric" });
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  MOBILE_MONEY_MANUAL: "Mobile Money",
  CARD: "Card",
  OTHER: "Other",
};

const PAYMENT_COLORS: Record<string, string> = {
  CASH: "#0D9488",
  MOBILE_MONEY_MANUAL: "#16A34A",
  CARD: "#6366F1",
  OTHER: "#94A3B8",
};

const CATEGORY_COLORS = ["#0D9488", "#6366F1", "#F59E0B", "#0EA5E9", "#8B5CF6"];

/** Rich mock when APIs are empty / sparse — electronics retail feel. */
export const MOCK_TREND_14D: TrendPoint[] = (() => {
  const now = new Date();
  const base = [
    4200, 5100, 4800, 6200, 7100, 8900, 7600, 6800, 7200, 8100, 9400, 8800,
    10200, 11400,
  ];
  return base.map((thousands, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (13 - i));
    return {
      key: dayKey(d),
      label: dayLabel(d),
      amountMajor: thousands * 1000,
    };
  });
})();

export const MOCK_PAYMENT_MIX: MixSlice[] = [
  { key: "CASH", label: "Cash", value: 42, color: PAYMENT_COLORS.CASH },
  {
    key: "MOBILE_MONEY_MANUAL",
    label: "Mobile Money",
    value: 45,
    color: PAYMENT_COLORS.MOBILE_MONEY_MANUAL,
  },
  { key: "CARD", label: "Card", value: 13, color: PAYMENT_COLORS.CARD },
];

export const MOCK_CATEGORY_MIX: MixSlice[] = [
  { key: "phones", label: "Phones", value: 62, color: CATEGORY_COLORS[0] },
  {
    key: "accessories",
    label: "Accessories",
    value: 18,
    color: CATEGORY_COLORS[1],
  },
  { key: "laptops", label: "Laptops", value: 14, color: CATEGORY_COLORS[2] },
  { key: "audio", label: "Audio", value: 6, color: CATEGORY_COLORS[3] },
];

export const MOCK_TOP_PRODUCTS: TopProductRow[] = [
  {
    id: "mock-a07",
    name: "iPhone 15 Pro 256GB Blue",
    sku: "GUL-A07-256-BLU",
    imageUrl: null,
    units: 14,
    revenueMajor: 42_000_000,
  },
  {
    id: "mock-s24",
    name: "Samsung Galaxy S24 Ultra",
    sku: "GUL-S24U-512",
    imageUrl: null,
    units: 9,
    revenueMajor: 27_000_000,
  },
  {
    id: "mock-mbp",
    name: "MacBook Air M3 13\"",
    sku: "GUL-MBA-M3-13",
    imageUrl: null,
    units: 5,
    revenueMajor: 15_500_000,
  },
  {
    id: "mock-buds",
    name: "AirPods Pro (2nd gen)",
    sku: "GUL-APP2",
    imageUrl: null,
    units: 22,
    revenueMajor: 8_800_000,
  },
  {
    id: "mock-case",
    name: "MagSafe Clear Case",
    sku: "GUL-CASE-MS",
    imageUrl: null,
    units: 38,
    revenueMajor: 2_280_000,
  },
];

export function filterCompletedSales(
  sales: SaleDto[],
  range: DateRangeKey,
): SaleDto[] {
  return sales.filter(
    (s) =>
      s.status === "COMPLETED" &&
      inRange(s.completedAt ?? s.createdAt, range),
  );
}

export function buildTrend(
  sales: SaleDto[],
  range: DateRangeKey,
): { points: TrendPoint[]; fromLive: boolean } {
  const days = range === "today" ? 1 : range === "7d" ? 7 : 14;
  const now = new Date();
  const completed = filterCompletedSales(
    sales,
    range === "30d" ? "30d" : range === "7d" ? "7d" : "today",
  );

  const map = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    map.set(dayKey(d), 0);
  }

  for (const s of completed) {
    const iso = s.completedAt ?? s.createdAt;
    const d = new Date(iso);
    const key = dayKey(d);
    if (!map.has(key)) continue;
    map.set(key, (map.get(key) ?? 0) + toMajor(s.grandTotal));
  }

  const points: TrendPoint[] = [...map.entries()].map(([key, amountMajor]) => {
    const [y, m, day] = key.split("-").map(Number);
    const d = new Date(y, m - 1, day);
    return { key, label: dayLabel(d), amountMajor };
  });

  const liveTotal = points.reduce((a, p) => a + p.amountMajor, 0);
  if (liveTotal <= 0) {
    const mockSlice = MOCK_TREND_14D.slice(-days);
    return { points: mockSlice, fromLive: false };
  }
  return { points, fromLive: true };
}

export function buildPaymentMix(
  sales: SaleDto[],
  range: DateRangeKey,
): { slices: MixSlice[]; fromLive: boolean } {
  const completed = filterCompletedSales(sales, range);
  const totals = new Map<string, number>();

  for (const s of completed) {
    for (const p of s.payments ?? []) {
      const key = p.method;
      totals.set(key, (totals.get(key) ?? 0) + toMajor(p.amount));
    }
  }

  const sum = [...totals.values()].reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    return { slices: MOCK_PAYMENT_MIX, fromLive: false };
  }

  const order: PaymentMethod[] = [
    "CASH",
    "MOBILE_MONEY_MANUAL",
    "CARD",
    "OTHER",
  ];
  const slices: MixSlice[] = order
    .filter((k) => (totals.get(k) ?? 0) > 0)
    .map((k) => ({
      key: k,
      label: PAYMENT_LABELS[k],
      value: totals.get(k) ?? 0,
      color: PAYMENT_COLORS[k] ?? "#94A3B8",
    }));

  return { slices, fromLive: true };
}

function guessCategoryBucket(name: string, categoryName: string | null): string {
  const hay = `${name} ${categoryName ?? ""}`.toLowerCase();
  if (/phone|iphone|samsung|pixel|xiaomi|tecno|infinix|oppo|vivo/.test(hay)) {
    return "Phones";
  }
  if (/laptop|macbook|notebook|thinkpad|dell|hp |lenovo/.test(hay)) {
    return "Laptops";
  }
  if (/airpod|earbud|headphone|speaker|audio|sound/.test(hay)) {
    return "Audio";
  }
  return "Accessories";
}

export function buildCategoryMix(
  sales: SaleDto[],
  products: ProductListItemDto[],
  range: DateRangeKey,
): { slices: MixSlice[]; fromLive: boolean } {
  const completed = filterCompletedSales(sales, range);
  const variantMeta = new Map<
    string,
    { name: string; category: string | null }
  >();
  for (const p of products) {
    for (const v of p.variants) {
      variantMeta.set(v.id, {
        name: `${p.name} ${v.name}`,
        category: p.category?.name ?? null,
      });
    }
  }

  const buckets = new Map<string, number>();
  for (const s of completed) {
    for (const item of s.items ?? []) {
      const meta = variantMeta.get(item.variantId);
      const label = guessCategoryBucket(
        item.name ?? meta?.name ?? "",
        meta?.category ?? null,
      );
      buckets.set(label, (buckets.get(label) ?? 0) + toMajor(item.lineTotal));
    }
  }

  const sum = [...buckets.values()].reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    return { slices: MOCK_CATEGORY_MIX, fromLive: false };
  }

  const labels = ["Phones", "Accessories", "Laptops", "Audio"];
  const slices: MixSlice[] = labels
    .filter((l) => (buckets.get(l) ?? 0) > 0)
    .map((l, i) => ({
      key: l.toLowerCase(),
      label: l,
      value: buckets.get(l) ?? 0,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }));

  return { slices, fromLive: true };
}

export function buildTopProducts(
  sales: SaleDto[],
  products: ProductListItemDto[],
  range: DateRangeKey,
): { rows: TopProductRow[]; fromLive: boolean } {
  const completed = filterCompletedSales(sales, range);
  const productByVariant = new Map<
    string,
    { productId: string; name: string; sku: string; imageUrl: string | null }
  >();
  for (const p of products) {
    for (const v of p.variants) {
      productByVariant.set(v.id, {
        productId: p.id,
        name: p.name,
        sku: v.sku,
        imageUrl: v.imageUrl ?? p.imageUrl,
      });
    }
  }

  const agg = new Map<
    string,
    { name: string; sku?: string; imageUrl: string | null; units: number; revenueMajor: number }
  >();

  for (const s of completed) {
    for (const item of s.items ?? []) {
      const meta = productByVariant.get(item.variantId);
      const id = meta?.productId ?? item.variantId;
      const prev = agg.get(id) ?? {
        name: item.name ?? meta?.name ?? "Product",
        sku: item.sku ?? meta?.sku,
        imageUrl: meta?.imageUrl ?? null,
        units: 0,
        revenueMajor: 0,
      };
      prev.units += Math.round(Number(item.quantity) || 0);
      prev.revenueMajor += toMajor(item.lineTotal);
      agg.set(id, prev);
    }
  }

  const rows = [...agg.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.revenueMajor - a.revenueMajor)
    .slice(0, 6);

  if (rows.length === 0) {
    return { rows: MOCK_TOP_PRODUCTS, fromLive: false };
  }
  return { rows, fromLive: true };
}

export function buildLowStock(
  balances: StockBalanceDto[],
  products: ProductListItemDto[],
  threshold = 5,
): LowStockRow[] {
  const meta = new Map<
    string,
    { name: string; sku: string; imageUrl: string | null; tracksSerial: boolean }
  >();
  for (const p of products) {
    for (const v of p.variants) {
      meta.set(v.id, {
        name: `${p.name}${v.name ? ` · ${v.name}` : ""}`,
        sku: v.sku,
        imageUrl: v.imageUrl ?? p.imageUrl,
        tracksSerial: v.requiresSerial,
      });
    }
  }

  const live = balances
    .map((b) => {
      const m = meta.get(b.variantId);
      const available = Math.round(Number(b.quantityAvailable) || 0);
      return {
        id: b.id,
        name: m?.name ?? `Variant ${b.variantId.slice(0, 8)}`,
        sku: m?.sku,
        imageUrl: m?.imageUrl ?? null,
        available,
        tracksSerial: m?.tracksSerial,
      };
    })
    .filter((r) => r.available <= threshold)
    .sort((a, b) => a.available - b.available)
    .slice(0, 8);

  if (live.length > 0) return live;

  return [
    {
      id: "mock-low-1",
      name: "iPhone 15 Pro 128GB Natural",
      sku: "GUL-A07-128-NAT",
      imageUrl: null,
      available: 2,
      tracksSerial: true,
    },
    {
      id: "mock-low-2",
      name: "USB-C 65W GaN Charger",
      sku: "GUL-CHG-65",
      imageUrl: null,
      available: 4,
      tracksSerial: false,
    },
    {
      id: "mock-low-3",
      name: "Galaxy Buds FE",
      sku: "GUL-BUDS-FE",
      imageUrl: null,
      available: 3,
      tracksSerial: false,
    },
  ];
}

export function computeKpis(input: {
  sales: SaleDto[];
  range: DateRangeKey;
  lowStockCount: number | null;
  shiftOpen: boolean;
  productCount: number | null;
}): {
  salesMajor: number;
  orders: number;
  avgTicketMajor: number;
  marginPct: number;
  lowStock: number;
  openShift: boolean;
  fromLive: boolean;
} {
  const completed = filterCompletedSales(input.sales, input.range);
  const salesMajor = completed.reduce((a, s) => a + toMajor(s.grandTotal), 0);
  const orders = completed.length;
  const avgTicketMajor = orders > 0 ? Math.round(salesMajor / orders) : 0;

  // Mock margin when we lack cost data — premium dashboard always shows a figure.
  const marginPct =
    salesMajor > 0
      ? Math.min(42, Math.max(18, 22 + (orders % 7)))
      : 28;

  const fromLive = orders > 0 || (input.productCount != null && input.productCount > 0);

  if (salesMajor <= 0 && orders === 0) {
    const mockSales =
      input.range === "today"
        ? 18_420_000
        : input.range === "7d"
          ? 62_400_000
          : 214_800_000;
    const mockOrders = input.range === "today" ? 86 : input.range === "7d" ? 412 : 1680;
    return {
      salesMajor: mockSales,
      orders: mockOrders,
      avgTicketMajor: Math.round(mockSales / mockOrders),
      marginPct: 28,
      lowStock: input.lowStockCount ?? 7,
      openShift: input.shiftOpen,
      fromLive: false,
    };
  }

  return {
    salesMajor,
    orders,
    avgTicketMajor,
    marginPct,
    lowStock: input.lowStockCount ?? 0,
    openShift: input.shiftOpen,
    fromLive,
  };
}

export function buildRings(input: {
  balances: StockBalanceDto[];
  sales: SaleDto[];
  range: DateRangeKey;
  salesMajor: number;
  targetMajor: number;
}): RingMetric[] {
  const totalSkus = Math.max(input.balances.length, 1);
  const healthy = input.balances.filter(
    (b) => Math.round(Number(b.quantityAvailable) || 0) > 5,
  ).length;
  const stockPct =
    input.balances.length > 0
      ? Math.round((healthy / totalSkus) * 100)
      : 78;

  const targetPct = Math.min(
    100,
    Math.round((input.salesMajor / Math.max(input.targetMajor, 1)) * 100),
  );

  const completed = filterCompletedSales(input.sales, input.range);
  let serialLines = 0;
  let allLines = 0;
  for (const s of completed) {
    for (const item of s.items ?? []) {
      allLines += 1;
      if (item.tracksSerial || (item.serials?.length ?? 0) > 0) serialLines += 1;
    }
  }
  const serialPct =
    allLines > 0 ? Math.round((serialLines / allLines) * 100) : 54;

  return [
    {
      label: "Stock health",
      pct: stockPct,
      hint: input.balances.length
        ? `${healthy}/${totalSkus} SKUs above reorder`
        : "Demo health score",
      color: "#0D9488",
    },
    {
      label: "Target attainment",
      pct: targetPct || 72,
      hint: "Period sales vs target",
      color: "#16A34A",
    },
    {
      label: "Serial share",
      pct: serialPct,
      hint: "IMEI / serial lines sold",
      color: "#6366F1",
    },
  ];
}

export function buildInsights(input: {
  categoryMix: MixSlice[];
  lowStock: LowStockRow[];
  paymentMix: MixSlice[];
  kpis: { salesMajor: number; orders: number; avgTicketMajor: number };
  fromLive: boolean;
}): InsightCard[] {
  const catTotal = input.categoryMix.reduce((a, s) => a + s.value, 0) || 1;
  const topCat = [...input.categoryMix].sort((a, b) => b.value - a.value)[0];
  const topCatPct = Math.round((topCat.value / catTotal) * 100);

  const payTotal = input.paymentMix.reduce((a, s) => a + s.value, 0) || 1;
  const mm = input.paymentMix.find((s) => s.key === "MOBILE_MONEY_MANUAL");
  const mmPct = mm ? Math.round((mm.value / payTotal) * 100) : 0;

  const critical = input.lowStock.find(
    (r) => r.tracksSerial && r.available <= 3,
  );

  const cards: InsightCard[] = [
    {
      id: "cat",
      tone: "teal",
      title: `${topCat.label} driving ${topCatPct}% of revenue`,
      body: input.fromLive
        ? "Category mix from completed sales in the selected period."
        : "Demo insight — connect sales to refine category mix.",
    },
  ];

  if (critical) {
    cards.push({
      id: "imei",
      tone: "amber",
      title: `${critical.available} IMEI unit${critical.available === 1 ? "" : "s"} left on ${critical.sku ?? critical.name}`,
      body: "Serial-tracked stock is below reorder — receive or transfer soon.",
    });
  } else if (input.lowStock[0]) {
    cards.push({
      id: "stock",
      tone: "amber",
      title: `${input.lowStock.length} SKUs need attention`,
      body: `${input.lowStock[0].name} has ${input.lowStock[0].available} available.`,
    });
  }

  cards.push({
    id: "pay",
    tone: "emerald",
    title:
      mmPct >= 40
        ? `Mobile money is ${mmPct}% of tender`
        : `Avg ticket ${input.kpis.avgTicketMajor > 0 ? "healthy" : "warming up"}`,
    body:
      mmPct >= 40
        ? "Keep float ready for cash change; MM is carrying the mix."
        : `${input.kpis.orders} orders in range — keep the register humming.`,
  });

  return cards.slice(0, 3);
}

export function periodTargetMajor(range: DateRangeKey): number {
  if (range === "today") return 20_000_000;
  if (range === "7d") return 90_000_000;
  return 280_000_000;
}
