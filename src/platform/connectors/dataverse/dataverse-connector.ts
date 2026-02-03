/**
 * Dataverse Connector
 *
 * Main connector for Microsoft Dynamics CRM / Dataverse.
 * Coordinates TDS client, REST client, metadata, and bulk operations.
 */

import { ClientSecretCredential } from "@azure/identity";
import {
  BulkOperationsManager,
  createBulkOperationsManager,
  PermissionChecker,
} from "./bulk-operations.js";
import { CrmQueryGenerator, createQueryGenerator, LLMProvider } from "./crm-query-generator.js";
import { EntityMetadataManager, createMetadataManager } from "./entity-metadata.js";
import { RestClient, createRestClient } from "./rest-client.js";
import { TdsClient, createTdsClient } from "./tds-client.js";
import {
  DataverseConfig,
  DataverseCredentials,
  ResolvedDataverseConfig,
  QueryResult,
  EntityMetadata,
  HealthCheckResult,
  BulkOperationResult,
  BulkOperationOptions,
  SchemaHint,
  DATAVERSE_DEFAULTS,
} from "./types.js";

/**
 * Dataverse connector options
 */
export interface DataverseConnectorOptions {
  /** Dataverse configuration */
  config: DataverseConfig;
  /** Azure AD credentials */
  credentials: DataverseCredentials;
  /** Connection ID (for hints management) */
  connectionId?: string;
  /** User ID (for permission checks) */
  userId?: string;
  /** Permission checker function */
  permissionChecker?: PermissionChecker;
  /** LLM provider for query generation */
  llmProvider?: LLMProvider;
  /** Metadata cache TTL in milliseconds */
  metadataCacheTtlMs?: number;
}

/**
 * Dataverse Connector
 *
 * Provides a unified interface for interacting with Dynamics CRM / Dataverse,
 * supporting both TDS (SQL) and REST API operations.
 */
export class DataverseConnector {
  private config: DataverseConfig;
  private credentials: DataverseCredentials;
  private connectionId: string;
  private userId?: string;

  private tdsClient: TdsClient;
  private restClient: RestClient;
  private metadataManager: EntityMetadataManager;
  private bulkOperations: BulkOperationsManager;
  private queryGenerator: CrmQueryGenerator;

  private initialized = false;

  constructor(options: DataverseConnectorOptions) {
    this.config = {
      ...options.config,
      tdsPort: options.config.tdsPort ?? DATAVERSE_DEFAULTS.TDS_PORT,
      isReadOnly: options.config.isReadOnly ?? true,
    };
    this.credentials = options.credentials;
    this.connectionId = options.connectionId ?? "default";
    this.userId = options.userId;

    // Initialize clients
    this.tdsClient = createTdsClient(this.config, this.credentials);
    this.restClient = createRestClient(this.config, this.credentials);
    this.metadataManager = createMetadataManager(this.restClient, options.metadataCacheTtlMs);
    this.bulkOperations = createBulkOperationsManager(this.restClient, {
      userId: options.userId,
      permissionChecker: options.permissionChecker,
      isReadOnly: this.config.isReadOnly,
    });
    this.queryGenerator = createQueryGenerator(this.metadataManager, options.llmProvider);
  }

  /**
   * Initialize the connector (validate connection)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Test both connections
    const [tdsHealth, restHealth] = await Promise.all([
      this.tdsClient.testConnection(),
      this.restClient.testConnection(),
    ]);

    if (!tdsHealth.healthy && !restHealth.healthy) {
      throw new Error(
        `Failed to connect to Dataverse. TDS: ${tdsHealth.error}, REST: ${restHealth.error}`,
      );
    }

    this.initialized = true;
  }

  /**
   * Check connection health
   */
  async checkHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    const [tdsHealth, restHealth] = await Promise.all([
      this.tdsClient.testConnection(),
      this.restClient.testConnection(),
    ]);

    const healthy = tdsHealth.healthy || restHealth.healthy;

