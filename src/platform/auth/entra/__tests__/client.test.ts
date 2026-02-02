/**
 * Tests for Entra client module
 */

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getEntraConfig,
  isEntraConfigured,
  resetMsalClient,
  GRAPH_SCOPES,
  DEFAULT_USER_SCOPES,
  DIRECTORY_SEARCH_SCOPES,
  FULL_M365_SCOPES,
} from "../client.js";

describe("Entra Client", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetMsalClient();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetMsalClient();
  });

  describe("isEntraConfigured", () => {
    test("returns false when no env vars set", () => {
      delete process.env.ENTRA_CLIENT_ID;
      delete process.env.ENTRA_CLIENT_SECRET;
      expect(isEntraConfigured()).toBe(false);
    });

    test("returns false when only client ID set", () => {
      process.env.ENTRA_CLIENT_ID = "test-client-id";
      delete process.env.ENTRA_CLIENT_SECRET;
      expect(isEntraConfigured()).toBe(false);
    });

    test("returns false when only client secret set", () => {
      delete process.env.ENTRA_CLIENT_ID;
      process.env.ENTRA_CLIENT_SECRET = "test-secret";
      expect(isEntraConfigured()).toBe(false);
    });

    test("returns true when both env vars set", () => {
      process.env.ENTRA_CLIENT_ID = "test-client-id";
      process.env.ENTRA_CLIENT_SECRET = "test-secret";
      expect(isEntraConfigured()).toBe(true);
    });
  });

  describe("getEntraConfig", () => {
    test("throws when client ID missing", () => {
      delete process.env.ENTRA_CLIENT_ID;
      process.env.ENTRA_CLIENT_SECRET = "test-secret";
      expect(() => getEntraConfig()).toThrow("Missing required Entra configuration");
    });

    test("throws when client secret missing", () => {
      process.env.ENTRA_CLIENT_ID = "test-client-id";
      delete process.env.ENTRA_CLIENT_SECRET;
      expect(() => getEntraConfig()).toThrow("Missing required Entra configuration");
    });

    test("returns config with defaults", () => {
      process.env.ENTRA_CLIENT_ID = "test-client-id";
      process.env.ENTRA_CLIENT_SECRET = "test-secret";
      delete process.env.ENTRA_AUTHORITY;
      delete process.env.ENTRA_REDIRECT_URI;
      delete process.env.ENTRA_USER_REDIRECT_URI;

      const config = getEntraConfig();
      expect(config.clientId).toBe("test-client-id");
      expect(config.clientSecret).toBe("test-secret");
      expect(config.authority).toBe("https://login.microsoftonline.com/common");
      expect(config.redirectUri).toBeUndefined();
      expect(config.userRedirectUri).toBeUndefined();
    });

    test("returns config with custom values", () => {
      process.env.ENTRA_CLIENT_ID = "test-client-id";
      process.env.ENTRA_CLIENT_SECRET = "test-secret";
      process.env.ENTRA_AUTHORITY = "https://login.microsoftonline.com/my-tenant";
      process.env.ENTRA_REDIRECT_URI = "https://app.example.com/callback";
      process.env.ENTRA_USER_REDIRECT_URI = "https://app.example.com/user-callback";

      const config = getEntraConfig();
      expect(config.authority).toBe("https://login.microsoftonline.com/my-tenant");
      expect(config.redirectUri).toBe("https://app.example.com/callback");
      expect(config.userRedirectUri).toBe("https://app.example.com/user-callback");
    });
  });

  describe("Scopes", () => {
    test("GRAPH_SCOPES contains expected values", () => {
      expect(GRAPH_SCOPES.USER_READ).toBe("User.Read");
      expect(GRAPH_SCOPES.USER_READ_ALL).toBe("User.Read.All");
      expect(GRAPH_SCOPES.OPENID).toBe("openid");
      expect(GRAPH_SCOPES.OFFLINE_ACCESS).toBe("offline_access");
    });

    test("DEFAULT_USER_SCOPES includes basic scopes", () => {
      expect(DEFAULT_USER_SCOPES).toContain("openid");
      expect(DEFAULT_USER_SCOPES).toContain("profile");
      expect(DEFAULT_USER_SCOPES).toContain("email");
      expect(DEFAULT_USER_SCOPES).toContain("offline_access");
      expect(DEFAULT_USER_SCOPES).toContain("User.Read");
    });

    test("DIRECTORY_SEARCH_SCOPES includes User.Read.All", () => {
      expect(DIRECTORY_SEARCH_SCOPES).toContain("User.Read.All");
    });

    test("FULL_M365_SCOPES includes extended permissions", () => {
      expect(FULL_M365_SCOPES).toContain("Sites.Read.All");
      expect(FULL_M365_SCOPES).toContain("Files.Read.All");
      expect(FULL_M365_SCOPES).toContain("Calendars.Read");
      expect(FULL_M365_SCOPES).toContain("Mail.ReadWrite");
      expect(FULL_M365_SCOPES).toContain("Mail.Send");
    });
  });
});
