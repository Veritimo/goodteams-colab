/**
 * Health Checker
 *
 * Periodic health checks for connectors with status updates.
 * Supports configurable intervals, timeouts, and failure thresholds.
 *
 * @see docs/IMPLEMENTATION-PLAN-PHASE6.md
 */

import type { HealthCheckResult, HealthCheckOptions, ConnectionConfig } from "./types.js";
import { prisma } from "../db/client.js";
import { updateConnectorStatus } from "./connector-service.js";

// =============================================================================
// DEFAULT OPTIONS
// =============================================================================

const DEFAULT_OPTIONS: Required<HealthCheckOptions> = {
  intervalMs: 60000, // 1 minute
  timeoutMs: 10000, // 10 seconds
  failureThreshold: 3, // 3 consecutive failures
  successThreshold: 1, // 1 success to mark healthy
};

// =============================================================================
// HEALTH CHECK ERRORS
// =============================================================================

/**
 * Error thrown when health check times out
 */
export class HealthCheckTimeoutError extends Error {
  constructor(connectorId: string, timeoutMs: number) {
    super(`Health check timed out for connector ${connectorId} after ${timeoutMs}ms`);
    this.name = "HealthCheckTimeoutError";
  }
}

// =============================================================================
// HEALTH CHECKER CLASS
// =============================================================================

/**
 * Health checker for monitoring connector status
 */
export class HealthChecker {
  private options: Required<HealthCheckOptions>;
  private checkers: Map<string, (config: ConnectionConfig) => Promise<HealthCheckResult>> =
    new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private failureCounts: Map<string, number> = new Map();
  private successCounts: Map<string, number> = new Map();
  private lastResults: Map<string, HealthCheckResult> = new Map();
  private running = false;

  constructor(options?: HealthCheckOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Register a health check function for a connection type
   *
   * @param type - Connection type (e.g., "SQL_SERVER")
   * @param checker - Health check function
   */
  registerChecker(
    type: string,
    checker: (config: ConnectionConfig) => Promise<HealthCheckResult>,
  ): void {
    this.checkers.set(type, checker);
  }

  /**
   * Start health checks for a connector
   *
   * @param connectorId - Connector UUID
   * @param type - Connection type
   * @param config - Connection configuration
   */
  startMonitoring(connectorId: string, type: string, config: ConnectionConfig): void {
    // Stop any existing monitoring
    this.stopMonitoring(connectorId);

    // Initialize counters
    this.failureCounts.set(connectorId, 0);
    this.successCounts.set(connectorId, 0);

    // Start periodic health checks
    const interval = setInterval(async () => {
      await this.runHealthCheck(connectorId, type, config);
    }, this.options.intervalMs);

    this.intervals.set(connectorId, interval);

    // Run initial health check
    this.runHealthCheck(connectorId, type, config);
  }

  /**
   * Stop health checks for a connector
   *
   * @param connectorId - Connector UUID
   */
  stopMonitoring(connectorId: string): void {
    const interval = this.intervals.get(connectorId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(connectorId);
    }
    this.failureCounts.delete(connectorId);
    this.successCounts.delete(connectorId);
    this.lastResults.delete(connectorId);
  }

  /**
   * Stop all health checks
   */
  stopAll(): void {
    for (const connectorId of this.intervals.keys()) {
      this.stopMonitoring(connectorId);
    }
  }

  /**
   * Run a health check manually
   *
   * @param connectorId - Connector UUID
   * @param type - Connection type
   * @param config - Connection configuration
   * @returns Health check result
   */
  async runHealthCheck(
    connectorId: string,
    type: string,
    config: ConnectionConfig,
  ): Promise<HealthCheckResult> {
    const checker = this.checkers.get(type);
    const startTime = Date.now();

    if (!checker) {
      // No checker registered - use default ping
      const result: HealthCheckResult = {
        connectorId,
        healthy: true,
        latencyMs: Date.now() - startTime,
        message: "No health checker registered, assuming healthy",
        checkedAt: new Date(),
      };
      this.lastResults.set(connectorId, result);
      return result;
    }

    try {
      // Run health check with timeout
      const result = await this.withTimeout(
        checker({ ...config, connectorId } as ConnectionConfig & { connectorId: string }),
        this.options.timeoutMs,
        connectorId,
      );

      result.connectorId = connectorId;
      result.latencyMs = Date.now() - startTime;
      result.checkedAt = new Date();

      // Update counters and status
      await this.processResult(connectorId, result);

      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        connectorId,
        healthy: false,
        latencyMs: Date.now() - startTime,
        message: error instanceof Error ? error.message : "Health check failed",
        checkedAt: new Date(),
      };

      await this.processResult(connectorId, result);

      return result;
    }
  }

  /**
   * Get the last health check result for a connector
   *
   * @param connectorId - Connector UUID
   * @returns Last health check result or null
   */
  getLastResult(connectorId: string): HealthCheckResult | null {
    return this.lastResults.get(connectorId) ?? null;
  }

