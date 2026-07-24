import { Controller, Get, UseGuards } from "@nestjs/common";
import type { OrganizationContextResponse } from "@gulio/contracts";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
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
}
