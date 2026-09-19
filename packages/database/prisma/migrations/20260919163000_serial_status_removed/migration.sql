-- AlterEnum
ALTER TYPE "SerialStatus" ADD VALUE IF NOT EXISTS 'REMOVED';

-- Owner-only serial fix: revoke from MANAGER role grants (OWNER keeps it).
DELETE FROM "role_permissions" rp
USING "roles" r, "permissions" p
WHERE rp."role_id" = r."id"
  AND rp."permission_id" = p."id"
  AND r."code" = 'MANAGER'
  AND p."code" = 'stock.serial_fix';
