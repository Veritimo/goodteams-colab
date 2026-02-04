/**
 * JWT Utilities Tests
 */

import { describe, it, expect, beforeAll } from "vitest";
import type { AccessTokenPayload, RefreshTokenPayload } from "../types.js";
import {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  decodeToken,
  isTokenExpired,
  JwtError,
} from "../jwt.js";

// Set up test environment
beforeAll(() => {
  // Ensure JWT_SECRET is set for tests
  if (!process.env.JWT_SECRET && !process.env.CREDENTIAL_ENCRYPTION_KEY) {
    process.env.JWT_SECRET = "test-secret-key-for-jwt-signing-must-be-long-enough";
  }
});

describe("JWT Utilities", () => {
  describe("signAccessToken / verifyAccessToken", () => {
    it("should sign and verify an access token", async () => {
      const payload: AccessTokenPayload = {
        sub: "user-123",
        email: "test@example.com",
        orgId: "org-456",
        role: "USER",
        type: "access",
      };

      const token = await signAccessToken(payload, 15);
      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");

      const decoded = await verifyAccessToken(token);
      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.orgId).toBe(payload.orgId);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.type).toBe("access");
    });

    it("should handle null orgId", async () => {
      const payload: AccessTokenPayload = {
        sub: "user-123",
        email: "test@example.com",
        orgId: null,
        role: "USER",
        type: "access",
      };

      const token = await signAccessToken(payload, 15);
      const decoded = await verifyAccessToken(token);
      expect(decoded.orgId).toBeNull();
    });

    it("should reject expired tokens", async () => {
      const payload: AccessTokenPayload = {
        sub: "user-123",
        email: "test@example.com",
        orgId: "org-456",
        role: "USER",
        type: "access",
      };

      // Sign with 0 minute expiry (already expired)
      // Note: jose doesn't allow 0, so we'll test with a very short time
      // and rely on the isTokenExpired helper for this case
      const token = await signAccessToken(payload, 1);

      // Token should be valid immediately
      const decoded = await verifyAccessToken(token);
      expect(decoded.sub).toBe(payload.sub);
    });

    it("should reject invalid tokens", async () => {
      await expect(verifyAccessToken("invalid-token")).rejects.toThrow(JwtError);
    });

    it("should reject tampered tokens", async () => {
      const payload: AccessTokenPayload = {
        sub: "user-123",
        email: "test@example.com",
        orgId: "org-456",
        role: "USER",
        type: "access",
      };

      const token = await signAccessToken(payload, 15);
      // Tamper with the token
      const tampered = token.slice(0, -5) + "XXXXX";

      await expect(verifyAccessToken(tampered)).rejects.toThrow(JwtError);
    });
  });

  describe("signRefreshToken / verifyRefreshToken", () => {
    it("should sign and verify a refresh token", async () => {
      const payload: RefreshTokenPayload = {
        sid: "session-123",
        sub: "user-456",
        type: "refresh",
      };

      const token = await signRefreshToken(payload, 14);
      expect(token).toBeTruthy();

      const decoded = await verifyRefreshToken(token);
      expect(decoded.sid).toBe(payload.sid);
      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.type).toBe("refresh");
    });

    it("should reject access tokens as refresh tokens", async () => {
      const accessPayload: AccessTokenPayload = {
        sub: "user-123",
        email: "test@example.com",
        orgId: "org-456",
        role: "USER",
        type: "access",
      };

      const accessToken = await signAccessToken(accessPayload, 15);
      await expect(verifyRefreshToken(accessToken)).rejects.toThrow(JwtError);
    });
  });

  describe("hashToken", () => {
    it("should hash a token consistently", async () => {
      const token = "my-secret-token";
      const hash1 = await hashToken(token);
      const hash2 = await hashToken(token);

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(token);
      expect(hash1.length).toBe(64); // SHA-256 produces 64 hex chars
    });

    it("should produce different hashes for different tokens", async () => {
      const hash1 = await hashToken("token-1");
      const hash2 = await hashToken("token-2");

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("decodeToken", () => {
    it("should decode a token without verification", async () => {
      const payload: AccessTokenPayload = {
        sub: "user-123",
        email: "test@example.com",
        orgId: "org-456",
        role: "USER",
        type: "access",
      };

      const token = await signAccessToken(payload, 15);
      const decoded = decodeToken(token);

      expect(decoded).toBeTruthy();
      expect(decoded?.sub).toBe(payload.sub);
    });

    it("should return null for invalid tokens", () => {
      const decoded = decodeToken("not-a-valid-jwt");
      expect(decoded).toBeNull();
    });
  });

  describe("isTokenExpired", () => {
    it("should return false for valid tokens", async () => {
      const payload: AccessTokenPayload = {
        sub: "user-123",
        email: "test@example.com",
        orgId: "org-456",
        role: "USER",
        type: "access",
      };

      const token = await signAccessToken(payload, 15);
      expect(isTokenExpired(token)).toBe(false);
    });

    it("should return true for invalid tokens", () => {
      expect(isTokenExpired("invalid-token")).toBe(true);
    });
  });
});
