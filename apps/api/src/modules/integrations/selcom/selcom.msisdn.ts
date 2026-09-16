import { randomBytes } from "node:crypto";

/** Tanzanian wallet MSISDN as 255XXXXXXXXX. */
export function normalizeTzMsisdn(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) {
    return `255${digits.slice(1)}`;
  }
  if (digits.startsWith("255") && digits.length === 12) {
    return digits;
  }
  throw new Error("Use a valid Tanzanian number, e.g. 0712 345 678");
}

export function formatMsisdnDisplay(msisdn: string): string {
  const d = msisdn.replace(/\D/g, "");
  if (d.startsWith("255") && d.length === 12) {
    return `0${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}`;
  }
  return msisdn;
}

export function newSelcomOrderId(): string {
  return `GUL-${randomBytes(10).toString("hex").toUpperCase()}`;
}

export function newSelcomTransid(prefix: string): string {
  return `${prefix}-${randomBytes(9).toString("hex").toUpperCase()}`;
}
