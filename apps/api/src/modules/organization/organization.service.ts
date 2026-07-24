import { Injectable, NotFoundException } from "@nestjs/common";
import type { OrganizationContextResponse } from "@gulio/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../auth/types/request-user";

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async getContext(user: RequestUser): Promise<OrganizationContextResponse> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
    });

    if (!organization) {
      throw new NotFoundException("Organization not found");
    }

    const branchIds = user.branchIds;
    const branches = await this.prisma.branch.findMany({
      where: {
        organizationId: user.organizationId,
        id: { in: branchIds },
      },
      orderBy: { name: "asc" },
    });

    const warehouses = await this.prisma.warehouse.findMany({
      where: {
        organizationId: user.organizationId,
        branchId: { in: branchIds },
      },
      orderBy: { name: "asc" },
    });

    const registers = await this.prisma.register.findMany({
      where: {
        organizationId: user.organizationId,
        branchId: { in: branchIds },
      },
      orderBy: { code: "asc" },
    });

    return {
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        currencyCode: organization.currencyCode,
        timezone: organization.timezone,
      },
      branches: branches.map((b) => ({
        id: b.id,
        name: b.name,
        code: b.code,
        isActive: b.isActive,
      })),
      warehouses: warehouses.map((w) => ({
        id: w.id,
        branchId: w.branchId,
        name: w.name,
        isDefault: w.isDefault,
      })),
      registers: registers.map((r) => ({
        id: r.id,
        branchId: r.branchId,
        name: r.name,
        code: r.code,
        isActive: r.isActive,
      })),
    };
  }
}
