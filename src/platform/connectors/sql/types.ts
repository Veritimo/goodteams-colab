/**
 * SQL Connector Types
 *
 * Type definitions for SQL Server and PostgreSQL integrations.
 */

/**
 * SQL connector configuration
 */
export interface SqlConnectorConfig {
  /** Database server hostname */
  host: string;
  /** Database server port */
  port: number;
  /** Database name */
  database: string;
  /** Schema name (defaults to 'dbo' for MSSQL, 'public' for PostgreSQL) */
  schema?: string;
  /** Enable TLS encryption */
  encrypt?: boolean;
  /** Trust self-signed certificates (development only) */
  trustServerCertificate?: boolean;
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
  /** Request timeout in milliseconds */
  requestTimeout?: number;
  /** Maximum connection pool size */
  poolMax?: number;
  /** Minimum connection pool size */
  poolMin?: number;
  /** Connection idle timeout in milliseconds */
  poolIdleTimeout?: number;
}

/**
 * Database credentials
 */
export interface SqlCredentials {
  /** Database username */
  username: string;
  /** Database password */
  password: string;
}

/**
 * Query result from SQL execution
 */
export interface SqlQueryResult {
  /** Result rows */
  rows: Record<string, unknown>[];
  /** Number of rows returned/affected */
  rowCount: number;
  /** Field metadata */
  fields: FieldMetadata[];
  /** Execution time in milliseconds */
  executionTime?: number;
}

/**
 * Field metadata from query results
 */
export interface FieldMetadata {
  /** Column name */
  name: string;
  /** SQL data type */
  dataType: string;
  /** Whether the column allows nulls */
  nullable?: boolean;
}

/**
 * Table schema information
 */
export interface TableSchema {
  /** Table name */
  name: string;
  /** Schema/namespace name */
  schema: string;
  /** Column definitions */
  columns: ColumnSchema[];
  /** Table description/comment */
  description?: string;
}

/**
 * Column schema information
 */
export interface ColumnSchema {
  /** Column name */
  name: string;
  /** SQL data type */
  dataType: string;
  /** Whether the column allows nulls */
  nullable: boolean;
  /** Whether the column is a primary key */
  isPrimaryKey: boolean;
  /** Whether the column is a foreign key */
  isForeignKey: boolean;
  /** Foreign key reference (if applicable) */
  references?: ForeignKeyReference;
  /** Default value expression */
  defaultValue?: string;
  /** Column description/comment */
  description?: string;
  /** Maximum length for string types */
  maxLength?: number;
  /** Numeric precision */
  precision?: number;
  /** Numeric scale */
  scale?: number;
}

/**
 * Foreign key reference information
 */
export interface ForeignKeyReference {
  /** Referenced table name */
  table: string;
  /** Referenced column name */
  column: string;
  /** Referenced schema name */
  schema?: string;
}

/**
 * Foreign key relationship between tables
 */
export interface TableRelationship {
  /** Relationship name (constraint name) */
  name: string;
  /** Source table */
  fromTable: string;
  /** Source schema */
  fromSchema: string;
  /** Source column */
  fromColumn: string;
  /** Target table */
  toTable: string;
  /** Target schema */
  toSchema: string;
  /** Target column */
  toColumn: string;
}

/**
 * Database dialect type
 */
export type SqlDialect = "mssql" | "postgres";

/**
 * Query execution options
 */
export interface QueryExecutionOptions {
  /** Maximum number of rows to return */
  rowLimit?: number;
  /** Query timeout in milliseconds */
  timeout?: number;
  /** Enforce read-only mode */
  readOnly?: boolean;
  /** Enable query result streaming */
  stream?: boolean;
  /** Include execution statistics */
  includeStats?: boolean;
}

/**
 * Query generation hints
 */
export interface QueryGenerationHint {
  /** Table name this hint applies to */
  tableName: string;
  /** Column name (optional, for column-specific hints) */
  columnName?: string;
  /** Natural language description of the hint */
  description: string;
  /** SQL pattern example */
  pattern?: string;
}

/**
 * Options for query generation
 */
export interface QueryGenerationOptions {
  /** Maximum number of results to suggest in generated query */
  suggestedLimit?: number;
  /** Only allow SELECT queries */
  readOnly?: boolean;
  /** Include column aliases for clarity */
  includeAliases?: boolean;
  /** Preferred date format */
  dateFormat?: string;
}

/**
 * Generated SQL result
 */
export interface GeneratedSqlResult {
  /** The generated SQL query */
  sql: string;
  /** Natural language explanation of the query */
  explanation: string;
  /** Parameters extracted from the prompt */
  parameters?: Record<string, unknown>;
  /** Confidence score (0-1) */
  confidence?: number;
  /** Warnings or suggestions */
  warnings?: string[];
}

/**
 * Schema cache entry
 */
export interface SchemaCache {
  /** Connector ID this cache belongs to */
  connectorId: string;
  /** Cached table schemas */
  tables: TableSchema[];
  /** Cached relationships */
  relationships: TableRelationship[];
  /** When the cache was created */
  cachedAt: Date;
  /** When the cache expires */
  expiresAt: Date;
}

/**
 * Connection health status
 */
export interface ConnectionHealth {
  /** Whether the connection is healthy */
  healthy: boolean;
  /** Latency in milliseconds */
  latencyMs?: number;
  /** Error message if unhealthy */
  error?: string;
  /** Last successful connection time */
  lastConnected?: Date;
}

/**
 * Query audit entry
 */
export interface QueryAuditEntry {
  /** Unique audit ID */
  id: string;
  /** Connector ID */
  connectorId: string;
  /** User who executed the query */
  userId: string;
  /** Organization ID */
  organizationId: string;
  /** The executed SQL query */
  sql: string;
  /** Query parameters */
  parameters?: Record<string, unknown>;
  /** Number of rows returned/affected */
  rowCount: number;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Whether the query succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** When the query was executed */
  timestamp: Date;
  /** Client IP address */
  clientIp?: string;
}

/**
 * Safe execution result
 */
export interface SafeExecutionResult extends SqlQueryResult {
  /** Whether the query was truncated due to row limit */
  truncated: boolean;
  /** Whether the query timed out */
  timedOut: boolean;
  /** Audit entry for this execution */
  audit?: QueryAuditEntry;
}

/**
 * SQL validation result
 */
export interface SqlValidationResult {
  /** Whether the SQL is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Detected query type (SELECT, INSERT, etc.) */
  queryType?: string;
  /** Tables referenced in the query */
  referencedTables?: string[];
}
