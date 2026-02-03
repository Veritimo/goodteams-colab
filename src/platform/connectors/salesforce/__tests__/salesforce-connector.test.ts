/**
 * Salesforce Connector Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { SalesforceCredentials, SalesforceConfig } from "../types.js";
import {
  SalesforceConnector,
  SalesforceConnectorError,
  createSalesforceConnector,
  createTestConnector,
  DEFAULT_API_VERSION,
  DEFAULT_LOGIN_URL,
  SANDBOX_LOGIN_URL,
} from "../salesforce-connector.js";

// Mock jsforce
vi.mock("jsforce", () => {
  const mockConnectionData = {
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
    instanceUrl: "https://test.salesforce.com",
    version: "59.0",
    on: vi.fn(),
    identity: vi.fn().mockResolvedValue({
      user_id: "user-123",
      organization_id: "org-123",
      username: "test@example.com",
    }),
    limits: vi.fn().mockResolvedValue({
      DailyApiRequests: { Max: 15000, Remaining: 14500 },
      DailyBulkApiRequests: { Max: 5000, Remaining: 4800 },
    }),
    logout: vi.fn().mockResolvedValue(undefined),
  };

  // Use class syntax to avoid Vitest mock warning
  class MockConnection {
    accessToken = mockConnectionData.accessToken;
    refreshToken = mockConnectionData.refreshToken;
    instanceUrl = mockConnectionData.instanceUrl;
    version = mockConnectionData.version;
    on = mockConnectionData.on;
    identity = mockConnectionData.identity;
    limits = mockConnectionData.limits;
    logout = mockConnectionData.logout;
  }

  class MockOAuth2 {}

  return {
    default: {
      Connection: MockConnection,
      OAuth2: MockOAuth2,
    },
  };
});

import jsforce from "jsforce";

const mockConnection = new jsforce.Connection({} as never);

describe("SalesforceConnectorError", () => {
  describe("constructor", () => {
    it("should create error with all properties", () => {
      const error = new SalesforceConnectorError("Test error", "TEST_CODE", 401, {
        detail: "extra",
      });

      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_CODE");
      expect(error.statusCode).toBe(401);
      expect(error.details).toEqual({ detail: "extra" });
      expect(error.name).toBe("SalesforceConnectorError");
    });

    it("should be instanceof Error", () => {
      const error = new SalesforceConnectorError("Test", "CODE");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SalesforceConnectorError);
    });
  });

  describe("isAuthError", () => {
    it("should return true for INVALID_SESSION", () => {
      expect(new SalesforceConnectorError("Auth", "INVALID_SESSION").isAuthError()).toBe(true);
    });

    it("should return true for INVALID_GRANT", () => {
      expect(new SalesforceConnectorError("Auth", "INVALID_GRANT").isAuthError()).toBe(true);
    });

    it("should return true for 401 status", () => {
      expect(new SalesforceConnectorError("Auth", "OTHER", 401).isAuthError()).toBe(true);
    });

    it("should return true for 403 status", () => {
      expect(new SalesforceConnectorError("Auth", "OTHER", 403).isAuthError()).toBe(true);
    });

    it("should return false for other codes", () => {
      expect(new SalesforceConnectorError("Error", "OTHER", 500).isAuthError()).toBe(false);
    });
  });

  describe("isRateLimited", () => {
    it("should return true for REQUEST_LIMIT_EXCEEDED", () => {
      expect(new SalesforceConnectorError("Rate", "REQUEST_LIMIT_EXCEEDED").isRateLimited()).toBe(
        true,
      );
    });

    it("should return true for 429 status", () => {
      expect(new SalesforceConnectorError("Rate", "OTHER", 429).isRateLimited()).toBe(true);
    });

    it("should return false for other codes", () => {
      expect(new SalesforceConnectorError("Error", "OTHER", 500).isRateLimited()).toBe(false);
    });
  });
});

describe("SalesforceConnector", () => {
  const defaultCredentials: SalesforceCredentials = {
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    accessToken: "test-access-token",
    refreshToken: "test-refresh-token",
  };

  const defaultConfig: SalesforceConfig = {
    instanceUrl: "https://test.salesforce.com",
    apiVersion: "59.0",
    sandbox: false,
  };

  let connector: SalesforceConnector;

  beforeEach(() => {
    vi.clearAllMocks();
    connector = new SalesforceConnector({
      credentials: defaultCredentials,
      config: defaultConfig,
      organizationId: "org-123",
      userId: "user-123",
    });
  });

  describe("constructor", () => {
    it("should create connector with provided options", () => {
      expect(connector.getCredentials()).toMatchObject({
        clientId: defaultCredentials.clientId,
        clientSecret: defaultCredentials.clientSecret,
      });
      expect(connector.getConfig()).toMatchObject({
        instanceUrl: defaultConfig.instanceUrl,
        apiVersion: DEFAULT_API_VERSION,
      });
    });

    it("should use default API version if not provided", () => {
      const conn = new SalesforceConnector({
        credentials: defaultCredentials,
        organizationId: "org-123",
      });
      expect(conn.getConfig().apiVersion).toBe(DEFAULT_API_VERSION);
    });

    it("should use sandbox login URL when sandbox is true", () => {
      const conn = new SalesforceConnector({
        credentials: defaultCredentials,
        config: { sandbox: true },
        organizationId: "org-123",
      });
      expect(conn.getConfig().sandbox).toBe(true);
    });
  });

  describe("getConnection", () => {
    it("should return a jsforce Connection", async () => {
      const conn = await connector.getConnection();
      expect(conn).toBeDefined();
      expect(jsforce.Connection).toHaveBeenCalled();
    });

    it("should reuse existing connection", async () => {
      const conn1 = await connector.getConnection();
      const conn2 = await connector.getConnection();
      expect(conn1).toBe(conn2);
    });

    it("should create new connection after credential update", async () => {
      await connector.getConnection();
      connector.updateCredentials({ accessToken: "new-token" });
      await connector.getConnection();
      expect(jsforce.Connection).toHaveBeenCalledTimes(2);
    });
  });

  describe("updateCredentials", () => {
    it("should update credentials", () => {
      connector.updateCredentials({ accessToken: "new-token" });
      expect(connector.getCredentials().accessToken).toBe("new-token");
    });

    it("should preserve existing credentials", () => {
      connector.updateCredentials({ accessToken: "new-token" });
      expect(connector.getCredentials().clientId).toBe(defaultCredentials.clientId);
    });
  });

  describe("updateConfig", () => {
    it("should update config", () => {
      connector.updateConfig({ instanceUrl: "https://new.salesforce.com" });
      expect(connector.getConfig().instanceUrl).toBe("https://new.salesforce.com");
    });

    it("should preserve existing config", () => {
      connector.updateConfig({ instanceUrl: "https://new.salesforce.com" });
      expect(connector.getConfig().apiVersion).toBe(defaultConfig.apiVersion);
    });
  });

  describe("getConnectionInfo", () => {
    it("should return full connection info", () => {
      const info = connector.getConnectionInfo();
      expect(info.organizationId).toBe("org-123");
      expect(info.userId).toBe("user-123");
      expect(info.credentials.clientId).toBe(defaultCredentials.clientId);
      expect(info.config.instanceUrl).toBe(defaultConfig.instanceUrl);
    });
  });

  describe("checkHealth", () => {
    it("should return healthy status when connection works", async () => {
      const health = await connector.checkHealth();
      expect(health.healthy).toBe(true);
      expect(health.message).toContain("test@example.com");
      expect(health.limits?.dailyApiRequests).toBeDefined();
    });

    it("should return unhealthy status on error", async () => {
      vi.mocked(mockConnection.identity).mockRejectedValueOnce(new Error("Connection failed"));

      const health = await connector.checkHealth();
      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined();
    });
  });

  describe("testConnection", () => {
    it("should return true when connection works", async () => {
      const result = await connector.testConnection();
      expect(result).toBe(true);
    });

    it("should return false on error", async () => {
      vi.mocked(mockConnection.identity).mockRejectedValueOnce(new Error("Failed"));

      const result = await connector.testConnection();
      expect(result).toBe(false);
    });
  });

  describe("disconnect", () => {
    it("should logout and clear connection", async () => {
      await connector.getConnection();
      await connector.disconnect();
      expect(mockConnection.logout).toHaveBeenCalled();
    });

    it("should not throw if logout fails", async () => {
      vi.mocked(mockConnection.logout).mockRejectedValueOnce(new Error("Logout failed"));

      await connector.getConnection();
      await expect(connector.disconnect()).resolves.not.toThrow();
    });
  });
});

describe("createSalesforceConnector", () => {
  it("should create connector from connection info", () => {
    const connector = createSalesforceConnector({
      credentials: {
        clientId: "client-id",
        clientSecret: "client-secret",
      },
      config: { instanceUrl: "https://test.salesforce.com" },
      organizationId: "org-123",
    });

    expect(connector).toBeInstanceOf(SalesforceConnector);
  });
});

describe("createTestConnector", () => {
  it("should create connector with access token", () => {
    const connector = createTestConnector("test-token", "https://test.salesforce.com");

    expect(connector).toBeInstanceOf(SalesforceConnector);
    expect(connector.getCredentials().accessToken).toBe("test-token");
    expect(connector.getConfig().instanceUrl).toBe("https://test.salesforce.com");
  });

  it("should use provided options", () => {
    const connector = createTestConnector("test-token", "https://test.salesforce.com", {
      clientId: "custom-client-id",
      refreshToken: "custom-refresh",
    });

    expect(connector.getCredentials().clientId).toBe("custom-client-id");
    expect(connector.getCredentials().refreshToken).toBe("custom-refresh");
  });
});

describe("Constants", () => {
  it("should export DEFAULT_API_VERSION", () => {
    expect(DEFAULT_API_VERSION).toBe("59.0");
  });

  it("should export DEFAULT_LOGIN_URL", () => {
    expect(DEFAULT_LOGIN_URL).toBe("https://login.salesforce.com");
  });

  it("should export SANDBOX_LOGIN_URL", () => {
    expect(SANDBOX_LOGIN_URL).toBe("https://test.salesforce.com");
  });
});
