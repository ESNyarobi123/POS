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

export type CheckoutRequest = {
  registerSessionId: string;
  branchId: string;
  warehouseId: string;
  customerId?: string;
  discountAmount?: DecimalString;
  note?: string;
  items: CheckoutLineInput[];
  payments: CheckoutPaymentInput[];
};

export type SaleItemSerialDto = {
  serialUnitId: string;
  serialNumber?: string;
};

export type SaleItemDto = {
  id: string;
  variantId: string;
  quantity: DecimalString;
  unitPrice: DecimalString;
  discountAmount: DecimalString;
  taxAmount: DecimalString;
  lineTotal: DecimalString;
  tracksSerial: boolean;
  serials: SaleItemSerialDto[];
  /** Populated on receipt payloads. */
  sku?: string;
  name?: string;
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
