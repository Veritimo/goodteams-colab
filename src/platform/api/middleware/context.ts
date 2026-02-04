/**
 * Request context middleware for platform API
 *
 * Extracts user identity, tenant context, and adds request tracing.
 * Supports both JWT authentication and legacy stub tokens for backward compatibility.
 */

import type { IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";
import { verifyAccessToken, JwtError } from "../../session/jwt.js";

/**
 * User identity extracted from JWT
 */
export interface RequestUser {
  id: string;
  email: string;
  name: string;
  orgId: string;
  role: "owner" | "admin" | "member" | "viewer";
  /** Explicit permissions granted to this user */
  permissions?: string[];
}

/**
 * Tenant context for multi-tenancy
 */
export interface TenantContext {
  tenantId: string;
  orgId: string;
}

/**
 * Full request context available to route handlers
 */
export interface RequestContext {
  requestId: string;
  timestamp: Date;
  user: RequestUser | null;
  tenant: TenantContext | null;
  ip: string;
  /** Whether the access token is expired (client should refresh) */
  tokenExpired?: boolean;
}

/**
 * Extract client IP from request, respecting X-Forwarded-For for proxied requests
 */
function extractClientIp(req: IncomingMessage, trustedProxies: string[] = []): string {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor && trustedProxies.length > 0) {
    const ips = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor).split(",");
    // Return the first non-proxy IP
    for (const ip of ips.map((s) => s.trim())) {
      if (!trustedProxies.includes(ip)) {
        return ip;
      }
    }
  }
  return req.socket.remoteAddress ?? "unknown";
}

/**
 * Extract JWT from Authorization header or cookies
 */
function extractJwt(req: IncomingMessage): string | null {
  // Try Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Try cookie (gt_access)
  const cookies = req.headers.cookie;
  if (cookies) {
    const match = cookies.match(/gt_access=([^;]+)/);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Map UserRole enum to legacy role format
 */
function mapRole(role: string): RequestUser["role"] {
  switch (role.toUpperCase()) {
    case "SUPER_ADMIN":
      return "owner";
    case "ADMIN":
      return "admin";
    case "USER":
      return "member";
    case "BILLING":
      return "viewer";
    case "VIEWER":
      return "viewer";
    default:
      return "viewer";
  }
}

/**
 * Verify and decode JWT token
 *
 * Supports:
 * 1. Proper JWTs signed with JWT_SECRET (new system)
 * 2. Legacy stub tokens for backward compatibility (stub:base64...)
 */
async function verifyJwt(token: string): Promise<{ user: RequestUser | null; expired: boolean }> {
  // Handle legacy stub format for backward compatibility
  if (token.startsWith("stub:")) {
    try {
      const jsonPart = token.slice(5);
      const decoded = Buffer.from(jsonPart, "base64").toString("utf8");
      const payload = JSON.parse(decoded) as Partial<RequestUser>;

      if (
        typeof payload.id !== "string" ||
        typeof payload.email !== "string" ||
        typeof payload.orgId !== "string" ||
        typeof payload.role !== "string"
      ) {
        return { user: null, expired: false };
      }

      return {
        user: {
          id: payload.id,
          email: payload.email,
          name: payload.name ?? payload.email.split("@")[0],
          orgId: payload.orgId,
          role: payload.role as RequestUser["role"],
          permissions: payload.permissions ?? [],
        },
        expired: false,
      };
    } catch {
      return { user: null, expired: false };
    }
  }

  // Verify proper JWT
  try {
    const payload = await verifyAccessToken(token);
    return {
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.email.split("@")[0],
        orgId: payload.orgId ?? "",
        role: mapRole(payload.role),
        permissions: [],
      },
      expired: false,
    };
  } catch (error) {
    if (error instanceof JwtError && error.code === "EXPIRED") {
      return { user: null, expired: true };
    }
    return { user: null, expired: false };
  }
}

/**
 * Extract tenant context from request
 *
 * STUB: Returns null for Phase 1. Full tenant resolution in Phase 3.
 */
function extractTenantContext(
  _req: IncomingMessage,
  _user: RequestUser | null,
): TenantContext | null {
  // TODO Phase 3: Implement tenant resolution
  // - From subdomain (tenant.goodteams.ai)
  // - From X-Tenant-Id header
  // - From user's default org
  return null;
}

/**
 * Create request context from incoming HTTP request
 *
 * Note: This is async to support JWT verification.
 * For performance, consider caching verified tokens.
 */
export async function createRequestContext(
  req: IncomingMessage,
  opts: { trustedProxies?: string[] } = {},
): Promise<RequestContext> {
  const requestId = (req.headers["x-request-id"] as string) ?? randomUUID();
  const jwt = extractJwt(req);
  const { user, expired } = jwt ? await verifyJwt(jwt) : { user: null, expired: false };
  const tenant = extractTenantContext(req, user);
  const ip = extractClientIp(req, opts.trustedProxies);

  return {
    requestId,
    timestamp: new Date(),
    user,
    tenant,
    ip,
    tokenExpired: expired,
  };
}

/**
 * Type guard to check if user is authenticated
 */
export function isAuthenticated(
  ctx: RequestContext,
): ctx is RequestContext & { user: RequestUser } {
  return ctx.user !== null;
}

/**
 * Type guard to check if tenant context is available
 */
export function hasTenantContext(
  ctx: RequestContext,
): ctx is RequestContext & { tenant: TenantContext } {
  return ctx.tenant !== null;
}
