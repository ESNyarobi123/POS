/** Prototype mock data — no API. Money as integer minor units (TZS). */

export type MoneyMinor = number;

export function formatTzs(minor: MoneyMinor): string {
  const major = Math.trunc(minor / 100);
  return `TZS ${major.toLocaleString("en-TZ")}`;
}

export const session = {
  brand: "GulioSmart POS",
  branch: "Mikocheni Branch",
  cashier: "Amina J.",
  shift: "Shift #1042 · Open",
  register: "Counter 1",
  online: true,
};

export type Product = {
  id: string;
  name: string;
  variant: string;
  sku: string;
  category: string;
  priceMinor: MoneyMinor;
  stock: number;
  tracksSerial: boolean;
  barcode: string;
  imageUrl?: string | null;
};

export const categories = [
  "All",
  "Phones",
  "Laptops",
  "Accessories",
  "Audio",
  "Wearables",
] as const;

export const products: Product[] = [
  {
    id: "p1",
    name: "iPhone 15",
    variant: "128GB · Black",
    sku: "APL-IP15-128-BLK",
    category: "Phones",
    priceMinor: 2_450_000_00,
    stock: 8,
    tracksSerial: true,
    barcode: "GUL-IP15-128-BLK-0001",
    imageUrl:
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=320&q=80",
  },
  {
    id: "p2",
    name: "Samsung Galaxy A55",
    variant: "256GB · Navy",
    sku: "SAM-A55-256-NVY",
    category: "Phones",
    priceMinor: 980_000_00,
    stock: 14,
    tracksSerial: true,
    barcode: "8806095A55NVY",
    imageUrl:
      "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=320&q=80",
  },
  {
    id: "p3",
    name: "MacBook Air M2",
    variant: "8/256 · Silver",
    sku: "APL-MBA-M2-256",
    category: "Laptops",
    priceMinor: 3_850_000_00,
    stock: 3,
    tracksSerial: true,
    barcode: "GUL-MBA-M2-256-0003",
    imageUrl:
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=320&q=80",
  },
  {
    id: "p4",
    name: "USB-C Cable 1m",
    variant: "White",
    sku: "ACC-USBC-1M-WHT",
    category: "Accessories",
    priceMinor: 15_000_00,
    stock: 120,
    tracksSerial: false,
    barcode: "GUL-USBC-1M-0001",
    imageUrl: null,
  },
  {
    id: "p5",
    name: "AirPods Pro 2",
    variant: "USB-C",
    sku: "APL-APP2-USBC",
    category: "Audio",
    priceMinor: 720_000_00,
    stock: 11,
    tracksSerial: true,
    barcode: "GUL-APP2-0007",
    imageUrl:
      "https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=320&q=80",
  },
  {
    id: "p6",
    name: "Apple Watch SE",
    variant: "40mm · Midnight",
    sku: "APL-AWSE-40-MID",
    category: "Wearables",
    priceMinor: 890_000_00,
    stock: 6,
    tracksSerial: true,
    barcode: "GUL-AWSE-40-0002",
    imageUrl:
      "https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=320&q=80",
  },
  {
    id: "p7",
    name: "Phone Case MagSafe",
    variant: "Clear · iPhone 15",
    sku: "ACC-CASE-IP15-CLR",
    category: "Accessories",
    priceMinor: 45_000_00,
    stock: 48,
    tracksSerial: false,
    barcode: "GUL-CASE-IP15-0012",
    imageUrl: null,
  },
  {
    id: "p8",
    name: "Lenovo IdeaPad",
    variant: "16GB/512 · Grey",
    sku: "LEN-IDP-16-512",
    category: "Laptops",
    priceMinor: 1_650_000_00,
    stock: 5,
    tracksSerial: true,
    barcode: "GUL-LEN-IDP-0004",
    imageUrl:
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=320&q=80",
  },
];

export type CartLine = {
  productId: string;
  name: string;
  variant: string;
  qty: number;
  unitPriceMinor: MoneyMinor;
  imei?: string;
  tracksSerial: boolean;
};

export const mockCart: CartLine[] = [
  {
    productId: "p2",
    name: "Samsung Galaxy A55",
    variant: "256GB · Navy",
    qty: 1,
    unitPriceMinor: 980_000_00,
    imei: "356938035643809",
    tracksSerial: true,
  },
  {
    productId: "p4",
    name: "USB-C Cable 1m",
    variant: "White",
    qty: 2,
    unitPriceMinor: 15_000_00,
    tracksSerial: false,
  },
  {
    productId: "p7",
    name: "Phone Case MagSafe",
    variant: "Clear · iPhone 15",
    qty: 1,
    unitPriceMinor: 45_000_00,
    tracksSerial: false,
  },
];

export function cartSubtotal(lines: CartLine[]): MoneyMinor {
  return lines.reduce((sum, l) => sum + l.unitPriceMinor * l.qty, 0);
}

export const customers = [
  { id: "c1", name: "Hassan Mwamba", phone: "+255 712 345 678", visits: 12 },
  { id: "c2", name: "Grace Kimaro", phone: "+255 754 987 321", visits: 4 },
  { id: "c3", name: "John Okello", phone: "+255 768 112 233", visits: 1 },
  { id: "c4", name: "Neema Shayo", phone: "+255 622 445 566", visits: 7 },
];

export const stockRows = products.map((p) => ({
  ...p,
  warehouse: "Main warehouse",
  status: p.stock <= 5 ? ("low" as const) : ("ok" as const),
}));

export const receiptMock = {
  number: "RCP-2026-004821",
  date: "23 Jul 2026 · 14:12",
  cashier: session.cashier,
  branch: session.branch,
  customer: "Walk-in",
  lines: mockCart,
  payments: [
    { method: "Cash", amountMinor: 800_000_00 },
    { method: "M-Pesa", amountMinor: 255_000_00 },
  ],
  fiscal: "FISCAL_PENDING (mock)",
};

export const reportKpis = [
  { label: "Today sales", value: "TZS 18,420,000", hint: "+12% vs yesterday" },
  { label: "Transactions", value: "86", hint: "Shift open" },
  { label: "Avg ticket", value: "TZS 214,186", hint: "Incl. VAT" },
  { label: "Returns", value: "3", hint: "TZS 245,000 refunded" },
  { label: "Low stock SKUs", value: "7", hint: "Needs reorder" },
  { label: "Open shifts", value: "2", hint: "Mikocheni + CBD" },
];

export const shortcuts = [
  { key: "F2", label: "Search" },
  { key: "F4", label: "Customer" },
  { key: "F6", label: "Discount" },
  { key: "F8", label: "Hold" },
  { key: "F9", label: "Payment" },
  { key: "Ctrl+P", label: "Last receipt" },
  { key: "Esc", label: "Close" },
] as const;
