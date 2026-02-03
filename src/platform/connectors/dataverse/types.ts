/**
 * Dataverse/Dynamics CRM Types
 *
 * Type definitions for the Dataverse connector, including configuration,
 * credentials, entity metadata, and operation results.
 */

/**
 * Configuration for a Dataverse environment connection
 */
export interface DataverseConfig {
  /** Environment URL (e.g., "org123.crm.dynamics.com") */
  environmentUrl: string;
  /** TDS endpoint port (default: 5558) */
  tdsPort?: number;
  /** Whether connection is read-only (default: true) */
  isReadOnly?: boolean;
  /** Connection timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Azure AD credentials for Dataverse authentication
 */
export interface DataverseCredentials {
  /** Azure AD tenant ID */
  tenantId: string;
  /** Azure AD application (client) ID */
  clientId: string;
  /** Azure AD application client secret */
  clientSecret: string;
}

/**
 * Resolved configuration combining config and credentials
 */
export interface ResolvedDataverseConfig extends DataverseConfig, DataverseCredentials {}

/**
 * Entity (table) metadata from Dataverse
 */
export interface EntityMetadata {
  /** Logical name (e.g., "contact", "account") */
  logicalName: string;
  /** Display name (e.g., "Contact", "Account") */
  displayName: string;
  /** Primary ID attribute name (e.g., "contactid") */
  primaryIdAttribute: string;
  /** Primary name attribute (e.g., "fullname") */
  primaryNameAttribute: string;
  /** Entity type code */
  objectTypeCode?: number;
  /** Whether entity supports change tracking */
  changeTrackingEnabled?: boolean;
  /** List of attributes */
  attributes: AttributeMetadata[];
}

/**
 * Attribute (column) metadata from Dataverse
 */
export interface AttributeMetadata {
  /** Logical name (e.g., "firstname") */
  logicalName: string;
  /** Display name (e.g., "First Name") */
  displayName: string;
  /** Attribute type (e.g., "String", "Integer", "Lookup") */
  attributeType: string;
  /** Schema name */
  schemaName?: string;
  /** Whether attribute can be set on create */
  isValidForCreate: boolean;
  /** Whether attribute can be set on update */
  isValidForUpdate: boolean;
  /** Whether attribute is required */
  isRequired?: boolean;
  /** Max length for string attributes */
  maxLength?: number;
  /** Target entity for lookup attributes */
  targets?: string[];
  /** Option set values for picklist attributes */
  optionSet?: OptionSetValue[];
}

/**
 * Option set (picklist) value
 */
export interface OptionSetValue {
  /** Numeric value */
  value: number;
  /** Display label */
  label: string;
}

/**
 * Schema hint for query generation
 */
export interface SchemaHint {
  /** Entity logical name */
  entityName: string;
  /** Rule description */
  description: string;
  /** SQL pattern example */
  pattern?: string;
  /** Specific column name (optional) */
  columnName?: string;
}

/**
 * TDS query execution result
 */
export interface QueryResult {
  /** Array of row objects */
  rows: Record<string, unknown>[];
  /** Column metadata */
  columns?: ColumnInfo[];
  /** Number of rows affected (for non-SELECT) */
  rowsAffected?: number;
  /** Execution time in milliseconds */
  executionTimeMs?: number;
}

/**
 * Column information from query result
 */
export interface ColumnInfo {
  /** Column name */
  name: string;
  /** Data type */
  type: string;
  /** Whether column is nullable */
  nullable?: boolean;
}

/**
 * Bulk operation options
 */
export interface BulkOperationOptions {
  /** Batch size (default: 500, max: 1000) */
  batchSize?: number;
  /** Continue on error */
  continueOnError?: boolean;
  /** Progress callback */
  onProgress?: (processed: number, total: number) => void;
}

/**
 * Bulk operation result
 */
export interface BulkOperationResult {
  /** Whether operation succeeded without errors */
  success: boolean;
  /** Number of records processed successfully */
  successCount: number;
  /** Total records attempted */
  totalCount: number;
  /** Number of batches processed */
  batchCount: number;
  /** Created record IDs (for bulk create) */
  createdIds?: string[];
  /** Errors by batch/record */
  errors: BulkOperationError[];
  /** Summary message */
  message: string;
}

/**
 * Error from bulk operation
 */
export interface BulkOperationError {
  /** Batch number (1-indexed) */
  batch: number;
  /** Record index within batch */
  index?: number;
  /** Record ID (if available) */
  recordId?: string;
  /** Error message */
  error: string;
  /** Error code */
  code?: string;
}

/**
 * Connection health status
 */
export interface HealthCheckResult {
  /** Whether connection is healthy */
  healthy: boolean;
  /** TDS endpoint status */
  tdsStatus: "connected" | "error" | "unavailable";
  /** REST API status */
  restStatus: "connected" | "error" | "unavailable";
  /** Error message if unhealthy */
  message?: string;
  /** Latency in milliseconds */
  latencyMs?: number;
  /** Timestamp of check */
  checkedAt: Date;
}

/**
 * Permission constants for CRM operations
 */
export const CRM_PERMISSIONS = {
  CREATE: "CRM_CREATE",
  UPDATE: "CRM_UPDATE",
  DELETE: "CRM_DELETE",
  SQL_EXECUTE: "SQL_EXECUTE",
} as const;

export type CrmPermission = (typeof CRM_PERMISSIONS)[keyof typeof CRM_PERMISSIONS];

/**
 * Default configuration values
 */
export const DATAVERSE_DEFAULTS = {
  TDS_PORT: 5558,
  BATCH_SIZE: 500,
  MAX_BATCH_SIZE: 1000,
  TIMEOUT_MS: 30000,
} as const;

/**
 * Error types for Dataverse operations
 */
export class DataverseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "DataverseError";
  }
}

export class TdsConnectionError extends DataverseError {
  constructor(message: string, details?: unknown) {
    super(message, "TDS_CONNECTION_ERROR", details);
    this.name = "TdsConnectionError";
  }
}

export class TdsQueryError extends DataverseError {
  constructor(message: string, details?: unknown) {
    super(message, "TDS_QUERY_ERROR", details);
    this.name = "TdsQueryError";
  }
}

export class RestApiError extends DataverseError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    details?: unknown,
  ) {
    super(message, "REST_API_ERROR", details);
    this.name = "RestApiError";
  }
}

export class PermissionDeniedError extends DataverseError {
  constructor(permission: string) {
    super(`Permission denied: ${permission} required`, "PERMISSION_DENIED", { permission });
    this.name = "PermissionDeniedError";
  }
}

export class ReadOnlyModeError extends DataverseError {
  constructor() {
    super(
      "This Dataverse connector is in read-only mode. Write operations are disabled.",
      "READ_ONLY_MODE",
    );
    this.name = "ReadOnlyModeError";
  }
}
