/**
 * Platform API Router
 *
 * Main router that mounts all platform API routes under /api/platform.
 * Follows the gateway's handler pattern: returns true if request was handled.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { createRequestContext, type RequestContext } from "./middleware/context.js";
import { handleError, sendError } from "./middleware/errors.js";
import { handleHealth } from "./routes/health.js";
import { handleOrg } from "./routes/org.js";
import { handleUsers } from "./routes/users.js";
import { handleInvitations } from "./routes/invitations.js";
import { handlePermissions } from "./routes/permissions.js";
import { handleAudit } from "./routes/audit.js";
import { handleAuth } from "./routes/auth.js";

/**
 * Platform API base path
 */
export const PLATFORM_API_BASE_PATH = "/api/platform";

/**
 * Route definition
 */
interface Route {
  /** Path pattern (relative to base path, e.g., "/health") */
  pattern: string;
  /** Handler function */
  handler: (req: IncomingMessage, res: ServerResponse, ctx: RequestContext) => Promise<void>;
}

/**
 * Platform API routes
 */
const routes: Route[] = [
  { pattern: "/health", handler: handleHealth },
  { pattern: "/org", handler: handleOrg },
  { pattern: "/users", handler: handleUsers },
  { pattern: "/invitations", handler: handleInvitations },
  { pattern: "/permissions", handler: handlePermissions },
  { pattern: "/audit", handler: handleAudit },
  { pattern: "/auth", handler: handleAuth },
];

/**
 * Match request path against route patterns
 * Returns the matched route and any path parameters
 */
function matchRoute(
  path: string,
): { route: Route; params: Record<string, string> } | null {
  // Remove base path prefix
  if (!path.startsWith(PLATFORM_API_BASE_PATH)) {
    return null;
  }
  const subPath = path.slice(PLATFORM_API_BASE_PATH.length) || "/";

  // Try exact matches first
  for (const route of routes) {
    if (subPath === route.pattern) {
      return { route, params: {} };
    }
  }

  // Try prefix matches for nested routes (e.g., /users/123)
  for (const route of routes) {
    if (subPath.startsWith(route.pattern + "/") || subPath === route.pattern) {
      return { route, params: {} };
    }
  }

  return null;
}

/**
 * Add CORS headers for platform API
 */
function addCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*"); // TODO: Configure allowed origins
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-Id, X-Tenant-Id");
  res.setHeader("Access-Control-Max-Age", "86400");
}

/**
 * Handle platform API preflight requests
 */
function handlePreflight(res: ServerResponse): void {
  addCorsHeaders(res);
  res.statusCode = 204;
  res.end();
}

/**
 * Create the platform API request handler
 *
 * This follows the gateway's handler pattern where the function returns
 * true if it handled the request, false otherwise.
 */
export function createPlatformApiHandler(opts: {
  trustedProxies?: string[];
} = {}): (req: IncomingMessage, res: ServerResponse) => Promise<boolean> {
  return async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    // Check if this is a platform API request
    if (!url.pathname.startsWith(PLATFORM_API_BASE_PATH)) {
      return false;
    }

    // Add CORS headers to all platform API responses
    addCorsHeaders(res);

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      handlePreflight(res);
      return true;
    }

    // Create request context
    const ctx = createRequestContext(req, { trustedProxies: opts.trustedProxies });

    // Add request ID to response headers for tracing
    res.setHeader("X-Request-Id", ctx.requestId);

    // Find matching route
    const match = matchRoute(url.pathname);
    if (!match) {
      sendError(res, "NOT_FOUND", `No route found for ${url.pathname}`);
      return true;
    }

    // Execute route handler with error handling
    try {
      await match.route.handler(req, res, ctx);
    } catch (error) {
      handleError(res, error);
    }

    return true;
  };
}

/**
 * Re-export types and utilities for external use
 */
export type { RequestContext } from "./middleware/context.js";
export type { PlatformErrorCode, PlatformErrorResponse } from "./middleware/errors.js";
export { PlatformError, sendError } from "./middleware/errors.js";
