/**
 * Organization Routes Tests
 *
 * Tests organization management operations.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma before imports
vi.mock("../../db/client.js", () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

// Mock audit logger
vi.mock("../../audit/logger.js", () => ({
  logAudit: vi.fn().mockResolvedValue({}),
}));

import type { RequestContext } from "../middleware/context.js";
import { logAudit } from "../../audit/logger.js";
import { prisma } from "../../db/client.js";
import { handleOrg } from "../routes/org.js";

const mockPrisma = prisma as unknown as {
  organization: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  user: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

// Helper to create mock request
function createMockRequest(method: string, url: string, body?: unknown): IncomingMessage {
  const readable = new Readable();
  if (body) {
    readable.push(JSON.stringify(body));
  }
  readable.push(null);

  return Object.assign(readable, {
    method,
    url,
    headers: { host: "localhost:3000" },
    socket: { remoteAddress: "127.0.0.1" },
  }) as unknown as IncomingMessage;
}

// Helper to create mock response
function createMockResponse(): ServerResponse & {
  _statusCode: number;
  _body: string;
  _headers: Record<string, string>;
} {
  const res = {
    _statusCode: 200,
    _body: "",
    _headers: {} as Record<string, string>,
    statusCode: 200,
    setHeader(name: string, value: string) {
      this._headers[name.toLowerCase()] = value;
    },
    end(body?: string) {
      if (body) this._body = body;
    },
    getHeader(name: string) {
      return this._headers[name.toLowerCase()];
    },
  };
  Object.defineProperty(res, "statusCode", {
    get() {
      return res._statusCode;
    },
    set(value: number) {
      res._statusCode = value;
    },
  });
  return res as ServerResponse & typeof res;
}

// Helper to create admin context
function createAdminContext(overrides = {}): RequestContext {
  return {
    requestId: "test-request-id",
    timestamp: new Date(),
    user: {
      id: "admin-1",
      email: "admin@example.com",
      name: "Admin User",
      orgId: "org-1",
      role: "admin",
      permissions: [],
    },
    tenant: null,
    ip: "127.0.0.1",
    ...overrides,
  };
}

// Helper to create user context (non-admin)
function createUserContext(overrides = {}): RequestContext {
  return {
    requestId: "test-request-id",
    timestamp: new Date(),
    user: {
      id: "user-1",
      email: "user@example.com",
      name: "Regular User",
      orgId: "org-1",
      role: "member",
      permissions: [],
    },
    tenant: null,
    ip: "127.0.0.1",
    ...overrides,
  };
}

describe("organization routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/platform/org", () => {
    it("should return current organization details", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: "org-1",
        name: "Test Organization",
        status: "ACTIVE",
        externalTenantId: "tenant-123",
        authorizedModels: ["gpt-4o", "claude-3"],
        defaultModelId: "gpt-4o",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-15"),
        _count: { users: 5 },
      });

      const req = createMockRequest("GET", "/api/platform/org");
      const res = createMockResponse();
      const ctx = createUserContext();

      await handleOrg(req, res, ctx);

      expect(res._statusCode).toBe(200);
      const body = JSON.parse(res._body);
      expect(body.id).toBe("org-1");
      expect(body.name).toBe("Test Organization");
      expect(body.status).toBe("ACTIVE");
      expect(body.externalTenantId).toBe("tenant-123");
      expect(body.authorizedModels).toContain("gpt-4o");
      expect(body.memberCount).toBe(5);
    });

    it("should require authentication", async () => {
      const req = createMockRequest("GET", "/api/platform/org");
      const res = createMockResponse();
      const ctx: RequestContext = {
        requestId: "test-id",
        timestamp: new Date(),
        user: null,
        tenant: null,
        ip: "127.0.0.1",
      };

      await handleOrg(req, res, ctx);

      expect(res._statusCode).toBe(401);
    });

    it("should require organization membership", async () => {
      const req = createMockRequest("GET", "/api/platform/org");
      const res = createMockResponse();
      const ctx = createUserContext({
        user: {
          id: "user-1",
          email: "user@example.com",
          name: "User",
          orgId: null, // No org
          role: "member",
          permissions: [],
        },
      });

      await handleOrg(req, res, ctx);

      expect(res._statusCode).toBe(403);
    });

    it("should return 404 if organization not found", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      const req = createMockRequest("GET", "/api/platform/org");
      const res = createMockResponse();
      const ctx = createUserContext();

      await handleOrg(req, res, ctx);

      expect(res._statusCode).toBe(404);
    });
  });

  describe("PUT /api/platform/org", () => {
    it("should update organization settings (admin only)", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: "org-1",
        name: "Old Name",
        status: "ACTIVE",
        externalTenantId: "tenant-123",
        authorizedModels: ["gpt-4o"],
        defaultModelId: "gpt-4o",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-15"),
      });

      mockPrisma.organization.update.mockResolvedValue({
        id: "org-1",
        name: "New Name",
        status: "ACTIVE",
        externalTenantId: "tenant-123",
        authorizedModels: ["gpt-4o", "claude-3"],
        defaultModelId: "claude-3",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-20"),
        _count: { users: 5 },
      });

      const req = createMockRequest("PUT", "/api/platform/org", {
        name: "New Name",
        defaultModelId: "claude-3",
        authorizedModels: ["gpt-4o", "claude-3"],
      });
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleOrg(req, res, ctx);

      expect(res._statusCode).toBe(200);
      const body = JSON.parse(res._body);
      expect(body.name).toBe("New Name");
      expect(body.defaultModelId).toBe("claude-3");
      expect(body.authorizedModels).toContain("claude-3");

      // Should log audit event
      expect(logAudit).toHaveBeenCalled();
    });

    it("should reject non-admin users", async () => {
      const req = createMockRequest("PUT", "/api/platform/org", {
        name: "New Name",
      });
      const res = createMockResponse();
      const ctx = createUserContext();

      await handleOrg(req, res, ctx);

      expect(res._statusCode).toBe(403);
    });

    it("should validate organization name length", async () => {
      const req = createMockRequest("PUT", "/api/platform/org", {
        name: "A", // Too short
      });
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleOrg(req, res, ctx);

      expect(res._statusCode).toBe(400);
    });

    it("should return current state if no changes", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: "org-1",
        name: "Test Org",
        status: "ACTIVE",
        externalTenantId: "tenant-123",
        authorizedModels: ["gpt-4o"],
        defaultModelId: "gpt-4o",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-15"),
      });

      const req = createMockRequest("PUT", "/api/platform/org", {
        name: "Test Org", // Same name
      });
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleOrg(req, res, ctx);

      expect(res._statusCode).toBe(200);
      // Should not call update if nothing changed
      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });

    it("should handle partial updates", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: "org-1",
        name: "Test Org",
        status: "ACTIVE",
        externalTenantId: "tenant-123",
        authorizedModels: ["gpt-4o"],
        defaultModelId: "gpt-4o",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-15"),
      });

      mockPrisma.organization.update.mockResolvedValue({
        id: "org-1",
        name: "Updated Org",
        status: "ACTIVE",
        externalTenantId: "tenant-123",
        authorizedModels: ["gpt-4o"],
        defaultModelId: "gpt-4o",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-20"),
        _count: { users: 5 },
      });

      const req = createMockRequest("PUT", "/api/platform/org", {
        name: "Updated Org",
        // Not updating defaultModelId or authorizedModels
      });
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleOrg(req, res, ctx);

      expect(res._statusCode).toBe(200);
      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Updated Org",
          }),
        }),
      );
    });
  });

  describe("GET /api/platform/org/members", () => {
    it("should list organization members", async () => {
      const mockUsers = [
        {
          id: "admin-1",
          email: "admin@example.com",
          username: "Admin",
          role: "ADMIN",
          externalId: "ext-admin",
          createdAt: new Date("2026-01-01"),
        },
        {
          id: "user-1",
          email: "user@example.com",
          username: "User",
          role: "USER",
          externalId: null,
          createdAt: new Date("2026-01-02"),
        },
      ];
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const req = createMockRequest("GET", "/api/platform/org/members");
      const res = createMockResponse();
      const ctx = createUserContext();

      await handleOrg(req, res, ctx);

      expect(res._statusCode).toBe(200);
      const body = JSON.parse(res._body);
      expect(body.members).toHaveLength(2);
      expect(body.total).toBe(2);
      expect(body.members[0].email).toBe("admin@example.com");
    });

    it("should require authentication", async () => {
      const req = createMockRequest("GET", "/api/platform/org/members");
      const res = createMockResponse();
      const ctx: RequestContext = {
        requestId: "test-id",
        timestamp: new Date(),
        user: null,
        tenant: null,
        ip: "127.0.0.1",
      };

      await handleOrg(req, res, ctx);

      expect(res._statusCode).toBe(401);
    });

    it("should require organization membership", async () => {
      const req = createMockRequest("GET", "/api/platform/org/members");
      const res = createMockResponse();
      const ctx = createUserContext({
        user: {
          id: "user-1",
          email: "user@example.com",
          name: "User",
          orgId: null, // No org
          role: "member",
          permissions: [],
        },
      });

      await handleOrg(req, res, ctx);

      expect(res._statusCode).toBe(403);
    });
  });

  describe("Method handling", () => {
    it("should return 405 for unsupported methods", async () => {
      const req = createMockRequest("DELETE", "/api/platform/org");
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleOrg(req, res, ctx);

      expect(res._statusCode).toBe(405);
    });

    it("should return 405 for POST on /api/platform/org", async () => {
      const req = createMockRequest("POST", "/api/platform/org");
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleOrg(req, res, ctx);

      expect(res._statusCode).toBe(405);
    });
  });
});