  /**
   * Get all last health check results
   *
   * @returns Map of connector ID to health check result
   */
  getAllResults(): Map<string, HealthCheckResult> {
    return new Map(this.lastResults);
  }

  /**
   * Check if monitoring is active for a connector
   *
   * @param connectorId - Connector UUID
   * @returns True if monitoring is active
   */
  isMonitoring(connectorId: string): boolean {
    return this.intervals.has(connectorId);
  }

  /**
   * Get the current failure count for a connector
   *
   * @param connectorId - Connector UUID
   * @returns Failure count
   */
  getFailureCount(connectorId: string): number {
    return this.failureCounts.get(connectorId) ?? 0;
  }

  /**
   * Get the current success count for a connector
   *
   * @param connectorId - Connector UUID
   * @returns Success count
   */
  getSuccessCount(connectorId: string): number {
    return this.successCounts.get(connectorId) ?? 0;
  }

  /**
   * Update options
   *
   * @param options - New options
   */
  updateOptions(options: HealthCheckOptions): void {
    this.options = { ...this.options, ...options };
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Process a health check result and update status
   */
  private async processResult(connectorId: string, result: HealthCheckResult): Promise<void> {
    this.lastResults.set(connectorId, result);

    if (result.healthy) {
      // Reset failure count, increment success count
      this.failureCounts.set(connectorId, 0);
      const successCount = (this.successCounts.get(connectorId) ?? 0) + 1;
      this.successCounts.set(connectorId, successCount);

      // Update status to CONNECTED if enough successes
      if (successCount >= this.options.successThreshold) {
        try {
          await updateConnectorStatus(connectorId, "CONNECTED", result.message);
        } catch {
          // Ignore update errors - connector may have been deleted
        }
      }
    } else {
      // Reset success count, increment failure count
      this.successCounts.set(connectorId, 0);
      const failureCount = (this.failureCounts.get(connectorId) ?? 0) + 1;
      this.failureCounts.set(connectorId, failureCount);

      // Update status to ERROR if enough failures
      if (failureCount >= this.options.failureThreshold) {
        try {
          await updateConnectorStatus(connectorId, "ERROR", result.message);
        } catch {
          // Ignore update errors - connector may have been deleted
        }
      }
    }
  }

  /**
   * Run a promise with timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    connectorId: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new HealthCheckTimeoutError(connectorId, timeoutMs));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
}

// =============================================================================
// SINGLETON & FACTORY
// =============================================================================

let globalHealthChecker: HealthChecker | null = null;

/**
 * Create a new health checker instance
 *
 * @param options - Health check options
 * @returns Health checker instance
 */
export function createHealthChecker(options?: HealthCheckOptions): HealthChecker {
  return new HealthChecker(options);
}

/**
 * Get the global health checker instance
 *
 * @returns Global health checker
 */
export function getHealthChecker(): HealthChecker {
  if (!globalHealthChecker) {
    globalHealthChecker = new HealthChecker();
  }
  return globalHealthChecker;
}

/**
 * Reset the global health checker (for testing)
 */
export function resetHealthChecker(): void {
  if (globalHealthChecker) {
    globalHealthChecker.stopAll();
    globalHealthChecker = null;
  }
}

// =============================================================================
// DEFAULT HEALTH CHECK IMPLEMENTATIONS
// =============================================================================

/**
 * Create a simple TCP connection health check
 *
 * @param host - Host to connect to
 * @param port - Port to connect to
 * @param timeoutMs - Connection timeout
 * @returns Health check result
 */
export async function tcpHealthCheck(
  host: string,
  port: number,
  timeoutMs = 5000,
): Promise<Omit<HealthCheckResult, "connectorId" | "checkedAt">> {
  const net = await import("net");

  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = new net.Socket();

    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      socket.destroy();
      resolve({
        healthy: true,
        latencyMs: Date.now() - startTime,
        message: `TCP connection successful to ${host}:${port}`,
      });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({
        healthy: false,
        latencyMs: Date.now() - startTime,
        message: `TCP connection timed out to ${host}:${port}`,
      });
    });

    socket.on("error", (error) => {
      socket.destroy();
      resolve({
        healthy: false,
        latencyMs: Date.now() - startTime,
        message: `TCP connection error to ${host}:${port}: ${error.message}`,
      });
    });

    socket.connect(port, host);
  });
}

/**
 * Create a simple HTTP health check
 *
 * @param url - URL to check
 * @param timeoutMs - Request timeout
 * @returns Health check result
 */
export async function httpHealthCheck(
  url: string,
  timeoutMs = 5000,
): Promise<Omit<HealthCheckResult, "connectorId" | "checkedAt">> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const healthy = response.ok;
    return {
      healthy,
      latencyMs: Date.now() - startTime,
      message: healthy
        ? `HTTP health check successful (${response.status})`
        : `HTTP health check failed (${response.status})`,
      details: { statusCode: response.status },
    };
  } catch (error) {
    return {
      healthy: false,
      latencyMs: Date.now() - startTime,
      message: error instanceof Error ? error.message : "HTTP health check failed",
    };
  }
}
