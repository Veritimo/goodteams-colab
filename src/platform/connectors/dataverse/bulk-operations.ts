/**
 * Bulk Operations for Dataverse
 *
 * Batch CRUD operations with permission checking, batching,
 * progress tracking, and error handling.
 */

import { RestClient } from "./rest-client.js";
import {
  BulkOperationOptions,
  BulkOperationResult,
  BulkOperationError,
  CRM_PERMISSIONS,
  CrmPermission,
  PermissionDeniedError,
  ReadOnlyModeError,
  DATAVERSE_DEFAULTS,
} from "./types.js";

/**
 * Permission checker function type
 */
export type PermissionChecker = (userId: string, permission: CrmPermission) => Promise<boolean>;

/**
 * Bulk operations manager options
 */
export interface BulkOperationsOptions {
  /** REST client for API calls */
  restClient: RestClient;
  /** User ID for permission checks */
  userId?: string;
  /** Permission checker function */
  permissionChecker?: PermissionChecker;
  /** Whether connector is read-only */
  isReadOnly?: boolean;
}

/**
 * Entity set name mapping (plural forms for OData)
 */
const ENTITY_SET_NAMES: Record<string, string> = {
  contact: "contacts",
  account: "accounts",
  lead: "leads",
  opportunity: "opportunities",
  incident: "incidents",
  task: "tasks",
  appointment: "appointments",
  email: "emails",
  phonecall: "phonecalls",
  note: "annotations",
  // Add more as needed
};

/**
 * Get entity set name (plural) for OData operations
 */
function getEntitySetName(entityName: string): string {
  const normalized = entityName.toLowerCase();
  return ENTITY_SET_NAMES[normalized] ?? `${normalized}s`;
}

/**
 * Bulk Operations Manager
 *
 * Handles batch create, update, and delete operations with proper
 * error handling, batching, and progress tracking.
 */
export class BulkOperationsManager {
  private restClient: RestClient;
  private userId?: string;
  private permissionChecker?: PermissionChecker;
  private isReadOnly: boolean;

  constructor(options: BulkOperationsOptions) {
    this.restClient = options.restClient;
    this.userId = options.userId;
    this.permissionChecker = options.permissionChecker;
    this.isReadOnly = options.isReadOnly ?? true;
  }

  /**
   * Check if user has required permission
   */
  private async checkPermission(permission: CrmPermission): Promise<void> {
    // Check read-only mode first
    if (this.isReadOnly) {
      throw new ReadOnlyModeError();
    }

    // Check user permission if checker is available
    if (this.permissionChecker && this.userId) {
      const hasPermission = await this.permissionChecker(this.userId, permission);
      if (!hasPermission) {
        throw new PermissionDeniedError(permission);
      }
    }
  }

  /**
   * Bulk create records
   */
  async bulkCreate(
    entityName: string,
    records: Record<string, unknown>[],
    options: BulkOperationOptions = {},
  ): Promise<BulkOperationResult> {
    await this.checkPermission(CRM_PERMISSIONS.CREATE);

    if (records.length === 0) {
      return {
        success: true,
        successCount: 0,
        totalCount: 0,
        batchCount: 0,
        createdIds: [],
        errors: [],
        message: "No records to create.",
      };
    }

    const batchSize = Math.min(
      options.batchSize ?? DATAVERSE_DEFAULTS.BATCH_SIZE,
      DATAVERSE_DEFAULTS.MAX_BATCH_SIZE,
    );

    const entitySetName = getEntitySetName(entityName);
    const createdIds: string[] = [];
    const errors: BulkOperationError[] = [];
    let batchCount = 0;

    // Process in batches
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      batchCount++;

      // Process each record in the batch
      const batchResults = await Promise.allSettled(
        batch.map(async (record, index) => {
          try {
            const id = await this.restClient.createRecord(entitySetName, record);
            return { success: true, id, index: i + index };
          } catch (error) {
            return {
              success: false,
              index: i + index,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }),
      );

      // Collect results
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        if (
          result.status === "fulfilled" &&
          result.value.success &&
          "id" in result.value &&
          result.value.id
        ) {
          createdIds.push(result.value.id);
        } else if (result.status === "fulfilled" && !result.value.success) {
          errors.push({
            batch: batchCount,
            index: j,
            error: ("error" in result.value ? result.value.error : undefined) ?? "Unknown error",
          });
        } else if (result.status === "rejected") {
          errors.push({
            batch: batchCount,
            index: j,
            error: result.reason?.message ?? String(result.reason),
          });
        }
      }

      // Progress callback
      if (options.onProgress) {
        options.onProgress(Math.min(i + batchSize, records.length), records.length);
      }

      // Stop on error if not continuing
      if (errors.length > 0 && !options.continueOnError) {
        break;
      }
    }

    return {
      success: errors.length === 0,
      successCount: createdIds.length,
      totalCount: records.length,
      batchCount,
      createdIds,
      errors,
      message: `Created ${createdIds.length} of ${records.length} records in ${batchCount} batch(es).`,
    };
  }

