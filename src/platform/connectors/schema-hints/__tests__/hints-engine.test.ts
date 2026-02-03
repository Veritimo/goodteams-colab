/**
 * Tests for Hints Engine
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock hints-service
vi.mock("../hints-service.js", () => ({
  listSchemaHints: vi.fn(),
  getSchemaCache: vi.fn(),
}));

import type { SchemaHintRecord, SchemaTable } from "../../types.js";
import {
  HintsEngine,
  applyHintsToContext,
  formatHintsForLLM,
  getRelevantHints,
  buildQueryPromptContext,
} from "../hints-engine.js";
import { listSchemaHints, getSchemaCache } from "../hints-service.js";

describe("Hints Engine", () => {
  const mockHints: SchemaHintRecord[] = [
    {
      id: "hint-1",
      connectionId: "conn-123",
      tableName: "users",
      columnName: "status",
      description: "Active users have status = 1",
      pattern: "WHERE status = 1",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
    },
    {
      id: "hint-2",
      connectionId: "conn-123",
      tableName: "users",
      columnName: null,
      description: "Users table contains customer information",
      pattern: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
    },
    {
      id: "hint-3",
      connectionId: "conn-123",
      tableName: "orders",
      columnName: "created_at",
      description: "Use created_at for order timeline queries",
      pattern: "ORDER BY created_at DESC",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
    },
    {
      id: "hint-4",
      connectionId: "conn-123",
      tableName: "orders",
      columnName: "status",
      description: "Completed orders have status = 'completed'",
      pattern: "WHERE status = 'completed'",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
    },
  ];

  const mockTables: SchemaTable[] = [
    {
      name: "users",
      columns: [
        { name: "id", type: "int", nullable: false, isPrimaryKey: true },
        { name: "name", type: "varchar(255)", nullable: true },
        { name: "email", type: "varchar(255)", nullable: false },
        { name: "status", type: "int", nullable: false },
      ],
    },
    {
      name: "orders",
      columns: [
        { name: "id", type: "int", nullable: false, isPrimaryKey: true },
        { name: "user_id", type: "int", nullable: false, isForeignKey: true },
        { name: "status", type: "varchar(50)", nullable: false },
        { name: "created_at", type: "datetime", nullable: false },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // HintsEngine CLASS TESTS
  // ===========================================================================

  describe("HintsEngine", () => {
    describe("buildContext", () => {
      it("should build complete query context", async () => {
        vi.mocked(listSchemaHints).mockResolvedValue(mockHints);
        vi.mocked(getSchemaCache).mockResolvedValue({
          id: "cache-123",
          connectionId: "conn-123",
          tables: mockTables,
          relationships: null,
          cachedAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000),
        });

        const engine = new HintsEngine();
        const context = await engine.buildContext("conn-123", "SQL_SERVER");

        expect(context.connectionType).toBe("SQL_SERVER");
        expect(context.tables).toHaveLength(2);
        expect(context.hints).toHaveLength(4);
        expect(context.formattedHints).toContain("Business Rules");
        expect(context.schemaSummary).toContain("Database Schema");
      });

      it("should filter hints based on options", async () => {
        vi.mocked(listSchemaHints).mockResolvedValue(mockHints);
        vi.mocked(getSchemaCache).mockResolvedValue(null);

        const engine = new HintsEngine();
        const context = await engine.buildContext("conn-123", "SQL_SERVER", {
          tables: ["users"],
        });

        expect(context.hints).toHaveLength(2);
        expect(context.hints.every((h) => h.tableName === "users")).toBe(true);
      });
    });

    describe("getHints with caching", () => {
      it("should cache hints", async () => {
        vi.mocked(listSchemaHints).mockResolvedValue(mockHints);

        const engine = new HintsEngine(60000); // 60 second cache

        // First call - fetches from DB
        const result1 = await engine.getHints("conn-123");
        expect(listSchemaHints).toHaveBeenCalledTimes(1);

        // Second call - uses cache
        const result2 = await engine.getHints("conn-123");
        expect(listSchemaHints).toHaveBeenCalledTimes(1);

        expect(result1).toEqual(result2);
      });

      it("should invalidate cache", async () => {
        vi.mocked(listSchemaHints).mockResolvedValue(mockHints);

        const engine = new HintsEngine(60000);

        await engine.getHints("conn-123");
        engine.invalidateCache("conn-123");
        await engine.getHints("conn-123");

        expect(listSchemaHints).toHaveBeenCalledTimes(2);
      });

      it("should clear all cache", async () => {
        vi.mocked(listSchemaHints).mockResolvedValue(mockHints);

        const engine = new HintsEngine(60000);

        await engine.getHints("conn-123");
        await engine.getHints("conn-456");
        engine.clearCache();
        await engine.getHints("conn-123");

        expect(listSchemaHints).toHaveBeenCalledTimes(3);
      });
    });

    describe("formatHints", () => {
      it("should format hints as markdown", () => {
        const engine = new HintsEngine();
        const formatted = engine.formatHints(mockHints, { style: "markdown" });

        expect(formatted).toContain("## Business Rules");
        expect(formatted).toContain("### users");
        expect(formatted).toContain("### orders");
        expect(formatted).toContain("Active users have status = 1");
      });

      it("should format hints as text", () => {
        const engine = new HintsEngine();
        const formatted = engine.formatHints(mockHints, { style: "text" });

        expect(formatted).toContain("Business Rules:");
        expect(formatted).toContain("users:");
        expect(formatted).not.toContain("##");
      });

      it("should format hints as JSON", () => {
        const engine = new HintsEngine();
        const formatted = engine.formatHints(mockHints, { style: "json" });

        const parsed = JSON.parse(formatted);
        expect(parsed).toHaveLength(4);
      });

      it("should include patterns when enabled", () => {
        const engine = new HintsEngine();
        const formatted = engine.formatHints(mockHints, {
          includePatterns: true,
          style: "markdown",
        });

        expect(formatted).toContain("Pattern:");
        expect(formatted).toContain("WHERE status = 1");
      });

      it("should exclude patterns when disabled", () => {
        const engine = new HintsEngine();
        const formatted = engine.formatHints(mockHints, {
          includePatterns: false,
          style: "markdown",
        });

        expect(formatted).not.toContain("Pattern:");
      });

      it("should limit hints", () => {
        const engine = new HintsEngine();
        const formatted = engine.formatHints(mockHints, { maxHints: 2 });

        // Only 2 hints should be included
        const lines = formatted.split("\n").filter((l) => l.includes("- "));
        expect(lines.length).toBeLessThanOrEqual(2);
      });

      it("should format flat list when groupByTable is false", () => {
        const engine = new HintsEngine();
        const formatted = engine.formatHints(mockHints, {
          groupByTable: false,
          style: "markdown",
        });

        expect(formatted).toContain("**users");
        expect(formatted).not.toContain("### users");
      });
    });

    describe("buildSchemaSummary", () => {
      it("should build schema summary", () => {
        const engine = new HintsEngine();
        const summary = engine.buildSchemaSummary(mockTables, "SQL_SERVER");

        expect(summary).toContain("## Database Schema (SQL_SERVER)");
        expect(summary).toContain("### users");
        expect(summary).toContain("### orders");
        expect(summary).toContain("| Column | Type | Nullable | Key |");
        expect(summary).toContain("| id | int | No | PK |");
      });

      it("should handle empty tables", () => {
        const engine = new HintsEngine();
        const summary = engine.buildSchemaSummary([], "POSTGRESQL");

        expect(summary).toBe("No schema information available.");
      });

      it("should show FK indicator", () => {
        const engine = new HintsEngine();
        const summary = engine.buildSchemaSummary(mockTables, "SQL_SERVER");

        expect(summary).toContain("| user_id | int | No | FK |");
      });
    });
  });

  // ===========================================================================
  // STANDALONE FUNCTION TESTS
  // ===========================================================================

  describe("applyHintsToContext", () => {
    it("should build context with all hints", async () => {
      vi.mocked(listSchemaHints).mockResolvedValue(mockHints);
      vi.mocked(getSchemaCache).mockResolvedValue(null);

      const context = await applyHintsToContext("conn-123", "POSTGRESQL");

      expect(context.connectionType).toBe("POSTGRESQL");
      expect(context.hints).toHaveLength(4);
    });
  });

  describe("formatHintsForLLM", () => {
    it("should format hints for LLM consumption", () => {
      const formatted = formatHintsForLLM(mockHints);

      expect(formatted).toContain("Business Rules");
      expect(formatted).toContain("users");
      expect(formatted).toContain("orders");
    });

    it("should respect format options", () => {
      const formatted = formatHintsForLLM(mockHints, {
        style: "text",
        includePatterns: false,
      });

      expect(formatted).not.toContain("Pattern:");
      expect(formatted).not.toContain("##");
    });
  });

  describe("getRelevantHints", () => {
    it("should filter by tables", async () => {
      vi.mocked(listSchemaHints).mockResolvedValue(mockHints);

      const hints = await getRelevantHints("conn-123", { tables: ["orders"] });

      expect(hints).toHaveLength(2);
      expect(hints.every((h) => h.tableName === "orders")).toBe(true);
    });

    it("should filter by keywords", async () => {
      vi.mocked(listSchemaHints).mockResolvedValue(mockHints);

      const hints = await getRelevantHints("conn-123", { keywords: ["active"] });

      expect(hints).toHaveLength(1);
      expect(hints[0].description).toContain("Active");
    });

    it("should limit results", async () => {
      vi.mocked(listSchemaHints).mockResolvedValue(mockHints);

      const hints = await getRelevantHints("conn-123", { maxHints: 2 });

      expect(hints).toHaveLength(2);
    });
  });

  describe("buildQueryPromptContext", () => {
    it("should build complete prompt context", async () => {
      vi.mocked(listSchemaHints).mockResolvedValue(mockHints);
      vi.mocked(getSchemaCache).mockResolvedValue({
        id: "cache-123",
        connectionId: "conn-123",
        tables: mockTables,
        relationships: null,
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      });

      const prompt = await buildQueryPromptContext(
        "conn-123",
        "SQL_SERVER",
        "Find all active users",
      );

      expect(prompt).toContain("Database Schema (SQL_SERVER)");
      expect(prompt).toContain("Business Rules");
      expect(prompt).toContain("## User Query");
      expect(prompt).toContain("Find all active users");
    });

    it("should handle missing schema cache", async () => {
      vi.mocked(listSchemaHints).mockResolvedValue(mockHints);
      vi.mocked(getSchemaCache).mockResolvedValue(null);

      const prompt = await buildQueryPromptContext("conn-123", "POSTGRESQL", "Get order count");

      expect(prompt).toContain("No schema information available");
      expect(prompt).toContain("Get order count");
    });
  });
});
