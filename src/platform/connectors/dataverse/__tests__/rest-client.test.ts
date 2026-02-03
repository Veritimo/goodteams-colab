/**
 * REST Client Tests
 *
 * Tests for Dataverse REST API operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { DataverseConfig, DataverseCredentials } from "../types.js";
import { RestClient, createRestClient } from "../rest-client.js";

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

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockConfig: DataverseConfig = {
  environmentUrl: "org123.crm.dynamics.com",
  tdsPort: 5558,
};

const mockCredentials: DataverseCredentials = {
  tenantId: "tenant-123",
  clientId: "client-456",
  clientSecret: "secret-789",
};

describe("RestClient", () => {
  let client: RestClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new RestClient({ config: mockConfig, credentials: mockCredentials });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create client with valid config", () => {
      expect(client).toBeInstanceOf(RestClient);
    });
  });

  describe("createRestClient", () => {
    it("should create client using factory function", () => {
      const factoryClient = createRestClient(mockConfig, mockCredentials);
      expect(factoryClient).toBeInstanceOf(RestClient);
    });
  });

  describe("getEntityMetadata", () => {
    it("should fetch entity metadata from API", async () => {
      const mockMetadata = {
        LogicalName: "contact",
        DisplayName: { UserLocalizedLabel: { Label: "Contact" } },
        PrimaryIdAttribute: "contactid",
        PrimaryNameAttribute: "fullname",
        ObjectTypeCode: 2,
        ChangeTrackingEnabled: true,
      };

      const mockAttributes = {
        value: [
          {
            LogicalName: "firstname",
            DisplayName: { UserLocalizedLabel: { Label: "First Name" } },
            AttributeType: "String",
            SchemaName: "FirstName",
            IsValidForCreate: true,
            IsValidForUpdate: true,
            RequiredLevel: { Value: "None" },
          },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockMetadata),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockAttributes),
        });

      const metadata = await client.getEntityMetadata("contact");

      expect(metadata.logicalName).toBe("contact");
      expect(metadata.displayName).toBe("Contact");
      expect(metadata.primaryIdAttribute).toBe("contactid");
      expect(metadata.primaryNameAttribute).toBe("fullname");
      expect(metadata.attributes).toHaveLength(1);
    });

    it("should throw RestApiError on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: () => Promise.resolve({ error: { message: "Entity not found" } }),
      });

      await expect(client.getEntityMetadata("nonexistent")).rejects.toThrow();
    });
  });

  describe("query", () => {
    it("should execute OData query with options", async () => {
      const mockResponse = {
        value: [
          { contactid: "1", fullname: "John Doe" },
          { contactid: "2", fullname: "Jane Doe" },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.query("contacts", {
        select: ["contactid", "fullname"],
        filter: "statecode eq 0",
        top: 10,
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("fullname", "John Doe");
    });

    it("should build correct OData URL with all options", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: [] }),
      });

      await client.query("contacts", {
        select: ["contactid", "fullname"],
        filter: "statecode eq 0",
        orderBy: "fullname asc",
        top: 50,
        skip: 10,
        expand: ["account"],
      });

      expect(mockFetch).toHaveBeenCalled();
      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("$select=contactid,fullname");
      expect(callUrl).toContain("$top=50");
      expect(callUrl).toContain("$skip=10");
      expect(callUrl).toContain("$expand=account");
    });
  });

  describe("createRecord", () => {
    it("should create record and return ID from header", async () => {
      const headers = new Headers();
      headers.set("OData-EntityId", "https://org.crm.dynamics.com/api/data/v9.2/contacts(abc-123)");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers,
        json: () => Promise.resolve({}),
      });

      const id = await client.createRecord("contacts", {
        firstname: "John",
        lastname: "Doe",
      });

      expect(id).toBe("abc-123");
    });

    it("should throw on create failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: () => Promise.resolve({ error: { message: "Invalid data" } }),
      });

      await expect(client.createRecord("contacts", { invalid: "data" })).rejects.toThrow();
    });
  });

  describe("updateRecord", () => {
    it("should update record successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await expect(
        client.updateRecord("contacts", "abc-123", { firstname: "Updated" }),
      ).resolves.toBeUndefined();
    });

    it("should throw on update failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: () => Promise.resolve({ error: { message: "Record not found" } }),
      });

      await expect(
        client.updateRecord("contacts", "nonexistent", { firstname: "Test" }),
      ).rejects.toThrow();
    });
  });

  describe("deleteRecord", () => {
    it("should delete record successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await expect(client.deleteRecord("contacts", "abc-123")).resolves.toBeUndefined();
    });

    it("should throw on delete failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        json: () => Promise.resolve({ error: { message: "Access denied" } }),
      });

      await expect(client.deleteRecord("contacts", "protected-id")).rejects.toThrow();
    });
  });

  describe("testConnection", () => {
    it("should return healthy on successful WhoAmI call", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ UserId: "user-123" }),
      });

      const result = await client.testConnection();

      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it("should return unhealthy on API failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await client.testConnection();

      expect(result.healthy).toBe(false);
      expect(result.error).toContain("Network error");
    });
  });
});
