/**
 * Inventory ledger contracts — movements, balances, serials.
 * Stock changes only via StockMovement + StockBalance projection.
 */

export const STOCK_MOVEMENT_TYPES = [
  "PURCHASE_RECEIPT",
  "SALE",
  "RETURN",
  "DAMAGE",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "ADJUSTMENT",
] as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const SERIAL_STATUSES = [
  "IN_STOCK",
  "RESERVED",
  "SOLD",
  "RETURNED",
  "DAMAGED",
  "IN_REPAIR",
  "SUPPLIER_RETURN",
  "TRANSFERRED",
] as const;

export type SerialStatus = (typeof SERIAL_STATUSES)[number];

/** Decimal strings keep money/qty out of JS float. */
export type DecimalString = string;

export interface CommitSaleMovementInput {
  organizationId: string;
  branchId: string;
  warehouseId: string;
  variantId: string;
  /** Positive units to sell; stored as SALE quantityDelta = -quantity. */
  quantity: number | DecimalString;
  saleId: string;
  saleItemId: string;
  serialUnitIds?: string[];
  createdByUserId?: string;
}

export interface CommitReturnMovementInput {
  organizationId: string;
  branchId: string;
  warehouseId: string;
  variantId: string;
  /** Positive units returned. */
  quantity: number | DecimalString;
  returnId: string;
  returnItemId?: string;
  saleItemId?: string;
  serialUnitIds?: string[];
  /**
   * When true: RETURN +qty to balance and serial → IN_STOCK.
   * When false: serial → RETURNED (or DAMAGED if disposition is DAMAGE); no on-hand increase.
   */
  restock: boolean;
  disposition?: "RESTOCK" | "DAMAGE" | "WRITE_OFF" | "SUPPLIER_RETURN";
  createdByUserId?: string;
}

export interface StockMovementDto {
  id: string;
  organizationId: string;
  warehouseId: string;
  variantId: string;
  movementType: StockMovementType;
  quantityDelta: DecimalString;
  referenceType: string | null;
  referenceId: string | null;
  serialUnitId: string | null;
  createdByUserId: string | null;
  reason: string | null;
  createdAt: string;
}

export interface StockBalanceDto {
  id: string;
  organizationId: string;
  warehouseId: string;
  variantId: string;
  quantityOnHand: DecimalString;
  quantityReserved: DecimalString;
  /** Computed: onHand − reserved. */
  quantityAvailable: DecimalString;
  updatedAt: string;
}

export interface SerialUnitDto {
  id: string;
  organizationId: string;
  variantId: string;
  warehouseId: string;
  serialNumber: string;
  status: SerialStatus;
  currentSaleItemId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommitSaleMovementResult {
  movements: StockMovementDto[];
  balance: StockBalanceDto;
}

export interface CommitReturnMovementResult {
  movements: StockMovementDto[];
  balance: StockBalanceDto | null;
}
