/**
 * Entity Metadata Manager Tests
 *
 * Tests for schema caching and LLM context building.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RestClient } from "../rest-client.js";
import type { EntityMetadata, SchemaHint } from "../types.js";
import { EntityMetadataManager, createMetadataManager } from "../entity-metadata.js";

// Create mock REST client
function createMockRestClient(): RestClient {
  return {
    getEntityMetadata: vi.fn(),
    getAttributeMetadata: vi.fn(),
    getOptionSetValues: vi.fn(),
    query: vi.fn(),
    getRecord: vi.fn(),
    createRecord: vi.fn(),
    updateRecord: vi.fn(),
    deleteRecord: vi.fn(),
    executeBatch: vi.fn(),
    testConnection: vi.fn(),
  } as unknown as RestClient;
}

const mockContactMetadata: EntityMetadata = {
  logicalName: "contact",
  displayName: "Contact",
  primaryIdAttribute: "contactid",
  primaryNameAttribute: "fullname",
  objectTypeCode: 2,
  changeTrackingEnabled: true,
  attributes: [
    {
      logicalName: "contactid",
      displayName: "Contact ID",
      attributeType: "UniqueIdentifier",
      isValidForCreate: false,
      isValidForUpdate: false,
    },
    {
      logicalName: "fullname",
      displayName: "Full Name",
      attributeType: "String",
      isValidForCreate: true,
      isValidForUpdate: true,
    },
    {
      logicalName: "emailaddress1",
      displayName: "Email",
      attributeType: "String",
      isValidForCreate: true,
      isValidForUpdate: true,
      isRequired: true,
    },
    {
      logicalName: "parentcustomerid",
      displayName: "Company",
      attributeType: "Lookup",
      isValidForCreate: true,
      isValidForUpdate: true,
      targets: ["account"],
    },
  ],
};

const mockAccountMetadata: EntityMetadata = {
  logicalName: "account",
  displayName: "Account",
  primaryIdAttribute: "accountid",
  primaryNameAttribute: "name",
  attributes: [
    {
      logicalName: "accountid",
      displayName: "Account ID",
      attributeType: "UniqueIdentifier",
      isValidForCreate: false,
      isValidForUpdate: false,
    },
    {
      logicalName: "name",
      displayName: "Account Name",
      attributeType: "String",
      isValidForCreate: true,
      isValidForUpdate: true,
    },
    {
      logicalName: "revenue",
      displayName: "Annual Revenue",
      attributeType: "Money",
      isValidForCreate: true,
      isValidForUpdate: true,
    },
  ],
};

describe("EntityMetadataManager", () => {
  let mockRestClient: ReturnType<typeof createMockRestClient>;
  let manager: EntityMetadataManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRestClient = createMockRestClient();
    (mockRestClient.getEntityMetadata as any).mockImplementation(async (entityName: string) => {
      if (entityName === "contact") return mockContactMetadata;
      if (entityName === "account") return mockAccountMetadata;
      throw new Error(`Entity not found: ${entityName}`);
    });
    manager = new EntityMetadataManager({
      restClient: mockRestClient,
      cacheTtlMs: 60000, // 1 minute for tests
    });
  });

  describe("constructor", () => {
    it("should create manager with rest client", () => {
      expect(manager).toBeInstanceOf(EntityMetadataManager);
    });
  });

  describe("createMetadataManager", () => {
    it("should create manager using factory function", () => {
      const factoryManager = createMetadataManager(mockRestClient);
      expect(factoryManager).toBeInstanceOf(EntityMetadataManager);
    });

    it("should accept custom cache TTL", () => {
      const factoryManager = createMetadataManager(mockRestClient, 120000);
      expect(factoryManager).toBeInstanceOf(EntityMetadataManager);
    });
  });

  describe("getMetadata", () => {
    it("should fetch metadata from API on cache miss", async () => {
      const metadata = await manager.getMetadata("contact");

      expect(mockRestClient.getEntityMetadata).toHaveBeenCalledWith("contact");
      expect(metadata.logicalName).toBe("contact");
      expect(metadata.displayName).toBe("Contact");
    });

    it("should return cached metadata on subsequent calls", async () => {
      await manager.getMetadata("contact");
      await manager.getMetadata("contact");

      // Should only call API once
      expect(mockRestClient.getEntityMetadata).toHaveBeenCalledTimes(1);
    });

    it("should normalize entity name to lowercase", async () => {
      await manager.getMetadata("Contact");
      await manager.getMetadata("CONTACT");
      await manager.getMetadata("contact");

      // Should all hit the same cache entry
      expect(mockRestClient.getEntityMetadata).toHaveBeenCalledTimes(1);
    });
  });

  describe("getMetadataBatch", () => {
    it("should fetch multiple entities in parallel", async () => {
      const results = await manager.getMetadataBatch(["contact", "account"]);

      expect(results.size).toBe(2);
      expect(results.get("contact")?.logicalName).toBe("contact");
      expect(results.get("account")?.logicalName).toBe("account");
    });

    it("should continue on error for individual entities", async () => {
      const results = await manager.getMetadataBatch(["contact", "nonexistent"]);

      expect(results.size).toBe(1);
      expect(results.get("contact")).toBeDefined();
      expect(results.get("nonexistent")).toBeUndefined();
    });
  });

  describe("refreshMetadata", () => {
    it("should clear and re-fetch specified entities", async () => {
      // First fetch
      await manager.getMetadata("contact");
      expect(mockRestClient.getEntityMetadata).toHaveBeenCalledTimes(1);

      // Refresh
      await manager.refreshMetadata(["contact"]);
      expect(mockRestClient.getEntityMetadata).toHaveBeenCalledTimes(2);
    });
  });

  describe("clearCache", () => {
    it("should clear all cached entities", async () => {
      await manager.getMetadata("contact");
      await manager.getMetadata("account");

      manager.clearCache();

      expect(manager.getCachedEntities()).toHaveLength(0);
    });
  });

  describe("getCachedEntities", () => {
    it("should return list of cached entity names", async () => {
      await manager.getMetadata("contact");
      await manager.getMetadata("account");

      const cached = manager.getCachedEntities();

      expect(cached).toContain("contact");
      expect(cached).toContain("account");
    });
  });

  describe("isCached", () => {
    it("should return true for cached entities", async () => {
      await manager.getMetadata("contact");

      expect(manager.isCached("contact")).toBe(true);
      expect(manager.isCached("Contact")).toBe(true);
    });

    it("should return false for uncached entities", () => {
      expect(manager.isCached("account")).toBe(false);
    });
  });

  describe("buildSchemaContext", () => {
    it("should build context from multiple entities", async () => {
      const context = await manager.buildSchemaContext(["contact", "account"]);

      expect(context.entities).toHaveLength(2);
      expect(context.entities[0].name).toBe("contact");
      expect(context.entities[1].name).toBe("account");
    });

    it("should include schema hints in context", async () => {
      const hints: SchemaHint[] = [
        {
          entityName: "contact",
          description: "Active contacts have statecode = 0",
          pattern: "WHERE statecode = 0",
        },
      ];

      const context = await manager.buildSchemaContext(["contact"], hints);

      expect(context.hints).toHaveLength(1);
      expect(context.hints[0]).toContain("statecode = 0");
    });

    it("should include dialect notes", async () => {
      const context = await manager.buildSchemaContext(["contact"]);

      expect(context.dialectNotes.length).toBeGreaterThan(0);
    });

    it("should map attribute types correctly", async () => {
      const context = await manager.buildSchemaContext(["contact"]);

      const contactEntity = context.entities.find((e) => e.name === "contact");
      const lookupCol = contactEntity?.columns.find((c) => c.name === "parentcustomerid");

      expect(lookupCol?.type).toContain("lookup");
      expect(lookupCol?.relatedTo).toBe("account");
    });
  });

  describe("formatSchemaContextForPrompt", () => {
    it("should format context as readable text", async () => {
      const context = await manager.buildSchemaContext(["contact"]);
      const text = manager.formatSchemaContextForPrompt(context);

      expect(text).toContain("## Database Schema");
      expect(text).toContain("Contact");
      expect(text).toContain("contactid");
      expect(text).toContain("## SQL Notes");
    });

    it("should include hints section when hints exist", async () => {
      const hints: SchemaHint[] = [{ entityName: "contact", description: "Test rule" }];
      const context = await manager.buildSchemaContext(["contact"], hints);
      const text = manager.formatSchemaContextForPrompt(context);

      expect(text).toContain("## Business Rules");
      expect(text).toContain("Test rule");
    });
  });

  describe("getCommonRelationships", () => {
    it("should return relationships for contact", () => {
      const relationships = manager.getCommonRelationships("contact");

      expect(relationships.length).toBeGreaterThan(0);
      expect(relationships.some((r) => r.to === "account")).toBe(true);
    });

    it("should return relationships for account", () => {
      const relationships = manager.getCommonRelationships("account");

      expect(relationships.length).toBeGreaterThan(0);
      expect(relationships.some((r) => r.to === "contact")).toBe(true);
    });

    it("should return empty array for unknown entities", () => {
      const relationships = manager.getCommonRelationships("custom_entity");

      expect(relationships).toEqual([]);
    });
  });
});
