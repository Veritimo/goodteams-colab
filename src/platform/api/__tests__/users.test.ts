/**
 * User Routes Tests
 *
 * Tests user management with RBAC protection.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma before imports
vi.mock("../../db/client.js", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// Mock audit logger
vi.mock("../../audit/logger.js", () => ({
  logAudit: vi.fn().mockResolvedValue({}),
}));

// Mock admin guard
vi.mock("../../auth/admin-guard.js", () => ({
  validateAdminChange: vi.fn(),
  AdminContinuityError: class AdminContinuityError extends Error {
    constructor(
      message: string,
      public readonly code: string,
    ) {
      super(message);
      this.name = "AdminContinuityError";
    }
  },
}));

import type { RequestContext } from "../middleware/context.js";
import { logAudit } from "../../audit/logger.js";
import { validateAdminChange, AdminContinuityError } from "../../auth/admin-guard.js";
import { prisma } from "../../db/client.js";
import { handleUsers } from "../routes/users.js";

const mockPrisma = prisma as unknown as {
  user: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

const mockValidateAdminChange = validateAdminChange as ReturnType<typeof vi.fn>;

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

describe("users routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAdminChange.mockResolvedValue(undefined);
  });

  describe("GET /api/platform/users", () => {
    it("should list organization users", async () => {
      const mockUsers = [
        {
          id: "admin-1",
          email: "admin@example.com",
          username: "Admin",
          role: "ADMIN",
          externalId: "ext-admin",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
        {
          id: "user-1",
          email: "user@example.com",
          username: "User",
          role: "USER",
          externalId: null,
          createdAt: new Date("2026-01-02"),
          updatedAt: new Date("2026-01-02"),
        },
      ];
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const req = createMockRequest("GET", "/api/platform/users");
      const res = createMockResponse();
      const ctx = createUserContext(); // Regular users can list users

      await handleUsers(req, res, ctx);

      expect(res._statusCode).toBe(200);
      const body = JSON.parse(res._body);
      expect(body.users).toHaveLength(2);
      expect(body.total).toBe(2);
    });

    it("should require authentication", async () => {
      const req = createMockRequest("GET", "/api/platform/users");
      const res = createMockResponse();
      const ctx: RequestContext = {
        requestId: "test-id",
        timestamp: new Date(),
        user: null,
        tenant: null,
        ip: "127.0.0.1",
      };

      await handleUsers(req, res, ctx);

      expect(res._statusCode).toBe(401);
    });

    it("should require organization membership", async () => {
      const req = createMockRequest("GET", "/api/platform/users");
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

      await handleUsers(req, res, ctx);

      expect(res._statusCode).toBe(403);
    });
  });

  describe("GET /api/platform/users/:id", () => {
    it("should get specific user details", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-2",
        email: "user2@example.com",
        username: "User 2",
        role: "USER",
        externalId: "ext-2",
        organizationId: "org-1",
        permissions: [{ name: "CRM_READ" }],
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      });

      const req = createMockRequest("GET", "/api/platform/users/user-2");
      const res = createMockResponse();
      const ctx = createUserContext();

      await handleUsers(req, res, ctx);

      expect(res._statusCode).toBe(200);
      const body = JSON.parse(res._body);
      expect(body.id).toBe("user-2");
      expect(body.permissions).toContain("CRM_READ");
    });

    it("should return 404 for non-existent user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const req = createMockRequest("GET", "/api/platform/users/nonexistent");
      const res = createMockResponse();
      const ctx = createUserContext();

      await handleUsers(req, res, ctx);

      expect(res._statusCode).toBe(404);
    });

    it("should prevent access to users in other orgs", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-other",
        email: "other@example.com",
        organizationId: "org-other", // Different org
      });

      const req = createMockRequest("GET", "/api/platform/users/user-other");
      const res = createMockResponse();
      const ctx = createUserContext();

      await handleUsers(req, res, ctx);

      expect(res._statusCode).toBe(403);
    });
  });

  describe("GET /api/platform/users/me", () => {
    it("should return current user profile", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        username: "User",
        role: "USER",
        externalId: "ext-1",
        permissions: [],
        organization: {
          id: "org-1",
          name: "Test Org",
          status: "ACTIVE",
        },
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      });

      const req = createMockRequest("GET", "/api/platform/users/me");
      const res = createMockResponse();
      const ctx = createUserContext();

      await handleUsers(req, res, ctx);

      expect(res._statusCode).toBe(200);
      const body = JSON.parse(res._body);
      expect(body.id).toBe("user-1");
      expect(body.organization.name).toBe("Test Org");
    });
  });

  describe("PUT /api/platform/users/:id/role", () => {
    it("should change user role (admin only)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-2",
        email: "user2@example.com",
        role: "USER",
        organizationId: "org-1",
      });

      mockPrisma.user.update.mockResolvedValue({
        id: "user-2",
        email: "user2@example.com",
        username: "User 2",
        role: "ADMIN",
        externalId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const req = createMockRequest("PUT", "/api/platform/users/user-2/role", {
        role: "ADMIN",
      });
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleUsers(req, res, ctx);

      expect(res._statusCode).toBe(200);
      const body = JSON.parse(res._body);
      expect(body.role).toBe("ADMIN");

      // Should validate admin change
      expect(mockValidateAdminChange).toHaveBeenCalledWith("user-2", "ADMIN", "org-1", "admin-1");

      // Should log audit event
      expect(logAudit).toHaveBeenCalled();
    });

    it("should reject non-admin users", async () => {
      const req = createMockRequest("PUT", "/api/platform/users/user-2/role", {
        role: "ADMIN",
      });
      const res = createMockResponse();
      const ctx = createUserContext();

      await handleUsers(req, res, ctx);

      expect(res._statusCode).toBe(403);
    });

    it("should prevent self-role-change via admin guard", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "admin-1",
        email: "admin@example.com",
        role: "ADMIN",
        organizationId: "org-1",
      });

      // Admin guard throws for self-demotion
      mockValidateAdminChange.mockRejectedValue(
        new AdminContinuityError("You cannot demote yourself.", "SELF_DEMOTION"),
      );

      const req = createMockRequest("PUT", "/api/platform/users/admin-1/role", {
        role: "USER",
      });
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleUsers(req, res, ctx);

      expect(res._statusCode).toBe(409);
      const body = JSON.parse(res._body);
      expect(body.error.details?.code).toBe("SELF_DEMOTION");
    });

    it("should prevent demoting last admin", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "admin-2",
        email: "admin2@example.com",
        role: "ADMIN",
        organizationId: "org-1",
      });

      // Admin guard throws for last admin demotion
      mockValidateAdminChange.mockRejectedValue(
        new AdminContinuityError("Cannot demote the last administrator.", "LAST_ADMIN_DEMOTION"),
      );

      const req = createMockRequest("PUT", "/api/platform/users/admin-2/role", {
        role: "USER",
      });
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleUsers(req, res, ctx);

      expect(res._statusCode).toBe(409);
      const body = JSON.parse(res._body);
      expect(body.error.details?.code).toBe("LAST_ADMIN_DEMOTION");
    });

    it("should validate role value", async () => {
      const req = createMockRequest("PUT", "/api/platform/users/user-2/role", {
        role: "INVALID",
      });
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleUsers(req, res, ctx);

      expect(res._statusCode).toBe(400);
    });
  });

  describe("DELETE /api/platform/users/:id", () => {
    it("should remove user from organization (admin only)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-2",
        email: "user2@example.com",
        role: "USER",
        organizationId: "org-1",
      });

      mockPrisma.user.update.mockResolvedValue({});

      const req = createMockRequest("DELETE", "/api/platform/users/user-2");
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleUsers(req, res, ctx);

      expect(res._statusCode).toBe(200);
      const body = JSON.parse(res._body);
      expect(body.success).toBe(true);

      // Should validate admin change with null (removal)
      expect(mockValidateAdminChange).toHaveBeenCalledWith("user-2", null, "org-1", "admin-1");

      // Should unlink user from org
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            organizationId: null,
            role: "USER",
          },
        }),
      );

      // Should log audit event
      expect(logAudit).toHaveBeenCalled();
    });

    it("should reject non-admin users", async () => {
      const req = createMockRequest("DELETE", "/api/platform/users/user-2");
      const res = createMockResponse();
      const ctx = createUserContext();

      await handleUsers(req, res, ctx);

      expect(res._statusCode).toBe(403);
    });

    it("should prevent self-removal via admin guard", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "admin-1",
        email: "admin@example.com",
        role: "ADMIN",
        organizationId: "org-1",
      });

      // Admin guard throws for self-removal
      mockValidateAdminChange.mockRejectedValue(
        new AdminContinuityError("You cannot remove yourself.", "SELF_REMOVAL"),
      );

      const req = createMockRequest("DELETE", "/api/platform/users/admin-1");
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleUsers(req, res, ctx);

      expect(res._statusCode).toBe(409);
      const body = JSON.parse(res._body);
      expect(body.error.details?.code).toBe("SELF_REMOVAL");
    });

    it("should prevent removing last admin", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "admin-2",
        email: "admin2@example.com",
        role: "ADMIN",
        organizationId: "org-1",
      });

      // Admin guard throws for last admin removal
      mockValidateAdminChange.mockRejectedValue(
        new AdminContinuityError("Cannot remove the last administrator.", "LAST_ADMIN_REMOVAL"),
      );

      const req = createMockRequest("DELETE", "/api/platform/users/admin-2");
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleUsers(req, res, ctx);

      expect(res._statusCode).toBe(409);
      const body = JSON.parse(res._body);
      expect(body.error.details?.code).toBe("LAST_ADMIN_REMOVAL");
    });

    it("should return 404 for non-existent user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const req = createMockRequest("DELETE", "/api/platform/users/nonexistent");
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleUsers(req, res, ctx);

      expect(res._statusCode).toBe(404);
    });

    it("should prevent removing user from another org", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-other",
        email: "other@example.com",
        role: "USER",
        organizationId: "org-other", // Different org
      });

      const req = createMockRequest("DELETE", "/api/platform/users/user-other");
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleUsers(req, res, ctx);

      expect(res._statusCode).toBe(403);
    });
  });
});
