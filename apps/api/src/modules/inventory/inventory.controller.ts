import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  PermissionCode,
  type CreateStockAdjustmentRequest,
  type RemoveSerialUnitRequest,
  type UpdateSerialUnitRequest,
} from "@gulio/contracts";
import { SerialStatus } from "@gulio/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { RequestUser } from "../auth/types/request-user";
import { InventoryService } from "./inventory.service";

@Controller("inventory")
@UseGuards(JwtAuthGuard, PermissionsGuard, RolesGuard)
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

  @Get("variants/:variantId/serials")
  @Roles("OWNER")
  @Permissions(PermissionCode.STOCK_SERIAL_FIX)
  getVariantSerials(
    @CurrentUser() user: RequestUser,
    @Param("variantId", ParseUUIDPipe) variantId: string,
    @Query("warehouseId") warehouseId: string,
    @Query("includeRemoved") includeRemovedRaw?: string,
  ) {
    if (!warehouseId) {
      throw new BadRequestException("warehouseId is required");
    }
    const includeRemoved =
      includeRemovedRaw === "1" || includeRemovedRaw === "true";
    return this.inventoryService.getVariantSerialPanel(
      user,
      variantId,
      warehouseId,
      includeRemoved,
    );
  }

  @Patch("serials/:serialId")
  @Roles("OWNER")
  @Permissions(PermissionCode.STOCK_SERIAL_FIX)
  updateSerial(
    @CurrentUser() user: RequestUser,
    @Param("serialId", ParseUUIDPipe) serialId: string,
    @Body() body: UpdateSerialUnitRequest,
  ) {
    return this.inventoryService.updateSerialUnit(
      user,
      serialId,
      body ?? ({} as UpdateSerialUnitRequest),
    );
  }

  @Post("serials/:serialId/remove")
  @Roles("OWNER")
  @Permissions(PermissionCode.STOCK_SERIAL_FIX)
  removeSerial(
    @CurrentUser() user: RequestUser,
    @Param("serialId", ParseUUIDPipe) serialId: string,
    @Body() body: RemoveSerialUnitRequest,
  ) {
    return this.inventoryService.removeSerialUnit(
      user,
      serialId,
      body ?? ({} as RemoveSerialUnitRequest),
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
