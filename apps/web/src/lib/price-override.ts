import type { PriceOverridePolicyDto } from "@gulio/contracts";
import type { DecimalString } from "./money";

const FALLBACK_POLICY: PriceOverridePolicyDto = {
  cashierMaxPercentBelowList: 5,
  allowAboveList: true,
  blockBelowCost: true,
};

export function resolvePriceOverridePolicy(
  policy: PriceOverridePolicyDto | null | undefined,
): PriceOverridePolicyDto {
  return {
    cashierMaxPercentBelowList:
      policy?.cashierMaxPercentBelowList ??
      FALLBACK_POLICY.cashierMaxPercentBelowList,
    allowAboveList: policy?.allowAboveList ?? FALLBACK_POLICY.allowAboveList,
    blockBelowCost: policy?.blockBelowCost ?? FALLBACK_POLICY.blockBelowCost,
  };
}

export function moneyEqualsUi(
  a: DecimalString | number,
  b: DecimalString | number,
): boolean {
  return Math.round(Number(a) * 10000) === Math.round(Number(b) * 10000);
}

export function isNegotiatedPrice(
  listUnitPrice: DecimalString | undefined,
  unitPrice: DecimalString,
): boolean {
  if (!listUnitPrice) return false;
  return !moneyEqualsUi(listUnitPrice, unitPrice);
}

export function percentBelowList(
  listUnitPrice: DecimalString,
  unitPrice: DecimalString,
): number {
  const list = Number(listUnitPrice);
  const charged = Number(unitPrice);
  if (!Number.isFinite(list) || list <= 0 || !Number.isFinite(charged)) return 0;
  if (charged >= list) return 0;
  return ((list - charged) / list) * 100;
}

export function cashierNeedsManagerPin(
  listUnitPrice: DecimalString,
  unitPrice: DecimalString,
  policy: PriceOverridePolicyDto,
  actorIsManager: boolean,
): boolean {
  if (actorIsManager) return false;
  if (!isNegotiatedPrice(listUnitPrice, unitPrice)) return false;
  const list = Number(listUnitPrice);
  const charged = Number(unitPrice);
  if (!Number.isFinite(list) || !Number.isFinite(charged)) return false;
  if (charged > list) return false;
  return percentBelowList(listUnitPrice, unitPrice) >
    policy.cashierMaxPercentBelowList + 1e-6;
}
