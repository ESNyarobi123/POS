import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  buildInternalCode128,
  buildLabelQrPayload,
  parseLabelQrPayload,
} from "@gulio/barcode";
import type {
  BrandDto,
  BrandListResponse,
  CategoryDto,
  CategoryListResponse,
  CreateBrandRequest,
  CreateCategoryRequest,
  CreateProductRequest,
  DecimalString,
  EnsureVariantBarcodeResponse,
  ProductListItemDto,
  ProductListResponse,
  StockHintDto,
  UpdateCategoryRequest,
  UpdateProductRequest,
  VariantDetailDto,
  VariantLookupResponse,
  VariantSummaryDto,
} from "@gulio/contracts";
import { Prisma } from "@gulio/database";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/types/request-user";
import { PrismaService } from "../../prisma/prisma.service";
import {
  isManagedCatalogImageUrl,
  mediaIdFromUrl,
  toClientImageUrl,
} from "./catalog-image";
import { MediaService, type PreparedImage } from "./media.service";

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

function mapVariantSummary(
  row: VariantWithBarcodes,
  productId: string,
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
    imageUrl: toClientImageUrl({
      productId,
      productImageUrl,
      variantId: row.id,
      variantImageUrl: row.imageUrl,
    }),
  };
}

function mapProductListItem(row: ProductWithRelations): ProductListItemDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    imageUrl: toClientImageUrl({
      productId: row.id,
      productImageUrl: row.imageUrl,
    }),
    isActive: row.isActive,
    brand: mapBrand(row.brand),
    category: mapCategory(row.category),
    variants: row.variants.map((v) =>
      mapVariantSummary(v, row.id, row.imageUrl),
    ),
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
      imageUrl: toClientImageUrl({
        productId: product.id,
        productImageUrl: product.imageUrl,
      }),
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

const productDetailInclude = {
  brand: true,
  category: true,
  variants: {
    where: { isActive: true },
    include: {
      barcodes: {
        orderBy: [{ isPrimary: "desc" as const }, { value: "asc" as const }],
      },
    },
    orderBy: { sku: "asc" as const },
  },
} satisfies Prisma.ProductInclude;

@Injectable()
export class CatalogService {
  private readonly log = new Logger(CatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly media: MediaService,
  ) {}

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

