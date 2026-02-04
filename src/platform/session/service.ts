/**
 * Session Service
 *
 * Manages user sessions with JWT access tokens and refresh token rotation.
 */

import { prisma } from "../db/index.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  JwtError,
} from "./jwt.js";
import {
  SessionError,
  DEFAULT_SESSION_CONFIG,
  type SessionConfig,
  type CreateSessionInput,
  type TokenPair,
  type SessionInfo,
  type AccessTokenPayload,
} from "./types.js";

// =============================================================================
// SESSION CONFIG
// =============================================================================

/**
 * Get session configuration for an organization (or defaults)
 */
export async function getSessionConfig(organizationId?: string | null): Promise<SessionConfig> {
  if (!organizationId) {
    return DEFAULT_SESSION_CONFIG;
  }

  const config = await prisma.tenantConfig.findUnique({
    where: { organizationId },
    select: {
      sessionAccessTokenTtlMinutes: true,
      sessionRefreshTokenTtlDays: true,
      sessionAbsoluteMaxDays: true,
      sessionSlidingWindow: true,
      sessionMaxConcurrent: true,
    },
  });

  if (!config) {
    return DEFAULT_SESSION_CONFIG;
  }

  return {
    accessTokenTtlMinutes: config.sessionAccessTokenTtlMinutes,
    refreshTokenTtlDays: config.sessionRefreshTokenTtlDays,
    absoluteMaxDays: config.sessionAbsoluteMaxDays,
    slidingWindow: config.sessionSlidingWindow,
    maxConcurrent: config.sessionMaxConcurrent,
  };
}

// =============================================================================
// SESSION CREATION
// =============================================================================

/**
 * Create a new session and return token pair
 */
export async function createSession(input: CreateSessionInput): Promise<TokenPair> {
  // Get user with org info
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      email: true,
      role: true,
      organizationId: true,
    },
  });

  if (!user) {
    throw new SessionError("User not found", "USER_NOT_FOUND", 404);
  }

  // Get session config (org-specific or defaults)
  const config = await getSessionConfig(input.organizationId ?? user.organizationId);

  // Check concurrent session limit
  const activeSessions = await prisma.session.count({
    where: {
      userId: input.userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (activeSessions >= config.maxConcurrent) {
    // Revoke oldest session to make room
    const oldestSession = await prisma.session.findFirst({
      where: {
        userId: input.userId,
        revokedAt: null,
      },
      orderBy: { createdAt: "asc" },
    });

    if (oldestSession) {
      await prisma.session.update({
        where: { id: oldestSession.id },
        data: {
          revokedAt: new Date(),
          revokedReason: "max_sessions_exceeded",
        },
      });
    }
  }

  // Calculate expiry times
  const now = new Date();
  const refreshExpiresAt = new Date(
    now.getTime() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  );
  const absoluteExpiresAt = new Date(now.getTime() + config.absoluteMaxDays * 24 * 60 * 60 * 1000);
  const accessExpiresAt = new Date(now.getTime() + config.accessTokenTtlMinutes * 60 * 1000);

  // Create session record first to get ID
  const session = await prisma.session.create({
    data: {
      userId: input.userId,
      refreshTokenHash: "pending", // Will update after signing
      expiresAt: refreshExpiresAt,
      absoluteExpiresAt,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    },
  });

  // Sign tokens
  const accessTokenPayload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    orgId: user.organizationId,
    role: user.role,
    type: "access",
  };

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(accessTokenPayload, config.accessTokenTtlMinutes),
    signRefreshToken(
      { sid: session.id, sub: user.id, type: "refresh" },
      config.refreshTokenTtlDays,
    ),
  ]);

  // Store refresh token hash
  const refreshTokenHash = await hashToken(refreshToken);
  await prisma.session.update({
    where: { id: session.id },
    data: { refreshTokenHash },
  });

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: accessExpiresAt.getTime(),
    refreshTokenExpiresAt: refreshExpiresAt.getTime(),
  };
}

// =============================================================================
// TOKEN REFRESH
// =============================================================================

/**
 * Refresh tokens using a valid refresh token
 * Implements token rotation (old refresh token invalidated)
 */
