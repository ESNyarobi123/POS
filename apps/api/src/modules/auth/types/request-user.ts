/**
 * Authenticated request context attached by JwtAuthGuard.
 */
export type RequestUser = {
  userId: string;
  organizationId: string;
  email: string;
  roles: string[];
  permissions: string[];
  branchIds: string[];
};

export type AuthenticatedRequest = {
  user: RequestUser;
  headers: Record<string, string | string[] | undefined>;
};
