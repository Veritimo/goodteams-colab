/**
 * Tests for Google Token Storage
 */

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import type { GoogleTokens, GoogleUserInfo } from "../client.js";
import {
  encrypt,
  decrypt,
  generateEncryptionKey,
  testEncryption,
  InMemoryGoogleTokenStore,
  getTokenStore,
  setTokenStore,
  resetTokenStore,
  type GoogleTokenStore,
} from "../token-store.js";

describe("Google Token Store", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Set a valid encryption key for tests
    process.env.TOKEN_ENCRYPTION_KEY = generateEncryptionKey();
    resetTokenStore();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetTokenStore();
  });

  // ===========================================================================
  // Encryption Tests
  // ===========================================================================

  describe("encryption", () => {
    test("encrypt returns formatted string", () => {
      const plaintext = "test-access-token";
      const encrypted = encrypt(plaintext);

      // Should have 3 parts: iv:authTag:ciphertext
      const parts = encrypted.split(":");
      expect(parts).toHaveLength(3);

      // All parts should be base64
      for (const part of parts) {
        expect(() => Buffer.from(part, "base64")).not.toThrow();
      }
    });

    test("encrypt produces different output each time", () => {
      const plaintext = "same-value";
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    test("decrypt reverses encrypt", () => {
      const plaintext = "my-secret-token-12345";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test("decrypt handles special characters", () => {
      const plaintext = "token with spaces, symbols! @#$%^&*() and unicode: 日本語";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test("decrypt handles long tokens", () => {
      const plaintext = "a".repeat(10000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test("decrypt throws for invalid format", () => {
      expect(() => decrypt("invalid")).toThrow("Invalid encrypted token format");
      expect(() => decrypt("a:b")).toThrow("Invalid encrypted token format");
    });

    test("decrypt throws for tampered ciphertext", () => {
      const encrypted = encrypt("test");
      const parts = encrypted.split(":");
      parts[2] = Buffer.from("tampered").toString("base64");
      const tampered = parts.join(":");

      expect(() => decrypt(tampered)).toThrow();
    });
  });

  describe("generateEncryptionKey", () => {
    test("generates 64-char hex string", () => {
      const key = generateEncryptionKey();
      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(key)).toBe(true);
    });

    test("generates unique keys", () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe("testEncryption", () => {
    test("returns true when encryption works", () => {
      expect(testEncryption("test-value")).toBe(true);
    });

    test("returns false when key is invalid", () => {
      process.env.TOKEN_ENCRYPTION_KEY = "invalid-key";
      expect(testEncryption("test")).toBe(false);
    });

    test("returns false when key is missing", () => {
      delete process.env.TOKEN_ENCRYPTION_KEY;
      expect(testEncryption("test")).toBe(false);
    });
  });

  describe("encryption key validation", () => {
    test("accepts 64-char hex key", () => {
      process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64);
      expect(testEncryption("test")).toBe(true);
    });

    test("accepts 44-char base64 key", () => {
      // 32 bytes = 44 chars in base64 (with padding)
      process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, "a").toString("base64");
      expect(testEncryption("test")).toBe(true);
    });

    test("rejects invalid key length", () => {
      process.env.TOKEN_ENCRYPTION_KEY = "short";
      expect(testEncryption("test")).toBe(false);
    });
  });

  // ===========================================================================
  // InMemoryGoogleTokenStore Tests
  // ===========================================================================

  describe("InMemoryGoogleTokenStore", () => {
    let store: InMemoryGoogleTokenStore;

    const mockTokens: GoogleTokens = {
      accessToken: "ya29.test-access-token",
      refreshToken: "1//test-refresh-token",
      expiresAt: new Date(Date.now() + 3600 * 1000),
      tokenType: "Bearer",
      scopes: ["openid", "email"],
    };

    const mockUserInfo: GoogleUserInfo = {
      googleId: "google-123",
      email: "user@example.com",
      emailVerified: true,
      name: "Test User",
      hostedDomain: "example.com",
    };

    beforeEach(() => {
      store = new InMemoryGoogleTokenStore();
    });

    test("storeTokens stores tokens for user", async () => {
      await store.storeTokens("user-1", mockTokens, mockUserInfo);
      expect(store.size()).toBe(1);
    });

    test("getTokens returns null for non-existent user", async () => {
      const tokens = await store.getTokens("non-existent");
      expect(tokens).toBeNull();
    });

    test("getTokens returns decrypted tokens", async () => {
      await store.storeTokens("user-1", mockTokens, mockUserInfo);
      const tokens = await store.getTokens("user-1");

      expect(tokens).not.toBeNull();
      expect(tokens?.accessToken).toBe(mockTokens.accessToken);
      expect(tokens?.refreshToken).toBe(mockTokens.refreshToken);
      expect(tokens?.googleId).toBe(mockUserInfo.googleId);
      expect(tokens?.email).toBe(mockUserInfo.email);
    });

    test("getTokens includes domain from userInfo", async () => {
      await store.storeTokens("user-1", mockTokens, mockUserInfo);
      const tokens = await store.getTokens("user-1");

      expect(tokens?.domain).toBe("example.com");
    });

    test("storeTokens updates existing tokens", async () => {
      await store.storeTokens("user-1", mockTokens, mockUserInfo);

      const newTokens = {
        ...mockTokens,
        accessToken: "ya29.new-access-token",
      };
      await store.storeTokens("user-1", newTokens, mockUserInfo);

      expect(store.size()).toBe(1);
      const tokens = await store.getTokens("user-1");
      expect(tokens?.accessToken).toBe("ya29.new-access-token");
    });

    test("deleteTokens removes tokens", async () => {
      await store.storeTokens("user-1", mockTokens, mockUserInfo);
      expect(store.size()).toBe(1);

      await store.deleteTokens("user-1");
      expect(store.size()).toBe(0);
    });

    test("deleteTokens handles non-existent user", async () => {
      await expect(store.deleteTokens("non-existent")).resolves.not.toThrow();
    });

    test("hasValidConnection returns true for stored user", async () => {
      await store.storeTokens("user-1", mockTokens, mockUserInfo);
      expect(await store.hasValidConnection("user-1")).toBe(true);
    });

    test("hasValidConnection returns false for non-existent user", async () => {
      expect(await store.hasValidConnection("non-existent")).toBe(false);
    });

    test("clear removes all tokens", async () => {
      await store.storeTokens("user-1", mockTokens, mockUserInfo);
      await store.storeTokens("user-2", mockTokens, { ...mockUserInfo, googleId: "g-2" });
      expect(store.size()).toBe(2);

      store.clear();
      expect(store.size()).toBe(0);
    });

    test("refreshIfNeeded returns tokens when not expired", async () => {
      await store.storeTokens("user-1", mockTokens, mockUserInfo);
      const tokens = await store.refreshIfNeeded("user-1");

      expect(tokens).not.toBeNull();
      expect(tokens?.accessToken).toBe(mockTokens.accessToken);
    });

    test("refreshIfNeeded returns null for non-existent user", async () => {
      const tokens = await store.refreshIfNeeded("non-existent");
      expect(tokens).toBeNull();
    });
  });

  // ===========================================================================
  // Token Store Management Tests
  // ===========================================================================

  describe("token store management", () => {
    test("getTokenStore returns default store", () => {
      const store = getTokenStore();
      expect(store).toBeDefined();
    });

    test("setTokenStore sets custom store", () => {
      const customStore = new InMemoryGoogleTokenStore();
      setTokenStore(customStore);

      expect(getTokenStore()).toBe(customStore);
    });

    test("resetTokenStore resets to default", () => {
      const customStore = new InMemoryGoogleTokenStore();
      setTokenStore(customStore);
      resetTokenStore();

      expect(getTokenStore()).not.toBe(customStore);
    });
  });
});
