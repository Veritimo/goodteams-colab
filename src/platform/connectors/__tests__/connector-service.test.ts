/**
 * Tests for Connector Service
 */

import * as crypto from "crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Prisma client
vi.mock("../../db/client.js", () => ({
  prisma: {
    resourceConnection: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from "../../db/client.js";
import {
  createConnector,
  getConnector,
  getConnectorWithHints,
  getConnectorWithCredentials,
  listConnectors,
  updateConnector,
  deleteConnector,
  updateConnectorStatus,
  connectorExists,
  getConnectorsByStatus,
  countConnectors,
  getEncryptionKey,
  encryptCredentials,
  decryptCredentials,
  ConnectorNotFoundError,
  ConnectorEncryptionKeyMissingError,
  ConnectorEncryptionError,
  ConnectorAlreadyExistsError,
} from "../connector-service.js";

describe("Connector Service", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up test encryption key
    process.env = {
      ...originalEnv,
      CONNECTOR_ENCRYPTION_KEY: "test-connector-key-for-testing-32char!",
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  // ===========================================================================
  // ENCRYPTION TESTS
  // ===========================================================================

  describe("getEncryptionKey", () => {
    it("should derive a 32-byte key", () => {
      const key = getEncryptionKey("org-123");
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it("should derive different keys for different orgs", () => {
      const key1 = getEncryptionKey("org-123");
      const key2 = getEncryptionKey("org-456");
      expect(key1.toString("hex")).not.toBe(key2.toString("hex"));
    });

    it("should derive consistent keys for same org", () => {
      const key1 = getEncryptionKey("org-123");
      const key2 = getEncryptionKey("org-123");
      expect(key1.toString("hex")).toBe(key2.toString("hex"));
    });

    it("should throw error if encryption key not set", () => {
      delete process.env.CONNECTOR_ENCRYPTION_KEY;
      delete process.env.CREDENTIAL_ENCRYPTION_KEY;
      expect(() => getEncryptionKey("org-123")).toThrow(ConnectorEncryptionKeyMissingError);
    });

    it("should fall back to CREDENTIAL_ENCRYPTION_KEY", () => {
      delete process.env.CONNECTOR_ENCRYPTION_KEY;
      process.env.CREDENTIAL_ENCRYPTION_KEY = "fallback-key-for-testing-32char!!";
      const key = getEncryptionKey("org-123");
      expect(key.length).toBe(32);
    });
  });

  describe("encryptCredentials", () => {
    it("should encrypt credentials to hex format", () => {
      const credentials = { username: "user", password: "pass" };
      const encrypted = encryptCredentials("org-123", credentials);

      expect(encrypted).toMatch(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
    });

    it("should use different IVs for each encryption", () => {
      const credentials = { username: "user", password: "pass" };
      const encrypted1 = encryptCredentials("org-123", credentials);
      const encrypted2 = encryptCredentials("org-123", credentials);

      const iv1 = encrypted1.split(":")[0];
      const iv2 = encrypted2.split(":")[0];
      expect(iv1).not.toBe(iv2);
    });

    it("should produce different ciphertexts for different orgs", () => {
      const credentials = { username: "user", password: "pass" };
      const encrypted1 = encryptCredentials("org-123", credentials);
      const encrypted2 = encryptCredentials("org-456", credentials);

      // Ciphertext portions should differ
      const cipher1 = encrypted1.split(":")[2];
      const cipher2 = encrypted2.split(":")[2];
      expect(cipher1).not.toBe(cipher2);
    });
  });

  describe("decryptCredentials", () => {
    it("should decrypt credentials correctly", () => {
      const original = { username: "testuser", password: "secretpass" };
      const encrypted = encryptCredentials("org-123", original);
      const decrypted = decryptCredentials("org-123", encrypted);

      expect(decrypted).toEqual(original);
    });

    it("should throw error for tampered ciphertext", () => {
      const encrypted = encryptCredentials("org-123", { username: "test", password: "pass" });
      const [iv, authTag, cipher] = encrypted.split(":");
      const tampered = `${iv}:${authTag}:0000${cipher.slice(4)}`;

      expect(() => decryptCredentials("org-123", encrypted.replace(cipher, "tampered"))).toThrow(
        ConnectorEncryptionError,
      );
    });

    it("should fail with wrong organization", () => {
      const encrypted = encryptCredentials("org-123", { username: "test", password: "pass" });

      expect(() => decryptCredentials("org-456", encrypted)).toThrow(ConnectorEncryptionError);
    });

    it("should throw error for invalid format", () => {
      expect(() => decryptCredentials("org-123", "invalid")).toThrow(ConnectorEncryptionError);
    });
  });

  // ===========================================================================
  // CRUD TESTS
  // ===========================================================================

  describe("createConnector", () => {
    const mockConnector = {
      id: "conn-123",
      organizationId: "org-123",
      type: "SQL_SERVER" as const,
      name: "Test DB",
      description: "Test database",
      config: { host: "localhost", port: 1433 },
      credentials: null,
      status: "PENDING" as const,
      lastHealthCheck: null,
      healthMessage: null,
      isReadOnly: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "user-123",
      schemaHints: [],
      schemaCache: null,
    };

    it("should create a connector without credentials", async () => {
      vi.mocked(prisma.resourceConnection.create).mockResolvedValue(mockConnector);

      const result = await createConnector({
        organizationId: "org-123",
        type: "SQL_SERVER",
        name: "Test DB",
        description: "Test database",
        config: { host: "localhost", port: 1433 },
        createdBy: "user-123",
      });

      expect(result.id).toBe("conn-123");
      expect(result.name).toBe("Test DB");
      expect(prisma.resourceConnection.create).toHaveBeenCalledOnce();
    });

    it("should create a connector with encrypted credentials", async () => {
      vi.mocked(prisma.resourceConnection.create).mockResolvedValue(mockConnector);

      await createConnector({
        organizationId: "org-123",
        type: "SQL_SERVER",
        name: "Test DB",
        config: { host: "localhost" },
        credentials: { username: "sa", password: "secret" },
      });

      const call = vi.mocked(prisma.resourceConnection.create).mock.calls[0][0];
      expect(call.data.credentials).toMatch(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
    });

    it("should throw ConnectorAlreadyExistsError for duplicates", async () => {
      vi.mocked(prisma.resourceConnection.create).mockRejectedValue(
        new Error("Unique constraint failed"),
      );

      await expect(
        createConnector({
          organizationId: "org-123",
          type: "SQL_SERVER",
          name: "Test DB",
          config: { host: "localhost" },
        }),
      ).rejects.toThrow(ConnectorAlreadyExistsError);
    });
  });

  describe("getConnector", () => {
    it("should return connector by ID", async () => {
      const mockConnector = {
        id: "conn-123",
        organizationId: "org-123",
        type: "SQL_SERVER" as const,
        name: "Test DB",
        description: null,
        config: { host: "localhost" },
        credentials: null,
        status: "CONNECTED" as const,
        lastHealthCheck: new Date(),
        healthMessage: "OK",
        isReadOnly: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        schemaHints: [],
        schemaCache: null,
      };

      vi.mocked(prisma.resourceConnection.findUnique).mockResolvedValue(mockConnector);

      const result = await getConnector("conn-123");

      expect(result.id).toBe("conn-123");
      expect(result.name).toBe("Test DB");
    });

    it("should throw ConnectorNotFoundError for missing connector", async () => {
      vi.mocked(prisma.resourceConnection.findUnique).mockResolvedValue(null);

      await expect(getConnector("nonexistent")).rejects.toThrow(ConnectorNotFoundError);
    });
  });

  describe("getConnectorWithCredentials", () => {
    it("should return connector with decrypted credentials", async () => {
      const credentials = { username: "sa", password: "secret" };
      const encrypted = encryptCredentials("org-123", credentials);

      const mockConnector = {
        id: "conn-123",
        organizationId: "org-123",
        type: "SQL_SERVER" as const,
        name: "Test DB",
        description: null,
        config: { host: "localhost" },
        credentials: encrypted,
        status: "CONNECTED" as const,
        lastHealthCheck: null,
        healthMessage: null,
        isReadOnly: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        schemaHints: [],
        schemaCache: null,
      };

      vi.mocked(prisma.resourceConnection.findUnique).mockResolvedValue(mockConnector);

      const result = await getConnectorWithCredentials("conn-123");

      expect(result.connector.id).toBe("conn-123");
      expect(result.credentials).toEqual(credentials);
    });

    it("should return null credentials if not set", async () => {
      const mockConnector = {
        id: "conn-123",
        organizationId: "org-123",
        type: "SQL_SERVER" as const,
        name: "Test DB",
        description: null,
        config: { host: "localhost" },
        credentials: null,
        status: "PENDING" as const,
        lastHealthCheck: null,
        healthMessage: null,
        isReadOnly: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        schemaHints: [],
        schemaCache: null,
      };

      vi.mocked(prisma.resourceConnection.findUnique).mockResolvedValue(mockConnector);

      const result = await getConnectorWithCredentials("conn-123");

      expect(result.credentials).toBeNull();
    });
  });

  describe("listConnectors", () => {
    it("should return all connectors for an organization", async () => {
      const mockConnectors = [
        {
          id: "conn-1",
          organizationId: "org-123",
          type: "SQL_SERVER" as const,
          name: "DB 1",
          description: null,
          config: {},
          credentials: null,
          status: "CONNECTED" as const,
          lastHealthCheck: null,
          healthMessage: null,
          isReadOnly: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          schemaHints: [],
          schemaCache: null,
        },
        {
          id: "conn-2",
          organizationId: "org-123",
          type: "POSTGRESQL" as const,
          name: "DB 2",
          description: null,
          config: {},
          credentials: null,
          status: "PENDING" as const,
          lastHealthCheck: null,
          healthMessage: null,
          isReadOnly: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          schemaHints: [],
          schemaCache: null,
        },
      ];

      vi.mocked(prisma.resourceConnection.findMany).mockResolvedValue(mockConnectors);

      const result = await listConnectors("org-123");

      expect(result).toHaveLength(2);
      expect(prisma.resourceConnection.findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-123" },
        include: { schemaHints: true, schemaCache: true },
        orderBy: { name: "asc" },
      });
    });

    it("should filter by type when provided", async () => {
      vi.mocked(prisma.resourceConnection.findMany).mockResolvedValue([]);

      await listConnectors("org-123", "SQL_SERVER");

      expect(prisma.resourceConnection.findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-123", type: "SQL_SERVER" },
        include: { schemaHints: true, schemaCache: true },
        orderBy: { name: "asc" },
      });
    });
  });

  describe("updateConnector", () => {
    it("should update connector properties", async () => {
      vi.mocked(prisma.resourceConnection.findUnique).mockResolvedValue({
        organizationId: "org-123",
      } as any);

      const updatedConnector = {
        id: "conn-123",
        organizationId: "org-123",
        type: "SQL_SERVER" as const,
        name: "Updated Name",
        description: "Updated description",
        config: { host: "newhost" },
        credentials: null,
        status: "CONNECTED" as const,
        lastHealthCheck: null,
        healthMessage: null,
        isReadOnly: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        schemaHints: [],
        schemaCache: null,
      };

      vi.mocked(prisma.resourceConnection.update).mockResolvedValue(updatedConnector);

      const result = await updateConnector("conn-123", {
        name: "Updated Name",
        description: "Updated description",
        isReadOnly: false,
      });

      expect(result.name).toBe("Updated Name");
      expect(result.description).toBe("Updated description");
      expect(result.isReadOnly).toBe(false);
    });

    it("should encrypt new credentials when updating", async () => {
      vi.mocked(prisma.resourceConnection.findUnique).mockResolvedValue({
        organizationId: "org-123",
      } as any);

      vi.mocked(prisma.resourceConnection.update).mockResolvedValue({
        id: "conn-123",
        organizationId: "org-123",
        type: "SQL_SERVER" as const,
        name: "Test",
        description: null,
        config: {},
        credentials: null,
        status: "CONNECTED" as const,
        lastHealthCheck: null,
        healthMessage: null,
        isReadOnly: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        schemaHints: [],
        schemaCache: null,
      });

      await updateConnector("conn-123", {
        credentials: { username: "newuser", password: "newpass" },
      });

      const call = vi.mocked(prisma.resourceConnection.update).mock.calls[0][0];
      expect(call.data.credentials).toMatch(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
    });

    it("should throw ConnectorNotFoundError for missing connector", async () => {
      vi.mocked(prisma.resourceConnection.findUnique).mockResolvedValue(null);

      await expect(updateConnector("nonexistent", { name: "New Name" })).rejects.toThrow(
        ConnectorNotFoundError,
      );
    });
  });

  describe("deleteConnector", () => {
    it("should delete connector", async () => {
      vi.mocked(prisma.resourceConnection.findUnique).mockResolvedValue({ id: "conn-123" } as any);
      vi.mocked(prisma.resourceConnection.delete).mockResolvedValue({} as any);

      const result = await deleteConnector("conn-123");

      expect(result).toBe(true);
      expect(prisma.resourceConnection.delete).toHaveBeenCalledWith({
        where: { id: "conn-123" },
      });
    });

    it("should throw ConnectorNotFoundError for missing connector", async () => {
      vi.mocked(prisma.resourceConnection.findUnique).mockResolvedValue(null);

      await expect(deleteConnector("nonexistent")).rejects.toThrow(ConnectorNotFoundError);
    });
  });

  describe("updateConnectorStatus", () => {
    it("should update status and health check time", async () => {
      const mockConnector = {
        id: "conn-123",
        organizationId: "org-123",
        type: "SQL_SERVER" as const,
        name: "Test",
        description: null,
        config: {},
        credentials: null,
        status: "CONNECTED" as const,
        lastHealthCheck: new Date(),
        healthMessage: "Connection successful",
        isReadOnly: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        schemaHints: [],
        schemaCache: null,
      };

      vi.mocked(prisma.resourceConnection.update).mockResolvedValue(mockConnector);

      const result = await updateConnectorStatus("conn-123", "CONNECTED", "Connection successful");

      expect(result.status).toBe("CONNECTED");
      expect(result.healthMessage).toBe("Connection successful");
      expect(prisma.resourceConnection.update).toHaveBeenCalledWith({
        where: { id: "conn-123" },
        data: {
          status: "CONNECTED",
          lastHealthCheck: expect.any(Date),
          healthMessage: "Connection successful",
        },
        include: { schemaHints: true, schemaCache: true },
      });
    });
  });

  describe("connectorExists", () => {
    it("should return true for existing connector", async () => {
      vi.mocked(prisma.resourceConnection.findUnique).mockResolvedValue({ id: "conn-123" } as any);

      const result = await connectorExists("conn-123");

      expect(result).toBe(true);
    });

    it("should return false for missing connector", async () => {
      vi.mocked(prisma.resourceConnection.findUnique).mockResolvedValue(null);

      const result = await connectorExists("nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("countConnectors", () => {
    it("should return count for organization", async () => {
      vi.mocked(prisma.resourceConnection.count).mockResolvedValue(5);

      const result = await countConnectors("org-123");

      expect(result).toBe(5);
    });

    it("should filter by type when provided", async () => {
      vi.mocked(prisma.resourceConnection.count).mockResolvedValue(2);

      await countConnectors("org-123", "SQL_SERVER");

      expect(prisma.resourceConnection.count).toHaveBeenCalledWith({
        where: { organizationId: "org-123", type: "SQL_SERVER" },
      });
    });
  });
});
