/**
 * Gateway Health Monitor
 *
 * Monitors gateway processes health and automatically restarts unhealthy ones.
 * Uses exponential backoff for repeated failures to prevent restart storms.
 */

import { prisma } from "../db/client.js";
import { restartGateway, getGatewayProcess, type GatewayStatus } from "./gateway-manager.js";

// Health check configuration
const HEALTH_CHECK_INTERVAL = 10_000; // 10 seconds
const MAX_CONSECUTIVE_FAILURES = 3;
const BASE_BACKOFF_MS = 30_000; // 30 seconds base backoff
const MAX_BACKOFF_MS = 300_000; // 5 minutes max backoff

// Track last restart times for exponential backoff
const lastRestartAttempts = new Map<string, { time: number; attempts: number }>();

// Health monitor interval reference
let healthMonitorInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the health monitor loop
 *
 * Runs every 10 seconds and checks all HEALTHY gateways
 */
export function startHealthMonitor(): void {
  if (healthMonitorInterval) {
    return; // Already running
  }

  healthMonitorInterval = setInterval(async () => {
    try {
      await runHealthChecks();
    } catch (error) {
      console.error("Health monitor error:", error);
    }
  }, HEALTH_CHECK_INTERVAL);
}

/**
 * Stop the health monitor loop
 */
export function stopHealthMonitor(): void {
  if (healthMonitorInterval) {
    clearInterval(healthMonitorInterval);
    healthMonitorInterval = null;
  }
}

/**
 * Check if health monitor is running
 */
export function isHealthMonitorRunning(): boolean {
  return healthMonitorInterval !== null;
}

/**
 * Run health checks for all gateways that should be healthy
 */
async function runHealthChecks(): Promise<void> {
  // Get all gateways that should be running (HEALTHY or STARTING status)
  const gateways = await prisma.tenantGateway.findMany({
    where: {
      status: { in: ["HEALTHY", "STARTING", "UNHEALTHY"] },
    },
  });

  for (const gateway of gateways) {
    try {
      const isHealthy = await checkGatewayHealth(gateway.organizationId);

      if (isHealthy) {
        // Reset failures on successful check
        if (gateway.consecutiveFailures > 0) {
          await prisma.tenantGateway.update({
            where: { organizationId: gateway.organizationId },
            data: {
              consecutiveFailures: 0,
              status: "HEALTHY",
              lastHealthCheck: new Date(),
            },
          });
        } else {
          await prisma.tenantGateway.update({
            where: { organizationId: gateway.organizationId },
            data: {
              status: "HEALTHY",
              lastHealthCheck: new Date(),
            },
          });
        }

        // Clear backoff tracking on success
        lastRestartAttempts.delete(gateway.organizationId);
      } else {
        // Increment failures
        const newFailures = gateway.consecutiveFailures + 1;

        await prisma.tenantGateway.update({
          where: { organizationId: gateway.organizationId },
          data: {
            consecutiveFailures: newFailures,
            status: newFailures >= MAX_CONSECUTIVE_FAILURES ? "UNHEALTHY" : gateway.status,
            lastHealthCheck: new Date(),
          },
        });

        // Check if we should restart
        if (newFailures >= MAX_CONSECUTIVE_FAILURES) {
          await handleUnhealthyGateway(gateway.organizationId);
        }
      }
    } catch (error) {
      console.error(`Health check error for org ${gateway.organizationId}:`, error);
    }
  }
}

/**
 * Check health of a specific gateway
 *
 * @param organizationId - The organization ID
 * @returns true if healthy, false otherwise
 */
export async function checkGatewayHealth(organizationId: string): Promise<boolean> {
  const gateway = await prisma.tenantGateway.findUnique({
    where: { organizationId },
  });

  if (!gateway) {
    return false;
  }

  // Check if process is running in-memory
  const process = getGatewayProcess(organizationId);
  if (!process) {
    return false;
  }

  // Check health endpoint
  try {
    const response = await fetch(`http://127.0.0.1:${gateway.port}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Handle an unhealthy gateway - restart with exponential backoff
 *
 * @param organizationId - The organization ID
 */
async function handleUnhealthyGateway(organizationId: string): Promise<void> {
  const now = Date.now();
  const restartInfo = lastRestartAttempts.get(organizationId);

  // Calculate backoff
  let backoffMs = BASE_BACKOFF_MS;
  if (restartInfo) {
    const attempts = restartInfo.attempts;
    backoffMs = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempts), MAX_BACKOFF_MS);

    // Check if we're still in backoff period
    const timeSinceLastRestart = now - restartInfo.time;
    if (timeSinceLastRestart < backoffMs) {
      // Still in backoff, don't restart yet
      return;
    }
  }

  // Attempt restart
  try {
    await restartGateway(organizationId);

    // Track restart attempt
    lastRestartAttempts.set(organizationId, {
      time: now,
      attempts: (restartInfo?.attempts ?? 0) + 1,
    });
  } catch (error) {
    console.error(`Failed to restart gateway for org ${organizationId}:`, error);

    // Still track the attempt for backoff
    lastRestartAttempts.set(organizationId, {
      time: now,
      attempts: (restartInfo?.attempts ?? 0) + 1,
    });
  }
}

/**
 * Get the current backoff time for a gateway (for testing/debugging)
 *
 * @param organizationId - The organization ID
 * @returns Backoff info or null if no backoff active
 */
export function getBackoffInfo(
  organizationId: string,
): { remainingMs: number; attempts: number } | null {
  const restartInfo = lastRestartAttempts.get(organizationId);
  if (!restartInfo) {
    return null;
  }

  const attempts = restartInfo.attempts;
  const backoffMs = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempts - 1), MAX_BACKOFF_MS);
  const elapsed = Date.now() - restartInfo.time;
  const remaining = Math.max(0, backoffMs - elapsed);

  return {
    remainingMs: remaining,
    attempts: restartInfo.attempts,
  };
}

/**
 * Clear backoff tracking for a gateway
 *
 * @param organizationId - The organization ID
 */
export function clearBackoff(organizationId: string): void {
  lastRestartAttempts.delete(organizationId);
}

/**
 * Manually trigger a health check for a specific gateway
 *
 * @param organizationId - The organization ID
 * @returns The updated gateway status
 */
export async function triggerHealthCheck(organizationId: string): Promise<GatewayStatus | null> {
  const isHealthy = await checkGatewayHealth(organizationId);

  const gateway = await prisma.tenantGateway.findUnique({
    where: { organizationId },
  });

  if (!gateway) return null;

  if (isHealthy) {
    await prisma.tenantGateway.update({
      where: { organizationId },
      data: {
        consecutiveFailures: 0,
        status: "HEALTHY",
        lastHealthCheck: new Date(),
      },
    });
    return "HEALTHY";
  } else {
    const newFailures = gateway.consecutiveFailures + 1;
    const newStatus = newFailures >= MAX_CONSECUTIVE_FAILURES ? "UNHEALTHY" : gateway.status;

    await prisma.tenantGateway.update({
      where: { organizationId },
      data: {
        consecutiveFailures: newFailures,
        status: newStatus,
        lastHealthCheck: new Date(),
      },
    });

    return newStatus as GatewayStatus;
  }
}

// Export for testing
export function _getLastRestartAttempts(): Map<string, { time: number; attempts: number }> {
  return lastRestartAttempts;
}

export function _clearLastRestartAttempts(): void {
  lastRestartAttempts.clear();
}

export const _constants = {
  HEALTH_CHECK_INTERVAL,
  MAX_CONSECUTIVE_FAILURES,
  BASE_BACKOFF_MS,
  MAX_BACKOFF_MS,
};
