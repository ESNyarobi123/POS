import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";

/** Require one or more role codes (any match, case-insensitive). */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
