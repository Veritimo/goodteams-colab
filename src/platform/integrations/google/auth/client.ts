/**
 * Google OAuth 2.0 Client
 *
 * Provides OAuth 2.0 authentication flows for Google Workspace integration.
 * Handles user consent flow with authorization code exchange.
 *
 * @see https://developers.google.com/identity/protocols/oauth2
 * @see docs/GOOGLE-WORKSPACE-AUTH-ARCHITECTURE.md
 */

import { OAuth2Client, Credentials } from "google-auth-library";
import { randomUUID } from "node:crypto";
import { DEFAULT_USER_SCOPES } from "./scopes.js";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Configuration for Google OAuth client
 */
export interface GoogleAuthConfig {
  /** OAuth 2.0 client ID from Google Cloud Console */
  clientId: string;
  /** OAuth 2.0 client secret from Google Cloud Console */
  clientSecret: string;
  /** Redirect URI for OAuth callbacks */
  redirectUri: string;
}

/**
 * Token response from Google OAuth
 */
export interface GoogleTokens {
  /** Access token for API calls */
  accessToken: string;
  /** Refresh token for obtaining new access tokens */
  refreshToken?: string;
  /** Token expiry timestamp */
  expiresAt: Date;
  /** ID token containing user claims (JWT) */
  idToken?: string;
  /** Token type (usually "Bearer") */
  tokenType: string;
  /** Scopes granted by the user */
  scopes: string[];
}

/**
 * User info from Google ID token or userinfo endpoint
 */
export interface GoogleUserInfo {
  /** Google user ID (subject claim) */
  googleId: string;
  /** User's email address */
  email: string;
  /** Whether email is verified */
  emailVerified: boolean;
  /** User's display name */
  name?: string;
  /** User's given (first) name */
  givenName?: string;
  /** User's family (last) name */
  familyName?: string;
  /** URL to user's profile picture */
  picture?: string;
  /** User's locale/language preference */
  locale?: string;
  /** Hosted domain (for Google Workspace users) */
  hostedDomain?: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Get Google OAuth configuration from environment variables
 */
export function getGoogleAuthConfig(): GoogleAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing required Google OAuth configuration: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set",
    );
  }

  if (!redirectUri) {
    throw new Error("Missing required Google OAuth configuration: GOOGLE_REDIRECT_URI must be set");
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

/**
 * Check if Google OAuth integration is configured
 */
export function isGoogleAuthConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  );
}

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

/**
 * Pending OAuth state with metadata
 */
interface OAuthState {
  /** User ID if known (existing user SSO) */
  userId?: string;
  /** Organization ID if known */
  organizationId?: string;
  /** State creation timestamp */
  createdAt: number;
  /** Redirect URL after completion */
  returnUrl?: string;
  /** Scopes requested */
  scopes: string[];
  /** Nonce for OIDC (prevents replay attacks) */
  nonce?: string;
}

/**
 * In-memory store for pending OAuth states
 * In production, use Redis for distributed state
 */
const pendingOAuthStates = new Map<string, OAuthState>();

/** State validity period: 10 minutes */
const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Create and store an OAuth state for CSRF protection
 */
export function createOAuthState(options: {
  userId?: string;
  organizationId?: string;
  returnUrl?: string;
  scopes?: string[];
}): string {
  cleanupExpiredStates();

  const state = randomUUID();
  pendingOAuthStates.set(state, {
    userId: options.userId,
    organizationId: options.organizationId,
    createdAt: Date.now(),
    returnUrl: options.returnUrl,
    scopes: options.scopes || [...DEFAULT_USER_SCOPES],
    nonce: randomUUID(),
  });

  return state;
}

/**
 * Validate and consume an OAuth state
 * Returns the state data if valid, null otherwise
 */
export function consumeOAuthState(state: string): OAuthState | null {
  const oauthState = pendingOAuthStates.get(state);
  if (!oauthState) {
    return null;
  }

  if (Date.now() - oauthState.createdAt > STATE_TTL_MS) {
    pendingOAuthStates.delete(state);
    return null;
  }

  pendingOAuthStates.delete(state);
  return oauthState;
}

