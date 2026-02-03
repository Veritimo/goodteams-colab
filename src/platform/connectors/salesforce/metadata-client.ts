/**
 * Metadata Client
 *
 * Schema discovery for Salesforce objects:
 * - Describe SObjects (get field definitions)
 * - Global describe (list all objects)
 * - Field metadata access
 * - Schema caching
 *
 * @see https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_describe.htm
 */

import type { Connection, DescribeSObjectResult, DescribeGlobalResult } from "jsforce";
import type { SalesforceConnector } from "./salesforce-connector.js";
import type {
  SObjectMetadata,
  SFieldMetadata,
  SObjectSummary,
  GlobalDescribeResult,
  ChildRelationship,
  RecordTypeInfo,
  PicklistValue,
  CachedSchema,
  SchemaCacheOptions,
  SalesforceFieldType,
} from "./types.js";
import { SalesforceConnectorError } from "./salesforce-connector.js";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default cache TTL in milliseconds (1 hour) */
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;

/** Maximum cached objects */
const DEFAULT_MAX_CACHE_SIZE = 100;

// =============================================================================
// SCHEMA CACHE
// =============================================================================

/**
 * In-memory schema cache
 */
class SchemaCache {
  private cache: Map<string, CachedSchema> = new Map();
  private globalDescribe: GlobalDescribeResult | null = null;
  private globalDescribeExpiry: Date | null = null;
  private readonly ttlMs: number;
  private readonly maxSize: number;

  constructor(options?: SchemaCacheOptions) {
    this.ttlMs = options?.ttlMs ?? DEFAULT_CACHE_TTL_MS;
    this.maxSize = options?.maxSize ?? DEFAULT_MAX_CACHE_SIZE;
  }

  /**
   * Get cached object metadata
   */
  get(objectName: string): SObjectMetadata | null {
    const key = objectName.toLowerCase();
    const entry = this.cache.get(key);

    if (!entry) return null;
    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.object;
  }

  /**
   * Set cached object metadata
   */
  set(objectName: string, metadata: SObjectMetadata): void {
    const key = objectName.toLowerCase();

    // Enforce max size with LRU eviction
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const now = new Date();
    this.cache.set(key, {
      object: metadata,
      cachedAt: now,
      expiresAt: new Date(now.getTime() + this.ttlMs),
    });
  }

  /**
   * Get cached global describe
   */
  getGlobal(): GlobalDescribeResult | null {
    if (!this.globalDescribe) return null;
    if (this.globalDescribeExpiry && new Date() > this.globalDescribeExpiry) {
      this.globalDescribe = null;
      this.globalDescribeExpiry = null;
      return null;
    }
    return this.globalDescribe;
  }

  /**
   * Set cached global describe
   */
  setGlobal(describe: GlobalDescribeResult): void {
    this.globalDescribe = describe;
    this.globalDescribeExpiry = new Date(Date.now() + this.ttlMs);
  }

  /**
   * Invalidate cache for an object
   */
  invalidate(objectName: string): void {
    this.cache.delete(objectName.toLowerCase());
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
    this.globalDescribe = null;
    this.globalDescribeExpiry = null;
  }

  /**
   * Get cache stats
   */
  getStats(): { size: number; globalCached: boolean } {
    return {
      size: this.cache.size,
      globalCached: this.globalDescribe !== null,
    };
  }
}

// =============================================================================
// METADATA CLIENT CLASS
// =============================================================================

/**
 * Metadata Client
 *
 * Retrieves schema information for Salesforce objects.
 *
 * @example
 * ```typescript
 * const client = new MetadataClient(connector);
 *
 * // Get all objects
 * const objects = await client.describeGlobal();
 *
 * // Get specific object metadata
 * const accountMeta = await client.describeSObject('Account');
 *
 * // Get field info
 * const nameField = await client.getFieldMetadata('Account', 'Name');
 * ```
 */
export class MetadataClient {
  private connector: SalesforceConnector;
  private cache: SchemaCache;

  constructor(connector: SalesforceConnector, cacheOptions?: SchemaCacheOptions) {
    this.connector = connector;
    this.cache = new SchemaCache(cacheOptions);
  }

  // ===========================================================================
  // GLOBAL DESCRIBE
  // ===========================================================================

  /**
   * Get list of all available objects
   *
   * Returns summary information for all objects in the org.
   */
  async describeGlobal(options?: { useCache?: boolean }): Promise<GlobalDescribeResult> {
    const useCache = options?.useCache ?? true;

    // Check cache
    if (useCache) {
      const cached = this.cache.getGlobal();
      if (cached) return cached;
    }

    const conn = await this.connector.getConnection();

    try {
      const result = await conn.describeGlobal();
      const transformed = this.transformGlobalDescribe(result);

      this.cache.setGlobal(transformed);
      return transformed;
    } catch (error) {
      throw this.mapMetadataError(error, "describeGlobal");
    }
  }

