import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { OrganizationModule } from "./modules/organization/organization.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { PosModule } from "./modules/pos/pos.module";
import { PurchasingModule } from "./modules/purchasing/purchasing.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { ReportingModule } from "./modules/reporting/reporting.module";
import { IntegrationsModule } from "./modules/integrations/integrations.module";
import { FiscalModule } from "./modules/fiscal/fiscal.module";
import { WarrantyModule } from "./modules/warranty/warranty.module";
import { AuditModule } from "./modules/audit/audit.module";
import { PrintingModule } from "./modules/printing/printing.module";

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuditModule,
    AuthModule,
    OrganizationModule,
    CatalogModule,
    InventoryModule,
    PosModule,
    PurchasingModule,
    CustomersModule,
    PaymentsModule,
    ReportingModule,
    IntegrationsModule,
    FiscalModule,
    WarrantyModule,
    PrintingModule,
  ],
})
export class AppModule {}
