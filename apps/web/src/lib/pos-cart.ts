/** Cart + sale meta persisted in sessionStorage between POS → payment. */

import type { DecimalString } from "./money";

export const CART_STORAGE_KEY = "gulio_pos_cart";
export const CUSTOMER_STORAGE_KEY = "gulio_pos_customer";
export const DISCOUNT_STORAGE_KEY = "gulio_pos_discount";
export const HELD_SALES_STORAGE_KEY = "gulio_pos_held_sales";
export const LAST_SALE_ID_KEY = "gulio_pos_last_sale_id";
export const PAYMENT_METHOD_KEY = "gulio_payment_method";

export type PosCartLine = {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  quantity: number;
  /** Charged unit price for this cart line (may be negotiated). */
  unitPrice: DecimalString;
  /** Catalog sell price when the line was added — never used as catalog write. */
  listUnitPrice?: DecimalString;
  requiresSerial: boolean;
  /** Product/variant image URL for cart thumbnails. */
  imageUrl?: string | null;
  serialUnitIds?: string[];
  serialNumbers?: string[];
};

export type PosCartCustomer = {
  id: string;
  name: string;
  phone: string | null;
};

export type HeldSale = {
  id: string;
  createdAt: string;
  cart: PosCartLine[];
  customer: PosCartCustomer | null;
  discountAmount: DecimalString;
  label: string;
};

export type PendingPaymentMethod = "cash" | "mobile" | "split" | "bank";

export type PendingBankChannel = {
  id: number;
  name: string;
  type: string;
  currency: string;
};

export const BANK_CHANNEL_KEY = "gulio_pos_bank_channel";

export function loadCart(): PosCartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PosCartLine[];
    return parsed.map((line) => ({
      ...line,
      listUnitPrice: line.listUnitPrice ?? line.unitPrice,
    }));
  } catch {
    return [];
  }
}

export function saveCart(lines: PosCartLine[]): void {
  sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
}

export function clearCart(): void {
  sessionStorage.removeItem(CART_STORAGE_KEY);
}

export function loadCustomer(): PosCartCustomer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CUSTOMER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PosCartCustomer;
  } catch {
    return null;
  }
}

export function saveCustomer(customer: PosCartCustomer | null): void {
  if (customer == null) {
    sessionStorage.removeItem(CUSTOMER_STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(customer));
}

export function loadDiscountAmount(): DecimalString {
  if (typeof window === "undefined") return "0";
  const raw = sessionStorage.getItem(DISCOUNT_STORAGE_KEY);
  if (!raw) return "0";
  return raw;
}

export function saveDiscountAmount(amount: DecimalString): void {
  if (!amount || amount === "0" || Number(amount) === 0) {
    sessionStorage.removeItem(DISCOUNT_STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(DISCOUNT_STORAGE_KEY, amount);
}

export function loadHeldSales(): HeldSale[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(HELD_SALES_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HeldSale[];
  } catch {
    return [];
  }
}

export function saveHeldSales(held: HeldSale[]): void {
  sessionStorage.setItem(HELD_SALES_STORAGE_KEY, JSON.stringify(held));
}

export function loadLastSaleId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(LAST_SALE_ID_KEY);
}

export function saveLastSaleId(saleId: string): void {
  sessionStorage.setItem(LAST_SALE_ID_KEY, saleId);
}

/** Clear active cart + customer + discount (held sales / last receipt kept). */
export function clearActiveSale(): void {
  clearCart();
  saveCustomer(null);
  saveDiscountAmount("0");
}

export function setPendingPaymentMethod(method: PendingPaymentMethod): void {
  sessionStorage.setItem(PAYMENT_METHOD_KEY, method);
}

export function getPendingPaymentMethod(): PendingPaymentMethod {
  const m = sessionStorage.getItem(PAYMENT_METHOD_KEY);
  if (m === "mobile" || m === "split" || m === "cash" || m === "bank") {
    return m;
  }
  return "cash";
}

export function savePendingBankChannel(channel: PendingBankChannel): void {
  sessionStorage.setItem(BANK_CHANNEL_KEY, JSON.stringify(channel));
}

export function loadPendingBankChannel(): PendingBankChannel | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(BANK_CHANNEL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingBankChannel;
    if (!parsed || !Number.isInteger(parsed.id) || parsed.id <= 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingBankChannel(): void {
  sessionStorage.removeItem(BANK_CHANNEL_KEY);
}

export function paymentMethodForChannel(
  type: string,
): "CASH" | "CARD" | "OTHER" {
  const t = type.trim().toLowerCase();
  if (t === "cash") return "CASH";
  if (t === "bank") return "CARD";
  return "OTHER";
}

/** POS CASH button → OpticEdge channel type=cash (live name "Cash"). */
export function pickCashChannel(
  channels: PendingBankChannel[],
): PendingBankChannel | null {
  return (
    channels.find((c) => c.type.toLowerCase() === "cash") ??
    channels.find((c) => /^cash$/i.test(c.name.trim())) ??
    channels.find((c) => /cash/i.test(c.name)) ??
    null
  );
}

export function heldSaleLabel(
  cart: PosCartLine[],
  customer: PosCartCustomer | null,
): string {
  const count = cart.reduce((n, l) => n + l.quantity, 0);
  const first = cart[0]?.productName ?? "Sale";
  const who = customer?.name ? ` · ${customer.name}` : "";
  return `${first}${cart.length > 1 ? ` +${cart.length - 1}` : ""} (${count})${who}`;
}
