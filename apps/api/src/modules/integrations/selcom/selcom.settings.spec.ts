import {
  mergeSelcomSettings,
  parseStoredSelcomSettings,
  toSelcomAdminSettings,
  toSelcomPublicStatus,
} from "./selcom.settings";

describe("selcom settings", () => {
  it("does not expose secrets to cashiers", () => {
    const stored = parseStoredSelcomSettings({
      selcom: {
        enabled: true,
        baseUrl: "https://example.selcom",
        merchantId: "GULIO",
        apiKey: "super-secret-key",
        apiSecret: "super-secret-secret",
      },
    });
    expect(toSelcomPublicStatus(stored)).toEqual({
      enabled: true,
      configured: true,
    });
    const admin = toSelcomAdminSettings(stored);
    expect(admin.apiKeyMasked).toBe("••••-key");
    expect(admin.apiSecretMasked).toBe("••••cret");
    expect(JSON.stringify(admin)).not.toContain("super-secret-key");
  });

  it("strips trailing /v1 so checkout paths are not doubled", () => {
    const stored = parseStoredSelcomSettings({
      selcom: { baseUrl: "https://apigw.selcommobile.com/v1/" },
    });
    expect(stored.baseUrl).toBe("https://apigw.selcommobile.com");
  });

  it("keeps existing secrets when patch fields are empty", () => {
    const merged = mergeSelcomSettings(
      {
        selcom: {
          enabled: true,
          apiKey: "keep-me",
          apiSecret: "keep-secret",
          merchantId: "OLD",
        },
      },
      { merchantId: "NEW", apiKey: "", apiSecret: "   " },
    );
    const stored = parseStoredSelcomSettings(merged);
    expect(stored.merchantId).toBe("NEW");
    expect(stored.apiKey).toBe("keep-me");
    expect(stored.apiSecret).toBe("keep-secret");
  });
});
