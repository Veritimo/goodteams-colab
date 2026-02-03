/**
 * Tests for AppLifecycle
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AppLifecycle } from "../../src/main/app.js";
import { mockApp } from "../mocks/electron.js";

// Mock the gateway client as a class
vi.mock("../../src/gateway/client.js", () => {
  return {
    GatewayClient: class MockGatewayClient {
      private _nodeId: string;
      private _connected = false;
      private _onConnect?: () => void;
      
      constructor(options: { nodeId?: string; onConnect?: () => void }) {
        this._nodeId = options.nodeId ?? "test-node-123";
        this._onConnect = options.onConnect;
      }
      
      async connect() {
        this._connected = true;
        // Call the onConnect callback if provided
        if (this._onConnect) {
          this._onConnect();
        }
      }
      
      disconnect() {
        this._connected = false;
      }
      
      getNodeId() {
        return this._nodeId;
      }
      
      isConnected() {
        return this._connected;
      }
    }
  };
});

describe("AppLifecycle", () => {
  let appLifecycle: AppLifecycle;

  beforeEach(() => {
    appLifecycle = new AppLifecycle();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("acquireSingleInstanceLock", () => {
    it("should acquire lock when no other instance is running", () => {
      mockApp.requestSingleInstanceLock.mockReturnValue(true);

      const result = appLifecycle.acquireSingleInstanceLock();

      expect(result).toBe(true);
      expect(mockApp.requestSingleInstanceLock).toHaveBeenCalled();
    });

    it("should fail to acquire lock when another instance is running", () => {
      mockApp.requestSingleInstanceLock.mockReturnValue(false);

      const result = appLifecycle.acquireSingleInstanceLock();

      expect(result).toBe(false);
    });

    it("should remember lock state", () => {
      mockApp.requestSingleInstanceLock.mockReturnValue(true);
      appLifecycle.acquireSingleInstanceLock();

      expect(appLifecycle.hasSingleInstanceLock()).toBe(true);
    });
  });

  describe("initialize", () => {
    it("should initialize app state", async () => {
      await appLifecycle.initialize();

      const state = appLifecycle.getState();
      expect(state.initialized).toBe(true);
    });

    it("should only initialize once", async () => {
      await appLifecycle.initialize();
      await appLifecycle.initialize();

      // Should not throw or cause issues
      const state = appLifecycle.getState();
      expect(state.initialized).toBe(true);
    });

    it("should load config from environment", async () => {
      process.env.GOODTEAMS_GATEWAY_URL = "ws://test.example.com";
      process.env.GOODTEAMS_NODE_ID = "test-node";

      await appLifecycle.initialize();

      const config = appLifecycle.getConfig();
      expect(config.gatewayUrl).toBe("ws://test.example.com");
      expect(config.nodeId).toBe("test-node");

      delete process.env.GOODTEAMS_GATEWAY_URL;
      delete process.env.GOODTEAMS_NODE_ID;
    });

    it("should not connect if gateway URL is not configured", async () => {
      delete process.env.GOODTEAMS_GATEWAY_URL;

      await appLifecycle.initialize();

      const state = appLifecycle.getState();
      expect(state.gatewayConnected).toBe(false);
    });
  });

  describe("handleDeepLink", () => {
    it("should handle connect deep link", async () => {
      await appLifecycle.initialize();

      appLifecycle.handleDeepLink(
        "goodteams://connect?gateway=wss://gateway.example.com&token=abc123"
      );

      const config = appLifecycle.getConfig();
      expect(config.gatewayUrl).toBe("wss://gateway.example.com");
    });

    it("should handle pair deep link", async () => {
      await appLifecycle.initialize();

      // Should not throw
      appLifecycle.handleDeepLink("goodteams://pair?code=ABC123");
    });

    it("should handle invalid deep links gracefully", async () => {
      await appLifecycle.initialize();

      // Should not throw
      appLifecycle.handleDeepLink("invalid-url");
      appLifecycle.handleDeepLink("goodteams://unknown");
    });
  });

  describe("connectToGateway", () => {
    it("should throw if gateway URL is not configured", async () => {
      appLifecycle.updateConfig({ gatewayUrl: undefined });

      await expect(appLifecycle.connectToGateway()).rejects.toThrow(
        "Gateway URL not configured"
      );
    });

    it("should connect to gateway when configured", async () => {
      appLifecycle.updateConfig({ gatewayUrl: "wss://gateway.example.com" });

      await appLifecycle.connectToGateway();

      const state = appLifecycle.getState();
      expect(state.gatewayConnected).toBe(true);
    });
  });

  describe("disconnectFromGateway", () => {
    it("should disconnect from gateway", async () => {
      appLifecycle.updateConfig({ gatewayUrl: "wss://gateway.example.com" });
      await appLifecycle.connectToGateway();

      appLifecycle.disconnectFromGateway();

      const state = appLifecycle.getState();
      expect(state.gatewayConnected).toBe(false);
      expect(state.nodeId).toBe(null);
    });

    it("should be safe to call when not connected", () => {
      // Should not throw
      appLifecycle.disconnectFromGateway();
    });
  });

  describe("shutdown", () => {
    it("should shutdown gracefully", async () => {
      await appLifecycle.initialize();
      appLifecycle.updateConfig({ gatewayUrl: "wss://gateway.example.com" });
      await appLifecycle.connectToGateway();

      await appLifecycle.shutdown();

      const state = appLifecycle.getState();
      expect(state.initialized).toBe(false);
      expect(state.gatewayConnected).toBe(false);
    });

    it("should only shutdown once", async () => {
      await appLifecycle.initialize();

      await appLifecycle.shutdown();
      await appLifecycle.shutdown();

      // Should not throw or cause issues
      const state = appLifecycle.getState();
      expect(state.initialized).toBe(false);
    });
  });

  describe("getConfig", () => {
    it("should not expose node token", () => {
      appLifecycle.updateConfig({
        gatewayUrl: "wss://test.example.com",
        nodeToken: "secret-token",
      });

      const config = appLifecycle.getConfig();

      expect(config.gatewayUrl).toBe("wss://test.example.com");
      expect("nodeToken" in config).toBe(false);
    });
  });

  describe("updateConfig", () => {
    it("should update configuration", () => {
      appLifecycle.updateConfig({
        gatewayUrl: "wss://new-gateway.example.com",
        autoConnect: false,
      });

      const config = appLifecycle.getConfig();
      expect(config.gatewayUrl).toBe("wss://new-gateway.example.com");
      expect(config.autoConnect).toBe(false);
    });

    it("should merge with existing config", () => {
      appLifecycle.updateConfig({ gatewayUrl: "wss://test.example.com" });
      appLifecycle.updateConfig({ nodeId: "node-123" });

      const config = appLifecycle.getConfig();
      expect(config.gatewayUrl).toBe("wss://test.example.com");
      expect(config.nodeId).toBe("node-123");
    });
  });
});
