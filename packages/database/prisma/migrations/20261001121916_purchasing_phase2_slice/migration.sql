-- CreateEnum
CREATE TYPE "GoodsReceiptStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupplierPaymentMethod" AS ENUM ('CASH', 'MOBILE_MONEY_MANUAL', 'CARD', 'BANK_TRANSFER', 'OTHER');

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "supplier_id" UUID,
    "invoice_number" TEXT,
    "status" "GoodsReceiptStatus" NOT NULL DEFAULT 'POSTED',
    "reason" TEXT,
    "notes" TEXT,
    "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "received_by_user_id" UUID NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unit_cost" DECIMAL(19,4) NOT NULL,
    "retail_price" DECIMAL(19,4) NOT NULL,
    "line_total" DECIMAL(19,4) NOT NULL,
    "tracks_serial" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_serials" (
    "receipt_line_id" UUID NOT NULL,
    "serial_unit_id" UUID NOT NULL,

    CONSTRAINT "goods_receipt_serials_pkey" PRIMARY KEY ("receipt_line_id","serial_unit_id")
);

-- CreateTable
CREATE TABLE "supplier_payments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "receipt_id" UUID,
    "amount" DECIMAL(19,4) NOT NULL,
    "method" "SupplierPaymentMethod" NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "paid_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suppliers_organization_id_idx" ON "suppliers"("organization_id");

-- CreateIndex
CREATE INDEX "suppliers_organization_id_is_active_idx" ON "suppliers"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_organization_id_name_key" ON "suppliers"("organization_id", "name");

-- CreateIndex
CREATE INDEX "goods_receipts_organization_id_received_at_idx" ON "goods_receipts"("organization_id", "received_at");

-- CreateIndex
CREATE INDEX "goods_receipts_branch_id_idx" ON "goods_receipts"("branch_id");

-- CreateIndex
CREATE INDEX "goods_receipts_supplier_id_idx" ON "goods_receipts"("supplier_id");

-- CreateIndex
CREATE INDEX "goods_receipts_warehouse_id_idx" ON "goods_receipts"("warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_organization_id_invoice_number_key" ON "goods_receipts"("organization_id", "invoice_number");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_organization_id_idx" ON "goods_receipt_lines"("organization_id");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_receipt_id_idx" ON "goods_receipt_lines"("receipt_id");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_variant_id_idx" ON "goods_receipt_lines"("variant_id");

-- CreateIndex
CREATE INDEX "goods_receipt_serials_serial_unit_id_idx" ON "goods_receipt_serials"("serial_unit_id");

-- CreateIndex
CREATE INDEX "supplier_payments_organization_id_paid_at_idx" ON "supplier_payments"("organization_id", "paid_at");

-- CreateIndex
CREATE INDEX "supplier_payments_supplier_id_idx" ON "supplier_payments"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_payments_receipt_id_idx" ON "supplier_payments"("receipt_id");

-- CreateIndex
CREATE INDEX "serial_units_organization_id_serial_number_idx" ON "serial_units"("organization_id", "serial_number");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_received_by_user_id_fkey" FOREIGN KEY ("received_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_serials" ADD CONSTRAINT "goods_receipt_serials_receipt_line_id_fkey" FOREIGN KEY ("receipt_line_id") REFERENCES "goods_receipt_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_serials" ADD CONSTRAINT "goods_receipt_serials_serial_unit_id_fkey" FOREIGN KEY ("serial_unit_id") REFERENCES "serial_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "goods_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