  /**
   * Bulk update records
   */
  async bulkUpdate(
    entityName: string,
    updates: { id: string; data: Record<string, unknown> }[],
    options: BulkOperationOptions = {},
  ): Promise<BulkOperationResult> {
    await this.checkPermission(CRM_PERMISSIONS.UPDATE);

    if (updates.length === 0) {
      return {
        success: true,
        successCount: 0,
        totalCount: 0,
        batchCount: 0,
        errors: [],
        message: "No records to update.",
      };
    }

    const batchSize = Math.min(
      options.batchSize ?? DATAVERSE_DEFAULTS.BATCH_SIZE,
      DATAVERSE_DEFAULTS.MAX_BATCH_SIZE,
    );

    const entitySetName = getEntitySetName(entityName);
    let successCount = 0;
    const errors: BulkOperationError[] = [];
    let batchCount = 0;

    // Process in batches
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      batchCount++;

      // Process each update in the batch
      const batchResults = await Promise.allSettled(
        batch.map(async (update, index) => {
          try {
            await this.restClient.updateRecord(entitySetName, update.id, update.data);
            return { success: true, index: i + index };
          } catch (error) {
            return {
              success: false,
              index: i + index,
              recordId: update.id,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }),
      );

      // Collect results
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        if (result.status === "fulfilled" && result.value.success) {
          successCount++;
        } else if (result.status === "fulfilled" && !result.value.success) {
          errors.push({
            batch: batchCount,
            index: j,
            recordId: ("recordId" in result.value ? result.value.recordId : undefined) as
              | string
              | undefined,
            error: ("error" in result.value ? result.value.error : undefined) ?? "Unknown error",
          });
        } else if (result.status === "rejected") {
          errors.push({
            batch: batchCount,
            index: j,
            error: result.reason?.message ?? String(result.reason),
          });
        }
      }

      // Progress callback
      if (options.onProgress) {
        options.onProgress(Math.min(i + batchSize, updates.length), updates.length);
      }

      // Stop on error if not continuing
      if (errors.length > 0 && !options.continueOnError) {
        break;
      }
    }

    return {
      success: errors.length === 0,
      successCount,
      totalCount: updates.length,
      batchCount,
      errors,
      message: `Updated ${successCount} of ${updates.length} records in ${batchCount} batch(es).`,
    };
  }

  /**
   * Bulk update with broadcast (same changes to all IDs)
   */
  async bulkUpdateBroadcast(
    entityName: string,
    ids: string[],
    changes: Record<string, unknown>,
    options: BulkOperationOptions = {},
  ): Promise<BulkOperationResult> {
    // Convert to individual updates
    const updates = ids.map((id) => ({ id, data: changes }));
    return this.bulkUpdate(entityName, updates, options);
  }

  /**
   * Bulk delete records
   */
  async bulkDelete(
    entityName: string,
    ids: string[],
    options: BulkOperationOptions = {},
  ): Promise<BulkOperationResult> {
    await this.checkPermission(CRM_PERMISSIONS.DELETE);

    if (ids.length === 0) {
      return {
        success: true,
        successCount: 0,
        totalCount: 0,
        batchCount: 0,
        errors: [],
        message: "No records to delete.",
      };
    }

    const batchSize = Math.min(
      options.batchSize ?? DATAVERSE_DEFAULTS.BATCH_SIZE,
      DATAVERSE_DEFAULTS.MAX_BATCH_SIZE,
    );

    const entitySetName = getEntitySetName(entityName);
    let successCount = 0;
    const errors: BulkOperationError[] = [];
    let batchCount = 0;

    // Process in batches
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      batchCount++;

      // Process each delete in the batch
      const batchResults = await Promise.allSettled(
        batch.map(async (id, index) => {
          try {
            await this.restClient.deleteRecord(entitySetName, id);
            return { success: true, index: i + index };
          } catch (error) {
            return {
              success: false,
              index: i + index,
              recordId: id,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }),
      );

      // Collect results
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        if (result.status === "fulfilled" && result.value.success) {
          successCount++;
        } else if (result.status === "fulfilled" && !result.value.success) {
          errors.push({
            batch: batchCount,
            index: j,
            recordId: ("recordId" in result.value ? result.value.recordId : undefined) as
              | string
              | undefined,
            error: ("error" in result.value ? result.value.error : undefined) ?? "Unknown error",
          });
        } else if (result.status === "rejected") {
          errors.push({
            batch: batchCount,
            index: j,
            error: result.reason?.message ?? String(result.reason),
          });
        }
      }

      // Progress callback
      if (options.onProgress) {
        options.onProgress(Math.min(i + batchSize, ids.length), ids.length);
      }

      // Stop on error if not continuing
      if (errors.length > 0 && !options.continueOnError) {
        break;
      }
    }

    return {
      success: errors.length === 0,
      successCount,
      totalCount: ids.length,
      batchCount,
      errors,
      message: `Deleted ${successCount} of ${ids.length} records in ${batchCount} batch(es).`,
    };
  }

  /**
   * Update configuration (e.g., change read-only mode)
   */
  setReadOnly(isReadOnly: boolean): void {
    this.isReadOnly = isReadOnly;
  }

  /**
   * Update user ID for permission checks
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }
}

/**
 * Create a bulk operations manager
 */
export function createBulkOperationsManager(
  restClient: RestClient,
  options: Omit<BulkOperationsOptions, "restClient"> = {},
): BulkOperationsManager {
  return new BulkOperationsManager({
    restClient,
    ...options,
  });
}
