/**
 * Session Module
 *
 * JWT-based session management with refresh token rotation.
 */

// Types
export {
  type AccessTokenPayload,
  type RefreshTokenPayload,
  type SessionConfig,
  type CreateSessionInput,
  type TokenPair,
  type SessionInfo,
  type AuthenticatedUser,
  type AuthenticatedRequest,
  type SessionErrorCode,
  SessionError,
  DEFAULT_SESSION_CONFIG,
} from "./types.js";

// JWT utilities
export {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  decodeToken,
  isTokenExpired,
  JwtError,
  type JwtErrorCode,
} from "./jwt.js";

// Session service
export {
  getSessionConfig,
  createSession,
  refreshSession,
  revokeSession,
  revokeAllUserSessions,
  getUserSessions,
  getSession,
  cleanupExpiredSessions,
} from "./service.js";

// Middleware
export {
  authMiddleware,
  requireAuth,
  optionalAuth,
  getUser,
  requireUser,
  setSessionCookies,
  clearSessionCookies,
  hasRole,
  isAdmin,
  isInOrganization,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "./middleware.js";

// Cleanup utilities
export { runCleanup } from "./cleanup.js";

// Module version
export const SESSION_MODULE_VERSION = "1.0.0";
