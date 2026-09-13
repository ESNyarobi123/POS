import { Module } from "@nestjs/common";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
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
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== "production"
            ? { target: "pino-pretty" }
            : undefined,
      },
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100, // 100 requests per minute
    }]),
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
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
