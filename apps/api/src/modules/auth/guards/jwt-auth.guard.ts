import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { verifyAccessToken } from "@gulio/auth";
import { getEnv } from "@gulio/config";
import type { AuthenticatedRequest, RequestUser } from "../types/request-user";

@Injectable()
export class JwtAuthGuard implements CanActivate {
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

    try {
      const { JWT_SECRET } = getEnv();
      const payload = await verifyAccessToken(token, JWT_SECRET);
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
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
