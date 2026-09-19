const DATA_IMAGE_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/;

export function isDataImageUrl(value: string): boolean {
  return value.trim().toLowerCase().startsWith("data:image/");
}

export function isManagedCatalogImageUrl(value: string): boolean {
  return /\/catalog\/(products|variants)\/[0-9a-f-]{36}\/image(?:\?.*)?$/i.test(
    value.trim(),
  );
}

export function parseDataImage(value: string): { mime: string; buffer: Buffer } {
  const trimmed = value.trim().replace(/\s/g, "");
  const match = DATA_IMAGE_RE.exec(trimmed);
  if (!match) {
    throw new Error("Invalid data image");
  }
  return {
    mime: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

/** Path-only URLs so the web app prefixes NEXT_PUBLIC_API_URL in every environment. */
export function publicProductImageUrl(productId: string): string {
  return `/catalog/products/${productId}/image`;
}

export function publicVariantImageUrl(variantId: string): string {
  return `/catalog/variants/${variantId}/image`;
}

export function publicMediaUrl(mediaId: string): string {
  return `/catalog/media/${mediaId}`;
}

export function mediaIdFromUrl(value: string): string | null {
  const match = /\/catalog\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(
    value.trim(),
  );
  return match?.[1] ?? null;
}

/** List/POS DTOs never carry data URLs — browsers fetch a short cached URL instead. */
export function toClientImageUrl(input: {
  productId: string;
  productImageUrl: string | null | undefined;
  variantId?: string;
  variantImageUrl?: string | null;
}): string | null {
  const variantRaw = input.variantImageUrl?.trim() || null;
  const productRaw = input.productImageUrl?.trim() || null;
  const raw = variantRaw ?? productRaw;
  if (!raw) return null;
  if (variantRaw && input.variantId) {
    return publicVariantImageUrl(input.variantId);
  }
  return publicProductImageUrl(input.productId);
}
