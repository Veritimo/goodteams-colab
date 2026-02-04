/**
 * Session Cleanup Script
 *
 * Removes expired sessions from the database.
 * Can be run as a cron job or scheduled task.
 *
 * Usage:
 *   npx tsx src/platform/session/cleanup.ts
 *
 * Or programmatically:
 *   import { runCleanup } from './cleanup.js';
 *   await runCleanup();
 */

import { prisma } from "../db/index.js";
import { cleanupExpiredSessions } from "./service.js";

export async function runCleanup(): Promise<{ deleted: number }> {
  console.log("[session-cleanup] Starting session cleanup...");
  const startTime = Date.now();

  try {
    const deleted = await cleanupExpiredSessions();
    const duration = Date.now() - startTime;

    console.log(
      `[session-cleanup] Cleanup complete: ${deleted} expired session(s) removed in ${duration}ms`,
    );

    return { deleted };
  } catch (error) {
    console.error("[session-cleanup] Cleanup failed:", error);
    throw error;
  }
}

// CLI entry point
const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("cleanup.ts") ||
  process.argv[1]?.endsWith("cleanup.js");

if (isMain) {
  runCleanup()
    .then(({ deleted }) => {
      console.log(`[session-cleanup] Done. Removed ${deleted} session(s).`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("[session-cleanup] Fatal error:", err);
      process.exit(1);
    })
    .finally(() => {
      // Ensure Prisma connection is closed
      prisma.$disconnect();
    });
}
