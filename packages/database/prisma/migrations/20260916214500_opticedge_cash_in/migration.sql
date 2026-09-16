-- CreateEnum
CREATE TYPE "OpticEdgeCashInStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "opticedge_cash_ins" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "channel_id" INTEGER NOT NULL,
    "channel_name" TEXT NOT NULL,
    "channel_type" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "OpticEdgeCashInStatus" NOT NULL DEFAULT 'PENDING',
    "external_id" INTEGER,
    "replayed" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "request_json" JSONB,
    "response_json" JSONB,
    "sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "opticedge_cash_ins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "opticedge_cash_ins_sale_id_key" ON "opticedge_cash_ins"("sale_id");
CREATE UNIQUE INDEX "opticedge_cash_ins_organization_id_reference_key" ON "opticedge_cash_ins"("organization_id", "reference");
CREATE INDEX "opticedge_cash_ins_organization_id_status_idx" ON "opticedge_cash_ins"("organization_id", "status");

ALTER TABLE "opticedge_cash_ins" ADD CONSTRAINT "opticedge_cash_ins_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opticedge_cash_ins" ADD CONSTRAINT "opticedge_cash_ins_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
