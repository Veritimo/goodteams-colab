/**
 * Query Executor
 *
 * Executes SQL queries with safety controls including:
 * - Row limit enforcement
 * - Timeout handling
 * - Read-only mode enforcement
 * - Audit logging integration
 */

import { randomUUID } from "crypto";
import type { SqlConnector } from "./sql-connector.js";
import type {
  SqlQueryResult,
  QueryExecutionOptions,
  SafeExecutionResult,
  QueryAuditEntry,
  SqlValidationResult,
} from "./types.js";
import { QueryGenerator } from "./query-generator.js";

/**
 * Default execution options
 */
export const DEFAULT_EXECUTION_OPTIONS: Required<QueryExecutionOptions> = {
  rowLimit: 1000,
  timeout: 30000,
  readOnly: true,
  stream: false,
  includeStats: false,
};

/**
 * Audit logger interface for integration
 */
export interface AuditLogger {
  log(entry: QueryAuditEntry): Promise<void>;
}

/**
 * Simple console audit logger for development
 */
export class ConsoleAuditLogger implements AuditLogger {
  async log(entry: QueryAuditEntry): Promise<void> {
    console.log("[SQL Audit]", {
      id: entry.id,
      connectorId: entry.connectorId,
      userId: entry.userId,
      sql: entry.sql.substring(0, 100) + (entry.sql.length > 100 ? "..." : ""),
      rowCount: entry.rowCount,
      executionTime: `${entry.executionTime}ms`,
      success: entry.success,
      error: entry.error,
      timestamp: entry.timestamp.toISOString(),
    });
  }
}

/**
 * No-op audit logger for testing
 */
export class NoOpAuditLogger implements AuditLogger {
  async log(_entry: QueryAuditEntry): Promise<void> {
    // Do nothing
  }
}

/**
 * In-memory audit logger for testing
 */
export class InMemoryAuditLogger implements AuditLogger {
  public entries: QueryAuditEntry[] = [];

  async log(entry: QueryAuditEntry): Promise<void> {
    this.entries.push(entry);
  }

  clear(): void {
    this.entries = [];
  }

  getEntries(): QueryAuditEntry[] {
    return [...this.entries];
  }
}

/**
 * Context for query execution
 */
export interface ExecutionContext {
  /** User ID executing the query */
  userId: string;
  /** Organization ID */
  organizationId: string;
  /** Connector ID */
  connectorId: string;
  /** Client IP address (optional) */
  clientIp?: string;
}

/**
 * Query executor with safety controls
 */
export class QueryExecutor {
  private queryGenerator: QueryGenerator;
  private auditLogger: AuditLogger;

  constructor(auditLogger?: AuditLogger) {
    this.queryGenerator = new QueryGenerator();
    this.auditLogger = auditLogger ?? new NoOpAuditLogger();
  }

