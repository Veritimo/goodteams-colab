/**
 * SQL Connectors Module
 *
 * SQL Server and PostgreSQL integration for GoodTeams.
 * Provides database connectivity, schema introspection, query generation, and safe execution.
 *
 * Usage:
 *   import {
 *     createMssqlClient,
 *     createPostgresClient,
 *     createSchemaIntrospector,
 *     createQueryGenerator,
 *     createQueryExecutor,
 *   } from '@/platform/connectors/sql';
 *
 *   // Create a PostgreSQL client
 *   const client = createPostgresClient(
 *     { host: 'localhost', port: 5432, database: 'mydb' },
 *     { username: 'user', password: 'pass' }
 *   );
 *
 *   // Connect and query
 *   await client.connect();
 *   const result = await client.executeQuery('SELECT * FROM users WHERE id = @id', { id: 1 });
 *   await client.disconnect();
 */

export const SQL_MODULE_VERSION = "1.0.0";

// Types
export type {
  SqlConnectorConfig,
  SqlCredentials,
  SqlQueryResult,
  FieldMetadata,
  TableSchema,
  ColumnSchema,
  ForeignKeyReference,
  TableRelationship,
  SqlDialect,
  QueryExecutionOptions,
  QueryGenerationHint,
  QueryGenerationOptions,
  GeneratedSqlResult,
  SchemaCache,
  ConnectionHealth,
  QueryAuditEntry,
  SafeExecutionResult,
  SqlValidationResult,
} from "./types.js";

// Base SQL Connector
export { SqlConnector, DEFAULT_SQL_CONFIG, mergeWithDefaults } from "./sql-connector.js";

// SQL Server Client
export { MssqlClient, createMssqlClient } from "./mssql-client.js";

// PostgreSQL Client
export { PostgresClient, createPostgresClient } from "./postgres-client.js";

// Schema Introspector
export { SchemaIntrospector, createSchemaIntrospector } from "./schema-introspector.js";

// Query Generator
export {
  QueryGenerator,
  createQueryGenerator,
  MockLlmProvider,
  type LlmProvider,
} from "./query-generator.js";

// Query Executor
export {
  QueryExecutor,
  createQueryExecutor,
  QueryExecutionError,
  TimeoutError,
  DEFAULT_EXECUTION_OPTIONS,
  ConsoleAuditLogger,
  NoOpAuditLogger,
  InMemoryAuditLogger,
  type AuditLogger,
  type ExecutionContext,
} from "./query-executor.js";

/**
 * Factory function to create a SQL connector based on dialect
 */
export function createSqlConnector(
  dialect: "mssql" | "postgres",
  config: import("./types.js").SqlConnectorConfig,
  credentials: import("./types.js").SqlCredentials,
): import("./sql-connector.js").SqlConnector {
  if (dialect === "mssql") {
    const { createMssqlClient } = require("./mssql-client.js");
    return createMssqlClient(config, credentials);
  }

  if (dialect === "postgres") {
    const { createPostgresClient } = require("./postgres-client.js");
    return createPostgresClient(config, credentials);
  }

  throw new Error(`Unsupported SQL dialect: ${dialect}`);
}
