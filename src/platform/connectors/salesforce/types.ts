/**
 * Salesforce Connector Types
 *
 * Type definitions for Salesforce integration including:
 * - Configuration and credentials
 * - SObject metadata
 * - SOQL query results
 * - Bulk API types
 * - Report types
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Salesforce connector configuration
 */
export interface SalesforceConfig {
  /** Salesforce instance URL (set after OAuth) */
  instanceUrl?: string;
  /** API version (default: "59.0") */
  apiVersion?: string;
  /** Whether this is a sandbox org */
  sandbox?: boolean;
  /** Login URL override (useful for sandbox) */
  loginUrl?: string;
  /** Connection timeout in milliseconds */
  timeout?: number;
}

/**
 * Salesforce OAuth credentials
 */
export interface SalesforceCredentials {
  /** OAuth client ID (Consumer Key) */
  clientId: string;
  /** OAuth client secret (Consumer Secret) */
  clientSecret: string;
  /** OAuth refresh token */
  refreshToken?: string;
  /** OAuth access token */
  accessToken?: string;
  /** Token expiration time (epoch ms) */
  tokenExpiresAt?: number;
}

/**
 * Complete Salesforce connection info
 */
export interface SalesforceConnectionInfo {
  config: SalesforceConfig;
  credentials: SalesforceCredentials;
  /** Organization ID */
  organizationId: string;
  /** User ID (for delegated auth) */
  userId?: string;
}

// =============================================================================
// SOBJECT METADATA
// =============================================================================

/**
 * SObject (Salesforce Object) metadata
 */
export interface SObjectMetadata {
  /** API name of the object */
  name: string;
  /** User-friendly label */
  label: string;
  /** Plural label */
  labelPlural: string;
  /** Field definitions */
  fields: SFieldMetadata[];
  /** Key prefix (first 3 chars of record IDs) */
  keyPrefix: string;
  /** Whether the object can be queried */
  queryable: boolean;
  /** Whether records can be created */
  createable: boolean;
  /** Whether records can be updated */
  updateable: boolean;
  /** Whether records can be deleted */
  deletable: boolean;
  /** Whether the object is a custom object */
  custom: boolean;
  /** Child relationships */
  childRelationships?: ChildRelationship[];
  /** Record type info */
  recordTypeInfos?: RecordTypeInfo[];
}

/**
 * Field metadata for an SObject
 */
export interface SFieldMetadata {
  /** API name of the field */
  name: string;
  /** User-friendly label */
  label: string;
  /** Salesforce field type */
  type: SalesforceFieldType;
  /** Whether the field can be null */
  nillable: boolean;
  /** Whether the field can be set on create */
  createable: boolean;
  /** Whether the field can be updated */
  updateable: boolean;
  /** For reference fields, the related objects */
  referenceTo?: string[];
  /** For reference fields, the relationship name */
  relationshipName?: string;
  /** For picklist fields, the options */
  picklistValues?: PicklistValue[];
  /** Maximum length for string fields */
  length?: number;
  /** Precision for numeric fields */
  precision?: number;
  /** Scale for numeric fields */
  scale?: number;
  /** Default value */
  defaultValue?: unknown;
  /** Whether the field is unique */
  unique?: boolean;
  /** Whether the field is an external ID */
  externalId?: boolean;
  /** Whether the field is a name field */
  nameField?: boolean;
}

/**
 * Salesforce field types
 */
export type SalesforceFieldType =
  | "id"
  | "string"
  | "picklist"
  | "multipicklist"
  | "combobox"
  | "textarea"
  | "reference"
  | "boolean"
  | "int"
  | "double"
  | "currency"
  | "percent"
  | "phone"
  | "email"
  | "url"
  | "date"
  | "datetime"
  | "time"
  | "base64"
  | "address"
  | "location"
  | "encryptedstring"
  | "anyType";

/**
 * Picklist option
 */
export interface PicklistValue {
  value: string;
  label: string;
  active: boolean;
  defaultValue: boolean;
}

/**
 * Child relationship info
 */
export interface ChildRelationship {
  childSObject: string;
  field: string;
  relationshipName: string;
  cascadeDelete: boolean;
}

/**
 * Record type info
 */
export interface RecordTypeInfo {
  recordTypeId: string;
  name: string;
  developerName: string;
  defaultRecordTypeMapping: boolean;
  available: boolean;
}

/**
 * Global describe result - list of all objects
 */
export interface GlobalDescribeResult {
  encoding: string;
  maxBatchSize: number;
  sobjects: SObjectSummary[];
}

