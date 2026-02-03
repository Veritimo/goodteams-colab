/**
 * Tests for Query Generator
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SchemaCache, QueryGenerationHint, QueryGenerationOptions } from "../types.js";
import {
  QueryGenerator,
  createQueryGenerator,
  MockLlmProvider,
  type LlmProvider,
} from "../query-generator.js";

// Sample schema cache for testing
const sampleSchemaCache: SchemaCache = {
  connectorId: "conn-1",
  tables: [
    {
      name: "users",
      schema: "public",
      columns: [
        {
          name: "id",
          dataType: "integer",
          nullable: false,
          isPrimaryKey: true,
          isForeignKey: false,
        },
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
        },
        {
          name: "created_at",
          dataType: "datetime",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
        },
      ],
    },
    {
      name: "orders",
      schema: "public",
      columns: [
        {
          name: "id",
          dataType: "integer",
          nullable: false,
          isPrimaryKey: true,
          isForeignKey: false,
        },
        {
          name: "user_id",
          dataType: "integer",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: true,
        },
        {
          name: "total",
          dataType: "decimal",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
        },
        {
          name: "status",
          dataType: "string",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
        },
      ],
    },
  ],
  relationships: [
    {
      name: "fk_orders_user",
      fromTable: "orders",
      fromSchema: "public",
      fromColumn: "user_id",
      toTable: "users",
      toSchema: "public",
      toColumn: "id",
    },
  ],
  cachedAt: new Date(),
  expiresAt: new Date(Date.now() + 3600000),
};

// Custom LLM provider for testing
class TestLlmProvider implements LlmProvider {
  private responses: Map<string, string> = new Map();

  setResponse(pattern: string, response: string) {
    this.responses.set(pattern.toLowerCase(), response);
  }

  async generate(prompt: string): Promise<string> {
    const lowerPrompt = prompt.toLowerCase();

    for (const [pattern, response] of this.responses) {
      if (lowerPrompt.includes(pattern)) {
        return response;
      }
    }

    return JSON.stringify({
      sql: "SELECT * FROM users",
      explanation: "Default test response",
      confidence: 0.5,
    });
  }
}

describe("QueryGenerator", () => {
  let generator: QueryGenerator;
  let llmProvider: TestLlmProvider;

  beforeEach(() => {
    llmProvider = new TestLlmProvider();
    generator = new QueryGenerator(llmProvider);
  });

  describe("generateSql", () => {
    it("should generate SQL from natural language", async () => {
      llmProvider.setResponse(
        "all users",
        JSON.stringify({
          sql: "SELECT * FROM users",
          explanation: "Retrieves all users",
          confidence: 0.95,
        }),
      );

      const result = await generator.generateSql(
        "Show me all users",
        sampleSchemaCache,
        "postgres",
      );

      expect(result.sql).toBe("SELECT * FROM users");
      expect(result.explanation).toBe("Retrieves all users");
      expect(result.confidence).toBe(0.95);
    });

    it("should include schema context in prompt", async () => {
      let capturedPrompt = "";
      const capturingProvider: LlmProvider = {
        async generate(prompt) {
          capturedPrompt = prompt;
          return JSON.stringify({ sql: "SELECT 1", explanation: "test" });
        },
      };

      const gen = new QueryGenerator(capturingProvider);
      await gen.generateSql("test query", sampleSchemaCache, "postgres");

      expect(capturedPrompt).toContain("public.users");
      expect(capturedPrompt).toContain("Database dialect: postgres");
    });

    it("should include hints in prompt", async () => {
      let capturedPrompt = "";
      const capturingProvider: LlmProvider = {
        async generate(prompt) {
          capturedPrompt = prompt;
          return JSON.stringify({ sql: "SELECT 1", explanation: "test" });
        },
      };

      const hints: QueryGenerationHint[] = [
        {
          tableName: "users",
          description: "Active users have status = 'active'",
          pattern: "WHERE status = 'active'",
        },
      ];

      const gen = new QueryGenerator(capturingProvider);
      await gen.generateSql("test query", sampleSchemaCache, "postgres", hints);

      expect(capturedPrompt).toContain("Active users have status = 'active'");
      expect(capturedPrompt).toContain("WHERE status = 'active'");
    });

    it("should handle read-only mode by default", async () => {
      llmProvider.setResponse(
        "delete",
        JSON.stringify({
          sql: "DELETE FROM users",
          explanation: "Deletes all users",
          confidence: 0.9,
        }),
      );

      const result = await generator.generateSql("delete all users", sampleSchemaCache, "postgres");

      // Should have warning about non-SELECT query
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some((w) => w.includes("DELETE") || w.includes("SELECT"))).toBe(true);
    });

    it("should handle non-JSON LLM responses", async () => {
      const badProvider: LlmProvider = {
        async generate() {
          return "SELECT * FROM users WHERE id = 1";
        },
      };

      const gen = new QueryGenerator(badProvider);
      const result = await gen.generateSql("test", sampleSchemaCache, "postgres");

      expect(result.sql).toBe("SELECT * FROM users WHERE id = 1");
      expect(result.confidence).toBe(0.3);
      expect(result.warnings).toContain("Response was not in expected JSON format");
    });

    it("should extract SQL from markdown code blocks", async () => {
      const markdownProvider: LlmProvider = {
        async generate() {
          return "Here is the query:\n```sql\nSELECT id, name FROM users\n```";
        },
      };

      const gen = new QueryGenerator(markdownProvider);
      const result = await gen.generateSql("test", sampleSchemaCache, "postgres");

      expect(result.sql).toBe("SELECT id, name FROM users");
    });

    it("should include parameters from response", async () => {
      llmProvider.setResponse(
        "specific user",
        JSON.stringify({
          sql: "SELECT * FROM users WHERE id = @userId",
          explanation: "Gets a specific user",
          parameters: { userId: 123 },
          confidence: 0.9,
        }),
      );

      const result = await generator.generateSql(
        "Get specific user 123",
        sampleSchemaCache,
        "postgres",
      );

      expect(result.parameters).toEqual({ userId: 123 });
    });

    it("should respect suggested limit option", async () => {
      let capturedPrompt = "";
      const capturingProvider: LlmProvider = {
        async generate(prompt) {
          capturedPrompt = prompt;
          return JSON.stringify({ sql: "SELECT 1", explanation: "test" });
        },
      };

      const options: QueryGenerationOptions = { suggestedLimit: 50 };
      const gen = new QueryGenerator(capturingProvider);
      await gen.generateSql("test", sampleSchemaCache, "postgres", [], options);

      expect(capturedPrompt).toContain("LIMIT 50");
    });
  });

  describe("validateSql", () => {
    it("should validate SELECT queries", () => {
      const result = generator.validateSql("SELECT * FROM users");

      expect(result.valid).toBe(true);
      expect(result.queryType).toBe("SELECT");
      expect(result.errors).toHaveLength(0);
    });

    it("should detect INSERT queries", () => {
      const result = generator.validateSql("INSERT INTO users (name) VALUES ('test')");

      expect(result.valid).toBe(true);
      expect(result.queryType).toBe("INSERT");
    });

    it("should detect UPDATE queries", () => {
      const result = generator.validateSql("UPDATE users SET name = 'test' WHERE id = 1");

      expect(result.valid).toBe(true);
      expect(result.queryType).toBe("UPDATE");
    });

    it("should detect DELETE queries", () => {
      const result = generator.validateSql("DELETE FROM users WHERE id = 1");

      expect(result.valid).toBe(true);
      expect(result.queryType).toBe("DELETE");
    });

    it("should reject DROP statements", () => {
      const result = generator.validateSql("DROP TABLE users");

      expect(result.valid).toBe(false);
      expect(result.queryType).toBe("DROP");
      expect(result.errors).toContain("DROP statements are not allowed");
    });

    it("should reject TRUNCATE statements", () => {
      const result = generator.validateSql("TRUNCATE TABLE users");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("TRUNCATE statements are not allowed");
    });

    it("should reject ALTER statements", () => {
      const result = generator.validateSql("ALTER TABLE users ADD COLUMN age INT");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("ALTER statements are not allowed");
    });

    it("should detect SQL injection patterns", () => {
      const result = generator.validateSql("SELECT * FROM users; DROP TABLE users");

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("dangerous"))).toBe(true);
    });

    it("should detect SQL comments", () => {
      const result = generator.validateSql("SELECT * FROM users -- WHERE id = 1");

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("comments"))).toBe(true);
    });

    it("should detect xp_cmdshell", () => {
      const result = generator.validateSql("EXEC xp_cmdshell 'dir'");

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("xp_cmdshell"))).toBe(true);
    });

    it("should warn about SELECT *", () => {
      const result = generator.validateSql("SELECT * FROM users");

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes("SELECT *"))).toBe(true);
    });

    it("should warn about UPDATE without WHERE", () => {
      const result = generator.validateSql("UPDATE users SET status = 'inactive'");

      expect(result.warnings.some((w) => w.includes("WHERE"))).toBe(true);
    });

    it("should warn about DELETE without WHERE", () => {
      const result = generator.validateSql("DELETE FROM users");

      expect(result.warnings.some((w) => w.includes("WHERE"))).toBe(true);
    });

    it("should extract referenced tables", () => {
      const result = generator.validateSql(
        "SELECT u.*, o.total FROM users u JOIN orders o ON u.id = o.user_id",
      );

      expect(result.referencedTables).toContain("users");
      expect(result.referencedTables).toContain("orders");
    });

    it("should handle empty SQL", () => {
      const result = generator.validateSql("");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("SQL query is empty");
    });
  });

  describe("sanitizeSql", () => {
    it("should remove multiple statements", () => {
      const sanitized = generator.sanitizeSql("SELECT 1; DROP TABLE users");

      expect(sanitized).toBe("SELECT 1");
    });

    it("should remove single-line comments", () => {
      const sanitized = generator.sanitizeSql("SELECT * FROM users -- comment");

      expect(sanitized).toBe("SELECT * FROM users");
    });

    it("should remove block comments", () => {
      const sanitized = generator.sanitizeSql("SELECT /* comment */ * FROM users");

      expect(sanitized).toBe("SELECT  * FROM users");
    });

    it("should trim whitespace", () => {
      const sanitized = generator.sanitizeSql("  SELECT * FROM users  ");

      expect(sanitized).toBe("SELECT * FROM users");
    });
  });

  describe("applyDefaultLimit", () => {
    it("should add LIMIT to SELECT queries", () => {
      const result = generator.applyDefaultLimit("SELECT * FROM users", 100);

      expect(result).toContain("LIMIT 100");
    });

    it("should not modify queries with existing LIMIT", () => {
      const sql = "SELECT * FROM users LIMIT 50";
      const result = generator.applyDefaultLimit(sql, 100);

      expect(result).toBe(sql);
    });

    it("should not modify queries with TOP clause", () => {
      const sql = "SELECT TOP 50 * FROM users";
      const result = generator.applyDefaultLimit(sql, 100);

      expect(result).toBe(sql);
    });

    it("should not modify non-SELECT queries", () => {
      const sql = "UPDATE users SET name = 'test'";
      const result = generator.applyDefaultLimit(sql, 100);

      expect(result).toBe(sql);
    });
  });

  describe("convertLimitToTop", () => {
    it("should convert LIMIT to TOP for MSSQL", () => {
      const result = generator.convertLimitToTop("SELECT * FROM users LIMIT 100");

      expect(result).toContain("SELECT TOP 100");
      expect(result).not.toContain("LIMIT");
    });

    it("should not modify queries without LIMIT", () => {
      const sql = "SELECT * FROM users";
      const result = generator.convertLimitToTop(sql);

      expect(result).toBe(sql);
    });
  });

  describe("MockLlmProvider", () => {
    it("should return response for 'all users'", async () => {
      const provider = new MockLlmProvider();
      const response = await provider.generate("Show me all users");
      const parsed = JSON.parse(response);

      expect(parsed.sql).toBe("SELECT * FROM users");
    });

    it("should return response for 'count'", async () => {
      const provider = new MockLlmProvider();
      const response = await provider.generate("count all records");
      const parsed = JSON.parse(response);

      expect(parsed.sql).toContain("COUNT(*)");
    });

    it("should return generic response for unknown queries", async () => {
      const provider = new MockLlmProvider();
      const response = await provider.generate("Something completely random xyz");
      const parsed = JSON.parse(response);

      expect(parsed.confidence).toBe(0.5);
      expect(parsed.warnings).toBeDefined();
    });
  });

  describe("factory function", () => {
    it("should create a generator with default provider", () => {
      const gen = createQueryGenerator();
      expect(gen).toBeInstanceOf(QueryGenerator);
    });

    it("should create a generator with custom provider", () => {
      const customProvider: LlmProvider = {
        async generate() {
          return JSON.stringify({ sql: "SELECT 1", explanation: "test" });
        },
      };

      const gen = createQueryGenerator(customProvider);
      expect(gen).toBeInstanceOf(QueryGenerator);
    });
  });
});
