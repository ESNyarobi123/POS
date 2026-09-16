/**
 * Payment method contracts aligned with Prisma PaymentMethod.
 * Selcom Checkout + wallet-push DTOs.
 */

import type { DecimalString } from "../inventory/types";

export {
  PAYMENT_METHODS,
  type PaymentMethod,
  type PaymentDto,
  type CheckoutPaymentInput,
} from "../sales/types";

export const SELCOM_PAYMENT_STATUSES = [
  "PENDING",
  "PUSHED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "RECONCILE",
] as const;
export type SelcomPaymentStatus = (typeof SELCOM_PAYMENT_STATUSES)[number];

export type SelcomPushRequest = {
  msisdn: string;
  amount: DecimalString;
  registerSessionId: string;
  buyerName?: string;
  buyerEmail?: string;
  itemCount?: number;
};

export type SelcomIntentDto = {
  orderId: string;
  status: SelcomPaymentStatus;
  msisdn: string;
  amount: DecimalString;
  currency: string;
  message: string;
  channel?: string | null;
  reference?: string | null;
};

/** Cashier-safe OpticEdge till / bank channel. Never includes balances or tokens. */
export type OpticEdgeChannelDto = {
  id: number;
  name: string;
  type: string;
  currency: string;
};

export type OpticEdgeChannelsResponse = {
  enabled: boolean;
  configured: boolean;
  channels: OpticEdgeChannelDto[];
};
