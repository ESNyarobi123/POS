import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { verifyAccessToken } from "@gulio/auth";
import { getEnv } from "@gulio/config";
import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthenticatedRequest, RequestUser } from "../types/request-user";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const value = Array.isArray(header) ? header[0] : header;
    if (!value?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing Bearer token");
    }

    const token = value.slice("Bearer ".length).trim();
    if (!token) {
      throw new UnauthorizedException("Missing Bearer token");
    }

    let payload: Awaited<ReturnType<typeof verifyAccessToken>>;
    try {
      const { JWT_SECRET } = getEnv();
      payload = await verifyAccessToken(token, JWT_SECRET);
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const row = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { isActive: true, deletedAt: true, organizationId: true },
    });
    if (
      !row ||
      !row.isActive ||
      row.deletedAt ||
      row.organizationId !== payload.orgId
    ) {
      throw new UnauthorizedException(
        "Account is disabled. Contact your owner or manager.",
      );
    }

    const user: RequestUser = {
      userId: payload.sub,
      organizationId: payload.orgId,
      email: payload.email,
      roles: payload.roles,
      permissions: payload.permissions,
      branchIds: payload.branchIds,
    };
    request.user = user;
    return true;
  }
}
