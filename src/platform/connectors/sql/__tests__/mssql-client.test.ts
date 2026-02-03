/**
 * Tests for SQL Server (MSSQL) Client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Create mock objects outside the mock factory
const mockRequest = {
  input: vi.fn().mockReturnThis(),
  query: vi.fn(),
};

const mockPool = {
  connect: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  request: vi.fn().mockReturnValue(mockRequest),
};

// Mock the mssql module
vi.mock("mssql", () => {
  // Create a class that can be instantiated with `new`
  class MockConnectionPool {
    connect = mockPool.connect;
    close = mockPool.close;
    request = mockPool.request;
  }

  return {
    ConnectionPool: MockConnectionPool,
    Int: { name: "Int" },
    Float: { name: "Float" },
    Bit: { name: "Bit" },
    NVarChar: { name: "NVarChar" },
    DateTime: { name: "DateTime" },
    VarBinary: { name: "VarBinary" },
  };
});

import * as mssql from "mssql";
import type { SqlConnectorConfig, SqlCredentials } from "../types.js";
import { MssqlClient, createMssqlClient } from "../mssql-client.js";

// Get mocked instances
const getMockPool = () => mockPool;
const getMockRequest = () => mockRequest;

describe("MssqlClient", () => {
  const testConfig: SqlConnectorConfig = {
    host: "localhost",
    port: 1433,
    database: "testdb",
    schema: "dbo",
    encrypt: true,
    trustServerCertificate: true,
  };

  const testCredentials: SqlCredentials = {
    username: "sa",
    password: "TestPassword123",
  };

  let client: MssqlClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MssqlClient(testConfig, testCredentials);
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.disconnect();
    }
  });

  describe("constructor", () => {
    it("should create a client with config and credentials", () => {
      const c = new MssqlClient(testConfig, testCredentials);
      expect(c).toBeInstanceOf(MssqlClient);
      expect(c.dialect).toBe("mssql");
      expect(c.defaultSchema).toBe("dbo");
    });

    it("should merge config with defaults", () => {
      const minimalConfig: SqlConnectorConfig = {
        host: "localhost",
        port: 1433,
        database: "testdb",
      };
      const c = new MssqlClient(minimalConfig, testCredentials);
      const config = c.getConfig();
      expect(config.connectionTimeout).toBe(30000);
      expect(config.requestTimeout).toBe(30000);
      expect(config.poolMax).toBe(10);
    });
  });

  describe("dialect and schema", () => {
    it("should return mssql as dialect", () => {
      expect(client.dialect).toBe("mssql");
    });

    it("should return dbo as default schema", () => {
      expect(client.defaultSchema).toBe("dbo");
    });

    it("should return configured schema", () => {
      expect(client.getSchema()).toBe("dbo");
    });

    it("should use default schema when not configured", () => {
      const configWithoutSchema: SqlConnectorConfig = {
        host: "localhost",
        port: 1433,
        database: "testdb",
      };
      const c = new MssqlClient(configWithoutSchema, testCredentials);
      expect(c.getSchema()).toBe("dbo");
    });
  });

  describe("connect", () => {
    it("should connect to the database", async () => {
      await client.connect();

      expect(getMockPool().connect).toHaveBeenCalledOnce();
      expect(client.isConnected()).toBe(true);
    });

    it("should not reconnect if already connected", async () => {
      await client.connect();
      await client.connect();

      expect(getMockPool().connect).toHaveBeenCalledOnce();
    });

    it("should throw on connection failure", async () => {
      getMockPool().connect.mockRejectedValueOnce(new Error("Connection failed"));

      await expect(client.connect()).rejects.toThrow("Connection failed");
    });

    it("should connect with expected configuration", async () => {
      // This test verifies the client connects successfully
      // The config is verified through the connection and subsequent operations
      await client.connect();

      expect(client.isConnected()).toBe(true);
      expect(client.dialect).toBe("mssql");

      // Verify config values are accessible
      const config = client.getConfig();
      expect(config.host).toBe("localhost");
      expect(config.port).toBe(1433);
      expect(config.database).toBe("testdb");
    });
  });

  describe("disconnect", () => {
    it("should disconnect from the database", async () => {
      await client.connect();
      await client.disconnect();

      expect(getMockPool().close).toHaveBeenCalledOnce();
      expect(client.isConnected()).toBe(false);
    });

    it("should handle disconnect when not connected", async () => {
      await client.disconnect();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe("executeQuery", () => {
    it("should execute a simple query", async () => {
      getMockRequest().query.mockResolvedValueOnce({
        recordset: [{ id: 1, name: "Test" }],
        rowsAffected: [1],
      });

      await client.connect();
      const result = await client.executeQuery("SELECT * FROM users");

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toEqual({ id: 1, name: "Test" });
      expect(result.rowCount).toBe(1);
    });

    it("should execute a parameterized query", async () => {
      getMockRequest().query.mockResolvedValueOnce({
        recordset: [{ id: 1, name: "Test" }],
        rowsAffected: [1],
      });

      await client.connect();
      const result = await client.executeQuery("SELECT * FROM users WHERE id = @id", { id: 1 });

      expect(getMockRequest().input).toHaveBeenCalledWith("id", expect.anything(), 1);
      expect(result.rows).toHaveLength(1);
    });

    it("should throw if not connected", async () => {
      await expect(client.executeQuery("SELECT 1")).rejects.toThrow("Not connected");
    });

    it("should handle query errors", async () => {
      getMockRequest().query.mockRejectedValueOnce(new Error("Query failed"));

      await client.connect();
      await expect(client.executeQuery("INVALID SQL")).rejects.toThrow("Query failed");
    });

    it("should handle different parameter types", async () => {
      getMockRequest().query.mockResolvedValueOnce({
        recordset: [],
        rowsAffected: [0],
      });

      await client.connect();
      await client.executeQuery("SELECT * FROM users WHERE a = @str AND b = @num AND c = @bool", {
        str: "test",
        num: 42,
        bool: true,
      });

      expect(getMockRequest().input).toHaveBeenCalledWith("str", expect.anything(), "test");
      expect(getMockRequest().input).toHaveBeenCalledWith("num", expect.anything(), 42);
      expect(getMockRequest().input).toHaveBeenCalledWith("bool", expect.anything(), true);
    });

    it("should include execution time in result", async () => {
      getMockRequest().query.mockResolvedValueOnce({
        recordset: [],
        rowsAffected: [0],
      });

      await client.connect();
      const result = await client.executeQuery("SELECT 1");

      expect(result.executionTime).toBeDefined();
      expect(typeof result.executionTime).toBe("number");
    });
  });

  describe("testConnection", () => {
    it("should return healthy status on success", async () => {
      getMockRequest().query.mockResolvedValueOnce({
        recordset: [{ test: 1 }],
        rowsAffected: [1],
      });

      await client.connect();
      const health = await client.testConnection();

      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
      expect(health.lastConnected).toBeInstanceOf(Date);
    });

    it("should return unhealthy status on failure", async () => {
      getMockRequest().query.mockRejectedValueOnce(new Error("Connection lost"));

      await client.connect();
      const health = await client.testConnection();

      expect(health.healthy).toBe(false);
      expect(health.error).toBe("Connection lost");
    });
  });

  describe("quoteIdentifier", () => {
    it("should quote simple identifiers", () => {
      expect(client.quoteIdentifier("users")).toBe("[users]");
    });

    it("should escape brackets in identifiers", () => {
      expect(client.quoteIdentifier("user]s")).toBe("[user]]s]");
    });

    it("should handle empty identifiers", () => {
      expect(client.quoteIdentifier("")).toBe("[]");
    });
  });

  describe("data type mapping", () => {
    it("should map integer types correctly", () => {
      const mapping = (client as any).mapDataType;
      expect(mapping.call(client, "int")).toBe("integer");
      expect(mapping.call(client, "bigint")).toBe("integer");
      expect(mapping.call(client, "smallint")).toBe("integer");
    });

    it("should map string types correctly", () => {
      const mapping = (client as any).mapDataType;
      expect(mapping.call(client, "varchar")).toBe("string");
      expect(mapping.call(client, "nvarchar")).toBe("string");
      expect(mapping.call(client, "text")).toBe("string");
    });

    it("should map date types correctly", () => {
      const mapping = (client as any).mapDataType;
      expect(mapping.call(client, "datetime")).toBe("datetime");
      expect(mapping.call(client, "datetime2")).toBe("datetime");
      expect(mapping.call(client, "date")).toBe("datetime");
    });

    it("should map boolean type correctly", () => {
      const mapping = (client as any).mapDataType;
      expect(mapping.call(client, "bit")).toBe("boolean");
    });

    it("should map uuid type correctly", () => {
      const mapping = (client as any).mapDataType;
      expect(mapping.call(client, "uniqueidentifier")).toBe("uuid");
    });
  });

  describe("factory function", () => {
    it("should create a client instance", () => {
      const c = createMssqlClient(testConfig, testCredentials);
      expect(c).toBeInstanceOf(MssqlClient);
    });
  });
});
