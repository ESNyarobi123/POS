import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { PermissionCode } from "@gulio/contracts";
import type {
  CreateUserRequest,
  OrgUserDto,
  OrgUserListResponse,
  ReplaceUserPermissionsRequest,
  UpdateUserRequest,
  UserPermissionsResponse,
} from "@gulio/contracts";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import type { RequestUser } from "../auth/types/request-user";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions(PermissionCode.USERS_MANAGE)
  list(@CurrentUser() user: RequestUser): Promise<OrgUserListResponse> {
    return this.usersService.list(user);
  }

  @Post()
  @Permissions(PermissionCode.USERS_MANAGE)
  create(
    @CurrentUser() user: RequestUser,
    @Body() body: CreateUserRequest,
  ): Promise<OrgUserDto> {
    return this.usersService.create(user, body);
  }

  @Patch(":id")
  @Permissions(PermissionCode.USERS_MANAGE)
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateUserRequest,
  ): Promise<OrgUserDto> {
    return this.usersService.update(user, id, body);
  }

  @Post(":id/lock")
  @Permissions(PermissionCode.USERS_MANAGE)
  lock(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<OrgUserDto> {
    return this.usersService.lock(user, id);
  }

  @Post(":id/unlock")
  @Permissions(PermissionCode.USERS_MANAGE)
  unlock(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<OrgUserDto> {
    return this.usersService.unlock(user, id);
  }

  @Get(":id/permissions")
  @Permissions(PermissionCode.USERS_MANAGE)
  getPermissions(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<UserPermissionsResponse> {
    return this.usersService.getPermissions(user, id);
  }

  @Put(":id/permissions")
  @Permissions(PermissionCode.USERS_MANAGE)
  replacePermissions(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: ReplaceUserPermissionsRequest,
  ): Promise<UserPermissionsResponse> {
    return this.usersService.replacePermissions(user, id, body);
  }
}
