/**
 * Salesforce Connector
 *
 * Complete Salesforce integration for GoodTeams platform:
 * - OAuth 2.0 authentication
 * - SOQL query execution
 * - Bulk API 2.0 operations
 * - Metadata/schema discovery
 * - Natural language to SOQL generation
 * - Reports API access
 *
 * @example
 * ```typescript
 * import {
 *   SalesforceConnector,
 *   SoqlClient,
 *   MetadataClient,
 *   BulkClient,
 *   SalesforceOAuthHandler,
 * } from './connectors/salesforce';
 *
 * // Create connector
 * const connector = new SalesforceConnector({
 *   credentials: {
 *     clientId: 'your_client_id',
 *     clientSecret: 'your_client_secret',
 *     refreshToken: 'refresh_token',
 *   },
 *   config: { instanceUrl: 'https://your-org.salesforce.com' },
 *   organizationId: 'org-id',
 * });
 *
 * // Execute SOQL
 * const soqlClient = new SoqlClient(connector);
 * const accounts = await soqlClient.executeQuery('SELECT Id, Name FROM Account LIMIT 10');
 *
 * // Get metadata
 * const metadataClient = new MetadataClient(connector);
 * const accountMeta = await metadataClient.describeSObject('Account');
 *
 * // Bulk operations
 * const bulkClient = new BulkClient(connector);
 * const result = await bulkClient.bulkCreate('Account', [{ Name: 'New Account' }]);
 * ```
 *
 * @module
 */

// =============================================================================
// TYPES
// =============================================================================

export type {
  // Configuration
  SalesforceConfig,
  SalesforceCredentials,
  SalesforceConnectionInfo,
  // SObject Metadata
  SObjectMetadata,
  SFieldMetadata,
  SalesforceFieldType,
  PicklistValue,
  ChildRelationship,
  RecordTypeInfo,
  GlobalDescribeResult,
  SObjectSummary,
  // Query Types
  SoqlResult,
  SalesforceRecord,
  QueryOptions,
  // Bulk API Types
  BulkJobInfo,
  BulkJobState,
  BulkOperation,
  BulkRecordResult,
  BulkError,
  BulkOptions,
  BulkOperationSummary,
  // Report Types
  ReportSummary,
  ReportFormat,
  ReportMetadata,
  ReportResult,
  ReportColumn,
  ReportFilter,
  ReportFilterOverride,
  ReportRow,
  ReportFactMapEntry,
  // SOQL Generation Types
  SoqlHint,
  GeneratedSoql,
  // Health/Status Types
  ConnectionHealth,
  ApiLimits,
  LimitInfo,
  // Cache Types
  CachedSchema,
  SchemaCacheOptions,
  // Error Types
  SalesforceApiError,
  OAuthError,
} from "./types.js";

// =============================================================================
// CONNECTOR
// =============================================================================

export {
  // Main connector class
  SalesforceConnector,
  // Error class
  SalesforceConnectorError,
  // Factory functions
  createSalesforceConnector,
  createTestConnector,
  // Constants
  DEFAULT_API_VERSION,
  DEFAULT_LOGIN_URL,
  SANDBOX_LOGIN_URL,
} from "./salesforce-connector.js";

// =============================================================================
// OAUTH
// =============================================================================

export {
  // OAuth handler class
  SalesforceOAuthHandler,
  // Factory function
  createOAuthHandler,
  // Default scopes
  DEFAULT_SCOPES,
  EXTENDED_SCOPES,
  // Types
  type OAuthTokenResponse,
  type SalesforceIdentity,
  type OAuthHandlerOptions,
  type AuthorizationUrlOptions,
} from "./oauth-handler.js";

// =============================================================================
// SOQL CLIENT
// =============================================================================

export {
  // SOQL client class
  SoqlClient,
  // Factory function
  createSoqlClient,
  // Utility functions
  escapeSoqlString,
  buildInClause,
  buildDateLiteral,
  buildDateTimeLiteral,
  // Constants
  QUERY_BATCH_SIZE,
  MAX_QUERY_RECORDS,
  // Types
  type QueryPlan,
  type QueryPlanNote,
} from "./soql-client.js";

// =============================================================================
// METADATA CLIENT
// =============================================================================

export {
  // Metadata client class
  MetadataClient,
  // Factory function
  createMetadataClient,
} from "./metadata-client.js";

// =============================================================================
// BULK CLIENT
// =============================================================================

export {
  // Bulk client class
  BulkClient,
  // Factory function
  createBulkClient,
} from "./bulk-client.js";

// =============================================================================
// SOQL GENERATOR
// =============================================================================

export {
  // SOQL generator class
  SoqlGenerator,
  // Factory function
  createSoqlGenerator,
  // Utility functions
  buildSoqlSelect,
  getDateLiteral,
  getLastNDaysLiteral,
  getNextNDaysLiteral,
  // Types
  type LlmProvider,
  type SoqlGenerationOptions,
} from "./soql-generator.js";

// =============================================================================
// REPORT CLIENT
// =============================================================================

export {
  // Report client class
  ReportClient,
  // Factory function
  createReportClient,
  // Types
  type ListReportsOptions,
  type RunReportOptions,
  type ParsedReportData,
} from "./report-client.js";
