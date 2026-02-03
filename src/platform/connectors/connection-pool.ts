/**
 * Connection Pool
 *
 * Generic pool management for database connections.
 * Tracks active connections per connector with configurable limits.
 *
 * @see docs/IMPLEMENTATION-PLAN-PHASE6.md
 */

import { randomUUID } from "crypto";
import type { PooledConnection, PoolStats, PoolOptions } from "./types.js";

// =============================================================================
// DEFAULT OPTIONS
// =============================================================================

const DEFAULT_OPTIONS: Required<PoolOptions> = {
  min: 0,
  max: 10,
  idleTimeoutMs: 30000, // 30 seconds
  acquireTimeoutMs: 10000, // 10 seconds
  evictionRunIntervalMs: 15000, // 15 seconds
  maxConnectionAgeMs: 1800000, // 30 minutes
};

// =============================================================================
// POOL ERRORS
// =============================================================================

/**
 * Error thrown when pool cannot acquire a connection
 */
export class PoolAcquireTimeoutError extends Error {
  constructor(connectorId: string) {
    super(`Timeout acquiring connection from pool for connector: ${connectorId}`);
    this.name = "PoolAcquireTimeoutError";
  }
}

/**
 * Error thrown when pool is at max capacity
 */
export class PoolExhaustedError extends Error {
  constructor(connectorId: string, max: number) {
    super(`Connection pool exhausted for connector: ${connectorId} (max: ${max})`);
    this.name = "PoolExhaustedError";
  }
}

/**
 * Error thrown when connector pool doesn't exist
 */
export class PoolNotFoundError extends Error {
  constructor(connectorId: string) {
    super(`No connection pool found for connector: ${connectorId}`);
    this.name = "PoolNotFoundError";
  }
}

// =============================================================================
// CONNECTION POOL CLASS
// =============================================================================

/**
 * Generic connection pool for managing database connections
 *
 * @template T - Type of the underlying connection object
 */
export class ConnectionPool<T = unknown> {
  private pools: Map<string, PooledConnection<T>[]> = new Map();
  private options: Map<string, Required<PoolOptions>> = new Map();
  private factories: Map<string, () => Promise<T>> = new Map();
  private destroyers: Map<string, (conn: T) => Promise<void>> = new Map();
  private validators: Map<string, (conn: T) => Promise<boolean>> = new Map();
  private stats: Map<string, { totalCreated: number; totalDestroyed: number }> = new Map();
  private evictionInterval: NodeJS.Timeout | null = null;
  private pendingRequests: Map<string, number> = new Map();

  constructor() {
    // Start eviction interval
    this.startEvictionLoop();
  }

  /**
   * Register a connector pool
   *
   * @param connectorId - Connector UUID
   * @param factory - Function to create new connections
   * @param destroyer - Function to destroy connections
   * @param validator - Function to validate connections (optional)
   * @param options - Pool configuration options
   */
  register(
    connectorId: string,
    factory: () => Promise<T>,
    destroyer: (conn: T) => Promise<void>,
    validator?: (conn: T) => Promise<boolean>,
    options?: PoolOptions,
  ): void {
    this.factories.set(connectorId, factory);
    this.destroyers.set(connectorId, destroyer);
    if (validator) {
      this.validators.set(connectorId, validator);
    }
    this.options.set(connectorId, { ...DEFAULT_OPTIONS, ...options });
    this.pools.set(connectorId, []);
    this.stats.set(connectorId, { totalCreated: 0, totalDestroyed: 0 });
    this.pendingRequests.set(connectorId, 0);
  }

  /**
   * Unregister a connector pool and destroy all connections
   *
   * @param connectorId - Connector UUID
   */
  async unregister(connectorId: string): Promise<void> {
    await this.destroyAll(connectorId);
    this.factories.delete(connectorId);
    this.destroyers.delete(connectorId);
    this.validators.delete(connectorId);
    this.options.delete(connectorId);
    this.pools.delete(connectorId);
    this.stats.delete(connectorId);
    this.pendingRequests.delete(connectorId);
  }

