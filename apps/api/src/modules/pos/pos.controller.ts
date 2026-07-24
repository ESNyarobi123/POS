import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { PermissionCode } from "@gulio/contracts";
import type {
  CheckoutRequest,
  CloseShiftRequest,
  OpenShiftRequest,
} from "@gulio/contracts";
import {
  CurrentUser,
  JwtAuthGuard,
  Permissions,
  PermissionsGuard,
  type RequestUser,
} from "../auth";
import { PosService } from "./pos.service";

@Controller("pos")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Post("shifts/open")
  @Permissions(
    PermissionCode.SHIFT_OPEN_OWN,
    PermissionCode.SHIFT_OPEN_ANY,
  )
  openShift(@CurrentUser() user: RequestUser, @Body() body: OpenShiftRequest) {
    return this.posService.openShift(user, body);
  }

  @Post("shifts/:id/close")
  @Permissions(
    PermissionCode.SHIFT_OPEN_OWN,
    PermissionCode.SHIFT_OPEN_ANY,
  )
  closeShift(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() body: CloseShiftRequest,
  ) {
    return this.posService.closeShift(user, id, body);
  }

  @Get("shifts/current")
  @Permissions(
    PermissionCode.SHIFT_OPEN_OWN,
    PermissionCode.SHIFT_OPEN_ANY,
    PermissionCode.POS_SELL,
  )
  getCurrentShift(
    @CurrentUser() user: RequestUser,
    @Query("registerId") registerId: string,
  ) {
    return this.posService.getCurrentShift(user, registerId);
  }

  @Post("checkout")
  @Permissions(PermissionCode.POS_SELL)
  checkout(
    @CurrentUser() user: RequestUser,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: CheckoutRequest,
  ) {
    return this.posService.checkout(user, idempotencyKey ?? "", body);
  }

  @Get("sales/:id/receipt")
  @Permissions(PermissionCode.POS_SELL, PermissionCode.REPORTS_VIEW)
  getReceipt(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
  ) {
    return this.posService.getReceipt(user, id);
  }

  @Get("sales")
  @Permissions(PermissionCode.POS_SELL, PermissionCode.REPORTS_VIEW)
  listSales(
    @CurrentUser() user: RequestUser,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.posService.listRecentSales(user, limit);
  }
}
