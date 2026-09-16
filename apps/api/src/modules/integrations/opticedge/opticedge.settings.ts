import type {
  OpticEdgeAdminSettingsDto,
  OpticEdgePublicStatusDto,
  UpdateOpticEdgeSettingsRequest,
} from "@gulio/contracts";

export const DEFAULT_OPTICEDGE_BASE_URL = "https://opticedgeafrica.net";

export type StoredOpticEdgeSettings = {
  enabled: boolean;
  baseUrl: string;
  apiToken: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}

export function parseStoredOpticEdgeSettings(
  settings: unknown,
): StoredOpticEdgeSettings {
  const raw = asRecord(asRecord(settings)?.opticedge);
  return {
    enabled: raw?.enabled === true,
    baseUrl: asString(raw?.baseUrl) || DEFAULT_OPTICEDGE_BASE_URL,
    apiToken: asString(raw?.apiToken),
  };
}

export function isOpticEdgeConfigured(
  stored: StoredOpticEdgeSettings,
): boolean {
  return Boolean(stored.baseUrl && stored.apiToken);
}

export function toOpticEdgePublicStatus(
  stored: StoredOpticEdgeSettings,
): OpticEdgePublicStatusDto {
  const configured = isOpticEdgeConfigured(stored);
  return {
    enabled: stored.enabled && configured,
    configured,
  };
}

export function toOpticEdgeAdminSettings(
  stored: StoredOpticEdgeSettings,
): OpticEdgeAdminSettingsDto {
  const publicStatus = toOpticEdgePublicStatus(stored);
  return {
    ...publicStatus,
    enabled: stored.enabled,
    baseUrl: stored.baseUrl,
    apiTokenMasked: maskSecret(stored.apiToken),
  };
}

export function mergeOpticEdgeSettings(
  current: unknown,
  patch: UpdateOpticEdgeSettingsRequest | undefined,
): Record<string, unknown> {
  const root = asRecord(current) ?? {};
  const next = parseStoredOpticEdgeSettings(root);
  if (!patch) return { ...root, opticedge: next };

  if (patch.enabled !== undefined) next.enabled = Boolean(patch.enabled);
  if (patch.baseUrl !== undefined) {
    next.baseUrl = patch.baseUrl.trim() || DEFAULT_OPTICEDGE_BASE_URL;
  }
  if (patch.apiToken !== undefined && patch.apiToken.trim() !== "") {
    next.apiToken = patch.apiToken.trim();
  }
  return { ...root, opticedge: next };
}

export function redactOpticEdgeForAudit(settings: unknown): unknown {
  const root = asRecord(settings);
  if (!root) return settings;
  const opticedge = parseStoredOpticEdgeSettings(root);
  return {
    ...root,
    opticedge: {
      ...opticedge,
      apiToken: maskSecret(opticedge.apiToken),
    },
  };
}
