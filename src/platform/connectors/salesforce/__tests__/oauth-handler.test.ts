/**
 * OAuth Handler Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  SalesforceOAuthHandler,
  createOAuthHandler,
  DEFAULT_SCOPES,
  EXTENDED_SCOPES,
} from "../oauth-handler.js";
import { SalesforceConnectorError, SANDBOX_LOGIN_URL } from "../salesforce-connector.js";

// Mock jsforce
vi.mock("jsforce", () => {
  const mockConnection = {
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
    instanceUrl: "https://test.salesforce.com",
    authorize: vi.fn().mockResolvedValue(undefined),
    identity: vi.fn().mockResolvedValue({
      id: "https://login.salesforce.com/id/00D000000000000/005000000000000",
      asserted_user: true,
      user_id: "005000000000000",
      organization_id: "00D000000000000",
      username: "test@example.com",
      nick_name: "test",
      display_name: "Test User",
      email: "test@example.com",
      email_verified: true,
      first_name: "Test",
      last_name: "User",
      active: true,
      user_type: "STANDARD",
      language: "en_US",
      locale: "en_US",
      utcOffset: -28800000,
      last_modified_date: "2024-01-01T00:00:00.000+0000",
    }),
  };

  const mockOAuth2 = {
    getAuthorizationUrl: vi
      .fn()
      .mockReturnValue(
        "https://login.salesforce.com/services/oauth2/authorize?client_id=test&redirect_uri=http://localhost/callback&scope=api+refresh_token&state=test-state",
      ),
  };

  // Use class syntax to avoid Vitest mock warning
  class MockConnection {
    accessToken = mockConnection.accessToken;
    refreshToken = mockConnection.refreshToken;
    instanceUrl = mockConnection.instanceUrl;
    authorize = mockConnection.authorize;
    identity = mockConnection.identity;
  }

  class MockOAuth2 {
    getAuthorizationUrl = mockOAuth2.getAuthorizationUrl;
  }

  return {
    default: {
      Connection: MockConnection,
      OAuth2: MockOAuth2,
    },
  };
});

// Mock fetch for token revocation
const mockFetch = vi.fn();
global.fetch = mockFetch;

import jsforce from "jsforce";

describe("SalesforceOAuthHandler", () => {
  const defaultOptions = {
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
  };

  let handler: SalesforceOAuthHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true });
    handler = new SalesforceOAuthHandler(defaultOptions);
  });

  describe("constructor", () => {
    it("should create handler with default login URL", () => {
      expect(handler.clientId).toBe(defaultOptions.clientId);
      expect(handler.clientSecret).toBe(defaultOptions.clientSecret);
    });

    it("should use sandbox URL when sandbox is true", () => {
      const sandboxHandler = new SalesforceOAuthHandler({
        ...defaultOptions,
        sandbox: true,
      });
      expect(sandboxHandler).toBeDefined();
    });

    it("should use custom login URL when provided", () => {
      const customHandler = new SalesforceOAuthHandler({
        ...defaultOptions,
        loginUrl: "https://custom.salesforce.com",
      });
      expect(customHandler).toBeDefined();
    });
  });

  describe("getAuthorizationUrl", () => {
    it("should return authorization URL", () => {
      const url = handler.getAuthorizationUrl({
        redirectUri: "http://localhost/callback",
        state: "test-state",
      });

      expect(url).toContain("authorize");
    });

    it("should include custom scopes", () => {
      const url = handler.getAuthorizationUrl({
        redirectUri: "http://localhost/callback",
        scopes: ["api", "full"],
      });

      expect(url).toBeDefined();
    });

    it("should include prompt parameter", () => {
      const url = handler.getAuthorizationUrl({
        redirectUri: "http://localhost/callback",
        prompt: "consent",
      });

      expect(url).toContain("prompt=consent");
    });

    it("should include login hint", () => {
      const url = handler.getAuthorizationUrl({
        redirectUri: "http://localhost/callback",
        loginHint: "user@example.com",
      });

      expect(url).toContain("login_hint=user%40example.com");
    });
  });

  describe("handleCallback", () => {
    it("should exchange code for tokens", async () => {
      const result = await handler.handleCallback("auth-code", "http://localhost/callback");

      expect(result.accessToken).toBe("mock-access-token");
      expect(result.refreshToken).toBe("mock-refresh-token");
      expect(result.instanceUrl).toBe("https://test.salesforce.com");
      expect(result.tokenType).toBe("Bearer");
    });

    it("should throw error when no access token received", async () => {
      const mockConn = new jsforce.Connection({} as never);
      mockConn.accessToken = undefined as unknown as string;

      await expect(
        handler.handleCallback("invalid-code", "http://localhost/callback"),
      ).rejects.toThrow(SalesforceConnectorError);
    });
  });

  describe("refreshTokens", () => {
    it("should refresh access token", async () => {
      const result = await handler.refreshTokens("old-refresh-token");

      expect(result.accessToken).toBe("mock-access-token");
      expect(result.instanceUrl).toBe("https://test.salesforce.com");
    });
  });

  describe("getIdentity", () => {
    it("should return user identity", async () => {
      const identity = await handler.getIdentity("access-token", "https://test.salesforce.com");

      expect(identity.username).toBe("test@example.com");
      expect(identity.email).toBe("test@example.com");
      expect(identity.organization_id).toBe("00D000000000000");
    });
  });

  describe("revokeToken", () => {
    it("should revoke token successfully", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await expect(handler.revokeToken("token-to-revoke")).resolves.not.toThrow();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/revoke"),
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    it("should throw error on revocation failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Bad Request"),
      });

      await expect(handler.revokeToken("invalid-token")).rejects.toThrow(SalesforceConnectorError);
    });
  });

  describe("buildCredentials", () => {
    it("should build credentials from token response", () => {
      const tokenResponse = {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        instanceUrl: "https://test.salesforce.com",
        tokenType: "Bearer",
        issuedAt: Date.now(),
      };

      const credentials = handler.buildCredentials(tokenResponse);

      expect(credentials.clientId).toBe(defaultOptions.clientId);
      expect(credentials.clientSecret).toBe(defaultOptions.clientSecret);
      expect(credentials.accessToken).toBe("access-token");
      expect(credentials.refreshToken).toBe("refresh-token");
      expect(credentials.tokenExpiresAt).toBeDefined();
    });
  });

  describe("buildConfig", () => {
    it("should build config from token response", () => {
      const tokenResponse = {
        accessToken: "access-token",
        instanceUrl: "https://test.salesforce.com",
        tokenType: "Bearer",
        issuedAt: Date.now(),
      };

      const config = handler.buildConfig(tokenResponse);

      expect(config.instanceUrl).toBe("https://test.salesforce.com");
      expect(config.apiVersion).toBe("59.0");
    });
  });
});

describe("createOAuthHandler", () => {
  it("should create handler from credentials", () => {
    const handler = createOAuthHandler({
      clientId: "client-id",
      clientSecret: "client-secret",
    });

    expect(handler).toBeInstanceOf(SalesforceOAuthHandler);
  });

  it("should accept sandbox option", () => {
    const handler = createOAuthHandler(
      { clientId: "client-id", clientSecret: "client-secret" },
      { sandbox: true },
    );

    expect(handler).toBeInstanceOf(SalesforceOAuthHandler);
  });
});

describe("OAuth Scopes", () => {
  describe("DEFAULT_SCOPES", () => {
    it("should include api scope", () => {
      expect(DEFAULT_SCOPES).toContain("api");
    });

    it("should include refresh_token scope", () => {
      expect(DEFAULT_SCOPES).toContain("refresh_token");
    });
  });

  describe("EXTENDED_SCOPES", () => {
    it("should include all default scopes", () => {
      for (const scope of DEFAULT_SCOPES) {
        expect(EXTENDED_SCOPES).toContain(scope);
      }
    });

    it("should include full scope", () => {
      expect(EXTENDED_SCOPES).toContain("full");
    });
  });
});
