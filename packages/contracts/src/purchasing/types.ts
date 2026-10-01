/**
 * Purchasing contracts (Phase 2 slice) — suppliers, goods receipts, payments.
 *
 * Money and quantity are decimal strings (never JS float).
 * Receiving moves stock ONLY through the ledger: the API posts PURCHASE_RECEIPT
 * movements inside the same transaction that writes the GoodsReceipt.
 */

import type { DecimalString } from "../inventory/types";

/** Matches Prisma GoodsReceiptStatus. */
export const GOODS_RECEIPT_STATUSES = ["DRAFT", "POSTED", "CANCELLED"] as const;
export type GoodsReceiptStatus = (typeof GOODS_RECEIPT_STATUSES)[number];

/** Matches Prisma SupplierPaymentMethod. */
export const SUPPLIER_PAYMENT_METHODS = [
  "CASH",
  "MOBILE_MONEY_MANUAL",
  "CARD",
  "BANK_TRANSFER",
  "OTHER",
] as const;
export type SupplierPaymentMethod = (typeof SUPPLIER_PAYMENT_METHODS)[number];

/**
 * Derived from settlements vs receipt total — never stored, so it can never
 * drift from the payment rows.
 */
export const RECEIPT_PAYMENT_STATUSES = ["PAID", "PARTIAL", "PENDING"] as const;
export type ReceiptPaymentStatus = (typeof RECEIPT_PAYMENT_STATUSES)[number];

export const GOODS_RECEIPT_SORTS = [
  "receivedAt",
  "total",
  "pendingTotal",
] as const;
export type GoodsReceiptSort = (typeof GOODS_RECEIPT_SORTS)[number];

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

export type SupplierDto = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  /** Lifetime value received from this supplier across all receipts. */
  totalReceived: DecimalString;
  totalPaid: DecimalString;
  /** totalReceived − totalPaid, floored at zero. */
  totalPending: DecimalString;
  receiptsCount: number;
  lastReceivedAt: string | null;
  createdAt: string;
};

export type SupplierListResponse = {
  items: SupplierDto[];
};

export type CreateSupplierRequest = {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
};

export type UpdateSupplierRequest = {
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

// ---------------------------------------------------------------------------
// Receipt lines
// ---------------------------------------------------------------------------

export type GoodsReceiptLineDto = {
  id: string;
  variantId: string;
  productId: string | null;
  productName: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  quantity: DecimalString;
  /** Wholesale / buy price per unit charged by the supplier. */
  unitCost: DecimalString;
  /** Catalog sell price captured when the receipt was created. */
  retailPrice: DecimalString;
  lineTotal: DecimalString;
  /** retailPrice − unitCost. */
  marginPerUnit: DecimalString;
  /** (retailPrice − unitCost) × quantity. */
  potentialMargin: DecimalString;
  tracksSerial: boolean;
  serialNumbers: string[];
};

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export type SupplierPaymentDto = {
  id: string;
  supplierId: string;
  supplierName: string | null;
  receiptId: string | null;
  amount: DecimalString;
  method: SupplierPaymentMethod;
  reference: string | null;
  note: string | null;
  paidAt: string;
  recordedByName: string | null;
};

export type RecordSupplierPaymentRequest = {
  supplierId: string;
  /** Omit to settle the supplier's oldest outstanding receipts first. */
  receiptId?: string | null;
  amount: DecimalString;
  method: SupplierPaymentMethod;
  reference?: string | null;
  note?: string | null;
  paidAt?: string;
};

// ---------------------------------------------------------------------------
// Goods receipts
// ---------------------------------------------------------------------------

export type GoodsReceiptDto = {
  id: string;
  invoiceNumber: string | null;
  status: GoodsReceiptStatus;
  paymentStatus: ReceiptPaymentStatus;

  branchId: string;
  branchName: string;
  warehouseId: string;
  warehouseName: string;

  supplierId: string | null;
  /** Distributor name resolved from `supplierId`. Null when the receipt had no supplier. */
  supplierName: string | null;

  reason: string | null;
  notes: string | null;

  subtotal: DecimalString;
  discountTotal: DecimalString;
  taxTotal: DecimalString;
  total: DecimalString;
  paidTotal: DecimalString;
  pendingTotal: DecimalString;

  totalUnits: number;
  lineCount: number;

  receivedAt: string;
  postedAt: string | null;
  receivedByName: string | null;

  lines: GoodsReceiptLineDto[];
  payments: SupplierPaymentDto[];
};

/** Header figures for the receive page, over the active filter window. */
export type GoodsReceiptSummaryDto = {
  receiptsCount: number;
  unitsReceived: number;
  totalValue: DecimalString;
  paidTotal: DecimalString;
  pendingTotal: DecimalString;
  supplierCount: number;
  /** Σ (retail − unitCost) × quantity — margin locked in by these receipts. */
  potentialMargin: DecimalString;
  /** Σ serial-tracked units received. */
  serialUnits: number;
};

export type GoodsReceiptListResponse = {
  items: GoodsReceiptDto[];
  total: number;
  page: number;
  pageSize: number;
  /** Always computed over the whole filtered set, not just the current page. */
  summary: GoodsReceiptSummaryDto;
};

export type GoodsReceiptListQuery = {
  /** Matches invoice number, supplier name or product name/SKU. */
  search?: string;
  supplierId?: string;
  branchId?: string;
  warehouseId?: string;
  status?: GoodsReceiptStatus;
  paymentStatus?: ReceiptPaymentStatus;
  /** Inclusive ISO bounds on receivedAt. */
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  sort?: GoodsReceiptSort;
  dir?: "asc" | "desc";
};

export type CreateGoodsReceiptLineInput = {
  variantId: string;
  quantity: number | DecimalString;
  /** Wholesale / buy price per unit. */
  unitCost: DecimalString;
  /** Optional override; server falls back to variant.sellPrice. */
  retailPrice?: DecimalString;
  /** Required when the variant tracks serials; length must equal quantity. */
  serialNumbers?: string[];
};

export type CreateGoodsReceiptRequest = {
  warehouseId: string;
  /** Existing supplier. */
  supplierId?: string | null;
  /** Create-on-the-fly distributor name when no Supplier row exists yet. */
  supplierName?: string | null;
  invoiceNumber?: string | null;
  /** Why the stock arrived — written to the ledger movement reason. */
  reason?: string | null;
  notes?: string | null;
  discountTotal?: DecimalString;
  taxTotal?: DecimalString;
  receivedAt?: string;
  lines: CreateGoodsReceiptLineInput[];
};

/** Response for a posted receipt, including the ledger effect. */
export type CreateGoodsReceiptResponse = {
  receipt: GoodsReceiptDto;
  movements: Array<{
    id: string;
    variantId: string;
    quantityDelta: DecimalString;
    movementType: string;
  }>;
};
