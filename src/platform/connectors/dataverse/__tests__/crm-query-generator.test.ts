/**
 * CRM Query Generator Tests
 *
 * Tests for natural language to SQL query generation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SchemaHint, EntityMetadata } from "../types.js";
import {
  CrmQueryGenerator,
  createQueryGenerator,
  MockLLMProvider,
} from "../crm-query-generator.js";
import { EntityMetadataManager } from "../entity-metadata.js";

// Create mock metadata manager
function createMockMetadataManager(): EntityMetadataManager {
  const mockManager = {
    getMetadata: vi.fn(),
    getMetadataBatch: vi.fn(),
    buildSchemaContext: vi.fn(),
    formatSchemaContextForPrompt: vi.fn(),
    refreshMetadata: vi.fn(),
    clearCache: vi.fn(),
    getCachedEntities: vi.fn(),
    isCached: vi.fn(),
    getCommonRelationships: vi.fn(),
  } as unknown as EntityMetadataManager;

  // Default mock implementation
  (mockManager.buildSchemaContext as any).mockResolvedValue({
    entities: [
      {
        name: "contact",
        displayName: "Contact",
        primaryId: "contactid",
        primaryName: "fullname",
        columns: [
          { name: "contactid", displayName: "Contact ID", type: "guid", required: false },
          { name: "fullname", displayName: "Full Name", type: "string", required: false },
          { name: "emailaddress1", displayName: "Email", type: "string", required: true },
          { name: "statecode", displayName: "Status", type: "integer", required: false },
        ],
      },
    ],
    hints: [],
    dialectNotes: ["Dataverse TDS supports read-only SELECT queries"],
  });

  return mockManager;
}

describe("CrmQueryGenerator", () => {
  let mockMetadataManager: ReturnType<typeof createMockMetadataManager>;
  let generator: CrmQueryGenerator;
  let llmProvider: MockLLMProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMetadataManager = createMockMetadataManager();
    llmProvider = new MockLLMProvider();
    generator = new CrmQueryGenerator(mockMetadataManager, llmProvider);
  });

  describe("constructor", () => {
    it("should create generator with metadata manager and LLM provider", () => {
      expect(generator).toBeInstanceOf(CrmQueryGenerator);
    });
  });

  describe("createQueryGenerator", () => {
    it("should create generator using factory function", () => {
      const factoryGenerator = createQueryGenerator(mockMetadataManager);
      expect(factoryGenerator).toBeInstanceOf(CrmQueryGenerator);
    });

    it("should create generator with custom LLM provider", () => {
      const customProvider = new MockLLMProvider();
      const factoryGenerator = createQueryGenerator(mockMetadataManager, customProvider);
      expect(factoryGenerator).toBeInstanceOf(CrmQueryGenerator);
    });
  });

  describe("MockLLMProvider", () => {
    it("should return custom response when set", async () => {
      llmProvider.setResponse("test prompt", "SELECT * FROM test");
      const result = await llmProvider.generate("test prompt");
      expect(result).toBe("SELECT * FROM test");
    });

    it("should generate query for active contacts", async () => {
      const result = await llmProvider.generate("Show me active contacts");
      expect(result).toContain("SELECT");
      expect(result).toContain("contact");
      expect(result).toContain("statecode = 0");
    });

    it("should generate query for accounts with revenue", async () => {
      const result = await llmProvider.generate("Show accounts by revenue");
      expect(result).toContain("account");
      expect(result).toContain("revenue");
    });

    it("should generate query for won opportunities", async () => {
      const result = await llmProvider.generate("Show won opportunity deals");
      expect(result).toContain("opportunity");
    });
  });

  describe("generateQuery", () => {
    it("should generate SQL from natural language prompt", async () => {
      const result = await generator.generateQuery("Show me active contacts", "conn-123");

      expect(result.sql).toBeDefined();
      expect(result.sql).toContain("SELECT");
      expect(result.entities).toContain("contact");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should detect contact entity from prompt", async () => {
      const result = await generator.generateQuery("Find all customers", "conn-123");

      expect(result.entities).toContain("contact");
    });

    it("should detect account entity from prompt", async () => {
      (mockMetadataManager.buildSchemaContext as any).mockResolvedValue({
        entities: [
          {
            name: "account",
            displayName: "Account",
            primaryId: "accountid",
            primaryName: "name",
            columns: [],
          },
        ],
        hints: [],
        dialectNotes: [],
      });

      const result = await generator.generateQuery("Show all companies", "conn-123");

      expect(result.entities).toContain("account");
    });

    it("should detect opportunity entity from prompt", async () => {
      const result = await generator.generateQuery("Show me all deals", "conn-123");

      expect(result.entities).toContain("opportunity");
    });

    it("should detect lead entity from prompt", async () => {
      const result = await generator.generateQuery("Show prospects", "conn-123");

      expect(result.entities).toContain("lead");
    });

    it("should detect incident entity from prompt", async () => {
      const result = await generator.generateQuery("List open cases", "conn-123");

      expect(result.entities).toContain("incident");
    });

    it("should include warnings for missing statecode filter", async () => {
      // Use custom generator with inline provider to control response
      const customGenerator = new CrmQueryGenerator(mockMetadataManager, {
        generate: async () => "```sql\nSELECT fullname FROM contact\n```",
      });

      const result = await customGenerator.generateQuery("Show me contacts", "conn-123");

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some((w) => w.includes("statecode"))).toBe(true);
    });

    it("should include warnings for missing TOP clause", async () => {
      const customGenerator = new CrmQueryGenerator(mockMetadataManager, {
        generate: async () => "```sql\nSELECT fullname FROM contact WHERE statecode = 0\n```",
      });

      const result = await customGenerator.generateQuery("Show contacts", "conn-123");

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some((w) => w.includes("TOP"))).toBe(true);
    });

    it("should include warnings for SELECT *", async () => {
      const customGenerator = new CrmQueryGenerator(mockMetadataManager, {
        generate: async () => "```sql\nSELECT TOP 100 * FROM contact WHERE statecode = 0\n```",
      });

      const result = await customGenerator.generateQuery("Get contacts", "conn-123");

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some((w) => w.includes("SELECT *"))).toBe(true);
    });

    it("should warn about write operations in query", async () => {
      const customGenerator = new CrmQueryGenerator(mockMetadataManager, {
        generate: async () => "```sql\nDELETE FROM contact WHERE id = 1\n```",
      });

      const result = await customGenerator.generateQuery("delete", "conn-123");

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some((w) => w.includes("DELETE"))).toBe(true);
    });
  });

  describe("hints management", () => {
    it("should add hints for a connector", () => {
      const hints: SchemaHint[] = [
        {
          entityName: "contact",
          description: "Active contacts have statecode = 0",
        },
      ];

      generator.addHints("conn-123", hints);
      const stored = generator.getHints("conn-123");

      expect(stored).toHaveLength(1);
      expect(stored[0].description).toContain("statecode");
    });

    it("should append hints to existing ones", () => {
      generator.addHints("conn-123", [{ entityName: "contact", description: "Rule 1" }]);
      generator.addHints("conn-123", [{ entityName: "account", description: "Rule 2" }]);

      const stored = generator.getHints("conn-123");
      expect(stored).toHaveLength(2);
    });

    it("should remove hints by description", () => {
      generator.addHints("conn-123", [
        { entityName: "contact", description: "Rule 1" },
        { entityName: "contact", description: "Rule 2" },
      ]);

      generator.removeHints("conn-123", ["Rule 1"]);

      const stored = generator.getHints("conn-123");
      expect(stored).toHaveLength(1);
      expect(stored[0].description).toBe("Rule 2");
    });

    it("should clear all hints for a connector", () => {
      generator.addHints("conn-123", [
        { entityName: "contact", description: "Rule 1" },
        { entityName: "contact", description: "Rule 2" },
      ]);

      generator.clearHints("conn-123");

      expect(generator.getHints("conn-123")).toHaveLength(0);
    });

    it("should return empty array for unknown connector", () => {
      expect(generator.getHints("unknown")).toHaveLength(0);
    });

    it("should isolate hints between connectors", () => {
      generator.addHints("conn-1", [{ entityName: "contact", description: "Rule A" }]);
      generator.addHints("conn-2", [{ entityName: "account", description: "Rule B" }]);

      expect(generator.getHints("conn-1")).toHaveLength(1);
      expect(generator.getHints("conn-2")).toHaveLength(1);
      expect(generator.getHints("conn-1")[0].description).toBe("Rule A");
    });
  });

  describe("getDefaultHints", () => {
    it("should return array of default CRM hints", () => {
      const hints = CrmQueryGenerator.getDefaultHints();

      expect(Array.isArray(hints)).toBe(true);
      expect(hints.length).toBeGreaterThan(0);
    });

    it("should include contact hints", () => {
      const hints = CrmQueryGenerator.getDefaultHints();
      const contactHint = hints.find((h) => h.entityName === "contact");

      expect(contactHint).toBeDefined();
      expect(contactHint?.description).toContain("statecode");
    });

    it("should include account hints", () => {
      const hints = CrmQueryGenerator.getDefaultHints();
      const accountHint = hints.find((h) => h.entityName === "account");

      expect(accountHint).toBeDefined();
    });

    it("should include opportunity hints", () => {
      const hints = CrmQueryGenerator.getDefaultHints();
      const oppHint = hints.find((h) => h.entityName === "opportunity");

      expect(oppHint).toBeDefined();
      expect(oppHint?.description).toContain("Won");
    });

    it("should include SQL patterns in hints", () => {
      const hints = CrmQueryGenerator.getDefaultHints();
      const hintsWithPatterns = hints.filter((h) => h.pattern);

      expect(hintsWithPatterns.length).toBeGreaterThan(0);
    });
  });

  describe("SQL extraction", () => {
    it("should extract SQL from code block", async () => {
      const customGenerator = new CrmQueryGenerator(mockMetadataManager, {
        generate: async () =>
          "Here is the query:\n```sql\nSELECT * FROM contact\n```\nThis query...",
      });

      const result = await customGenerator.generateQuery("test", "conn-123");
      expect(result.sql).toBe("SELECT * FROM contact");
    });

    it("should extract SQL from generic code block", async () => {
      const customGenerator = new CrmQueryGenerator(mockMetadataManager, {
        generate: async () => "Query:\n```\nSELECT name FROM account\n```",
      });

      const result = await customGenerator.generateQuery("test2", "conn-123");
      expect(result.sql).toBe("SELECT name FROM account");
    });

    it("should find SELECT statement without code block", async () => {
      const customGenerator = new CrmQueryGenerator(mockMetadataManager, {
        generate: async () => "The SQL is: SELECT fullname FROM contact WHERE statecode = 0",
      });

      const result = await customGenerator.generateQuery("test3", "conn-123");
      expect(result.sql).toContain("SELECT fullname FROM contact");
    });
  });

  describe("confidence calculation", () => {
    it("should have higher confidence for well-formed queries", async () => {
      const customGenerator = new CrmQueryGenerator(mockMetadataManager, {
        generate: async () =>
          "```sql\nSELECT TOP 100 fullname FROM contact WHERE statecode = 0\n```",
      });

      const result = await customGenerator.generateQuery("Show active contacts", "conn-123");
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it("should have lower confidence for SELECT * queries", async () => {
      const customGenerator = new CrmQueryGenerator(mockMetadataManager, {
        generate: async () => "```sql\nSELECT * FROM contact\n```",
      });

      const result = await customGenerator.generateQuery("star query", "conn-123");
      expect(result.confidence).toBeLessThan(0.7);
    });

    it("should have very low confidence for write operations", async () => {
      const customGenerator = new CrmQueryGenerator(mockMetadataManager, {
        generate: async () => "```sql\nINSERT INTO contact VALUES (1)\n```",
      });

      const result = await customGenerator.generateQuery("write", "conn-123");
      expect(result.confidence).toBeLessThan(0.5);
    });
  });
});
