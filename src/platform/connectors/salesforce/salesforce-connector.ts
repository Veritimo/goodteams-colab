/**
 * Salesforce Connector
 *
 * Main connector for Salesforce integration providing:
 * - OAuth 2.0 authentication (authorization code + refresh)
 * - Connection management and health checks
 * - Token refresh handling
 *
 * @see https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta
 */

import type { Connection } from "jsforce";
import jsforce from "jsforce";
import type {
  SalesforceConfig,
  SalesforceCredentials,
  SalesforceConnectionInfo,
  ConnectionHealth,
  ApiLimits,
} from "./types.js";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default Salesforce API version */
export const DEFAULT_API_VERSION = "59.0";

/** Default login URL */
export const DEFAULT_LOGIN_URL = "https://login.salesforce.com";

/** Sandbox login URL */
export const SANDBOX_LOGIN_URL = "https://test.salesforce.com";

/** Token refresh buffer (refresh 5 minutes before expiry) */
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

/** Default connection timeout */
const DEFAULT_TIMEOUT_MS = 30000;

// =============================================================================
// ERROR CLASS
// =============================================================================

/**
 * Salesforce connector error
 */
export class SalesforceConnectorError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "SalesforceConnectorError";
  }

  isAuthError(): boolean {
    return (
      this.code === "INVALID_SESSION" ||
      this.code === "INVALID_GRANT" ||
      this.statusCode === 401 ||
      this.statusCode === 403
    );
  }

  isRateLimited(): boolean {
    return this.code === "REQUEST_LIMIT_EXCEEDED" || this.statusCode === 429;
  }
}

// =============================================================================
// SALESFORCE CONNECTOR CLASS
// =============================================================================

/**
 * Salesforce Connector
 *
 * Manages Salesforce API connections with OAuth 2.0 authentication.
 *
 * @example
 * ```typescript
 * const connector = new SalesforceConnector({
 *   credentials: {
 *     clientId: 'consumer_key',
 *     clientSecret: 'consumer_secret',
 *     refreshToken: 'refresh_token',
 *   },
 *   config: {
 *     instanceUrl: 'https://myorg.salesforce.com',
 *     sandbox: false,
 *   },
 * });
 *
 * // Get authenticated connection
 * const conn = await connector.getConnection();
 *
 * // Execute query
 * const result = await conn.query('SELECT Id, Name FROM Account LIMIT 10');
 * ```
 */
export class SalesforceConnector {
  private connection: Connection | null = null;
  private credentials: SalesforceCredentials;
  private config: SalesforceConfig;
  private organizationId: string;
  private userId?: string;
  private isRefreshing = false;
  private refreshPromise: Promise<void> | null = null;

  constructor(options: {
    credentials: SalesforceCredentials;
    config?: SalesforceConfig;
    organizationId: string;
    userId?: string;
  }) {
    this.credentials = { ...options.credentials };
    this.config = {
      apiVersion: DEFAULT_API_VERSION,
      sandbox: false,
      timeout: DEFAULT_TIMEOUT_MS,
      ...options.config,
    };
    this.organizationId = options.organizationId;
    this.userId = options.userId;
  }

  // ===========================================================================
  // CONNECTION MANAGEMENT
  // ===========================================================================

  /**
   * Get an authenticated jsforce Connection
   *
   * Handles token refresh automatically if needed.
   */
  async getConnection(): Promise<Connection> {
    // If we're already refreshing, wait for it
    if (this.refreshPromise) {
      await this.refreshPromise;
    }

    // Check if we need to refresh the token
    if (this.shouldRefreshToken()) {
      await this.refreshAccessToken();
    }

    // Create connection if needed
    if (!this.connection) {
      this.connection = this.createConnection();
    }

    return this.connection;
  }

  /**
   * Create a new jsforce Connection instance
   */
  private createConnection(): Connection {
    const loginUrl = this.getLoginUrl();

    const conn = new jsforce.Connection({
      oauth2: {
        clientId: this.credentials.clientId,
        clientSecret: this.credentials.clientSecret,
        loginUrl,
      },
      instanceUrl: this.config.instanceUrl,
      accessToken: this.credentials.accessToken,
      refreshToken: this.credentials.refreshToken,
      version: this.config.apiVersion,
    });

    // Set up token refresh handler
    conn.on("refresh", (accessToken: string, response: unknown) => {
      this.credentials.accessToken = accessToken;
      // Extract instance URL if present in response
      if (response && typeof response === "object" && "instance_url" in response) {
        this.config.instanceUrl = (response as { instance_url: string }).instance_url;
      }
    });

    return conn;
  }

  /**
   * Get the appropriate login URL based on sandbox setting
   */
  private getLoginUrl(): string {
    if (this.config.loginUrl) {
      return this.config.loginUrl;
    }
    return this.config.sandbox ? SANDBOX_LOGIN_URL : DEFAULT_LOGIN_URL;
  }

  /**
   * Check if the access token should be refreshed
   */
  private shouldRefreshToken(): boolean {
    // No access token - need to refresh
    if (!this.credentials.accessToken) {
      return !!this.credentials.refreshToken;
    }

    // Check expiration
    if (this.credentials.tokenExpiresAt) {
      const now = Date.now();
      return now >= this.credentials.tokenExpiresAt - TOKEN_REFRESH_BUFFER_MS;
    }

    // If we have an access token but no expiration, assume it's valid
    return false;
  }