  /**
   * Acquire a connection from the pool
   *
   * @param connectorId - Connector UUID
   * @returns Pooled connection wrapper
   */
  async acquire(connectorId: string): Promise<PooledConnection<T>> {
    const pool = this.pools.get(connectorId);
    const factory = this.factories.get(connectorId);
    const opts = this.options.get(connectorId);

    if (!pool || !factory || !opts) {
      throw new PoolNotFoundError(connectorId);
    }

    // Try to find an idle connection
    const idleConn = pool.find((c) => !c.inUse);
    if (idleConn) {
      // Validate if validator is registered
      const validator = this.validators.get(connectorId);
      if (validator) {
        try {
          const valid = await validator(idleConn.connection);
          if (!valid) {
            await this.destroy(connectorId, idleConn.connectionId);
            return this.acquire(connectorId); // Retry
          }
        } catch {
          await this.destroy(connectorId, idleConn.connectionId);
          return this.acquire(connectorId); // Retry
        }
      }

      idleConn.inUse = true;
      idleConn.lastUsedAt = new Date();
      idleConn.useCount++;
      return idleConn;
    }

    // Check if we can create a new connection
    const activeCount = pool.filter((c) => c.inUse).length;
    if (pool.length < opts.max) {
      return this.createConnection(connectorId);
    }

    // Pool is at max, wait for a connection
    const pending = this.pendingRequests.get(connectorId) ?? 0;
    this.pendingRequests.set(connectorId, pending + 1);

    try {
      return await this.waitForConnection(connectorId, opts.acquireTimeoutMs);
    } finally {
      const current = this.pendingRequests.get(connectorId) ?? 1;
      this.pendingRequests.set(connectorId, current - 1);
    }
  }

  /**
   * Release a connection back to the pool
   *
   * @param connectorId - Connector UUID
   * @param connectionId - Connection UUID
   */
  release(connectorId: string, connectionId: string): void {
    const pool = this.pools.get(connectorId);
    if (!pool) return;

    const conn = pool.find((c) => c.connectionId === connectionId);
    if (conn) {
      conn.inUse = false;
      conn.lastUsedAt = new Date();
    }
  }

  /**
   * Destroy a specific connection
   *
   * @param connectorId - Connector UUID
   * @param connectionId - Connection UUID
   */
  async destroy(connectorId: string, connectionId: string): Promise<void> {
    const pool = this.pools.get(connectorId);
    const destroyer = this.destroyers.get(connectorId);
    const stats = this.stats.get(connectorId);

    if (!pool || !destroyer) return;

    const index = pool.findIndex((c) => c.connectionId === connectionId);
    if (index !== -1) {
      const conn = pool[index];
      pool.splice(index, 1);
      try {
        await destroyer(conn.connection);
      } catch {
        // Ignore destroy errors
      }
      if (stats) {
        stats.totalDestroyed++;
      }
    }
  }

  /**
   * Destroy all connections for a connector
   *
   * @param connectorId - Connector UUID
   */
  async destroyAll(connectorId: string): Promise<void> {
    const pool = this.pools.get(connectorId);
    const destroyer = this.destroyers.get(connectorId);

    if (!pool || !destroyer) return;

    const connections = [...pool];
    pool.length = 0;

    await Promise.allSettled(
      connections.map(async (conn) => {
        try {
          await destroyer(conn.connection);
        } catch {
          // Ignore destroy errors
        }
      }),
    );

    const stats = this.stats.get(connectorId);
    if (stats) {
      stats.totalDestroyed += connections.length;
    }
  }

  /**
   * Get pool statistics for a connector
   *
   * @param connectorId - Connector UUID
   * @returns Pool statistics
   */
  getStats(connectorId: string): PoolStats | null {
    const pool = this.pools.get(connectorId);
    const stats = this.stats.get(connectorId);
    const pending = this.pendingRequests.get(connectorId) ?? 0;

    if (!pool || !stats) return null;

    const activeConnections = pool.filter((c) => c.inUse).length;
    const idleConnections = pool.filter((c) => !c.inUse).length;

    return {
      connectorId,
      totalConnections: pool.length,
      activeConnections,
      idleConnections,
      pendingRequests: pending,
      totalCreated: stats.totalCreated,
      totalDestroyed: stats.totalDestroyed,
    };
  }

  /**
   * Get all pool statistics
   *
   * @returns Array of pool statistics
   */
  getAllStats(): PoolStats[] {
    const allStats: PoolStats[] = [];
    for (const connectorId of this.pools.keys()) {
      const stats = this.getStats(connectorId);
      if (stats) {
        allStats.push(stats);
      }
    }
    return allStats;
  }