/**
 * Summary info for an SObject (from global describe)
 */
export interface SObjectSummary {
  name: string;
  label: string;
  labelPlural: string;
  keyPrefix: string;
  queryable: boolean;
  createable: boolean;
  updateable: boolean;
  deletable: boolean;
  custom: boolean;
}

// =============================================================================
// SOQL QUERY RESULTS
// =============================================================================

/**
 * SOQL query result
 */
export interface SoqlResult<T = Record<string, unknown>> {
  /** Total number of records matching the query */
  totalSize: number;
  /** Whether all records have been returned */
  done: boolean;
  /** Array of records */
  records: T[];
  /** URL to fetch next batch (if done is false) */
  nextRecordsUrl?: string;
}

/**
 * Base Salesforce record with standard fields
 */
export interface SalesforceRecord {
  Id: string;
  attributes?: {
    type: string;
    url: string;
  };
  Name?: string;
  CreatedDate?: string;
  CreatedById?: string;
  LastModifiedDate?: string;
  LastModifiedById?: string;
  SystemModstamp?: string;
  IsDeleted?: boolean;
  [key: string]: unknown;
}

/**
 * Query execution options
 */
export interface QueryOptions {
  /** Include deleted records (requires Salesforce "View All Data" permission) */
  includeDeleted?: boolean;
  /** Maximum records to return (for pagination) */
  maxRecords?: number;
  /** Timeout in milliseconds */
  timeout?: number;
}

// =============================================================================
// BULK API TYPES
// =============================================================================

/**
 * Bulk API job info
 */
export interface BulkJobInfo {
  id: string;
  operation: BulkOperation;
  object: string;
  state: BulkJobState;
  createdById: string;
  createdDate: string;
  systemModstamp: string;
  numberRecordsProcessed: number;
  numberRecordsFailed: number;
  totalProcessingTime: number;
  apiVersion: string;
  concurrencyMode: "Parallel" | "Serial";
  contentType: "CSV" | "JSON";
  externalIdFieldName?: string;
  lineEnding?: "LF" | "CRLF";
  columnDelimiter?: "COMMA" | "TAB" | "PIPE" | "SEMICOLON" | "CARET" | "BACKQUOTE";
}

/**
 * Bulk API operation types
 */
export type BulkOperation = "insert" | "update" | "upsert" | "delete" | "hardDelete" | "query";

/**
 * Bulk job states
 */
export type BulkJobState =
  | "Open"
  | "UploadComplete"
  | "InProgress"
  | "JobComplete"
  | "Aborted"
  | "Failed";

/**
 * Bulk operation result for a single record
 */
export interface BulkRecordResult {
  id?: string;
  success: boolean;
  created?: boolean;
  errors?: BulkError[];
}

/**
 * Bulk API error
 */
export interface BulkError {
  statusCode: string;
  message: string;
  fields?: string[];
}

/**
 * Bulk operation options
 */
export interface BulkOptions {
  /** External ID field for upsert operations */
  externalIdFieldName?: string;
  /** Batch size (default: 10000) */
  batchSize?: number;
  /** Poll interval in milliseconds (default: 2000) */
  pollInterval?: number;
  /** Poll timeout in milliseconds (default: 600000 = 10 min) */
  pollTimeout?: number;
  /** Concurrency mode */
  concurrencyMode?: "Parallel" | "Serial";
}

/**
 * Bulk operation summary
 */
export interface BulkOperationSummary {
  jobId: string;
  operation: BulkOperation;
  object: string;
  state: BulkJobState;
  totalRecords: number;
  successCount: number;
  failureCount: number;
  processingTime: number;
  results: BulkRecordResult[];
}

// =============================================================================
// REPORT TYPES
// =============================================================================

/**
 * Salesforce Report summary
 */
export interface ReportSummary {
  id: string;
  name: string;
  description?: string;
  folderName?: string;
  format: ReportFormat;
  lastRunDate?: string;
  reportType?: string;
}

/**
 * Report format types
 */
export type ReportFormat = "TABULAR" | "SUMMARY" | "MATRIX" | "JOINED";

/**
 * Report metadata
 */
export interface ReportMetadata {
  id: string;
  name: string;
  reportType: {
    type: string;
    label: string;
  };
  reportFormat: ReportFormat;
  detailColumns: ReportColumn[];
  reportFilters?: ReportFilter[];
  groupingsDown?: ReportGrouping[];
  groupingsAcross?: ReportGrouping[];
  aggregates?: ReportAggregate[];
}

/**
 * Report column definition
 */
