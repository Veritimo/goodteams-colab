/**
 * Tests for Schema Introspector
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SqlConnector } from "../sql-connector.js";
import type { TableSchema, TableRelationship, SchemaCache, SqlDialect } from "../types.js";
import { SchemaIntrospector, createSchemaIntrospector } from "../schema-introspector.js";

// Create a mock connector
function createMockConnector(overrides: Partial<SqlConnector> = {}): SqlConnector {
  return {
    dialect: "postgres" as SqlDialect,
    defaultSchema: "public",
    isConnected: () => true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    executeQuery: vi.fn(),
    testConnection: vi.fn(),
    getTables: vi.fn().mockResolvedValue([]),
    getRelationships: vi.fn().mockResolvedValue([]),
    quoteIdentifier: (id: string) => `"${id}"`,
    getSchema: () => "public",
    getConfig: () => ({ host: "localhost", port: 5432, database: "test" }),
    ...overrides,
  } as unknown as SqlConnector;
}

// Sample test data
const sampleTables: TableSchema[] = [
  {
    name: "users",
    schema: "public",
    description: "User accounts",
    columns: [
      { name: "id", dataType: "integer", nullable: false, isPrimaryKey: true, isForeignKey: false },
      {
        name: "email",
        dataType: "string",
        nullable: false,
        isPrimaryKey: false,
        isForeignKey: false,
      },
      {
        name: "name",
        dataType: "string",
        nullable: true,
        isPrimaryKey: false,
        isForeignKey: false,
        description: "Full name",
      },
      {
        name: "org_id",
        dataType: "integer",
        nullable: false,
        isPrimaryKey: false,
        isForeignKey: true,
        references: { table: "organizations", column: "id" },
      },
    ],
  },
  {
    name: "organizations",
    schema: "public",
    columns: [
      { name: "id", dataType: "integer", nullable: false, isPrimaryKey: true, isForeignKey: false },
      {
        name: "name",
        dataType: "string",
        nullable: false,
        isPrimaryKey: false,
        isForeignKey: false,
      },
    ],
  },
  {
    name: "posts",
    schema: "public",
    description: "User posts",
    columns: [
      { name: "id", dataType: "integer", nullable: false, isPrimaryKey: true, isForeignKey: false },
      {
        name: "user_id",
        dataType: "integer",
        nullable: false,
        isPrimaryKey: false,
        isForeignKey: true,
        references: { table: "users", column: "id" },
      },
      {
        name: "title",
        dataType: "string",
        nullable: false,
        isPrimaryKey: false,
        isForeignKey: false,
      },
    ],
  },
];

const sampleRelationships: TableRelationship[] = [
  {
    name: "fk_users_org",
    fromTable: "users",
    fromSchema: "public",
    fromColumn: "org_id",
    toTable: "organizations",
    toSchema: "public",
    toColumn: "id",
  },
  {
    name: "fk_posts_user",
    fromTable: "posts",
    fromSchema: "public",
    fromColumn: "user_id",
    toTable: "users",
    toSchema: "public",
    toColumn: "id",
  },
];

describe("SchemaIntrospector", () => {
  let introspector: SchemaIntrospector;

  beforeEach(() => {
    introspector = new SchemaIntrospector();
  });

  describe("getTables", () => {
    it("should call connector.getTables()", async () => {
      const mockConnector = createMockConnector({
        getTables: vi.fn().mockResolvedValue(sampleTables),
      });

      const tables = await introspector.getTables(mockConnector);

      expect(mockConnector.getTables).toHaveBeenCalledOnce();
      expect(tables).toEqual(sampleTables);
    });
  });

  describe("getRelationships", () => {
    it("should call connector.getRelationships()", async () => {
      const mockConnector = createMockConnector({
        getRelationships: vi.fn().mockResolvedValue(sampleRelationships),
      });

      const relationships = await introspector.getRelationships(mockConnector);

      expect(mockConnector.getRelationships).toHaveBeenCalledOnce();
      expect(relationships).toEqual(sampleRelationships);
    });
  });

  describe("refreshSchemaCache", () => {
    it("should fetch tables and relationships", async () => {
      const mockConnector = createMockConnector({
        getTables: vi.fn().mockResolvedValue(sampleTables),
        getRelationships: vi.fn().mockResolvedValue(sampleRelationships),
      });

      const cache = await introspector.refreshSchemaCache("conn-1", mockConnector);

      expect(cache.connectorId).toBe("conn-1");
      expect(cache.tables).toEqual(sampleTables);
      expect(cache.relationships).toEqual(sampleRelationships);
      expect(cache.cachedAt).toBeInstanceOf(Date);
      expect(cache.expiresAt).toBeInstanceOf(Date);
      expect(cache.expiresAt.getTime()).toBeGreaterThan(cache.cachedAt.getTime());
    });

    it("should use custom TTL", async () => {
      const mockConnector = createMockConnector({
        getTables: vi.fn().mockResolvedValue([]),
        getRelationships: vi.fn().mockResolvedValue([]),
      });

      const ttlMs = 5000; // 5 seconds
      const cache = await introspector.refreshSchemaCache("conn-1", mockConnector, ttlMs);

      const expectedExpiry = cache.cachedAt.getTime() + ttlMs;
      expect(cache.expiresAt.getTime()).toBe(expectedExpiry);
    });

    it("should store cache internally", async () => {
      const mockConnector = createMockConnector({
        getTables: vi.fn().mockResolvedValue(sampleTables),
        getRelationships: vi.fn().mockResolvedValue([]),
      });

      await introspector.refreshSchemaCache("conn-1", mockConnector);

      expect(introspector.isCacheValid("conn-1")).toBe(true);
    });
  });

  describe("getSchemaWithCache", () => {
    it("should return cached schema if valid", async () => {
      const mockConnector = createMockConnector({
        getTables: vi.fn().mockResolvedValue(sampleTables),
        getRelationships: vi.fn().mockResolvedValue([]),
      });

      // First call refreshes cache
      await introspector.getSchemaWithCache("conn-1", mockConnector);
      // Second call should use cache
      await introspector.getSchemaWithCache("conn-1", mockConnector);

      expect(mockConnector.getTables).toHaveBeenCalledOnce();
    });

    it("should refresh cache if expired", async () => {
      const mockConnector = createMockConnector({
        getTables: vi.fn().mockResolvedValue(sampleTables),
        getRelationships: vi.fn().mockResolvedValue([]),
      });

      // Refresh with very short TTL
      await introspector.refreshSchemaCache("conn-1", mockConnector, -1000);

      // Should refresh because expired
      await introspector.getSchemaWithCache("conn-1", mockConnector);

      expect(mockConnector.getTables).toHaveBeenCalledTimes(2);
    });

    it("should force refresh when requested", async () => {
      const mockConnector = createMockConnector({
        getTables: vi.fn().mockResolvedValue(sampleTables),
        getRelationships: vi.fn().mockResolvedValue([]),
      });

      await introspector.getSchemaWithCache("conn-1", mockConnector);
      await introspector.getSchemaWithCache("conn-1", mockConnector, true); // force refresh

      expect(mockConnector.getTables).toHaveBeenCalledTimes(2);
    });
  });

  describe("cache management", () => {
    it("should invalidate cache for a connector", async () => {
      const mockConnector = createMockConnector({
        getTables: vi.fn().mockResolvedValue(sampleTables),
        getRelationships: vi.fn().mockResolvedValue([]),
      });

      await introspector.refreshSchemaCache("conn-1", mockConnector);
      expect(introspector.isCacheValid("conn-1")).toBe(true);

      const invalidated = introspector.invalidateCache("conn-1");
      expect(invalidated).toBe(true);
      expect(introspector.isCacheValid("conn-1")).toBe(false);
    });

    it("should return false when invalidating non-existent cache", () => {
      const invalidated = introspector.invalidateCache("non-existent");
      expect(invalidated).toBe(false);
    });

    it("should clear all cache", async () => {
      const mockConnector = createMockConnector({
        getTables: vi.fn().mockResolvedValue([]),
        getRelationships: vi.fn().mockResolvedValue([]),
      });

      await introspector.refreshSchemaCache("conn-1", mockConnector);
      await introspector.refreshSchemaCache("conn-2", mockConnector);

      introspector.clearAllCache();

      expect(introspector.isCacheValid("conn-1")).toBe(false);
      expect(introspector.isCacheValid("conn-2")).toBe(false);
    });

    it("should return undefined for invalid/missing cache", () => {
      expect(introspector.getCachedSchema("non-existent")).toBeUndefined();
    });
  });

  describe("buildSchemaContext", () => {
    it("should build text representation of schema", async () => {
      const cache: SchemaCache = {
        connectorId: "conn-1",
        tables: sampleTables,
        relationships: sampleRelationships,
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      };

      const context = introspector.buildSchemaContext(cache, "postgres");

      expect(context).toContain("Database dialect: postgres");
      expect(context).toContain("Tables (3):");
      expect(context).toContain("public.users");
      expect(context).toContain("id: integer NOT NULL (PK)");
      expect(context).toContain("org_id: integer NOT NULL -> organizations.id");
      expect(context).toContain("Relationships (2):");
    });

    it("should include table descriptions", () => {
      const cache: SchemaCache = {
        connectorId: "conn-1",
        tables: sampleTables,
        relationships: [],
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      };

      const context = introspector.buildSchemaContext(cache, "postgres");

      expect(context).toContain("Description: User accounts");
    });
  });

  describe("buildCompactSchemaContext", () => {
    it("should build compact text representation", () => {
      const cache: SchemaCache = {
        connectorId: "conn-1",
        tables: sampleTables,
        relationships: [],
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      };

      const context = introspector.buildCompactSchemaContext(cache);

      expect(context).toContain("public.users (id):");
      expect(context).toContain("id, email, name, org_id");
    });
  });

  describe("findTables", () => {
    it("should find tables by name", () => {
      const cache: SchemaCache = {
        connectorId: "conn-1",
        tables: sampleTables,
        relationships: [],
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      };

      // Search for "organization" which only matches one table
      const results = introspector.findTables(cache, "organization");

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("organizations");
    });

    it("should find tables by description", () => {
      const cache: SchemaCache = {
        connectorId: "conn-1",
        tables: sampleTables,
        relationships: [],
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      };

      const results = introspector.findTables(cache, "accounts");

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("users");
    });

    it("should find tables by column name", () => {
      const cache: SchemaCache = {
        connectorId: "conn-1",
        tables: sampleTables,
        relationships: [],
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      };

      const results = introspector.findTables(cache, "email");

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("users");
    });
  });

  describe("findTable", () => {
    it("should find a specific table by name", () => {
      const cache: SchemaCache = {
        connectorId: "conn-1",
        tables: sampleTables,
        relationships: [],
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      };

      const table = introspector.findTable(cache, "users");

      expect(table).toBeDefined();
      expect(table?.name).toBe("users");
    });

    it("should find table by name and schema", () => {
      const cache: SchemaCache = {
        connectorId: "conn-1",
        tables: sampleTables,
        relationships: [],
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      };

      const table = introspector.findTable(cache, "users", "public");

      expect(table).toBeDefined();
      expect(table?.schema).toBe("public");
    });

    it("should return undefined for non-existent table", () => {
      const cache: SchemaCache = {
        connectorId: "conn-1",
        tables: sampleTables,
        relationships: [],
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      };

      const table = introspector.findTable(cache, "nonexistent");

      expect(table).toBeUndefined();
    });
  });

  describe("getTableRelationships", () => {
    it("should find incoming and outgoing relationships", () => {
      const cache: SchemaCache = {
        connectorId: "conn-1",
        tables: sampleTables,
        relationships: sampleRelationships,
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      };

      const rels = introspector.getTableRelationships(cache, "users");

      expect(rels.incoming).toHaveLength(1); // posts -> users
      expect(rels.outgoing).toHaveLength(1); // users -> organizations
    });
  });

  describe("getIntrospectionQueries", () => {
    it("should return MSSQL queries for mssql dialect", () => {
      const queries = SchemaIntrospector.getIntrospectionQueries("mssql");

      expect(queries.tables).toContain("INFORMATION_SCHEMA.TABLES");
      expect(queries.columns).toContain("INFORMATION_SCHEMA.COLUMNS");
      expect(queries.relationships).toContain("sys.foreign_keys");
    });

    it("should return PostgreSQL queries for postgres dialect", () => {
      const queries = SchemaIntrospector.getIntrospectionQueries("postgres");

      expect(queries.tables).toContain("information_schema.tables");
      expect(queries.columns).toContain("information_schema.columns");
      expect(queries.relationships).toContain("FOREIGN KEY");
    });
  });

  describe("factory function", () => {
    it("should create an introspector instance", () => {
      const i = createSchemaIntrospector();
      expect(i).toBeInstanceOf(SchemaIntrospector);
    });
  });
});
