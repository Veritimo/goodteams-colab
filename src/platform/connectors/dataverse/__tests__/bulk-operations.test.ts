/**
 * Bulk Operations Tests
 *
 * Tests for batch CRUD operations with permission checking.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RestClient } from "../rest-client.js";
import { BulkOperationsManager, createBulkOperationsManager } from "../bulk-operations.js";
import { CRM_PERMISSIONS, PermissionDeniedError, ReadOnlyModeError } from "../types.js";

// Create mock REST client
function createMockRestClient(): RestClient {
  return {
    createRecord: vi.fn(),
    updateRecord: vi.fn(),
    deleteRecord: vi.fn(),
    getEntityMetadata: vi.fn(),
    getAttributeMetadata: vi.fn(),
    query: vi.fn(),
    getRecord: vi.fn(),
    executeBatch: vi.fn(),
    testConnection: vi.fn(),
  } as unknown as RestClient;
}

describe("BulkOperationsManager", () => {
  let mockRestClient: ReturnType<typeof createMockRestClient>;
  let manager: BulkOperationsManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRestClient = createMockRestClient();
  });

  describe("constructor", () => {
    it("should create manager with rest client", () => {
      manager = new BulkOperationsManager({
        restClient: mockRestClient,
        isReadOnly: false,
      });
      expect(manager).toBeInstanceOf(BulkOperationsManager);
    });
  });

  describe("createBulkOperationsManager", () => {
    it("should create manager using factory function", () => {
      const factoryManager = createBulkOperationsManager(mockRestClient);
      expect(factoryManager).toBeInstanceOf(BulkOperationsManager);
    });
  });

  describe("permission checks", () => {
    describe("read-only mode", () => {
      beforeEach(() => {
        manager = new BulkOperationsManager({
          restClient: mockRestClient,
          isReadOnly: true,
        });
      });

      it("should reject bulkCreate in read-only mode", async () => {
        await expect(manager.bulkCreate("contact", [{ firstname: "John" }])).rejects.toThrow(
          ReadOnlyModeError,
        );
      });

      it("should reject bulkUpdate in read-only mode", async () => {
        await expect(
          manager.bulkUpdate("contact", [{ id: "123", data: { firstname: "Updated" } }]),
        ).rejects.toThrow(ReadOnlyModeError);
      });

      it("should reject bulkDelete in read-only mode", async () => {
        await expect(manager.bulkDelete("contact", ["123"])).rejects.toThrow(ReadOnlyModeError);
      });
    });

    describe("user permission checks", () => {
      let permissionChecker: ReturnType<typeof vi.fn>;

      beforeEach(() => {
        permissionChecker = vi.fn().mockResolvedValue(false);
        manager = new BulkOperationsManager({
          restClient: mockRestClient,
          userId: "user-123",
          permissionChecker,
          isReadOnly: false,
        });
      });

      it("should check CRM_CREATE permission for bulkCreate", async () => {
        await expect(manager.bulkCreate("contact", [{ firstname: "John" }])).rejects.toThrow(
          PermissionDeniedError,
        );

        expect(permissionChecker).toHaveBeenCalledWith("user-123", CRM_PERMISSIONS.CREATE);
      });

      it("should check CRM_UPDATE permission for bulkUpdate", async () => {
        await expect(
          manager.bulkUpdate("contact", [{ id: "123", data: { firstname: "Updated" } }]),
        ).rejects.toThrow(PermissionDeniedError);

        expect(permissionChecker).toHaveBeenCalledWith("user-123", CRM_PERMISSIONS.UPDATE);
      });

      it("should check CRM_DELETE permission for bulkDelete", async () => {
        await expect(manager.bulkDelete("contact", ["123"])).rejects.toThrow(PermissionDeniedError);

        expect(permissionChecker).toHaveBeenCalledWith("user-123", CRM_PERMISSIONS.DELETE);
      });

      it("should allow operations when permission granted", async () => {
        permissionChecker.mockResolvedValue(true);
        (mockRestClient.createRecord as any).mockResolvedValue("new-id-123");

        const result = await manager.bulkCreate("contact", [{ firstname: "John" }]);

        expect(result.success).toBe(true);
        expect(result.successCount).toBe(1);
      });
    });
  });

  describe("bulkCreate", () => {
    beforeEach(() => {
      manager = new BulkOperationsManager({
        restClient: mockRestClient,
        isReadOnly: false,
      });
    });

    it("should return success for empty records", async () => {
      const result = await manager.bulkCreate("contact", []);

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(0);
      expect(result.totalCount).toBe(0);
      expect(result.message).toContain("No records");
    });

    it("should create records and return created IDs", async () => {
      (mockRestClient.createRecord as any)
        .mockResolvedValueOnce("id-1")
        .mockResolvedValueOnce("id-2")
        .mockResolvedValueOnce("id-3");

      const result = await manager.bulkCreate("contact", [
        { firstname: "John" },
        { firstname: "Jane" },
        { firstname: "Bob" },
      ]);

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(3);
      expect(result.createdIds).toEqual(["id-1", "id-2", "id-3"]);
    });

    it("should handle partial failures", async () => {
      (mockRestClient.createRecord as any)
        .mockResolvedValueOnce("id-1")
        .mockRejectedValueOnce(new Error("Validation error"))
        .mockResolvedValueOnce("id-3");

      const result = await manager.bulkCreate(
        "contact",
        [{ firstname: "John" }, { firstname: "" }, { firstname: "Bob" }],
        { continueOnError: true },
      );

      expect(result.success).toBe(false);
      expect(result.successCount).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain("Validation error");
    });

    it("should stop on first error when continueOnError is false", async () => {
      (mockRestClient.createRecord as any)
        .mockResolvedValueOnce("id-1")
        .mockRejectedValueOnce(new Error("Error"));

      const result = await manager.bulkCreate("contact", [
        { firstname: "John" },
        { firstname: "Error" },
        { firstname: "Bob" },
      ]);

      expect(result.success).toBe(false);
      // Should have processed the batch containing the error
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should process in batches", async () => {
      const records = Array(15).fill({ firstname: "Test" });
      (mockRestClient.createRecord as any).mockResolvedValue("id");

      const result = await manager.bulkCreate("contact", records, { batchSize: 5 });

      expect(result.batchCount).toBe(3);
      expect(result.successCount).toBe(15);
    });

    it("should call progress callback", async () => {
      const onProgress = vi.fn();
      const records = Array(10).fill({ firstname: "Test" });
      (mockRestClient.createRecord as any).mockResolvedValue("id");

      await manager.bulkCreate("contact", records, {
        batchSize: 5,
        onProgress,
      });

      expect(onProgress).toHaveBeenCalledWith(5, 10);
      expect(onProgress).toHaveBeenCalledWith(10, 10);
    });

    it("should cap batch size at maximum", async () => {
      const records = Array(5).fill({ firstname: "Test" });
      (mockRestClient.createRecord as any).mockResolvedValue("id");

      const result = await manager.bulkCreate("contact", records, {
        batchSize: 2000, // Above max
      });

      // Should not error and process successfully
      expect(result.success).toBe(true);
    });
  });

  describe("bulkUpdate", () => {
    beforeEach(() => {
      manager = new BulkOperationsManager({
        restClient: mockRestClient,
        isReadOnly: false,
      });
    });

    it("should return success for empty updates", async () => {
      const result = await manager.bulkUpdate("contact", []);

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(0);
      expect(result.message).toContain("No records");
    });

    it("should update records successfully", async () => {
      (mockRestClient.updateRecord as any).mockResolvedValue(undefined);

      const result = await manager.bulkUpdate("contact", [
        { id: "id-1", data: { firstname: "Updated1" } },
        { id: "id-2", data: { firstname: "Updated2" } },
      ]);

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(2);
    });

    it("should track failed updates with record IDs", async () => {
      (mockRestClient.updateRecord as any)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Not found"));

      const result = await manager.bulkUpdate(
        "contact",
        [
          { id: "id-1", data: { firstname: "Good" } },
          { id: "id-2", data: { firstname: "Bad" } },
        ],
        { continueOnError: true },
      );

      expect(result.success).toBe(false);
      expect(result.errors[0].recordId).toBe("id-2");
    });
  });

  describe("bulkUpdateBroadcast", () => {
    beforeEach(() => {
      manager = new BulkOperationsManager({
        restClient: mockRestClient,
        isReadOnly: false,
      });
    });

    it("should apply same changes to all IDs", async () => {
      (mockRestClient.updateRecord as any).mockResolvedValue(undefined);

      const result = await manager.bulkUpdateBroadcast("contact", ["id-1", "id-2", "id-3"], {
        statecode: 1,
      });

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(3);
      expect(mockRestClient.updateRecord).toHaveBeenCalledTimes(3);
    });
  });

  describe("bulkDelete", () => {
    beforeEach(() => {
      manager = new BulkOperationsManager({
        restClient: mockRestClient,
        isReadOnly: false,
      });
    });

    it("should return success for empty ID list", async () => {
      const result = await manager.bulkDelete("contact", []);

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(0);
    });

    it("should delete records successfully", async () => {
      (mockRestClient.deleteRecord as any).mockResolvedValue(undefined);

      const result = await manager.bulkDelete("contact", ["id-1", "id-2", "id-3"]);

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(3);
    });

    it("should track failed deletes with record IDs", async () => {
      (mockRestClient.deleteRecord as any)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Access denied"));

      const result = await manager.bulkDelete("contact", ["id-1", "protected-id"], {
        continueOnError: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors[0].recordId).toBe("protected-id");
    });
  });

  describe("setReadOnly", () => {
    it("should enable write operations when set to false", async () => {
      manager = new BulkOperationsManager({
        restClient: mockRestClient,
        isReadOnly: true,
      });

      manager.setReadOnly(false);
      (mockRestClient.createRecord as any).mockResolvedValue("id");

      const result = await manager.bulkCreate("contact", [{ firstname: "Test" }]);
      expect(result.success).toBe(true);
    });

    it("should disable write operations when set to true", async () => {
      manager = new BulkOperationsManager({
        restClient: mockRestClient,
        isReadOnly: false,
      });

      manager.setReadOnly(true);

      await expect(manager.bulkCreate("contact", [{ firstname: "Test" }])).rejects.toThrow(
        ReadOnlyModeError,
      );
    });
  });

  describe("setUserId", () => {
    it("should update user ID for permission checks", async () => {
      const permissionChecker = vi.fn().mockResolvedValue(true);
      manager = new BulkOperationsManager({
        restClient: mockRestClient,
        userId: "user-1",
        permissionChecker,
        isReadOnly: false,
      });

      manager.setUserId("user-2");
      (mockRestClient.createRecord as any).mockResolvedValue("id");

      await manager.bulkCreate("contact", [{ firstname: "Test" }]);

      expect(permissionChecker).toHaveBeenCalledWith("user-2", expect.any(String));
    });
  });
});
