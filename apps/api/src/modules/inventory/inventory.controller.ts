import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  ParseEnumPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  PermissionCode,
  type CreateStockAdjustmentRequest,
} from "@gulio/contracts";
import { SerialStatus } from "@gulio/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import type { RequestUser } from "../auth/types/request-user";
import { InventoryService } from "./inventory.service";

@Controller("inventory")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get("balances")
  @Permissions(PermissionCode.STOCK_VIEW)
  listBalances(
    @CurrentUser() user: RequestUser,
    @Query("warehouseId") warehouseId: string,
  ) {
    if (!warehouseId) {
      throw new BadRequestException("warehouseId is required");
    }
    return this.inventoryService.listBalances(
      user.organizationId,
      warehouseId,
    );
  }

  @Get("serials")
  @Permissions(PermissionCode.STOCK_VIEW)
  listSerials(
    @CurrentUser() user: RequestUser,
    @Query("variantId") variantId: string,
    @Query("warehouseId") warehouseId: string,
    @Query(
      "status",
      new DefaultValuePipe(SerialStatus.IN_STOCK),
      new ParseEnumPipe(SerialStatus),
    )
    status: SerialStatus,
  ) {
    if (!variantId || !warehouseId) {
      throw new BadRequestException("variantId and warehouseId are required");
    }
    return this.inventoryService.listAvailableSerials(
      user.organizationId,
      variantId,
      warehouseId,
      status,
    );
  }

  @Post("adjustments")
  @Permissions(PermissionCode.STOCK_ADJUST)
  createAdjustment(
    @CurrentUser() user: RequestUser,
    @Body() body: CreateStockAdjustmentRequest,
  ) {
    return this.inventoryService.createAdjustment(user, body);
  }
}
