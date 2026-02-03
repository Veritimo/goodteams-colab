/**
 * Gateway Provisioner Service
 *
 * Orchestrates the full provisioning lifecycle for tenant gateways.
 * Handles allocation, configuration, spawning, health verification, and cleanup.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { prisma } from "../db/client.js";
import { generateTenantConfig, writeConfigToFile, getTenantBasePath } from "./config-generator.js";
import { getDefaultConfig, type Plan } from "./config-templates.js";
import { deleteAllCredentials } from "./credential-vault.js";
import {
  spawnGateway,
  stopGateway,
  getGatewayStatus,
  type GatewayStatus,
} from "./gateway-manager.js";
import { PortAllocator, createPortAllocator } from "./port-allocator.js";

/** Base path for tenant directories */
export const TENANTS_BASE_PATH = "/tenants";

/** Health check configuration */
export const HEALTH_CHECK_CONFIG = {
  /** Maximum time to wait for gateway to become healthy (ms) */
  TIMEOUT_MS: 30_000,
  /** Interval between health check attempts (ms) */
  INTERVAL_MS: 1_000,
  /** Number of consecutive successful checks required */
  REQUIRED_PASSES: 2,
} as const;

/**
 * Result of provisioning operation
 */
export interface ProvisioningResult {
  success: boolean;
  organizationId: string;
  port?: number;
  status: GatewayStatus;
  error?: string;
  configPath?: string;
  workspacePath?: string;
}

/**
 * Result of deprovisioning operation
 */
export interface DeprovisioningResult {
  success: boolean;
  organizationId: string;
  portReleased: boolean;
  workspaceArchived: boolean;
  credentialsDeleted: number;
  error?: string;
}

/**
 * Provisioning status information
 */
export interface ProvisioningStatus {
  organizationId: string;
  status: GatewayStatus;
  port: number | null;
  pid: number | null;
  lastHealthCheck: Date | null;
  configPath: string | null;
  workspacePath: string | null;
  uptime: number | null;
}

/**
 * Options for provisioning a tenant
 */
export interface ProvisionOptions {
  /** Subscription plan (defaults to 'free') */
  plan?: Plan;
  /** Custom features to override plan defaults */
  customFeatures?: Record<string, boolean>;
  /** Custom limits to override plan defaults */
  customLimits?: Partial<{
    maxTokensPerDay: number;
    maxConcurrentSessions: number;
    maxMemoryMb: number;
  }>;
}

/**
 * Options for deprovisioning a tenant
 */
export interface DeprovisionOptions {
  /** Delete workspace instead of archiving (default: false) */
  deleteWorkspace?: boolean;
  /** Skip credential deletion (default: false) */
  keepCredentials?: boolean;
}

/**
 * Error thrown during provisioning operations
 */
export class ProvisioningError extends Error {
  constructor(
    message: string,
    public readonly organizationId: string,
    public readonly phase: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "ProvisioningError";
  }
}

/**
 * Gateway Provisioner class
 *
 * Manages the complete lifecycle of tenant gateway provisioning and deprovisioning.
 */
export class GatewayProvisioner {
  private readonly portAllocator: PortAllocator;
  private readonly tenantsBasePath: string;

  constructor(portAllocator?: PortAllocator, tenantsBasePath: string = TENANTS_BASE_PATH) {
    this.portAllocator = portAllocator ?? createPortAllocator(prisma);
    this.tenantsBasePath = tenantsBasePath;
  }

  /**
   * Provision a new gateway for an organization
   *
   * Full provisioning flow:
   * 1. Validate organization exists and doesn't have a gateway
   * 2. Allocate port via PortAllocator
   * 3. Create TenantConfig with plan defaults
   * 4. Create workspace directories
   * 5. Generate config file via ConfigGenerator
   * 6. Spawn gateway via GatewayManager
   * 7. Wait for health check to pass
   * 8. Update status to HEALTHY
   *
   * @param organizationId - The organization to provision
   * @param options - Provisioning options
   * @returns Provisioning result
   */
  async provisionTenant(
    organizationId: string,
    options: ProvisionOptions = {},
  ): Promise<ProvisioningResult> {
    const plan = options.plan ?? "free";
    let allocatedPort: number | null = null;
    let configCreated = false;
    let workspaceCreated = false;

    try {
      // 1. Validate organization exists
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
      });

