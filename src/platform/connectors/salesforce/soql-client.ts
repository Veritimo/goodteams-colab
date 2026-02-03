/**
 * SOQL Client
 *
 * Executes SOQL (Salesforce Object Query Language) queries:
 * - Single query execution
 * - Auto-paginated queries for large results
 * - Query result transformation
 * - Limit handling
 *
 * @see https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta
 */

import type { Connection, QueryResult } from "jsforce";
import type { SalesforceConnector } from "./salesforce-connector.js";
import type { SoqlResult, SalesforceRecord, QueryOptions } from "./types.js";
import { SalesforceConnectorError } from "./salesforce-connector.js";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum records per query batch (Salesforce limit) */
export const QUERY_BATCH_SIZE = 2000;

/** Maximum total records for queryAll (to prevent runaway queries) */
export const MAX_QUERY_RECORDS = 50000;

/** Default query timeout in milliseconds */
const DEFAULT_QUERY_TIMEOUT_MS = 120000; // 2 minutes

// =============================================================================
// SOQL CLIENT CLASS
// =============================================================================

/**
 * SOQL Client
 *
 * Executes SOQL queries against Salesforce with pagination support.
 *
 * @example
 * ```typescript
 * const client = new SoqlClient(connector);
 *
 * // Simple query
 * const result = await client.executeQuery<Account>(
 *   'SELECT Id, Name FROM Account LIMIT 10'
 * );
 *
 * // Query all records (auto-paginated)
 * const allAccounts = await client.executeQueryAll<Account>(
 *   'SELECT Id, Name FROM Account WHERE Industry = \'Technology\''
 * );
 * ```
 */
export class SoqlClient {
  private connector: SalesforceConnector;

  constructor(connector: SalesforceConnector) {
    this.connector = connector;
  }

  // ===========================================================================
  // QUERY EXECUTION
  // ===========================================================================

  /**
   * Execute a SOQL query
   *
   * Returns first batch of results. Use `executeQueryAll` for large result sets.
   */
  async executeQuery<T extends SalesforceRecord = SalesforceRecord>(
    soql: string,
    options?: QueryOptions,
  ): Promise<SoqlResult<T>> {
    this.validateSoql(soql);

    const conn = await this.connector.getConnection();

    try {
      const result = await this.runQuery<T>(conn, soql, options);
      return this.transformResult(result);
    } catch (error) {
      throw this.mapQueryError(error, soql);
    }
  }

  /**
   * Execute a SOQL query and fetch all results (auto-paginated)
   *
   * Automatically fetches additional batches if results exceed batch size.
   * Respects MAX_QUERY_RECORDS limit to prevent runaway queries.
   */
  async executeQueryAll<T extends SalesforceRecord = SalesforceRecord>(
    soql: string,
    options?: QueryOptions,
  ): Promise<SoqlResult<T>> {
    this.validateSoql(soql);

    const maxRecords = options?.maxRecords ?? MAX_QUERY_RECORDS;
    const conn = await this.connector.getConnection();

    try {
      // Execute initial query
      let result = await this.runQuery<T>(conn, soql, options);
      const allRecords: T[] = [...result.records];

      // Fetch additional batches if needed
      while (!result.done && result.nextRecordsUrl && allRecords.length < maxRecords) {
        // Calculate how many more records we can fetch
        const remainingCapacity = maxRecords - allRecords.length;

        result = await this.fetchNextBatch<T>(conn, result.nextRecordsUrl);

        // Add records up to limit
        const recordsToAdd = result.records.slice(0, remainingCapacity);
        allRecords.push(...recordsToAdd);

        // Stop if we've reached the limit
        if (allRecords.length >= maxRecords) {
          break;
        }
      }

      return {
        totalSize: result.totalSize,
        done: result.done && allRecords.length >= result.totalSize,
        records: allRecords,
        nextRecordsUrl: allRecords.length < result.totalSize ? result.nextRecordsUrl : undefined,
      };
    } catch (error) {
      throw this.mapQueryError(error, soql);
    }
  }

