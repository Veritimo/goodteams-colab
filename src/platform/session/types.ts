/**
 * Session Types
 *
 * Type definitions for JWT session management.
 */

import type { UserRole } from "@prisma/client";

// =============================================================================
// JWT PAYLOAD
// =============================================================================

/**
 * Access token payload (embedded in JWT)
 */
export interface AccessTokenPayload {
  /** User ID */
  sub: string;
  /** User email */
  email: string;
  /** Organization ID (null if no org) */
  orgId: string | null;
  /** User role */
  role: UserRole;
  /** Token type identifier */
  type: "access";
}

/**
 * Refresh token payload (minimal, references session)
 */
export interface RefreshTokenPayload {
  /** Session ID */
  sid: string;
  /** User ID */
  sub: string;
  /** Token type identifier */
  type: "refresh";
}

// =============================================================================
// SESSION CONFIG
// =============================================================================

/**
 * Session configuration (org-level or defaults)
 */
export interface SessionConfig {
  /** Access token TTL in minutes */
  accessTokenTtlMinutes: number;
  /** Refresh token TTL in days */
  refreshTokenTtlDays: number;
  /** Absolute max session lifetime in days */
  absoluteMaxDays: number;
  /** Whether to extend refresh token on use */
  slidingWindow: boolean;
  /** Max concurrent sessions per user */
  maxConcurrent: number;
}

/**
 * Default session configuration
 */
export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  accessTokenTtlMinutes: 15,
  refreshTokenTtlDays: 14,
  absoluteMaxDays: 30,
  slidingWindow: true,
  maxConcurrent: 10,
};

// =============================================================================
// SESSION DATA
// =============================================================================

/**
 * Session creation input
 */
export interface CreateSessionInput {
  userId: string;
  userAgent?: string;
  ipAddress?: string;
  /** Optional org ID to fetch org-specific config */
  organizationId?: string | null;
}

/**
 * Token pair returned after session creation or refresh
 */
export interface TokenPair {
  /** Access token (JWT, short-lived) */
  accessToken: string;
  /** Refresh token (opaque, long-lived) */
  refreshToken: string;
  /** Access token expiry timestamp (ms) */
  accessTokenExpiresAt: number;
  /** Refresh token expiry timestamp (ms) */
  refreshTokenExpiresAt: number;
}

/**
 * Session info for status endpoints
 */
export interface SessionInfo {
  id: string;
  userId: string;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
  isRevoked: boolean;
}

// =============================================================================
// AUTHENTICATED USER
// =============================================================================

/**
 * Authenticated user context (attached to request)
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  organizationId: string | null;
  role: UserRole;
  /** Session ID (for refresh/revoke operations) */
  sessionId?: string;
}

/**
 * Request with optional auth context
 */
export interface AuthenticatedRequest {
  user?: AuthenticatedUser;
}

// =============================================================================
// ERRORS
// =============================================================================

export class SessionError extends Error {
  constructor(
    message: string,
    public code: SessionErrorCode,
    public statusCode: number = 401,
  ) {
    super(message);
    this.name = "SessionError";
  }
}

export type SessionErrorCode =
  | "TOKEN_EXPIRED"
  | "TOKEN_INVALID"
  | "TOKEN_REVOKED"
  | "SESSION_NOT_FOUND"
  | "SESSION_EXPIRED"
  | "SESSION_REVOKED"
  | "MAX_SESSIONS_EXCEEDED"
  | "REFRESH_FAILED"
  | "USER_NOT_FOUND";
