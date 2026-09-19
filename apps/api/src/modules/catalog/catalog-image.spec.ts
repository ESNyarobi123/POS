import { isManagedCatalogImageUrl, toClientImageUrl } from "./catalog-image";

describe("toClientImageUrl", () => {
  const productId = "11111111-1111-1111-1111-111111111111";
  const variantId = "22222222-2222-2222-2222-222222222222";

  it("returns null when there is no image", () => {
    expect(
      toClientImageUrl({ productId, productImageUrl: null }),
    ).toBeNull();
  });

  it("never returns a data URL for list/POS clients", () => {
    const url = toClientImageUrl({
      productId,
      productImageUrl: "data:image/png;base64,abc",
    });
    expect(url).toBe(`/catalog/products/${productId}/image`);
    expect(url?.startsWith("data:")).toBe(false);
  });

  it("uses the variant image endpoint when the variant has its own photo", () => {
    const url = toClientImageUrl({
      productId,
      productImageUrl: "https://cdn.example/p.jpg",
      variantId,
      variantImageUrl: "https://cdn.example/v.jpg",
    });
    expect(url).toBe(`/catalog/variants/${variantId}/image`);
  });
});

describe("isManagedCatalogImageUrl", () => {
  it("detects proxied catalog image URLs so we never persist them", () => {
    expect(
      isManagedCatalogImageUrl(
        "/catalog/products/11111111-1111-1111-1111-111111111111/image",
      ),
    ).toBe(true);
    expect(isManagedCatalogImageUrl("https://images.unsplash.com/photo-x")).toBe(
      false,
    );
  });
});