      if (!organization) {
        return {
          success: false,
          organizationId,
          status: "FAILED",
          error: `Organization not found: ${organizationId}`,
        };
      }

      // Check if gateway already exists
      const existingGateway = await prisma.tenantGateway.findUnique({
        where: { organizationId },
      });

      if (existingGateway) {
        return {
          success: false,
          organizationId,
          port: existingGateway.port,
          status: existingGateway.status as GatewayStatus,
          error: `Gateway already exists for organization: ${organizationId}`,
        };
      }

      // 2. Create workspace directories first (needed for port allocation)
      const workspacePaths = this.getWorkspacePaths(organizationId);
      await this.createWorkspaceDirectories(organizationId);
      workspaceCreated = true;

      // 3. Allocate port (this also creates TenantGateway record with PROVISIONING status)
      allocatedPort = await this.portAllocator.allocate(
        organizationId,
        workspacePaths.config,
        workspacePaths.state,
        workspacePaths.workspace,
      );

      if (!allocatedPort) {
        throw new ProvisioningError("No ports available", organizationId, "port_allocation");
      }

      // 4. Create TenantConfig with plan defaults
      const defaultConfig = getDefaultConfig(plan);
      await prisma.tenantConfig.create({
        data: {
          organizationId,
          model: defaultConfig.model,
          agentName: defaultConfig.agentName,
          systemPrompt: defaultConfig.systemPrompt,
          features: JSON.parse(JSON.stringify(defaultConfig.features)),
          maxTokensPerDay:
            options.customLimits?.maxTokensPerDay ?? defaultConfig.limits.maxTokensPerDay,
          maxConcurrentSessions:
            options.customLimits?.maxConcurrentSessions ??
            defaultConfig.limits.maxConcurrentSessions,
          maxMemoryMb: options.customLimits?.maxMemoryMb ?? defaultConfig.limits.maxMemoryMb,
        },
      });
      configCreated = true;

      // 5. Get updated gateway and config for config generation
      const [gateway, tenantConfig] = await Promise.all([
        prisma.tenantGateway.findUnique({ where: { organizationId } }),
        prisma.tenantConfig.findUnique({ where: { organizationId } }),
      ]);

      if (!gateway || !tenantConfig) {
        throw new ProvisioningError(
          "Failed to retrieve gateway or config after creation",
          organizationId,
          "config_retrieval",
        );
      }

      // 6. Generate and write config file
      const generatedConfig = await generateTenantConfig(organization, tenantConfig, gateway);
      await writeConfigToFile(organizationId, generatedConfig);

      // 7. Spawn gateway process
      await spawnGateway(organizationId);

      // 8. Wait for health check to pass
      const healthy = await this.waitForHealthy(organizationId);

      if (!healthy) {
        // Gateway started but didn't become healthy
        await prisma.tenantGateway.update({
          where: { organizationId },
          data: { status: "UNHEALTHY" },
        });

        return {
          success: false,
          organizationId,
          port: allocatedPort,
          status: "UNHEALTHY",
          error: "Gateway started but failed health check within timeout",
          configPath: workspacePaths.config,
          workspacePath: workspacePaths.workspace,
        };
      }

      // 9. Update status to HEALTHY
      await prisma.tenantGateway.update({
        where: { organizationId },
        data: {
          status: "HEALTHY",
          startedAt: new Date(),
          lastHealthCheck: new Date(),
        },
      });

