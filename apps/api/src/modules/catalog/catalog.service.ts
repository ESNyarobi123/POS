import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  BrandDto,
  BrandListResponse,
  CategoryDto,
  CategoryListResponse,
  DecimalString,
  ProductListItemDto,
  ProductListResponse,
  StockHintDto,
  VariantDetailDto,
  VariantLookupResponse,
  VariantSummaryDto,
} from "@gulio/contracts";
import { Prisma } from "@gulio/database";
import { PrismaService } from "../../prisma/prisma.service";

const DEFAULT_PRODUCT_LIMIT = 50;
const MAX_PRODUCT_LIMIT = 100;

type BrandRow = { id: string; name: string };
type CategoryRow = { id: string; name: string; parentId: string | null };
type BarcodeRow = {
  id: string;
  symbology: string;
  value: string;
  isPrimary: boolean;
};

type VariantWithBarcodes = {
  id: string;
  productId: string;
  sku: string;
  name: string;
  attributes: Prisma.JsonValue;
  sellPrice: Prisma.Decimal;
  costPrice: Prisma.Decimal;
  taxClass: string | null;
  tracksSerial: boolean;
  imageUrl: string | null;
  isActive: boolean;
  barcodes: BarcodeRow[];
};

type ProductWithRelations = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  brand: BrandRow | null;
  category: CategoryRow | null;
  variants: VariantWithBarcodes[];
};

function toDecimalString(value: Prisma.Decimal | number | string): DecimalString {
  if (value instanceof Prisma.Decimal) {
    return value.toFixed(4);
  }
  return new Prisma.Decimal(value).toFixed(4);
}

function asAttributes(value: Prisma.JsonValue): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function mapBrand(row: BrandRow | null): BrandDto | null {
  if (!row) return null;
  return { id: row.id, name: row.name };
}

function mapCategory(row: CategoryRow | null): CategoryDto | null {
  if (!row) return null;
  return { id: row.id, name: row.name, parentId: row.parentId };
}

function primaryBarcode(barcodes: BarcodeRow[]): string | null {
  const primary = barcodes.find((b) => b.isPrimary) ?? barcodes[0];
  return primary?.value ?? null;
}

function resolveImageUrl(
  variantImageUrl: string | null | undefined,
  productImageUrl: string | null | undefined,
): string | null {
  return variantImageUrl ?? productImageUrl ?? null;
}

function mapVariantSummary(
  row: VariantWithBarcodes,
  productImageUrl: string | null,
): VariantSummaryDto {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    attributes: asAttributes(row.attributes),
    sellPrice: toDecimalString(row.sellPrice),
    requiresSerial: row.tracksSerial,
    isActive: row.isActive,
    primaryBarcode: primaryBarcode(row.barcodes),
    imageUrl: resolveImageUrl(row.imageUrl, productImageUrl),
  };
}

function mapProductListItem(row: ProductWithRelations): ProductListItemDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    imageUrl: row.imageUrl,
    isActive: row.isActive,
    brand: mapBrand(row.brand),
    category: mapCategory(row.category),
    variants: row.variants.map((v) => mapVariantSummary(v, row.imageUrl)),
  };
}

function mapVariantDetail(
  variant: VariantWithBarcodes,
  product: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    isActive: boolean;
    brand: BrandRow | null;
    category: CategoryRow | null;
  },
): VariantDetailDto {
  return {
    id: variant.id,
    productId: variant.productId,
    sku: variant.sku,
    name: variant.name,
    attributes: asAttributes(variant.attributes),
    sellPrice: toDecimalString(variant.sellPrice),
    costPrice: toDecimalString(variant.costPrice),
    taxClass: variant.taxClass,
    requiresSerial: variant.tracksSerial,
    isActive: variant.isActive,
    barcodes: variant.barcodes.map((b) => ({
      id: b.id,
      symbology: b.symbology,
      value: b.value,
      isPrimary: b.isPrimary,
    })),
    product: {
      id: product.id,
      name: product.name,
      description: product.description,
      imageUrl: product.imageUrl,
      isActive: product.isActive,
      brand: mapBrand(product.brand),
      category: mapCategory(product.category),
    },
  };
}

