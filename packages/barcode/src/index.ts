/**
 * @gulio/barcode — pure barcode / QR helpers for GulioSmart POS.
 *
 * QR payloads carry variant identity only — never price as source of truth.
 */

/** Canonical QR payload prefix: `gulio:v:{variantId}` */
export const LABEL_QR_PREFIX = "gulio:v:" as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Build an internal Code 128 value from a SKU.
 * Example: `A07-128-BLK-0001` → `GUL-A07-128-BLK-0001`
 */
export function buildInternalCode128(sku: string, prefix = "GUL"): string {
  const normalizedPrefix = prefix.toUpperCase();
  const normalizedSku = sku
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalizedSku) {
    return `${normalizedPrefix}-UNKNOWN`;
  }

  if (normalizedSku.startsWith(`${normalizedPrefix}-`)) {
    return normalizedSku;
  }

  return `${normalizedPrefix}-${normalizedSku}`;
}

/**
 * Build a shelf/label QR payload for a variant.
 * Never embeds price — scan must fetch live catalog data.
 */
export function buildLabelQrPayload(variantId: string): string {
  return `${LABEL_QR_PREFIX}${variantId}`;
}

/**
 * Parse a label QR payload.
 * Accepts `gulio:v:{uuid}` or legacy paths containing `/p/{id}`.
 */
export function parseLabelQrPayload(
  payload: string,
): { variantId: string } | null {
  const trimmed = payload.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith(LABEL_QR_PREFIX)) {
    const variantId = trimmed.slice(LABEL_QR_PREFIX.length).trim();
    if (!variantId || !isUuid(variantId)) {
      return null;
    }
    return { variantId };
  }

  const legacyMatch = trimmed.match(/\/p\/([^/?#\s]+)/i);
  if (legacyMatch?.[1]) {
    return { variantId: legacyMatch[1] };
  }

  return null;
}
