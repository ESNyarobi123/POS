import type { PaymentDto, PaymentMethod, SaleDto } from "@gulio/contracts";

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  MOBILE_MONEY_MANUAL: "Mobile",
  CARD: "Bank",
  OTHER: "Other",
};

export function paymentLabel(method: PaymentMethod, provider?: string | null): string {
  if (provider?.trim()) return provider.trim();
  return PAYMENT_LABELS[method] ?? method;
}

export function saleChannel(sale: SaleDto): string {
  if (sale.channelName?.trim()) return sale.channelName.trim();
  const fromPay = sale.payments.find((p) => p.provider?.trim())?.provider;
  if (fromPay) return fromPay;
  if (sale.payments.some((p) => p.method === "CASH")) return "Cash";
  if (sale.payments.some((p) => p.method === "MOBILE_MONEY_MANUAL")) {
    return "Mobile";
  }
  if (sale.payments.some((p) => p.method === "CARD")) return "Bank";
  return "—";
}

export function salePaymentSummary(sale: SaleDto): string {
  if (sale.payments.length === 0) return "—";
  return sale.payments
    .map((p) => paymentLabel(p.method, p.provider))
    .join(" + ");
}

export function isNegotiatedSale(sale: SaleDto): boolean {
  return sale.items.some((i) => i.negotiated);
}

export function negotiatedBelowList(sale: SaleDto): number {
  return sale.items.reduce((sum, item) => {
    if (!item.negotiated) return sum;
    const list = Number(item.listUnitPrice || item.unitPrice);
    const charged = Number(item.unitPrice);
    const qty = Number(item.quantity);
    if (!Number.isFinite(list) || !Number.isFinite(charged) || !Number.isFinite(qty)) {
      return sum;
    }
    return sum + Math.max(0, list - charged) * qty;
  }, 0);
}

export function saleDeviceCount(sale: SaleDto): number {
  return sale.items.filter((i) => i.tracksSerial || (i.serials?.length ?? 0) > 0)
    .length;
}

export function primaryPayment(sale: SaleDto): PaymentDto | undefined {
  return sale.payments[0];
}

export type RangeKey = "today" | "7d" | "30d" | "all";

export function rangeStart(range: RangeKey): Date | null {
  if (range === "all") return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range === "7d") d.setDate(d.getDate() - 6);
  if (range === "30d") d.setDate(d.getDate() - 29);
  return d;
}

export function cashInLabel(status?: string | null): string | null {
  if (!status) return null;
  if (status === "SENT") return "Posted";
  if (status === "PENDING") return "Posting";
  if (status === "FAILED") return "Post failed";
  return status;
}

export function itemTitle(item: SaleDto["items"][number]): string {
  return item.productName || item.name || item.sku || "Item";
}

export function formatSaleWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-TZ", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
