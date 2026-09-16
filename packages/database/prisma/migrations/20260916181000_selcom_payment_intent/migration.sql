-- CreateEnum
CREATE TYPE "SelcomPaymentStatus" AS ENUM ('PENDING', 'PUSHED', 'COMPLETED', 'FAILED', 'CANCELLED', 'RECONCILE');

-- CreateTable
CREATE TABLE "selcom_payment_intents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "register_session_id" UUID NOT NULL,
    "cashier_user_id" UUID NOT NULL,
    "sale_id" UUID,
    "order_id" TEXT NOT NULL,
    "push_transid" TEXT NOT NULL,
    "msisdn" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'TZS',
    "status" "SelcomPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider_reference" TEXT,
    "provider_transid" TEXT,
    "channel" TEXT,
    "last_message" TEXT,
    "provider_payload" JSONB,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "selcom_payment_intents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "selcom_payment_intents_order_id_key" ON "selcom_payment_intents"("order_id");
CREATE UNIQUE INDEX "selcom_payment_intents_push_transid_key" ON "selcom_payment_intents"("push_transid");
CREATE INDEX "selcom_payment_intents_organization_id_status_idx" ON "selcom_payment_intents"("organization_id", "status");
CREATE INDEX "selcom_payment_intents_register_session_id_idx" ON "selcom_payment_intents"("register_session_id");

ALTER TABLE "selcom_payment_intents" ADD CONSTRAINT "selcom_payment_intents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "selcom_payment_intents" ADD CONSTRAINT "selcom_payment_intents_register_session_id_fkey" FOREIGN KEY ("register_session_id") REFERENCES "register_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "selcom_payment_intents" ADD CONSTRAINT "selcom_payment_intents_cashier_user_id_fkey" FOREIGN KEY ("cashier_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "selcom_payment_intents" ADD CONSTRAINT "selcom_payment_intents_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
