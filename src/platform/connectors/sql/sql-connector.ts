/**
 * Base SQL Connector
 *
 * Abstract base class for SQL database connectors.
 * Provides common interface for SQL Server and PostgreSQL.
 */

import type {
  SqlConnectorConfig,
  SqlCredentials,
  SqlQueryResult,
  TableSchema,
  TableRelationship,
  SqlDialect,
  ConnectionHealth,
  FieldMetadata,
} from "./types.js";

/**
 * Abstract base class for SQL connectors
 */
export abstract class SqlConnector {
  protected config: SqlConnectorConfig;
  protected credentials: SqlCredentials;
  protected connected: boolean = false;

  constructor(config: SqlConnectorConfig, credentials: SqlCredentials) {
    this.config = config;
    this.credentials = credentials;
  }

  /**
   * Get the SQL dialect for this connector
   */
  abstract get dialect(): SqlDialect;

  /**
   * Get the default schema for this dialect
   */
  abstract get defaultSchema(): string;

  /**
   * Connect to the database
   */
  abstract connect(): Promise<void>;

  /**
   * Disconnect from the database
   */
  abstract disconnect(): Promise<void>;

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Execute a parameterized query
   * @param sql - SQL query string
   * @param params - Query parameters (optional)
   */
  abstract executeQuery(sql: string, params?: Record<string, unknown>): Promise<SqlQueryResult>;

  /**
   * Test the database connection
   */
  async testConnection(): Promise<ConnectionHealth> {
    const startTime = Date.now();
    try {
      // Simple query to test connectivity
      const testQuery = this.getTestQuery();
      await this.executeQuery(testQuery);

      return {
        healthy: true,
        latencyMs: Date.now() - startTime,
        lastConnected: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get the test query for this dialect
   */
  protected abstract getTestQuery(): string;

  /**
   * Get all tables in the database
   */
  abstract getTables(): Promise<TableSchema[]>;

  /**
   * Get all foreign key relationships
   */
  abstract getRelationships(): Promise<TableRelationship[]>;

  /**
   * Quote an identifier (table name, column name)
   */
  abstract quoteIdentifier(identifier: string): string;

  /**
   * Get the effective schema name
   */
  getSchema(): string {
    return this.config.schema ?? this.defaultSchema;
  }

  /**
   * Get configuration (excluding sensitive data)
   */
  getConfig(): Omit<SqlConnectorConfig, "password"> {
    return { ...this.config };
  }

  /**
   * Normalize field metadata to common format
   */
  protected abstract normalizeFieldMetadata(rawFields: unknown): FieldMetadata[];

  /**
   * Map native data type to normalized type
   */
  protected abstract mapDataType(nativeType: string): string;
}

/**
 * Factory function to create a SQL connector
 */
export function createSqlConnector(
  dialect: SqlDialect,
  config: SqlConnectorConfig,
  credentials: SqlCredentials,
): SqlConnector {
  // Lazy import to avoid circular dependencies
  // This will be implemented by the specific client modules
  throw new Error(
    `Use createMssqlClient or createPostgresClient directly. ` +
      `Factory not available for dialect: ${dialect}`,
  );
}

/**
 * Default configuration values
 */
export const DEFAULT_SQL_CONFIG: Partial<SqlConnectorConfig> = {
  connectionTimeout: 30000,
  requestTimeout: 30000,
  poolMax: 10,
  poolMin: 0,
  poolIdleTimeout: 30000,
  encrypt: true,
  trustServerCertificate: false,
};

/**
 * Merge user config with defaults
 */
export function mergeWithDefaults(config: SqlConnectorConfig): SqlConnectorConfig {
  return {
    ...DEFAULT_SQL_CONFIG,
    ...config,
  };
}
