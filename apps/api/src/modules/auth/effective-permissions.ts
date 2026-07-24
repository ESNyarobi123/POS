export type PermissionOverride = {
  effect: "GRANT" | "DENY";
  permission: { code: string };
};

/**
 * Effective permissions at login /me:
 *   rolePermissions ∪ userGrants − userDenies
 */
export function computeEffectivePermissions(
  rolePermissionCodes: string[],
  overrides: PermissionOverride[],
): {
  rolePermissions: string[];
  grants: string[];
  denies: string[];
  effective: string[];
} {
  const rolePermissions = [...new Set(rolePermissionCodes)].sort();
  const grants = [
    ...new Set(
      overrides
        .filter((o) => o.effect === "GRANT")
        .map((o) => o.permission.code),
    ),
  ].sort();
  const denies = [
    ...new Set(
      overrides
        .filter((o) => o.effect === "DENY")
        .map((o) => o.permission.code),
    ),
  ].sort();

  const denySet = new Set(denies);
  const effective = [
    ...new Set([...rolePermissions, ...grants].filter((c) => !denySet.has(c))),
  ].sort();

  return { rolePermissions, grants, denies, effective };
}