    const items = rows.map(mapProductListItem);
    this.primeImageCache(rows);
    return { items };
  }

  async getProductById(
    organizationId: string,
    productId: string,
  ): Promise<ProductListItemDto> {
    const row = await this.prisma.product.findFirst({
      where: { id: productId, organizationId },
      include: productDetailInclude,
    });
    if (!row) {
      throw new NotFoundException("Product not found");
    }
    return mapProductListItem(row);
  }

  async streamProductImage(productId: string): Promise<PreparedImage> {
    const row = await this.prisma.product.findFirst({
      where: { id: productId },
      select: { imageUrl: true },
    });
    if (!row?.imageUrl) {
      throw new NotFoundException("Image not found");
    }
    return this.streamStoredImage("product", productId, row.imageUrl);
  }

  async streamVariantImage(variantId: string): Promise<PreparedImage> {
    const row = await this.prisma.variant.findFirst({
      where: { id: variantId },
      select: {
        imageUrl: true,
        product: { select: { id: true, imageUrl: true } },
      },
    });
    const raw = row?.imageUrl || row?.product.imageUrl;
    if (!row || !raw) {
      throw new NotFoundException("Image not found");
    }
    return this.streamStoredImage("variant", variantId, raw);
  }

  private primeImageCache(rows: ProductWithRelations[]): void {
    for (const row of rows) {
      if (!row.imageUrl) continue;
      void this.streamStoredImage("product", row.id, row.imageUrl).catch(
        () => undefined,
      );
    }
  }

  private async streamStoredImage(
    kind: "product" | "variant",
    id: string,
    raw: string,
  ): Promise<PreparedImage> {
    if (isManagedCatalogImageUrl(raw)) {
      throw new NotFoundException("Image not found");
    }
    const mediaId = mediaIdFromUrl(raw);
    if (mediaId) {
      const cached = await this.media.getCached(`media/${mediaId}.webp`);
      if (!cached) {
        throw new NotFoundException("Image not found");
      }
      return { buffer: cached, contentType: "image/webp" };
    }
    try {
      return await this.media.prepareFromRaw(
        raw,
        this.media.cacheKeyFor(kind, id, raw),
      );
    } catch (err) {
      this.log.warn(
        `Catalog image ${kind}/${id}: ${
          err instanceof Error ? err.message : "unavailable"
        }`,
      );
      throw new NotFoundException("Image not found");
    }
  }

  async createProduct(
    user: RequestUser,
    body: CreateProductRequest,
  ): Promise<ProductListItemDto> {
    const name = body.name?.trim();
    if (!name) {
      throw new BadRequestException("name is required");
    }

    const variantBody = body.variant;
    if (!variantBody || typeof variantBody !== "object") {
      throw new BadRequestException("variant is required");
    }

    const variantName = variantBody.name?.trim();
    if (!variantName) {
      throw new BadRequestException("variant.name is required");
    }

    const sku = variantBody.sku?.trim().toUpperCase();
    if (!sku) {
      throw new BadRequestException("variant.sku is required");
    }

    let sellPrice: Prisma.Decimal;
    try {
      sellPrice = new Prisma.Decimal(
        String(variantBody.sellPrice ?? "").trim(),
      );
    } catch {
      throw new BadRequestException(
        "variant.sellPrice must be a valid decimal string",
      );
    }
    if (sellPrice.isNaN() || !sellPrice.isFinite() || sellPrice.lt(0)) {
      throw new BadRequestException("variant.sellPrice must be >= 0");
    }

    const barcodeValue = variantBody.barcode?.trim() || null;
    const requiresSerial = Boolean(variantBody.requiresSerial);
    const description =
      body.description !== undefined
        ? body.description?.trim() || null
        : null;
    const imageUrl =
      body.imageUrl !== undefined ? body.imageUrl?.trim() || null : null;

    const existingSku = await this.prisma.variant.findFirst({
      where: {
        organizationId: user.organizationId,
        sku: { equals: sku, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (existingSku) {
      throw new ConflictException(`SKU already exists: ${sku}`);
    }

    if (barcodeValue) {
      const existingBarcode = await this.prisma.barcode.findFirst({
        where: {
          organizationId: user.organizationId,
          value: barcodeValue,
        },
        select: { id: true },
      });
      if (existingBarcode) {
        throw new ConflictException(`Barcode already exists: ${barcodeValue}`);
      }
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const brandId = await this.resolveBrandId(
          tx,
          user.organizationId,
          body.brandId,
          body.brandName,
        );
        const categoryId = await this.resolveCategoryId(
          tx,
          user.organizationId,
          body.categoryId,
          body.categoryName,
        );

        const product = await tx.product.create({
          data: {
            organizationId: user.organizationId,
            name,
            description,
            imageUrl,
            brandId,
            categoryId,
            isActive: true,
            variants: {
              create: {
                organizationId: user.organizationId,
                sku,
                name: variantName,
                attributes: {},
                sellPrice,
                costPrice: new Prisma.Decimal(0),
                tracksSerial: requiresSerial,
                isActive: true,
                ...(barcodeValue
                  ? {
                      barcodes: {
                        create: {
                          organizationId: user.organizationId,
                          symbology: guessBarcodeSymbology(barcodeValue),
                          value: barcodeValue,
                          isPrimary: true,
                        },
                      },
                    }
                  : {}),
              },
            },
          },
          include: productDetailInclude,
        });

        return product;
      });

      await this.audit.log({
        action: "catalog.product.create",
        entityType: "Product",
        entityId: created.id,
        userId: user.userId,
        orgId: user.organizationId,
        meta: {
          name: created.name,
          sku,
          sellPrice: toDecimalString(sellPrice),
          requiresSerial,
          brandId: created.brandId,
          categoryId: created.categoryId,
          barcode: barcodeValue,
        },
      });

      return mapProductListItem(created);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const target = Array.isArray(err.meta?.target)
          ? (err.meta.target as string[]).join(",")
          : String(err.meta?.target ?? "");
        if (target.includes("sku")) {
          throw new ConflictException(`SKU already exists: ${sku}`);
        }
        if (target.includes("value") || target.includes("barcodes")) {
          throw new ConflictException(
            `Barcode already exists: ${barcodeValue}`,
          );
        }
        throw new ConflictException("Product conflicts with existing catalog data");
      }
      throw err;
    }
  }

  async updateProduct(
    user: RequestUser,
    productId: string,
    body: UpdateProductRequest,
  ): Promise<ProductListItemDto> {
    const existing = await this.prisma.product.findFirst({
      where: { id: productId, organizationId: user.organizationId },
    });
    if (!existing) {
      throw new NotFoundException("Product not found");
    }

    const name = body.name?.trim();
    if (body.name !== undefined && !name) {
      throw new BadRequestException("name cannot be empty");
    }

    const shouldUpdateBrand =
      body.brandId !== undefined || body.brandName !== undefined;
    const shouldUpdateCategory =
      body.categoryId !== undefined || body.categoryName !== undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      let brandId: string | null | undefined;
      if (shouldUpdateBrand) {
        brandId = await this.resolveBrandId(
          tx,
          user.organizationId,
          body.brandId,
          body.brandName,
        );
      }

      let categoryId: string | null | undefined;
      if (shouldUpdateCategory) {
        categoryId = await this.resolveCategoryId(
          tx,
          user.organizationId,
          body.categoryId,
          body.categoryName,
        );
      }

      return tx.product.update({
        where: { id: existing.id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(body.description !== undefined
            ? { description: body.description?.trim() || null }
            : {}),
          ...(body.imageUrl !== undefined
            ? {
                imageUrl: (() => {
                  const trimmed = body.imageUrl?.trim() || null;
                  if (trimmed && isManagedCatalogImageUrl(trimmed)) {
                    return existing.imageUrl;
                  }
                  return trimmed;
                })(),
              }
            : {}),
          ...(shouldUpdateBrand ? { brandId } : {}),
          ...(shouldUpdateCategory ? { categoryId } : {}),
        },
        include: productDetailInclude,
      });
    });

    await this.audit.log({
      action: "catalog.product.update",
      entityType: "Product",
      entityId: updated.id,
      userId: user.userId,
      orgId: user.organizationId,
      before: {
        name: existing.name,
        description: existing.description,
        imageUrl: existing.imageUrl,
        brandId: existing.brandId,
        categoryId: existing.categoryId,
      },
      meta: {
        name: updated.name,
        description: updated.description,
        imageUrl: updated.imageUrl,
        brandId: updated.brandId,
        categoryId: updated.categoryId,
      },
    });

    return mapProductListItem(updated);
  }

  async archiveProduct(
    user: RequestUser,
    productId: string,
  ): Promise<ProductListItemDto> {
    const existing = await this.prisma.product.findFirst({
      where: { id: productId, organizationId: user.organizationId },
    });
    if (!existing) {
      throw new NotFoundException("Product not found");
    }
    if (!existing.isActive) {
      return this.getProductById(user.organizationId, productId);
    }

    const archived = await this.prisma.$transaction(async (tx) => {
      await tx.variant.updateMany({
        where: { productId: existing.id, organizationId: user.organizationId },
        data: { isActive: false },
      });
      return tx.product.update({
        where: { id: existing.id },
        data: { isActive: false },
        include: {
          brand: true,
          category: true,
          variants: {
            include: {
              barcodes: {
                orderBy: [{ isPrimary: "desc" }, { value: "asc" }],
              },
            },
            orderBy: { sku: "asc" },
          },
        },
      });
    });

    await this.audit.log({
      action: "catalog.product.archive",
      entityType: "Product",
      entityId: archived.id,
      userId: user.userId,
      orgId: user.organizationId,
      before: { isActive: true, name: existing.name },
      meta: { isActive: false, name: archived.name },
    });

    return mapProductListItem(archived);
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

    const qr = parseLabelQrPayload(trimmed);
    if (qr) {
      const byQr = await this.prisma.variant.findFirst({
        where: { id: qr.variantId, organizationId },
        include: variantInclude,
      });
      if (!byQr) {
        throw new NotFoundException(`No variant for code: ${trimmed}`);
      }
      return {
        variant: mapVariantDetail(byQr, byQr.product),
        matchedBy: "qr",
        matchedCode: trimmed,
        stockHint: await this.buildStockHint(
          organizationId,
          byQr.id,
          warehouseId,
        ),
      };
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

  /**
   * Prefer existing primary (or any) barcode; otherwise create internal CODE128.
   * QR payload is returned for printing but not stored as a barcode row.
   */
  async ensurePrimaryBarcode(
    organizationId: string,
    variantId: string,
  ): Promise<EnsureVariantBarcodeResponse> {
    const variant = await this.prisma.variant.findFirst({
      where: { id: variantId, organizationId },
      include: {
        barcodes: {
          orderBy: [{ isPrimary: "desc" }, { value: "asc" }],
        },
      },
    });
    if (!variant) {
      throw new NotFoundException("Variant not found");
    }

    const existing =
      variant.barcodes.find((b) => b.isPrimary) ?? variant.barcodes[0];
    if (existing) {
      return {
        variantId: variant.id,
        barcode: {
          id: existing.id,
          symbology: existing.symbology,
          value: existing.value,
          isPrimary: existing.isPrimary,
          created: false,
        },
        qrPayload: buildLabelQrPayload(variant.id),
      };
    }

    const candidates = [
      buildInternalCode128(variant.sku),
      `GUL-${buildInternalCode128(variant.sku).replace(/^GUL-/, "")}-${variant.id.slice(0, 8).toUpperCase()}`,
    ];
    // Deduplicate if sku already produced a GUL- value
    const uniqueCandidates = [...new Set(candidates)];

    let created: BarcodeRow | null = null;
    let lastError: unknown;
    for (const value of uniqueCandidates) {
      try {
        created = await this.prisma.barcode.create({
          data: {
            organizationId,
            variantId: variant.id,
            symbology: "CODE128",
            value,
            isPrimary: true,
          },
          select: {
            id: true,
            symbology: true,
            value: true,
            isPrimary: true,
          },
        });
        break;
      } catch (err) {
        lastError = err;
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          continue;
        }
        throw err;
      }
    }

    if (!created) {
      // Race: another request may have inserted meanwhile — re-read.
      const refreshed = await this.prisma.barcode.findFirst({
        where: { organizationId, variantId: variant.id },
        orderBy: [{ isPrimary: "desc" }, { value: "asc" }],
      });
      if (refreshed) {
        return {
          variantId: variant.id,
          barcode: {
            id: refreshed.id,
            symbology: refreshed.symbology,
            value: refreshed.value,
            isPrimary: refreshed.isPrimary,
            created: false,
          },
          qrPayload: buildLabelQrPayload(variant.id),
        };
      }
      throw lastError instanceof Error
        ? lastError
        : new BadRequestException("Could not allocate unique barcode");
    }

    return {
      variantId: variant.id,
      barcode: {
        id: created.id,
        symbology: created.symbology,
        value: created.value,
        isPrimary: created.isPrimary,
        created: true,
      },
      qrPayload: buildLabelQrPayload(variant.id),
    };
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

  async createCategory(
    user: RequestUser,
    body: CreateCategoryRequest,
  ): Promise<CategoryDto> {
    const name = body.name?.trim();
    if (!name) {
      throw new BadRequestException("name is required");
    }

    const parentId = await this.resolveParentCategoryId(
      user.organizationId,
      body.parentId,
    );

    const duplicate = await this.prisma.category.findFirst({
      where: {
        organizationId: user.organizationId,
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(`Category already exists: ${name}`);
    }

    const created = await this.prisma.category.create({
      data: {
        organizationId: user.organizationId,
        name,
        parentId,
      },
    });

    await this.audit.log({
      action: "catalog.category.create",
      entityType: "Category",
      entityId: created.id,
      userId: user.userId,
      orgId: user.organizationId,
      meta: {
        name: created.name,
        parentId: created.parentId,
      },
    });

    return {
      id: created.id,
      name: created.name,
      parentId: created.parentId,
    };
  }

  async updateCategory(
    user: RequestUser,
    categoryId: string,
    body: UpdateCategoryRequest,
  ): Promise<CategoryDto> {
    const existing = await this.prisma.category.findFirst({
      where: { id: categoryId, organizationId: user.organizationId },
    });
    if (!existing) {
      throw new NotFoundException("Category not found");
    }

    const name =
      body.name !== undefined ? body.name.trim() : undefined;
    if (body.name !== undefined && !name) {
      throw new BadRequestException("name cannot be empty");
    }

    if (name) {
      const duplicate = await this.prisma.category.findFirst({
        where: {
          organizationId: user.organizationId,
          name: { equals: name, mode: "insensitive" },
          NOT: { id: existing.id },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException(`Category already exists: ${name}`);
      }
    }

    const parentId =
      body.parentId !== undefined
        ? await this.resolveParentCategoryId(
            user.organizationId,
            body.parentId,
            existing.id,
          )
        : undefined;

    const updated = await this.prisma.category.update({
      where: { id: existing.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(body.parentId !== undefined ? { parentId } : {}),
      },
    });

    await this.audit.log({
      action: "catalog.category.update",
      entityType: "Category",
      entityId: updated.id,
      userId: user.userId,
      orgId: user.organizationId,
      before: {
        name: existing.name,
        parentId: existing.parentId,
      },
      meta: {
        name: updated.name,
        parentId: updated.parentId,
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      parentId: updated.parentId,
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

  async createBrand(
    user: RequestUser,
    body: CreateBrandRequest,
  ): Promise<BrandDto> {
    const name = body.name?.trim();
    if (!name) {
      throw new BadRequestException("name is required");
    }

    const duplicate = await this.prisma.brand.findFirst({
      where: {
        organizationId: user.organizationId,
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(`Brand already exists: ${name}`);
    }

    const created = await this.prisma.brand.create({
      data: {
        organizationId: user.organizationId,
        name,
      },
    });

    await this.audit.log({
      action: "catalog.brand.create",
      entityType: "Brand",
      entityId: created.id,
      userId: user.userId,
      orgId: user.organizationId,
      meta: {
        name: created.name,
      },
    });

    return {
      id: created.id,
      name: created.name,
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

  private async resolveBrandId(
    tx: Prisma.TransactionClient,
    organizationId: string,
    brandId?: string | null,
    brandName?: string | null,
  ): Promise<string | null> {
    const id = brandId?.trim();
    if (id) {
      const existing = await tx.brand.findFirst({
        where: { id, organizationId },
        select: { id: true },
      });
      if (!existing) {
        throw new BadRequestException("brandId not found in organization");
      }
      return existing.id;
    }

    const name = brandName?.trim();
    if (!name) return null;

    const found = await tx.brand.findFirst({
      where: {
        organizationId,
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (found) return found.id;

    try {
      const created = await tx.brand.create({
        data: { organizationId, name },
        select: { id: true },
      });
      return created.id;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const raced = await tx.brand.findFirst({
          where: {
            organizationId,
            name: { equals: name, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (raced) return raced.id;
      }
      throw err;
    }
  }

  private async resolveCategoryId(
    tx: Prisma.TransactionClient,
    organizationId: string,
    categoryId?: string | null,
    categoryName?: string | null,
  ): Promise<string | null> {
    const id = categoryId?.trim();
    if (id) {
      const existing = await tx.category.findFirst({
        where: { id, organizationId },
        select: { id: true },
      });
      if (!existing) {
        throw new BadRequestException("categoryId not found in organization");
      }
      return existing.id;
    }

    const name = categoryName?.trim();
    if (!name) return null;

    const found = await tx.category.findFirst({
      where: {
        organizationId,
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (found) return found.id;

    const created = await tx.category.create({
      data: { organizationId, name },
      select: { id: true },
    });
    return created.id;
  }

  /**
   * Validate optional parent category within org.
   * `null` / omitted empty clears parent; self-parent is rejected.
   */
  private async resolveParentCategoryId(
    organizationId: string,
    parentId: string | null | undefined,
    selfId?: string,
  ): Promise<string | null> {
    if (parentId === undefined || parentId === null) {
      return null;
    }
    const id = parentId.trim();
    if (!id) return null;
    if (selfId && id === selfId) {
      throw new BadRequestException("category cannot be its own parent");
    }
    const parent = await this.prisma.category.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!parent) {
      throw new BadRequestException("parentId not found in organization");
    }
    return parent.id;
  }
}

function guessBarcodeSymbology(value: string): string {
  if (/^\d{13}$/.test(value)) return "EAN13";
  if (/^\d{12}$/.test(value)) return "UPCA";
  if (/^\d{8}$/.test(value)) return "EAN8";
  return "CODE128";
}
