import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { PermissionCode } from "@gulio/contracts";
import type {
  BrandListResponse,
  CategoryListResponse,
  ProductListResponse,
  VariantDetailDto,
  VariantLookupResponse,
} from "@gulio/contracts";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import type { RequestUser } from "../auth/types/request-user";
import { CatalogService } from "./catalog.service";

/** View catalog: dedicated view, manage, or POS sell (cashier scanner). */
const CATALOG_READ = [
  PermissionCode.CATALOG_VIEW,
  PermissionCode.CATALOG_MANAGE,
  PermissionCode.POS_SELL,
] as const;

@Controller("catalog")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get("products")
  @Permissions(...CATALOG_READ)
  listProducts(
    @CurrentUser() user: RequestUser,
    @Query("q") q?: string,
    @Query("categoryId") categoryId?: string,
    @Query("limit") limitRaw?: string,
  ): Promise<ProductListResponse> {
    let limit: number | undefined;
    if (limitRaw !== undefined && limitRaw !== "") {
      const parsed = Number.parseInt(limitRaw, 10);
      if (Number.isNaN(parsed)) {
        throw new BadRequestException("limit must be an integer");
      }
      limit = parsed;
    }
    return this.catalogService.listProducts(user.organizationId, {
      q,
      categoryId,
      limit,
    });
  }

  /** Scanner lookup — must be registered before variants/:id */
  @Get("variants/lookup")
  @Permissions(...CATALOG_READ)
  lookupVariant(
    @CurrentUser() user: RequestUser,
    @Query("code") code?: string,
    @Query("warehouseId") warehouseId?: string,
  ): Promise<VariantLookupResponse> {
    if (!code?.trim()) {
      throw new BadRequestException("code is required");
    }
    return this.catalogService.lookupVariantByCode(
      user.organizationId,
      code,
      warehouseId,
    );
  }

  @Get("variants/:id")
  @Permissions(...CATALOG_READ)
  getVariant(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<VariantDetailDto> {
    return this.catalogService.getVariantById(user.organizationId, id);
  }

  @Get("categories")
  @Permissions(...CATALOG_READ)
  listCategories(
    @CurrentUser() user: RequestUser,
  ): Promise<CategoryListResponse> {
    return this.catalogService.listCategories(user.organizationId);
  }

  @Get("brands")
  @Permissions(...CATALOG_READ)
  listBrands(@CurrentUser() user: RequestUser): Promise<BrandListResponse> {
    return this.catalogService.listBrands(user.organizationId);
  }
}
