import { Prisma } from "@gulio/database";
import {
  DEFAULT_PRICE_OVERRIDE_POLICY,
  type PriceOverridePolicyDto,
} from "@gulio/contracts";

export type PriceOverrideReason = "BELOW_LIST_OVER_CAP" | "BELOW_COST" | "ABOVE_LIST";

export type PriceOverrideDecision =
  | { status: "match" }
  | { status: "forbidden"; reason: "NEGATIVE" | "ABOVE_LIST_DISABLED" }
  | {
      status: "override";
      needsManagerPin: boolean;
      reasons: PriceOverrideReason[];
      percentBelowList: number;
    };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_PRICE_OVERRIDE_POLICY.cashierMaxPercentBelowList;
  return Math.min(100, Math.max(0, n));
}

export function parsePriceOverridePolicy(settings: unknown): PriceOverridePolicyDto {
  const root = asRecord(settings);
  const raw = asRecord(root?.priceOverride);
  const percent = Number(raw?.cashierMaxPercentBelowList);
  return {
    cashierMaxPercentBelowList: clampPercent(
      Number.isFinite(percent)
        ? percent
        : DEFAULT_PRICE_OVERRIDE_POLICY.cashierMaxPercentBelowList,
    ),
    allowAboveList:
      typeof raw?.allowAboveList === "boolean"
        ? raw.allowAboveList
        : DEFAULT_PRICE_OVERRIDE_POLICY.allowAboveList,
    blockBelowCost:
      typeof raw?.blockBelowCost === "boolean"
        ? raw.blockBelowCost
        : DEFAULT_PRICE_OVERRIDE_POLICY.blockBelowCost,
  };
}

export function mergePriceOverridePolicy(
  current: unknown,
  patch: Partial<PriceOverridePolicyDto> | undefined,
): Record<string, unknown> {
  const root = asRecord(current) ?? {};
  const next = parsePriceOverridePolicy(root);
  if (patch?.cashierMaxPercentBelowList !== undefined) {
    next.cashierMaxPercentBelowList = clampPercent(
      Number(patch.cashierMaxPercentBelowList),
    );
  }
  if (patch?.allowAboveList !== undefined) {
    next.allowAboveList = Boolean(patch.allowAboveList);
  }
  if (patch?.blockBelowCost !== undefined) {
    next.blockBelowCost = Boolean(patch.blockBelowCost);
  }
  return { ...root, priceOverride: next };
}

export function moneyEquals(a: Prisma.Decimal, b: Prisma.Decimal): boolean {
  return a.minus(b).abs().lt("0.00005");
}

export function classifyPriceOverride(input: {
  catalogPrice: Prisma.Decimal;
  chargedPrice: Prisma.Decimal;
  costPrice: Prisma.Decimal;
  policy: PriceOverridePolicyDto;
  actorIsManager: boolean;
}): PriceOverrideDecision {
  const { catalogPrice, chargedPrice, costPrice, policy, actorIsManager } = input;

  if (chargedPrice.lt(0)) {
    return { status: "forbidden", reason: "NEGATIVE" };
  }
  if (moneyEquals(chargedPrice, catalogPrice)) {
    return { status: "match" };
  }

  const reasons: PriceOverrideReason[] = [];
  let percentBelowList = 0;

  if (chargedPrice.gt(catalogPrice)) {
    if (!policy.allowAboveList) {
      return { status: "forbidden", reason: "ABOVE_LIST_DISABLED" };
    }
    reasons.push("ABOVE_LIST");
  } else if (catalogPrice.gt(0)) {
    percentBelowList = Number(
      catalogPrice.minus(chargedPrice).div(catalogPrice).times(100).toFixed(4),
    );
    if (percentBelowList > policy.cashierMaxPercentBelowList + 1e-6) {
      reasons.push("BELOW_LIST_OVER_CAP");
    }
  }

  const costTracked = costPrice.gt(0);
  if (costTracked && chargedPrice.lt(costPrice) && policy.blockBelowCost) {
    reasons.push("BELOW_COST");
  }

  const needsManagerPin =
    !actorIsManager &&
    (reasons.includes("BELOW_LIST_OVER_CAP") || reasons.includes("BELOW_COST"));

  return {
    status: "override",
    needsManagerPin,
    reasons,
    percentBelowList,
  };
}

export function actorIsManager(roles: string[] | undefined): boolean {
  return (roles ?? []).some((r) => {
    const code = r.toUpperCase();
    return code === "OWNER" || code === "MANAGER";
  });
}
