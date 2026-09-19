import type {
  SelcomAdminSettingsDto,
  SelcomPublicStatusDto,
  UpdateSelcomSettingsRequest,
} from "@gulio/contracts";

export type StoredSelcomSettings = {
  enabled: boolean;
  baseUrl: string;
  merchantId: string;
  webhookUrl: string;
  redirectUrl: string;
  cancelUrl: string;
  apiKey: string;
  apiSecret: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Selcom client appends /v1/checkout/... — host must not already include /v1. */
export function normalizeSelcomBaseUrl(value: string): string {
  return value
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/v1$/i, "");
}

function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}

export function parseStoredSelcomSettings(settings: unknown): StoredSelcomSettings {
  const raw = asRecord(asRecord(settings)?.selcom);
  return {
    enabled: raw?.enabled === true,
    baseUrl: normalizeSelcomBaseUrl(asString(raw?.baseUrl)),
    merchantId: asString(raw?.merchantId),
    webhookUrl: asString(raw?.webhookUrl),
    redirectUrl: asString(raw?.redirectUrl),
    cancelUrl: asString(raw?.cancelUrl),
    apiKey: asString(raw?.apiKey),
    apiSecret: asString(raw?.apiSecret),
  };
}

export function isSelcomConfigured(stored: StoredSelcomSettings): boolean {
  return Boolean(
    stored.baseUrl && stored.merchantId && stored.apiKey && stored.apiSecret,
  );
}

export function toSelcomPublicStatus(
  stored: StoredSelcomSettings,
): SelcomPublicStatusDto {
  const configured = isSelcomConfigured(stored);
  return {
    enabled: stored.enabled && configured,
    configured,
  };
}

export function toSelcomAdminSettings(
  stored: StoredSelcomSettings,
): SelcomAdminSettingsDto {
  const publicStatus = toSelcomPublicStatus(stored);
  return {
    ...publicStatus,
    enabled: stored.enabled,
    baseUrl: stored.baseUrl,
    merchantId: stored.merchantId,
    webhookUrl: stored.webhookUrl,
    redirectUrl: stored.redirectUrl,
    cancelUrl: stored.cancelUrl,
    apiKeyMasked: maskSecret(stored.apiKey),
    apiSecretMasked: maskSecret(stored.apiSecret),
  };
}

export function mergeSelcomSettings(
  current: unknown,
  patch: UpdateSelcomSettingsRequest | undefined,
): Record<string, unknown> {
  const root = asRecord(current) ?? {};
  const next = parseStoredSelcomSettings(root);
  if (!patch) return { ...root, selcom: next };

  if (patch.enabled !== undefined) next.enabled = Boolean(patch.enabled);
  if (patch.baseUrl !== undefined) {
    next.baseUrl = normalizeSelcomBaseUrl(patch.baseUrl);
  }
  if (patch.merchantId !== undefined) next.merchantId = patch.merchantId.trim();
  if (patch.webhookUrl !== undefined) next.webhookUrl = patch.webhookUrl.trim();
  if (patch.redirectUrl !== undefined) next.redirectUrl = patch.redirectUrl.trim();
  if (patch.cancelUrl !== undefined) next.cancelUrl = patch.cancelUrl.trim();
  if (patch.apiKey !== undefined && patch.apiKey.trim() !== "") {
    next.apiKey = patch.apiKey.trim();
  }
  if (patch.apiSecret !== undefined && patch.apiSecret.trim() !== "") {
    next.apiSecret = patch.apiSecret.trim();
  }
  return { ...root, selcom: next };
}

export function redactSettingsForAudit(settings: unknown): unknown {
  const root = asRecord(settings);
  if (!root) return settings;
  const selcom = parseStoredSelcomSettings(root);
  return {
    ...root,
    selcom: {
      ...selcom,
      apiKey: maskSecret(selcom.apiKey),
      apiSecret: maskSecret(selcom.apiSecret),
    },
  };
}
