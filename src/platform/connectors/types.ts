/**
 * Connector Types
 *
 * TypeScript interfaces and types for the connector framework.
 * Supports SQL Server, PostgreSQL, MySQL, Dataverse, and Salesforce.
 *
 * @see docs/IMPLEMENTATION-PLAN-PHASE6.md
 */

import type { ConnectionType, ConnectionStatus, Prisma } from "@prisma/client";

// Re-export Prisma enums for convenience
export { ConnectionType, ConnectionStatus } from "@prisma/client";

// =============================================================================
// CONNECTION CONFIGURATION
// =============================================================================

/**
 * Base configuration shared by all connection types
 */
export interface BaseConnectionConfig {
  /** Database host or environment URL */
  host?: string;
  /** Database port */
  port?: number;
  /** Database name */
  database?: string;
  /** Schema name (for SQL databases) */
  schema?: string;
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
  /** Request timeout in milliseconds */
  requestTimeout?: number;
  /** Enable SSL/TLS */
  encrypt?: boolean;
  /** Trust server certificate (for self-signed) */
  trustServerCertificate?: boolean;
}

/**
 * SQL Server specific configuration
 */
export interface SqlServerConfig extends BaseConnectionConfig {
  /** Instance name for named instances */
  instanceName?: string;
  /** Enable Multiple Active Result Sets */
  enableArithAbort?: boolean;
}

/**
 * PostgreSQL specific configuration
 */
export interface PostgresConfig extends BaseConnectionConfig {
  /** SSL mode: disable, allow, prefer, require, verify-ca, verify-full */
  sslMode?: "disable" | "allow" | "prefer" | "require" | "verify-ca" | "verify-full";
  /** Application name for pg_stat_activity */
  applicationName?: string;
}

/**
 * MySQL specific configuration
 */
export interface MySqlConfig extends BaseConnectionConfig {
  /** Character set */
  charset?: string;
  /** Timezone */
  timezone?: string;
}

/**
 * Dataverse (Dynamics CRM) specific configuration
 */
export interface DataverseConfig {
  /** Dataverse environment URL (e.g., org123.crm.dynamics.com) */
  environmentUrl: string;
  /** Azure AD tenant ID */
  tenantId: string;
  /** TDS endpoint port (default: 5558) */
  tdsPort?: number;
  /** Use REST API fallback */
  useRestFallback?: boolean;
}

/**
 * Salesforce specific configuration
 */
export interface SalesforceConfig {
  /** Salesforce instance URL */
  instanceUrl?: string;
  /** Salesforce login URL (default: login.salesforce.com) */
  loginUrl?: string;
  /** API version (default: v59.0) */
  apiVersion?: string;
  /** Enable sandbox mode */
  isSandbox?: boolean;
}

/**
 * Union type for all connection configurations
 */
export type ConnectionConfig =
  | SqlServerConfig
  | PostgresConfig
  | MySqlConfig
  | DataverseConfig
  | SalesforceConfig;

// =============================================================================
// CONNECTION CREDENTIALS
// =============================================================================

/**
 * Base credentials with username/password
 */
export interface UsernamePasswordCredentials {
  username: string;
  password: string;
}

/**
 * OAuth credentials for Dataverse/Salesforce
 */
export interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken?: string;
  accessToken?: string;
  tokenExpiry?: string;
}

/**
 * Salesforce username/password with security token
 */
export interface SalesforceCredentials {
  username: string;
  password: string;
  securityToken?: string;
}

/**
 * Union type for all credential types
 */
export type ConnectionCredentials =
  | UsernamePasswordCredentials
  | OAuthCredentials
  | SalesforceCredentials;

// =============================================================================
// CONNECTOR INPUT/OUTPUT TYPES
// =============================================================================

/**
 * Input for creating a new connector
 */
export interface ConnectorCreateInput {
  organizationId: string;
  type: ConnectionType;
  name: string;
  description?: string;
  config: ConnectionConfig;
  credentials?: ConnectionCredentials;
  isReadOnly?: boolean;
  createdBy?: string;
}

/**
 * Input for updating a connector
 */
export interface ConnectorUpdateInput {
  name?: string;
  description?: string;
  config?: ConnectionConfig;
  credentials?: ConnectionCredentials;
  isReadOnly?: boolean;
  status?: ConnectionStatus;
}

/**
 * Connector with schema hints included
 */
export interface ConnectorWithHints {
  id: string;
  organizationId: string;
  type: ConnectionType;
  name: string;
  description: string | null;
  config: ConnectionConfig;
  status: ConnectionStatus;
  lastHealthCheck: Date | null;
  healthMessage: string | null;
  isReadOnly: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  schemaHints: SchemaHintRecord[];
  schemaCache: SchemaCacheRecord | null;
}

/**
 * Schema hint database record
 */
export interface SchemaHintRecord {
  id: string;
  connectionId: string;
  tableName: string;
  columnName: string | null;
  description: string;
  pattern: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
}

/**
 * Schema cache database record
 */
export interface SchemaCacheRecord {
  id: string;
  connectionId: string;
  tables: SchemaTable[];
  relationships: SchemaRelationship[] | null;
  cachedAt: Date;
  expiresAt: Date;
}

// =============================================================================
// SCHEMA TYPES
// =============================================================================

