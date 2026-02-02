/**
 * Prisma Client Singleton
 *
 * Ensures a single PrismaClient instance across the application.
 * In development with hot-reload, prevents multiple instances from being created.
 *
 * Usage:
 *   import { prisma } from '@/platform/db/client';
 *   const users = await prisma.user.findMany();
 */

import { PrismaClient } from "@prisma/client";

// Extend global type to include prisma instance
declare global {
  // eslint-disable-next-line no-var -- must use var for global augmentation
  var prisma: PrismaClient | undefined;
}

/**
 * Create a new PrismaClient instance with logging configuration
 */
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

/**
 * Singleton Prisma client instance
 *
 * In production: creates a new instance
 * In development: reuses existing instance to prevent connection pool exhaustion
 */
export const prisma: PrismaClient =
  globalThis.prisma ?? createPrismaClient();

// In development, store on globalThis to survive hot-reloads
if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

/**
 * Gracefully disconnect from the database
 * Call this during application shutdown
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Health check for database connectivity
 * Returns true if database is accessible, false otherwise
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
