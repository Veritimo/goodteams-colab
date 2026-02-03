/**
 * Salesforce OAuth Handler
 *
 * Handles OAuth 2.0 authorization code flow for Salesforce:
 * - Generate authorization URLs
 * - Exchange authorization codes for tokens
 * - Refresh expired tokens
 *
 * @see https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_web_server_flow.htm
 */

import jsforce from "jsforce";
import type { SalesforceCredentials, SalesforceConfig } from "./types.js";
import {
  DEFAULT_API_VERSION,
  DEFAULT_LOGIN_URL,
  SANDBOX_LOGIN_URL,
  SalesforceConnectorError,
} from "./salesforce-connector.js";

// =============================================================================
// TYPES
// =============================================================================

/**
 * OAuth token response from Salesforce
 */
export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken?: string;
  instanceUrl: string;
  tokenType: string;
  issuedAt: number;
  signature?: string;
  idToken?: string;
  scope?: string;
}

/**
 * User identity from Salesforce
 */
export interface SalesforceIdentity {
  id: string;
  asserted_user: boolean;
  user_id: string;
  organization_id: string;
  username: string;
  nick_name: string;
  display_name: string;
  email: string;
  email_verified: boolean;
  first_name?: string;
  last_name?: string;
  timezone?: string;
  photos?: {
    picture?: string;
    thumbnail?: string;
  };
  urls?: Record<string, string>;
  active: boolean;
  user_type: string;
  language: string;
  locale: string;
  utcOffset: number;
  last_modified_date: string;
}

/**
 * Options for OAuth handler
 */
export interface OAuthHandlerOptions {
  /** OAuth client ID (Connected App Consumer Key) */
  clientId: string;
  /** OAuth client secret (Connected App Consumer Secret) */
  clientSecret: string;
  /** Whether to use sandbox login URL */
  sandbox?: boolean;
  /** Custom login URL (overrides sandbox setting) */
  loginUrl?: string;
  /** API version */
  apiVersion?: string;
}

/**
 * Options for generating authorization URL
 */
export interface AuthorizationUrlOptions {
  /** OAuth redirect URI (must match Connected App config) */
  redirectUri: string;
  /** State parameter for CSRF protection */
  state?: string;
  /** OAuth scopes to request */
  scopes?: string[];
  /** Prompt user for approval even if previously approved */
  prompt?: "login" | "consent" | "select_account";
  /** Login hint (pre-fill username) */
  loginHint?: string;
}

// =============================================================================
// DEFAULT SCOPES
// =============================================================================

/**
 * Default OAuth scopes for Salesforce
 */
export const DEFAULT_SCOPES = [
  "api", // Access REST API
  "refresh_token", // Get refresh token
  "offline_access", // Offline access (implied by refresh_token)
];

/**
 * Extended scopes for additional access
 */
export const EXTENDED_SCOPES = [
  ...DEFAULT_SCOPES,
  "full", // Full access to data
  "chatter_api", // Access Chatter API
  "wave_api", // Access Analytics API
  "web", // Access web application
];

// =============================================================================
// OAUTH HANDLER CLASS
// =============================================================================

/**
 * Salesforce OAuth Handler
 *
 * Manages OAuth 2.0 authorization code flow.
 *
 * @example
 * ```typescript
 * const oauth = new SalesforceOAuthHandler({
 *   clientId: 'connected_app_consumer_key',
 *   clientSecret: 'connected_app_consumer_secret',
 * });
 *
 * // Step 1: Get authorization URL
 * const authUrl = oauth.getAuthorizationUrl({
 *   redirectUri: 'https://myapp.com/oauth/callback',
 *   state: 'random_state_string',
 * });
 *
 * // Step 2: Redirect user to authUrl...
 *
 * // Step 3: Handle callback
 * const tokens = await oauth.handleCallback(code, 'https://myapp.com/oauth/callback');
 *
 * // Step 4: Use tokens in connector
 * const connector = new SalesforceConnector({
 *   credentials: {
 *     clientId: oauth.clientId,
 *     clientSecret: oauth.clientSecret,
 *     accessToken: tokens.accessToken,
 *     refreshToken: tokens.refreshToken,
 *   },
 *   config: { instanceUrl: tokens.instanceUrl },
 *   organizationId: 'org-id',
 * });
 * ```
 */
export class SalesforceOAuthHandler {
  readonly clientId: string;
  readonly clientSecret: string;
  private readonly loginUrl: string;
  private readonly apiVersion: string;
  private oauth2: jsforce.OAuth2;

