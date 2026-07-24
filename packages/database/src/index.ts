/**
 * @gulio/database — Prisma client singleton.
 * Run `pnpm --filter @gulio/database generate` before typecheck/build.
 */

import { PrismaClient } from "@prisma/client";

export { PrismaClient };
export * from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/** Shared Prisma client singleton (avoids exhausting connections in watch mode). */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
