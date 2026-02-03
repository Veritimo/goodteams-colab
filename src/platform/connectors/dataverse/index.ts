/**
 * Dataverse Connector Module
 *
 * Microsoft Dynamics CRM / Dataverse integration for GoodTeams.
 * Supports SQL queries via TDS endpoint and REST API operations.
 *
 * @example
 * ```typescript
 * import {
 *   createDataverseConnector,
 *   DataverseConfig,
 *   DataverseCredentials,
 * } from './platform/connectors/dataverse';
 *
 * const connector = createDataverseConnector(
 *   { environmentUrl: 'org123.crm.dynamics.com' },
 *   { tenantId: '...', clientId: '...', clientSecret: '...' }
 * );
 *
 * // Execute SQL query via TDS
 * const result = await connector.executeQuery(
 *   'SELECT TOP 10 fullname, emailaddress1 FROM contact WHERE statecode = 0'
 * );
 *
 * // Or use natural language
 * const analysis = await connector.runAnalysis('Show me active contacts from New York');
 * ```
 */

// Main connector
export {
  DataverseConnector,
  createDataverseConnector,
  createDataverseConnectorFromEnv,
} from "./dataverse-connector.js";
export type { DataverseConnectorOptions } from "./dataverse-connector.js";

// TDS Client (SQL queries)
export { TdsClient, createTdsClient } from "./tds-client.js";
export type { TdsClientOptions } from "./tds-client.js";

// REST Client (CRUD operations)
export { RestClient, createRestClient } from "./rest-client.js";
export type {
  RestClientOptions,
  ODataQueryOptions,
  BatchRequest,
  BatchResponse,
} from "./rest-client.js";

// Entity Metadata
export { EntityMetadataManager, createMetadataManager } from "./entity-metadata.js";
export type {
  MetadataManagerOptions,
  SchemaContext,
  EntitySchemaInfo,
  ColumnSchemaInfo,
} from "./entity-metadata.js";

// Bulk Operations
export { BulkOperationsManager, createBulkOperationsManager } from "./bulk-operations.js";
export type { BulkOperationsOptions, PermissionChecker } from "./bulk-operations.js";

// Query Generator
export { CrmQueryGenerator, createQueryGenerator, MockLLMProvider } from "./crm-query-generator.js";
export type {
  QueryGenerationOptions,
  QueryGenerationResult,
  LLMProvider,
} from "./crm-query-generator.js";

// Types
export type {
  DataverseConfig,
  DataverseCredentials,
  ResolvedDataverseConfig,
  EntityMetadata,
  AttributeMetadata,
  OptionSetValue,
  SchemaHint,
  QueryResult,
  ColumnInfo,
  BulkOperationOptions,
  BulkOperationResult,
  BulkOperationError,
  HealthCheckResult,
  CrmPermission,
} from "./types.js";

// Constants and Errors
export {
  CRM_PERMISSIONS,
  DATAVERSE_DEFAULTS,
  DataverseError,
  TdsConnectionError,
  TdsQueryError,
  RestApiError,
  PermissionDeniedError,
  ReadOnlyModeError,
} from "./types.js";
