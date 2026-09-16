import { Prisma } from "@gulio/database";
import {
  eatCalendarDate,
  parseOpticEdgeChannels,
  pickOpticEdgeCashChannel,
  toWholeTzsAmount,
} from "./opticedge.client";

describe("opticedge client helpers", () => {
  it("strips balances from channel payloads", () => {
    const channels = parseOpticEdgeChannels({
      data: [
        {
          id: 4,
          name: "Cash",
          type: "cash",
          balance: 100,
          currency: "TZS",
        },
        {
          id: 2,
          name: "CRDB",
          type: "bank",
          balance: 1225466.99,
          currency: "TZS",
        },
      ],
    });
    expect(channels).toEqual([
      { id: 4, name: "Cash", type: "cash", currency: "TZS" },
      { id: 2, name: "CRDB", type: "bank", currency: "TZS" },
    ]);
    expect(JSON.stringify(channels)).not.toContain("1225466");
  });

  it("maps POS CASH to the OpticEdge Cash channel", () => {
    const cash = pickOpticEdgeCashChannel(
      parseOpticEdgeChannels({
        data: [
          { id: 2, name: "CRDB", type: "bank", currency: "TZS" },
          { id: 4, name: "Cash", type: "cash", currency: "TZS" },
          { id: 3, name: "Selcom", type: "bank", currency: "TZS" },
        ],
      }),
    );
    expect(cash).toEqual({
      id: 4,
      name: "Cash",
      type: "cash",
      currency: "TZS",
    });
  });

  it("converts decimal TZS to a whole integer without JS float math on the source", () => {
    expect(toWholeTzsAmount(new Prisma.Decimal("18000.0000"))).toBe(18000);
    expect(toWholeTzsAmount(new Prisma.Decimal("99.5000"))).toBe(100);
  });

  it("formats sale_date in EAT", () => {
    expect(eatCalendarDate(new Date("2026-09-16T21:00:00.000Z"))).toBe(
      "2026-09-17",
    );
  });
});