const variantInclude = {
  barcodes: {
    orderBy: [{ isPrimary: "desc" as const }, { value: "asc" as const }],
  },
  product: {
    include: {
      brand: true,
      category: true,
    },
  },
} satisfies Prisma.VariantInclude;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listProducts(
    organizationId: string,
    query: { q?: string; categoryId?: string; limit?: number },
  ): Promise<ProductListResponse> {
    const limit = Math.min(
      Math.max(query.limit ?? DEFAULT_PRODUCT_LIMIT, 1),
      MAX_PRODUCT_LIMIT,
    );
    const q = query.q?.trim();

    const where: Prisma.ProductWhereInput = {
      organizationId,
      isActive: true,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              {
                variants: {
                  some: {
                    OR: [
                      { sku: { contains: q, mode: "insensitive" } },
                      { name: { contains: q, mode: "insensitive" } },
                      {
                        barcodes: {
                          some: {
                            value: { contains: q, mode: "insensitive" },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.product.findMany({
      where,
      include: {
        brand: true,
        category: true,
        variants: {
          where: { isActive: true },
          include: {
            barcodes: {
              orderBy: [{ isPrimary: "desc" }, { value: "asc" }],
            },
          },
          orderBy: { sku: "asc" },
        },
      },
      orderBy: { name: "asc" },
      take: limit,
    });

    return { items: rows.map(mapProductListItem) };
  }

  async lookupVariantByCode(
    organizationId: string,
    code: string,
    warehouseId?: string,
  ): Promise<VariantLookupResponse> {
    const trimmed = code?.trim();
    if (!trimmed) {
      throw new BadRequestException("code is required");
    }

    const byBarcode = await this.prisma.barcode.findFirst({
      where: {
        organizationId,
        value: trimmed,
      },
      include: {
        variant: { include: variantInclude },
      },
    });

    if (byBarcode?.variant) {
      const variant = byBarcode.variant;
      if (variant.organizationId !== organizationId) {
        throw new NotFoundException("Variant not found");
      }
      return {
        variant: mapVariantDetail(variant, variant.product),
        matchedBy: "barcode",
        matchedCode: trimmed,
        stockHint: await this.buildStockHint(
          organizationId,
          variant.id,
          warehouseId,
        ),
      };
    }

    const bySku = await this.prisma.variant.findFirst({
      where: {
        organizationId,
        sku: { equals: trimmed, mode: "insensitive" },
      },
      include: variantInclude,
    });

    if (!bySku) {
      throw new NotFoundException(`No variant for code: ${trimmed}`);
    }

    return {
      variant: mapVariantDetail(bySku, bySku.product),
      matchedBy: "sku",
      matchedCode: trimmed,
      stockHint: await this.buildStockHint(
        organizationId,
        bySku.id,
        warehouseId,
      ),
    };
  }

  async getVariantById(
    organizationId: string,
    variantId: string,
  ): Promise<VariantDetailDto> {
    const variant = await this.prisma.variant.findFirst({
      where: { id: variantId, organizationId },
      include: variantInclude,
    });
    if (!variant) {
      throw new NotFoundException("Variant not found");
    }
    return mapVariantDetail(variant, variant.product);
  }

  async listCategories(organizationId: string): Promise<CategoryListResponse> {
    const rows = await this.prisma.category.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        parentId: r.parentId,
      })),
    };
  }

  async listBrands(organizationId: string): Promise<BrandListResponse> {
    const rows = await this.prisma.brand.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
    return {
      items: rows.map((r) => ({ id: r.id, name: r.name })),
    };
  }

  /**
   * Read-only stock projection for POS hint. Does not mutate ledger.
   * When warehouseId omitted, sums available qty across org warehouses.
   */
  private async buildStockHint(
    organizationId: string,
    variantId: string,
    warehouseId?: string,
  ): Promise<StockHintDto | null> {
    if (warehouseId) {
      const row = await this.prisma.stockBalance.findFirst({
        where: { organizationId, warehouseId, variantId },
      });
      if (!row) {
        return {
          warehouseId,
          quantityOnHand: "0.0000",
          quantityReserved: "0.0000",
          quantityAvailable: "0.0000",
        };
      }
      const available = row.quantityOnHand.minus(row.quantityReserved);
      return {
        warehouseId: row.warehouseId,
        quantityOnHand: toDecimalString(row.quantityOnHand),
        quantityReserved: toDecimalString(row.quantityReserved),
        quantityAvailable: toDecimalString(available),
      };
    }

    const rows = await this.prisma.stockBalance.findMany({
      where: { organizationId, variantId },
    });
    if (rows.length === 0) return null;

    let onHand = new Prisma.Decimal(0);
    let reserved = new Prisma.Decimal(0);
    for (const row of rows) {
      onHand = onHand.plus(row.quantityOnHand);
      reserved = reserved.plus(row.quantityReserved);
    }
    return {
      warehouseId: rows.length === 1 ? rows[0].warehouseId : "*",
      quantityOnHand: toDecimalString(onHand),
      quantityReserved: toDecimalString(reserved),
      quantityAvailable: toDecimalString(onHand.minus(reserved)),
    };
  }
}