  /**
   * Get list of queryable objects
   */
  async getQueryableObjects(): Promise<SObjectSummary[]> {
    const global = await this.describeGlobal();
    return global.sobjects.filter((obj) => obj.queryable);
  }

  /**
   * Get list of custom objects
   */
  async getCustomObjects(): Promise<SObjectSummary[]> {
    const global = await this.describeGlobal();
    return global.sobjects.filter((obj) => obj.custom);
  }

  /**
   * Search objects by name/label
   */
  async searchObjects(query: string): Promise<SObjectSummary[]> {
    const global = await this.describeGlobal();
    const lowerQuery = query.toLowerCase();

    return global.sobjects.filter(
      (obj) =>
        obj.name.toLowerCase().includes(lowerQuery) || obj.label.toLowerCase().includes(lowerQuery),
    );
  }

  // ===========================================================================
  // SOBJECT DESCRIBE
  // ===========================================================================

  /**
   * Get detailed metadata for a specific object
   */
  async describeSObject(
    objectName: string,
    options?: { useCache?: boolean },
  ): Promise<SObjectMetadata> {
    const useCache = options?.useCache ?? true;

    // Check cache
    if (useCache) {
      const cached = this.cache.get(objectName);
      if (cached) return cached;
    }

    const conn = await this.connector.getConnection();

    try {
      const result = await conn.describe(objectName);
      const transformed = this.transformSObjectDescribe(result);

      this.cache.set(objectName, transformed);
      return transformed;
    } catch (error) {
      throw this.mapMetadataError(error, `describeSObject(${objectName})`);
    }
  }

  /**
   * Get metadata for multiple objects
   */
  async describeSObjects(
    objectNames: string[],
    options?: { useCache?: boolean },
  ): Promise<Map<string, SObjectMetadata>> {
    const results = new Map<string, SObjectMetadata>();

    // Process in parallel (with some batching to avoid overwhelming the API)
    const batchSize = 10;
    for (let i = 0; i < objectNames.length; i += batchSize) {
      const batch = objectNames.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((name) =>
          this.describeSObject(name, options)
            .then((meta) => ({ name, meta, error: null }))
            .catch((error) => ({ name, meta: null, error })),
        ),
      );

      for (const result of batchResults) {
        if (result.meta) {
          results.set(result.name, result.meta);
        }
      }
    }