  /**
   * Check if a connector has a registered pool
   *
   * @param connectorId - Connector UUID
   * @returns True if pool exists
   */
  hasPool(connectorId: string): boolean {
    return this.pools.has(connectorId);
  }

  /**
   * Shutdown the pool manager
   */
  async shutdown(): Promise<void> {
    if (this.evictionInterval) {
      clearInterval(this.evictionInterval);
      this.evictionInterval = null;
    }

    // Destroy all pools
    for (const connectorId of this.pools.keys()) {
      await this.destroyAll(connectorId);
    }

    this.pools.clear();
    this.factories.clear();
    this.destroyers.clear();
    this.validators.clear();
    this.options.clear();
    this.stats.clear();
    this.pendingRequests.clear();
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Create a new connection
   */
  private async createConnection(connectorId: string): Promise<PooledConnection<T>> {
    const factory = this.factories.get(connectorId);
    const pool = this.pools.get(connectorId);
    const stats = this.stats.get(connectorId);

    if (!factory || !pool) {
      throw new PoolNotFoundError(connectorId);
    }

    const connection = await factory();
    const pooledConnection: PooledConnection<T> = {
      connection,
      connectionId: randomUUID(),
      connectorId,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      useCount: 1,
      inUse: true,
    };

    pool.push(pooledConnection);
    if (stats) {
      stats.totalCreated++;
    }

    return pooledConnection;
  }

  /**
   * Wait for a connection to become available
   */
  private async waitForConnection(
    connectorId: string,
    timeoutMs: number,
  ): Promise<PooledConnection<T>> {
    const startTime = Date.now();
    const checkInterval = 50; // ms

    return new Promise((resolve, reject) => {
      const check = async () => {
        const pool = this.pools.get(connectorId);
        const opts = this.options.get(connectorId);

        if (!pool || !opts) {
          reject(new PoolNotFoundError(connectorId));
          return;
        }

        // Check timeout
        if (Date.now() - startTime > timeoutMs) {
          reject(new PoolAcquireTimeoutError(connectorId));
          return;
        }

        // Try to find an idle connection
        const idleConn = pool.find((c) => !c.inUse);
        if (idleConn) {
          idleConn.inUse = true;
          idleConn.lastUsedAt = new Date();
          idleConn.useCount++;
          resolve(idleConn);
          return;
        }

        // Check if we can create a new connection now
        if (pool.length < opts.max) {
          try {
            const conn = await this.createConnection(connectorId);
            resolve(conn);
            return;
          } catch (error) {
            reject(error);
            return;
          }
        }

        // Continue waiting
        setTimeout(check, checkInterval);
      };

      check();
    });
  }

  /**
   * Start the eviction loop to clean up idle connections
   */
  private startEvictionLoop(): void {
    this.evictionInterval = setInterval(() => {
      this.evictIdleConnections();
    }, DEFAULT_OPTIONS.evictionRunIntervalMs);

    // Don't prevent process from exiting
    if (this.evictionInterval.unref) {
      this.evictionInterval.unref();
    }
  }

  /**
   * Evict idle and expired connections
   */
  private async evictIdleConnections(): Promise<void> {
    const now = Date.now();

    for (const [connectorId, pool] of this.pools) {
      const opts = this.options.get(connectorId);
      if (!opts) continue;

      const toEvict: string[] = [];

      for (const conn of pool) {
        if (conn.inUse) continue;

        const idleTime = now - conn.lastUsedAt.getTime();
        const age = now - conn.createdAt.getTime();

        // Evict if idle too long or too old
        if (idleTime > opts.idleTimeoutMs || age > opts.maxConnectionAgeMs) {
          // Keep minimum connections if configured
          const currentCount = pool.length - toEvict.length;
          if (currentCount > opts.min) {
            toEvict.push(conn.connectionId);
          }
        }
      }

      // Destroy evicted connections
      for (const connectionId of toEvict) {
        await this.destroy(connectorId, connectionId);
      }
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let globalPool: ConnectionPool | null = null;

/**
 * Get the global connection pool instance
 *
 * @returns Global connection pool
 */
export function getConnectionPool(): ConnectionPool {
  if (!globalPool) {
    globalPool = new ConnectionPool();
  }
  return globalPool;
}

/**
 * Reset the global connection pool (for testing)
 */
export async function resetConnectionPool(): Promise<void> {
  if (globalPool) {
    await globalPool.shutdown();
    globalPool = null;
  }
}