export async function refreshSession(
  refreshToken: string,
  metadata?: { userAgent?: string; ipAddress?: string },
): Promise<TokenPair> {
  // Verify refresh token structure
  let payload;
  try {
    payload = await verifyRefreshToken(refreshToken);
  } catch (error) {
    if (error instanceof JwtError) {
      throw new SessionError(
        error.code === "EXPIRED" ? "Refresh token expired" : "Invalid refresh token",
        error.code === "EXPIRED" ? "TOKEN_EXPIRED" : "TOKEN_INVALID",
      );
    }
    throw error;
  }

  // Find session by ID
  const session = await prisma.session.findUnique({
    where: { id: payload.sid },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          organizationId: true,
        },
      },
    },
  });

  if (!session) {
    throw new SessionError("Session not found", "SESSION_NOT_FOUND");
  }

  // Verify token hash matches
  const tokenHash = await hashToken(refreshToken);
  if (session.refreshTokenHash !== tokenHash) {
    // Token reuse detected - possible token theft
    // Revoke the session as a security measure
    await prisma.session.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(),
        revokedReason: "token_reuse_detected",
      },
    });
    throw new SessionError("Invalid refresh token (possible reuse)", "TOKEN_INVALID");
  }

  // Check if session is revoked
  if (session.revokedAt) {
    throw new SessionError(
      `Session revoked: ${session.revokedReason || "unknown"}`,
      "SESSION_REVOKED",
    );
  }

  // Check expiry
  const now = new Date();
  if (session.expiresAt < now) {
    throw new SessionError("Session expired", "SESSION_EXPIRED");
  }

  // Check absolute expiry
  if (session.absoluteExpiresAt < now) {
    throw new SessionError("Session reached maximum lifetime", "SESSION_EXPIRED");
  }

  // Get session config
  const config = await getSessionConfig(session.user.organizationId);

  // Calculate new expiry (sliding window or fixed)
  let newRefreshExpiresAt: Date;
  if (config.slidingWindow) {
    // Extend from now, but not past absolute max
    const slidingExpiry = new Date(
      now.getTime() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    );
    newRefreshExpiresAt =
      slidingExpiry < session.absoluteExpiresAt ? slidingExpiry : session.absoluteExpiresAt;
  } else {
    // Keep original expiry
    newRefreshExpiresAt = session.expiresAt;
  }

  const accessExpiresAt = new Date(now.getTime() + config.accessTokenTtlMinutes * 60 * 1000);

  // Sign new tokens
  const accessTokenPayload: AccessTokenPayload = {
    sub: session.user.id,
    email: session.user.email,
    orgId: session.user.organizationId,
    role: session.user.role,
    type: "access",
  };

  const [newAccessToken, newRefreshToken] = await Promise.all([
    signAccessToken(accessTokenPayload, config.accessTokenTtlMinutes),
    signRefreshToken(
      { sid: session.id, sub: session.user.id, type: "refresh" },
      config.refreshTokenTtlDays,
    ),
  ]);

  // Rotate refresh token (update hash)
  const newRefreshTokenHash = await hashToken(newRefreshToken);
  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: newRefreshTokenHash,
      expiresAt: newRefreshExpiresAt,
      lastUsedAt: now,
      userAgent: metadata?.userAgent ?? session.userAgent,
      ipAddress: metadata?.ipAddress ?? session.ipAddress,
    },
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    accessTokenExpiresAt: accessExpiresAt.getTime(),
    refreshTokenExpiresAt: newRefreshExpiresAt.getTime(),
  };
}

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

/**
 * Revoke a specific session
 */
export async function revokeSession(sessionId: string, reason?: string): Promise<void> {
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      revokedAt: new Date(),
      revokedReason: reason ?? "user_logout",
    },
  });
}

/**
 * Revoke all sessions for a user
 */
export async function revokeAllUserSessions(userId: string, reason?: string): Promise<number> {
  const result = await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      revokedReason: reason ?? "logout_all",
    },
  });

  return result.count;
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string): Promise<SessionInfo[]> {
  const sessions = await prisma.session.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastUsedAt: "desc" },
  });

  return sessions.map((s) => ({
    id: s.id,
    userId: s.userId,
    createdAt: s.createdAt,
    lastUsedAt: s.lastUsedAt,
    expiresAt: s.expiresAt,
    absoluteExpiresAt: s.absoluteExpiresAt,
    userAgent: s.userAgent,
    ipAddress: s.ipAddress,
    isRevoked: s.revokedAt !== null,
  }));
}

/**
 * Get session by ID
 */
export async function getSession(sessionId: string): Promise<SessionInfo | null> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) return null;

  return {
    id: session.id,
    userId: session.userId,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    expiresAt: session.expiresAt,
    absoluteExpiresAt: session.absoluteExpiresAt,
    userAgent: session.userAgent,
    ipAddress: session.ipAddress,
    isRevoked: session.revokedAt !== null,
  };
}

// =============================================================================
// CLEANUP
// =============================================================================

/**
 * Clean up expired sessions (run periodically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  // Delete sessions that are both expired AND older than 30 days
  // (Keep recent expired sessions for audit purposes)
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await prisma.session.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: cutoff } },
        { absoluteExpiresAt: { lt: cutoff } },
        {
          revokedAt: { lt: cutoff },
        },
      ],
    },
  });

  return result.count;
}