/**
 * Remove expired states from memory
 */
function cleanupExpiredStates(): void {
  const now = Date.now();
  for (const [key, value] of pendingOAuthStates.entries()) {
    if (now - value.createdAt > STATE_TTL_MS) {
      pendingOAuthStates.delete(key);
    }
  }
}

/**
 * Clear all pending OAuth states (for testing)
 */
export function clearAllOAuthStates(): void {
  pendingOAuthStates.clear();
}

/**
 * Get count of pending OAuth states (for monitoring/testing)
 */
export function getPendingOAuthStateCount(): number {
  return pendingOAuthStates.size;
}

// =============================================================================
// OAUTH CLIENT
// =============================================================================

/** Singleton OAuth2Client instance */
let oauth2Client: OAuth2Client | null = null;

/**
 * Get or create the Google OAuth2 client
 */
export function getOAuth2Client(config?: GoogleAuthConfig): OAuth2Client {
  if (!oauth2Client) {
    const cfg = config || getGoogleAuthConfig();
    oauth2Client = new OAuth2Client(cfg.clientId, cfg.clientSecret, cfg.redirectUri);
  }
  return oauth2Client;
}

/**
 * Create a new OAuth2 client with custom config
 */
export function createOAuth2Client(config: GoogleAuthConfig): OAuth2Client {
  return new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
}

/**
 * Reset the OAuth2 client singleton (for testing)
 */
export function resetOAuth2Client(): void {
  oauth2Client = null;
}

// =============================================================================
// GOOGLE AUTH CLIENT CLASS
// =============================================================================

/**
 * Google OAuth Authentication Client
 *
 * Wraps google-auth-library OAuth2Client with a cleaner interface
 * for GoodTeams integration.
 */
export class GoogleAuthClient {
  private client: OAuth2Client;
  private config: GoogleAuthConfig;

  constructor(config: GoogleAuthConfig) {
    this.config = config;
    this.client = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
  }

  /**
   * Generate authorization URL for user consent
   *
   * @param scopes - OAuth scopes to request
   * @param state - CSRF protection state token
   * @param options - Additional options
   * @returns Authorization URL to redirect user to
   */
  getAuthorizationUrl(
    scopes: string[],
    state: string,
    options?: {
      /** Force account selection even if user is logged in */
      prompt?: "none" | "consent" | "select_account";
      /** Hint for which account to use */
      loginHint?: string;
      /** Hint for hosted domain (Google Workspace) */
      hostedDomain?: string;
      /** Include granted scopes in response */
      includeGrantedScopes?: boolean;
    },
  ): string {
    return this.client.generateAuthUrl({
      access_type: "offline", // Required to get refresh token
      scope: scopes,
      state,
      prompt: options?.prompt || "consent", // Force consent to ensure refresh token
      login_hint: options?.loginHint,
      hd: options?.hostedDomain,
      include_granted_scopes: options?.includeGrantedScopes,
    });
  }