  constructor(options: OAuthHandlerOptions) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.apiVersion = options.apiVersion ?? DEFAULT_API_VERSION;

    // Determine login URL
    if (options.loginUrl) {
      this.loginUrl = options.loginUrl;
    } else {
      this.loginUrl = options.sandbox ? SANDBOX_LOGIN_URL : DEFAULT_LOGIN_URL;
    }

    // Create jsforce OAuth2 instance
    this.oauth2 = new jsforce.OAuth2({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      loginUrl: this.loginUrl,
    });
  }

  // ===========================================================================
  // AUTHORIZATION URL
  // ===========================================================================

  /**
   * Generate authorization URL for OAuth flow
   *
   * User should be redirected to this URL to authorize the application.
   */
  getAuthorizationUrl(options: AuthorizationUrlOptions): string {
    const { redirectUri, state, scopes = DEFAULT_SCOPES, prompt, loginHint } = options;

    // Build scope string
    const scopeString = scopes.join(" ");

    // Get base authorization URL from jsforce
    let url = this.oauth2.getAuthorizationUrl({
      redirect_uri: redirectUri,
      state: state ?? "",
      scope: scopeString,
    });

    // Add additional parameters
    const urlObj = new URL(url);

    if (prompt) {
      urlObj.searchParams.set("prompt", prompt);
    }

    if (loginHint) {
      urlObj.searchParams.set("login_hint", loginHint);
    }

    return urlObj.toString();
  }

  // ===========================================================================
  // TOKEN EXCHANGE
  // ===========================================================================

  /**
   * Exchange authorization code for tokens
   *
   * Call this in your OAuth callback handler after user authorizes.
   */
  async handleCallback(code: string, redirectUri: string): Promise<OAuthTokenResponse> {
    try {
      // Create a temporary connection for token exchange
      const conn = new jsforce.Connection({
        oauth2: new jsforce.OAuth2({
          clientId: this.clientId,
          clientSecret: this.clientSecret,
          loginUrl: this.loginUrl,
          redirectUri,
        }),
      });

      // Exchange code for tokens
      await conn.authorize(code);

      // Extract tokens from connection
      const response: OAuthTokenResponse = {
        accessToken: conn.accessToken ?? "",
        refreshToken: conn.refreshToken ?? undefined,
        instanceUrl: conn.instanceUrl ?? "",
        tokenType: "Bearer",
        issuedAt: Date.now(),
      };

      if (!response.accessToken) {
        throw new SalesforceConnectorError(
          "No access token received from Salesforce",
          "NO_ACCESS_TOKEN",
          401,
        );
      }

      return response;
    } catch (error) {
      throw this.mapOAuthError(error, "Authorization code exchange failed");
    }
  }

  // ===========================================================================
  // TOKEN REFRESH
  // ===========================================================================

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(refreshToken: string): Promise<OAuthTokenResponse> {
    try {
      // Create connection with refresh token
      const conn = new jsforce.Connection({
        oauth2: this.oauth2,
        refreshToken,
      });

      // Force token refresh by making identity request
      await conn.identity();

      const response: OAuthTokenResponse = {
        accessToken: conn.accessToken ?? "",
        refreshToken: conn.refreshToken ?? refreshToken, // Keep existing if not returned
        instanceUrl: conn.instanceUrl ?? "",
        tokenType: "Bearer",
        issuedAt: Date.now(),
      };

      if (!response.accessToken) {
        throw new SalesforceConnectorError(
          "No access token received during refresh",
          "NO_ACCESS_TOKEN",
          401,
        );
      }

      return response;
    } catch (error) {
      throw this.mapOAuthError(error, "Token refresh failed");
    }
  }

  // ===========================================================================
  // USER IDENTITY
  // ===========================================================================

  /**
   * Get user identity using access token
   */
  async getIdentity(accessToken: string, instanceUrl: string): Promise<SalesforceIdentity> {
    try {
      const conn = new jsforce.Connection({
        accessToken,
        instanceUrl,
        version: this.apiVersion,
      });

      // jsforce IdentityInfo type is incomplete - Salesforce API returns more fields
      const identity = (await conn.identity()) as unknown as {
        id?: string;
        asserted_user?: boolean;
        user_id?: string;
        organization_id?: string;
        username?: string;
        nick_name?: string;
        display_name?: string;
        email?: string;
        email_verified?: boolean;
        first_name?: string;
        last_name?: string;
        timezone?: string;
        photos?: { picture?: string; thumbnail?: string };
        urls?: Record<string, string>;
        active?: boolean;
        user_type?: string;
        language?: string;
        locale?: string;
        utcOffset?: number;
        last_modified_date?: string;
      };

      return {
        id: identity.id ?? "",
        asserted_user: identity.asserted_user ?? false,
        user_id: identity.user_id ?? "",
        organization_id: identity.organization_id ?? "",
        username: identity.username ?? "",
        nick_name: identity.nick_name ?? "",
        display_name: identity.display_name ?? "",
        email: identity.email ?? "",
        email_verified: identity.email_verified ?? false,
        first_name: identity.first_name,
        last_name: identity.last_name,
        timezone: identity.timezone,
        photos: identity.photos,
        urls: identity.urls,
        active: identity.active ?? true,
        user_type: identity.user_type ?? "",
        language: identity.language ?? "",
        locale: identity.locale ?? "",
        utcOffset: identity.utcOffset ?? 0,
        last_modified_date: identity.last_modified_date ?? "",
      };
    } catch (error) {
      throw this.mapOAuthError(error, "Failed to get user identity");
    }
  }

  // ===========================================================================
  // TOKEN REVOCATION
  // ===========================================================================

  /**
   * Revoke access token
   *
   * Call this when user disconnects their Salesforce account.
   */
  async revokeToken(token: string): Promise<void> {
    try {
      const revokeUrl = `${this.loginUrl}/services/oauth2/revoke`;

      const response = await fetch(revokeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `token=${encodeURIComponent(token)}`,
      });

      // Salesforce returns 200 even for invalid tokens
      if (!response.ok) {
        const text = await response.text();
        throw new SalesforceConnectorError(
          `Token revocation failed: ${text}`,
          "REVOKE_FAILED",
          response.status,
        );
      }
    } catch (error) {
      if (error instanceof SalesforceConnectorError) {
        throw error;
      }
      throw this.mapOAuthError(error, "Token revocation failed");
    }
  }

  // ===========================================================================
  // CREDENTIALS BUILDER
  // ===========================================================================

  /**
   * Build credentials object from token response
   */
  buildCredentials(tokenResponse: OAuthTokenResponse): SalesforceCredentials {
    return {
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      // Estimate expiration (Salesforce tokens typically last 2 hours)
      tokenExpiresAt: tokenResponse.issuedAt + 2 * 60 * 60 * 1000,
    };
  }

  /**
   * Build config object from token response
   */
  buildConfig(tokenResponse: OAuthTokenResponse): SalesforceConfig {
    return {
      instanceUrl: tokenResponse.instanceUrl,
      apiVersion: this.apiVersion,
      sandbox: this.loginUrl === SANDBOX_LOGIN_URL,
    };
  }

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  /**
   * Map OAuth errors to SalesforceConnectorError
   */
  private mapOAuthError(error: unknown, context: string): SalesforceConnectorError {
    if (error instanceof SalesforceConnectorError) {
      return error;
    }

    if (error && typeof error === "object") {
      const err = error as Record<string, unknown>;

      // Check for OAuth error format
      if (err.error && typeof err.error === "string") {
        const errorCode = err.error;
        const message = (err.error_description as string) || context;
        return new SalesforceConnectorError(`${context}: ${message}`, errorCode, 401, error);
      }

      // jsforce error format
      const errorCode = (err.errorCode as string) || (err.name as string) || "OAUTH_ERROR";
      const message = (err.message as string) || context;

      return new SalesforceConnectorError(`${context}: ${message}`, errorCode, 401, error);
    }

    if (error instanceof Error) {
      return new SalesforceConnectorError(`${context}: ${error.message}`, "OAUTH_ERROR", 401);
    }

    return new SalesforceConnectorError(context, "OAUTH_ERROR", 401);
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create an OAuth handler from credentials
 */
export function createOAuthHandler(
  credentials: Pick<SalesforceCredentials, "clientId" | "clientSecret">,
  options?: {
    sandbox?: boolean;
    loginUrl?: string;
    apiVersion?: string;
  },
): SalesforceOAuthHandler {
  return new SalesforceOAuthHandler({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    sandbox: options?.sandbox,
    loginUrl: options?.loginUrl,
    apiVersion: options?.apiVersion,
  });
}
