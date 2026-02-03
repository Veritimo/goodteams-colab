/**
 * Tests for Query Executor
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SqlConnector } from "../sql-connector.js";
import type { SqlQueryResult, SqlDialect, ExecutionContext } from "../types.js";
import {
  QueryExecutor,
  createQueryExecutor,
  QueryExecutionError,
  TimeoutError,
  DEFAULT_EXECUTION_OPTIONS,
  ConsoleAuditLogger,
  NoOpAuditLogger,
  InMemoryAuditLogger,
} from "../query-executor.js";

// Create a mock connector
function createMockConnector(overrides: Partial<SqlConnector> = {}): SqlConnector {
  return {
    dialect: "postgres" as SqlDialect,
    defaultSchema: "public",
    isConnected: () => true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    executeQuery: vi.fn().mockResolvedValue({
      rows: [],
      rowCount: 0,
      fields: [],
      executionTime: 10,
    }),
    testConnection: vi.fn(),
    getTables: vi.fn().mockResolvedValue([]),
    getRelationships: vi.fn().mockResolvedValue([]),
    quoteIdentifier: (id: string) => `"${id}"`,
    getSchema: () => "public",
    getConfig: () => ({ host: "localhost", port: 5432, database: "test" }),
    ...overrides,
  } as unknown as SqlConnector;
}

const testContext: ExecutionContext = {
  userId: "user-123",
  organizationId: "org-456",
  connectorId: "conn-789",
  clientIp: "127.0.0.1",
};

describe("QueryExecutor", () => {
  let executor: QueryExecutor;
  let auditLogger: InMemoryAuditLogger;

  beforeEach(() => {
    auditLogger = new InMemoryAuditLogger();
    executor = new QueryExecutor(auditLogger);
  });

  describe("executeWithSafety", () => {
    it("should execute a SELECT query successfully", async () => {
      const mockConnector = createMockConnector({
        executeQuery: vi.fn().mockResolvedValue({
          rows: [{ id: 1, name: "Test" }],
          rowCount: 1,
          fields: [{ name: "id", dataType: "integer" }],
          executionTime: 15,
        }),
      });

      const result = await executor.executeWithSafety(
        mockConnector,
        "SELECT * FROM users",
        testContext,
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rowCount).toBe(1);
      expect(result.truncated).toBe(false);
      expect(result.timedOut).toBe(false);
    });

    it("should log audit entry on success", async () => {
      const mockConnector = createMockConnector({
        executeQuery: vi.fn().mockResolvedValue({
          rows: [],
          rowCount: 0,
          fields: [],
          executionTime: 10,
        }),
      });

      await executor.executeWithSafety(mockConnector, "SELECT 1", testContext);

      const entries = auditLogger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].success).toBe(true);
      expect(entries[0].userId).toBe("user-123");
      expect(entries[0].organizationId).toBe("org-456");
      expect(entries[0].connectorId).toBe("conn-789");
      expect(entries[0].sql).toBe("SELECT 1");
    });

    it("should reject write operations in read-only mode", async () => {
      const mockConnector = createMockConnector();

      await expect(
        executor.executeWithSafety(mockConnector, "DELETE FROM users", testContext),
      ).rejects.toThrow(QueryExecutionError);

      const entries = auditLogger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].success).toBe(false);
      expect(entries[0].error).toContain("read-only");
    });

    it("should allow write operations when read-only is disabled", async () => {
      const mockConnector = createMockConnector({
        executeQuery: vi.fn().mockResolvedValue({
          rows: [],
          rowCount: 5,
          fields: [],
          executionTime: 20,
        }),
      });

      const result = await executor.executeWithSafety(
        mockConnector,
        "UPDATE users SET status = 'active'",
        testContext,
        { readOnly: false },
      );

      expect(result.rowCount).toBe(5);
    });

    it("should reject dangerous SQL patterns", async () => {
      const mockConnector = createMockConnector();

      await expect(
        executor.executeWithSafety(mockConnector, "DROP TABLE users", testContext),
      ).rejects.toThrow(QueryExecutionError);

      await expect(
        executor.executeWithSafety(
          mockConnector,
          "SELECT * FROM users; DROP TABLE users",
          testContext,
        ),
      ).rejects.toThrow(QueryExecutionError);
    });

    it("should apply row limit to SELECT queries", async () => {
      let capturedSql = "";
      const mockConnector = createMockConnector({
        dialect: "postgres",
        executeQuery: vi.fn().mockImplementation((sql: string) => {
          capturedSql = sql;
          return Promise.resolve({
            rows: new Array(100).fill({ id: 1 }),
            rowCount: 100,
            fields: [],
            executionTime: 50,
          });
        }),
      });

      await executor.executeWithSafety(mockConnector, "SELECT * FROM users", testContext, {
        rowLimit: 100,
      });

      expect(capturedSql).toContain("LIMIT 100");
    });

    it("should use TOP for MSSQL", async () => {
      let capturedSql = "";
      const mockConnector = createMockConnector({
        dialect: "mssql",
        executeQuery: vi.fn().mockImplementation((sql: string) => {
          capturedSql = sql;
          return Promise.resolve({
            rows: [],
            rowCount: 0,
            fields: [],
            executionTime: 10,
          });
        }),
      });

      await executor.executeWithSafety(mockConnector, "SELECT * FROM users", testContext, {
        rowLimit: 100,
      });

      expect(capturedSql).toContain("TOP 100");
    });

    it("should indicate when results are truncated", async () => {
      const mockConnector = createMockConnector({
        executeQuery: vi.fn().mockResolvedValue({
          rows: new Array(100).fill({ id: 1 }),
          rowCount: 100,
          fields: [],
          executionTime: 50,
        }),
      });

      const result = await executor.executeWithSafety(
        mockConnector,
        "SELECT * FROM users",
        testContext,
        { rowLimit: 100 },
      );

      expect(result.truncated).toBe(true);
    });

    it("should handle query timeout", async () => {
      const mockConnector = createMockConnector({
        executeQuery: vi.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              // Never resolves within timeout
              setTimeout(resolve, 5000);
            }),
        ),
      });

      const result = await executor.executeWithSafety(
        mockConnector,
        "SELECT * FROM users",
        testContext,
        { timeout: 50 },
      );

      expect(result.timedOut).toBe(true);
      expect(result.rows).toHaveLength(0);

      const entries = auditLogger.getEntries();
      expect(entries[0].error).toContain("timed out");
    });

    it("should reject SQL with comments as potential injection", async () => {
      const mockConnector = createMockConnector();

      // SQL with comments should be rejected at validation
      await expect(
        executor.executeWithSafety(
          mockConnector,
          "SELECT * FROM users -- this is a comment",
          testContext,
        ),
      ).rejects.toThrow(QueryExecutionError);

      const entries = auditLogger.getEntries();
      expect(entries[0].success).toBe(false);
      expect(entries[0].error).toContain("comments");
    });

    it("should log audit entry on query error", async () => {
      const mockConnector = createMockConnector({
        executeQuery: vi.fn().mockRejectedValue(new Error("Database error")),
      });

      await expect(
        executor.executeWithSafety(mockConnector, "SELECT * FROM users", testContext),
      ).rejects.toThrow(QueryExecutionError);

      const entries = auditLogger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].success).toBe(false);
      expect(entries[0].error).toBe("Database error");
    });

    it("should include client IP in audit", async () => {
      const mockConnector = createMockConnector();

      await executor.executeWithSafety(mockConnector, "SELECT 1", testContext);

      const entries = auditLogger.getEntries();
      expect(entries[0].clientIp).toBe("127.0.0.1");
    });
  });

  describe("audit loggers", () => {
    it("ConsoleAuditLogger should log to console", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const logger = new ConsoleAuditLogger();

      await logger.log({
        id: "audit-1",
        connectorId: "conn-1",
        userId: "user-1",
        organizationId: "org-1",
        sql: "SELECT * FROM users",
        rowCount: 10,
        executionTime: 50,
        success: true,
        timestamp: new Date(),
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "[SQL Audit]",
        expect.objectContaining({
          id: "audit-1",
          success: true,
        }),
      );

      consoleSpy.mockRestore();
    });

    it("NoOpAuditLogger should do nothing", async () => {
      const logger = new NoOpAuditLogger();

      // Should not throw
      await expect(
        logger.log({
          id: "audit-1",
          connectorId: "conn-1",
          userId: "user-1",
          organizationId: "org-1",
          sql: "SELECT 1",
          rowCount: 0,
          executionTime: 1,
          success: true,
          timestamp: new Date(),
        }),
      ).resolves.toBeUndefined();
    });

    it("InMemoryAuditLogger should store entries", async () => {
      const logger = new InMemoryAuditLogger();

      await logger.log({
        id: "audit-1",
        connectorId: "conn-1",
        userId: "user-1",
        organizationId: "org-1",
        sql: "SELECT 1",
        rowCount: 0,
        executionTime: 1,
        success: true,
        timestamp: new Date(),
      });

      await logger.log({
        id: "audit-2",
        connectorId: "conn-1",
        userId: "user-1",
        organizationId: "org-1",
        sql: "SELECT 2",
        rowCount: 0,
        executionTime: 2,
        success: true,
        timestamp: new Date(),
      });

      expect(logger.getEntries()).toHaveLength(2);
      expect(logger.entries[0].id).toBe("audit-1");
      expect(logger.entries[1].id).toBe("audit-2");
    });

    it("InMemoryAuditLogger should clear entries", async () => {
      const logger = new InMemoryAuditLogger();

      await logger.log({
        id: "audit-1",
        connectorId: "conn-1",
        userId: "user-1",
        organizationId: "org-1",
        sql: "SELECT 1",
        rowCount: 0,
        executionTime: 1,
        success: true,
        timestamp: new Date(),
      });

      logger.clear();

      expect(logger.getEntries()).toHaveLength(0);
    });
  });

  describe("QueryExecutionError", () => {
    it("should include code and audit entry", () => {
      const auditEntry = {
        id: "audit-1",
        connectorId: "conn-1",
        userId: "user-1",
        organizationId: "org-1",
        sql: "SELECT 1",
        rowCount: 0,
        executionTime: 1,
        success: false,
        error: "Test error",
        timestamp: new Date(),
      };

      const error = new QueryExecutionError("Test error", "TEST_CODE", auditEntry);

      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_CODE");
      expect(error.audit).toBe(auditEntry);
      expect(error.name).toBe("QueryExecutionError");
    });
  });

  describe("TimeoutError", () => {
    it("should be a proper Error subclass", () => {
      const error = new TimeoutError("Query timed out");

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("Query timed out");
      expect(error.name).toBe("TimeoutError");
    });
  });

  describe("DEFAULT_EXECUTION_OPTIONS", () => {
    it("should have expected defaults", () => {
      expect(DEFAULT_EXECUTION_OPTIONS.rowLimit).toBe(1000);
      expect(DEFAULT_EXECUTION_OPTIONS.timeout).toBe(30000);
      expect(DEFAULT_EXECUTION_OPTIONS.readOnly).toBe(true);
      expect(DEFAULT_EXECUTION_OPTIONS.stream).toBe(false);
      expect(DEFAULT_EXECUTION_OPTIONS.includeStats).toBe(false);
    });
  });

  describe("setAuditLogger", () => {
    it("should change the audit logger", async () => {
      const newLogger = new InMemoryAuditLogger();
      executor.setAuditLogger(newLogger);

      const mockConnector = createMockConnector();
      await executor.executeWithSafety(mockConnector, "SELECT 1", testContext);

      expect(newLogger.getEntries()).toHaveLength(1);
      expect(auditLogger.getEntries()).toHaveLength(0);
    });
  });

  describe("factory function", () => {
    it("should create an executor with default logger", () => {
      const exec = createQueryExecutor();
      expect(exec).toBeInstanceOf(QueryExecutor);
    });

    it("should create an executor with custom logger", () => {
      const logger = new InMemoryAuditLogger();
      const exec = createQueryExecutor(logger);
      expect(exec).toBeInstanceOf(QueryExecutor);
    });
  });
});
