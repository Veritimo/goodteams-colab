/**
 * Tenant Gateway Routes Tests
 *
 * Tests for tenant gateway management operations.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma before imports
vi.mock("../../../db/client.js", () => ({
  prisma: {
    tenantGateway: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    tenantConfig: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    tenantCredential: {
      deleteMany: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock audit logger
vi.mock("../../../audit/logger.js", () => ({
  logAudit: vi.fn().mockResolvedValue({}),
}));

// Mock gateway manager
vi.mock("../../../tenant/gateway-manager.js", () => ({
  getGatewayStatus: vi.fn(),
  restartGateway: vi.fn(),
  sendSignal: vi.fn(),
  stopGateway: vi.fn(),
}));

// Mock config generator
vi.mock("../../../tenant/config-generator.js", () => ({
  generateAndWriteConfig: vi.fn().mockResolvedValue({ config: {}, path: "/test/path" }),
  getConfigPath: vi.fn().mockReturnValue("/tenants/test-org/openclaw.json"),
}));

import type { RequestContext } from "../../middleware/context.js";
import { logAudit } from "../../../audit/logger.js";
import { prisma } from "../../../db/client.js";
import { generateAndWriteConfig } from "../../../tenant/config-generator.js";
import {
  getGatewayStatus,
  restartGateway,
  sendSignal,
  stopGateway,
} from "../../../tenant/gateway-manager.js";
import { handleTenantGateway } from "../tenant-gateway.js";

const mockPrisma = prisma as unknown as {
  tenantGateway: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  tenantConfig: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  tenantCredential: {
    deleteMany: ReturnType<typeof vi.fn>;
  };
  organization: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const mockGetGatewayStatus = getGatewayStatus as ReturnType<typeof vi.fn>;
const mockRestartGateway = restartGateway as ReturnType<typeof vi.fn>;
const mockSendSignal = sendSignal as ReturnType<typeof vi.fn>;
const mockStopGateway = stopGateway as ReturnType<typeof vi.fn>;
const mockGenerateAndWriteConfig = generateAndWriteConfig as ReturnType<typeof vi.fn>;

// =============================================================================
// TEST HELPERS
// =============================================================================

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

function createUnauthenticatedContext(): RequestContext {
  return {
    requestId: "test-request-id",
    timestamp: new Date(),
    user: null,
    tenant: null,
    ip: "127.0.0.1",
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("tenant-gateway routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // GET /api/platform/tenant/gateway
  // ===========================================================================

  describe("GET /api/platform/tenant/gateway", () => {
    it("should return gateway status for authenticated user", async () => {
      mockGetGatewayStatus.mockResolvedValue({
        organizationId: "org-1",
        port: 40001,
        status: "HEALTHY",
        pid: 12345,
        lastHealthCheck: new Date("2026-02-01T12:00:00Z"),
        consecutiveFailures: 0,
      });

      mockPrisma.tenantGateway.findUnique.mockResolvedValue({
        id: "gateway-1",
        organizationId: "org-1",
        port: 40001,
        pid: 12345,
        status: "HEALTHY",
        startedAt: new Date("2026-02-01T10:00:00Z"),
        memoryMb: 128,
        cpuPercent: 5.2,
        activeSessions: 3,
      });

      const req = createMockRequest("GET", "/api/platform/tenant/gateway");
      const res = createMockResponse();
      const ctx = createUserContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(200);
      const body = JSON.parse(res._body);
      expect(body.status).toBe("HEALTHY");
      expect(body.port).toBe(40001);
      expect(body.pid).toBe(12345);
      expect(body.resources.memoryMb).toBe(128);
      expect(body.resources.activeSessions).toBe(3);
    });

    it("should require authentication", async () => {
      const req = createMockRequest("GET", "/api/platform/tenant/gateway");
      const res = createMockResponse();
      const ctx = createUnauthenticatedContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(401);
    });

    it("should require organization membership", async () => {
      const req = createMockRequest("GET", "/api/platform/tenant/gateway");
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

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(403);
    });

    it("should return 404 if gateway not found", async () => {
      mockGetGatewayStatus.mockResolvedValue(null);

      const req = createMockRequest("GET", "/api/platform/tenant/gateway");
      const res = createMockResponse();
      const ctx = createUserContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(404);
    });

    it("should calculate uptime for healthy gateway", async () => {
      const startedAt = new Date(Date.now() - 3600000); // 1 hour ago

      mockGetGatewayStatus.mockResolvedValue({
        organizationId: "org-1",
        port: 40001,
        status: "HEALTHY",
        pid: 12345,
        lastHealthCheck: new Date(),
        consecutiveFailures: 0,
      });

      mockPrisma.tenantGateway.findUnique.mockResolvedValue({
        id: "gateway-1",
        organizationId: "org-1",
        port: 40001,
        pid: 12345,
        status: "HEALTHY",
        startedAt,
        memoryMb: 128,
        cpuPercent: 5.2,
        activeSessions: 3,
      });

      const req = createMockRequest("GET", "/api/platform/tenant/gateway");
      const res = createMockResponse();
      const ctx = createUserContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(200);
      const body = JSON.parse(res._body);
      // Uptime should be approximately 3600 seconds (1 hour)
      expect(body.uptime).toBeGreaterThan(3500);
      expect(body.uptime).toBeLessThan(3700);
    });
  });

  // ===========================================================================
  // POST /api/platform/tenant/gateway/restart
  // ===========================================================================

  describe("POST /api/platform/tenant/gateway/restart", () => {
    it("should restart gateway for admin user", async () => {
      mockPrisma.tenantGateway.findUnique.mockResolvedValue({
        id: "gateway-1",
        organizationId: "org-1",
        port: 40001,
        pid: 12345,
        status: "HEALTHY",
      });

      mockRestartGateway.mockResolvedValue(undefined);

      mockPrisma.tenantGateway.findUnique
        .mockResolvedValueOnce({
          id: "gateway-1",
          organizationId: "org-1",
          port: 40001,
          pid: 12345,
          status: "HEALTHY",
        })
        .mockResolvedValueOnce({
          id: "gateway-1",
          organizationId: "org-1",
          port: 40001,
          pid: 12346,
          status: "STARTING",
        });

      const req = createMockRequest("POST", "/api/platform/tenant/gateway/restart");
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(200);
      const body = JSON.parse(res._body);
      expect(body.success).toBe(true);
      expect(body.message).toBe("Gateway restart initiated");
      expect(mockRestartGateway).toHaveBeenCalledWith("org-1");
      expect(logAudit).toHaveBeenCalled();
    });

    it("should reject non-admin users", async () => {
      const req = createMockRequest("POST", "/api/platform/tenant/gateway/restart");
      const res = createMockResponse();
      const ctx = createUserContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(403);
    });

    it("should return 404 if gateway not found", async () => {
      mockPrisma.tenantGateway.findUnique.mockResolvedValue(null);

      const req = createMockRequest("POST", "/api/platform/tenant/gateway/restart");
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(404);
    });

    it("should handle restart failure", async () => {
      mockPrisma.tenantGateway.findUnique.mockResolvedValue({
        id: "gateway-1",
        organizationId: "org-1",
        port: 40001,
        pid: 12345,
        status: "HEALTHY",
      });

      mockRestartGateway.mockRejectedValue(new Error("Restart failed"));

      const req = createMockRequest("POST", "/api/platform/tenant/gateway/restart");
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(500);
      const body = JSON.parse(res._body);
      expect(body.error.message).toBe("Restart failed");
    });
  });

  // ===========================================================================
  // GET /api/platform/tenant/config
  // ===========================================================================

  describe("GET /api/platform/tenant/config", () => {
    it("should return tenant configuration", async () => {
      mockPrisma.tenantConfig.findUnique.mockResolvedValue({
        id: "config-1",
        organizationId: "org-1",
        model: "anthropic/claude-sonnet-4-20250514",
        agentName: "Test Assistant",
        systemPrompt: "You are a helpful assistant.",
        features: { feature1: true, feature2: false },
        maxTokensPerDay: 50000,
        maxConcurrentSessions: 5,
        maxMemoryMb: 256,
      });

      const req = createMockRequest("GET", "/api/platform/tenant/config");
      const res = createMockResponse();
      const ctx = createUserContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(200);
      const body = JSON.parse(res._body);
      expect(body.model).toBe("anthropic/claude-sonnet-4-20250514");
      expect(body.agentName).toBe("Test Assistant");
      expect(body.systemPrompt).toBe("You are a helpful assistant.");
      expect(body.features.feature1).toBe(true);
      expect(body.limits.maxTokensPerDay).toBe(50000);
    });

    it("should require authentication", async () => {
      const req = createMockRequest("GET", "/api/platform/tenant/config");
      const res = createMockResponse();
      const ctx = createUnauthenticatedContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(401);
    });

    it("should return 404 if config not found", async () => {
      mockPrisma.tenantConfig.findUnique.mockResolvedValue(null);

      const req = createMockRequest("GET", "/api/platform/tenant/config");
      const res = createMockResponse();
      const ctx = createUserContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(404);
    });
  });

  // ===========================================================================
  // PUT /api/platform/tenant/config
  // ===========================================================================

  describe("PUT /api/platform/tenant/config", () => {
    it("should update tenant configuration for admin", async () => {
      mockPrisma.tenantConfig.findUnique.mockResolvedValue({
        id: "config-1",
        organizationId: "org-1",
        model: "anthropic/claude-sonnet-4-20250514",
        agentName: "Old Name",
        systemPrompt: null,
        features: {},
        maxTokensPerDay: 50000,
        maxConcurrentSessions: 5,
        maxMemoryMb: 256,
      });

      mockPrisma.tenantConfig.update.mockResolvedValue({
        id: "config-1",
        organizationId: "org-1",
        model: "gpt-4o",
        agentName: "New Name",
        systemPrompt: "New prompt",
        features: { newFeature: true },
        maxTokensPerDay: 50000,
        maxConcurrentSessions: 5,
        maxMemoryMb: 256,
      });

      mockPrisma.organization.findUnique.mockResolvedValue({
        id: "org-1",
        name: "Test Org",
      });

      mockPrisma.tenantGateway.findUnique.mockResolvedValue({
        id: "gateway-1",
        organizationId: "org-1",
        port: 40001,
        configPath: "/test/config",
        statePath: "/test/state",
        workspacePath: "/test/workspace",
      });

      const req = createMockRequest("PUT", "/api/platform/tenant/config", {
        model: "gpt-4o",
        agentName: "New Name",
        systemPrompt: "New prompt",
        features: { newFeature: true },
      });
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(200);
      const body = JSON.parse(res._body);
      expect(body.model).toBe("gpt-4o");
      expect(body.agentName).toBe("New Name");
      expect(mockSendSignal).toHaveBeenCalledWith("org-1", "SIGUSR1");
      expect(logAudit).toHaveBeenCalled();
    });

    it("should reject non-admin users", async () => {
      const req = createMockRequest("PUT", "/api/platform/tenant/config", {
        model: "gpt-4o",
      });
      const res = createMockResponse();
      const ctx = createUserContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(403);
    });

    it("should validate model field length", async () => {
      const req = createMockRequest("PUT", "/api/platform/tenant/config", {
        model: "", // Empty string, should fail validation
      });
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(400);
    });

    it("should validate agentName field length", async () => {
      const req = createMockRequest("PUT", "/api/platform/tenant/config", {
        agentName: "a".repeat(101), // Too long
      });
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(400);
    });

    it("should return current state if no changes", async () => {
      mockPrisma.tenantConfig.findUnique.mockResolvedValue({
        id: "config-1",
        organizationId: "org-1",
        model: "gpt-4o",
        agentName: "Same Name",
        systemPrompt: null,
        features: {},
        maxTokensPerDay: 50000,
        maxConcurrentSessions: 5,
        maxMemoryMb: 256,
      });

      const req = createMockRequest("PUT", "/api/platform/tenant/config", {
        model: "gpt-4o",
        agentName: "Same Name",
      });
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(200);
      expect(mockPrisma.tenantConfig.update).not.toHaveBeenCalled();
    });

    it("should handle partial updates", async () => {
      mockPrisma.tenantConfig.findUnique.mockResolvedValue({
        id: "config-1",
        organizationId: "org-1",
        model: "gpt-4o",
        agentName: "Old Name",
        systemPrompt: null,
        features: {},
        maxTokensPerDay: 50000,
        maxConcurrentSessions: 5,
        maxMemoryMb: 256,
      });

      mockPrisma.tenantConfig.update.mockResolvedValue({
        id: "config-1",
        organizationId: "org-1",
        model: "gpt-4o",
        agentName: "New Name",
        systemPrompt: null,
        features: {},
        maxTokensPerDay: 50000,
        maxConcurrentSessions: 5,
        maxMemoryMb: 256,
      });

      mockPrisma.organization.findUnique.mockResolvedValue({
        id: "org-1",
        name: "Test Org",
      });

      mockPrisma.tenantGateway.findUnique.mockResolvedValue({
        id: "gateway-1",
        organizationId: "org-1",
        port: 40001,
        configPath: "/test/config",
        statePath: "/test/state",
        workspacePath: "/test/workspace",
      });

      const req = createMockRequest("PUT", "/api/platform/tenant/config", {
        agentName: "New Name", // Only updating agentName
      });
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(200);
      expect(mockPrisma.tenantConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { agentName: "New Name" },
        }),
      );
    });

    it("should allow setting systemPrompt to null", async () => {
      mockPrisma.tenantConfig.findUnique.mockResolvedValue({
        id: "config-1",
        organizationId: "org-1",
        model: "gpt-4o",
        agentName: "Name",
        systemPrompt: "Old prompt",
        features: {},
        maxTokensPerDay: 50000,
        maxConcurrentSessions: 5,
        maxMemoryMb: 256,
      });

      mockPrisma.tenantConfig.update.mockResolvedValue({
        id: "config-1",
        organizationId: "org-1",
        model: "gpt-4o",
        agentName: "Name",
        systemPrompt: null,
        features: {},
        maxTokensPerDay: 50000,
        maxConcurrentSessions: 5,
        maxMemoryMb: 256,
      });

      mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1", name: "Test" });
      mockPrisma.tenantGateway.findUnique.mockResolvedValue({
        id: "gateway-1",
        organizationId: "org-1",
        port: 40001,
        configPath: "/test",
        statePath: "/test",
        workspacePath: "/test",
      });

      const req = createMockRequest("PUT", "/api/platform/tenant/config", {
        systemPrompt: null,
      });
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(200);
    });
  });

  // ===========================================================================
  // POST /api/platform/tenant/provision
  // ===========================================================================

  describe("POST /api/platform/tenant/provision", () => {
    it("should provision a new tenant", async () => {
      const orgId = "550e8400-e29b-41d4-a716-446655440000";

      mockPrisma.organization.findUnique.mockResolvedValue({
        id: orgId,
        name: "New Organization",
      });

      mockPrisma.tenantGateway.findUnique.mockResolvedValue(null);
      mockPrisma.tenantGateway.findMany.mockResolvedValue([{ port: 40000 }, { port: 40001 }]);

      const createdGateway = {
        id: "gateway-new",
        organizationId: orgId,
        port: 40002,
        status: "PROVISIONING",
        configPath: `/tenants/${orgId}/openclaw.json`,
      };

      const createdConfig = {
        id: "config-new",
        organizationId: orgId,
        model: "anthropic/claude-sonnet-4-20250514",
        agentName: "New Organization Assistant",
      };

      mockPrisma.$transaction.mockResolvedValue([createdGateway, createdConfig]);

      const req = createMockRequest("POST", "/api/platform/tenant/provision", {
        organizationId: orgId,
      });
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(201);
      const body = JSON.parse(res._body);
      expect(body.success).toBe(true);
      expect(body.gateway.status).toBe("PROVISIONING");
      expect(mockGenerateAndWriteConfig).toHaveBeenCalled();
      expect(logAudit).toHaveBeenCalled();
    });

    it("should reject non-admin users", async () => {
      const req = createMockRequest("POST", "/api/platform/tenant/provision", {
        organizationId: "550e8400-e29b-41d4-a716-446655440000",
      });
      const res = createMockResponse();
      const ctx = createUserContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(403);
    });

    it("should validate organizationId is a UUID", async () => {
      const req = createMockRequest("POST", "/api/platform/tenant/provision", {
        organizationId: "not-a-uuid",
      });
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(400);
    });

    it("should return 404 if organization not found", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      const req = createMockRequest("POST", "/api/platform/tenant/provision", {
        organizationId: "550e8400-e29b-41d4-a716-446655440000",
      });
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(404);
    });

    it("should return 409 if tenant already provisioned", async () => {
      const orgId = "550e8400-e29b-41d4-a716-446655440000";

      mockPrisma.organization.findUnique.mockResolvedValue({
        id: orgId,
        name: "Existing Org",
      });

      mockPrisma.tenantGateway.findUnique.mockResolvedValue({
        id: "existing-gateway",
        organizationId: orgId,
        status: "HEALTHY",
      });

      const req = createMockRequest("POST", "/api/platform/tenant/provision", {
        organizationId: orgId,
      });
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(409);
      const body = JSON.parse(res._body);
      expect(body.error.details.status).toBe("HEALTHY");
    });

    it("should handle config generation failure with rollback", async () => {
      const orgId = "550e8400-e29b-41d4-a716-446655440000";

      mockPrisma.organization.findUnique.mockResolvedValue({
        id: orgId,
        name: "New Organization",
      });

      mockPrisma.tenantGateway.findUnique.mockResolvedValue(null);
      mockPrisma.tenantGateway.findMany.mockResolvedValue([]);

      mockPrisma.$transaction.mockResolvedValue([
        { id: "gateway-new", organizationId: orgId, port: 40000 },
        { id: "config-new", organizationId: orgId },
      ]);

      mockPrisma.tenantConfig.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.tenantGateway.delete.mockResolvedValue({});

      mockGenerateAndWriteConfig.mockRejectedValue(new Error("Config generation failed"));

      const req = createMockRequest("POST", "/api/platform/tenant/provision", {
        organizationId: orgId,
      });
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(500);
      // Verify rollback methods were called
      expect(mockPrisma.tenantConfig.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.tenantGateway.delete).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // DELETE /api/platform/tenant/:orgId
  // ===========================================================================

  describe("DELETE /api/platform/tenant/:orgId", () => {
    it("should deprovision a tenant", async () => {
      const orgId = "550e8400-e29b-41d4-a716-446655440000";

      mockPrisma.tenantGateway.findUnique.mockResolvedValue({
        id: "gateway-1",
        organizationId: orgId,
        port: 40001,
        status: "HEALTHY",
        organization: { name: "Test Org" },
      });

      mockStopGateway.mockResolvedValue(undefined);
      mockPrisma.$transaction.mockResolvedValue([{}, {}, {}]);

      const req = createMockRequest("DELETE", `/api/platform/tenant/${orgId}`);
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(200);
      const body = JSON.parse(res._body);
      expect(body.success).toBe(true);
      expect(body.organizationId).toBe(orgId);
      expect(mockStopGateway).toHaveBeenCalledWith(orgId);
      expect(logAudit).toHaveBeenCalled();
    });

    it("should reject non-admin users", async () => {
      const orgId = "550e8400-e29b-41d4-a716-446655440000";

      const req = createMockRequest("DELETE", `/api/platform/tenant/${orgId}`);
      const res = createMockResponse();
      const ctx = createUserContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(403);
    });

    it("should validate orgId format", async () => {
      const req = createMockRequest("DELETE", "/api/platform/tenant/invalid-id");
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(400);
    });

    it("should return 404 if gateway not found", async () => {
      const orgId = "550e8400-e29b-41d4-a716-446655440000";

      mockPrisma.tenantGateway.findUnique.mockResolvedValue(null);

      const req = createMockRequest("DELETE", `/api/platform/tenant/${orgId}`);
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(404);
    });

    it("should handle gateway stop failure gracefully", async () => {
      const orgId = "550e8400-e29b-41d4-a716-446655440000";

      mockPrisma.tenantGateway.findUnique.mockResolvedValue({
        id: "gateway-1",
        organizationId: orgId,
        port: 40001,
        status: "HEALTHY",
        organization: { name: "Test Org" },
      });

      mockStopGateway.mockRejectedValue(new Error("Stop failed"));
      mockPrisma.$transaction.mockResolvedValue([{}, {}, {}]);

      const req = createMockRequest("DELETE", `/api/platform/tenant/${orgId}`);
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleTenantGateway(req, res, ctx);

      // Should still succeed - stop failure is logged but not blocking
      expect(res._statusCode).toBe(200);
    });

    it("should skip stop for already stopped gateways", async () => {
      const orgId = "550e8400-e29b-41d4-a716-446655440000";

      mockPrisma.tenantGateway.findUnique.mockResolvedValue({
        id: "gateway-1",
        organizationId: orgId,
        port: 40001,
        status: "STOPPED",
        organization: { name: "Test Org" },
      });

      mockPrisma.$transaction.mockResolvedValue([{}, {}, {}]);

      const req = createMockRequest("DELETE", `/api/platform/tenant/${orgId}`);
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(200);
      expect(mockStopGateway).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Method Handling
  // ===========================================================================

  describe("method handling", () => {
    it("should return 405 for unsupported methods on /api/platform/tenant/gateway", async () => {
      const req = createMockRequest("DELETE", "/api/platform/tenant/gateway");
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(405);
    });

    it("should return 405 for GET on /api/platform/tenant/gateway/restart", async () => {
      const req = createMockRequest("GET", "/api/platform/tenant/gateway/restart");
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(405);
    });

    it("should return 405 for POST on /api/platform/tenant/config", async () => {
      const req = createMockRequest("POST", "/api/platform/tenant/config");
      const res = createMockResponse();
      const ctx = createAdminContext();

      await handleTenantGateway(req, res, ctx);

      expect(res._statusCode).toBe(405);
    });
  });
});
