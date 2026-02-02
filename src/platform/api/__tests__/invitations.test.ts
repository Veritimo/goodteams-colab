/**
 * Invitation Routes Tests
 *
 * Tests the full invitation lifecycle for staff onboarding.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Prisma before imports
vi.mock("../../db/client.js", () => ({
  prisma: {
    organization: { findUnique: vi.fn() },
    organizationInvitation: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock audit logger
vi.mock("../../audit/logger.js", () => ({
  logAudit: vi.fn().mockResolvedValue({}),
}));

// Mock email service
vi.mock("../../email/index.js", () => ({
  sendInvitationEmail: vi.fn().mockResolvedValue(undefined),
}));

import type { RequestContext } from "../middleware/context.js";
import { logAudit } from "../../audit/logger.js";
import { prisma } from "../../db/client.js";
import { sendInvitationEmail } from "../../email/index.js";
import { handleInvitations } from "../routes/invitations.js";

const mockPrisma = prisma as unknown as {
  organization: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  organizationInvitation: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  user: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
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

describe("invitations routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/platform/invitations", () => {
    it("should list pending invitations (admin only)", async () => {
      const mockInvitations = [
        {
          id: "inv-1",
          email: "newuser@example.com",
          role: "USER",
          status: "PENDING",
          externalId: "ext-1",
          entraUsername: "newuser@company.com",
          entraDisplayName: "New User",
          createdAt: new Date("2026-01-01"),
          expiresAt: new Date("2026-01-08"),
          issuer: {
            id: "admin-1",
            email: "admin@example.com",
            username: "Admin",
          },
        },
      ];
      mockPrisma.organizationInvitation.findMany.mockResolvedValue(mockInvitations);

      const req = createMockRequest("GET", "/api/platform/invitations");
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleInvitations(req, res, ctx);

      expect(res._statusCode).toBe(200);
      const body = JSON.parse(res._body);
      expect(body.invitations).toHaveLength(1);
      expect(body.invitations[0].email).toBe("newuser@example.com");
    });

    it("should reject non-admin users", async () => {
      const req = createMockRequest("GET", "/api/platform/invitations");
      const res = createMockResponse();
      const ctx = createUserContext();

      await handleInvitations(req, res, ctx);

      expect(res._statusCode).toBe(403);
    });
  });

  describe("POST /api/platform/invitations", () => {
    it("should create invitation successfully (admin only)", async () => {
      // Mock organization with Entra connected
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: "org-1",
        name: "Test Org",
        externalTenantId: "tenant-123",
      });

      // Mock no existing user
      mockPrisma.user.findFirst.mockResolvedValue(null);

      // Mock no existing invitation
      mockPrisma.organizationInvitation.findFirst.mockResolvedValue(null);

      // Mock created invitation
      mockPrisma.organizationInvitation.create.mockResolvedValue({
        id: "inv-new",
        email: "newuser@example.com",
        role: "USER",
        status: "PENDING",
        token: "test-token-uuid",
        externalId: "ext-1",
        entraUsername: "newuser@company.com",
        entraDisplayName: "New User",
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        organizationId: "org-1",
        issuerId: "admin-1",
        issuer: {
          id: "admin-1",
          email: "admin@example.com",
          username: "Admin",
        },
      });

      const req = createMockRequest("POST", "/api/platform/invitations", {
        email: "newuser@example.com",
        role: "USER",
        externalId: "ext-1",
        entraUsername: "newuser@company.com",
        entraDisplayName: "New User",
      });
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleInvitations(req, res, ctx);

      expect(res._statusCode).toBe(201);
      const body = JSON.parse(res._body);
      expect(body.email).toBe("newuser@example.com");
      expect(body.role).toBe("USER");
      expect(body.status).toBe("PENDING");

      // Should log audit event
      expect(logAudit).toHaveBeenCalled();

      // Should send email
      expect(sendInvitationEmail).toHaveBeenCalled();
    });

    it("should reject invitation for non-Entra-connected org", async () => {
      // Mock organization without Entra
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: "org-1",
        name: "Test Org",
        externalTenantId: null, // Not connected
      });

      const req = createMockRequest("POST", "/api/platform/invitations", {
        email: "newuser@example.com",
        role: "USER",
      });
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleInvitations(req, res, ctx);

      expect(res._statusCode).toBe(403);
      const body = JSON.parse(res._body);
      expect(body.error.details?.code).toBe("ENTRA_NOT_CONNECTED");
    });

    it("should prevent duplicate invitations", async () => {
      // Mock organization with Entra
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: "org-1",
        name: "Test Org",
        externalTenantId: "tenant-123",
      });

      // Mock no existing user
      mockPrisma.user.findFirst.mockResolvedValue(null);

      // Mock existing pending invitation
      mockPrisma.organizationInvitation.findFirst.mockResolvedValue({
        id: "inv-existing",
        email: "newuser@example.com",
        status: "PENDING",
      });

      const req = createMockRequest("POST", "/api/platform/invitations", {
        email: "newuser@example.com",
        role: "USER",
      });
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleInvitations(req, res, ctx);

      expect(res._statusCode).toBe(409);
      const body = JSON.parse(res._body);
      expect(body.error.details?.code).toBe("INVITATION_EXISTS");
    });

    it("should prevent inviting existing user", async () => {
      // Mock organization with Entra
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: "org-1",
        name: "Test Org",
        externalTenantId: "tenant-123",
      });

      // Mock existing user
      mockPrisma.user.findFirst.mockResolvedValue({
        id: "user-existing",
        email: "newuser@example.com",
        organizationId: "org-1",
      });

      const req = createMockRequest("POST", "/api/platform/invitations", {
        email: "newuser@example.com",
        role: "USER",
      });
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleInvitations(req, res, ctx);

      expect(res._statusCode).toBe(409);
      const body = JSON.parse(res._body);
      expect(body.error.details?.code).toBe("USER_EXISTS");
    });

    it("should validate email format", async () => {
      const req = createMockRequest("POST", "/api/platform/invitations", {
        email: "not-an-email",
        role: "USER",
      });
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleInvitations(req, res, ctx);

      expect(res._statusCode).toBe(400);
    });

    it("should validate role", async () => {
      const req = createMockRequest("POST", "/api/platform/invitations", {
        email: "newuser@example.com",
        role: "INVALID_ROLE",
      });
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleInvitations(req, res, ctx);

      expect(res._statusCode).toBe(400);
    });
  });

  describe("POST /api/platform/invitations/:token/accept", () => {
    it("should accept invitation successfully", async () => {
      // Mock invitation
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: "inv-1",
        email: "user@example.com",
        role: "USER",
        status: "PENDING",
        token: "test-token",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        externalId: "ext-1",
        organizationId: "org-1",
        issuerId: "admin-1",
        organization: {
          id: "org-1",
          name: "Test Org",
        },
      });

      // Mock user not in any org
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        organizationId: null,
      });

      // Mock user update
      mockPrisma.user.update.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        role: "USER",
        organizationId: "org-1",
      });

      // Mock invitation update
      mockPrisma.organizationInvitation.update.mockResolvedValue({});

      const req = createMockRequest("POST", "/api/platform/invitations/test-token/accept");
      const res = createMockResponse();
      const ctx = createUserContext({
        user: {
          id: "user-1",
          email: "user@example.com",
          name: "User",
          orgId: null, // Not in an org yet
          role: "member",
          permissions: [],
        },
      });

      await handleInvitations(req, res, ctx);

      expect(res._statusCode).toBe(200);
      const body = JSON.parse(res._body);
      expect(body.success).toBe(true);
      expect(body.organization.name).toBe("Test Org");

      // Should log audit event
      expect(logAudit).toHaveBeenCalled();
    });

    it("should reject expired invitation", async () => {
      // Mock expired invitation
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: "inv-1",
        email: "user@example.com",
        status: "PENDING",
        token: "test-token",
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired yesterday
        organizationId: "org-1",
        organization: { id: "org-1", name: "Test Org" },
      });

      // Mock invitation status update
      mockPrisma.organizationInvitation.update.mockResolvedValue({});

      const req = createMockRequest("POST", "/api/platform/invitations/test-token/accept");
      const res = createMockResponse();
      const ctx = createUserContext({
        user: {
          id: "user-1",
          email: "user@example.com",
          name: "User",
          orgId: null,
          role: "member",
          permissions: [],
        },
      });

      await handleInvitations(req, res, ctx);

      expect(res._statusCode).toBe(409);
      const body = JSON.parse(res._body);
      expect(body.error.details?.status).toBe("EXPIRED");
    });

    it("should reject invitation for wrong email", async () => {
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: "inv-1",
        email: "other@example.com",
        status: "PENDING",
        token: "test-token",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        organizationId: "org-1",
        organization: { id: "org-1", name: "Test Org" },
      });

      const req = createMockRequest("POST", "/api/platform/invitations/test-token/accept");
      const res = createMockResponse();
      const ctx = createUserContext({
        user: {
          id: "user-1",
          email: "user@example.com", // Different email
          name: "User",
          orgId: null,
          role: "member",
          permissions: [],
        },
      });

      await handleInvitations(req, res, ctx);

      expect(res._statusCode).toBe(403);
    });

    it("should reject if user already in an organization", async () => {
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: "inv-1",
        email: "user@example.com",
        status: "PENDING",
        token: "test-token",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        organizationId: "org-1",
        organization: { id: "org-1", name: "Test Org" },
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        organizationId: "org-2", // Already in another org
      });

      const req = createMockRequest("POST", "/api/platform/invitations/test-token/accept");
      const res = createMockResponse();
      const ctx = createUserContext({
        user: {
          id: "user-1",
          email: "user@example.com",
          name: "User",
          orgId: "org-2",
          role: "member",
          permissions: [],
        },
      });

      await handleInvitations(req, res, ctx);

      expect(res._statusCode).toBe(409);
    });
  });

  describe("DELETE /api/platform/invitations/:id", () => {
    it("should revoke invitation successfully", async () => {
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: "inv-1",
        email: "newuser@example.com",
        role: "USER",
        status: "PENDING",
        organizationId: "org-1",
        issuerId: "admin-1",
      });

      mockPrisma.organizationInvitation.update.mockResolvedValue({});

      const req = createMockRequest("DELETE", "/api/platform/invitations/inv-1");
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleInvitations(req, res, ctx);

      expect(res._statusCode).toBe(200);
      const body = JSON.parse(res._body);
      expect(body.success).toBe(true);

      // Should log audit event
      expect(logAudit).toHaveBeenCalled();
    });

    it("should prevent revoking non-pending invitation", async () => {
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: "inv-1",
        status: "ACCEPTED",
        organizationId: "org-1",
      });

      const req = createMockRequest("DELETE", "/api/platform/invitations/inv-1");
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleInvitations(req, res, ctx);

      expect(res._statusCode).toBe(409);
    });

    it("should prevent revoking invitation from another org", async () => {
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: "inv-1",
        status: "PENDING",
        organizationId: "org-other", // Different org
      });

      const req = createMockRequest("DELETE", "/api/platform/invitations/inv-1");
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleInvitations(req, res, ctx);

      expect(res._statusCode).toBe(403);
    });
  });

  describe("POST /api/platform/invitations/:id/resend", () => {
    it("should resend invitation and reset expiry", async () => {
      const oldExpiry = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000); // 1 day left

      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: "inv-1",
        email: "newuser@example.com",
        role: "USER",
        status: "PENDING",
        token: "test-token",
        expiresAt: oldExpiry,
        organizationId: "org-1",
        organization: { id: "org-1", name: "Test Org" },
      });

      mockPrisma.organizationInvitation.update.mockResolvedValue({});

      const req = createMockRequest("POST", "/api/platform/invitations/inv-1/resend");
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleInvitations(req, res, ctx);

      expect(res._statusCode).toBe(200);
      const body = JSON.parse(res._body);
      expect(body.success).toBe(true);

      // Should send email
      expect(sendInvitationEmail).toHaveBeenCalled();

      // Should log audit event
      expect(logAudit).toHaveBeenCalled();
    });

    it("should resend expired invitation and reset status", async () => {
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: "inv-1",
        email: "newuser@example.com",
        role: "USER",
        status: "EXPIRED",
        token: "test-token",
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired
        organizationId: "org-1",
        organization: { id: "org-1", name: "Test Org" },
      });

      mockPrisma.organizationInvitation.update.mockResolvedValue({});

      const req = createMockRequest("POST", "/api/platform/invitations/inv-1/resend");
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleInvitations(req, res, ctx);

      expect(res._statusCode).toBe(200);

      // Should update status back to PENDING
      expect(mockPrisma.organizationInvitation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "PENDING",
          }),
        }),
      );
    });

    it("should prevent resending revoked invitation", async () => {
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: "inv-1",
        status: "REVOKED",
        organizationId: "org-1",
        organization: { id: "org-1", name: "Test Org" },
      });

      const req = createMockRequest("POST", "/api/platform/invitations/inv-1/resend");
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleInvitations(req, res, ctx);

      expect(res._statusCode).toBe(409);
    });
  });
});
