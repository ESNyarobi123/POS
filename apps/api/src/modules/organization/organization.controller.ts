import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { PermissionCode } from "@gulio/contracts";
import type {
  BranchDetailDto,
  BranchListResponse,
  CreateBranchRequest,
  CreateWarehouseRequest,
  OrganizationContextResponse,
  OrganizationSettingsDto,
  UpdateBranchRequest,
  UpdateOrganizationSettingsRequest,
  UpdateWarehouseRequest,
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

  @Get("branches")
  @UseGuards(PermissionsGuard)
  @Permissions(
    PermissionCode.ORG_MANAGE,
    PermissionCode.SETTINGS_MANAGE,
    PermissionCode.STOCK_VIEW,
  )
  async getBranches(
    @CurrentUser() user: RequestUser,
  ): Promise<BranchListResponse> {
    return this.organizationService.getBranches(user);
  }

  @Post("branches")
  @UseGuards(PermissionsGuard)
  @Permissions(PermissionCode.ORG_MANAGE, PermissionCode.SETTINGS_MANAGE)
  async createBranch(
    @CurrentUser() user: RequestUser,
    @Body() body: CreateBranchRequest,
  ): Promise<BranchDetailDto> {
    return this.organizationService.createBranch(user, body);
  }

  @Patch("branches/:id")
  @UseGuards(PermissionsGuard)
  @Permissions(PermissionCode.ORG_MANAGE, PermissionCode.SETTINGS_MANAGE)
  async updateBranch(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() body: UpdateBranchRequest,
  ): Promise<BranchDetailDto> {
    return this.organizationService.updateBranch(user, id, body);
  }

  @Post("warehouses")
  @UseGuards(PermissionsGuard)
  @Permissions(
    PermissionCode.ORG_MANAGE,
    PermissionCode.SETTINGS_MANAGE,
    PermissionCode.STOCK_ADJUST,
  )
  async createWarehouse(
    @CurrentUser() user: RequestUser,
    @Body() body: CreateWarehouseRequest,
  ): Promise<{ id: string; branchId: string; name: string; isDefault: boolean }> {
    return this.organizationService.createWarehouse(user, body);
  }

  @Patch("warehouses/:id")
  @UseGuards(PermissionsGuard)
  @Permissions(
    PermissionCode.ORG_MANAGE,
    PermissionCode.SETTINGS_MANAGE,
    PermissionCode.STOCK_ADJUST,
  )
  async updateWarehouse(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() body: UpdateWarehouseRequest,
  ): Promise<{ id: string; branchId: string; name: string; isDefault: boolean }> {
    return this.organizationService.updateWarehouse(user, id, body);
  }

  @Delete("warehouses/:id")
  @UseGuards(PermissionsGuard)
  @Permissions(
    PermissionCode.ORG_MANAGE,
    PermissionCode.SETTINGS_MANAGE,
  )
  async deleteWarehouse(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.organizationService.deleteWarehouse(user, id);
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
