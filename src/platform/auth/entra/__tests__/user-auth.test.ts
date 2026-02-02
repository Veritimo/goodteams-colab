/**
 * Tests for Entra user authentication flow
 */

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { DEFAULT_USER_SCOPES } from "../client.js";
import {
  createAuthState,
  consumeAuthState,
  tokenNeedsRefresh,
  clearAllAuthStates,
  getPendingAuthCount,
} from "../user-auth.js";

describe("Entra User Auth", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearAllAuthStates();
    process.env.ENTRA_CLIENT_ID = "test-client-id";
    process.env.ENTRA_CLIENT_SECRET = "test-secret";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    clearAllAuthStates();
  });

  describe("createAuthState", () => {
    test("creates unique state tokens", () => {
      const state1 = createAuthState({});
      const state2 = createAuthState({});
      expect(state1).not.toBe(state2);
    });

    test("stores state with minimal options", () => {
      const state = createAuthState({});
      expect(getPendingAuthCount()).toBe(1);

      const consumed = consumeAuthState(state);
      expect(consumed).not.toBeNull();
      expect(consumed?.scopes).toEqual(DEFAULT_USER_SCOPES);
    });

    test("stores state with all options", () => {
      const state = createAuthState({
        userId: "user-123",
        organizationId: "org-456",
        returnUrl: "/dashboard",
        scopes: ["openid", "profile"],
      });

      const consumed = consumeAuthState(state);
      expect(consumed?.userId).toBe("user-123");
      expect(consumed?.organizationId).toBe("org-456");
      expect(consumed?.returnUrl).toBe("/dashboard");
      expect(consumed?.scopes).toEqual(["openid", "profile"]);
    });
  });

  describe("consumeAuthState", () => {
    test("returns null for unknown state", () => {
      const result = consumeAuthState("unknown-state");
      expect(result).toBeNull();
    });

    test("consumes state only once", () => {
      const state = createAuthState({ userId: "user-1" });

      const first = consumeAuthState(state);
      expect(first).not.toBeNull();

      const second = consumeAuthState(state);
      expect(second).toBeNull();
    });

    test("returns null for expired state", async () => {
      const now = Date.now();
      const mockNow = vi.spyOn(Date, "now");

      // Create state at "now"
      mockNow.mockReturnValue(now);
      const state = createAuthState({});

      // Fast forward 11 minutes
      mockNow.mockReturnValue(now + 11 * 60 * 1000);

      const result = consumeAuthState(state);
      expect(result).toBeNull();

      mockNow.mockRestore();
    });
  });

  describe("tokenNeedsRefresh", () => {
    test("returns true when token expires within buffer", () => {
      const expiry = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes from now
      expect(tokenNeedsRefresh(expiry, 5)).toBe(true);
    });

    test("returns false when token has time remaining", () => {
      const expiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
      expect(tokenNeedsRefresh(expiry, 5)).toBe(false);
    });

    test("returns true when token already expired", () => {
      const expiry = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      expect(tokenNeedsRefresh(expiry)).toBe(true);
    });

    test("uses default 5 minute buffer", () => {
      const expiry = new Date(Date.now() + 4 * 60 * 1000); // 4 minutes from now
      expect(tokenNeedsRefresh(expiry)).toBe(true);

      const expiry2 = new Date(Date.now() + 6 * 60 * 1000); // 6 minutes from now
      expect(tokenNeedsRefresh(expiry2)).toBe(false);
    });
  });

  describe("clearAllAuthStates", () => {
    test("removes all pending states", () => {
      createAuthState({ userId: "user-1" });
      createAuthState({ userId: "user-2" });
      expect(getPendingAuthCount()).toBe(2);

      clearAllAuthStates();
      expect(getPendingAuthCount()).toBe(0);
    });
  });
});
