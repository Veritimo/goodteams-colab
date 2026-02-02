/**
 * Request context middleware for platform API
 *
 * Extracts user identity, tenant context, and adds request tracing.
 * JWT verification is stubbed for Phase 1; full implementation in Phase 2.
 */

import type { IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";

/**
 * User identity extracted from JWT
 */
export interface RequestUser {
  id: string;
  email: string;
  name: string;
  orgId: string;
  role: "owner" | "admin" | "member" | "viewer";
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
 * Extract JWT from Authorization header
 */
function extractJwt(req: IncomingMessage): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Verify and decode JWT token
 *
 * STUB: Returns null for Phase 1. Full JWT verification will be implemented in Phase 2.
 */
function verifyJwt(_token: string): RequestUser | null {
  // TODO Phase 2: Implement JWT verification with Entra SSO
  // - Verify signature against Entra public keys
  // - Check expiration and audience
  // - Extract user claims
  return null;
}

/**
 * Extract tenant context from request
 *
 * STUB: Returns null for Phase 1. Full tenant resolution in Phase 3.
 */
function extractTenantContext(_req: IncomingMessage, _user: RequestUser | null): TenantContext | null {
  // TODO Phase 3: Implement tenant resolution
  // - From subdomain (tenant.goodteams.ai)
  // - From X-Tenant-Id header
  // - From user's default org
  return null;
}

/**
 * Create request context from incoming HTTP request
 */
export function createRequestContext(
  req: IncomingMessage,
  opts: { trustedProxies?: string[] } = {},
): RequestContext {
  const requestId = (req.headers["x-request-id"] as string) ?? randomUUID();
  const jwt = extractJwt(req);
  const user = jwt ? verifyJwt(jwt) : null;
  const tenant = extractTenantContext(req, user);
  const ip = extractClientIp(req, opts.trustedProxies);

  return {
    requestId,
    timestamp: new Date(),
    user,
    tenant,
    ip,
  };
}

/**
 * Type guard to check if user is authenticated
 */
export function isAuthenticated(ctx: RequestContext): ctx is RequestContext & { user: RequestUser } {
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
