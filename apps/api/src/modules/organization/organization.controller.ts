import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { PermissionCode } from "@gulio/contracts";
import type {
  OrganizationContextResponse,
  OrganizationSettingsDto,
  UpdateOrganizationSettingsRequest,
} from "@gulio/contracts";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import type { RequestUser } from "../auth/types/request-user";
import { OrganizationService } from "./organization.service";

@Controller("organization")
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get("context")
  async context(
    @CurrentUser() user: RequestUser,
  ): Promise<OrganizationContextResponse> {
    return this.organizationService.getContext(user);
  }

  @Get("settings")
  @UseGuards(PermissionsGuard)
  @Permissions(
    PermissionCode.SETTINGS_MANAGE,
    PermissionCode.POS_SELL,
    PermissionCode.ORG_MANAGE,
  )
  getSettings(
    @CurrentUser() user: RequestUser,
  ): Promise<OrganizationSettingsDto> {
    return this.organizationService.getSettings(user);
  }

  @Patch("settings")
  @UseGuards(PermissionsGuard)
  @Permissions(PermissionCode.SETTINGS_MANAGE)
  updateSettings(
    @CurrentUser() user: RequestUser,
    @Body() body: UpdateOrganizationSettingsRequest,
  ): Promise<OrganizationSettingsDto> {
    return this.organizationService.updateSettings(user, body ?? {});
  }
}
