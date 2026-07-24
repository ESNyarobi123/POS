import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { hashPassword } from "@gulio/auth";
import type {
  AssignableRoleCode,
  CreateUserRequest,
  OrgUserDto,
  OrgUserListResponse,
  ReplaceUserPermissionsRequest,
  UpdateUserRequest,
  UserPermissionsResponse,
} from "@gulio/contracts";
import { UserPermissionEffect } from "@gulio/database";
import { AuditService } from "../audit/audit.service";
import { computeEffectivePermissions } from "../auth/effective-permissions";
import type { RequestUser } from "../auth/types/request-user";
import { PrismaService } from "../../prisma/prisma.service";

const ASSIGNABLE_ROLES = new Set<AssignableRoleCode>(["CASHIER", "MANAGER"]);

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: RequestUser): Promise<OrgUserListResponse> {
    const users = await this.prisma.user.findMany({
      where: { organizationId: actor.organizationId },
      include: {
        userRoles: { include: { role: true } },
        userBranches: true,
      },
      orderBy: [{ fullName: "asc" }, { email: "asc" }],
    });

    return { users: users.map((u) => this.toOrgUserDto(u)) };
  }

  async create(
    actor: RequestUser,
    body: CreateUserRequest,
  ): Promise<OrgUserDto> {
    const roleCode = this.normalizeAssignableRole(body.roleCode);
    this.assertCanAssignRole(actor, roleCode);

    const email = body.email?.trim().toLowerCase();
    const fullName = body.fullName?.trim();
    const password = body.password ?? "";

    if (!email || !fullName || password.length < 8) {
      throw new BadRequestException(
        "email, fullName, and password (min 8 chars) are required",
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: {
        organizationId_email: {
          organizationId: actor.organizationId,
          email,
        },
      },
    });
    if (existing) {
      throw new ConflictException("A user with this email already exists");
    }

    const role = await this.prisma.role.findUnique({
      where: {
        organizationId_code: {
          organizationId: actor.organizationId,
          code: roleCode,
        },
      },
    });
    if (!role) {
      throw new BadRequestException(`Role ${roleCode} is not configured`);
    }

    const branchIds =
      actor.branchIds.length > 0
        ? actor.branchIds
        : (
            await this.prisma.branch.findMany({
              where: { organizationId: actor.organizationId, isActive: true },
              select: { id: true },
              take: 1,
            })
          ).map((b) => b.id);

    const passwordHash = await hashPassword(password);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          organizationId: actor.organizationId,
          email,
          fullName,
          passwordHash,
          isActive: true,
          userRoles: { create: { roleId: role.id } },
          userBranches: {
            create: branchIds.map((branchId) => ({ branchId })),
          },
        },
        include: {
          userRoles: { include: { role: true } },
          userBranches: true,
        },
      });
      return created;
    });

    await this.audit.log({
      action: "user.create",
      entityType: "User",
      entityId: user.id,
      userId: actor.userId,
      orgId: actor.organizationId,
      meta: {
        email: user.email,
        fullName: user.fullName,
        roleCode,
      },
    });

    return this.toOrgUserDto(user);
  }

  async update(
    actor: RequestUser,
    userId: string,
    body: UpdateUserRequest,
  ): Promise<OrgUserDto> {
    const target = await this.findOrgUserOrThrow(actor.organizationId, userId);
    this.assertCanManageTarget(actor, target.roles);

    const data: {
      email?: string;
      fullName?: string;
    } = {};

    if (body.fullName !== undefined) {
      const fullName = body.fullName.trim();
      if (!fullName) {
        throw new BadRequestException("fullName cannot be empty");
      }
      data.fullName = fullName;
    }

    if (body.email !== undefined) {
      const email = body.email.trim().toLowerCase();
      if (!email) {
        throw new BadRequestException("email cannot be empty");
      }
      if (email !== target.email) {
        const clash = await this.prisma.user.findUnique({
          where: {
            organizationId_email: {
              organizationId: actor.organizationId,
              email,
            },
          },
        });
        if (clash) {
          throw new ConflictException("A user with this email already exists");
        }
      }
      data.email = email;
    }

    const nextRoleCode =
      body.roleCode !== undefined
        ? this.normalizeAssignableRole(body.roleCode)
        : undefined;

    if (nextRoleCode) {
      this.assertCanAssignRole(actor, nextRoleCode);
      // Assignable roles never include OWNER — demoting an OWNER must keep ≥1 owner.
      if (target.roles.includes("OWNER")) {
        await this.assertNotLastOwner(actor.organizationId, userId);
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data,
        include: {
          userRoles: { include: { role: true } },
          userBranches: true,
        },
      });

      if (nextRoleCode) {
        const role = await tx.role.findUnique({
          where: {
            organizationId_code: {
              organizationId: actor.organizationId,
              code: nextRoleCode,
            },
          },
        });
        if (!role) {
          throw new BadRequestException(`Role ${nextRoleCode} is not configured`);
        }

        await tx.userRole.deleteMany({ where: { userId } });
        await tx.userRole.create({
          data: { userId, roleId: role.id },
        });

        return tx.user.findUniqueOrThrow({
          where: { id: userId },
          include: {
            userRoles: { include: { role: true } },
            userBranches: true,
          },
        });
      }

      return user;
    });

    await this.audit.log({
      action: "user.update",
      entityType: "User",
      entityId: userId,
      userId: actor.userId,
      orgId: actor.organizationId,
      before: {
        email: target.email,
        fullName: target.fullName,
        roles: target.roles,
      },
      meta: {
        email: updated.email,
        fullName: updated.fullName,
        roles: updated.userRoles.map((ur) => ur.role.code),
        roleCode: nextRoleCode ?? null,
      },
    });

    return this.toOrgUserDto(updated);
  }

  async lock(actor: RequestUser, userId: string): Promise<OrgUserDto> {
    if (actor.userId === userId) {
      throw new ForbiddenException("You cannot lock your own account");
    }

    const target = await this.findOrgUserOrThrow(actor.organizationId, userId);
    this.assertCanManageTarget(actor, target.roles);

    if (!target.isActive) {
      return target;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
      include: {
        userRoles: { include: { role: true } },
        userBranches: true,
      },
    });

    await this.audit.log({
      action: "user.lock",
      entityType: "User",
      entityId: userId,
      userId: actor.userId,
      orgId: actor.organizationId,
      before: { isActive: true },
      meta: { isActive: false, email: updated.email },
    });

    return this.toOrgUserDto(updated);
  }

  async unlock(actor: RequestUser, userId: string): Promise<OrgUserDto> {
    const target = await this.findOrgUserOrThrow(actor.organizationId, userId);
    this.assertCanManageTarget(actor, target.roles);

    if (target.isActive) {
      return target;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
      include: {
        userRoles: { include: { role: true } },
        userBranches: true,
      },
    });

    await this.audit.log({
      action: "user.unlock",
      entityType: "User",
      entityId: userId,
      userId: actor.userId,
      orgId: actor.organizationId,
      before: { isActive: false },
      meta: { isActive: true, email: updated.email },
    });

    return this.toOrgUserDto(updated);
  }

  async getPermissions(
    actor: RequestUser,
    userId: string,
  ): Promise<UserPermissionsResponse> {
    const target = await this.findOrgUserOrThrow(actor.organizationId, userId);
    this.assertCanManageTarget(actor, target.roles);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
        userPermissions: { include: { permission: true } },
      },
    });

    const rolePermissionCodes = user.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission.code),
    );

    return computeEffectivePermissions(
      rolePermissionCodes,
      user.userPermissions,
    );
  }

  async replacePermissions(
    actor: RequestUser,
    userId: string,
    body: ReplaceUserPermissionsRequest,
  ): Promise<UserPermissionsResponse> {
    const target = await this.findOrgUserOrThrow(actor.organizationId, userId);
    this.assertCanManageTarget(actor, target.roles);

    const grants = this.normalizePermissionCodes(body.grants ?? []);
    const denies = this.normalizePermissionCodes(body.denies ?? []);
    const overlap = grants.filter((c) => denies.includes(c));
    if (overlap.length > 0) {
      throw new BadRequestException(
        `Permission cannot be both grant and deny: ${overlap.join(", ")}`,
      );
    }

    const allCodes = [...new Set([...grants, ...denies])];
    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: allCodes } },
    });
    const byCode = new Map(permissions.map((p) => [p.code, p.id]));
    const missing = allCodes.filter((c) => !byCode.has(c));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Unknown permission codes: ${missing.join(", ")}`,
      );
    }

    const before = await this.getPermissions(actor, userId);

    await this.prisma.$transaction(async (tx) => {
      await tx.userPermission.deleteMany({ where: { userId } });
      const rows = [
        ...grants.map((code) => ({
          organizationId: actor.organizationId,
          userId,
          permissionId: byCode.get(code)!,
          effect: UserPermissionEffect.GRANT,
        })),
        ...denies.map((code) => ({
          organizationId: actor.organizationId,
          userId,
          permissionId: byCode.get(code)!,
          effect: UserPermissionEffect.DENY,
        })),
      ];
      if (rows.length > 0) {
        await tx.userPermission.createMany({ data: rows });
      }
    });

    const after = await this.getPermissions(actor, userId);

    await this.audit.log({
      action: "user.permissions.update",
      entityType: "User",
      entityId: userId,
      userId: actor.userId,
      orgId: actor.organizationId,
      before: {
        grants: before.grants,
        denies: before.denies,
        effective: before.effective,
      },
      meta: {
        grants: after.grants,
        denies: after.denies,
        effective: after.effective,
      },
    });

    return after;
  }

  private normalizeAssignableRole(roleCode: string): AssignableRoleCode {
    const code = roleCode?.trim().toUpperCase() as AssignableRoleCode;
    if (!ASSIGNABLE_ROLES.has(code)) {
      throw new BadRequestException("roleCode must be CASHIER or MANAGER");
    }
    return code;
  }

  private normalizePermissionCodes(codes: string[]): string[] {
    return [
      ...new Set(
        codes
          .map((c) => c?.trim())
          .filter((c): c is string => Boolean(c)),
      ),
    ].sort();
  }

  private assertCanAssignRole(
    actor: RequestUser,
    roleCode: AssignableRoleCode,
  ): void {
    const isOwner = actor.roles.includes("OWNER");
    if (roleCode === "MANAGER" && !isOwner) {
      throw new ForbiddenException("Only OWNER can create or assign MANAGER");
    }
    if (roleCode === "CASHIER") {
      return;
    }
    if (roleCode === "MANAGER" && isOwner) {
      return;
    }
  }

  private assertCanManageTarget(
    actor: RequestUser,
    targetRoles: string[],
  ): void {
    const isOwner = actor.roles.includes("OWNER");
    if (isOwner) {
      return;
    }
    // Managers with users.manage may only manage cashiers.
    if (targetRoles.includes("OWNER") || targetRoles.includes("MANAGER")) {
      throw new ForbiddenException(
        "Managers can only manage cashier accounts",
      );
    }
  }

  private async assertNotLastOwner(
    organizationId: string,
    userId: string,
  ): Promise<void> {
    const owners = await this.prisma.userRole.findMany({
      where: {
        role: { organizationId, code: "OWNER" },
        user: { organizationId, isActive: true },
      },
      select: { userId: true },
    });
    const ownerIds = new Set(owners.map((o) => o.userId));
    if (ownerIds.size <= 1 && ownerIds.has(userId)) {
      throw new ForbiddenException("Cannot demote the last OWNER");
    }
  }

  private async findOrgUserOrThrow(
    organizationId: string,
    userId: string,
  ): Promise<OrgUserDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
      include: {
        userRoles: { include: { role: true } },
        userBranches: true,
      },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return this.toOrgUserDto(user);
  }

  private toOrgUserDto(user: {
    id: string;
    email: string;
    fullName: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    userRoles: Array<{ role: { code: string } }>;
    userBranches: Array<{ branchId: string }>;
  }): OrgUserDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      roles: user.userRoles.map((ur) => ur.role.code),
      branchIds: user.userBranches.map((ub) => ub.branchId),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
