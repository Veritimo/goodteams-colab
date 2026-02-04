/**
 * Session utilities for auth routes
 *
 * Helpers for setting/clearing session cookies after OAuth callbacks.
 * Works with Node.js IncomingMessage/ServerResponse (not Hono).
 */

import type { ServerResponse } from "node:http";
import type { TokenPair } from "../../session/types.js";
import {
  createSession,
  revokeSession,
  revokeAllUserSessions,
  getSessionConfig,
} from "../../session/service.js";

// Cookie names
export const ACCESS_TOKEN_COOKIE = "gt_access";
export const REFRESH_TOKEN_COOKIE = "gt_refresh";

/**
 * Create a session for a user and set cookies on the response
 */
export async function createSessionAndSetCookies(
  res: ServerResponse,
  userId: string,
  options: {
    organizationId?: string | null;
    userAgent?: string;
    ipAddress?: string;
  } = {},
): Promise<TokenPair> {
  const tokens = await createSession({
    userId,
    organizationId: options.organizationId,
    userAgent: options.userAgent,
    ipAddress: options.ipAddress,
  });

  setSessionCookies(res, tokens);
  return tokens;
}

/**
 * Set session cookies on the response
 */
export function setSessionCookies(res: ServerResponse, tokens: TokenPair): void {
  const isProduction = process.env.NODE_ENV === "production";
  const secure = isProduction ? "; Secure" : "";
  const sameSite = "; SameSite=Lax";
  const path = "; Path=/";
  const httpOnly = "; HttpOnly";

  // Calculate max-age in seconds
  const accessMaxAge = Math.floor((tokens.accessTokenExpiresAt - Date.now()) / 1000);
  const refreshMaxAge = Math.floor((tokens.refreshTokenExpiresAt - Date.now()) / 1000);

  // Get existing cookies
  const existingCookies = res.getHeader("Set-Cookie") as string | string[] | undefined;
  const cookies: string[] = existingCookies
    ? Array.isArray(existingCookies)
      ? existingCookies
      : [existingCookies]
    : [];

  // Add access token cookie
  cookies.push(
    `${ACCESS_TOKEN_COOKIE}=${tokens.accessToken}${httpOnly}${secure}${sameSite}${path}; Max-Age=${accessMaxAge}`,
  );

  // Add refresh token cookie
  cookies.push(
    `${REFRESH_TOKEN_COOKIE}=${tokens.refreshToken}${httpOnly}${secure}${sameSite}${path}; Max-Age=${refreshMaxAge}`,
  );

  res.setHeader("Set-Cookie", cookies);
}

/**
 * Clear session cookies
 */
export function clearSessionCookies(res: ServerResponse): void {
  const isProduction = process.env.NODE_ENV === "production";
  const secure = isProduction ? "; Secure" : "";
  const sameSite = "; SameSite=Lax";
  const path = "; Path=/";
  const httpOnly = "; HttpOnly";

  const existingCookies = res.getHeader("Set-Cookie") as string | string[] | undefined;
  const cookies: string[] = existingCookies
    ? Array.isArray(existingCookies)
      ? existingCookies
      : [existingCookies]
    : [];

  // Clear cookies by setting Max-Age=0
  cookies.push(`${ACCESS_TOKEN_COOKIE}=${httpOnly}${secure}${sameSite}${path}; Max-Age=0`);
  cookies.push(`${REFRESH_TOKEN_COOKIE}=${httpOnly}${secure}${sameSite}${path}; Max-Age=0`);

  res.setHeader("Set-Cookie", cookies);
}

/**
 * Extract refresh token from cookie header
 */
export function extractRefreshToken(cookies: string | undefined): string | null {
  if (!cookies) return null;
  const match = cookies.match(new RegExp(`${REFRESH_TOKEN_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

/**
 * Revoke session and clear cookies
 */
export async function revokeSessionAndClearCookies(
  res: ServerResponse,
  sessionId: string,
  reason?: string,
): Promise<void> {
  await revokeSession(sessionId, reason);
  clearSessionCookies(res);
}

/**
 * Revoke all user sessions and clear cookies
 */
export async function revokeAllSessionsAndClearCookies(
  res: ServerResponse,
  userId: string,
  reason?: string,
): Promise<number> {
  const count = await revokeAllUserSessions(userId, reason);
  clearSessionCookies(res);
  return count;
}
