/**
 * Microsoft Entra User Authentication Flow
 *
 * Handles OAuth 2.0 Authorization Code flow for individual user authentication.
 * Users sign in with their Microsoft accounts to access M365 resources.
 *
 * Flow:
 * 1. User clicks "Sign in with Microsoft"
 * 2. Redirect to Microsoft authorization URL
 * 3. User authenticates and consents
 * 4. Microsoft redirects back with authorization code
 * 5. Exchange code for access + refresh tokens
 * 6. Store tokens securely for API access
 *
 * @see docs/MICROSOFT-365-AUTH-ARCHITECTURE.md
 */

import {
  AuthorizationCodeRequest,
  AuthorizationUrlRequest,
  RefreshTokenRequest,
  type AuthenticationResult,
} from "@azure/msal-node";
import { randomUUID } from "node:crypto";
import {
  DEFAULT_USER_SCOPES,
  getEntraConfig,
  getMsalClient,
  createTenantMsalClient,
} from "./client.js";

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

/**
 * Pending auth state with metadata
 */
interface AuthState {
  /** User ID if known (existing user SSO) */
  userId?: string;
  /** Organization ID if known */
  organizationId?: string;
  /** State creation timestamp */
  createdAt: number;
  /** Redirect URL after completion */
  returnUrl?: string;
  /** Code verifier for PKCE (if used) */
  codeVerifier?: string;
  /** Scopes requested */
  scopes: string[];
}

/**
 * In-memory store for pending auth states
 * In production, use Redis for distributed state
 */
const pendingAuthStates = new Map<string, AuthState>();

/** State validity period: 10 minutes */
const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Create and store an auth state for CSRF protection
 */
export function createAuthState(options: {
  userId?: string;
  organizationId?: string;
  returnUrl?: string;
  scopes?: string[];
}): string {
  // Clean up expired states periodically
  cleanupExpiredStates();

  const state = randomUUID();
  pendingAuthStates.set(state, {
    userId: options.userId,
    organizationId: options.organizationId,
    createdAt: Date.now(),
    returnUrl: options.returnUrl,
    scopes: options.scopes || DEFAULT_USER_SCOPES,
  });

  return state;
}

/**
 * Validate and consume an auth state
 * Returns the state data if valid, null otherwise
 */
export function consumeAuthState(state: string): AuthState | null {
  const authState = pendingAuthStates.get(state);
  if (!authState) {
    return null;
  }

  // Check if expired
  if (Date.now() - authState.createdAt > STATE_TTL_MS) {
    pendingAuthStates.delete(state);
    return null;
  }

  // Consume the state (one-time use)
  pendingAuthStates.delete(state);
  return authState;
}

/**
 * Remove expired states from memory
 */
function cleanupExpiredStates(): void {
  const now = Date.now();
  for (const [key, value] of pendingAuthStates.entries()) {
    if (now - value.createdAt > STATE_TTL_MS) {
      pendingAuthStates.delete(key);
    }
  }
}

// =============================================================================
// AUTHORIZATION URL
// =============================================================================

/**
 * Parameters for auth code URL generation
 */
export interface AuthCodeUrlParams {
  /** Callback URL for auth result */
  redirectUri: string;
  /** CSRF protection state token */
  state: string;
  /** OAuth scopes to request */
  scopes: string[];
  /** Optional tenant ID (defaults to 'common') */
  tenantId?: string;
  /** Optional login hint (email address) */
  loginHint?: string;
  /** Optional domain hint (e.g., 'contoso.com') */
  domainHint?: string;
  /** Force re-authentication */
  prompt?: "login" | "consent" | "select_account" | "none";
}

/**
 * Generate Microsoft authorization URL for user login
 *
 * @example
 * ```typescript
 * const state = createAuthState({ userId: currentUser.id });
 * const url = await getAuthCodeUrl({
 *   redirectUri: 'https://app.goodteams.ai/api/platform/auth/entra/login/callback',
 *   state,
 *   scopes: DEFAULT_USER_SCOPES,
 *   loginHint: 'user@contoso.com',
 * });
 * // Redirect user to url
 * ```
 */
export async function getAuthCodeUrl(params: AuthCodeUrlParams): Promise<string> {
  const client = params.tenantId ? createTenantMsalClient(params.tenantId) : getMsalClient();

  const authUrlRequest: AuthorizationUrlRequest = {
    redirectUri: params.redirectUri,
    state: params.state,
    scopes: params.scopes,
    loginHint: params.loginHint,
    domainHint: params.domainHint,
    prompt: params.prompt,
  };

  return client.getAuthCodeUrl(authUrlRequest);
}

// =============================================================================
// TOKEN EXCHANGE
// =============================================================================

/**
 * Token exchange result with user info
 */
