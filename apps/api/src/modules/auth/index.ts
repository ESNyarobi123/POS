/**
 * Auth module public surface for other Nest modules.
 */
export { AuthModule } from "./auth.module";
export { AuthService } from "./auth.service";
export { computeEffectivePermissions } from "./effective-permissions";
export { JwtAuthGuard } from "./guards/jwt-auth.guard";
export { PermissionsGuard } from "./guards/permissions.guard";
export { Permissions } from "./decorators/permissions.decorator";
export { CurrentUser } from "./decorators/current-user.decorator";
export type { RequestUser, AuthenticatedRequest } from "./types/request-user";
