import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient, Prisma } from "@gulio/database";

// List of models that belong to a tenant and have an organizationId column
const TENANT_MODELS = [
  "Branch", "Warehouse", "Register", "RegisterSession", "User", "Role",
  "UserPermission", "Brand", "Category", "Product", "Variant", "Barcode",
  "PriceHistory", "SerialUnit", "StockBalance", "StockMovement", "StockCount",
  "Customer", "Sale", "SaleItem", "Payment", "HeldSale", "Return", "AuditLog"
];

/** Nest-injectable Prisma client for API modules. */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Returns an extended Prisma client that automatically filters and injects 
   * the organizationId for all tenant-bound models. This prevents data leaks.
   */
  forTenant(organizationId: string) {
    return this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            // Apply tenant isolation only to tenant-bound models
            if (model && TENANT_MODELS.includes(model)) {
              const filterOperations = [
                'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 
                'findMany', 'count', 'aggregate', 'groupBy', 'update', 'updateMany', 
                'delete', 'deleteMany'
              ];
              
              const anyArgs = args as any;

              if (filterOperations.includes(operation)) {
                anyArgs.where = { ...anyArgs.where, organizationId };
              }
              
              if (operation === 'create' || operation === 'createMany') {
                if (Array.isArray(anyArgs.data)) {
                  anyArgs.data = anyArgs.data.map((d: any) => ({ ...d, organizationId }));
                } else if (anyArgs.data) {
                  anyArgs.data = { ...anyArgs.data, organizationId };
                }
              }
            }
            return query(args);
          },
        },
      },
    });
  }
}