export interface TokenExchangeResult {
  /** Access token for API calls */
  accessToken: string;
  /** Refresh token for silent renewal */
  refreshToken?: string;
  /** Token expiry timestamp */
  expiresOn: Date;
  /** Microsoft object ID of the user */
  microsoftId: string;
  /** User's tenant ID */
  tenantId: string;
  /** User's email address */
  email?: string;
  /** User's display name */
  displayName?: string;
  /** User's UPN (userPrincipalName) */
  upn?: string;
  /** Scopes granted */
  scopes: string[];
  /** ID token claims */
  idTokenClaims?: Record<string, unknown>;
}

/**
 * Exchange authorization code for tokens
 *
 * Called after user completes Microsoft login and is redirected back
 * with an authorization code.
 *
 * @example
 * ```typescript
 * const result = await exchangeCodeForTokens({
 *   code: req.query.code,
 *   redirectUri: 'https://app.goodteams.ai/api/platform/auth/entra/login/callback',
 *   scopes: DEFAULT_USER_SCOPES,
 * });
 *
 * // Store tokens securely
 * await storeUserTokens(userId, {
 *   accessToken: result.accessToken,
 *   refreshToken: result.refreshToken,
 *   expiresOn: result.expiresOn,
 * });
 * ```
 */
export async function exchangeCodeForTokens(options: {
  code: string;
  redirectUri: string;
  scopes: string[];
  tenantId?: string;
}): Promise<TokenExchangeResult> {
  const client = options.tenantId ? createTenantMsalClient(options.tenantId) : getMsalClient();

  const tokenRequest: AuthorizationCodeRequest = {
    code: options.code,
    redirectUri: options.redirectUri,
    scopes: options.scopes,
  };

  const response = await client.acquireTokenByCode(tokenRequest);
  return mapAuthenticationResult(response);
}

// =============================================================================
// TOKEN REFRESH
// =============================================================================

/**
 * Refresh an access token using a refresh token
 *
 * Called when the access token is expired or about to expire.
 * Returns a new access token (and possibly new refresh token).
 *
 * @example
 * ```typescript
 * if (tokenExpiresIn < 5 * 60 * 1000) { // Less than 5 minutes
 *   const newTokens = await refreshAccessToken({
 *     refreshToken: user.msRefreshToken,
 *     scopes: DEFAULT_USER_SCOPES,
 *   });
 *   await updateUserTokens(userId, newTokens);
 * }
 * ```
 */
export async function refreshAccessToken(options: {
  refreshToken: string;
  scopes: string[];
  tenantId?: string;
}): Promise<TokenExchangeResult> {
  const client = options.tenantId ? createTenantMsalClient(options.tenantId) : getMsalClient();

  const refreshRequest: RefreshTokenRequest = {
    refreshToken: options.refreshToken,
    scopes: options.scopes,
  };

  const response = await client.acquireTokenByRefreshToken(refreshRequest);
  if (!response) {
    throw new Error("Failed to refresh token - no response from MSAL");
  }
  // Note: MSAL may return a new refresh token, but it's managed in the cache
  // We pass through the original refresh token for continuity
  return mapAuthenticationResult(response, options.refreshToken);
}

/**
 * Check if a token needs refresh (within buffer period)
 */
export function tokenNeedsRefresh(expiresOn: Date, bufferMinutes = 5): boolean {
  const bufferMs = bufferMinutes * 60 * 1000;
  return expiresOn.getTime() - Date.now() < bufferMs;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Map MSAL authentication result to our token exchange result
 *
 * Note: MSAL does not expose refresh tokens directly in the AuthenticationResult
 * for security reasons. The refresh token is managed internally by MSAL's token cache.
 * For server-side storage, we rely on MSAL's cache or the authorization code flow
 * which includes the refresh token in the token response.
 */
function mapAuthenticationResult(
  response: AuthenticationResult,
  refreshToken?: string,
): TokenExchangeResult {
  const claims = response.idTokenClaims as Record<string, unknown> | undefined;

  // Extract user info from claims
  const microsoftId = (claims?.oid as string) || (claims?.sub as string) || response.uniqueId;
  const tenantId = (claims?.tid as string) || response.tenantId;
  const email = (claims?.email as string) || (claims?.preferred_username as string);
  const displayName = claims?.name as string | undefined;
  const upn = claims?.upn as string | undefined;

  if (!microsoftId || !tenantId) {
    throw new Error("Missing required claims (oid/sub, tid) in token response");
  }

  return {
    accessToken: response.accessToken,
    refreshToken,
    expiresOn: response.expiresOn || new Date(Date.now() + 3600 * 1000),
    microsoftId,
    tenantId,
    email,
    displayName,
    upn,
    scopes: response.scopes,
    idTokenClaims: claims,
  };
}

// =============================================================================
// TESTING HELPERS
// =============================================================================

/**
 * Clear all pending auth states
 * Only for testing purposes
 */
export function clearAllAuthStates(): void {
  pendingAuthStates.clear();
}

/**
 * Get count of pending auth states
 * Only for testing/monitoring
 */
export function getPendingAuthCount(): number {
  return pendingAuthStates.size;
}