  /**
   * Execute a query and stream results (memory efficient for large datasets)
   *
   * @param soql - SOQL query string
   * @param onRecord - Callback for each record
   * @param options - Query options
   */
  async streamQuery<T extends SalesforceRecord = SalesforceRecord>(
    soql: string,
    onRecord: (record: T) => void | Promise<void>,
    options?: QueryOptions & { maxRecords?: number },
  ): Promise<{ totalProcessed: number; totalSize: number }> {
    this.validateSoql(soql);

    const maxRecords = options?.maxRecords ?? MAX_QUERY_RECORDS;
    const conn = await this.connector.getConnection();

    try {
      let result = await this.runQuery<T>(conn, soql, options);
      let totalProcessed = 0;

      // Process first batch
      for (const record of result.records) {
        if (totalProcessed >= maxRecords) break;
        await onRecord(record);
        totalProcessed++;
      }

      // Process additional batches
      while (!result.done && result.nextRecordsUrl && totalProcessed < maxRecords) {
        result = await this.fetchNextBatch<T>(conn, result.nextRecordsUrl);

        for (const record of result.records) {
          if (totalProcessed >= maxRecords) break;
          await onRecord(record);
          totalProcessed++;
        }
      }

      return { totalProcessed, totalSize: result.totalSize };
    } catch (error) {
      throw this.mapQueryError(error, soql);
    }
  }

  // ===========================================================================
  // QUERY WITH DELETED RECORDS
  // ===========================================================================

  /**
   * Execute a SOQL query including deleted/archived records
   *
   * Requires "View All Data" permission in Salesforce.
   */
  async executeQueryWithDeleted<T extends SalesforceRecord = SalesforceRecord>(
    soql: string,
    options?: QueryOptions,
  ): Promise<SoqlResult<T>> {
    return this.executeQuery<T>(soql, { ...options, includeDeleted: true });
  }

  // ===========================================================================
  // COUNT QUERY
  // ===========================================================================

  /**
   * Execute a count query
   *
   * More efficient than retrieving all records when you just need a count.
   */
  async executeCountQuery(soql: string): Promise<number> {
    // Extract the count query or transform existing query
    const countSoql = this.transformToCountQuery(soql);
    this.validateSoql(countSoql);

    const conn = await this.connector.getConnection();

    try {
      const result = await conn.query(countSoql);
      return result.totalSize;
    } catch (error) {
      throw this.mapQueryError(error, countSoql);
    }
  }

  // ===========================================================================
  // EXPLAIN QUERY
  // ===========================================================================

  /**
   * Get query plan without executing
   *
   * Useful for query optimization.
   */
  async explainQuery(soql: string): Promise<QueryPlan> {
    this.validateSoql(soql);

    const conn = await this.connector.getConnection();

    try {
      // Use REST API to get query plan
      const encodedQuery = encodeURIComponent(soql);
      const response = await conn.request({
        method: "GET",
        url: `/services/data/v${conn.version}/query?explain=${encodedQuery}`,
      });

      return this.parseQueryPlan(response as QueryPlanResponse);
    } catch (error) {
      throw this.mapQueryError(error, soql);
    }
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Run a query with timeout handling
   */
  private async runQuery<T extends Record<string, unknown>>(
    conn: Connection,
    soql: string,
    options?: QueryOptions,
  ): Promise<QueryResult<T>> {
    const timeout = options?.timeout ?? DEFAULT_QUERY_TIMEOUT_MS;

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Query timeout exceeded")), timeout);
    });

    // Use queryAll for includeDeleted, otherwise regular query
    // Cast through unknown to satisfy jsforce's generic constraints
    // queryAll exists at runtime but not in jsforce types
    const connAny = conn as typeof conn & { queryAll(soql: string): unknown };
    const queryPromise = options?.includeDeleted
      ? (connAny.queryAll(soql) as Promise<QueryResult<T>>)
      : (conn.query(soql) as unknown as Promise<QueryResult<T>>);

