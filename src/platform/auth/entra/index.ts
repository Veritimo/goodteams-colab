/**
 * Microsoft Entra SSO Integration
 *
 * Provides complete Entra ID (Azure AD) integration for:
 * - Admin consent flow (organization onboarding)
 * - User SSO authentication
 * - Token management with encryption
 * - Directory search for invitations
 *
 * @see docs/MICROSOFT-365-AUTH-ARCHITECTURE.md
 */

// Client and configuration
export {
  getEntraConfig,
  isEntraConfigured,
  getMsalClient,
  createTenantMsalClient,
  resetMsalClient,
  GRAPH_SCOPES,
  DEFAULT_USER_SCOPES,
  DIRECTORY_SEARCH_SCOPES,
  FULL_M365_SCOPES,
  type EntraConfig,
} from "./client.js";

// Admin consent flow
export {
  createConsentState,
  consumeConsentState,
  getAdminConsentUrl,
  handleAdminConsentCallback,
  clearAllConsentStates,
  getPendingConsentCount,
  type AdminConsentUrlParams,
  type AdminConsentResult,
  type AdminConsentCallbackParams,
} from "./consent.js";

// User authentication flow
export {
  createAuthState,
  consumeAuthState,
  getAuthCodeUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  tokenNeedsRefresh,
  clearAllAuthStates,
  getPendingAuthCount,
  type AuthCodeUrlParams,
  type TokenExchangeResult,
} from "./user-auth.js";

// Token storage
export {
  encrypt,
  decrypt,
  storeUserTokens,
  getValidUserTokens,
  getValidAccessToken,
  removeUserTokens,
  hasValidMicrosoftConnection,
  refreshExpiringTokens,
  generateEncryptionKey,
  testEncryption,
  type StoredTokens,
  type DecryptedTokens,
} from "./token-store.js";

// Directory search
export {
  searchUsers,
  getUserById,
  getUserByEmail,
  getCurrentUser,
  listUsers,
  DirectorySearchError,
  type EntraUser,
  type DirectorySearchResult,
} from "./directory.js";
