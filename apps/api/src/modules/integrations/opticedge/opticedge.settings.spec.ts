import {
  mergeOpticEdgeSettings,
  parseStoredOpticEdgeSettings,
  redactOpticEdgeForAudit,
  toOpticEdgeAdminSettings,
  toOpticEdgePublicStatus,
} from "./opticedge.settings";

describe("opticedge settings", () => {
  it("does not expose the API token to cashiers", () => {
    const stored = parseStoredOpticEdgeSettings({
      opticedge: {
        enabled: true,
        baseUrl: "https://opticedgeafrica.net",
        apiToken: "oe_live_super-secret-token",
      },
    });
    expect(toOpticEdgePublicStatus(stored)).toEqual({
      enabled: true,
      configured: true,
    });
    const admin = toOpticEdgeAdminSettings(stored);
    expect(admin.apiTokenMasked).toBe("••••oken");
    expect(JSON.stringify(admin)).not.toContain("oe_live_super-secret-token");
  });

  it("keeps the existing token when the patch is empty", () => {
    const merged = mergeOpticEdgeSettings(
      {
        opticedge: {
          enabled: true,
          apiToken: "keep-me",
          baseUrl: "https://opticedgeafrica.net",
        },
      },
      { enabled: false, apiToken: "   " },
    );
    const stored = parseStoredOpticEdgeSettings(merged);
    expect(stored.enabled).toBe(false);
    expect(stored.apiToken).toBe("keep-me");
  });

  it("redacts the token in audit JSON", () => {
    const redacted = redactOpticEdgeForAudit({
      opticedge: { apiToken: "oe_live_abcdefgh" },
    }) as { opticedge: { apiToken: string } };
    expect(redacted.opticedge.apiToken).toBe("••••efgh");
  });
});
