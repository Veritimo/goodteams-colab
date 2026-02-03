/**
 * Tests for PostgreSQL Client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Create mock objects outside the mock factory
const mockClient = {
  release: vi.fn(),
};

const mockPool = {
  connect: vi.fn().mockResolvedValue(mockClient),
  end: vi.fn().mockResolvedValue(undefined),
  query: vi.fn(),
};

// Mock the pg module
vi.mock("pg", () => {
  // Create a class that can be instantiated with `new`
  class MockPool {
    connect = mockPool.connect;
    end = mockPool.end;
    query = mockPool.query;
  }

  return {
    Pool: MockPool,
  };
});

import { Pool } from "pg";
import type { SqlConnectorConfig, SqlCredentials } from "../types.js";
import { PostgresClient, createPostgresClient } from "../postgres-client.js";

describe("PostgresClient", () => {
  const testConfig: SqlConnectorConfig = {
    host: "localhost",
    port: 5432,
    database: "testdb",
    schema: "public",
    encrypt: true,
    trustServerCertificate: false,
  };

  const testCredentials: SqlCredentials = {
    username: "postgres",
    password: "TestPassword123",
  };

  let client: PostgresClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new PostgresClient(testConfig, testCredentials);
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.disconnect();
    }
  });

  describe("constructor", () => {
    it("should create a client with config and credentials", () => {
      const c = new PostgresClient(testConfig, testCredentials);
      expect(c).toBeInstanceOf(PostgresClient);
      expect(c.dialect).toBe("postgres");
      expect(c.defaultSchema).toBe("public");
    });

    it("should merge config with defaults", () => {
      const minimalConfig: SqlConnectorConfig = {
        host: "localhost",
        port: 5432,
        database: "testdb",
      };
      const c = new PostgresClient(minimalConfig, testCredentials);
      const config = c.getConfig();
      expect(config.connectionTimeout).toBe(30000);
      expect(config.poolMax).toBe(10);
    });
  });

  describe("dialect and schema", () => {
    it("should return postgres as dialect", () => {
      expect(client.dialect).toBe("postgres");
    });

    it("should return public as default schema", () => {
      expect(client.defaultSchema).toBe("public");
    });

    it("should return configured schema", () => {
      expect(client.getSchema()).toBe("public");
    });

    it("should use default schema when not configured", () => {
      const configWithoutSchema: SqlConnectorConfig = {
        host: "localhost",
        port: 5432,
        database: "testdb",
      };
      const c = new PostgresClient(configWithoutSchema, testCredentials);
      expect(c.getSchema()).toBe("public");
    });
  });

  describe("connect", () => {
    it("should connect to the database", async () => {
      await client.connect();

      expect(mockPool.connect).toHaveBeenCalledOnce();
      expect(mockClient.release).toHaveBeenCalledOnce();
      expect(client.isConnected()).toBe(true);
    });

    it("should not reconnect if already connected", async () => {
      await client.connect();
      await client.connect();

      expect(mockPool.connect).toHaveBeenCalledOnce();
    });

    it("should throw on connection failure", async () => {
      mockPool.connect.mockRejectedValueOnce(new Error("Connection failed"));

      await expect(client.connect()).rejects.toThrow("Connection failed");
    });

    it("should connect with expected configuration", async () => {
      await client.connect();

      expect(client.isConnected()).toBe(true);
      expect(client.dialect).toBe("postgres");

      // Verify config values are accessible
      const config = client.getConfig();
      expect(config.host).toBe("localhost");
      expect(config.port).toBe(5432);
      expect(config.database).toBe("testdb");
    });

    it("should handle SSL disabled", async () => {
      const noSslConfig = { ...testConfig, encrypt: false };
      const c = new PostgresClient(noSslConfig, testCredentials);
      await c.connect();

      // Verify client connects successfully with SSL disabled
      expect(c.isConnected()).toBe(true);
    });
  });

  describe("disconnect", () => {
    it("should disconnect from the database", async () => {
      await client.connect();
      await client.disconnect();

      expect(mockPool.end).toHaveBeenCalledOnce();
      expect(client.isConnected()).toBe(false);
    });

    it("should handle disconnect when not connected", async () => {
      await client.disconnect();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe("executeQuery", () => {
    it("should execute a simple query", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: "Test" }],
        rowCount: 1,
        fields: [{ name: "id" }, { name: "name" }],
      });

      await client.connect();
      const result = await client.executeQuery("SELECT * FROM users");

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toEqual({ id: 1, name: "Test" });
      expect(result.rowCount).toBe(1);
    });

    it("should convert named parameters to positional", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 1 }],
        rowCount: 1,
        fields: [],
      });

      await client.connect();
      await client.executeQuery("SELECT * FROM users WHERE id = @id", { id: 1 });

      expect(mockPool.query).toHaveBeenCalledWith("SELECT * FROM users WHERE id = $1", [1]);
    });

    it("should reuse parameter positions for repeated params", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        fields: [],
      });

      await client.connect();
      await client.executeQuery("SELECT * FROM users WHERE id = @id OR parent_id = @id", { id: 1 });

      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE id = $1 OR parent_id = $1",
        [1],
      );
    });

    it("should throw if not connected", async () => {
      await expect(client.executeQuery("SELECT 1")).rejects.toThrow("Not connected");
    });

    it("should throw for missing parameters", async () => {
      // Don't connect - test the parameter conversion directly
      // by creating a scenario where params are missing
      const testClient = new PostgresClient(testConfig, testCredentials);
      await testClient.connect();

      // The error will be thrown during parameter conversion
      await expect(
        testClient.executeQuery("SELECT * FROM users WHERE id = @id AND name = @missingName", {
          id: 1,
        }),
      ).rejects.toThrow("Missing parameter");
    });

    it("should handle query errors", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("Query failed"));

      await client.connect();
      await expect(client.executeQuery("INVALID SQL")).rejects.toThrow("Query failed");
    });

    it("should include execution time in result", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        fields: [],
      });

      await client.connect();
      const result = await client.executeQuery("SELECT 1");

      expect(result.executionTime).toBeDefined();
      expect(typeof result.executionTime).toBe("number");
    });

    it("should handle queries without parameters", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ test: 1 }],
        rowCount: 1,
        fields: [],
      });

      await client.connect();
      const result = await client.executeQuery("SELECT 1 as test");

      expect(mockPool.query).toHaveBeenCalledWith("SELECT 1 as test", []);
      expect(result.rowCount).toBe(1);
    });
  });

  describe("testConnection", () => {
    it("should return healthy status on success", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ test: 1 }],
        rowCount: 1,
        fields: [],
      });

      await client.connect();
      const health = await client.testConnection();

      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
      expect(health.lastConnected).toBeInstanceOf(Date);
    });

    it("should return unhealthy status on failure", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("Connection lost"));

      await client.connect();
      const health = await client.testConnection();

      expect(health.healthy).toBe(false);
      expect(health.error).toBe("Connection lost");
    });
  });

  describe("quoteIdentifier", () => {
    it("should quote simple identifiers", () => {
      expect(client.quoteIdentifier("users")).toBe('"users"');
    });

    it("should escape double quotes in identifiers", () => {
      expect(client.quoteIdentifier('user"s')).toBe('"user""s"');
    });

    it("should handle empty identifiers", () => {
      expect(client.quoteIdentifier("")).toBe('""');
    });
  });

  describe("data type mapping", () => {
    it("should map integer types correctly", () => {
      const mapping = (client as any).mapDataType;
      expect(mapping.call(client, "int4")).toBe("integer");
      expect(mapping.call(client, "int8")).toBe("integer");
      expect(mapping.call(client, "serial")).toBe("integer");
    });

    it("should map string types correctly", () => {
      const mapping = (client as any).mapDataType;
      expect(mapping.call(client, "varchar")).toBe("string");
      expect(mapping.call(client, "text")).toBe("string");
      expect(mapping.call(client, "bpchar")).toBe("string");
    });

    it("should map date types correctly", () => {
      const mapping = (client as any).mapDataType;
      expect(mapping.call(client, "timestamp")).toBe("datetime");
      expect(mapping.call(client, "timestamptz")).toBe("datetime");
      expect(mapping.call(client, "date")).toBe("datetime");
    });

    it("should map boolean type correctly", () => {
      const mapping = (client as any).mapDataType;
      expect(mapping.call(client, "bool")).toBe("boolean");
      expect(mapping.call(client, "boolean")).toBe("boolean");
    });

    it("should map json types correctly", () => {
      const mapping = (client as any).mapDataType;
      expect(mapping.call(client, "json")).toBe("json");
      expect(mapping.call(client, "jsonb")).toBe("json");
    });

    it("should map uuid type correctly", () => {
      const mapping = (client as any).mapDataType;
      expect(mapping.call(client, "uuid")).toBe("uuid");
    });

    it("should map array types correctly", () => {
      const mapping = (client as any).mapDataType;
      expect(mapping.call(client, "_int4")).toBe("array");
      expect(mapping.call(client, "int4[]")).toBe("array");
    });
  });

  describe("factory function", () => {
    it("should create a client instance", () => {
      const c = createPostgresClient(testConfig, testCredentials);
      expect(c).toBeInstanceOf(PostgresClient);
    });
  });
});