  /**
   * Execute a query with safety controls
   */
  async executeWithSafety(
    connector: SqlConnector,
    sql: string,
    context: ExecutionContext,
    options: QueryExecutionOptions = {},
  ): Promise<SafeExecutionResult> {
    const mergedOptions = { ...DEFAULT_EXECUTION_OPTIONS, ...options };
    const startTime = Date.now();

    // Validate the SQL
    const validation = this.queryGenerator.validateSql(sql);

    // Enforce read-only mode
    if (mergedOptions.readOnly && !this.isReadOnlyQuery(validation)) {
      const auditEntry = this.createAuditEntry(
        context,
        sql,
        0,
        Date.now() - startTime,
        false,
        "Query rejected: Write operations not allowed in read-only mode",
      );
      await this.auditLogger.log(auditEntry);

      throw new QueryExecutionError(
        "Write operations are not allowed in read-only mode",
        "READ_ONLY_VIOLATION",
        auditEntry,
      );
    }

    // Check for dangerous patterns
    if (!validation.valid) {
      const auditEntry = this.createAuditEntry(
        context,
        sql,
        0,
        Date.now() - startTime,
        false,
        `Validation failed: ${validation.errors.join(", ")}`,
      );
      await this.auditLogger.log(auditEntry);

      throw new QueryExecutionError(
        `Query validation failed: ${validation.errors.join(", ")}`,
        "VALIDATION_FAILED",
        auditEntry,
      );
    }

    // Sanitize and apply limits
    let processedSql = this.queryGenerator.sanitizeSql(sql);

    // Apply row limit for SELECT queries
    if (validation.queryType === "SELECT" && mergedOptions.rowLimit > 0) {
      processedSql = this.applyRowLimit(processedSql, mergedOptions.rowLimit, connector.dialect);
    }

    // Execute with timeout
    let result: SqlQueryResult;
    let timedOut = false;

    try {
      result = await this.executeWithTimeout(connector, processedSql, mergedOptions.timeout);
    } catch (error) {
      if (error instanceof TimeoutError) {
        timedOut = true;
        const auditEntry = this.createAuditEntry(
          context,
          sql,
          0,
          mergedOptions.timeout,
          false,
          "Query timed out",
        );
        await this.auditLogger.log(auditEntry);

        return {
          rows: [],
          rowCount: 0,
          fields: [],
          executionTime: mergedOptions.timeout,
          truncated: false,
          timedOut: true,
          audit: auditEntry,
        };
      }

      // Log other errors
      const auditEntry = this.createAuditEntry(
        context,
        sql,
        0,
        Date.now() - startTime,
        false,
        error instanceof Error ? error.message : String(error),
      );
      await this.auditLogger.log(auditEntry);

      throw new QueryExecutionError(
        error instanceof Error ? error.message : String(error),
        "EXECUTION_FAILED",
        auditEntry,
      );
    }

    // Check if results were truncated
    const truncated = result.rowCount >= mergedOptions.rowLimit;

    // Create audit entry
    const auditEntry = this.createAuditEntry(
      context,
      sql,
      result.rowCount,
      result.executionTime ?? Date.now() - startTime,
      true,
    );
    await this.auditLogger.log(auditEntry);

    return {
      ...result,
      truncated,
      timedOut,
      audit: auditEntry,
    };
  }

  /**
   * Execute a query with timeout
   */
  private async executeWithTimeout(
    connector: SqlConnector,
    sql: string,
    timeoutMs: number,
  ): Promise<SqlQueryResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new TimeoutError(`Query timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      connector
        .executeQuery(sql)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Apply row limit to a query
   */
  private applyRowLimit(sql: string, limit: number, dialect: string): string {
    const normalizedSql = sql.toUpperCase();

    // Check if already has a limit
    if (/LIMIT\s+\d+/i.test(sql)) {
      return sql;
    }

    // Check for TOP clause (MSSQL)
    if (/SELECT\s+TOP\s+\d+/i.test(sql)) {
      return sql;
    }

    // MSSQL uses TOP
    if (dialect === "mssql") {
      return sql.replace(/^SELECT/i, `SELECT TOP ${limit}`);
    }

    // PostgreSQL uses LIMIT
    return `${sql.trim()}\nLIMIT ${limit}`;
  }

  /**
   * Check if a query is read-only based on validation result
   */
  private isReadOnlyQuery(validation: SqlValidationResult): boolean {
    return validation.queryType === "SELECT" || validation.queryType === undefined;
  }

  /**
   * Create an audit entry
   */
  private createAuditEntry(
    context: ExecutionContext,
    sql: string,
    rowCount: number,
    executionTime: number,
    success: boolean,
    error?: string,
  ): QueryAuditEntry {
    return {
      id: randomUUID(),
      connectorId: context.connectorId,
      userId: context.userId,
      organizationId: context.organizationId,
      sql,
      rowCount,
      executionTime,
      success,
      error,
      timestamp: new Date(),
      clientIp: context.clientIp,
    };
  }

  /**
   * Set the audit logger
   */
  setAuditLogger(logger: AuditLogger): void {
    this.auditLogger = logger;
  }
}

/**
 * Custom error for query execution failures
 */
export class QueryExecutionError extends Error {
  public readonly code: string;
  public readonly audit?: QueryAuditEntry;

  constructor(message: string, code: string, audit?: QueryAuditEntry) {
    super(message);
    this.name = "QueryExecutionError";
    this.code = code;
    this.audit = audit;
  }
}

/**
 * Timeout error for query execution
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Create a new query executor instance
 */
export function createQueryExecutor(auditLogger?: AuditLogger): QueryExecutor {
  return new QueryExecutor(auditLogger);
}
