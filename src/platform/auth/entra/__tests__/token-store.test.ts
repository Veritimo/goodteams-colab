/**
 * Tests for Entra token storage
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { encrypt, decrypt, generateEncryptionKey, testEncryption } from "../token-store.js";

describe("Entra Token Store", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Set a valid encryption key for tests
    process.env.TOKEN_ENCRYPTION_KEY = generateEncryptionKey();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

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
});