/**
 * Schema table with columns
 */
export interface SchemaTable {
  name: string;
  schema?: string;
  columns: SchemaColumn[];
  primaryKey?: string[];
  rowCount?: number;
}

/**
 * Schema column definition
 */
export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  defaultValue?: string | null;
  maxLength?: number;
  precision?: number;
  scale?: number;
  description?: string;
}

/**
 * Relationship between tables
 */
export interface SchemaRelationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  constraintName?: string;
  type: "one-to-one" | "one-to-many" | "many-to-many";
}

// =============================================================================
// SCHEMA HINT TYPES
// =============================================================================

/**
 * Input for creating a schema hint
 */
export interface SchemaHintInput {
  connectionId: string;
  tableName: string;
  columnName?: string;
  description: string;
  pattern?: string;
  createdBy?: string;
}

/**
 * Input for updating a schema hint
 */
export interface SchemaHintUpdateInput {
  tableName?: string;
  columnName?: string | null;
  description?: string;
  pattern?: string | null;
}

// =============================================================================
// CONNECTION POOL TYPES
// =============================================================================

/**
 * Pooled connection wrapper
 */
export interface PooledConnection<T = unknown> {
  /** The underlying connection object */
  connection: T;
  /** Connection ID */
  connectionId: string;
  /** Connector ID this connection belongs to */
  connectorId: string;
  /** When this connection was created */
  createdAt: Date;
  /** Last time this connection was used */
  lastUsedAt: Date;
  /** Number of times this connection has been used */
  useCount: number;
  /** Whether this connection is currently in use */
  inUse: boolean;
}

/**
 * Pool statistics
 */
export interface PoolStats {
  connectorId: string;
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  pendingRequests: number;
  totalCreated: number;
  totalDestroyed: number;
}

/**
 * Pool configuration options
 */
export interface PoolOptions {
  /** Minimum number of connections to maintain */
  min?: number;
  /** Maximum number of connections allowed */
  max?: number;
  /** Time in ms before idle connection is destroyed */
  idleTimeoutMs?: number;
  /** Time in ms to wait for connection before error */
  acquireTimeoutMs?: number;
  /** Time in ms between eviction runs */
  evictionRunIntervalMs?: number;
  /** Maximum age of a connection in ms */
  maxConnectionAgeMs?: number;
}

// =============================================================================
// HEALTH CHECK TYPES
// =============================================================================

/**
 * Result of a health check
 */
export interface HealthCheckResult {
  connectorId: string;
  healthy: boolean;
  latencyMs: number;
  message?: string;
  checkedAt: Date;
  details?: Record<string, unknown>;
}

/**
 * Health checker options
 */
export interface HealthCheckOptions {
  /** Interval between health checks in ms */
  intervalMs?: number;
  /** Timeout for each health check in ms */
  timeoutMs?: number;
  /** Number of consecutive failures before marking unhealthy */
  failureThreshold?: number;
  /** Number of consecutive successes before marking healthy */
  successThreshold?: number;
}

// =============================================================================
// QUERY TYPES
// =============================================================================

/**
 * Query execution result
 */
export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
  fields?: QueryField[];
  executionTimeMs?: number;
}

/**
 * Query field metadata
 */
export interface QueryField {
  name: string;
  type: string;
  table?: string;
}

/**
 * Query execution options
 */
export interface QueryOptions {
  /** Query timeout in ms */
  timeoutMs?: number;
  /** Maximum rows to return */
  maxRows?: number;
  /** Parameter values for parameterized queries */
  parameters?: Record<string, unknown>;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Check if config is SQL Server config
 */
export function isSqlServerConfig(config: ConnectionConfig): config is SqlServerConfig {
  return "instanceName" in config || "enableArithAbort" in config;
}

/**
 * Check if config is PostgreSQL config
 */
export function isPostgresConfig(config: ConnectionConfig): config is PostgresConfig {
  return "sslMode" in config || "applicationName" in config;
}

/**
 * Check if config is MySQL config
 */
export function isMySqlConfig(config: ConnectionConfig): config is MySqlConfig {
  return "charset" in config || "timezone" in config;
}

/**
 * Check if config is Dataverse config
 */
export function isDataverseConfig(config: ConnectionConfig): config is DataverseConfig {
  return "environmentUrl" in config && "tenantId" in config;
}

/**
 * Check if config is Salesforce config
 */
export function isSalesforceConfig(config: ConnectionConfig): config is SalesforceConfig {
  return "instanceUrl" in config || "loginUrl" in config || "isSandbox" in config;
}

/**
 * Check if credentials are OAuth credentials
 */
export function isOAuthCredentials(creds: ConnectionCredentials): creds is OAuthCredentials {
  return "clientId" in creds && "clientSecret" in creds;
}

/**
 * Check if credentials are username/password credentials
 */
export function isUsernamePasswordCredentials(
  creds: ConnectionCredentials,
): creds is UsernamePasswordCredentials {
  return "username" in creds && "password" in creds && !("securityToken" in creds);
}

/**
 * Check if credentials are Salesforce credentials
 */
export function isSalesforceCredentials(
  creds: ConnectionCredentials,
): creds is SalesforceCredentials {
  return "username" in creds && "password" in creds && "securityToken" in creds;
}
