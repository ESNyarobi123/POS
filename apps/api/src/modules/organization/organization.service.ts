import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@gulio/database";
import type {
  BranchDetailDto,
  BranchListResponse,
  CreateBranchRequest,
  CreateWarehouseRequest,
  UpdateWarehouseRequest,
  OrganizationContextResponse,
  OrganizationSettingsDto,
  UpdateBranchRequest,
  UpdateOrganizationSettingsRequest,
} from "@gulio/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../auth/types/request-user";
import {
  mergePriceOverridePolicy,
  parsePriceOverridePolicy,
} from "../pos/price-override.policy";
import {
  mergeSelcomSettings,
  parseStoredSelcomSettings,
  redactSettingsForAudit as redactSelcomForAudit,
  toSelcomAdminSettings,
  toSelcomPublicStatus,
} from "../integrations/selcom/selcom.settings";
import {
  mergeOpticEdgeSettings,
  parseStoredOpticEdgeSettings,
  redactOpticEdgeForAudit,
  toOpticEdgeAdminSettings,
  toOpticEdgePublicStatus,
} from "../integrations/opticedge/opticedge.settings";

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
      settings: {
        priceOverride: parsePriceOverridePolicy(organization.settings),
        selcom: toSelcomPublicStatus(
          parseStoredSelcomSettings(organization.settings),
        ),
        opticedge: toOpticEdgePublicStatus(
          parseStoredOpticEdgeSettings(organization.settings),
        ),
      },
    };
  }

  async getSettings(user: RequestUser): Promise<OrganizationSettingsDto> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { settings: true },
    });
    if (!organization) {
      throw new NotFoundException("Organization not found");
    }
    return {
      priceOverride: parsePriceOverridePolicy(organization.settings),
      selcom: toSelcomAdminSettings(
        parseStoredSelcomSettings(organization.settings),
      ),
      opticedge: toOpticEdgeAdminSettings(
        parseStoredOpticEdgeSettings(organization.settings),
      ),
    };
  }

  async updateSettings(
    user: RequestUser,
    body: UpdateOrganizationSettingsRequest,
  ): Promise<OrganizationSettingsDto> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { id: true, settings: true },
    });
    if (!organization) {
      throw new NotFoundException("Organization not found");
    }
    if (body.priceOverride?.cashierMaxPercentBelowList !== undefined) {
      const n = Number(body.priceOverride.cashierMaxPercentBelowList);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        throw new BadRequestException(
          "cashierMaxPercentBelowList must be between 0 and 100",
        );
      }
    }

    let nextSettings = mergePriceOverridePolicy(
      organization.settings,
      body.priceOverride,
    );
    if (body.selcom) {
      nextSettings = mergeSelcomSettings(nextSettings, body.selcom);
    }
    if (body.opticedge) {
      nextSettings = mergeOpticEdgeSettings(nextSettings, body.opticedge);
    }
    const updated = await this.prisma.organization.update({
      where: { id: organization.id },
      data: { settings: nextSettings as Prisma.InputJsonValue },
      select: { settings: true },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        actorUserId: user.userId,
        action: "org.settings.update",
        entityType: "Organization",
        entityId: organization.id,
        beforeJson: {
          settings: redactAllSettings(
            organization.settings,
          ) as Prisma.InputJsonValue,
        },
        afterJson: {
          settings: redactAllSettings(
            updated.settings,
          ) as Prisma.InputJsonValue,
        },
      },
    });

    return {
      priceOverride: parsePriceOverridePolicy(updated.settings),
      selcom: toSelcomAdminSettings(parseStoredSelcomSettings(updated.settings)),
      opticedge: toOpticEdgeAdminSettings(
        parseStoredOpticEdgeSettings(updated.settings),
      ),
    };
  }

  async getBranches(user: RequestUser): Promise<BranchListResponse> {
    const branches = await this.prisma.branch.findMany({
      where: { organizationId: user.organizationId },
      include: {
        warehouses: {
          orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        },
        registers: {
          orderBy: { code: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    return {
      branches: branches.map((b) => ({
        id: b.id,
        name: b.name,
        code: b.code,
        isActive: b.isActive,
        createdAt: b.createdAt.toISOString(),
        warehouses: b.warehouses.map((w) => ({
          id: w.id,
          branchId: w.branchId,
          name: w.name,
          isDefault: w.isDefault,
          createdAt: w.createdAt.toISOString(),
        })),
        registers: b.registers.map((r) => ({
          id: r.id,
          branchId: r.branchId,
          name: r.name,
          code: r.code,
          isActive: r.isActive,
        })),
      })),
    };
  }

  async createBranch(
    user: RequestUser,
    body: CreateBranchRequest,
  ): Promise<BranchDetailDto> {
    const name = body.name?.trim();
    const code = body.code?.trim().toUpperCase();
    if (!name) {
      throw new BadRequestException("Branch name is required");
    }
    if (!code) {
      throw new BadRequestException("Branch code is required");
    }

    const existing = await this.prisma.branch.findFirst({
      where: { organizationId: user.organizationId, code },
    });
    if (existing) {
      throw new BadRequestException(`Branch code "${code}" already exists`);
    }

    const initialWarehouseName =
      body.initialWarehouseName?.trim() || `${name} Default`;

    const branch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.branch.create({
        data: {
          organizationId: user.organizationId,
          name,
          code,
          isActive: body.isActive ?? true,
        },
      });

      const warehouse = await tx.warehouse.create({
        data: {
          organizationId: user.organizationId,
          branchId: created.id,
          name: initialWarehouseName,
          isDefault: true,
        },
      });

      // Grant access to creator
      await tx.userBranch.upsert({
        where: {
          userId_branchId: {
            userId: user.userId,
            branchId: created.id,
          },
        },
        create: {
          userId: user.userId,
          branchId: created.id,
        },
        update: {},
      });

      return { ...created, warehouses: [warehouse], registers: [] };
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        actorUserId: user.userId,
        action: "branch.create",
        entityType: "Branch",
        entityId: branch.id,
        afterJson: { name, code, warehouseName: initialWarehouseName },
      },
    });

    return {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      isActive: branch.isActive,
      createdAt: branch.createdAt.toISOString(),
      warehouses: branch.warehouses.map((w) => ({
        id: w.id,
        branchId: w.branchId,
        name: w.name,
        isDefault: w.isDefault,
        createdAt: w.createdAt.toISOString(),
      })),
      registers: [],
    };
  }

  async updateBranch(
    user: RequestUser,
    branchId: string,
    body: UpdateBranchRequest,
  ): Promise<BranchDetailDto> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId: user.organizationId },
    });
    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    const data: Prisma.BranchUpdateInput = {};
    if (body.name?.trim()) data.name = body.name.trim();
    if (body.code?.trim()) {
      const code = body.code.trim().toUpperCase();
      const existing = await this.prisma.branch.findFirst({
        where: {
          organizationId: user.organizationId,
          code,
          NOT: { id: branchId },
        },
      });
      if (existing) {
        throw new BadRequestException(`Branch code "${code}" already exists`);
      }
      data.code = code;
    }
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const updated = await this.prisma.branch.update({
      where: { id: branchId },
      data,
      include: {
        warehouses: {
          orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        },
        registers: {
          orderBy: { code: "asc" },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        actorUserId: user.userId,
        action: "branch.update",
        entityType: "Branch",
        entityId: branchId,
        beforeJson: { name: branch.name, code: branch.code, isActive: branch.isActive },
        afterJson: { name: updated.name, code: updated.code, isActive: updated.isActive },
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      code: updated.code,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      warehouses: updated.warehouses.map((w) => ({
        id: w.id,
        branchId: w.branchId,
        name: w.name,
        isDefault: w.isDefault,
        createdAt: w.createdAt.toISOString(),
      })),
      registers: updated.registers.map((r) => ({
        id: r.id,
        branchId: r.branchId,
        name: r.name,
        code: r.code,
        isActive: r.isActive,
      })),
    };
  }

  async createWarehouse(
    user: RequestUser,
    body: CreateWarehouseRequest,
  ): Promise<{ id: string; branchId: string; name: string; isDefault: boolean }> {
    const name = body.name?.trim();
    if (!name) {
      throw new BadRequestException("Warehouse name is required");
    }
    const branch = await this.prisma.branch.findFirst({
      where: { id: body.branchId, organizationId: user.organizationId },
    });
    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    const warehouse = await this.prisma.$transaction(async (tx) => {
      if (body.isDefault) {
        await tx.warehouse.updateMany({
          where: { branchId: body.branchId },
          data: { isDefault: false },
        });
      }
      return tx.warehouse.create({
        data: {
          organizationId: user.organizationId,
          branchId: body.branchId,
          name,
          isDefault: body.isDefault ?? false,
        },
      });
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        actorUserId: user.userId,
        action: "warehouse.create",
        entityType: "Warehouse",
        entityId: warehouse.id,
        afterJson: { name, branchId: body.branchId, isDefault: warehouse.isDefault },
      },
    });

    return {
      id: warehouse.id,
      branchId: warehouse.branchId,
      name: warehouse.name,
      isDefault: warehouse.isDefault,
    };
  }

  async updateWarehouse(
    user: RequestUser,
    id: string,
    body: UpdateWarehouseRequest,
  ): Promise<{ id: string; branchId: string; name: string; isDefault: boolean }> {
    const existing = await this.prisma.warehouse.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) {
      throw new NotFoundException("Warehouse not found");
    }

    const targetBranchId = body.branchId ? body.branchId : existing.branchId;
    if (body.branchId && body.branchId !== existing.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: body.branchId, organizationId: user.organizationId },
      });
      if (!branch) {
        throw new NotFoundException("Target branch not found");
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (body.isDefault) {
        await tx.warehouse.updateMany({
          where: { branchId: targetBranchId },
          data: { isDefault: false },
        });
      }

      return tx.warehouse.update({
        where: { id },
        data: {
          ...(body.name?.trim() ? { name: body.name.trim() } : {}),
          ...(body.branchId ? { branchId: body.branchId } : {}),
          ...(typeof body.isDefault === "boolean" ? { isDefault: body.isDefault } : {}),
        },
      });
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        actorUserId: user.userId,
        action: "warehouse.update",
        entityType: "Warehouse",
        entityId: updated.id,
        beforeJson: { name: existing.name, branchId: existing.branchId, isDefault: existing.isDefault },
        afterJson: { name: updated.name, branchId: updated.branchId, isDefault: updated.isDefault },
      },
    });

    return {
      id: updated.id,
      branchId: updated.branchId,
      name: updated.name,
      isDefault: updated.isDefault,
    };
  }

  async deleteWarehouse(
    user: RequestUser,
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.warehouse.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        _count: {
          select: {
            stockMovements: true,
            sales: true,
          },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException("Warehouse not found");
    }

    const branchWarehousesCount = await this.prisma.warehouse.count({
      where: { branchId: existing.branchId },
    });
    if (branchWarehousesCount <= 1 && existing.isDefault) {
      throw new BadRequestException(
        "Cannot remove the only warehouse of this branch. Create another warehouse first or reassign it.",
      );
    }

    if (existing._count.stockMovements > 0 || existing._count.sales > 0) {
      throw new BadRequestException(
        "Cannot delete a warehouse with recorded stock movements or sales. Please reassign it to another branch instead.",
      );
    }

    await this.prisma.warehouse.delete({
      where: { id },
    });

    if (existing.isDefault) {
      const nextWh = await this.prisma.warehouse.findFirst({
        where: { branchId: existing.branchId },
        orderBy: { createdAt: "asc" },
      });
      if (nextWh) {
        await this.prisma.warehouse.update({
          where: { id: nextWh.id },
          data: { isDefault: true },
        });
      }
    }

    await this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        actorUserId: user.userId,
        action: "warehouse.delete",
        entityType: "Warehouse",
        entityId: id,
        beforeJson: { name: existing.name, branchId: existing.branchId },
      },
    });

    return { success: true, message: `Warehouse ${existing.name} removed successfully` };
  }
}

function redactAllSettings(settings: unknown): unknown {
  return redactOpticEdgeForAudit(redactSelcomForAudit(settings));
}
