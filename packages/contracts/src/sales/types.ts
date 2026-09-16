/**
 * Sales / POS contracts — shifts, checkout, receipts.
 * Money and qty as DecimalString (never JS float).
 */

import type { DecimalString } from "../inventory/types";

export const SALE_STATUSES = ["DRAFT", "HELD", "COMPLETED", "VOIDED"] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

export const FISCAL_STATUSES = [
  "NOT_REQUIRED",
  "FISCAL_PENDING",
  "FISCAL_OK",
  "FISCAL_FAILED",
] as const;
export type FiscalStatus = (typeof FISCAL_STATUSES)[number];

export const REGISTER_SESSION_STATUSES = ["OPEN", "CLOSED"] as const;
export type RegisterSessionStatus = (typeof REGISTER_SESSION_STATUSES)[number];

/** Matches Prisma PaymentMethod (schema source of truth). */
export const PAYMENT_METHODS = [
  "CASH",
  "MOBILE_MONEY_MANUAL",
  "CARD",
  "OTHER",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type OpenShiftRequest = {
  registerId: string;
  openingFloat: DecimalString;
};

export type CloseShiftRequest = {
  countedCash: DecimalString;
};

export type RegisterSessionDto = {
  id: string;
  organizationId: string;
  registerId: string;
  branchId: string;
  openedByUserId: string;
  closedByUserId: string | null;
  status: RegisterSessionStatus;
  openingFloat: DecimalString;
  closingCountedCash: DecimalString | null;
  expectedCash: DecimalString | null;
  variance: DecimalString | null;
  openedAt: string;
  closedAt: string | null;
};

export type CheckoutLineInput = {
  variantId: string;
  /** Units sold; number or decimal string. */
  quantity: number | DecimalString;
  /** Optional unit price override — audited when different from catalog. */
  unitPrice?: DecimalString;
  /** Required when variant.tracksSerial; length must equal quantity. */
  serialUnitIds?: string[];
};

export type CheckoutPaymentInput = {
  method: PaymentMethod;
  amount: DecimalString;
  reference?: string;
  provider?: string;
};

/** Snapshot of the OpticEdge channel the cashier picked (BANK) or cash till. */
export type OpticEdgeCheckoutChannel = {
  channelId: number;
  channelName: string;
  channelType: string;
};

export type CheckoutRequest = {
  registerSessionId: string;
  branchId: string;
  warehouseId: string;
  customerId?: string;
  discountAmount?: DecimalString;
  note?: string;
  items: CheckoutLineInput[];
  payments: CheckoutPaymentInput[];
  /**
   * Owner/Manager PIN — required when a cashier negotiated price exceeds
   * org policy (below-list cap or below cost).
   */
  managerPin?: string;
  /**
   * When set, POS records the sale locally then posts cash-in to OpticEdge
   * on this channel. Cash without a pick uses the OpticEdge cash channel.
   */
  opticedge?: OpticEdgeCheckoutChannel;
};

export type SaleItemSerialDto = {
  serialUnitId: string;
  serialNumber?: string;
};

export type SaleItemDto = {
  id: string;
  variantId: string;
  quantity: DecimalString;
  /** Charged unit price for this sale (may be negotiated). */
  unitPrice: DecimalString;
  /** Catalog sell price frozen at checkout. */
  listUnitPrice: DecimalString;
  /** True when charged unit price differs from catalog list. */
  negotiated: boolean;
  discountAmount: DecimalString;
  taxAmount: DecimalString;
  lineTotal: DecimalString;
  tracksSerial: boolean;
  serials: SaleItemSerialDto[];
  /** Populated on receipt payloads. */
  sku?: string;
  name?: string;
  productName?: string;
  imageUrl?: string | null;
};

export type PaymentDto = {
  id: string;
  method: PaymentMethod;
  amount: DecimalString;
  provider: string | null;
  reference: string | null;
  paidAt: string;
};

export type SaleDto = {
  id: string;
  organizationId: string;
  branchId: string;
  warehouseId: string;
  registerId: string;
  registerSessionId: string;
  cashierUserId: string;
  customerId: string | null;
  receiptNumber: string;
  status: SaleStatus;
  fiscalStatus: FiscalStatus;
  idempotencyKey: string;
  subtotal: DecimalString;
  discountTotal: DecimalString;
  taxTotal: DecimalString;
  grandTotal: DecimalString;
  completedAt: string | null;
  createdAt: string;
  items: SaleItemDto[];
  payments: PaymentDto[];
  cashierName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  branchName?: string | null;
  channelName?: string | null;
  channelType?: string | null;
  channelId?: number | null;
  /** OpticEdge cash-in status when posted (PENDING | SENT | FAILED). */
  cashInStatus?: string | null;
};

export type FiscalDocumentStubDto = {
  id: string;
  provider: string;
  status: string;
  externalRef: string | null;
  idempotencyKey: string;
};

export type ReceiptDto = {
  sale: SaleDto;
  organization: {
    id: string;
    name: string;
    slug: string;
    currencyCode: string;
  };
  branch: {
    id: string;
    name: string;
    code: string;
  };
  cashier: {
    id: string;
    fullName: string;
  };
  customer: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
  fiscal: FiscalDocumentStubDto | null;
  printedAt: string;
};

// ---------------------------------------------------------------------------
// Returns (Phase 1)
// ---------------------------------------------------------------------------

export type ReturnDisposition =
  | "RESTOCK"
  | "DAMAGE"
  | "WRITE_OFF"
  | "SUPPLIER_RETURN";

export type CreateReturnRequest = {
  saleId: string;
  warehouseId: string;
  reasonCode: string;
  refundMethod: "CASH" | "MOBILE_MONEY_MANUAL";
  /** Required when refund total ≥ TZS 500,000 — PIN of Owner/Manager. */
  managerPin?: string;
  items: Array<{
    saleItemId: string;
    /** Whole units for MVP. */
    quantity: number;
    disposition: ReturnDisposition;
    serialUnitIds?: string[];
    /** Optional override; default = proportional lineTotal. */
    refundAmount?: DecimalString;
  }>;
};

export type ReturnableSaleItemDto = {
  saleItemId: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  quantitySold: DecimalString;
  quantityAlreadyReturned: DecimalString;
  quantityReturnable: DecimalString;
  unitPrice: DecimalString;
  lineTotal: DecimalString;
  tracksSerial: boolean;
  serials: Array<{
    serialUnitId: string;
    serialNumber: string;
    status: string;
  }>;
};

export type ReturnableSaleDto = {
  saleId: string;
  receiptNumber: string;
  completedAt: string | null;
  branchId: string;
  warehouseId: string;
  grandTotal: DecimalString;
  items: ReturnableSaleItemDto[];
};

export type ReturnDto = {
  id: string;
  saleId: string;
  receiptNumber: string;
  status: string;
  refundTotal: DecimalString;
  reasonCode: string | null;
  /** Echoed from request; persisted in audit only (no DB column). */
  refundMethod: string | null;
  processedAt: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    saleItemId: string;
    quantity: DecimalString;
    disposition: string;
    refundAmount: DecimalString;
    serialUnitId: string | null;
  }>;
  /** Variant IDs restocked — for labels CTA. */
  restockedVariantIds: string[];
};

export type ReturnListResponse = {
  items: ReturnDto[];
};
