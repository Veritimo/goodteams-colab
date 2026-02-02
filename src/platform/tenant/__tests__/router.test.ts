/**
 * Tenant Router Tests
 *
 * Tests for tenant resolution, middleware, and proxy functionality.
 */

import type { GatewayStatus } from "@prisma/client";
import type { Request, Response, NextFunction } from "express";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Prisma before imports
vi.mock("../../db/client.js", () => ({
  prisma: {
    organization: {
      findFirst: vi.fn(),
    },
    tenantGateway: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock http-proxy-middleware
vi.mock("http-proxy-middleware", () => ({
  createProxyMiddleware: vi.fn((options) => {
    const middleware = vi.fn(async (req: Request, res: Response, next: NextFunction) => {
      // Simulate proxy behavior by calling router to get target
      if (options.router) {
        const target = await options.router(req);
        (req as any)._proxyTarget = target;
      }
      next();
    });
    (middleware as any)._options = options;
    return middleware;
  }),
}));

import { createProxyMiddleware } from "http-proxy-middleware";
import { prisma } from "../../db/client.js";
import {
  extractSubdomain,
  getOrganizationBySlug,
  getTenantGateway,
  resolveTenant,
  tenantContextMiddleware,
  createTenantProxy,
  getTenantContext,
  TENANT_ID_HEADER,
  type TenantRequest,
  type TenantContext,
} from "../router.js";

// Type the mocks
const mockPrisma = prisma as unknown as {
  organization: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  tenantGateway: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

// Helper to create mock request
function createMockRequest(overrides: Partial<TenantRequest> = {}): TenantRequest {
  const headers: Record<string, string> = {};
  return {
    get: vi.fn((name: string) => headers[name.toLowerCase()]),
    headers,
    user: undefined,
    tenant: undefined,
    ...overrides,
  } as unknown as TenantRequest;
}

// Helper to create mock response
function createMockResponse(): Response & { _json?: unknown; _status?: number } {
  const res: any = {
    _status: 200,
    _json: null,
    status: vi.fn(function (this: any, code: number) {
      this._status = code;
      return this;
    }),
    json: vi.fn(function (this: any, data: unknown) {
      this._json = data;
      return this;
    }),
    headersSent: false,
  };
  return res;
}

describe("router.ts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ==========================================================================
  // extractSubdomain tests
  // ==========================================================================
  describe("extractSubdomain", () => {
    it("should extract subdomain from goodteams.ai domain", () => {
      expect(extractSubdomain("acme.goodteams.ai")).toBe("acme");
      expect(extractSubdomain("my-company.goodteams.ai")).toBe("my-company");
    });

    it("should extract subdomain from localhost", () => {
      expect(extractSubdomain("acme.localhost")).toBe("acme");
      expect(extractSubdomain("tenant.localhost:3000")).toBe("tenant");
    });

    it("should extract subdomain from staging domain", () => {
      expect(extractSubdomain("acme.staging.goodteams.ai")).toBe("acme");
    });

    it("should return null for reserved subdomains", () => {
      expect(extractSubdomain("www.goodteams.ai")).toBeNull();
      expect(extractSubdomain("api.goodteams.ai")).toBeNull();
      expect(extractSubdomain("app.goodteams.ai")).toBeNull();
      expect(extractSubdomain("admin.goodteams.ai")).toBeNull();
    });

    it("should return null for bare domains", () => {
      expect(extractSubdomain("goodteams.ai")).toBeNull();
      expect(extractSubdomain("localhost")).toBeNull();
      expect(extractSubdomain("localhost:3000")).toBeNull();
    });

    it("should return null for empty or null input", () => {
      expect(extractSubdomain("")).toBeNull();
      expect(extractSubdomain(null as unknown as string)).toBeNull();
    });

    it("should return null for unrecognized domains", () => {
      expect(extractSubdomain("acme.example.com")).toBeNull();
      expect(extractSubdomain("tenant.other-domain.io")).toBeNull();
    });

    it("should handle single character subdomains", () => {
      expect(extractSubdomain("a.goodteams.ai")).toBe("a");
    });

    it("should be case insensitive", () => {
      expect(extractSubdomain("ACME.GOODTEAMS.AI")).toBe("acme");
      expect(extractSubdomain("MyCompany.localhost")).toBe("mycompany");
    });
  });

  // ==========================================================================
  // getOrganizationBySlug tests
  // ==========================================================================
  describe("getOrganizationBySlug", () => {
    it("should return organization ID for valid slug", async () => {
      mockPrisma.organization.findFirst.mockResolvedValue({ id: "org-123" });

      const result = await getOrganizationBySlug("acme");

      expect(result).toBe("org-123");
      expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith({
        where: {
          name: { equals: "acme", mode: "insensitive" },
          status: "ACTIVE",
        },
        select: { id: true },
      });
    });

    it("should return null for unknown slug", async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null);

      const result = await getOrganizationBySlug("nonexistent");

      expect(result).toBeNull();
    });

    it("should only match active organizations", async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await getOrganizationBySlug("suspended-org");

      expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "ACTIVE" }),
        }),
      );
    });
  });

  // ==========================================================================
  // getTenantGateway tests
  // ==========================================================================
  describe("getTenantGateway", () => {
    it("should return gateway info for healthy gateway", async () => {
      mockPrisma.tenantGateway.findUnique.mockResolvedValue({
        port: 8080,
        status: "HEALTHY" as GatewayStatus,
      });

      const result = await getTenantGateway("org-123");

      expect(result).toEqual({ port: 8080, status: "HEALTHY" });
    });

    it("should return gateway info for starting gateway", async () => {
      mockPrisma.tenantGateway.findUnique.mockResolvedValue({
        port: 8081,
        status: "STARTING" as GatewayStatus,
      });

      const result = await getTenantGateway("org-123");

      expect(result).toEqual({ port: 8081, status: "STARTING" });
    });

    it("should return null for unhealthy gateway", async () => {
      mockPrisma.tenantGateway.findUnique.mockResolvedValue({
        port: 8082,
        status: "UNHEALTHY" as GatewayStatus,
      });

      const result = await getTenantGateway("org-123");

      expect(result).toBeNull();
    });

    it("should return null for stopped gateway", async () => {
      mockPrisma.tenantGateway.findUnique.mockResolvedValue({
        port: 8083,
        status: "STOPPED" as GatewayStatus,
      });

      const result = await getTenantGateway("org-123");

      expect(result).toBeNull();
    });

    it("should return null for failed gateway", async () => {
      mockPrisma.tenantGateway.findUnique.mockResolvedValue({
        port: 8084,
        status: "FAILED" as GatewayStatus,
      });

      const result = await getTenantGateway("org-123");

      expect(result).toBeNull();
    });

    it("should return null for non-existent gateway", async () => {
      mockPrisma.tenantGateway.findUnique.mockResolvedValue(null);

      const result = await getTenantGateway("org-123");

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // resolveTenant tests
  // ==========================================================================
  describe("resolveTenant", () => {
    it("should resolve tenant from JWT token (req.user.organizationId)", async () => {
      const req = createMockRequest({
        user: { organizationId: "org-jwt-123" },
      });

      mockPrisma.tenantGateway.findUnique.mockResolvedValue({
        port: 8080,
        status: "HEALTHY",
      });

      const result = await resolveTenant(req);

      expect(result).toEqual({
        organizationId: "org-jwt-123",
        gatewayPort: 8080,
        gatewayStatus: "HEALTHY",
      });
    });

    it("should resolve tenant from X-Tenant-ID header", async () => {
      const orgId = "12345678-1234-1234-1234-123456789abc";
      const headers: Record<string, string> = {
        [TENANT_ID_HEADER.toLowerCase()]: orgId,
      };
      const req = createMockRequest({
        headers,
        get: vi.fn((name: string) => headers[name.toLowerCase()]),
      });

      mockPrisma.tenantGateway.findUnique.mockResolvedValue({
        port: 8081,
        status: "HEALTHY",
      });

      const result = await resolveTenant(req);

      expect(result).toEqual({
        organizationId: orgId,
        gatewayPort: 8081,
        gatewayStatus: "HEALTHY",
      });
    });

    it("should resolve tenant from subdomain", async () => {
      const headers: Record<string, string> = { host: "acme.goodteams.ai" };
      const req = createMockRequest({
        headers,
        get: vi.fn((name: string) => headers[name.toLowerCase()]),
      });

      mockPrisma.organization.findFirst.mockResolvedValue({ id: "org-acme" });
      mockPrisma.tenantGateway.findUnique.mockResolvedValue({
        port: 8082,
        status: "HEALTHY",
      });

      const result = await resolveTenant(req);

      expect(result).toEqual({
        organizationId: "org-acme",
        gatewayPort: 8082,
        gatewayStatus: "HEALTHY",
      });
    });

    it("should prioritize JWT over header and subdomain", async () => {
      const headers: Record<string, string> = {
        [TENANT_ID_HEADER.toLowerCase()]: "12345678-1234-1234-1234-header123456",
        host: "other.goodteams.ai",
      };
      const req = createMockRequest({
        user: { organizationId: "org-from-jwt" },
        headers,
        get: vi.fn((name: string) => headers[name.toLowerCase()]),
      });

      mockPrisma.tenantGateway.findUnique.mockResolvedValue({
        port: 8080,
        status: "HEALTHY",
      });

      const result = await resolveTenant(req);

      expect(result?.organizationId).toBe("org-from-jwt");
    });

    it("should prioritize header over subdomain when no JWT", async () => {
      const orgId = "12345678-1234-1234-1234-aabbccddeeff";
      const headers: Record<string, string> = {
        [TENANT_ID_HEADER.toLowerCase()]: orgId,
        host: "other.goodteams.ai",
      };
      const req = createMockRequest({
        headers,
        get: vi.fn((name: string) => headers[name.toLowerCase()]),
      });

      mockPrisma.tenantGateway.findUnique.mockResolvedValue({
        port: 8080,
        status: "HEALTHY",
      });

      const result = await resolveTenant(req);

      expect(result?.organizationId).toBe(orgId);
      // Should not have tried to look up org by slug
      expect(mockPrisma.organization.findFirst).not.toHaveBeenCalled();
    });

    it("should return null for unknown tenant", async () => {
      const headers: Record<string, string> = { host: "unknown.goodteams.ai" };
      const req = createMockRequest({
        headers,
        get: vi.fn((name: string) => headers[name.toLowerCase()]),
      });

      mockPrisma.organization.findFirst.mockResolvedValue(null);

      const result = await resolveTenant(req);

      expect(result).toBeNull();
    });

    it("should return null for unhealthy gateway", async () => {
      const req = createMockRequest({
        user: { organizationId: "org-123" },
      });

      mockPrisma.tenantGateway.findUnique.mockResolvedValue({
        port: 8080,
        status: "UNHEALTHY",
      });

      const result = await resolveTenant(req);

      expect(result).toBeNull();
    });

    it("should return null when no tenant identification present", async () => {
      const req = createMockRequest();

      const result = await resolveTenant(req);

      expect(result).toBeNull();
    });

    it("should reject invalid UUID in X-Tenant-ID header", async () => {
      const headers: Record<string, string> = {
        [TENANT_ID_HEADER.toLowerCase()]: "not-a-uuid",
      };
      const req = createMockRequest({
        headers,
        get: vi.fn((name: string) => headers[name.toLowerCase()]),
      });

      const result = await resolveTenant(req);

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // tenantContextMiddleware tests
  // ==========================================================================
  describe("tenantContextMiddleware", () => {
    it("should attach tenant context to request", async () => {
      const req = createMockRequest({
        user: { organizationId: "org-123" },
      });
      const res = createMockResponse();
      const next = vi.fn();

      mockPrisma.tenantGateway.findUnique.mockResolvedValue({
        port: 8080,
        status: "HEALTHY",
      });

      const middleware = tenantContextMiddleware();
      await middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(req.tenant).toEqual({
        organizationId: "org-123",
        gatewayPort: 8080,
        gatewayStatus: "HEALTHY",
      });
    });

    it("should return 404 for missing tenant", async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      const middleware = tenantContextMiddleware();
      await middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(404);
      expect(res._json).toEqual({
        error: "Tenant not found or gateway unavailable",
        code: "TENANT_NOT_FOUND",
      });
    });

    it("should return 503 on database error", async () => {
      const req = createMockRequest({
        user: { organizationId: "org-123" },
      });
      const res = createMockResponse();
      const next = vi.fn();

      mockPrisma.tenantGateway.findUnique.mockRejectedValue(new Error("DB error"));

      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const middleware = tenantContextMiddleware();
      await middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(503);
      expect(res._json).toEqual({
        error: "Service temporarily unavailable",
        code: "SERVICE_UNAVAILABLE",
      });

      consoleSpy.mockRestore();
    });
  });

  // ==========================================================================
  // createTenantProxy tests
  // ==========================================================================
  describe("createTenantProxy", () => {
    it("should create proxy middleware with correct options", () => {
      const proxy = createTenantProxy();

      expect(createProxyMiddleware).toHaveBeenCalled();
      const options = (proxy as any)._options;
      expect(options.changeOrigin).toBe(true);
      expect(options.ws).toBe(true);
      expect(typeof options.router).toBe("function");
    });

    it("should route to correct tenant gateway port", async () => {
      const proxy = createTenantProxy();
      const options = (proxy as any)._options;

      const req = createMockRequest({
        tenant: {
          organizationId: "org-123",
          gatewayPort: 9090,
          gatewayStatus: "HEALTHY" as GatewayStatus,
        },
      });

      const target = await options.router(req);

      expect(target).toBe("http://127.0.0.1:9090");
    });

    it("should throw error if tenant context missing", async () => {
      const proxy = createTenantProxy();
      const options = (proxy as any)._options;

      const req = createMockRequest();

      await expect(options.router(req)).rejects.toThrow("Tenant context not found");
    });

    it("should merge custom options", () => {
      const customOptions = {
        pathRewrite: { "^/api": "" },
        timeout: 30000,
      };

      createTenantProxy(customOptions);

      expect(createProxyMiddleware).toHaveBeenCalledWith(
        expect.objectContaining({
          ...customOptions,
          changeOrigin: true,
          ws: true,
        }),
      );
    });
  });

  // ==========================================================================
  // getTenantContext tests
  // ==========================================================================
  describe("getTenantContext", () => {
    it("should return tenant context from request", () => {
      const tenant: TenantContext = {
        organizationId: "org-123",
        gatewayPort: 8080,
        gatewayStatus: "HEALTHY" as GatewayStatus,
      };
      const req = createMockRequest({ tenant });

      const result = getTenantContext(req as Request);

      expect(result).toBe(tenant);
    });

    it("should return undefined if no tenant context", () => {
      const req = createMockRequest();

      const result = getTenantContext(req as Request);

      expect(result).toBeUndefined();
    });
  });

  // ==========================================================================
  // Constants
  // ==========================================================================
  describe("constants", () => {
    it("should export TENANT_ID_HEADER", () => {
      expect(TENANT_ID_HEADER).toBe("x-tenant-id");
    });
  });
});
