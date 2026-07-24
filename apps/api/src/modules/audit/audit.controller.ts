import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from "@nestjs/common";
import { PermissionCode } from "@gulio/contracts";
import type { AuditLogListResponse } from "@gulio/contracts";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import type { RequestUser } from "../auth/types/request-user";
import { AuditService } from "./audit.service";

@Controller("audit-logs")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Permissions(PermissionCode.AUDIT_VIEW)
  list(
    @CurrentUser() user: RequestUser,
    @Query("limit") limitRaw?: string,
  ): Promise<AuditLogListResponse> {
    let limit = 50;
    if (limitRaw !== undefined && limitRaw !== "") {
      const parsed = Number.parseInt(limitRaw, 10);
      if (Number.isNaN(parsed)) {
        throw new BadRequestException("limit must be an integer");
      }
      limit = parsed;
    }
    return this.auditService.listRecent(user.organizationId, limit);
  }
}
