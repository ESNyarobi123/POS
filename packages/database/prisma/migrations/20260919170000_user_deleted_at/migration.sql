-- Soft-delete employees so sales FKs stay intact and the email can be reused.
ALTER TABLE "users" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);

CREATE INDEX "users_organization_id_deleted_at_idx" ON "users"("organization_id", "deleted_at");
