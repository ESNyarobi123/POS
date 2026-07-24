/**
 * Phase 1 vertical-slice seed for GulioSmart POS.
 * Idempotent upserts where unique keys exist.
 *
 * Run: pnpm --filter @gulio/database db:seed
 *   or: pnpm --filter @gulio/database exec prisma db seed
 */

import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import bcrypt from "bcrypt";
import { PrismaClient, SerialStatus } from "@prisma/client";
import {
  SEED_BRANDS,
  SEED_CATALOG_PRODUCTS,
  SEED_CATEGORIES,
} from "./seed-catalog-data";

loadDotenv({ path: resolve(__dirname, "../../../.env") });

const prisma = new PrismaClient();

const PERMISSIONS: Array<{ code: string; description: string }> = [
  { code: "org.manage", description: "Manage organization, branches, warehouses" },
  { code: "registers.manage", description: "Manage registers and devices" },
  { code: "users.manage", description: "Manage users and roles" },
  { code: "audit.view", description: "View audit log" },
  { code: "shift.open_own", description: "Open/close own register shift" },
  { code: "shift.open_any", description: "Open/close any shift (override)" },
  { code: "pos.sell", description: "POS sell (cash / manual MM)" },
  { code: "pos.discount", description: "Apply discounts within policy" },
  { code: "pos.price_override", description: "Override line price" },
  { code: "pos.hold", description: "Hold / resume sale" },
  { code: "pos.void", description: "Void sale" },
  { code: "pos.return", description: "Process return / refund" },
  { code: "pos.large_refund", description: "Large refund (above threshold)" },
  { code: "pos.drawer_open", description: "Open cash drawer without sale" },
  { code: "catalog.view", description: "View catalog products/variants/prices" },
  { code: "catalog.manage", description: "Manage catalog products/variants/prices" },
  { code: "catalog.import", description: "CSV product import" },
  { code: "labels.print", description: "Print / request labels" },
  { code: "stock.view", description: "View stock balances" },
  { code: "stock.adjust", description: "Stock adjustment" },
  { code: "stock.serial_fix", description: "Serial reassignment / status fix" },
  { code: "stock.count", description: "Inventory count" },
  { code: "customers.manage", description: "Manage customers" },
  { code: "reports.view", description: "View reports" },
  { code: "settings.manage", description: "Org settings" },
];

const ALL_CODES = PERMISSIONS.map((p) => p.code);

const ROLE_PERMISSIONS: Record<string, string[]> = {
  OWNER: ALL_CODES,
  MANAGER: ALL_CODES.filter((c) => c !== "org.manage"),
  CASHIER: [
    "shift.open_own",
    "pos.sell",
    "pos.discount",
    "pos.price_override",
    "pos.hold",
    "pos.void",
    "pos.return",
    "pos.drawer_open",
    "catalog.view",
    "labels.print",
    "stock.view",
    "customers.manage",
    "reports.view",
  ],
};

const SEED_PASSWORD = "Password123!";

async function upsertPermission(code: string, description: string) {
  return prisma.permission.upsert({
    where: { code },
    create: { code, description },
    update: { description },
  });
}

