import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  PermissionCode,
  type CreateGoodsReceiptRequest,
  type CreateSupplierRequest,
  type GoodsReceiptListQuery,
  type RecordSupplierPaymentRequest,
  type UpdateSupplierRequest,
} from "@gulio/contracts";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { RequestUser } from "../auth/types/request-user";
import {
  PurchasingService,
  type SupplierPaymentListQuery,
} from "./purchasing.service";

@Controller("purchasing")
@UseGuards(JwtAuthGuard, PermissionsGuard, RolesGuard)
export class PurchasingController {
  constructor(private readonly purchasingService: PurchasingService) {}

  // -------------------------------------------------------------------------
  // Suppliers
  // -------------------------------------------------------------------------

  @Get("suppliers")
  @Permissions(PermissionCode.STOCK_VIEW)
  listSuppliers(
    @CurrentUser() user: RequestUser,
    @Query("search") search?: string,
    @Query("includeInactive") includeInactiveRaw?: string,
  ) {
    const includeInactive =
      includeInactiveRaw === "1" || includeInactiveRaw === "true";
    return this.purchasingService.listSuppliers(user, {
      search,
      includeInactive,
    });
  }

  @Post("suppliers")
  @Permissions(PermissionCode.STOCK_ADJUST)
  createSupplier(
    @CurrentUser() user: RequestUser,
    @Body() body: CreateSupplierRequest,
  ) {
    return this.purchasingService.createSupplier(user, body);
  }

  @Patch("suppliers/:id")
  @Permissions(PermissionCode.STOCK_ADJUST)
  updateSupplier(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateSupplierRequest,
  ) {
    return this.purchasingService.updateSupplier(user, id, body);
  }

  // -------------------------------------------------------------------------
  // Goods receipts
  // -------------------------------------------------------------------------

  @Get("receipts")
  @Permissions(PermissionCode.STOCK_VIEW)
  listReceipts(
    @CurrentUser() user: RequestUser,
    @Query() query: GoodsReceiptListQuery,
  ) {
    return this.purchasingService.listReceipts(user, query ?? {});
  }

  @Get("receipts/:id")
  @Permissions(PermissionCode.STOCK_VIEW)
  getReceipt(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.purchasingService.getReceipt(user, id);
  }

  @Post("receipts")
  @Permissions(PermissionCode.STOCK_ADJUST)
  createReceipt(
    @CurrentUser() user: RequestUser,
    @Body() body: CreateGoodsReceiptRequest,
  ) {
    return this.purchasingService.createReceipt(user, body);
  }

  // -------------------------------------------------------------------------
  // Supplier payments
  // -------------------------------------------------------------------------

  @Get("payments")
  @Permissions(PermissionCode.STOCK_VIEW)
  listPayments(
    @CurrentUser() user: RequestUser,
    @Query() query: SupplierPaymentListQuery,
  ) {
    return this.purchasingService.listPayments(user, query ?? {});
  }

  @Post("payments")
  @Permissions(PermissionCode.STOCK_ADJUST)
  recordPayment(
    @CurrentUser() user: RequestUser,
    @Body() body: RecordSupplierPaymentRequest,
  ) {
    return this.purchasingService.recordPayment(user, body);
  }
}