    return Promise.race([queryPromise, timeoutPromise]);
  }

  /**
   * Fetch next batch of results
   */
  private async fetchNextBatch<T extends Record<string, unknown>>(
    conn: Connection,
    nextRecordsUrl: string,
  ): Promise<QueryResult<T>> {
    // Extract the locator from the URL
    const locator = nextRecordsUrl.split("/").pop();
    if (!locator) {
      throw new SalesforceConnectorError("Invalid nextRecordsUrl", "INVALID_NEXT_RECORDS_URL", 400);
    }

    return (await conn.queryMore(nextRecordsUrl)) as unknown as QueryResult<T>;
  }

  /**
   * Transform jsforce result to our format
   */
  private transformResult<T extends SalesforceRecord>(result: QueryResult<T>): SoqlResult<T> {
    return {
      totalSize: result.totalSize,
      done: result.done,
      records: result.records,
      nextRecordsUrl: result.nextRecordsUrl,
    };
  }

  /**
   * Transform a query to a count query
   */
  private transformToCountQuery(soql: string): string {
    // If already a count query, return as-is
    if (/SELECT\s+COUNT\s*\(/i.test(soql)) {
      return soql;
    }

    // Replace SELECT fields with COUNT(Id)
    return soql.replace(/SELECT\s+.+?\s+FROM/i, "SELECT COUNT(Id) FROM");
  }

  /**
   * Validate SOQL syntax (basic validation)
   */
  private validateSoql(soql: string): void {
    if (!soql || typeof soql !== "string") {
      throw new SalesforceConnectorError("SOQL query is required", "INVALID_QUERY", 400);
    }

    const trimmed = soql.trim().toUpperCase();

    // Must start with SELECT
    if (!trimmed.startsWith("SELECT")) {
      throw new SalesforceConnectorError("SOQL must start with SELECT", "INVALID_QUERY", 400);
    }

    // Must contain FROM
    if (!trimmed.includes(" FROM ")) {
      throw new SalesforceConnectorError("SOQL must contain FROM clause", "INVALID_QUERY", 400);
    }

    // Check for dangerous patterns (basic SQL injection prevention)
    const dangerousPatterns = [/;\s*DROP/i, /;\s*DELETE/i, /;\s*UPDATE/i, /;\s*INSERT/i];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(soql)) {
        throw new SalesforceConnectorError(
          "SOQL contains potentially dangerous patterns",
          "INVALID_QUERY",
          400,
        );
      }
    }
  }

  /**
   * Parse query plan response
   */
  private parseQueryPlan(response: QueryPlanResponse): QueryPlan {
    const plans = response.plans || [];
    const bestPlan = plans[0]; // First plan is typically the one used

    return {
      cardinality: bestPlan?.cardinality ?? 0,
      fields: bestPlan?.fields ?? [],
      leadingOperationType: bestPlan?.leadingOperationType ?? "",
      relativeCost: bestPlan?.relativeCost ?? 0,
      sobjectCardinality: bestPlan?.sobjectCardinality ?? 0,
      sobjectType: bestPlan?.sobjectType ?? "",
      notes: bestPlan?.notes ?? [],
    };
  }

  /**
   * Map query errors to SalesforceConnectorError
   */
  private mapQueryError(error: unknown, soql: string): SalesforceConnectorError {
    if (error instanceof SalesforceConnectorError) {
      return error;
    }

    if (error && typeof error === "object") {
      const err = error as Record<string, unknown>;
      const errorCode = (err.errorCode as string) || (err.name as string) || "QUERY_ERROR";
      const message = (err.message as string) || "Query execution failed";

      return new SalesforceConnectorError(
        `Query failed: ${message}\nSOQL: ${soql}`,
        errorCode,
        err.statusCode as number | undefined,
        error,
      );
    }

    if (error instanceof Error) {
      return new SalesforceConnectorError(
        `Query failed: ${error.message}\nSOQL: ${soql}`,
        "QUERY_ERROR",
      );
    }

    return new SalesforceConnectorError(`Query failed\nSOQL: ${soql}`, "QUERY_ERROR");
  }
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * Query plan information
 */
export interface QueryPlan {
  cardinality: number;
  fields: string[];
  leadingOperationType: string;
  relativeCost: number;
  sobjectCardinality: number;
  sobjectType: string;
  notes: QueryPlanNote[];
}

/**
 * Query plan note
 */
export interface QueryPlanNote {
  description: string;
  fields: string[];
  tableEnumOrId: string;
}

/**
 * Raw query plan response from Salesforce
 */
interface QueryPlanResponse {
  plans: Array<{
    cardinality?: number;
    fields?: string[];
    leadingOperationType?: string;
    relativeCost?: number;
    sobjectCardinality?: number;
    sobjectType?: string;
    notes?: QueryPlanNote[];
  }>;
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a SOQL client from a connector
 */
export function createSoqlClient(connector: SalesforceConnector): SoqlClient {
  return new SoqlClient(connector);
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Escape a string value for use in SOQL
 *
 * Note: Backslashes must be escaped FIRST, then single quotes.
 * Otherwise `'` becomes `\'` which then becomes `\\'`.
 */
export function escapeSoqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Build a SOQL IN clause from an array of values
 */
export function buildInClause(fieldName: string, values: string[]): string {
  if (values.length === 0) {
    return "FALSE"; // Empty IN clause should match nothing
  }

  const escaped = values.map((v) => `'${escapeSoqlString(v)}'`);
  return `${fieldName} IN (${escaped.join(", ")})`;
}

/**
 * Build a SOQL date literal
 */
export function buildDateLiteral(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Build a SOQL datetime literal
 */
export function buildDateTimeLiteral(date: Date): string {
  return date.toISOString();
}
