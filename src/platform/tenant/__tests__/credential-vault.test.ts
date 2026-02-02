/**
 * Tests for Tenant Credential Vault
 */

import * as crypto from "crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Prisma client
vi.mock("../../db/client.js", () => ({
  prisma: {
    tenantCredential: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "../../db/client.js";
import {
  setCredential,
  getCredential,
  deleteCredential,
  listCredentialKeys,
  rotateCredential,
  hasCredential,
  deleteAllCredentials,
  getEncryptionKey,
  CredentialKeyMissingError,
  CredentialDecryptionError,
} from "../credential-vault.js";

describe("Credential Vault", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up test encryption key (32 bytes for AES-256)
    process.env = {
      ...originalEnv,
      CREDENTIAL_ENCRYPTION_KEY: "test-master-key-for-testing-only-32char",
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

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

    it("should throw CredentialKeyMissingError if CREDENTIAL_ENCRYPTION_KEY not set", () => {
      delete process.env.CREDENTIAL_ENCRYPTION_KEY;
      expect(() => getEncryptionKey("org-123")).toThrow(CredentialKeyMissingError);
    });
  });

  describe("setCredential", () => {
    it("should encrypt and store credential", async () => {
      await setCredential("org-123", "API_KEY", "secret-value");

      expect(prisma.tenantCredential.upsert).toHaveBeenCalledOnce();
      const call = vi.mocked(prisma.tenantCredential.upsert).mock.calls[0][0];

      expect(call.where).toEqual({
        organizationId_key: { organizationId: "org-123", key: "API_KEY" },
      });
      expect(call.create.organizationId).toBe("org-123");
      expect(call.create.key).toBe("API_KEY");
      // Encrypted value format: iv:authTag:encrypted
      expect(call.create.encryptedValue).toMatch(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
    });

    it("should use different IVs for each encryption", async () => {
      await setCredential("org-123", "KEY1", "value1");
      await setCredential("org-123", "KEY2", "value2");

      const calls = vi.mocked(prisma.tenantCredential.upsert).mock.calls;
      const iv1 = calls[0][0].create.encryptedValue.split(":")[0];
      const iv2 = calls[1][0].create.encryptedValue.split(":")[0];

      expect(iv1).not.toBe(iv2);
    });

    it("should update existing credential", async () => {
      await setCredential("org-123", "API_KEY", "new-secret");

      const call = vi.mocked(prisma.tenantCredential.upsert).mock.calls[0][0];
      expect(call.update).toHaveProperty("encryptedValue");
      expect(call.update).toHaveProperty("updatedAt");
    });
  });

  describe("getCredential", () => {
    it("should decrypt and return credential", async () => {
      // First, encrypt a value to get realistic ciphertext
      const encryptionKey = getEncryptionKey("org-123");
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
      const encrypted = Buffer.concat([cipher.update("my-secret", "utf8"), cipher.final()]);
      const authTag = cipher.getAuthTag();
      const encryptedValue = `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;

      vi.mocked(prisma.tenantCredential.findUnique).mockResolvedValue({
        id: "cred-1",
        organizationId: "org-123",
        key: "API_KEY",
        encryptedValue,
        createdAt: new Date(),
        updatedAt: new Date(),
        rotatedAt: null,
      });

      const result = await getCredential("org-123", "API_KEY");

      expect(result).toBe("my-secret");
    });

    it("should return null for missing credential", async () => {
      vi.mocked(prisma.tenantCredential.findUnique).mockResolvedValue(null);

      const result = await getCredential("org-123", "NONEXISTENT");

      expect(result).toBeNull();
    });

    it("should throw CredentialDecryptionError for tampered ciphertext", async () => {
      // Create valid structure but tampered data
      vi.mocked(prisma.tenantCredential.findUnique).mockResolvedValue({
        id: "cred-1",
        organizationId: "org-123",
        key: "API_KEY",
        encryptedValue: "000000000000000000000000:0000000000000000000000000000000000000000:0000",
        createdAt: new Date(),
        updatedAt: new Date(),
        rotatedAt: null,
      });

      await expect(getCredential("org-123", "API_KEY")).rejects.toThrow(CredentialDecryptionError);
    });

    it("should fail if different org tries to decrypt", async () => {
      // Encrypt with org-123's key
      const encryptionKey = getEncryptionKey("org-123");
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
      const encrypted = Buffer.concat([cipher.update("secret", "utf8"), cipher.final()]);
      const authTag = cipher.getAuthTag();
      const encryptedValue = `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;

      // But try to decrypt with org-456's key (via different org ID)
      vi.mocked(prisma.tenantCredential.findUnique).mockResolvedValue({
        id: "cred-1",
        organizationId: "org-456", // Different org!
        key: "API_KEY",
        encryptedValue, // Same encrypted value
        createdAt: new Date(),
        updatedAt: new Date(),
        rotatedAt: null,
      });

      // This should fail because org-456 has a different derived key
      await expect(getCredential("org-456", "API_KEY")).rejects.toThrow(CredentialDecryptionError);
    });
  });

  describe("deleteCredential", () => {
    it("should delete credential and return true", async () => {
      vi.mocked(prisma.tenantCredential.deleteMany).mockResolvedValue({ count: 1 });

      const result = await deleteCredential("org-123", "API_KEY");

      expect(result).toBe(true);
      expect(prisma.tenantCredential.deleteMany).toHaveBeenCalledWith({
        where: { organizationId: "org-123", key: "API_KEY" },
      });
    });

    it("should return false if credential does not exist", async () => {
      vi.mocked(prisma.tenantCredential.deleteMany).mockResolvedValue({ count: 0 });

      const result = await deleteCredential("org-123", "NONEXISTENT");

      expect(result).toBe(false);
    });
  });

  describe("listCredentialKeys", () => {
    it("should return all credential keys for an org", async () => {
      vi.mocked(prisma.tenantCredential.findMany).mockResolvedValue([
        { key: "API_KEY" },
        { key: "DATABASE_URL" },
        { key: "SECRET_TOKEN" },
      ] as any);

      const keys = await listCredentialKeys("org-123");

      expect(keys).toEqual(["API_KEY", "DATABASE_URL", "SECRET_TOKEN"]);
      expect(prisma.tenantCredential.findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-123" },
        select: { key: true },
      });
    });

    it("should return empty array if no credentials", async () => {
      vi.mocked(prisma.tenantCredential.findMany).mockResolvedValue([]);

      const keys = await listCredentialKeys("org-123");

      expect(keys).toEqual([]);
    });
  });

  describe("rotateCredential", () => {
    it("should update credential and set rotatedAt", async () => {
      vi.mocked(prisma.tenantCredential.upsert).mockResolvedValue({} as any);
      vi.mocked(prisma.tenantCredential.update).mockResolvedValue({} as any);

      await rotateCredential("org-123", "API_KEY", "new-secret-value");

      expect(prisma.tenantCredential.upsert).toHaveBeenCalled();
      expect(prisma.tenantCredential.update).toHaveBeenCalledWith({
        where: { organizationId_key: { organizationId: "org-123", key: "API_KEY" } },
        data: { rotatedAt: expect.any(Date) },
      });
    });

    it("should encrypt the new value", async () => {
      vi.mocked(prisma.tenantCredential.upsert).mockResolvedValue({} as any);
      vi.mocked(prisma.tenantCredential.update).mockResolvedValue({} as any);

      await rotateCredential("org-123", "API_KEY", "rotated-secret");

      const upsertCall = vi.mocked(prisma.tenantCredential.upsert).mock.calls[0][0];
      expect(upsertCall.create.encryptedValue).toMatch(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
    });
  });

  describe("hasCredential", () => {
    it("should return true if credential exists", async () => {
      vi.mocked(prisma.tenantCredential.findUnique).mockResolvedValue({
        id: "cred-1",
      } as any);

      const result = await hasCredential("org-123", "API_KEY");

      expect(result).toBe(true);
    });

    it("should return false if credential does not exist", async () => {
      vi.mocked(prisma.tenantCredential.findUnique).mockResolvedValue(null);

      const result = await hasCredential("org-123", "NONEXISTENT");

      expect(result).toBe(false);
    });
  });

  describe("deleteAllCredentials", () => {
    it("should delete all credentials for an org", async () => {
      vi.mocked(prisma.tenantCredential.deleteMany).mockResolvedValue({ count: 5 });

      const result = await deleteAllCredentials("org-123");

      expect(result).toBe(5);
      expect(prisma.tenantCredential.deleteMany).toHaveBeenCalledWith({
        where: { organizationId: "org-123" },
      });
    });

    it("should return 0 if no credentials to delete", async () => {
      vi.mocked(prisma.tenantCredential.deleteMany).mockResolvedValue({ count: 0 });

      const result = await deleteAllCredentials("org-456");

      expect(result).toBe(0);
    });
  });

  describe("tenant isolation", () => {
    it("should use different encryption keys for different orgs", () => {
      const key1 = getEncryptionKey("org-alpha");
      const key2 = getEncryptionKey("org-beta");

      // Keys should be different due to HKDF with different salts
      expect(key1.toString("hex")).not.toBe(key2.toString("hex"));
    });

    it("should not be able to decrypt across organizations", async () => {
      // Set up credential encrypted for org-alpha
      const keyAlpha = getEncryptionKey("org-alpha");
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", keyAlpha, iv);
      const encrypted = Buffer.concat([cipher.update("alpha-secret", "utf8"), cipher.final()]);
      const authTag = cipher.getAuthTag();
      const encryptedValue = `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;

      // Mock that org-beta somehow got access to org-alpha's encrypted value
      vi.mocked(prisma.tenantCredential.findUnique).mockResolvedValue({
        id: "stolen-cred",
        organizationId: "org-beta",
        key: "STOLEN_KEY",
        encryptedValue, // org-alpha's encrypted data
        createdAt: new Date(),
        updatedAt: new Date(),
        rotatedAt: null,
      });

      // Attempting to decrypt with org-beta's key should fail
      await expect(getCredential("org-beta", "STOLEN_KEY")).rejects.toThrow(
        CredentialDecryptionError,
      );
    });
  });

  describe("encryption format", () => {
    it("should produce encrypted value in iv:authTag:encrypted format", async () => {
      await setCredential("org-123", "TEST_KEY", "test-value");

      const call = vi.mocked(prisma.tenantCredential.upsert).mock.calls[0][0];
      const parts = call.create.encryptedValue.split(":");

      expect(parts).toHaveLength(3);
      expect(parts[0]).toHaveLength(24); // 12 bytes IV = 24 hex chars
      expect(parts[1]).toHaveLength(32); // 16 bytes auth tag = 32 hex chars
      // Encrypted part length varies based on input
    });

    it("should use 12-byte IV (96 bits) as required by GCM", async () => {
      await setCredential("org-123", "TEST_KEY", "test-value");

      const call = vi.mocked(prisma.tenantCredential.upsert).mock.calls[0][0];
      const ivHex = call.create.encryptedValue.split(":")[0];
      const iv = Buffer.from(ivHex, "hex");

      expect(iv.length).toBe(12);
    });
  });
});
