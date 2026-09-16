import { Prisma } from "@gulio/database";
import { DEFAULT_PRICE_OVERRIDE_POLICY } from "@gulio/contracts";
import {
  actorIsManager,
  classifyPriceOverride,
  mergePriceOverridePolicy,
  parsePriceOverridePolicy,
} from "./price-override.policy";

describe("parsePriceOverridePolicy", () => {
  it("returns defaults for empty settings", () => {
    expect(parsePriceOverridePolicy({})).toEqual(DEFAULT_PRICE_OVERRIDE_POLICY);
    expect(parsePriceOverridePolicy(null)).toEqual(DEFAULT_PRICE_OVERRIDE_POLICY);
  });

  it("clamps percent and keeps booleans", () => {
    expect(
      parsePriceOverridePolicy({
        priceOverride: {
          cashierMaxPercentBelowList: 140,
          allowAboveList: false,
          blockBelowCost: false,
        },
      }),
    ).toEqual({
      cashierMaxPercentBelowList: 100,
      allowAboveList: false,
      blockBelowCost: false,
    });
  });

  it("merges a patch without dropping other JSON keys", () => {
    const merged = mergePriceOverridePolicy(
      { tin: "123", priceOverride: { cashierMaxPercentBelowList: 5 } },
      { cashierMaxPercentBelowList: 8 },
    );
    expect(merged.tin).toBe("123");
    expect(merged.priceOverride).toMatchObject({
      cashierMaxPercentBelowList: 8,
      allowAboveList: true,
      blockBelowCost: true,
    });
  });
});

describe("classifyPriceOverride", () => {
  const catalog = new Prisma.Decimal("10000");
  const cost = new Prisma.Decimal("7000");
  const policy = DEFAULT_PRICE_OVERRIDE_POLICY;

  it("matches catalog price", () => {
    expect(
      classifyPriceOverride({
        catalogPrice: catalog,
        chargedPrice: catalog,
        costPrice: cost,
        policy,
        actorIsManager: false,
      }).status,
    ).toBe("match");
  });

  it("allows cashier 5% below list without PIN", () => {
    const result = classifyPriceOverride({
      catalogPrice: catalog,
      chargedPrice: new Prisma.Decimal("9500"),
      costPrice: cost,
      policy,
      actorIsManager: false,
    });
    expect(result).toMatchObject({
      status: "override",
      needsManagerPin: false,
    });
  });

  it("requires PIN when cashier goes more than 5% below list", () => {
    const result = classifyPriceOverride({
      catalogPrice: catalog,
      chargedPrice: new Prisma.Decimal("9000"),
      costPrice: cost,
      policy,
      actorIsManager: false,
    });
    expect(result).toMatchObject({
      status: "override",
      needsManagerPin: true,
    });
    if (result.status === "override") {
      expect(result.reasons).toContain("BELOW_LIST_OVER_CAP");
    }
  });

  it("does not require PIN for manager deep cuts", () => {
    const result = classifyPriceOverride({
      catalogPrice: catalog,
      chargedPrice: new Prisma.Decimal("9000"),
      costPrice: cost,
      policy,
      actorIsManager: true,
    });
    expect(result).toMatchObject({
      status: "override",
      needsManagerPin: false,
    });
  });

  it("requires PIN when cashier goes below cost even within 5%", () => {
    const result = classifyPriceOverride({
      catalogPrice: catalog,
      chargedPrice: new Prisma.Decimal("9600"),
      costPrice: new Prisma.Decimal("9700"),
      policy,
      actorIsManager: false,
    });
    expect(result).toMatchObject({
      status: "override",
      needsManagerPin: true,
    });
    if (result.status === "override") {
      expect(result.reasons).toContain("BELOW_COST");
    }
  });

  it("allows above-list without PIN when policy allows", () => {
    const result = classifyPriceOverride({
      catalogPrice: catalog,
      chargedPrice: new Prisma.Decimal("11000"),
      costPrice: cost,
      policy,
      actorIsManager: false,
    });
    expect(result).toMatchObject({
      status: "override",
      needsManagerPin: false,
    });
  });

  it("forbids above-list when policy disables it", () => {
    const result = classifyPriceOverride({
      catalogPrice: catalog,
      chargedPrice: new Prisma.Decimal("11000"),
      costPrice: cost,
      policy: { ...policy, allowAboveList: false },
      actorIsManager: false,
    });
    expect(result).toEqual({ status: "forbidden", reason: "ABOVE_LIST_DISABLED" });
  });
});

describe("actorIsManager", () => {
  it("treats owner and manager as privileged", () => {
    expect(actorIsManager(["CASHIER"])).toBe(false);
    expect(actorIsManager(["OWNER"])).toBe(true);
    expect(actorIsManager(["manager"])).toBe(true);
  });
});
