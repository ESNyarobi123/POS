-- Live IMEI uniqueness: REMOVED tombstones keep history but free the serial
-- so the same number can be added again on another product / receive.

DROP INDEX IF EXISTS "serial_units_organization_id_serial_number_key";

CREATE UNIQUE INDEX "serial_units_org_live_serial_number_key"
  ON "serial_units" ("organization_id", "serial_number")
  WHERE "status" <> 'REMOVED';
