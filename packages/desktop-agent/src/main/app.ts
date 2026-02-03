/**
 * GoodTeams Desktop Agent - App Lifecycle Management
 *
 * Handles:
 * - App initialization and shutdown
 * - Single instance lock
 * - Deep link handling
 * - Configuration loading
 */

import { app } from "electron";
import { GatewayClient } from "../gateway/client.js";

export interface AppConfig {
  gatewayUrl?: string;
  nodeId?: string;
  nodeToken?: string;
  autoConnect?: boolean;
}

export interface AppState {
  initialized: boolean;
  gatewayConnected: boolean;
  nodeId: string | null;
}

export class AppLifecycle {
  private config: AppConfig = {};
  private state: AppState = {
    initialized: false,
    gatewayConnected: false,
    nodeId: null,
  };
  private singleInstanceLock = false;
  private gatewayClient: GatewayClient | null = null;
  private initPromise: Promise<void> | null = null;
  private shutdownPromise: Promise<void> | null = null;

  /**
   * Attempt to acquire single instance lock
   * Returns false if another instance is already running
   */
  acquireSingleInstanceLock(): boolean {
    this.singleInstanceLock = app.requestSingleInstanceLock();
    return this.singleInstanceLock;
  }

  /**
   * Check if we have the single instance lock
   */
  hasSingleInstanceLock(): boolean {
    return this.singleInstanceLock;
  }

  /**
   * Initialize the app
   * Loads configuration, connects to gateway, etc.
   */
  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    if (this.state.initialized) {
      return;
    }

    try {
      // Load configuration
      await this.loadConfig();

      // Setup deep link protocol handler
      this.setupDeepLinkHandler();

      // Connect to gateway if configured
      if (this.config.gatewayUrl && this.config.autoConnect !== false) {
        await this.connectToGateway();
      }

      this.state.initialized = true;
    } catch (error) {
      console.error("App initialization failed:", error);
      throw error;
    }
  }

  /**
   * Load configuration from file/environment
   */
  private async loadConfig(): Promise<void> {
    // Load from environment variables
    this.config = {
      gatewayUrl: process.env.GOODTEAMS_GATEWAY_URL,
      nodeId: process.env.GOODTEAMS_NODE_ID,
      nodeToken: process.env.GOODTEAMS_NODE_TOKEN,
      autoConnect: process.env.GOODTEAMS_AUTO_CONNECT !== "false",
    };

    // TODO: Load from config file
    // const configPath = path.join(app.getPath('userData'), 'config.json');
  }

  /**
   * Setup deep link protocol handler (goodteams://)
   */
  private setupDeepLinkHandler(): void {
    // Register protocol handler
    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient("goodteams", process.execPath, [
          process.argv[1],
        ]);
      }
    } else {
      app.setAsDefaultProtocolClient("goodteams");
    }

    // Handle deep links on Windows/Linux
    app.on("second-instance", (_event, commandLine) => {
      const deepLink = commandLine.find((arg) =>
        arg.startsWith("goodteams://")
      );
      if (deepLink) {
        this.handleDeepLink(deepLink);
      }
    });

    // Handle deep links on macOS
    app.on("open-url", (_event, url) => {
      this.handleDeepLink(url);
    });
  }

  /**
   * Handle deep link URL
   */
  handleDeepLink(url: string): void {
    try {
      const parsed = new URL(url);

      switch (parsed.hostname) {
        case "connect":
          // goodteams://connect?gateway=wss://...&token=...
          const gateway = parsed.searchParams.get("gateway");
          const token = parsed.searchParams.get("token");
          if (gateway) {
            this.config.gatewayUrl = gateway;
            this.config.nodeToken = token ?? undefined;
            void this.connectToGateway();
          }
          break;

        case "pair":
          // goodteams://pair?code=...
          const code = parsed.searchParams.get("code");
          if (code) {
            void this.handlePairingCode(code);
          }
          break;

        default:
          console.log("Unknown deep link:", url);
      }
    } catch (error) {
      console.error("Failed to parse deep link:", error);
    }
  }

  /**
   * Handle pairing code from QR code or deep link
   */
  private async handlePairingCode(_code: string): Promise<void> {
    // TODO: Implement pairing flow
    console.log("Pairing not yet implemented");
  }

  /**
   * Connect to the GoodTeams gateway
   */
  async connectToGateway(): Promise<void> {
    if (!this.config.gatewayUrl) {
      throw new Error("Gateway URL not configured");
    }

    // Disconnect existing client if any
    if (this.gatewayClient) {
      this.gatewayClient.disconnect();
    }

    // Create new client
    this.gatewayClient = new GatewayClient({
      url: this.config.gatewayUrl,
      nodeId: this.config.nodeId,
      token: this.config.nodeToken,
      onConnect: () => {
        this.state.gatewayConnected = true;
        this.state.nodeId = this.gatewayClient?.getNodeId() ?? null;
      },
      onDisconnect: () => {
        this.state.gatewayConnected = false;
      },
      onError: (error) => {
        console.error("Gateway error:", error);
      },
    });

    await this.gatewayClient.connect();
  }

  /**
   * Disconnect from gateway
   */
  disconnectFromGateway(): void {
    if (this.gatewayClient) {
      this.gatewayClient.disconnect();
      this.gatewayClient = null;
      this.state.gatewayConnected = false;
      this.state.nodeId = null;
    }
  }

  /**
   * Shutdown the app gracefully
   */
  async shutdown(): Promise<void> {
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    this.shutdownPromise = this._doShutdown();
    return this.shutdownPromise;
  }

  private async _doShutdown(): Promise<void> {
    try {
      // Disconnect from gateway
      this.disconnectFromGateway();

      // Save any pending state
      // TODO: Implement state persistence

      this.state.initialized = false;
    } catch (error) {
      console.error("Shutdown error:", error);
    }
  }

  /**
   * Get current app state
   */
  getState(): AppState {
    return { ...this.state };
  }

  /**
   * Get current configuration (without secrets)
   */
  getConfig(): Omit<AppConfig, "nodeToken"> {
    const { nodeToken: _, ...safeConfig } = this.config;
    return safeConfig;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AppConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get gateway client instance
   */
  getGatewayClient(): GatewayClient | null {
    return this.gatewayClient;
  }
}