  /**
   * Exchange authorization code for tokens
   *
   * @param code - Authorization code from callback
   * @returns Token response including access and refresh tokens
   */
  async exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
    const { tokens } = await this.client.getToken(code);
    return this.mapCredentialsToTokens(tokens);
  }

  /**
   * Refresh access token using refresh token
   *
   * @param refreshToken - Refresh token from previous authorization
   * @returns New token response
   */
  async refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
    this.client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await this.client.refreshAccessToken();
    return this.mapCredentialsToTokens(credentials, refreshToken);
  }

  /**
   * Revoke a token (access or refresh)
   *
   * @param token - Token to revoke
   */
  async revokeToken(token: string): Promise<void> {
    await this.client.revokeToken(token);
  }

  /**
   * Verify and decode an ID token
   *
   * @param idToken - JWT ID token to verify
   * @returns User info from the token
   */
  async verifyIdToken(idToken: string): Promise<GoogleUserInfo> {
    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: this.config.clientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error("Invalid ID token: no payload");
    }

    if (!payload.sub || !payload.email) {
      throw new Error("Invalid ID token: missing required claims (sub, email)");
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified ?? false,
      name: payload.name,
      givenName: payload.given_name,
      familyName: payload.family_name,
      picture: payload.picture,
      locale: payload.locale,
      hostedDomain: payload.hd,
    };
  }

  /**
   * Get user info from access token using userinfo endpoint
   *
   * @param accessToken - Valid access token
   * @returns User info from the API
   */
  async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    this.client.setCredentials({ access_token: accessToken });

    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      googleId: data.sub,
      email: data.email,
      emailVerified: data.email_verified ?? false,
      name: data.name,
      givenName: data.given_name,
      familyName: data.family_name,
      picture: data.picture,
      locale: data.locale,
      hostedDomain: data.hd,
    };
  }

  /**
   * Check if an access token is still valid
   *
   * @param accessToken - Token to check
   * @returns Token info if valid, null if invalid/expired
   */
  async getTokenInfo(accessToken: string): Promise<{ expiresIn: number; scopes: string[] } | null> {
    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return {
        expiresIn: parseInt(data.expires_in, 10),
        scopes: data.scope?.split(" ") || [],
      };
    } catch {
      return null;
    }
  }

  /**
   * Get the underlying OAuth2Client for advanced use cases
   */
  getUnderlyingClient(): OAuth2Client {
    return this.client;
  }

  /**
   * Map Google credentials to our token format
   */
  private mapCredentialsToTokens(
    credentials: Credentials,
    existingRefreshToken?: string,
  ): GoogleTokens {
    if (!credentials.access_token) {
      throw new Error("No access token in response");
    }

    // Calculate expiry date
    let expiresAt: Date;
    if (credentials.expiry_date) {
      expiresAt = new Date(credentials.expiry_date);
    } else {
      // Default to 1 hour if not specified
      expiresAt = new Date(Date.now() + 3600 * 1000);
    }

    return {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token || existingRefreshToken,
      expiresAt,
      idToken: credentials.id_token || undefined,
      tokenType: credentials.token_type || "Bearer",
      scopes: credentials.scope?.split(" ") || [],
    };
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Generate Google authorization URL
 *
 * @example
 * ```typescript
 * const state = createOAuthState({ userId: currentUser.id });
 * const url = getGoogleAuthUrl({
 *   scopes: GOODTEAMS_USER_SCOPES,
 *   state,
 * });
 * // Redirect user to url
 * ```
 */
export function getGoogleAuthUrl(options: {
  scopes: string[];
  state: string;
  prompt?: "none" | "consent" | "select_account";
  loginHint?: string;
  hostedDomain?: string;
}): string {
  const client = getOAuth2Client();

  return client.generateAuthUrl({
    access_type: "offline",
    scope: options.scopes,
    state: options.state,
    prompt: options.prompt || "consent",
    login_hint: options.loginHint,
    hd: options.hostedDomain,
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeGoogleCode(code: string): Promise<GoogleTokens> {
  const config = getGoogleAuthConfig();
  const authClient = new GoogleAuthClient(config);
  return authClient.exchangeCodeForTokens(code);
}

/**
 * Refresh Google access token
 */
export async function refreshGoogleToken(refreshToken: string): Promise<GoogleTokens> {
  const config = getGoogleAuthConfig();
  const authClient = new GoogleAuthClient(config);
  return authClient.refreshAccessToken(refreshToken);
}

/**
 * Check if token needs refresh (within buffer period)
 */
export function tokenNeedsRefresh(expiresAt: Date, bufferMinutes = 5): boolean {
  const bufferMs = bufferMinutes * 60 * 1000;
  return expiresAt.getTime() - Date.now() < bufferMs;
}

/**
 * Verify a Google ID token and extract user info
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleUserInfo> {
  const config = getGoogleAuthConfig();
  const authClient = new GoogleAuthClient(config);
  return authClient.verifyIdToken(idToken);
}
