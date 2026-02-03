/**
 * Tests for Schema Hints Service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Prisma client
vi.mock("../../../db/client.js", () => ({
  prisma: {
    schemaHint: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      count: vi.fn(),
    },
    schemaCache: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    resourceConnection: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "../../../db/client.js";
import {
  createSchemaHint,
  getSchemaHint,
  listSchemaHints,
  updateSchemaHint,
  deleteSchemaHint,
  deleteAllSchemaHints,
  bulkCreateSchemaHints,
  countSchemaHints,
  getSchemaCache,
  updateSchemaCache,
  invalidateSchemaCache,
  SchemaHintNotFoundError,
  SchemaHintDuplicateError,
  ConnectionNotFoundError,
} from "../hints-service.js";

describe("Schema Hints Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // SCHEMA HINT CRUD TESTS
  // ===========================================================================

  describe("createSchemaHint", () => {
    const mockHint = {
      id: "hint-123",
      connectionId: "conn-123",
      tableName: "users",
      columnName: "status",
      description: "Active users have status = 1",
      pattern: "WHERE status = 1",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "user-123",
    };

    it("should create a schema hint", async () => {
      vi.mocked(prisma.resourceConnection.findUnique).mockResolvedValue({ id: "conn-123" } as any);
      vi.mocked(prisma.schemaHint.create).mockResolvedValue(mockHint);

      const result = await createSchemaHint({
        connectionId: "conn-123",
        tableName: "users",
        columnName: "status",
        description: "Active users have status = 1",
        pattern: "WHERE status = 1",
        createdBy: "user-123",
      });

      expect(result.id).toBe("hint-123");
      expect(result.tableName).toBe("users");
      expect(result.description).toBe("Active users have status = 1");
    });

    it("should throw ConnectionNotFoundError for missing connection", async () => {
      vi.mocked(prisma.resourceConnection.findUnique).mockResolvedValue(null);

      await expect(
        createSchemaHint({
          connectionId: "nonexistent",
          tableName: "users",
          description: "Test hint",
        }),
      ).rejects.toThrow(ConnectionNotFoundError);
    });

    it("should throw SchemaHintDuplicateError for duplicates", async () => {
      vi.mocked(prisma.resourceConnection.findUnique).mockResolvedValue({ id: "conn-123" } as any);
      vi.mocked(prisma.schemaHint.create).mockRejectedValue(new Error("Unique constraint failed"));

      await expect(
        createSchemaHint({
          connectionId: "conn-123",
          tableName: "users",
          description: "Duplicate hint",
        }),
      ).rejects.toThrow(SchemaHintDuplicateError);
    });

    it("should create hint without column name", async () => {
      vi.mocked(prisma.resourceConnection.findUnique).mockResolvedValue({ id: "conn-123" } as any);
      vi.mocked(prisma.schemaHint.create).mockResolvedValue({
        ...mockHint,
        columnName: null,
      });

      const result = await createSchemaHint({
        connectionId: "conn-123",
        tableName: "users",
        description: "Table-level hint",
      });

      expect(result.columnName).toBeNull();
    });
  });

  describe("getSchemaHint", () => {
    it("should return hint by ID", async () => {
      const mockHint = {
        id: "hint-123",
        connectionId: "conn-123",
        tableName: "users",
        columnName: null,
        description: "Test hint",
        pattern: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
      };

      vi.mocked(prisma.schemaHint.findUnique).mockResolvedValue(mockHint);

      const result = await getSchemaHint("hint-123");

      expect(result.id).toBe("hint-123");
      expect(result.tableName).toBe("users");
    });

    it("should throw SchemaHintNotFoundError for missing hint", async () => {
      vi.mocked(prisma.schemaHint.findUnique).mockResolvedValue(null);

      await expect(getSchemaHint("nonexistent")).rejects.toThrow(SchemaHintNotFoundError);
    });
  });

  describe("listSchemaHints", () => {
    it("should return all hints for a connection", async () => {
      const mockHints = [
        {
          id: "hint-1",
          connectionId: "conn-123",
          tableName: "users",
          columnName: null,
          description: "Hint 1",
          pattern: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
        },
        {
          id: "hint-2",
          connectionId: "conn-123",
          tableName: "orders",
          columnName: "status",
          description: "Hint 2",
          pattern: "WHERE status = 'active'",
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
        },
      ];

      vi.mocked(prisma.schemaHint.findMany).mockResolvedValue(mockHints);

      const result = await listSchemaHints("conn-123");

      expect(result).toHaveLength(2);
    });

    it("should filter by table name when provided", async () => {
      vi.mocked(prisma.schemaHint.findMany).mockResolvedValue([]);

      await listSchemaHints("conn-123", "users");

      expect(prisma.schemaHint.findMany).toHaveBeenCalledWith({
        where: { connectionId: "conn-123", tableName: "users" },
        orderBy: [{ tableName: "asc" }, { columnName: "asc" }],
      });
    });
  });

  describe("updateSchemaHint", () => {
    it("should update hint properties", async () => {
      vi.mocked(prisma.schemaHint.findUnique).mockResolvedValue({ id: "hint-123" } as any);
      vi.mocked(prisma.schemaHint.update).mockResolvedValue({
        id: "hint-123",
        connectionId: "conn-123",
        tableName: "users",
        columnName: "email",
        description: "Updated description",
        pattern: "LIKE '%@example.com'",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
      });

      const result = await updateSchemaHint("hint-123", {
        description: "Updated description",
        pattern: "LIKE '%@example.com'",
      });

      expect(result.description).toBe("Updated description");
      expect(result.pattern).toBe("LIKE '%@example.com'");
    });

    it("should throw SchemaHintNotFoundError for missing hint", async () => {
      vi.mocked(prisma.schemaHint.findUnique).mockResolvedValue(null);

      await expect(updateSchemaHint("nonexistent", { description: "New" })).rejects.toThrow(
        SchemaHintNotFoundError,
      );
    });
  });

  describe("deleteSchemaHint", () => {
    it("should delete hint", async () => {
      vi.mocked(prisma.schemaHint.findUnique).mockResolvedValue({ id: "hint-123" } as any);
      vi.mocked(prisma.schemaHint.delete).mockResolvedValue({} as any);

      const result = await deleteSchemaHint("hint-123");

      expect(result).toBe(true);
      expect(prisma.schemaHint.delete).toHaveBeenCalledWith({
        where: { id: "hint-123" },
      });
    });

    it("should throw SchemaHintNotFoundError for missing hint", async () => {
      vi.mocked(prisma.schemaHint.findUnique).mockResolvedValue(null);

      await expect(deleteSchemaHint("nonexistent")).rejects.toThrow(SchemaHintNotFoundError);
    });
  });

  describe("deleteAllSchemaHints", () => {
    it("should delete all hints for a connection", async () => {
      vi.mocked(prisma.schemaHint.deleteMany).mockResolvedValue({ count: 5 });

      const result = await deleteAllSchemaHints("conn-123");

      expect(result).toBe(5);
      expect(prisma.schemaHint.deleteMany).toHaveBeenCalledWith({
        where: { connectionId: "conn-123" },
      });
    });

    it("should return 0 if no hints to delete", async () => {
      vi.mocked(prisma.schemaHint.deleteMany).mockResolvedValue({ count: 0 });

      const result = await deleteAllSchemaHints("conn-456");

      expect(result).toBe(0);
    });
  });

  describe("bulkCreateSchemaHints", () => {
    it("should create multiple hints", async () => {
      vi.mocked(prisma.resourceConnection.findMany).mockResolvedValue([{ id: "conn-123" }] as any);
      vi.mocked(prisma.schemaHint.createMany).mockResolvedValue({ count: 3 });

      const hints = [
        { connectionId: "conn-123", tableName: "t1", description: "d1" },
        { connectionId: "conn-123", tableName: "t2", description: "d2" },
        { connectionId: "conn-123", tableName: "t3", description: "d3" },
      ];

      const result = await bulkCreateSchemaHints(hints);

      expect(result).toBe(3);
    });

    it("should throw ConnectionNotFoundError for missing connection", async () => {
      vi.mocked(prisma.resourceConnection.findMany).mockResolvedValue([]);

      await expect(
        bulkCreateSchemaHints([
          { connectionId: "nonexistent", tableName: "t1", description: "d1" },
        ]),
      ).rejects.toThrow(ConnectionNotFoundError);
    });
  });

  describe("countSchemaHints", () => {
    it("should return count for connection", async () => {
      vi.mocked(prisma.schemaHint.count).mockResolvedValue(10);

      const result = await countSchemaHints("conn-123");

      expect(result).toBe(10);
    });
  });

  // ===========================================================================
  // SCHEMA CACHE TESTS
  // ===========================================================================

  describe("getSchemaCache", () => {
    it("should return schema cache", async () => {
      const mockCache = {
        id: "cache-123",
        connectionId: "conn-123",
        tables: [{ name: "users", columns: [] }],
        relationships: null,
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      };

      vi.mocked(prisma.schemaCache.findUnique).mockResolvedValue(mockCache);

      const result = await getSchemaCache("conn-123");

      expect(result).not.toBeNull();
      expect(result!.tables).toHaveLength(1);
    });

    it("should return null for expired cache", async () => {
      const mockCache = {
        id: "cache-123",
        connectionId: "conn-123",
        tables: [{ name: "users", columns: [] }],
        relationships: null,
        cachedAt: new Date(Date.now() - 7200000),
        expiresAt: new Date(Date.now() - 3600000), // Expired 1 hour ago
      };

      vi.mocked(prisma.schemaCache.findUnique).mockResolvedValue(mockCache);

      const result = await getSchemaCache("conn-123");

      expect(result).toBeNull();
    });

    it("should return null for missing cache", async () => {
      vi.mocked(prisma.schemaCache.findUnique).mockResolvedValue(null);

      const result = await getSchemaCache("conn-123");

      expect(result).toBeNull();
    });
  });

  describe("updateSchemaCache", () => {
    it("should create or update schema cache", async () => {
      const tables = [
        {
          name: "users",
          columns: [
            { name: "id", type: "int", nullable: false },
            { name: "name", type: "varchar", nullable: true },
          ],
        },
      ];

      const mockCache = {
        id: "cache-123",
        connectionId: "conn-123",
        tables,
        relationships: null,
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      };

      vi.mocked(prisma.schemaCache.upsert).mockResolvedValue(mockCache);

      const result = await updateSchemaCache("conn-123", tables);

      expect(result.tables).toEqual(tables);
      expect(prisma.schemaCache.upsert).toHaveBeenCalled();
    });

    it("should include relationships when provided", async () => {
      const tables = [{ name: "orders", columns: [] }];
      const relationships = [
        {
          fromTable: "orders",
          fromColumn: "user_id",
          toTable: "users",
          toColumn: "id",
          type: "many-to-one" as const,
        },
      ];

      vi.mocked(prisma.schemaCache.upsert).mockResolvedValue({
        id: "cache-123",
        connectionId: "conn-123",
        tables,
        relationships,
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      });

      const result = await updateSchemaCache("conn-123", tables, relationships as any);

      expect(result.relationships).toEqual(relationships);
    });

    it("should use custom TTL", async () => {
      vi.mocked(prisma.schemaCache.upsert).mockResolvedValue({
        id: "cache-123",
        connectionId: "conn-123",
        tables: [],
        relationships: null,
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 7200000), // 2 hours
      });

      await updateSchemaCache("conn-123", [], undefined, 7200000);

      const call = vi.mocked(prisma.schemaCache.upsert).mock.calls[0][0];
      const expiresAt = call.create.expiresAt as Date;
      const ttl = expiresAt.getTime() - call.create.cachedAt.getTime();

      expect(ttl).toBe(7200000);
    });
  });

  describe("invalidateSchemaCache", () => {
    it("should delete schema cache", async () => {
      vi.mocked(prisma.schemaCache.deleteMany).mockResolvedValue({ count: 1 });

      const result = await invalidateSchemaCache("conn-123");

      expect(result).toBe(true);
    });

    it("should return false if no cache to delete", async () => {
      vi.mocked(prisma.schemaCache.deleteMany).mockResolvedValue({ count: 0 });

      const result = await invalidateSchemaCache("conn-456");

      expect(result).toBe(false);
    });
  });
});
