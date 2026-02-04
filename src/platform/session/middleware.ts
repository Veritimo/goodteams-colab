/**
 * Session Middleware
 *
 * Express/Hono middleware for authenticating requests via JWT.
 */

import type { Context, Next, MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { AuthenticatedUser } from "./types.js";
import { verifyAccessToken, JwtError, isTokenExpired } from "./jwt.js";
import { refreshSession } from "./service.js";
import { SessionError } from "./types.js";

// =============================================================================
// CONSTANTS
// =============================================================================

export const ACCESS_TOKEN_COOKIE = "gt_access";
export const REFRESH_TOKEN_COOKIE = "gt_refresh";

/** Cookie options for secure session management */
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

// =============================================================================
// CONTEXT HELPERS
// =============================================================================

/** Key for storing user in Hono context */
const USER_CONTEXT_KEY = "user";

/**
 * Get authenticated user from request context
 */
export function getUser(c: Context): AuthenticatedUser | undefined {
  return c.get(USER_CONTEXT_KEY);
}

/**
 * Get authenticated user or throw
 */
export function requireUser(c: Context): AuthenticatedUser {
  const user = getUser(c);
  if (!user) {
    throw new SessionError("Authentication required", "TOKEN_INVALID", 401);
  }
  return user;
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Authentication middleware
 *
 * Validates JWT from cookie or Authorization header.
 * Automatically refreshes expired access tokens if refresh token is valid.
 *
 * Options:
 * - required: If true, returns 401 for unauthenticated requests
 * - autoRefresh: If true, attempts to refresh expired access tokens
 */
export function authMiddleware(options?: {
  required?: boolean;
  autoRefresh?: boolean;
}): MiddlewareHandler {
  const { required = false, autoRefresh = true } = options ?? {};

  return async (c: Context, next: Next) => {
    try {
      // Try to get access token from cookie or header
      let accessToken = getCookie(c, ACCESS_TOKEN_COOKIE);

      // Also check Authorization header (for API clients)
      if (!accessToken) {
        const authHeader = c.req.header("Authorization");
        if (authHeader?.startsWith("Bearer ")) {
          accessToken = authHeader.slice(7);
        }
      }

      // No token at all
      if (!accessToken) {
        if (required) {
          return c.json({ error: "Authentication required" }, 401);
        }
        return next();
      }

      // Check if token is expired before full verification
      if (isTokenExpired(accessToken) && autoRefresh) {
        // Try to refresh
        const refreshToken = getCookie(c, REFRESH_TOKEN_COOKIE);
        if (refreshToken) {
          try {
            const tokens = await refreshSession(refreshToken, {
              userAgent: c.req.header("User-Agent"),
              ipAddress: getClientIp(c),
            });

            // Set new cookies
            setSessionCookies(c, tokens.accessToken, tokens.refreshToken, {
              accessMaxAge: Math.floor((tokens.accessTokenExpiresAt - Date.now()) / 1000),
              refreshMaxAge: Math.floor((tokens.refreshTokenExpiresAt - Date.now()) / 1000),
            });

            // Use new access token
            accessToken = tokens.accessToken;
          } catch (error) {
            // Refresh failed - clear cookies and require re-auth
            clearSessionCookies(c);
            if (required) {
              return c.json(
                {
                  error: "Session expired, please login again",
                  code: "SESSION_EXPIRED",
                },
                401,
              );
            }
            return next();
          }
        } else {
          // No refresh token, access token expired
          clearSessionCookies(c);
          if (required) {
            return c.json(
              {
                error: "Session expired, please login again",
                code: "SESSION_EXPIRED",
              },
              401,
            );
          }
          return next();
        }
      }

      // Verify access token
      const payload = await verifyAccessToken(accessToken);

      // Set user in context
      const user: AuthenticatedUser = {
        id: payload.sub,
        email: payload.email,
        organizationId: payload.orgId,
        role: payload.role,
      };

      c.set(USER_CONTEXT_KEY, user);

      return next();
    } catch (error) {
      // Handle JWT errors
      if (error instanceof JwtError) {
        clearSessionCookies(c);
        if (required) {
          return c.json(
            {
              error: error.code === "EXPIRED" ? "Token expired" : "Invalid token",
              code: error.code,
            },
            401,
          );
        }
        return next();
      }

      // Handle session errors
      if (error instanceof SessionError) {
        if (required) {
          return c.json(
            { error: error.message, code: error.code },
            error.statusCode as 401 | 403 | 404,
          );
        }
        return next();
      }

      // Unexpected error
      console.error("Auth middleware error:", error);
      if (required) {
        return c.json({ error: "Authentication failed" }, 401);
      }
      return next();
    }
  };
}

/**
 * Require authentication middleware (convenience wrapper)
 */
export const requireAuth = authMiddleware({ required: true });

/**
 * Optional authentication middleware (convenience wrapper)
 */
export const optionalAuth = authMiddleware({ required: false });

// =============================================================================
// COOKIE HELPERS
// =============================================================================

/**
 * Set session cookies after login or refresh
 */
export function setSessionCookies(
  c: Context,
  accessToken: string,
  refreshToken: string,
  options?: {
    accessMaxAge?: number;
    refreshMaxAge?: number;
  },
): void {
  const { accessMaxAge = 15 * 60, refreshMaxAge = 14 * 24 * 60 * 60 } = options ?? {};

  setCookie(c, ACCESS_TOKEN_COOKIE, accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: accessMaxAge,
  });

  setCookie(c, REFRESH_TOKEN_COOKIE, refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: refreshMaxAge,
  });
}

/**
 * Clear session cookies (logout)
 */
export function clearSessionCookies(c: Context): void {
  deleteCookie(c, ACCESS_TOKEN_COOKIE, { path: "/" });
  deleteCookie(c, REFRESH_TOKEN_COOKIE, { path: "/" });
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Extract client IP from request
 */
function getClientIp(c: Context): string | undefined {
  // Check common proxy headers
  const forwarded = c.req.header("X-Forwarded-For");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = c.req.header("X-Real-IP");
  if (realIp) {
    return realIp;
  }

  // Fallback to connection info (may not be available in all environments)
  return undefined;
}

/**
 * Check if user has required role
 */
export function hasRole(
  user: AuthenticatedUser | undefined,
  ...roles: AuthenticatedUser["role"][]
): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}

/**
 * Check if user is admin (ADMIN or SUPER_ADMIN)
 */
export function isAdmin(user: AuthenticatedUser | undefined): boolean {
  return hasRole(user, "ADMIN", "SUPER_ADMIN");
}

/**
 * Check if user belongs to organization
 */
export function isInOrganization(
  user: AuthenticatedUser | undefined,
  organizationId: string,
): boolean {
  if (!user) return false;
  return user.organizationId === organizationId;
}