    return results;
  }

  // ===========================================================================
  // FIELD METADATA
  // ===========================================================================

  /**
   * Get metadata for a specific field
   */
  async getFieldMetadata(objectName: string, fieldName: string): Promise<SFieldMetadata | null> {
    const objectMeta = await this.describeSObject(objectName);
    return objectMeta.fields.find((f) => f.name.toLowerCase() === fieldName.toLowerCase()) ?? null;
  }

  /**
   * Get all required fields for an object
   */
  async getRequiredFields(objectName: string): Promise<SFieldMetadata[]> {
    const objectMeta = await this.describeSObject(objectName);
    return objectMeta.fields.filter((f) => !f.nillable && f.createable);
  }

  /**
   * Get all reference (lookup/master-detail) fields
   */
  async getReferenceFields(objectName: string): Promise<SFieldMetadata[]> {
    const objectMeta = await this.describeSObject(objectName);
    return objectMeta.fields.filter((f) => f.type === "reference");
  }

  /**
   * Get picklist values for a field
   */
  async getPicklistValues(objectName: string, fieldName: string): Promise<PicklistValue[]> {
    const fieldMeta = await this.getFieldMetadata(objectName, fieldName);
    if (!fieldMeta) {
      throw new SalesforceConnectorError(
        `Field ${fieldName} not found on ${objectName}`,
        "FIELD_NOT_FOUND",
        404,
      );
    }

    if (fieldMeta.type !== "picklist" && fieldMeta.type !== "multipicklist") {
      throw new SalesforceConnectorError(
        `Field ${fieldName} is not a picklist`,
        "NOT_PICKLIST",
        400,
      );
    }

    return fieldMeta.picklistValues ?? [];
  }

  // ===========================================================================
  // RELATIONSHIP METADATA
  // ===========================================================================

  /**
   * Get child relationships for an object
   */
  async getChildRelationships(objectName: string): Promise<ChildRelationship[]> {
    const objectMeta = await this.describeSObject(objectName);
    return objectMeta.childRelationships ?? [];
  }

  /**
   * Get record types for an object
   */
  async getRecordTypes(objectName: string): Promise<RecordTypeInfo[]> {
    const objectMeta = await this.describeSObject(objectName);
    return objectMeta.recordTypeInfos ?? [];
  }

  // ===========================================================================
  // CACHE MANAGEMENT
  // ===========================================================================

  /**
   * Refresh cached metadata for an object
   */
  async refreshCache(objectName: string): Promise<SObjectMetadata> {
    this.cache.invalidate(objectName);
    return this.describeSObject(objectName, { useCache: false });
  }

  /**
   * Refresh global describe cache
   */
  async refreshGlobalCache(): Promise<GlobalDescribeResult> {
    this.cache.clear();
    return this.describeGlobal({ useCache: false });
  }

  /**
   * Clear all cached metadata
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; globalCached: boolean } {
    return this.cache.getStats();
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Transform jsforce global describe to our format
   */
  private transformGlobalDescribe(result: DescribeGlobalResult): GlobalDescribeResult {
    return {
      encoding: result.encoding ?? "UTF-8",
      maxBatchSize: result.maxBatchSize ?? 200,
      sobjects: result.sobjects.map((obj) => ({
        name: obj.name,
        label: obj.label,
        labelPlural: obj.labelPlural,
        keyPrefix: obj.keyPrefix ?? "",
        queryable: obj.queryable,
        createable: obj.createable,
        updateable: obj.updateable,
        deletable: obj.deletable,
        custom: obj.custom,
      })),
    };
  }

  /**
   * Transform jsforce SObject describe to our format
   */
  private transformSObjectDescribe(result: DescribeSObjectResult): SObjectMetadata {
    return {
      name: result.name,
      label: result.label,
      labelPlural: result.labelPlural,
      keyPrefix: result.keyPrefix ?? "",
      queryable: result.queryable,
      createable: result.createable,
      updateable: result.updateable,
      deletable: result.deletable,
      custom: result.custom,
      fields: result.fields.map((f) => this.transformField(f)),
      childRelationships: result.childRelationships?.map((r) => ({
        childSObject: r.childSObject,
        field: r.field,
        relationshipName: r.relationshipName ?? "",
        cascadeDelete: r.cascadeDelete,
      })),
      recordTypeInfos: result.recordTypeInfos?.map((rt) => ({
        recordTypeId: rt.recordTypeId ?? "",
        name: rt.name,
        // developerName is in Salesforce API response but not in jsforce types
        developerName: (rt as { developerName?: string }).developerName ?? "",
        defaultRecordTypeMapping: rt.defaultRecordTypeMapping,
        available: rt.available,
      })),
    };
  }

  /**
   * Transform a field description
   */
  private transformField(field: DescribeSObjectResult["fields"][0]): SFieldMetadata {
    return {
      name: field.name,
      label: field.label,
      type: field.type as SalesforceFieldType,
      nillable: field.nillable,
      createable: field.createable,
      updateable: field.updateable,
      referenceTo: field.referenceTo?.length ? field.referenceTo : undefined,
      relationshipName: field.relationshipName ?? undefined,
      picklistValues: field.picklistValues?.map((pv) => ({
        value: pv.value,
        label: pv.label,
        active: pv.active,
        defaultValue: pv.defaultValue,
      })),
      length: field.length,
      precision: field.precision,
      scale: field.scale,
      defaultValue: field.defaultValue ?? undefined,
      unique: field.unique,
      externalId: field.externalId,
      nameField: field.nameField,
    };
  }

  /**
   * Map metadata errors to SalesforceConnectorError
   */
  private mapMetadataError(error: unknown, context: string): SalesforceConnectorError {
    if (error instanceof SalesforceConnectorError) {
      return error;
    }

    if (error && typeof error === "object") {
      const err = error as Record<string, unknown>;
      const errorCode = (err.errorCode as string) || (err.name as string) || "METADATA_ERROR";
      const message = (err.message as string) || "Metadata operation failed";

      // Check for "not found" errors
      if (errorCode === "NOT_FOUND" || message.includes("does not exist")) {
        return new SalesforceConnectorError(
          `${context}: Object not found`,
          "OBJECT_NOT_FOUND",
          404,
          error,
        );
      }

      return new SalesforceConnectorError(
        `${context}: ${message}`,
        errorCode,
        err.statusCode as number | undefined,
        error,
      );
    }

    if (error instanceof Error) {
      return new SalesforceConnectorError(`${context}: ${error.message}`, "METADATA_ERROR");
    }

    return new SalesforceConnectorError(`${context} failed`, "METADATA_ERROR");
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a metadata client from a connector
 */
export function createMetadataClient(
  connector: SalesforceConnector,
  cacheOptions?: SchemaCacheOptions,
): MetadataClient {
  return new MetadataClient(connector, cacheOptions);
}
