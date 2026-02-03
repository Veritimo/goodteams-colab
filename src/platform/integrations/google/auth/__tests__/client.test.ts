/**
 * Tests for Google OAuth Client
 */

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getGoogleAuthConfig,
  isGoogleAuthConfigured,
  createOAuthState,
  consumeOAuthState,
  clearAllOAuthStates,
  getPendingOAuthStateCount,
  getOAuth2Client,
  resetOAuth2Client,
  GoogleAuthClient,
  getGoogleAuthUrl,
  tokenNeedsRefresh,
  type GoogleAuthConfig,
} from "../client.js";

describe("Google OAuth Client", () => {
  const originalEnv = { ...process.env };

  const mockConfig: GoogleAuthConfig = {
    clientId: "test-client-id.apps.googleusercontent.com",
    clientSecret: "test-client-secret",
    redirectUri: "https://app.example.com/api/auth/google/callback",
  };

  beforeEach(() => {
    resetOAuth2Client();
    clearAllOAuthStates();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetOAuth2Client();
    clearAllOAuthStates();
  });

  // ===========================================================================
  // Configuration Tests
  // ===========================================================================

  describe("isGoogleAuthConfigured", () => {
    test("returns false when no env vars set", () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      delete process.env.GOOGLE_REDIRECT_URI;
      expect(isGoogleAuthConfigured()).toBe(false);
    });

    test("returns false when only client ID set", () => {
      process.env.GOOGLE_CLIENT_ID = "test-id";
      delete process.env.GOOGLE_CLIENT_SECRET;
      delete process.env.GOOGLE_REDIRECT_URI;
      expect(isGoogleAuthConfigured()).toBe(false);
    });

    test("returns false when only client secret set", () => {
      delete process.env.GOOGLE_CLIENT_ID;
      process.env.GOOGLE_CLIENT_SECRET = "test-secret";
      delete process.env.GOOGLE_REDIRECT_URI;
      expect(isGoogleAuthConfigured()).toBe(false);
    });

    test("returns false when redirect URI missing", () => {
      process.env.GOOGLE_CLIENT_ID = "test-id";
      process.env.GOOGLE_CLIENT_SECRET = "test-secret";
      delete process.env.GOOGLE_REDIRECT_URI;
      expect(isGoogleAuthConfigured()).toBe(false);
    });

    test("returns true when all env vars set", () => {
      process.env.GOOGLE_CLIENT_ID = "test-id";
      process.env.GOOGLE_CLIENT_SECRET = "test-secret";
      process.env.GOOGLE_REDIRECT_URI = "https://example.com/callback";
      expect(isGoogleAuthConfigured()).toBe(true);
    });
  });

  describe("getGoogleAuthConfig", () => {
    test("throws when client ID missing", () => {
      delete process.env.GOOGLE_CLIENT_ID;
      process.env.GOOGLE_CLIENT_SECRET = "test-secret";
      process.env.GOOGLE_REDIRECT_URI = "https://example.com/callback";
      expect(() => getGoogleAuthConfig()).toThrow("Missing required Google OAuth configuration");
    });

    test("throws when client secret missing", () => {
      process.env.GOOGLE_CLIENT_ID = "test-id";
      delete process.env.GOOGLE_CLIENT_SECRET;
      process.env.GOOGLE_REDIRECT_URI = "https://example.com/callback";
      expect(() => getGoogleAuthConfig()).toThrow("Missing required Google OAuth configuration");
    });

    test("throws when redirect URI missing", () => {
      process.env.GOOGLE_CLIENT_ID = "test-id";
      process.env.GOOGLE_CLIENT_SECRET = "test-secret";
      delete process.env.GOOGLE_REDIRECT_URI;
      expect(() => getGoogleAuthConfig()).toThrow("GOOGLE_REDIRECT_URI must be set");
    });

    test("returns config when all vars set", () => {
      process.env.GOOGLE_CLIENT_ID = "test-id";
      process.env.GOOGLE_CLIENT_SECRET = "test-secret";
      process.env.GOOGLE_REDIRECT_URI = "https://example.com/callback";

      const config = getGoogleAuthConfig();
      expect(config.clientId).toBe("test-id");
      expect(config.clientSecret).toBe("test-secret");
      expect(config.redirectUri).toBe("https://example.com/callback");
    });
  });

  // ===========================================================================
  // State Management Tests
  // ===========================================================================

  describe("createOAuthState", () => {
    test("creates unique state tokens", () => {
      const state1 = createOAuthState({});
      const state2 = createOAuthState({});
      expect(state1).not.toBe(state2);
    });

    test("creates valid UUID format", () => {
      const state = createOAuthState({});
      expect(state).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    test("increments pending state count", () => {
      expect(getPendingOAuthStateCount()).toBe(0);
      createOAuthState({});
      expect(getPendingOAuthStateCount()).toBe(1);
      createOAuthState({});
      expect(getPendingOAuthStateCount()).toBe(2);
    });

    test("stores user ID in state", () => {
      const state = createOAuthState({ userId: "user-123" });
      const consumed = consumeOAuthState(state);
      expect(consumed?.userId).toBe("user-123");
    });

    test("stores organization ID in state", () => {
      const state = createOAuthState({ organizationId: "org-456" });
      const consumed = consumeOAuthState(state);
      expect(consumed?.organizationId).toBe("org-456");
    });

    test("stores return URL in state", () => {
      const state = createOAuthState({ returnUrl: "/dashboard" });
      const consumed = consumeOAuthState(state);
      expect(consumed?.returnUrl).toBe("/dashboard");
    });

    test("stores scopes in state", () => {
      const scopes = ["openid", "email", "profile"];
      const state = createOAuthState({ scopes });
      const consumed = consumeOAuthState(state);
      expect(consumed?.scopes).toEqual(scopes);
    });
  });

  describe("consumeOAuthState", () => {
    test("returns null for non-existent state", () => {
      expect(consumeOAuthState("non-existent-state")).toBeNull();
    });

    test("consumes state on first call", () => {
      const state = createOAuthState({ userId: "test-user" });
      const consumed = consumeOAuthState(state);
      expect(consumed).not.toBeNull();
      expect(consumed?.userId).toBe("test-user");
    });

    test("returns null on second call (state consumed)", () => {
      const state = createOAuthState({});
      consumeOAuthState(state);
      expect(consumeOAuthState(state)).toBeNull();
    });

    test("decrements pending state count", () => {
      const state = createOAuthState({});
      expect(getPendingOAuthStateCount()).toBe(1);
      consumeOAuthState(state);
      expect(getPendingOAuthStateCount()).toBe(0);
    });

    test("returns null for expired state", async () => {
      // Create state
      const state = createOAuthState({});

      // Mock time to be 11 minutes later (past 10 min TTL)
      const originalDate = Date.now;
      Date.now = () => originalDate() + 11 * 60 * 1000;

      try {
        expect(consumeOAuthState(state)).toBeNull();
      } finally {
        Date.now = originalDate;
      }
    });
  });

  describe("clearAllOAuthStates", () => {
    test("clears all pending states", () => {
      createOAuthState({});
      createOAuthState({});
      createOAuthState({});
      expect(getPendingOAuthStateCount()).toBe(3);

      clearAllOAuthStates();
      expect(getPendingOAuthStateCount()).toBe(0);
    });
  });

  // ===========================================================================
  // OAuth2 Client Tests
  // ===========================================================================

  describe("getOAuth2Client", () => {
    test("creates client with config", () => {
      process.env.GOOGLE_CLIENT_ID = "test-id";
      process.env.GOOGLE_CLIENT_SECRET = "test-secret";
      process.env.GOOGLE_REDIRECT_URI = "https://example.com/callback";

      const client = getOAuth2Client();
      expect(client).toBeDefined();
    });

    test("returns same instance on subsequent calls", () => {
      process.env.GOOGLE_CLIENT_ID = "test-id";
      process.env.GOOGLE_CLIENT_SECRET = "test-secret";
      process.env.GOOGLE_REDIRECT_URI = "https://example.com/callback";

      const client1 = getOAuth2Client();
      const client2 = getOAuth2Client();
      expect(client1).toBe(client2);
    });
  });

  describe("resetOAuth2Client", () => {
    test("creates new client after reset", () => {
      process.env.GOOGLE_CLIENT_ID = "test-id";
      process.env.GOOGLE_CLIENT_SECRET = "test-secret";
      process.env.GOOGLE_REDIRECT_URI = "https://example.com/callback";

      const client1 = getOAuth2Client();
      resetOAuth2Client();
      const client2 = getOAuth2Client();
      expect(client1).not.toBe(client2);
    });
  });

  // ===========================================================================
  // GoogleAuthClient Class Tests
  // ===========================================================================

  describe("GoogleAuthClient", () => {
    test("creates instance with config", () => {
      const client = new GoogleAuthClient(mockConfig);
      expect(client).toBeInstanceOf(GoogleAuthClient);
    });

    test("getAuthorizationUrl generates valid URL", () => {
      const client = new GoogleAuthClient(mockConfig);
      const url = client.getAuthorizationUrl(["openid", "email"], "test-state");

      expect(url).toContain("accounts.google.com");
      expect(url).toContain("client_id=" + encodeURIComponent(mockConfig.clientId));
      expect(url).toContain("redirect_uri=" + encodeURIComponent(mockConfig.redirectUri));
      expect(url).toContain("state=test-state");
      expect(url).toContain("scope=");
      expect(url).toContain("access_type=offline");
    });

    test("getAuthorizationUrl includes prompt parameter", () => {
      const client = new GoogleAuthClient(mockConfig);
      const url = client.getAuthorizationUrl(["openid"], "test-state", {
        prompt: "select_account",
      });

      expect(url).toContain("prompt=select_account");
    });

    test("getAuthorizationUrl includes login hint", () => {
      const client = new GoogleAuthClient(mockConfig);
      const url = client.getAuthorizationUrl(["openid"], "test-state", {
        loginHint: "user@example.com",
      });

      expect(url).toContain("login_hint=user%40example.com");
    });

    test("getAuthorizationUrl includes hosted domain", () => {
      const client = new GoogleAuthClient(mockConfig);
      const url = client.getAuthorizationUrl(["openid"], "test-state", {
        hostedDomain: "example.com",
      });

      expect(url).toContain("hd=example.com");
    });

    test("getUnderlyingClient returns OAuth2Client", () => {
      const client = new GoogleAuthClient(mockConfig);
      const underlying = client.getUnderlyingClient();
      expect(underlying).toBeDefined();
    });
  });

  // ===========================================================================
  // Convenience Functions Tests
  // ===========================================================================

  describe("getGoogleAuthUrl", () => {
    beforeEach(() => {
      process.env.GOOGLE_CLIENT_ID = mockConfig.clientId;
      process.env.GOOGLE_CLIENT_SECRET = mockConfig.clientSecret;
      process.env.GOOGLE_REDIRECT_URI = mockConfig.redirectUri;
    });

    test("generates authorization URL", () => {
      const url = getGoogleAuthUrl({
        scopes: ["openid", "email"],
        state: "test-state",
      });

      expect(url).toContain("accounts.google.com");
      expect(url).toContain("state=test-state");
    });

    test("includes custom prompt", () => {
      const url = getGoogleAuthUrl({
        scopes: ["openid"],
        state: "test-state",
        prompt: "none",
      });

      expect(url).toContain("prompt=none");
    });
  });

  describe("tokenNeedsRefresh", () => {
    test("returns false when token has plenty of time", () => {
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      expect(tokenNeedsRefresh(expiresAt)).toBe(false);
    });

    test("returns true when token expires in less than buffer", () => {
      const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes
      expect(tokenNeedsRefresh(expiresAt, 5)).toBe(true);
    });

    test("returns true when token is expired", () => {
      const expiresAt = new Date(Date.now() - 1000); // 1 second ago
      expect(tokenNeedsRefresh(expiresAt)).toBe(true);
    });

    test("uses default 5 minute buffer", () => {
      const expiresAt = new Date(Date.now() + 4 * 60 * 1000); // 4 minutes
      expect(tokenNeedsRefresh(expiresAt)).toBe(true);
    });

    test("respects custom buffer", () => {
      const expiresAt = new Date(Date.now() + 4 * 60 * 1000); // 4 minutes
      expect(tokenNeedsRefresh(expiresAt, 3)).toBe(false);
    });

    test("returns false at exactly buffer boundary", () => {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000 + 1); // Just over 5 minutes
      expect(tokenNeedsRefresh(expiresAt, 5)).toBe(false);
    });
  });
});
