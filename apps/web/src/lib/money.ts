/** Format API DecimalString money (major units, never JS float math for totals). */

export type DecimalString = string;

/** Display TZS amounts from catalog/receipt decimal strings. */
export function formatMoney(
  value: DecimalString | number | null | undefined,
  currency = "TZS",
): string {
  if (value === null || value === undefined || value === "") {
    return `${currency} 0`;
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return `${currency} ${String(value)}`;
  return `${currency} ${Math.round(n).toLocaleString("en-TZ")}`;
}

/** Sum decimal-string line totals for cart display (qty × unitPrice). */
export function lineTotal(unitPrice: DecimalString, qty: number): number {
  const unit = Number(unitPrice);
  if (!Number.isFinite(unit)) return 0;
  return unit * qty;
}

export function sumLines(
  lines: Array<{ unitPrice: DecimalString; quantity: number }>,
): number {
  return lines.reduce((sum, l) => sum + lineTotal(l.unitPrice, l.quantity), 0);
}

/** Cart total as DecimalString for checkout payments (4 dp, matches API). */
export function sumLinesDecimal(
  lines: Array<{ unitPrice: DecimalString; quantity: number }>,
): DecimalString {
  const total = sumLines(lines);
  if (!Number.isFinite(total)) return "0";
  return total.toFixed(4);
}

/** Normalize user input like "100,000" → "100000" decimal string. */
export function parseMoneyInput(raw: string): DecimalString {
  const cleaned = raw.replace(/,/g, "").replace(/\s/g, "").trim();
  if (!cleaned) return "0";
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return "0";
  return n.toFixed(4);
}

/** Amount due after cart-level discount (clamped ≥ 0). */
export function payableAfterDiscount(
  subtotal: number,
  discountAmount: DecimalString | null | undefined,
): number {
  const disc = Number(discountAmount ?? "0");
  if (!Number.isFinite(disc) || disc <= 0) return subtotal;
  return Math.max(0, subtotal - disc);
}

export function payableAfterDiscountDecimal(
  lines: Array<{ unitPrice: DecimalString; quantity: number }>,
  discountAmount: DecimalString | null | undefined,
): DecimalString {
  return payableAfterDiscount(sumLines(lines), discountAmount).toFixed(4);
}
