/**
 * Connectors Module
 *
 * Unified connector infrastructure for database and CRM integrations.
 * Supports SQL Server, PostgreSQL, MySQL, Dataverse, and Salesforce.
 *
 * @see docs/IMPLEMENTATION-PLAN-PHASE6.md
 */

// Types
export {
  // Enums (re-exported from Prisma)
  ConnectionType,
  ConnectionStatus,

  // Config types
  type BaseConnectionConfig,
  type SqlServerConfig,
  type PostgresConfig,
  type MySqlConfig,
  type DataverseConfig,
  type SalesforceConfig,
  type ConnectionConfig,

  // Credential types
  type UsernamePasswordCredentials,
  type OAuthCredentials,
  type SalesforceCredentials,
  type ConnectionCredentials,

  // CRUD types
  type ConnectorCreateInput,
  type ConnectorUpdateInput,
  type ConnectorWithHints,
  type SchemaHintRecord,
  type SchemaCacheRecord,

  // Schema types
  type SchemaTable,
  type SchemaColumn,
  type SchemaRelationship,
  type SchemaHintInput,
  type SchemaHintUpdateInput,

  // Pool types
  type PooledConnection,
  type PoolStats,
  type PoolOptions,

  // Health check types
  type HealthCheckResult,
  type HealthCheckOptions,

  // Query types
  type QueryResult,
  type QueryField,
  type QueryOptions,

  // Type guards
  isSqlServerConfig,
  isPostgresConfig,
  isMySqlConfig,
  isDataverseConfig,
  isSalesforceConfig,
  isOAuthCredentials,
  isUsernamePasswordCredentials,
  isSalesforceCredentials,
} from "./types.js";

// Connector Service - CRUD and encryption
export {
  createConnector,
  getConnector,
  getConnectorWithHints,
  getConnectorWithCredentials,
  listConnectors,
  updateConnector,
  deleteConnector,
  updateConnectorStatus,
  connectorExists,
  getConnectorsByStatus,
  countConnectors,
  getEncryptionKey,
  encryptCredentials,
  decryptCredentials,
  ConnectorNotFoundError,
  ConnectorEncryptionKeyMissingError,
  ConnectorEncryptionError,
  ConnectorAlreadyExistsError,
} from "./connector-service.js";

// Connection Pool
export {
  ConnectionPool,
  getConnectionPool,
  resetConnectionPool,
  PoolAcquireTimeoutError,
  PoolExhaustedError,
  PoolNotFoundError,
} from "./connection-pool.js";

// Health Checker
export {
  HealthChecker,
  createHealthChecker,
  getHealthChecker,
  resetHealthChecker,
  tcpHealthCheck,
  httpHealthCheck,
  HealthCheckTimeoutError,
} from "./health-checker.js";

// Schema Hints (re-exported from submodule)
export {
  // Hints Service
  createSchemaHint,
  getSchemaHint,
  listSchemaHints,
  updateSchemaHint,
  deleteSchemaHint,
  deleteAllSchemaHints,
  bulkCreateSchemaHints,
  countSchemaHints,
  getSchemaCache,
  updateSchemaCache,
  invalidateSchemaCache,
  refreshSchemaCache,
  SchemaHintNotFoundError,
  SchemaHintDuplicateError,
  ConnectionNotFoundError,

  // Hints Engine
  HintsEngine,
  applyHintsToContext,
  formatHintsForLLM,
  getRelevantHints,
  buildQueryPromptContext,

  // Hints Engine types
  type QueryContext,
  type HintFormatOptions,
  type RelevantHintsOptions,
} from "./schema-hints/index.js";
