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
  matchedBy: "barcode" | "sku";
  matchedCode: string;
  stockHint: StockHintDto | null;
};

export type CategoryListResponse = {
  items: CategoryDto[];
};

export type BrandListResponse = {
  items: BrandDto[];
};

export type ListProductsQuery = {
  q?: string;
  categoryId?: string;
  limit?: number;
};