      return {
        success: true,
        organizationId,
        port: allocatedPort,
        status: "HEALTHY",
        configPath: workspacePaths.config,
        workspacePath: workspacePaths.workspace,
      };
    } catch (error) {
      // Rollback on failure
      await this.rollback(organizationId, {
        portAllocated: allocatedPort !== null,
        configCreated,
        workspaceCreated,
      });

      const errorMessage = error instanceof Error ? error.message : String(error);
      const phase = error instanceof ProvisioningError ? error.phase : "unknown";

      return {
        success: false,
        organizationId,
        status: "FAILED",
        error: `Provisioning failed during ${phase}: ${errorMessage}`,
      };
    }
  }

  /**
   * Deprovision a tenant gateway
   *
   * Cleanup flow:
   * 1. Stop gateway process
   * 2. Delete credentials
   * 3. Archive/delete workspace
   * 4. Delete TenantConfig
   * 5. Release port (deletes TenantGateway)
   *
   * @param organizationId - The organization to deprovision
   * @param options - Deprovisioning options
   * @returns Deprovisioning result
   */
  async deprovisionTenant(
    organizationId: string,
    options: DeprovisionOptions = {},
  ): Promise<DeprovisioningResult> {
    let portReleased = false;
    let workspaceArchived = false;
    let credentialsDeleted = 0;

    try {
      // 1. Stop gateway process (if running)
      try {
        await stopGateway(organizationId);
      } catch {
        // Gateway may not be running, continue
      }

      // 2. Delete credentials (unless keeping them)
      if (!options.keepCredentials) {
        credentialsDeleted = await deleteAllCredentials(organizationId);
      }

      // 3. Archive or delete workspace
      const workspacePaths = this.getWorkspacePaths(organizationId);
      if (options.deleteWorkspace) {
        await this.deleteWorkspace(organizationId);
      } else {
        await this.archiveWorkspace(organizationId);
      }
      workspaceArchived = true;

      // 4. Delete TenantConfig
      await prisma.tenantConfig.deleteMany({
        where: { organizationId },
      });

      // 5. Release port (this also deletes TenantGateway)
      portReleased = await this.portAllocator.release(organizationId);

      return {
        success: true,
        organizationId,
        portReleased,
        workspaceArchived,
        credentialsDeleted,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        organizationId,
        portReleased,
        workspaceArchived,
        credentialsDeleted,
        error: `Deprovisioning failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Get the current provisioning status for an organization
   *
   * @param organizationId - The organization to check
   * @returns Provisioning status or null if not found
   */
  async getProvisioningStatus(organizationId: string): Promise<ProvisioningStatus | null> {
    const gateway = await prisma.tenantGateway.findUnique({
      where: { organizationId },
    });

    if (!gateway) {
      return null;
    }

    // Calculate uptime if gateway is running
    let uptime: number | null = null;
    if (gateway.startedAt && ["HEALTHY", "UNHEALTHY", "STARTING"].includes(gateway.status)) {
      uptime = Date.now() - gateway.startedAt.getTime();
    }

    return {
      organizationId: gateway.organizationId,
      status: gateway.status as GatewayStatus,
      port: gateway.port,
      pid: gateway.pid,
      lastHealthCheck: gateway.lastHealthCheck,
      configPath: gateway.configPath,
      workspacePath: gateway.workspacePath,
      uptime,
    };
  }

  /**
   * Restart a tenant gateway
   *
   * @param organizationId - The organization to restart
   * @returns Updated provisioning status
   */
  async restartTenant(organizationId: string): Promise<ProvisioningStatus | null> {
    const gateway = await prisma.tenantGateway.findUnique({
      where: { organizationId },
    });

    if (!gateway) {
      return null;
    }

    // Stop if running
    try {
      await stopGateway(organizationId);
    } catch {
      // May not be running
    }

    // Update to allow respawn
    await prisma.tenantGateway.update({
      where: { organizationId },
      data: { status: "STOPPED" },
    });

    // Respawn
    await spawnGateway(organizationId);

    // Wait for healthy
    const healthy = await this.waitForHealthy(organizationId);

    if (healthy) {
      await prisma.tenantGateway.update({
        where: { organizationId },
        data: {
          status: "HEALTHY",
          startedAt: new Date(),
          lastHealthCheck: new Date(),
        },
      });
    }

    return this.getProvisioningStatus(organizationId);
  }

  /**
   * Get workspace paths for an organization
   */
  private getWorkspacePaths(organizationId: string): {
    base: string;
    config: string;
    state: string;
    workspace: string;
    sessions: string;
    memory: string;
  } {
    const base = path.join(this.tenantsBasePath, organizationId);
    return {
      base,
      config: path.join(base, "config", "openclaw.json"),
      state: path.join(base, "state"),
      workspace: path.join(base, "workspace"),
      sessions: path.join(base, "sessions"),
      memory: path.join(base, "memory"),
    };
  }

  /**
   * Create workspace directories for a tenant
   */
  private async createWorkspaceDirectories(organizationId: string): Promise<void> {
    const paths = this.getWorkspacePaths(organizationId);

    await Promise.all([
      fs.mkdir(path.dirname(paths.config), { recursive: true }),
      fs.mkdir(paths.state, { recursive: true }),
      fs.mkdir(paths.workspace, { recursive: true }),
      fs.mkdir(paths.sessions, { recursive: true }),
      fs.mkdir(paths.memory, { recursive: true }),
    ]);
  }

  /**
   * Delete workspace directory
   */
  private async deleteWorkspace(organizationId: string): Promise<void> {
    const paths = this.getWorkspacePaths(organizationId);
    try {
      await fs.rm(paths.base, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
  }

  /**
   * Archive workspace by renaming with timestamp
   */
  private async archiveWorkspace(organizationId: string): Promise<void> {
    const paths = this.getWorkspacePaths(organizationId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const archivePath = `${paths.base}.archived-${timestamp}`;

    try {
      await fs.rename(paths.base, archivePath);
    } catch {
      // Directory may not exist
    }
  }

  /**
   * Wait for gateway to become healthy
   *
   * @param organizationId - The organization to check
   * @returns True if healthy within timeout, false otherwise
   */
  private async waitForHealthy(organizationId: string): Promise<boolean> {
    const startTime = Date.now();
    let consecutivePasses = 0;

    while (Date.now() - startTime < HEALTH_CHECK_CONFIG.TIMEOUT_MS) {
      const healthy = await this.checkHealth(organizationId);

      if (healthy) {
        consecutivePasses++;
        if (consecutivePasses >= HEALTH_CHECK_CONFIG.REQUIRED_PASSES) {
          return true;
        }
      } else {
        consecutivePasses = 0;
      }

      await this.sleep(HEALTH_CHECK_CONFIG.INTERVAL_MS);
    }

    return false;
  }

  /**
   * Check if gateway is healthy via HTTP health endpoint
   */
  private async checkHealth(organizationId: string): Promise<boolean> {
    const gateway = await prisma.tenantGateway.findUnique({
      where: { organizationId },
    });

    if (!gateway) return false;

    try {
      const response = await fetch(`http://127.0.0.1:${gateway.port}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Rollback provisioning on failure
   */
  private async rollback(
    organizationId: string,
    state: {
      portAllocated: boolean;
      configCreated: boolean;
      workspaceCreated: boolean;
    },
  ): Promise<void> {
    // Stop gateway if it was started
    try {
      await stopGateway(organizationId);
    } catch {
      // May not be running
    }

    // Delete TenantConfig if created
    if (state.configCreated) {
      try {
        await prisma.tenantConfig.deleteMany({
          where: { organizationId },
        });
      } catch {
        // May not exist
      }
    }

    // Release port if allocated (this also deletes TenantGateway)
    if (state.portAllocated) {
      try {
        await this.portAllocator.release(organizationId);
      } catch {
        // May not exist
      }
    }

    // Delete workspace if created
    if (state.workspaceCreated) {
      try {
        await this.deleteWorkspace(organizationId);
      } catch {
        // May not exist
      }
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a gateway provisioner instance with default configuration
 */
export function createGatewayProvisioner(
  portAllocator?: PortAllocator,
  tenantsBasePath?: string,
): GatewayProvisioner {
  return new GatewayProvisioner(portAllocator, tenantsBasePath);
}

// Convenience functions for direct use

let defaultProvisioner: GatewayProvisioner | null = null;

function getDefaultProvisioner(): GatewayProvisioner {
  if (!defaultProvisioner) {
    defaultProvisioner = createGatewayProvisioner();
  }
  return defaultProvisioner;
}

/**
 * Provision a new gateway for an organization (convenience function)
 */
export async function provisionTenant(
  organizationId: string,
  options?: ProvisionOptions,
): Promise<ProvisioningResult> {
  return getDefaultProvisioner().provisionTenant(organizationId, options);
}

/**
 * Deprovision a tenant gateway (convenience function)
 */
export async function deprovisionTenant(
  organizationId: string,
  options?: DeprovisionOptions,
): Promise<DeprovisioningResult> {
  return getDefaultProvisioner().deprovisionTenant(organizationId, options);
}

/**
 * Get provisioning status (convenience function)
 */
export async function getProvisioningStatus(
  organizationId: string,
): Promise<ProvisioningStatus | null> {
  return getDefaultProvisioner().getProvisioningStatus(organizationId);
}

/**
 * Restart a tenant gateway (convenience function)
 */
export async function restartTenant(organizationId: string): Promise<ProvisioningStatus | null> {
  return getDefaultProvisioner().restartTenant(organizationId);
}

// Export for testing
export function _resetDefaultProvisioner(): void {
  defaultProvisioner = null;
}
