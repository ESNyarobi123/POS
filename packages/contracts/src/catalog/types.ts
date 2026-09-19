/**
 * Catalog read contracts — products, variants, brands, categories, scanner lookup.
 * Money fields are decimal strings (never JS float).
 */

import type { DecimalString } from "../inventory/types";

export type BrandDto = {
  id: string;
  name: string;
};

export type CategoryDto = {
  id: string;
  name: string;
  parentId: string | null;
};

export type VariantSummaryDto = {
  id: string;
  sku: string;
  name: string;
  attributes: Record<string, unknown>;
  sellPrice: DecimalString;
  /** Alias for tracksSerial — POS uses requiresSerial. */
  requiresSerial: boolean;
  isActive: boolean;
  primaryBarcode: string | null;
  /** Variant image when set; otherwise product image. */
  imageUrl?: string | null;
};

export type ProductListItemDto = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  brand: BrandDto | null;
  category: CategoryDto | null;
  variants: VariantSummaryDto[];
};

export type ProductListResponse = {
  items: ProductListItemDto[];
};

export type VariantDetailDto = {
  id: string;
  productId: string;
  sku: string;
  name: string;
  attributes: Record<string, unknown>;
  sellPrice: DecimalString;
  costPrice: DecimalString;
  taxClass: string | null;
  requiresSerial: boolean;
  isActive: boolean;
  barcodes: Array<{
    id: string;
    symbology: string;
    value: string;
    isPrimary: boolean;
  }>;
  product: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    isActive: boolean;
    brand: BrandDto | null;
    category: CategoryDto | null;
  };
};

/** Optional projected stock for scanner / POS (read-only hint). */
export type StockHintDto = {
  warehouseId: string;
  quantityOnHand: DecimalString;
  quantityReserved: DecimalString;
  quantityAvailable: DecimalString;
};

export type VariantLookupResponse = {
  variant: VariantDetailDto;
  matchedBy: "barcode" | "sku" | "qr";
  matchedCode: string;
  stockHint: StockHintDto | null;
};

/** Ensure a primary Code 128 barcode exists for label printing. */
export type EnsureVariantBarcodeResponse = {
  variantId: string;
  barcode: {
    id: string;
    symbology: string;
    value: string;
    isPrimary: boolean;
    created: boolean;
  };
  qrPayload: string;
};

export type CategoryListResponse = {
  items: CategoryDto[];
};

export type BrandListResponse = {
  items: BrandDto[];
};

/** Upload a product photo (data URL or https). Server stores a compressed copy. */
export type UploadCatalogImageRequest = {
  image: string;
};

export type UploadCatalogImageResponse = {
  url: string;
};

export type ListProductsQuery = {
  q?: string;
  categoryId?: string;
  limit?: number;
};

export type CreateCategoryRequest = {
  name: string;
  parentId?: string | null;
};

export type CreateBrandRequest = {
  name: string;
};

export type UpdateCategoryRequest = {
  name?: string;
  parentId?: string | null;
};

export type UpdateProductRequest = {
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
  /** Existing brand id; null clears. Prefer over brandName when both set. */
  brandId?: string | null;
  /** Find-or-create by name within org; null clears when brandId omitted. */
  brandName?: string | null;
  /** Existing category id; null clears. Prefer over categoryName when both set. */
  categoryId?: string | null;
  /** Find-or-create by name within org; null clears when categoryId omitted. */
  categoryName?: string | null;
};

/**
 * Create product with one initial variant.
 * Brand/category: pass existing id and/or free-text name (find-or-create by name within org).
 * Money fields are decimal strings (never JS float).
 */
export type CreateProductRequest = {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  brandId?: string;
  brandName?: string;
  categoryId?: string;
  categoryName?: string;
  variant: {
    name: string;
    sku: string;
    sellPrice: DecimalString;
    /** Maps to Variant.tracksSerial */
    requiresSerial?: boolean;
    barcode?: string | null;
  };
};
