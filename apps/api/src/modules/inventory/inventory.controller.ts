import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  ParseEnumPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { PermissionCode } from "@gulio/contracts";
import { SerialStatus } from "@gulio/database";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { InventoryService } from "./inventory.service";

@Controller("inventory")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get("balances")
  @Permissions(PermissionCode.STOCK_VIEW)
  listBalances(@Query("warehouseId") warehouseId: string) {
    if (!warehouseId) {
      throw new BadRequestException("warehouseId is required");
    }
    return this.inventoryService.listBalances(warehouseId);
  }

  @Get("serials")
  @Permissions(PermissionCode.STOCK_VIEW)
  listSerials(
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
      variantId,
      warehouseId,
      status,
    );
  }
}
