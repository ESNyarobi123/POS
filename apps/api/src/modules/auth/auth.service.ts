import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from "@nestjs/common";
import { signAccessToken, verifyPassword } from "@gulio/auth";
import { getEnv } from "@gulio/config";
import type { AuthUserDto, LoginResponse, MeResponse } from "@gulio/contracts";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { computeEffectivePermissions } from "./effective-permissions";

type UserAuthRow = {
  id: string;
  email: string;
  fullName: string;
  organizationId: string;
  passwordHash: string;
  isActive: boolean;
  userRoles: Array<{
    role: {
      code: string;
      rolePermissions: Array<{ permission: { code: string } }>;
    };
  }>;
  userBranches: Array<{ branchId: string }>;
  userPermissions: Array<{
    effect: "GRANT" | "DENY";
    permission: { code: string };
  }>;
};

const userAuthInclude = {
  userRoles: {
    include: {
      role: {
        include: {
          rolePermissions: { include: { permission: true } },
        },
      },
    },
  },
  userBranches: true,
  userPermissions: { include: { permission: true } },
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponse> {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !password) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const user = await this.prisma.user.findFirst({
      where: { email: normalized },
      include: userAuthInclude,
    });

    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        "Account is locked. Contact your owner or manager.",
      );
    }

    const dto = this.toAuthUserDto(user);
    const { JWT_SECRET, JWT_EXPIRES_IN } = getEnv();
    const accessToken = await signAccessToken(
      {
        sub: dto.id,
        orgId: dto.organizationId,
        email: dto.email,
        roles: dto.roles,
        permissions: dto.permissions,
        branchIds: dto.branchIds,
      },
      { secret: JWT_SECRET, expiresIn: JWT_EXPIRES_IN },
    );

    await this.audit.log({
      action: "auth.login",
      entityType: "User",
      entityId: user.id,
      userId: user.id,
      orgId: user.organizationId,
      meta: { email: user.email },
    });

    return { accessToken, user: dto };
  }

  async me(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
        ...userAuthInclude,
        userBranches: {
          include: { branch: true },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new NotFoundException("User not found");
    }

    const dto = this.toAuthUserDto(user);
    return {
      user: dto,
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        slug: user.organization.slug,
        currencyCode: user.organization.currencyCode,
        timezone: user.organization.timezone,
      },
      branches: user.userBranches.map((ub) => ({
        id: ub.branch.id,
        name: ub.branch.name,
        code: ub.branch.code,
        isActive: ub.branch.isActive,
      })),
      permissions: dto.permissions,
    };
  }

  private toAuthUserDto(user: UserAuthRow): AuthUserDto {
    const roles = user.userRoles.map((ur) => ur.role.code);
    const rolePermissionCodes = user.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission.code),
    );
    const { effective } = computeEffectivePermissions(
      rolePermissionCodes,
      user.userPermissions,
    );
    const branchIds = user.userBranches.map((ub) => ub.branchId);

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      organizationId: user.organizationId,
      roles,
      permissions: effective,
      branchIds,
    };
  }
}
