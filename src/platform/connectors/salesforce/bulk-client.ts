/**
 * Bulk Client
 *
 * Salesforce Bulk API 2.0 operations for high-volume data operations:
 * - Bulk create records
 * - Bulk update records
 * - Bulk delete records
 * - Bulk upsert records
 * - Job status tracking
 *
 * @see https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/bulk_api_2_0.htm
 */

import type { Connection } from "jsforce";

// jsforce bulk API types (not directly exported from main module)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Job = ReturnType<Connection["bulk"]["createJob"]>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Batch = ReturnType<Job["createBatch"]>;
import type { SalesforceConnector } from "./salesforce-connector.js";
import type {
  BulkJobInfo,
  BulkJobState,
  BulkOperation,
  BulkRecordResult,
  BulkError,
  BulkOptions,
  BulkOperationSummary,
} from "./types.js";
import { SalesforceConnectorError } from "./salesforce-connector.js";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default batch size for bulk operations */
const DEFAULT_BATCH_SIZE = 10000;

/** Maximum batch size (Salesforce limit) */
const MAX_BATCH_SIZE = 10000;

/** Default poll interval in milliseconds */
const DEFAULT_POLL_INTERVAL_MS = 2000;

/** Default poll timeout in milliseconds (10 minutes) */
const DEFAULT_POLL_TIMEOUT_MS = 600000;

/** Maximum records per bulk job (Salesforce limit) */
const MAX_RECORDS_PER_JOB = 150000000; // 150 million

// =============================================================================
// BULK CLIENT CLASS
// =============================================================================

/**
 * Bulk Client
 *
 * Executes high-volume data operations using Salesforce Bulk API.
 *
 * @example
 * ```typescript
 * const client = new BulkClient(connector);
 *
 * // Bulk create
 * const result = await client.bulkCreate('Account', [
 *   { Name: 'Acme Inc' },
 *   { Name: 'GlobalCorp' },
 * ]);
 *
 * // Bulk update
 * const updateResult = await client.bulkUpdate('Contact', [
 *   { Id: '003...', Email: 'new@email.com' },
 * ]);
 *
 * // Bulk delete
 * const deleteResult = await client.bulkDelete('Lead', ['00Q...', '00Q...']);
 * ```
 */
export class BulkClient {
  private connector: SalesforceConnector;

  constructor(connector: SalesforceConnector) {
    this.connector = connector;
  }

  // ===========================================================================
  // BULK CREATE
  // ===========================================================================

  /**
   * Create records in bulk
   *
   * @param objectName - API name of the Salesforce object
   * @param records - Array of records to create (without Id)
   * @param options - Bulk operation options
   */
  async bulkCreate(
    objectName: string,
    records: Record<string, unknown>[],
    options?: BulkOptions,
  ): Promise<BulkOperationSummary> {
    this.validateRecords(records);
    return this.executeBulkOperation(objectName, "insert", records, options);
  }

  // ===========================================================================
  // BULK UPDATE
  // ===========================================================================

  /**
   * Update records in bulk
   *
   * @param objectName - API name of the Salesforce object
   * @param records - Array of records with Id and fields to update
   * @param options - Bulk operation options
   */
  async bulkUpdate(
    objectName: string,
    records: Array<Record<string, unknown> & { Id: string }>,
    options?: BulkOptions,
  ): Promise<BulkOperationSummary> {
    this.validateRecordsWithId(records);
    return this.executeBulkOperation(objectName, "update", records, options);
  }

  // ===========================================================================
  // BULK UPSERT
  // ===========================================================================

  /**
   * Upsert records in bulk (insert or update based on external ID)
   *
   * @param objectName - API name of the Salesforce object
   * @param records - Array of records with external ID field
   * @param externalIdField - Name of the external ID field
   * @param options - Bulk operation options
   */
  async bulkUpsert(
    objectName: string,
    records: Record<string, unknown>[],
    externalIdField: string,
    options?: BulkOptions,
  ): Promise<BulkOperationSummary> {
    this.validateRecords(records);

    // Validate external ID field is present in records
    for (const record of records) {
      if (!(externalIdField in record)) {
        throw new SalesforceConnectorError(
          `External ID field '${externalIdField}' missing in record`,
          "MISSING_EXTERNAL_ID",
          400,
        );
      }
    }

    return this.executeBulkOperation(objectName, "upsert", records, {
      ...options,
      externalIdFieldName: externalIdField,
    });
  }

