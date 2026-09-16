import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { PermissionCode } from "@gulio/contracts";
import type {
  OpticEdgeChannelsResponse,
  SelcomPushRequest,
} from "@gulio/contracts";
import {
  CurrentUser,
  JwtAuthGuard,
  Permissions,
  PermissionsGuard,
  type RequestUser,
} from "../auth";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get("opticedge/channels")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PermissionCode.POS_SELL)
  listOpticEdgeChannels(
    @CurrentUser() user: RequestUser,
  ): Promise<OpticEdgeChannelsResponse> {
    return this.paymentsService.listOpticEdgeChannels(user);
  }

  @Post("selcom/push")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PermissionCode.POS_SELL)
  startSelcomPush(
    @CurrentUser() user: RequestUser,
    @Body() body: SelcomPushRequest,
  ) {
    return this.paymentsService.startSelcomPush(user, body ?? ({} as SelcomPushRequest));
  }

  @Get("selcom/:orderId")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PermissionCode.POS_SELL)
  getSelcomIntent(
    @CurrentUser() user: RequestUser,
    @Param("orderId") orderId: string,
    @Query("refresh") refreshRaw?: string,
  ) {
    const refresh = refreshRaw !== "false";
    return this.paymentsService.getSelcomIntent(user, orderId, refresh);
  }

  @SkipThrottle()
  @Post("selcom/webhooks/checkout")
  checkoutWebhook(
    @Headers("authorization") authorization: string | undefined,
    @Headers("digest") digest: string | undefined,
    @Headers("timestamp") timestamp: string | undefined,
    @Headers("signed-fields") signedFields: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.paymentsService.handleCheckoutWebhook(
      { authorization, digest, timestamp, signedFields },
      body ?? {},
    );
  }
}
