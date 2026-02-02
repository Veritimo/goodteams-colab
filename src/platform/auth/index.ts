/**
 * Platform Authentication Module
 *
 * Provides:
 * - RBAC permission system
 * - Permission checking utilities
 * - Admin continuity guards
 *
 * Phase 2: RBAC implementation
 * Future: Microsoft Entra SSO integration, JWT verification
 *
 * See: docs/RBAC-STAFF-ONBOARDING.md
 * See: docs/SECURITY-ARCHITECTURE.md
 */

export const AUTH_MODULE_VERSION = "0.2.0"; // Added Entra SSO integration

// Re-export permission constants and utilities
export {
  PERMISSIONS,
  type Permission,
  ADMIN_IMPLICIT_PERMISSIONS,
  USER_IMPLICIT_PERMISSIONS,
  BILLING_IMPLICIT_PERMISSIONS,
  VIEWER_IMPLICIT_PERMISSIONS,
  SUPER_ADMIN_IMPLICIT_PERMISSIONS,
  ASSIGNABLE_PERMISSIONS,
  getImplicitPermissionsForRole,
  isAssignablePermission,
  getAllPermissions,
} from "./permissions.js";

// Re-export permission checking functions
export {
  checkPermission,
  checkPermissionForUser,
  getUserPermissions,
  getUserPermissionsFromData,
  checkAllPermissions,
  checkAnyPermission,
  checkRole,
  grantPermission,
  revokePermission,
  getExplicitPermissions,
  isAdminRole,
  canManageRole,
  type PermissionCheckUser,
} from "./check-permission.js";

// Re-export admin continuity guards
export {
  validateAdminChange,
  validateRoleChange,
  validateUserRemoval,
  getAdminCount,
  wouldRemoveLastAdmin,
  AdminContinuityError,
} from "./admin-guard.js";

// Re-export context types
export type { RequestUser, RequestContext } from "../api/middleware/context.js";

// =============================================================================
// MICROSOFT ENTRA SSO
// =============================================================================

// Re-export Entra SSO module
export {
  // Client and configuration
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
  // Admin consent flow
  createConsentState,
  consumeConsentState,
  getAdminConsentUrl,
  handleAdminConsentCallback,
  clearAllConsentStates,
  getPendingConsentCount,
  type AdminConsentUrlParams,
  type AdminConsentResult,
  type AdminConsentCallbackParams,
  // User authentication flow
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
  // Token storage
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
  // Directory search
  searchUsers,
  getUserById,
  getUserByEmail,
  getCurrentUser,
  listUsers,
  DirectorySearchError,
  type EntraUser,
  type DirectorySearchResult,
} from "./entra/index.js";
