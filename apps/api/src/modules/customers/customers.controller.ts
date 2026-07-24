import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { PermissionCode } from "@gulio/contracts";
import type {
  CustomerDetailDto,
  CustomerListResponse,
} from "@gulio/contracts";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import type { RequestUser } from "../auth/types/request-user";
import { CustomersService } from "./customers.service";

@Controller("customers")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Permissions(PermissionCode.CUSTOMERS_MANAGE)
  listCustomers(
    @CurrentUser() user: RequestUser,
    @Query("q") q?: string,
    @Query("limit") limitRaw?: string,
  ): Promise<CustomerListResponse> {
    let limit: number | undefined;
    if (limitRaw !== undefined && limitRaw !== "") {
      const parsed = Number.parseInt(limitRaw, 10);
      if (Number.isNaN(parsed)) {
        throw new BadRequestException("limit must be an integer");
      }
      limit = parsed;
    }
    return this.customersService.listCustomers(user.organizationId, {
      q,
      limit,
    });
  }

  @Get(":id")
  @Permissions(PermissionCode.CUSTOMERS_MANAGE)
  getCustomer(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<CustomerDetailDto> {
    return this.customersService.getCustomerById(user.organizationId, id);
  }
}