    return {
      healthy,
      tdsStatus: tdsHealth.healthy ? "connected" : "error",
      restStatus: restHealth.healthy ? "connected" : "error",
      message: healthy
        ? undefined
        : `TDS: ${tdsHealth.error ?? "OK"}, REST: ${restHealth.error ?? "OK"}`,
      latencyMs: Date.now() - startTime,
      checkedAt: new Date(),
    };
  }

  // =========================================================================
  // Query Operations (TDS)
  // =========================================================================

  /**
   * Execute a SQL query via TDS endpoint
   */
  async executeQuery(sql: string): Promise<QueryResult> {
    return this.tdsClient.executeQuery(sql);
  }

  /**
   * Generate a SQL query from natural language
   */
  async generateQuery(prompt: string): Promise<{
    sql: string;
    explanation?: string;
    warnings?: string[];
  }> {
    const result = await this.queryGenerator.generateQuery(prompt, this.connectionId);
    return {
      sql: result.sql,
      explanation: result.explanation,
      warnings: result.warnings,
    };
  }

  /**
   * Generate and execute a query from natural language
   */
  async runAnalysis(prompt: string): Promise<{
    sql: string;
    result: QueryResult;
    explanation?: string;
  }> {
    const generated = await this.generateQuery(prompt);
    const result = await this.executeQuery(generated.sql);
    return {
      sql: generated.sql,
      result,
      explanation: generated.explanation,
    };
  }

  // =========================================================================
  // Metadata Operations
  // =========================================================================

  /**
   * Get metadata for an entity
   */
  async getEntityMetadata(entityName: string): Promise<EntityMetadata> {
    return this.metadataManager.getMetadata(entityName);
  }

  /**
   * Refresh metadata cache for specified entities
   */
  async refreshMetadata(entityNames: string[]): Promise<void> {
    await this.metadataManager.refreshMetadata(entityNames);
  }

  /**
   * Get cached entity names
   */
  getCachedEntities(): string[] {
    return this.metadataManager.getCachedEntities();
  }

  /**
   * Clear metadata cache
   */
  clearMetadataCache(): void {
    this.metadataManager.clearCache();
  }

  // =========================================================================
  // Schema Hints
  // =========================================================================

  /**
   * Add schema hints for query generation
   */
  addHints(hints: SchemaHint[]): void {
    this.queryGenerator.addHints(this.connectionId, hints);
  }

  /**
   * Remove schema hints
   */
  removeHints(descriptions: string[]): void {
    this.queryGenerator.removeHints(this.connectionId, descriptions);
  }

  /**
   * Get current hints
   */
  getHints(): SchemaHint[] {
    return this.queryGenerator.getHints(this.connectionId);
  }

  /**
   * Load default CRM hints
   */
  loadDefaultHints(): void {
    this.addHints(CrmQueryGenerator.getDefaultHints());
  }

  // =========================================================================
  // REST Operations (CRUD)
  // =========================================================================

  /**
   * Query records via OData
   */
  async queryRecords(
    entitySetName: string,
    options?: {
      select?: string[];
      filter?: string;
      orderBy?: string;
      top?: number;
      expand?: string[];
    },
  ): Promise<unknown[]> {
    return this.restClient.query(entitySetName, options);
  }

  /**
   * Get a single record by ID
   */
  async getRecord(entitySetName: string, id: string, select?: string[]): Promise<unknown> {
    return this.restClient.getRecord(entitySetName, id, select);
  }

  /**
   * Create a single record
   */
  async createRecord(entitySetName: string, data: Record<string, unknown>): Promise<string> {
    return this.restClient.createRecord(entitySetName, data);
  }

  /**
   * Update a single record
   */
  async updateRecord(
    entitySetName: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    return this.restClient.updateRecord(entitySetName, id, data);
  }

  /**
   * Delete a single record
   */
  async deleteRecord(entitySetName: string, id: string): Promise<void> {
    return this.restClient.deleteRecord(entitySetName, id);
  }

  // =========================================================================
  // Bulk Operations
  // =========================================================================

  /**
   * Bulk create records
   */
  async bulkCreate(
    entityName: string,
    records: Record<string, unknown>[],
    options?: BulkOperationOptions,
  ): Promise<BulkOperationResult> {
    return this.bulkOperations.bulkCreate(entityName, records, options);
  }

  /**
   * Bulk update records
   */
  async bulkUpdate(
    entityName: string,
    updates: { id: string; data: Record<string, unknown> }[],
    options?: BulkOperationOptions,
  ): Promise<BulkOperationResult> {
    return this.bulkOperations.bulkUpdate(entityName, updates, options);
  }

  /**
   * Bulk update with broadcast (same changes to all IDs)
   */
  async bulkUpdateBroadcast(
    entityName: string,
    ids: string[],
    changes: Record<string, unknown>,
    options?: BulkOperationOptions,
  ): Promise<BulkOperationResult> {
    return this.bulkOperations.bulkUpdateBroadcast(entityName, ids, changes, options);
  }

  /**
   * Bulk delete records
   */
  async bulkDelete(
    entityName: string,
    ids: string[],
    options?: BulkOperationOptions,
  ): Promise<BulkOperationResult> {
    return this.bulkOperations.bulkDelete(entityName, ids, options);
  }

  // =========================================================================
  // Configuration
  // =========================================================================

  /**
   * Update user ID for permission checks
   */
  setUserId(userId: string): void {
    this.userId = userId;
    this.bulkOperations.setUserId(userId);
  }

  /**
   * Update read-only mode
   */
  setReadOnly(isReadOnly: boolean): void {
    this.config.isReadOnly = isReadOnly;
    this.bulkOperations.setReadOnly(isReadOnly);
  }

  /**
   * Check if connector is in read-only mode
   */
  isReadOnly(): boolean {
    return this.config.isReadOnly ?? true;
  }

  /**
   * Get resolved configuration
   */
  getConfig(): ResolvedDataverseConfig {
    return {
      ...this.config,
      ...this.credentials,
    };
  }

  /**
   * Get connection ID
   */
  getConnectionId(): string {
    return this.connectionId;
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.metadataManager.clearCache();
    this.queryGenerator.clearHints(this.connectionId);
    this.initialized = false;
  }
}

