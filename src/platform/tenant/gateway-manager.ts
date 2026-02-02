/**
 * Gateway Process Lifecycle Manager
 *
 * Manages spawning, stopping, and monitoring gateway processes for multi-tenant deployments.
 * Each organization gets its own isolated gateway process.
 */

import { spawn, ChildProcess } from "child_process";
import { prisma } from "../db/client.js";

// Re-export GatewayStatus enum for consumers
export type GatewayStatus =
  | "PROVISIONING"
  | "STARTING"
  | "HEALTHY"
  | "UNHEALTHY"
  | "STOPPING"
  | "STOPPED"
  | "FAILED";

export interface GatewayProcess {
  process: ChildProcess;
  port: number;
  organizationId: string;
  startedAt: Date;
}

export interface GatewayInfo {
  organizationId: string;
  port: number;
  status: GatewayStatus;
  pid: number | null;
  lastHealthCheck: Date | null;
  consecutiveFailures: number;
}

// In-memory tracking of running gateway processes
const runningGateways = new Map<string, GatewayProcess>();

// Default timeout for graceful shutdown (ms)
const GRACEFUL_SHUTDOWN_TIMEOUT = 10_000;

/**
 * Spawn a new gateway process for an organization
 *
 * @param organizationId - The organization ID to spawn gateway for
 * @throws Error if gateway record not found or in invalid state
 */
export async function spawnGateway(organizationId: string): Promise<void> {
  // 1. Get gateway record from DB
  const gateway = await prisma.tenantGateway.findUnique({
    where: { organizationId },
  });

  if (!gateway) {
    throw new Error(`Gateway not found for organization: ${organizationId}`);
  }

  // 2. Verify status allows spawning
  if (
    gateway.status !== "PROVISIONING" &&
    gateway.status !== "STOPPED" &&
    gateway.status !== "FAILED"
  ) {
    throw new Error(
      `Cannot spawn gateway in status: ${gateway.status}. Must be PROVISIONING, STOPPED, or FAILED.`,
    );
  }

  // Check if already running in-memory
  if (runningGateways.has(organizationId)) {
    throw new Error(`Gateway already running for organization: ${organizationId}`);
  }

  // 3. Spawn child process
  const childProcess = spawn(
    "openclaw",
    ["gateway", "run", "--config", gateway.configPath, "--port", String(gateway.port)],
    {
      detached: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        OPENCLAW_ORG_ID: organizationId,
      },
    },
  );

  // 4. Update DB status to STARTING
  await prisma.tenantGateway.update({
    where: { organizationId },
    data: {
      status: "STARTING",
      pid: childProcess.pid ?? null,
      consecutiveFailures: 0,
    },
  });

  // 5. Track in runningGateways map
  const gatewayProcess: GatewayProcess = {
    process: childProcess,
    port: gateway.port,
    organizationId,
    startedAt: new Date(),
  };
  runningGateways.set(organizationId, gatewayProcess);

  // 6. Set up exit handler to update DB on crash/exit
  childProcess.on("exit", async (code, signal) => {
    runningGateways.delete(organizationId);

    const newStatus: GatewayStatus = signal === "SIGTERM" || code === 0 ? "STOPPED" : "FAILED";

    try {
      await prisma.tenantGateway.update({
        where: { organizationId },
        data: {
          status: newStatus,
          pid: null,
        },
      });
    } catch {
      // DB update failed, log and continue
      console.error(`Failed to update gateway status on exit for org: ${organizationId}`);
    }
  });

  // Handle spawn errors
  childProcess.on("error", async (error) => {
    runningGateways.delete(organizationId);

    try {
      await prisma.tenantGateway.update({
        where: { organizationId },
        data: {
          status: "FAILED",
          pid: null,
        },
      });
    } catch {
      console.error(`Failed to update gateway status on error for org: ${organizationId}`);
    }
  });
}