  /**
   * Refresh the access token using the refresh token
   */
  async refreshAccessToken(): Promise<void> {
    // Prevent concurrent refresh attempts
    if (this.isRefreshing) {
      if (this.refreshPromise) {
        await this.refreshPromise;
      }
      return;
    }

    if (!this.credentials.refreshToken) {
      throw new SalesforceConnectorError(
        "No refresh token available. User needs to re-authenticate.",
        "NO_REFRESH_TOKEN",
        401,
      );
    }

    this.isRefreshing = true;
    this.refreshPromise = this.doRefresh();

    try {
      await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual token refresh
   */
  private async doRefresh(): Promise<void> {
    const loginUrl = this.getLoginUrl();

    const oauth2 = new jsforce.OAuth2({
      clientId: this.credentials.clientId,
      clientSecret: this.credentials.clientSecret,
      loginUrl,
    });

    try {
      const tempConn = new jsforce.Connection({
        oauth2,
        refreshToken: this.credentials.refreshToken,
      });

      // Force a refresh by making a simple request
      await tempConn.identity();

      // Update credentials
      this.credentials.accessToken = tempConn.accessToken ?? undefined;
      this.config.instanceUrl = tempConn.instanceUrl;

      // Estimate token expiration (Salesforce tokens typically last 2 hours)
      this.credentials.tokenExpiresAt = Date.now() + 2 * 60 * 60 * 1000;

      // Reset the connection so it gets recreated with new token
      this.connection = null;
    } catch (error) {
      throw this.mapError(error, "Token refresh failed");
    }
  }

  // ===========================================================================
  // CREDENTIAL MANAGEMENT
  // ===========================================================================

  /**
   * Update credentials (e.g., after OAuth callback)
   */
  updateCredentials(credentials: Partial<SalesforceCredentials>): void {
    this.credentials = { ...this.credentials, ...credentials };
    // Reset connection to use new credentials
    this.connection = null;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SalesforceConfig>): void {
    this.config = { ...this.config, ...config };
    // Reset connection to use new config
    this.connection = null;
  }

  /**
   * Get current credentials (for storage)
   */
  getCredentials(): SalesforceCredentials {
    return { ...this.credentials };
  }

  /**
   * Get current configuration
   */
  getConfig(): SalesforceConfig {
    return { ...this.config };
  }

  /**
   * Get full connection info
   */
  getConnectionInfo(): SalesforceConnectionInfo {
    return {
      config: this.getConfig(),
      credentials: this.getCredentials(),
      organizationId: this.organizationId,
      userId: this.userId,
    };
  }

  // ===========================================================================
  // HEALTH CHECK
  // ===========================================================================

  /**
   * Check connection health
   *
   * Verifies the connection is working and returns API limits.
   */
  async checkHealth(): Promise<ConnectionHealth> {
    try {
      const conn = await this.getConnection();

      // Get identity to verify connection
      const identity = await conn.identity();

      // Get API limits
      const limitsResult = await conn.limits();

      const limits: ApiLimits = {
        dailyApiRequests: {
          max: limitsResult.DailyApiRequests?.Max ?? 0,
          remaining: limitsResult.DailyApiRequests?.Remaining ?? 0,
        },
      };

      if (limitsResult.DailyBulkApiRequests) {
        limits.dailyBulkApiRequests = {
          max: limitsResult.DailyBulkApiRequests.Max ?? 0,
          remaining: limitsResult.DailyBulkApiRequests.Remaining ?? 0,
        };
      }

      return {
        healthy: true,
        message: `Connected as ${identity.username}`,
        lastCheck: new Date(),
        limits,
      };
    } catch (error) {
      const connError = this.mapError(error, "Health check failed");
      return {
        healthy: false,
        message: "Connection failed",
        lastCheck: new Date(),
        error: connError.message,
      };
    }
  }

  /**
   * Test if the connection is working
   */
  async testConnection(): Promise<boolean> {
    try {
      const conn = await this.getConnection();
      await conn.identity();
      return true;
    } catch {
      return false;
    }
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  /**
   * Close the connection and clean up
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.logout();
      } catch {
        // Ignore logout errors
      }
      this.connection = null;
    }
  }

  // ===========================================================================
  // ERROR MAPPING
  // ===========================================================================

  /**
   * Map jsforce errors to SalesforceConnectorError
   */
  private mapError(error: unknown, context: string): SalesforceConnectorError {
    if (error instanceof SalesforceConnectorError) {
      return error;
    }

    if (error && typeof error === "object") {
      const err = error as Record<string, unknown>;

      // jsforce error format
      const errorCode = (err.errorCode as string) || (err.name as string) || "UNKNOWN_ERROR";
      const message = (err.message as string) || context;
      const statusCode = err.statusCode as number | undefined;

      return new SalesforceConnectorError(`${context}: ${message}`, errorCode, statusCode, error);
    }

    if (error instanceof Error) {
      return new SalesforceConnectorError(`${context}: ${error.message}`, "UNKNOWN_ERROR");
    }

    return new SalesforceConnectorError(context, "UNKNOWN_ERROR");
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a Salesforce connector from connection info
 */
export function createSalesforceConnector(info: SalesforceConnectionInfo): SalesforceConnector {
  return new SalesforceConnector({
    credentials: info.credentials,
    config: info.config,
    organizationId: info.organizationId,
    userId: info.userId,
  });
}

/**
 * Create a Salesforce connector for testing with existing tokens
 *
 * @param accessToken - Valid access token
 * @param instanceUrl - Salesforce instance URL
 * @param options - Additional options
 */
export function createTestConnector(
  accessToken: string,
  instanceUrl: string,
  options?: {
    refreshToken?: string;
    clientId?: string;
    clientSecret?: string;
  },
): SalesforceConnector {
  return new SalesforceConnector({
    credentials: {
      clientId: options?.clientId ?? "test-client-id",
      clientSecret: options?.clientSecret ?? "test-client-secret",
      accessToken,
      refreshToken: options?.refreshToken,
    },
    config: {
      instanceUrl,
      apiVersion: DEFAULT_API_VERSION,
    },
    organizationId: "test-org",
  });
}