/**
 * Create a Dataverse connector from config and credentials
 */
export function createDataverseConnector(
  config: DataverseConfig,
  credentials: DataverseCredentials,
  options?: Partial<Omit<DataverseConnectorOptions, "config" | "credentials">>,
): DataverseConnector {
  return new DataverseConnector({
    config,
    credentials,
    ...options,
  });
}

/**
 * Create a Dataverse connector from environment variables
 */
export function createDataverseConnectorFromEnv(
  options?: Partial<Omit<DataverseConnectorOptions, "config" | "credentials">>,
): DataverseConnector {
  const config: DataverseConfig = {
    environmentUrl: process.env.DATAVERSE_URL ?? "",
    tdsPort: process.env.DATAVERSE_TDS_PORT
      ? parseInt(process.env.DATAVERSE_TDS_PORT, 10)
      : DATAVERSE_DEFAULTS.TDS_PORT,
    isReadOnly: process.env.DATAVERSE_READ_ONLY !== "false",
  };

  const credentials: DataverseCredentials = {
    tenantId: process.env.AZURE_TENANT_ID ?? "",
    clientId: process.env.ENTRA_CLIENT_ID ?? process.env.AZURE_CLIENT_ID ?? "",
    clientSecret: process.env.ENTRA_CLIENT_SECRET ?? process.env.AZURE_CLIENT_SECRET ?? "",
  };

  // Validate required fields
  if (!config.environmentUrl) {
    throw new Error("DATAVERSE_URL environment variable is required");
  }
  if (!credentials.tenantId) {
    throw new Error("AZURE_TENANT_ID environment variable is required");
  }
  if (!credentials.clientId) {
    throw new Error("ENTRA_CLIENT_ID or AZURE_CLIENT_ID environment variable is required");
  }
  if (!credentials.clientSecret) {
    throw new Error("ENTRA_CLIENT_SECRET or AZURE_CLIENT_SECRET environment variable is required");
  }

  return new DataverseConnector({
    config,
    credentials,
    ...options,
  });
}