  // ===========================================================================
  // BULK DELETE
  // ===========================================================================

  /**
   * Delete records in bulk
   *
   * @param objectName - API name of the Salesforce object
   * @param recordIds - Array of record IDs to delete
   * @param options - Bulk operation options
   */
  async bulkDelete(
    objectName: string,
    recordIds: string[],
    options?: BulkOptions,
  ): Promise<BulkOperationSummary> {
    if (!recordIds || recordIds.length === 0) {
      throw new SalesforceConnectorError("No record IDs provided", "NO_RECORDS", 400);
    }

    // Convert IDs to records with just Id field
    const records = recordIds.map((id) => ({ Id: id }));

    return this.executeBulkOperation(objectName, "delete", records, options);
  }

  /**
   * Hard delete records in bulk (bypass recycle bin)
   *
   * Requires "Bulk API Hard Delete" permission in Salesforce.
   */
  async bulkHardDelete(
    objectName: string,
    recordIds: string[],
    options?: BulkOptions,
  ): Promise<BulkOperationSummary> {
    if (!recordIds || recordIds.length === 0) {
      throw new SalesforceConnectorError("No record IDs provided", "NO_RECORDS", 400);
    }

    const records = recordIds.map((id) => ({ Id: id }));

    return this.executeBulkOperation(objectName, "hardDelete", records, options);
  }

  // ===========================================================================
  // JOB MANAGEMENT
  // ===========================================================================

  /**
   * Get status of a bulk job
   */
  async getJobStatus(jobId: string): Promise<BulkJobInfo> {
    const conn = await this.connector.getConnection();

    try {
      const response = await conn.request({
        method: "GET",
        url: `/services/data/v${conn.version}/jobs/ingest/${jobId}`,
      });

      return this.mapJobInfo(response as RawJobInfo);
    } catch (error) {
      throw this.mapBulkError(error, `getJobStatus(${jobId})`);
    }
  }

  /**
   * Get results for a completed job
   */
  async getJobResults(jobId: string): Promise<BulkRecordResult[]> {
    const conn = await this.connector.getConnection();

    try {
      // Get successful results
      const successUrl = `/services/data/v${conn.version}/jobs/ingest/${jobId}/successfulResults`;
      const successResponse = await conn.request({
        method: "GET",
        url: successUrl,
        headers: { Accept: "application/json" },
      });

      // Get failed results
      const failedUrl = `/services/data/v${conn.version}/jobs/ingest/${jobId}/failedResults`;
      const failedResponse = await conn.request({
        method: "GET",
        url: failedUrl,
        headers: { Accept: "application/json" },
      });

      const results: BulkRecordResult[] = [];

      // Parse successful records
      const successRecords = this.parseCSVResponse(successResponse as string);
      for (const record of successRecords) {
        results.push({
          id: record.sf__Id,
          success: true,
          created: record.sf__Created === "true",
        });
      }

      // Parse failed records
      const failedRecords = this.parseCSVResponse(failedResponse as string);
      for (const record of failedRecords) {
        results.push({
          id: record.sf__Id,
          success: false,
          errors: [
            {
              statusCode: record.sf__Error || "UNKNOWN",
              message: record.sf__Error || "Unknown error",
            },
          ],
        });
      }

      return results;
    } catch (error) {
      throw this.mapBulkError(error, `getJobResults(${jobId})`);
    }
  }

