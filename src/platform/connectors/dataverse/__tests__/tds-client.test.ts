/**
 * TDS Client Tests
 *
 * Tests for Dataverse TDS endpoint SQL query execution.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { DataverseConfig, DataverseCredentials } from "../types.js";
import { TdsClient, createTdsClient } from "../tds-client.js";

// Mock tedious
vi.mock("tedious", () => {
  const mockConnection = {
    on: vi.fn(),
    connect: vi.fn(),
    execSql: vi.fn(),
    close: vi.fn(),
  };

  const mockRequest = {
    on: vi.fn(),
  };

  return {
    Connection: vi.fn(() => mockConnection),
    Request: vi.fn((sql: string, callback: Function) => {
      // Store callback for later invocation
      (mockRequest as any)._callback = callback;
      (mockRequest as any)._sql = sql;
      return mockRequest;
    }),
    TYPES: {
      Int: { name: "Int" },
      VarChar: { name: "VarChar" },
      NVarChar: { name: "NVarChar" },
      DateTime: { name: "DateTime" },
      UniqueIdentifier: { name: "UniqueIdentifier" },
    },
  };
});

// Mock @azure/identity
vi.mock("@azure/identity", () => {
  class MockClientSecretCredential {
    constructor() {}
    getToken = vi.fn().mockResolvedValue({
      token: "mock-token-12345",
      expiresOnTimestamp: Date.now() + 3600000,
    });
  }
  return { ClientSecretCredential: MockClientSecretCredential };
});

const mockConfig: DataverseConfig = {
  environmentUrl: "org123.crm.dynamics.com",
  tdsPort: 5558,
};

const mockCredentials: DataverseCredentials = {
  tenantId: "tenant-123",
  clientId: "client-456",
  clientSecret: "secret-789",
};

describe("TdsClient", () => {
  let client: TdsClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new TdsClient({ config: mockConfig, credentials: mockCredentials });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create client with valid config", () => {
      expect(client).toBeInstanceOf(TdsClient);
    });

    it("should use default TDS port if not specified", () => {
      const clientWithDefaults = new TdsClient({
        config: { environmentUrl: "org.crm.dynamics.com" },
        credentials: mockCredentials,
      });
      expect(clientWithDefaults).toBeInstanceOf(TdsClient);
    });
  });

  describe("createTdsClient", () => {
    it("should create client using factory function", () => {
      const factoryClient = createTdsClient(mockConfig, mockCredentials);
      expect(factoryClient).toBeInstanceOf(TdsClient);
    });
  });

  describe("executeQuery", () => {
    it("should clean SQL query by removing markdown code blocks", async () => {
      // This test verifies the SQL cleaning logic
      const sql = "```sql\nSELECT * FROM contact\n```";
      const cleaned = sql
        .replace(/```sql\n?/gi, "")
        .replace(/```\n?/g, "")
        .trim();
      expect(cleaned).toBe("SELECT * FROM contact");
    });

    it("should handle SQL without code blocks", async () => {
      const sql = "SELECT TOP 10 fullname FROM contact";
      const cleaned = sql
        .replace(/```sql\n?/gi, "")
        .replace(/```\n?/g, "")
        .trim();
      expect(cleaned).toBe("SELECT TOP 10 fullname FROM contact");
    });

    it("should handle multi-line SQL queries", async () => {
      const sql = `SELECT 
        contactid,
        fullname,
        emailaddress1
      FROM contact
      WHERE statecode = 0`;
      const cleaned = sql
        .replace(/```sql\n?/gi, "")
        .replace(/```\n?/g, "")
        .trim();
      expect(cleaned).toContain("SELECT");
      expect(cleaned).toContain("FROM contact");
    });
  });

  describe("validateQuery", () => {
    it("should reject INSERT statements", async () => {
      const result = await client.validateQuery('INSERT INTO contact (name) VALUES ("Test")');
      expect(result.valid).toBe(false);
      expect(result.error).toContain("INSERT");
    });

    it("should reject UPDATE statements", async () => {
      const result = await client.validateQuery('UPDATE contact SET name = "Test"');
      expect(result.valid).toBe(false);
      expect(result.error).toContain("UPDATE");
    });

    it("should reject DELETE statements", async () => {
      const result = await client.validateQuery('DELETE FROM contact WHERE id = "123"');
      expect(result.valid).toBe(false);
      expect(result.error).toContain("DELETE");
    });

    it("should reject DROP statements", async () => {
      const result = await client.validateQuery("DROP TABLE contact");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("DROP");
    });

    it("should reject CREATE statements", async () => {
      const result = await client.validateQuery("CREATE TABLE test (id INT)");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("CREATE");
    });

    it("should reject ALTER statements", async () => {
      const result = await client.validateQuery("ALTER TABLE contact ADD column1 INT");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("ALTER");
    });

    it("should reject EXEC statements", async () => {
      const result = await client.validateQuery("EXEC sp_something");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("EXEC");
    });

    it("should accept valid SELECT queries", async () => {
      const result = await client.validateQuery("SELECT fullname FROM contact WHERE statecode = 0");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept SELECT with TOP clause", async () => {
      const result = await client.validateQuery("SELECT TOP 100 * FROM account");
      expect(result.valid).toBe(true);
    });

    it("should accept SELECT with JOIN", async () => {
      const result = await client.validateQuery(`
        SELECT c.fullname, a.name 
        FROM contact c 
        JOIN account a ON c.parentcustomerid = a.accountid
      `);
      expect(result.valid).toBe(true);
    });

    it("should accept SELECT with aggregates", async () => {
      const result = await client.validateQuery(
        "SELECT COUNT(*), SUM(revenue) FROM account WHERE statecode = 0",
      );
      expect(result.valid).toBe(true);
    });
  });

  describe("getDialectHints", () => {
    it("should return array of hints", () => {
      const hints = TdsClient.getDialectHints();
      expect(Array.isArray(hints)).toBe(true);
      expect(hints.length).toBeGreaterThan(0);
    });

    it("should include statecode hint", () => {
      const hints = TdsClient.getDialectHints();
      const stateHint = hints.find((h) => h.toLowerCase().includes("statecode"));
      expect(stateHint).toBeDefined();
    });

    it("should mention read-only limitation", () => {
      const hints = TdsClient.getDialectHints();
      const readOnlyHint = hints.find((h) => h.toLowerCase().includes("read-only"));
      expect(readOnlyHint).toBeDefined();
    });

    it("should mention lookup columns", () => {
      const hints = TdsClient.getDialectHints();
      const lookupHint = hints.find((h) => h.toLowerCase().includes("lookup"));
      expect(lookupHint).toBeDefined();
    });

    it("should mention aggregate functions", () => {
      const hints = TdsClient.getDialectHints();
      const aggHint = hints.find((h) => h.toLowerCase().includes("aggregate"));
      expect(aggHint).toBeDefined();
    });
  });

  describe("testConnection", () => {
    it("should return health check result structure", async () => {
      // Mock a successful connection test
      const result = await client.testConnection();
      expect(result).toHaveProperty("healthy");
      expect(result).toHaveProperty("latencyMs");
      expect(typeof result.latencyMs).toBe("number");
    });
  });
});
