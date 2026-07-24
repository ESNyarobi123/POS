import { Injectable } from "@nestjs/common";
import type { AuditLogListResponse } from "@gulio/contracts";
import { Prisma } from "@gulio/database";
import { PrismaService } from "../../prisma/prisma.service";

export type AuditLogInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  userId?: string | null;
  orgId: string;
  meta?: Record<string, unknown> | null;
  before?: Record<string, unknown> | null;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        organizationId: input.orgId,
        actorUserId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        beforeJson:
          input.before === null || input.before === undefined
            ? undefined
            : (input.before as Prisma.InputJsonValue),
        afterJson:
          input.meta === null || input.meta === undefined
            ? undefined
            : (input.meta as Prisma.InputJsonValue),
      },
    });
  }

  async listRecent(
    organizationId: string,
    limit = 50,
  ): Promise<AuditLogListResponse> {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const logs = await this.prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: safeLimit,
    });

    return {
      limit: safeLimit,
      logs: logs.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        actorUserId: row.actorUserId,
        beforeJson: row.beforeJson,
        afterJson: row.afterJson,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }
}
