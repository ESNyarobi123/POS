/** JWT claims embedded in access tokens. */
export type JwtPayload = {
  sub: string;
  orgId: string;
  email: string;
  roles: string[];
  permissions: string[];
  branchIds: string[];
};

export type SignJwtOptions = {
  secret: string;
  expiresIn?: string;
};
