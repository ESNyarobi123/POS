-- Persist catalog list price on each sale line so negotiations never rewrite catalog.
ALTER TABLE "sale_items" ADD COLUMN "list_unit_price" DECIMAL(19,4);

UPDATE "sale_items" SET "list_unit_price" = "unit_price" WHERE "list_unit_price" IS NULL;

ALTER TABLE "sale_items" ALTER COLUMN "list_unit_price" SET NOT NULL;
