/**
 * Google OAuth Authentication
 *
 * Provides complete Google Workspace OAuth integration for:
 * - User OAuth 2.0 consent flow
 * - Service account with domain-wide delegation
 * - Secure token storage with encryption
 *
 * @see docs/GOOGLE-WORKSPACE-AUTH-ARCHITECTURE.md
 */

// =============================================================================
// SCOPES
// =============================================================================

export {
  GOOGLE_SCOPES,
  IDENTITY_SCOPES,
  DEFAULT_USER_SCOPES,
  DRIVE_READ_SCOPES,
  DRIVE_FILE_SCOPES,
  GMAIL_READ_SCOPES,
  GMAIL_SEND_SCOPES,
  CALENDAR_READ_SCOPES,
  CALENDAR_WRITE_SCOPES,
  DOCS_READ_SCOPES,
  ADMIN_DIRECTORY_SCOPES,
  FULL_WORKSPACE_SCOPES,
  GOODTEAMS_USER_SCOPES,
  requiresDomainWideDelegation,
  isSensitiveScope,
  getScopeDisplayName,
  validateScopes,
  mergeScopes,
} from "./scopes.js";

// =============================================================================
// OAUTH CLIENT
// =============================================================================

export {
  // Types
  type GoogleAuthConfig,
  type GoogleTokens,
  type GoogleUserInfo,
  // Configuration
  getGoogleAuthConfig,
  isGoogleAuthConfigured,
  // State management
  createOAuthState,
  consumeOAuthState,
  clearAllOAuthStates,
  getPendingOAuthStateCount,
  // OAuth2 client
  getOAuth2Client,
  createOAuth2Client,
  resetOAuth2Client,
  // Class
  GoogleAuthClient,
  // Convenience functions
  getGoogleAuthUrl,
  exchangeGoogleCode,
  refreshGoogleToken,
  tokenNeedsRefresh,
  verifyGoogleIdToken,
} from "./client.js";

// =============================================================================
// SERVICE ACCOUNT
// =============================================================================

export {
  // Types
  type ServiceAccountConfig,
  type ServiceAccountCredentials,
  type DomainVerificationResult,
  type ImpersonatedTokenResult,
  // Configuration
  parseServiceAccountCredentials,
  getServiceAccountFromEnv,
  isServiceAccountConfigured,
  // Class
  GoogleServiceAccount,
  // Convenience functions
  getImpersonatedToken,
  verifyDomainWideDelegation,
  createImpersonatedClient,
} from "./service-account.js";

// =============================================================================
// TOKEN STORAGE
// =============================================================================

export {
  // Types
  type StoredGoogleTokens,
  type DecryptedGoogleTokens,
  type GoogleTokenStore,
  // Encryption
  encrypt,
  decrypt,
  // Token store implementations
  DatabaseGoogleTokenStore,
  InMemoryGoogleTokenStore,
  // Token store management
  getTokenStore,
  setTokenStore,
  resetTokenStore,
  // Convenience functions
  storeUserGoogleTokens,
  getValidGoogleAccessToken,
  getUserGoogleTokens,
  removeUserGoogleTokens,
  hasValidGoogleConnection,
  // Refresh service
  refreshExpiringGoogleTokens,
  // Testing helpers
  generateEncryptionKey,
  testEncryption,
} from "./token-store.js";
