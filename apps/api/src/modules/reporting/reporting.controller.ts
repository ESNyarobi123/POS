import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseEnumPipe,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { DASHBOARD_RANGES, PermissionCode } from "@gulio/contracts";
import type {
  DashboardRangeKey,
  DashboardSummaryResponse,
} from "@gulio/contracts";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import type { RequestUser } from "../auth/types/request-user";
import { ReportingService } from "./reporting.service";

@Controller("reporting")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get("dashboard")
  @Permissions(PermissionCode.REPORTS_VIEW)
  getDashboard(
    @CurrentUser() user: RequestUser,
    @Query(
      "range",
      new DefaultValuePipe("7d"),
      new ParseEnumPipe(DASHBOARD_RANGES),
    )
    range: DashboardRangeKey,
    @Query("branchId", new ParseUUIDPipe({ optional: true }))
    branchId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ): Promise<DashboardSummaryResponse> {
    return this.reportingService.getDashboard(user, {
      range,
      branchId,
      from,
      to,
    });
  }
}