async function main() {
  console.log("Seeding GulioSmart Phase 1 vertical slice...");

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  for (const p of PERMISSIONS) {
    await upsertPermission(p.code, p.description);
  }

  const org = await prisma.organization.upsert({
    where: { slug: "guliosmart" },
    create: {
      name: "GulioSmart",
      slug: "guliosmart",
      currencyCode: "TZS",
      timezone: "Africa/Dar_es_Salaam",
    },
    update: {
      name: "GulioSmart",
      currencyCode: "TZS",
    },
  });

  const branch = await prisma.branch.upsert({
    where: {
      organizationId_code: { organizationId: org.id, code: "MAIN" },
    },
    create: {
      organizationId: org.id,
      name: "Main Store",
      code: "MAIN",
      isActive: true,
    },
    update: { name: "Main Store", isActive: true },
  });

  let warehouse = await prisma.warehouse.findFirst({
    where: { organizationId: org.id, branchId: branch.id, isDefault: true },
  });
  if (!warehouse) {
    warehouse = await prisma.warehouse.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        name: "Main Store Default",
        isDefault: true,
      },
    });
  } else {
    warehouse = await prisma.warehouse.update({
      where: { id: warehouse.id },
      data: { name: "Main Store Default", isDefault: true },
    });
  }

  const register = await prisma.register.upsert({
    where: {
      organizationId_branchId_code: {
        organizationId: org.id,
        branchId: branch.id,
        code: "REG-1",
      },
    },
    create: {
      organizationId: org.id,
      branchId: branch.id,
      name: "Register 1",
      code: "REG-1",
      isActive: true,
    },
    update: { name: "Register 1", isActive: true },
  });

  const permissionRows = await prisma.permission.findMany();
  const permissionByCode = new Map(permissionRows.map((p) => [p.code, p.id]));

  const roles: Record<string, { id: string }> = {};
  for (const [code, name] of [
    ["OWNER", "Owner"],
    ["MANAGER", "Manager"],
    ["CASHIER", "Cashier"],
  ] as const) {
    const role = await prisma.role.upsert({
      where: {
        organizationId_code: { organizationId: org.id, code },
      },
      create: { organizationId: org.id, code, name },
      update: { name },
    });
    roles[code] = role;

    const codes = ROLE_PERMISSIONS[code] ?? [];
    for (const permCode of codes) {
      const permissionId = permissionByCode.get(permCode);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId },
        },
        create: { roleId: role.id, permissionId },
        update: {},
      });
    }
  }

  async function upsertUser(input: {
    email: string;
    fullName: string;
    roleCode: "OWNER" | "MANAGER" | "CASHIER";
  }) {
    const email = input.email.toLowerCase();
    const existing = await prisma.user.findUnique({
      where: {
        organizationId_email: { organizationId: org.id, email },
      },
    });

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            fullName: input.fullName,
            passwordHash,
            isActive: true,
          },
        })
      : await prisma.user.create({
          data: {
            organizationId: org.id,
            email,
            fullName: input.fullName,
            passwordHash,
            isActive: true,
          },
        });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: user.id, roleId: roles[input.roleCode].id },
      },
      create: { userId: user.id, roleId: roles[input.roleCode].id },
      update: {},
    });

    await prisma.userBranch.upsert({
      where: {
        userId_branchId: { userId: user.id, branchId: branch.id },
      },
      create: { userId: user.id, branchId: branch.id },
      update: {},
    });

    return user;
  }

  const owner = await upsertUser({
    email: "owner@guliosmart.local",
    fullName: "Gulio Owner",
    roleCode: "OWNER",
  });

  const manager = await upsertUser({
    email: "manager@guliosmart.local",
    fullName: "Gulio Manager",
    roleCode: "MANAGER",
  });

  const cashier = await upsertUser({
    email: "cashier@guliosmart.local",
    fullName: "Gulio Cashier",
    roleCode: "CASHIER",
  });

  const brandsByName = new Map<string, { id: string }>();
  for (const name of SEED_BRANDS) {
    const brand = await prisma.brand.upsert({
      where: {
        organizationId_name: { organizationId: org.id, name },
      },
      create: { organizationId: org.id, name },
      update: {},
    });
    brandsByName.set(name, brand);
  }

  const categoriesByName = new Map<string, { id: string }>();
  for (const name of SEED_CATEGORIES) {
    let category = await prisma.category.findFirst({
      where: { organizationId: org.id, name },
    });
    if (!category) {
      category = await prisma.category.create({
        data: { organizationId: org.id, name },
      });
    }
    categoriesByName.set(name, category);
  }

  for (const item of SEED_CATALOG_PRODUCTS) {
    const brandId = item.brand ? brandsByName.get(item.brand)?.id : undefined;
    const categoryId = categoriesByName.get(item.category)?.id;
    if (!categoryId) {
      throw new Error(`Missing seed category: ${item.category}`);
    }

    let product = await prisma.product.findFirst({
      where: { organizationId: org.id, name: item.productName },
    });
    if (!product) {
      product = await prisma.product.create({
        data: {
          organizationId: org.id,
          brandId: brandId ?? null,
          categoryId,
          name: item.productName,
          description: item.description ?? null,
          imageUrl: item.imageUrl,
          isActive: true,
        },
      });
    } else {
      product = await prisma.product.update({
        where: { id: product.id },
        data: {
          brandId: brandId ?? null,
          categoryId,
          description: item.description ?? null,
          imageUrl: item.imageUrl,
          isActive: true,
        },
      });
    }

    const variant = await prisma.variant.upsert({
      where: {
        organizationId_sku: { organizationId: org.id, sku: item.sku },
      },
      create: {
        organizationId: org.id,
        productId: product.id,
        sku: item.sku,
        name: item.variantName,
        attributes: item.attributes ?? {},
        sellPrice: item.sellPrice,
        costPrice: item.costPrice,
        tracksSerial: item.tracksSerial,
        isActive: true,
      },
      update: {
        productId: product.id,
        name: item.variantName,
        attributes: item.attributes ?? {},
        sellPrice: item.sellPrice,
        costPrice: item.costPrice,
        tracksSerial: item.tracksSerial,
        isActive: true,
      },
    });

    await prisma.barcode.upsert({
      where: {
        organizationId_value: {
          organizationId: org.id,
          value: item.barcode,
        },
      },
      create: {
        organizationId: org.id,
        variantId: variant.id,
        symbology: "CODE128",
        value: item.barcode,
        isPrimary: true,
      },
      update: {
        variantId: variant.id,
        isPrimary: true,
      },
    });

    const qty = `${item.stockQty}.0000`;
    await prisma.stockBalance.upsert({
      where: {
        warehouseId_variantId: {
          warehouseId: warehouse.id,
          variantId: variant.id,
        },
      },
      create: {
        organizationId: org.id,
        warehouseId: warehouse.id,
        variantId: variant.id,
        quantityOnHand: qty,
        quantityReserved: "0.0000",
      },
      update: {
        quantityOnHand: qty,
        quantityReserved: "0.0000",
      },
    });

    if (item.tracksSerial && item.serials?.length) {
      for (const serialNumber of item.serials) {
        await prisma.serialUnit.upsert({
          where: {
            organizationId_serialNumber: {
              organizationId: org.id,
              serialNumber,
            },
          },
          create: {
            organizationId: org.id,
            variantId: variant.id,
            warehouseId: warehouse.id,
            serialNumber,
            status: SerialStatus.IN_STOCK,
          },
          update: {
            variantId: variant.id,
            warehouseId: warehouse.id,
            status: SerialStatus.IN_STOCK,
          },
        });
      }
    }
  }

  const existingCustomer = await prisma.customer.findFirst({
    where: { organizationId: org.id, phone: "+255700000001" },
  });
  if (!existingCustomer) {
    await prisma.customer.create({
      data: {
        organizationId: org.id,
        name: "Sample Customer",
        phone: "+255700000001",
        email: "customer@example.com",
      },
    });
  }

  console.log("Seed complete.");
  console.log("Demo logins (password for all):", SEED_PASSWORD);
  console.log({
    organization: org.slug,
    branch: branch.code,
    register: register.code,
    warehouse: warehouse.name,
    catalogProducts: SEED_CATALOG_PRODUCTS.length,
    users: [
      { email: owner.email, role: "OWNER", password: SEED_PASSWORD },
      { email: manager.email, role: "MANAGER", password: SEED_PASSWORD },
      { email: cashier.email, role: "CASHIER", password: SEED_PASSWORD },
    ],
    notes: [
      "OWNER and MANAGER have users.manage + audit.view",
      "Effective permissions = rolePermissions ∪ userGrants − userDenies",
      "Locked users (isActive=false) cannot login",
    ],
  });
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
