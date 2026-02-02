/**
 * Audit Context Helper
 *
 * Extracts audit context from HTTP requests for logging.
 * Provides utilities to bridge between request handling and audit logging.
 */

import type { IncomingMessage } from "node:http";
import type { RequestContext, RequestUser } from "../api/middleware/context.js";
import type { UserRole } from "@prisma/client";
import type { AuditContext } from "./logger.js";

/**
 * Map request user role to Prisma UserRole enum
 * Handles the difference between API role strings and database enum
 */
function mapRole(role: RequestUser["role"]): UserRole {
  const roleMap: Record<RequestUser["role"], UserRole> = {
    owner: "ADMIN", // Owner maps to ADMIN for audit purposes
    admin: "ADMIN",
    member: "USER",
    viewer: "VIEWER",
  };
  return roleMap[role];
}

/**
 * Create audit context from HTTP request and request context
 *
 * @param req - The incoming HTTP request
 * @param ctx - The request context with user info
 * @returns AuditContext if user is authenticated, null otherwise
 */
export function createAuditContext(
  req: IncomingMessage,
  ctx: RequestContext,
): AuditContext | null {
  // Cannot create audit context without authenticated user
  if (!ctx.user) {
    return null;
  }

  const userAgent = req.headers["user-agent"] ?? undefined;

  return {
    user: {
      id: ctx.user.id,
      role: mapRole(ctx.user.role),
      organizationId: ctx.user.orgId,
    },
    ip: ctx.ip,
    userAgent,
    requestId: ctx.requestId,
  };
}

/**
 * Create audit context directly from user data
 * Useful when not in HTTP request context (e.g., background jobs)
 *
 * @param user - User data
 * @param options - Additional context options
 */
export function createAuditContextFromUser(
  user: {
    id: string;
    role: UserRole;
    organizationId: string;
  },
  options?: {
    ip?: string;
    userAgent?: string;
    requestId?: string;
    sessionId?: string;
  },
): AuditContext {
  return {
    user,
    ip: options?.ip,
    userAgent: options?.userAgent,
    requestId: options?.requestId,
    sessionId: options?.sessionId,
  };
}

/**
 * Extract forwarded IP address from request headers
 * Handles common proxy headers
 *
 * @param req - The incoming HTTP request
 * @param trustedProxies - List of trusted proxy IPs
 * @returns The client IP address
 */
export function extractClientIp(
  req: IncomingMessage,
  trustedProxies: string[] = [],
): string {
  // Check X-Forwarded-For header
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) {
    const ips = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)
      .split(",")
      .map((s) => s.trim());

    // If we have trusted proxies, return the first non-trusted IP
    if (trustedProxies.length > 0) {
      for (const ip of ips) {
        if (!trustedProxies.includes(ip)) {
          return ip;
        }
      }
    }

    // Otherwise return the first IP
    if (ips[0]) {
      return ips[0];
    }
  }

  // Check X-Real-IP header (used by some proxies)
  const realIp = req.headers["x-real-ip"];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  // Fall back to socket remote address
  return req.socket.remoteAddress ?? "unknown";
}

/**
 * Sanitize user agent string for storage
 * Truncates long user agents and removes potentially sensitive data
 *
 * @param userAgent - The raw user agent string
 * @param maxLength - Maximum length to store
 * @returns Sanitized user agent string
 */
export function sanitizeUserAgent(userAgent: string | undefined, maxLength = 500): string | undefined {
  if (!userAgent) {
    return undefined;
  }

  // Truncate if too long
  if (userAgent.length > maxLength) {
    return userAgent.slice(0, maxLength) + "...";
  }

  return userAgent;
}

/**
 * Type guard to check if audit context is available
 */
export function hasAuditContext(ctx: AuditContext | null): ctx is AuditContext {
  return ctx !== null && ctx.user !== null;
}
