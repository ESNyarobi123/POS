import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@gulio/database";
import type {
  OrganizationContextResponse,
  OrganizationSettingsDto,
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
}

function redactAllSettings(settings: unknown): unknown {
  return redactOpticEdgeForAudit(redactSelcomForAudit(settings));
}
