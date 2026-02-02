/**
 * Port Allocator for Tenant Gateways
 *
 * Manages port allocation for multi-tenant gateway instances.
 * Ports are allocated in the range 18001-18999.
 */

import { PrismaClient } from "@prisma/client";

/** Port range configuration */
export const PORT_RANGE = {
  MIN: 18001,
  MAX: 18999,
} as const;

/** Total available ports in the range */
export const TOTAL_PORTS = PORT_RANGE.MAX - PORT_RANGE.MIN + 1;

export interface PortAllocatorOptions {
  /** Minimum port in the allocation range (default: 18001) */
  minPort?: number;
  /** Maximum port in the allocation range (default: 18999) */
  maxPort?: number;
}

export interface AllocatedPort {
  port: number;
  organizationId: string;
}

/**
 * Port Allocator class for managing tenant gateway ports
 */
export class PortAllocator {
  private readonly prisma: PrismaClient;
  private readonly minPort: number;
  private readonly maxPort: number;

  constructor(prisma: PrismaClient, options: PortAllocatorOptions = {}) {
    this.prisma = prisma;
    this.minPort = options.minPort ?? PORT_RANGE.MIN;
    this.maxPort = options.maxPort ?? PORT_RANGE.MAX;

    if (this.minPort > this.maxPort) {
      throw new Error(
        `Invalid port range: minPort (${this.minPort}) must be <= maxPort (${this.maxPort})`,
      );
    }

    if (this.minPort < 1 || this.maxPort > 65535) {
      throw new Error("Port range must be between 1 and 65535");
    }
  }

  /**
   * Get the total number of available ports in the range
   */
  get totalPorts(): number {
    return this.maxPort - this.minPort + 1;
  }

  /**
   * Allocate the next available port for an organization
   *
   * @param organizationId - The organization ID to allocate the port for
   * @param configPath - Path to gateway config
   * @param statePath - Path to gateway state
   * @param workspacePath - Path to gateway workspace
   * @returns The allocated port number, or null if no ports available
   */
  async allocate(
    organizationId: string,
    configPath: string,
    statePath: string,
    workspacePath: string,
  ): Promise<number | null> {
    // Get all currently allocated ports
    const allocatedPorts = await this.getAllocatedPorts();
    const allocatedSet = new Set(allocatedPorts.map((p) => p.port));

    // Find first available port
    for (let port = this.minPort; port <= this.maxPort; port++) {
      if (!allocatedSet.has(port)) {
        try {
          // Try to create the gateway with this port
          // Using a transaction to handle concurrent allocation
          await this.prisma.tenantGateway.create({
            data: {
              organizationId,
              port,
              configPath,
              statePath,
              workspacePath,
            },
          });
          return port;
        } catch (error: unknown) {
          // Check if this is a unique constraint violation (port already taken)
          // This handles concurrent allocation race conditions
          if (error instanceof Error && error.message.includes("Unique constraint")) {
            // Port was taken by another concurrent request, try next port
            continue;
          }
          throw error;
        }
      }
    }

    return null; // No ports available
  }

  /**
   * Release a port for an organization
   *
   * @param organizationId - The organization ID whose port should be released
   * @returns True if a port was released, false if no port was allocated
   */
  async release(organizationId: string): Promise<boolean> {
    const result = await this.prisma.tenantGateway.deleteMany({
      where: { organizationId },
    });
    return result.count > 0;
  }

  /**
   * Release a specific port
   *
   * @param port - The port number to release
   * @returns True if the port was released, false if it wasn't allocated
   */
  async releasePort(port: number): Promise<boolean> {
    const result = await this.prisma.tenantGateway.deleteMany({
      where: { port },
    });
    return result.count > 0;
  }

  /**
   * Get all currently allocated ports
   *
   * @returns Array of allocated port information
   */
  async getAllocatedPorts(): Promise<AllocatedPort[]> {
    const gateways = await this.prisma.tenantGateway.findMany({
      select: {
        port: true,
        organizationId: true,
      },
    });
    return gateways;
  }

  /**
   * Get the port allocated to a specific organization
   *
   * @param organizationId - The organization ID to look up
   * @returns The port number, or null if no port is allocated
   */
  async getPortForOrganization(organizationId: string): Promise<number | null> {
    const gateway = await this.prisma.tenantGateway.findUnique({
      where: { organizationId },
      select: { port: true },
    });
    return gateway?.port ?? null;
  }

  /**
   * Check if a specific port is available
   *
   * @param port - The port number to check
   * @returns True if the port is available, false otherwise
   */
  async isPortAvailable(port: number): Promise<boolean> {
    if (port < this.minPort || port > this.maxPort) {
      return false;
    }

    const gateway = await this.prisma.tenantGateway.findUnique({
      where: { port },
    });
    return gateway === null;
  }

  /**
   * Get the count of available ports
   *
   * @returns The number of available ports
   */
  async getAvailablePortCount(): Promise<number> {
    const allocatedCount = await this.prisma.tenantGateway.count();
    return this.totalPorts - allocatedCount;
  }

  /**
   * Check if the port range is within valid bounds
   *
   * @param port - The port number to validate
   * @returns True if the port is within the valid range
   */
  isValidPort(port: number): boolean {
    return port >= this.minPort && port <= this.maxPort;
  }
}

/**
 * Create a port allocator instance with default options
 */
export function createPortAllocator(
  prisma: PrismaClient,
  options?: PortAllocatorOptions,
): PortAllocator {
  return new PortAllocator(prisma, options);
}
