/**
 * Metadata Client Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SObjectMetadata, GlobalDescribeResult } from "../types.js";
import { MetadataClient, createMetadataClient } from "../metadata-client.js";
import { SalesforceConnector, SalesforceConnectorError } from "../salesforce-connector.js";

// Mock the connector
vi.mock("../salesforce-connector.js", async () => {
  const actual = await vi.importActual<typeof import("../salesforce-connector.js")>(
    "../salesforce-connector.js",
  );
  return {
    ...actual,
    SalesforceConnector: vi.fn(),
  };
});

describe("MetadataClient", () => {
  let mockConnection: {
    describeGlobal: ReturnType<typeof vi.fn>;
    describe: ReturnType<typeof vi.fn>;
  };
  let mockConnector: { getConnection: ReturnType<typeof vi.fn> };
  let client: MetadataClient;

  const mockAccountDescribe = {
    name: "Account",
    label: "Account",
    labelPlural: "Accounts",
    keyPrefix: "001",
    queryable: true,
    createable: true,
    updateable: true,
    deletable: true,
    custom: false,
    fields: [
      {
        name: "Id",
        label: "Account ID",
        type: "id",
        nillable: false,
        createable: false,
        updateable: false,
      },
      {
        name: "Name",
        label: "Account Name",
        type: "string",
        nillable: false,
        createable: true,
        updateable: true,
        length: 255,
        nameField: true,
      },
      {
        name: "Industry",
        label: "Industry",
        type: "picklist",
        nillable: true,
        createable: true,
        updateable: true,
        picklistValues: [
          { value: "Technology", label: "Technology", active: true, defaultValue: false },
          { value: "Finance", label: "Finance", active: true, defaultValue: false },
        ],
      },
      {
        name: "ParentId",
        label: "Parent Account ID",
        type: "reference",
        nillable: true,
        createable: true,
        updateable: true,
        referenceTo: ["Account"],
        relationshipName: "Parent",
      },
    ],
    childRelationships: [
      {
        childSObject: "Contact",
        field: "AccountId",
        relationshipName: "Contacts",
        cascadeDelete: false,
      },
    ],
    recordTypeInfos: [
      {
        recordTypeId: "012000000000000AAA",
        name: "Master",
        developerName: "Master",
        defaultRecordTypeMapping: true,
        available: true,
      },
    ],
  };

  const mockGlobalDescribe = {
    encoding: "UTF-8",
    maxBatchSize: 200,
    sobjects: [
      {
        name: "Account",
        label: "Account",
        labelPlural: "Accounts",
        keyPrefix: "001",
        queryable: true,
        createable: true,
        updateable: true,
        deletable: true,
        custom: false,
      },
      {
        name: "Contact",
        label: "Contact",
        labelPlural: "Contacts",
        keyPrefix: "003",
        queryable: true,
        createable: true,
        updateable: true,
        deletable: true,
        custom: false,
      },
      {
        name: "Custom__c",
        label: "Custom",
        labelPlural: "Customs",
        keyPrefix: "a00",
        queryable: true,
        createable: true,
        updateable: true,
        deletable: true,
        custom: true,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockConnection = {
      describeGlobal: vi.fn().mockResolvedValue(mockGlobalDescribe),
      describe: vi.fn().mockResolvedValue(mockAccountDescribe),
    };

    mockConnector = {
      getConnection: vi.fn().mockResolvedValue(mockConnection),
    };

    client = new MetadataClient(mockConnector as unknown as SalesforceConnector);
  });

  describe("describeGlobal", () => {
    it("should return all objects", async () => {
      const result = await client.describeGlobal();

      expect(result.sobjects).toHaveLength(3);
      expect(result.sobjects[0].name).toBe("Account");
    });

    it("should cache results", async () => {
      await client.describeGlobal();
      await client.describeGlobal();

      expect(mockConnection.describeGlobal).toHaveBeenCalledTimes(1);
    });

    it("should bypass cache when useCache is false", async () => {
      await client.describeGlobal();
      await client.describeGlobal({ useCache: false });

      expect(mockConnection.describeGlobal).toHaveBeenCalledTimes(2);
    });
  });

  describe("getQueryableObjects", () => {
    it("should return only queryable objects", async () => {
      const result = await client.getQueryableObjects();

      expect(result.every((obj) => obj.queryable)).toBe(true);
    });
  });

  describe("getCustomObjects", () => {
    it("should return only custom objects", async () => {
      const result = await client.getCustomObjects();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Custom__c");
    });
  });

  describe("searchObjects", () => {
    it("should search by name", async () => {
      const result = await client.searchObjects("Account");

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Account");
    });

    it("should search case-insensitively", async () => {
      const result = await client.searchObjects("account");

      expect(result).toHaveLength(1);
    });

    it("should search by partial match", async () => {
      const result = await client.searchObjects("conta");

      expect(result.some((obj) => obj.name === "Contact")).toBe(true);
    });
  });

  describe("describeSObject", () => {
    it("should return object metadata", async () => {
      const result = await client.describeSObject("Account");

      expect(result.name).toBe("Account");
      expect(result.fields).toHaveLength(4);
      expect(result.childRelationships).toHaveLength(1);
    });

    it("should cache results", async () => {
      await client.describeSObject("Account");
      await client.describeSObject("Account");

      expect(mockConnection.describe).toHaveBeenCalledTimes(1);
    });

    it("should throw error for non-existent object", async () => {
      mockConnection.describe.mockRejectedValueOnce({
        errorCode: "NOT_FOUND",
        message: "Object does not exist",
      });

      await expect(client.describeSObject("NonExistent")).rejects.toThrow(SalesforceConnectorError);
    });
  });

  describe("describeSObjects", () => {
    it("should return metadata for multiple objects", async () => {
      const result = await client.describeSObjects(["Account", "Contact"]);

      expect(result.size).toBe(2);
    });
  });

  describe("getFieldMetadata", () => {
    it("should return field metadata", async () => {
      const field = await client.getFieldMetadata("Account", "Name");

      expect(field?.name).toBe("Name");
      expect(field?.type).toBe("string");
    });

    it("should return null for non-existent field", async () => {
      const field = await client.getFieldMetadata("Account", "NonExistent");

      expect(field).toBeNull();
    });

    it("should be case-insensitive for field name", async () => {
      const field = await client.getFieldMetadata("Account", "name");

      expect(field?.name).toBe("Name");
    });
  });

  describe("getRequiredFields", () => {
    it("should return non-nullable createable fields", async () => {
      const fields = await client.getRequiredFields("Account");

      expect(fields.some((f) => f.name === "Name")).toBe(true);
      expect(fields.every((f) => !f.nillable && f.createable)).toBe(true);
    });
  });

  describe("getReferenceFields", () => {
    it("should return reference fields", async () => {
      const fields = await client.getReferenceFields("Account");

      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe("ParentId");
      expect(fields[0].referenceTo).toContain("Account");
    });
  });

  describe("getPicklistValues", () => {
    it("should return picklist values", async () => {
      const values = await client.getPicklistValues("Account", "Industry");

      expect(values).toHaveLength(2);
      expect(values[0].value).toBe("Technology");
    });

    it("should throw error for non-existent field", async () => {
      await expect(client.getPicklistValues("Account", "NonExistent")).rejects.toThrow(
        SalesforceConnectorError,
      );
    });

    it("should throw error for non-picklist field", async () => {
      await expect(client.getPicklistValues("Account", "Name")).rejects.toThrow(
        SalesforceConnectorError,
      );
    });
  });

  describe("getChildRelationships", () => {
    it("should return child relationships", async () => {
      const relationships = await client.getChildRelationships("Account");

      expect(relationships).toHaveLength(1);
      expect(relationships[0].childSObject).toBe("Contact");
    });
  });

  describe("getRecordTypes", () => {
    it("should return record types", async () => {
      const recordTypes = await client.getRecordTypes("Account");

      expect(recordTypes).toHaveLength(1);
      expect(recordTypes[0].name).toBe("Master");
    });
  });

  describe("Cache Management", () => {
    describe("refreshCache", () => {
      it("should invalidate and refresh cache", async () => {
        await client.describeSObject("Account");
        await client.refreshCache("Account");

        expect(mockConnection.describe).toHaveBeenCalledTimes(2);
      });
    });

    describe("refreshGlobalCache", () => {
      it("should clear all cache and refresh", async () => {
        await client.describeGlobal();
        await client.describeSObject("Account");
        await client.refreshGlobalCache();

        expect(mockConnection.describeGlobal).toHaveBeenCalledTimes(2);
      });
    });

    describe("clearCache", () => {
      it("should clear all cached data", async () => {
        await client.describeSObject("Account");
        client.clearCache();
        await client.describeSObject("Account");

        expect(mockConnection.describe).toHaveBeenCalledTimes(2);
      });
    });

    describe("getCacheStats", () => {
      it("should return cache statistics", async () => {
        const statsEmpty = client.getCacheStats();
        expect(statsEmpty.size).toBe(0);
        expect(statsEmpty.globalCached).toBe(false);

        await client.describeGlobal();
        await client.describeSObject("Account");

        const statsPopulated = client.getCacheStats();
        expect(statsPopulated.size).toBe(1);
        expect(statsPopulated.globalCached).toBe(true);
      });
    });
  });
});

describe("createMetadataClient", () => {
  it("should create MetadataClient from connector", () => {
    const mockConnector = {} as SalesforceConnector;
    const client = createMetadataClient(mockConnector);
    expect(client).toBeInstanceOf(MetadataClient);
  });

  it("should accept cache options", () => {
    const mockConnector = {} as SalesforceConnector;
    const client = createMetadataClient(mockConnector, {
      ttlMs: 30000,
      maxSize: 50,
    });
    expect(client).toBeInstanceOf(MetadataClient);
  });
});