  /**
   * Abort a running bulk job
   */
  async abortJob(jobId: string): Promise<BulkJobInfo> {
    const conn = await this.connector.getConnection();

    try {
      const response = await conn.request({
        method: "PATCH",
        url: `/services/data/v${conn.version}/jobs/ingest/${jobId}`,
        body: JSON.stringify({ state: "Aborted" }),
        headers: { "Content-Type": "application/json" },
      });

      return this.mapJobInfo(response as RawJobInfo);
    } catch (error) {
      throw this.mapBulkError(error, `abortJob(${jobId})`);
    }
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Execute a bulk operation using jsforce bulk API
   */
  private async executeBulkOperation(
    objectName: string,
    operation: BulkOperation,
    records: Record<string, unknown>[],
    options?: BulkOptions,
  ): Promise<BulkOperationSummary> {
    const batchSize = Math.min(options?.batchSize ?? DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);
    const pollInterval = options?.pollInterval ?? DEFAULT_POLL_INTERVAL_MS;
    const pollTimeout = options?.pollTimeout ?? DEFAULT_POLL_TIMEOUT_MS;
    const concurrencyMode = options?.concurrencyMode ?? "Parallel";

    const conn = await this.connector.getConnection();

    try {
      // Create bulk job
      const job = conn.bulk.createJob(objectName, operation, {
        concurrencyMode,
        extIdField: options?.externalIdFieldName,
      });

      const allResults: BulkRecordResult[] = [];
      let successCount = 0;
      let failureCount = 0;

      // Process records in batches
      const batches: Batch[] = [];
      for (let i = 0; i < records.length; i += batchSize) {
        const batchRecords = records.slice(i, i + batchSize);
        const batch = job.createBatch();
        batch.execute(batchRecords);
        batches.push(batch);
      }

      // Wait for all batches to complete
      for (const batch of batches) {
        const batchResults = await this.waitForBatch(batch, pollInterval, pollTimeout);

        for (const result of batchResults) {
          const recordResult: BulkRecordResult = {
            id: result.id ?? undefined,
            success: result.success,
            created: result.created,
            errors: result.errors?.map((e: { statusCode?: string; message?: string }) => ({
              statusCode: e.statusCode ?? "UNKNOWN",
              message: e.message ?? "Unknown error",
            })),
          };

          allResults.push(recordResult);

          if (result.success) {
            successCount++;
          } else {
            failureCount++;
          }
        }
      }

      // Close the job
      await this.closeJob(job);

      const jobInfo = await this.getJobInfoFromJob(job);

      return {
        jobId: jobInfo.id,
        operation,
        object: objectName,
        state: jobInfo.state,
        totalRecords: records.length,
        successCount,
        failureCount,
        processingTime: jobInfo.totalProcessingTime,
        results: allResults,
      };
    } catch (error) {
      throw this.mapBulkError(error, `bulk${this.capitalizeFirst(operation)}(${objectName})`);
    }
  }

  /**
   * Wait for a batch to complete
   */
  private async waitForBatch(
    batch: Batch,
    pollInterval: number,
    timeout: number,
  ): Promise<
    Array<{
      id?: string;
      success: boolean;
      created?: boolean;
      errors?: Array<{ statusCode?: string; message?: string }>;
    }>
  > {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new SalesforceConnectorError("Bulk operation timed out", "BULK_TIMEOUT", 408));
      }, timeout);

      batch.on("error", (err: Error) => {
        clearTimeout(timeoutId);
        reject(err);
      });

      batch.on("queue", () => {
        // Batch queued, wait for response
        batch.poll(pollInterval, timeout);
      });

      batch.on(
        "response",
        (
          results: Array<{
            id?: string;
            success: boolean;
            created?: boolean;
            errors?: Array<{ statusCode?: string; message?: string }>;
          }>,
        ) => {
          clearTimeout(timeoutId);
          resolve(results);
        },
      );
    });
  }

  /**
   * Close a bulk job
   */
  private async closeJob(job: Job): Promise<void> {
    return new Promise((resolve, reject) => {
      // jsforce Job.close uses callback pattern not captured in types
      (job.close as (cb: (err: Error | null) => void) => void)((err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Get job info from jsforce Job object
   */
  private async getJobInfoFromJob(job: Job): Promise<BulkJobInfo> {
    return new Promise((resolve, reject) => {
      // jsforce Job.check uses callback pattern not captured in types
      (job.check as (cb: (err: Error | null, info: RawJobInfo) => void) => void)(
        (err: Error | null, info: RawJobInfo) => {
          if (err) reject(err);
          else resolve(this.mapJobInfo(info));
        },
      );
    });
  }

  /**
   * Map raw job info to our format
   */
  private mapJobInfo(info: RawJobInfo): BulkJobInfo {
    return {
      id: info.id ?? "",
      operation: (info.operation ?? "insert") as BulkOperation,
      object: info.object ?? "",
      state: (info.state ?? "Open") as BulkJobState,
      createdById: info.createdById ?? "",
      createdDate: info.createdDate ?? "",
      systemModstamp: info.systemModstamp ?? "",
      numberRecordsProcessed: info.numberRecordsProcessed ?? 0,
      numberRecordsFailed: info.numberRecordsFailed ?? 0,
      totalProcessingTime: info.totalProcessingTime ?? 0,
      apiVersion: info.apiVersion ?? "",
      concurrencyMode: (info.concurrencyMode ?? "Parallel") as "Parallel" | "Serial",
      contentType: (info.contentType ?? "JSON") as "CSV" | "JSON",
      externalIdFieldName: info.externalIdFieldName,
      lineEnding: info.lineEnding as "LF" | "CRLF" | undefined,
      columnDelimiter: info.columnDelimiter as BulkJobInfo["columnDelimiter"],
    };
  }

  /**
   * Parse CSV response from Salesforce
   */
  private parseCSVResponse(csv: string): Array<Record<string, string>> {
    if (!csv || csv.trim() === "") {
      return [];
    }

    const lines = csv.trim().split("\n");
    if (lines.length < 2) {
      return [];
    }

    const headers = this.parseCSVLine(lines[0]);
    const records: Array<Record<string, string>> = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const record: Record<string, string> = {};

      for (let j = 0; j < headers.length; j++) {
        record[headers[j]] = values[j] ?? "";
      }

      records.push(record);
    }

    return records;
  }

  /**
   * Parse a single CSV line
   */
  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    values.push(current);
    return values;
  }

  /**
   * Validate records array
   */
  private validateRecords(records: unknown[]): void {
    if (!records || !Array.isArray(records)) {
      throw new SalesforceConnectorError("Records must be an array", "INVALID_RECORDS", 400);
    }

    if (records.length === 0) {
      throw new SalesforceConnectorError("No records provided", "NO_RECORDS", 400);
    }

    if (records.length > MAX_RECORDS_PER_JOB) {
      throw new SalesforceConnectorError(
        `Too many records (max ${MAX_RECORDS_PER_JOB})`,
        "TOO_MANY_RECORDS",
        400,
      );
    }
  }

  /**
   * Validate records have Id field
   */
  private validateRecordsWithId(records: Array<{ Id: string }>): void {
    this.validateRecords(records);

    for (const record of records) {
      if (!record.Id) {
        throw new SalesforceConnectorError("All records must have an Id", "MISSING_ID", 400);
      }
    }
  }

  /**
   * Capitalize first letter
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Map bulk errors to SalesforceConnectorError
   */
  private mapBulkError(error: unknown, context: string): SalesforceConnectorError {
    if (error instanceof SalesforceConnectorError) {
      return error;
    }

    if (error && typeof error === "object") {
      const err = error as Record<string, unknown>;
      const errorCode = (err.errorCode as string) || (err.name as string) || "BULK_ERROR";
      const message = (err.message as string) || "Bulk operation failed";

      return new SalesforceConnectorError(
        `${context}: ${message}`,
        errorCode,
        err.statusCode as number | undefined,
        error,
      );
    }

    if (error instanceof Error) {
      return new SalesforceConnectorError(`${context}: ${error.message}`, "BULK_ERROR");
    }

    return new SalesforceConnectorError(`${context} failed`, "BULK_ERROR");
  }
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * Raw job info from Salesforce API
 */
interface RawJobInfo {
  id?: string;
  operation?: string;
  object?: string;
  state?: string;
  createdById?: string;
  createdDate?: string;
  systemModstamp?: string;
  numberRecordsProcessed?: number;
  numberRecordsFailed?: number;
  totalProcessingTime?: number;
  apiVersion?: string;
  concurrencyMode?: string;
  contentType?: string;
  externalIdFieldName?: string;
  lineEnding?: string;
  columnDelimiter?: string;
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a bulk client from a connector
 */
export function createBulkClient(connector: SalesforceConnector): BulkClient {
  return new BulkClient(connector);
}
