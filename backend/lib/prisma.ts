import { PrismaClient } from "@prisma/client";

/**
 * Singleton Prisma client. In development, ts-node-dev respawns the process so a
 * plain module-level singleton is sufficient; the global guard avoids exhausting
 * connections under hot reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
