import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { JwtPayload, SignJwtOptions } from "./types";

const encoder = new TextEncoder();

function toKey(secret: string): Uint8Array {
  return encoder.encode(secret);
}

function asJwtPayload(payload: JWTPayload): JwtPayload {
  const sub = payload.sub;
  const orgId = payload.orgId;
  const email = payload.email;
  if (typeof sub !== "string" || typeof orgId !== "string" || typeof email !== "string") {
    throw new Error("Invalid JWT payload: missing sub, orgId, or email");
  }

  const roles = Array.isArray(payload.roles)
    ? payload.roles.filter((r): r is string => typeof r === "string")
    : [];
  const permissions = Array.isArray(payload.permissions)
    ? payload.permissions.filter((p): p is string => typeof p === "string")
    : [];
  const branchIds = Array.isArray(payload.branchIds)
    ? payload.branchIds.filter((b): b is string => typeof b === "string")
    : [];

  return { sub, orgId, email, roles, permissions, branchIds };
}

/** Sign an access token (HS256) using `JWT_SECRET`. */
export async function signAccessToken(
  payload: JwtPayload,
  options: SignJwtOptions,
): Promise<string> {
  const { secret, expiresIn = "8h" } = options;
  return new SignJWT({
    orgId: payload.orgId,
    email: payload.email,
    roles: payload.roles,
    permissions: payload.permissions,
    branchIds: payload.branchIds,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(toKey(secret));
}

/** Verify and decode an access token. Throws on invalid/expired tokens. */
export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, toKey(secret), {
    algorithms: ["HS256"],
  });
  return asJwtPayload(payload);
}