/**
 * Stop a running gateway process gracefully
 *
 * Sends SIGTERM and waits up to 10 seconds for graceful exit.
 * If process doesn't exit, sends SIGKILL.
 *
 * @param organizationId - The organization ID to stop gateway for
 */
export async function stopGateway(organizationId: string): Promise<void> {
  const gateway = runningGateways.get(organizationId);

  if (!gateway) {
    // Not running in-memory, just update DB status
    await prisma.tenantGateway.update({
      where: { organizationId },
      data: { status: "STOPPED", pid: null },
    });
    return;
  }

  const { process: childProcess } = gateway;

  // Create promise that resolves when process exits
  const exitPromise = new Promise<void>((resolve) => {
    childProcess.once("exit", () => resolve());
  });

  // Send SIGTERM for graceful shutdown
  if (childProcess.pid) {
    process.kill(childProcess.pid, "SIGTERM");
  }

  // Wait for graceful exit or timeout
  const timeoutPromise = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), GRACEFUL_SHUTDOWN_TIMEOUT),
  );

  const result = await Promise.race([exitPromise, timeoutPromise]);

  // If timed out, force kill
  if (result === "timeout" && childProcess.pid) {
    try {
      process.kill(childProcess.pid, "SIGKILL");
    } catch {
      // Process may have already exited
    }
  }

  // Clean up
  runningGateways.delete(organizationId);

  // Update DB status
  await prisma.tenantGateway.update({
    where: { organizationId },
    data: { status: "STOPPED", pid: null },
  });
}

/**
 * Restart a gateway process (stop then start)
 *
 * @param organizationId - The organization ID to restart gateway for
 */
export async function restartGateway(organizationId: string): Promise<void> {
  await stopGateway(organizationId);
  await spawnGateway(organizationId);
}

/**
 * Get the in-memory gateway process object
 *
 * @param organizationId - The organization ID
 * @returns The GatewayProcess if running, undefined otherwise
 */
export function getGatewayProcess(organizationId: string): GatewayProcess | undefined {
  return runningGateways.get(organizationId);
}

/**
 * Get gateway status information from database
 *
 * @param organizationId - The organization ID
 * @returns Gateway info or null if not found
 */
export async function getGatewayStatus(organizationId: string): Promise<GatewayInfo | null> {
  const gateway = await prisma.tenantGateway.findUnique({
    where: { organizationId },
  });

  if (!gateway) return null;

  return {
    organizationId: gateway.organizationId,
    port: gateway.port,
    status: gateway.status as GatewayStatus,
    pid: gateway.pid,
    lastHealthCheck: gateway.lastHealthCheck,
    consecutiveFailures: gateway.consecutiveFailures,
  };
}

/**
 * Send a signal to a running gateway process
 *
 * @param organizationId - The organization ID
 * @param signal - The signal to send (e.g., SIGUSR1 for config reload)
 * @returns true if signal was sent, false if gateway not running
 */
export function sendSignal(organizationId: string, signal: NodeJS.Signals): boolean {
  const gateway = runningGateways.get(organizationId);

  if (!gateway?.process.pid) {
    return false;
  }

  try {
    process.kill(gateway.process.pid, signal);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a gateway is currently running in-memory
 *
 * @param organizationId - The organization ID
 * @returns true if gateway process is tracked
 */
export function isGatewayRunning(organizationId: string): boolean {
  return runningGateways.has(organizationId);
}

/**
 * Get all currently running gateway organization IDs
 *
 * @returns Array of organization IDs with running gateways
 */
export function getRunningGatewayIds(): string[] {
  return Array.from(runningGateways.keys());
}

/**
 * Stop all running gateways (for graceful shutdown)
 */
export async function stopAllGateways(): Promise<void> {
  const orgIds = getRunningGatewayIds();
  await Promise.all(orgIds.map((id) => stopGateway(id)));
}

// Export for testing purposes
export function _getRunningGatewaysMap(): Map<string, GatewayProcess> {
  return runningGateways;
}

export function _clearRunningGateways(): void {
  runningGateways.clear();
}
