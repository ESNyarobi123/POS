import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthenticatedRequest, RequestUser } from "../types/request-user";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