export interface ReportColumn {
  name: string;
  label: string;
  type: string;
}

/**
 * Report filter
 */
export interface ReportFilter {
  column: string;
  operator: string;
  value: string;
}

/**
 * Report grouping
 */
export interface ReportGrouping {
  name: string;
  dateGranularity?: string;
  sortOrder: "Asc" | "Desc";
}

/**
 * Report aggregate
 */
export interface ReportAggregate {
  name: string;
  label: string;
  type: string;
}

/**
 * Report execution result
 */
export interface ReportResult {
  reportMetadata: ReportMetadata;
  factMap: Record<string, ReportFactMapEntry>;
  groupingsDown?: ReportGroupingInfo;
  groupingsAcross?: ReportGroupingInfo;
  hasDetailRows: boolean;
  reportExtendedMetadata?: Record<string, unknown>;
}

/**
 * Report fact map entry (contains actual data)
 */
export interface ReportFactMapEntry {
  rows?: ReportRow[];
  aggregates: ReportAggregateValue[];
}

/**
 * Report row
 */
export interface ReportRow {
  dataCells: ReportDataCell[];
}

/**
 * Report data cell
 */
export interface ReportDataCell {
  label: string;
  value: unknown;
}

/**
 * Report aggregate value
 */
export interface ReportAggregateValue {
  label: string;
  value: unknown;
}

/**
 * Grouping info in report results
 */
export interface ReportGroupingInfo {
  groupings: ReportGroupingValue[];
}

/**
 * Grouping value in report results
 */
export interface ReportGroupingValue {
  key: string;
  label: string;
  value: unknown;
  groupings?: ReportGroupingValue[];
}

/**
 * Report filter overrides for running reports
 */
export interface ReportFilterOverride {
  column: string;
  operator:
    | "equals"
    | "notEqual"
    | "lessThan"
    | "greaterThan"
    | "lessOrEqual"
    | "greaterOrEqual"
    | "contains"
    | "notContain"
    | "startsWith"
    | "includes"
    | "excludes";
  value: string;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Salesforce API error
 */
export interface SalesforceApiError {
  errorCode: string;
  message: string;
  fields?: string[];
}

/**
 * OAuth error response
 */
export interface OAuthError {
  error: string;
  error_description: string;
}

// =============================================================================
// SCHEMA CACHE
// =============================================================================

/**
 * Cached schema entry
 */
export interface CachedSchema {
  object: SObjectMetadata;
  cachedAt: Date;
  expiresAt: Date;
}

/**
 * Schema cache options
 */
export interface SchemaCacheOptions {
  /** Time-to-live in milliseconds (default: 1 hour) */
  ttlMs?: number;
  /** Maximum number of cached objects (default: 100) */
  maxSize?: number;
}

// =============================================================================
// SOQL GENERATION
// =============================================================================

/**
 * SOQL generation hint
 */
export interface SoqlHint {
  /** Object name the hint applies to */
  objectName: string;
  /** Field name (optional, for field-specific hints) */
  fieldName?: string;
  /** Natural language description of the hint */
  description: string;
  /** SOQL pattern example */
  pattern?: string;
}

/**
 * SOQL generation context
 */
export interface SoqlGenerationContext {
  /** Available objects and their metadata */
  objects: SObjectMetadata[];
  /** Business rule hints */
  hints: SoqlHint[];
  /** Natural language query */
  prompt: string;
}

/**
 * Generated SOQL result
 */
export interface GeneratedSoql {
  /** The generated SOQL query */
  soql: string;
  /** Explanation of the query */
  explanation?: string;
  /** Objects used in the query */
  objectsUsed: string[];
  /** Fields used in the query */
  fieldsUsed: string[];
  /** Confidence score (0-1) */
  confidence?: number;
}

// =============================================================================
// CONNECTION STATUS
// =============================================================================

/**
 * Connection health status
 */
export interface ConnectionHealth {
  /** Whether the connection is healthy */
  healthy: boolean;
  /** Status message */
  message: string;
  /** Last successful check time */
  lastCheck: Date;
  /** API limits info */
  limits?: ApiLimits;
  /** Error details if unhealthy */
  error?: string;
}

/**
 * Salesforce API limits
 */
export interface ApiLimits {
  dailyApiRequests: LimitInfo;
  dailyBulkApiRequests?: LimitInfo;
  dailyAsyncApexExecutions?: LimitInfo;
  streamingApiConcurrentClients?: LimitInfo;
}

/**
 * Individual limit info
 */
export interface LimitInfo {
  max: number;
  remaining: number;
}
