import { createHmac } from "node:crypto";
import {
  buildSelcomHeaders,
  SelcomClient,
  verifySelcomHmac,
} from "./selcom.client";
import { normalizeTzMsisdn } from "./selcom.msisdn";

describe("SelcomClient HS256 headers", () => {
  it("matches the documented signing example", () => {
    const client = new SelcomClient({
      baseUrl: "https://selcom.test",
      apiKey: "test-key",
      apiSecret: "test-secret",
    });
    const payload = {
      transid: "TX-1",
      amount: 1000,
      msisdn: "255712345678",
    };
    const timestamp = "2026-09-13T10:00:00+03:00";
    const headers = client.headers(payload, ["transid", "amount", "msisdn"], timestamp);

    const signingString =
      "timestamp=2026-09-13T10:00:00+03:00&transid=TX-1&amount=1000&msisdn=255712345678";
    const expectedDigest = createHmac("sha256", "test-secret")
      .update(signingString, "utf8")
      .digest("base64");

    expect(headers.Authorization).toBe("SELCOM dGVzdC1rZXk=");
    expect(headers["Signed-Fields"]).toBe("transid,amount,msisdn");
    expect(headers.Digest).toBe(expectedDigest);
  });

  it("verifies a webhook digest built with the same rules", () => {
    const payload = {
      order_id: "GUL-1",
      payment_status: "COMPLETED",
      resultcode: "000",
      amount: "12000",
    };
    const timestamp = "2026-09-16T18:00:00+03:00";
    const headers = buildSelcomHeaders({
      payload,
      signedFields: ["order_id", "payment_status", "resultcode", "amount"],
      apiKey: "test-key",
      apiSecret: "test-secret",
      timestamp,
    });

    expect(
      verifySelcomHmac({
        payload,
        apiSecret: "test-secret",
        timestamp,
        digest: headers.Digest,
        signedFieldsHeader: headers["Signed-Fields"],
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
    ).toBe(true);
    expect(
      verifySelcomHmac({
        payload,
        apiSecret: "wrong",
        timestamp,
        digest: headers.Digest,
        signedFieldsHeader: headers["Signed-Fields"],
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
    ).toBe(false);
  });
});

describe("normalizeTzMsisdn", () => {
  it("accepts local and international formats", () => {
    expect(normalizeTzMsisdn("0712 345 678")).toBe("255712345678");
    expect(normalizeTzMsisdn("+255712345678")).toBe("255712345678");
  });

  it("rejects invalid numbers", () => {
    expect(() => normalizeTzMsisdn("123")).toThrow(/valid Tanzanian/);
  });
});
