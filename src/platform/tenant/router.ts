/**
 * Tenant Router
 *
 * Routes requests to correct tenant gateway.
 * Identifies tenant from:
 * 1. JWT token (organizationId claim)
 * 2. X-Tenant-ID header (for internal calls)
 * 3. Subdomain (tenant.goodteams.ai)
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";
import { type GatewayStatus } from "@prisma/client";
import { createProxyMiddleware, type Options } from "http-proxy-middleware";
import { prisma } from "../db/client.js";

/**
 * Tenant context attached to requests after resolution
 */
export interface TenantContext {
  organizationId: string;
  gatewayPort: number;
  gatewayStatus: GatewayStatus;
}

/**
 * Extended request with tenant context
 */
export interface TenantRequest extends Request {
  tenant?: TenantContext;
  user?: {
    organizationId?: string;
    [key: string]: unknown;
  };
}

/**
 * Header name for internal tenant identification
 */
export const TENANT_ID_HEADER = "x-tenant-id";

/**
 * Healthy gateway statuses that can receive requests
 */
const HEALTHY_STATUSES: GatewayStatus[] = ["HEALTHY", "STARTING"];

/**
 * Extract subdomain from host header
 *
 * Parses tenant slug from:
 * - tenant.goodteams.ai
 * - tenant.localhost:3000
 * - tenant.staging.goodteams.ai
 *
 * @param host - Host header value
 * @returns Subdomain/tenant slug or null if not found
 */
export function extractSubdomain(host: string): string | null {
  if (!host) return null;

  // Remove port if present
  const hostWithoutPort = host.split(":")[0];

  // Pattern: subdomain.domain.tld or subdomain.localhost
  // Match alphanumeric with hyphens, followed by a dot and known domains
  const match = hostWithoutPort.match(
    /^([a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9])\.(goodteams\.ai|localhost|staging\.goodteams\.ai)$/i,
  );

  if (!match) return null;

  const subdomain = match[1].toLowerCase();

  // Exclude common non-tenant subdomains
  const reserved = ["www", "api", "app", "admin", "staging", "dev", "test"];
  if (reserved.includes(subdomain)) return null;

  return subdomain;
}

/**
 * Get organization ID by slug
 *
 * Looks up organization by name (used as slug for now).
 * Note: Consider adding a dedicated 'slug' field to Organization model.
 *
 * @param slug - Tenant slug/subdomain
 * @returns Organization ID or null if not found
 */
export async function getOrganizationBySlug(slug: string): Promise<string | null> {
  // Query by name normalized to lowercase (slug-like comparison)
  // Note: For production, add a proper 'slug' field to Organization model
  const org = await prisma.organization.findFirst({
    where: {
      name: {
        equals: slug,
        mode: "insensitive",
      },
      status: "ACTIVE",
    },
    select: { id: true },
  });

  return org?.id ?? null;
}

/**
 * Get tenant gateway information
 *
 * @param organizationId - Organization ID
 * @returns Gateway info or null if not found/unhealthy
 */
export async function getTenantGateway(
  organizationId: string,
): Promise<{ port: number; status: GatewayStatus } | null> {
  const gateway = await prisma.tenantGateway.findUnique({
    where: { organizationId },
    select: { port: true, status: true },
  });

  if (!gateway) return null;

  // Only return gateway if status allows requests
  if (!HEALTHY_STATUSES.includes(gateway.status)) {
    return null;
  }

  return { port: gateway.port, status: gateway.status };
}

/**
 * Resolve tenant from request
 *
 * Resolution order:
 * 1. JWT token (req.user.organizationId from auth middleware)
 * 2. X-Tenant-ID header (for internal/service calls)
 * 3. Subdomain extraction (tenant.goodteams.ai)
 *
 * @param req - Express request
 * @returns TenantContext or null if tenant cannot be resolved
 */
export async function resolveTenant(req: TenantRequest): Promise<TenantContext | null> {
  let organizationId: string | null = null;

  // 1. Try JWT token (from req.user set by auth middleware)
  if (req.user?.organizationId && typeof req.user.organizationId === "string") {
    organizationId = req.user.organizationId;
  }

  // 2. Try X-Tenant-ID header (for internal calls)
  if (!organizationId) {
    const headerValue = req.get(TENANT_ID_HEADER);
    if (headerValue && typeof headerValue === "string") {
      // Validate it's a valid UUID format
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(headerValue)) {
        organizationId = headerValue;
      }
    }
  }

  // 3. Try subdomain extraction
  if (!organizationId) {
    const host = req.get("host");
    if (host) {
      const subdomain = extractSubdomain(host);
      if (subdomain) {
        organizationId = await getOrganizationBySlug(subdomain);
      }
    }
  }

  // No tenant identified
  if (!organizationId) {
    return null;
  }

  // Verify organization exists and has a healthy gateway
  const gateway = await getTenantGateway(organizationId);
  if (!gateway) {
    return null;
  }

  return {
    organizationId,
    gatewayPort: gateway.port,
    gatewayStatus: gateway.status,
  };
}

/**
 * Middleware to resolve and attach tenant context
 *
 * Resolves tenant from request and attaches to req.tenant.
 * Returns 404 if tenant cannot be resolved or gateway is unavailable.
 *
 * @returns Express middleware function
 */
export function tenantContextMiddleware(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenant = await resolveTenant(req as TenantRequest);

      if (!tenant) {
        res.status(404).json({
          error: "Tenant not found or gateway unavailable",
          code: "TENANT_NOT_FOUND",
        });
        return;
      }

      (req as TenantRequest).tenant = tenant;
      next();
    } catch (error) {
      // Database errors should return 503
      console.error("[tenant-router] Error resolving tenant:", error);
      res.status(503).json({
        error: "Service temporarily unavailable",
        code: "SERVICE_UNAVAILABLE",
      });
    }
  };
}

/**
 * Create proxy middleware for tenant gateway routing
 *
 * Routes requests to the correct tenant gateway based on resolved tenant context.
 * Requires tenantContextMiddleware to be applied first.
 *
 * @param options - Additional http-proxy-middleware options
 * @returns Proxy middleware
 */
export function createTenantProxy(options?: Partial<Options>) {
  return createProxyMiddleware({
    router: async (req) => {
      const tenant = (req as unknown as TenantRequest).tenant;
      if (!tenant) {
        throw new Error("Tenant context not found - apply tenantContextMiddleware first");
      }
      return `http://127.0.0.1:${tenant.gatewayPort}`;
    },
    changeOrigin: true,
    ws: true, // WebSocket support
    pathRewrite: undefined, // Keep original path
    on: {
      error: (err, req, res) => {
        console.error("[tenant-proxy] Proxy error:", err);
        if (res && "writeHead" in res && !res.headersSent) {
          (res as Response).status(502).json({
            error: "Gateway error",
            code: "GATEWAY_ERROR",
          });
        }
      },
    },
    ...options,
  });
}

/**
 * Get tenant context from request
 *
 * Utility to safely get tenant context from request.
 *
 * @param req - Express request
 * @returns TenantContext or undefined
 */
export function getTenantContext(req: Request): TenantContext | undefined {
  return (req as TenantRequest).tenant;
}
