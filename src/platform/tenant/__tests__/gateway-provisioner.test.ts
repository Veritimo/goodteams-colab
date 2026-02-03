/**
 * Gateway Provisioner Tests
 *
 * Tests for the gateway provisioning service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fs/promises
vi.mock("fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock prisma
vi.mock("../../db/client.js", () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
    },
    tenantGateway: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    tenantConfig: {
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    tenantCredential: {
      deleteMany: vi.fn(),
    },
  },
}));

// Mock gateway-manager
vi.mock("../gateway-manager.js", () => ({
  spawnGateway: vi.fn().mockResolvedValue(undefined),
  stopGateway: vi.fn().mockResolvedValue(undefined),
  getGatewayStatus: vi.fn(),
}));

// Mock config-generator
vi.mock("../config-generator.js", () => ({
  generateTenantConfig: vi.fn().mockResolvedValue({
    gateway: { port: 18001, bind: "127.0.0.1" },
    model: "anthropic/claude-sonnet-4-20250514",
  }),
  writeConfigToFile: vi.fn().mockResolvedValue("/tenants/org-123/config/openclaw.json"),
  getTenantBasePath: vi.fn((orgId: string) => `/tenants/${orgId}`),
}));

// Mock credential-vault
vi.mock("../credential-vault.js", () => ({
  deleteAllCredentials: vi.fn().mockResolvedValue(3),
}));

// Mock port-allocator
vi.mock("../port-allocator.js", () => ({
  PortAllocator: vi.fn().mockImplementation(() => ({
    allocate: vi.fn().mockResolvedValue(18001),
    release: vi.fn().mockResolvedValue(true),
  })),
  createPortAllocator: vi.fn().mockImplementation(() => ({
    allocate: vi.fn().mockResolvedValue(18001),
    release: vi.fn().mockResolvedValue(true),
  })),
}));

// Mock fetch for health checks - immediately returns ok
const mockFetch = vi.fn().mockResolvedValue({ ok: true });
global.fetch = mockFetch;

import * as fs from "fs/promises";
import { prisma } from "../../db/client.js";
import { generateTenantConfig, writeConfigToFile } from "../config-generator.js";
import { deleteAllCredentials } from "../credential-vault.js";
import { spawnGateway, stopGateway } from "../gateway-manager.js";
import {
  GatewayProvisioner,
  createGatewayProvisioner,
  provisionTenant,
  deprovisionTenant,
  getProvisioningStatus,
  restartTenant,
  ProvisioningError,
  HEALTH_CHECK_CONFIG,
  _resetDefaultProvisioner,
} from "../gateway-provisioner.js";
import { createPortAllocator } from "../port-allocator.js";

/**
 * Create a testable provisioner subclass that bypasses slow operations
 */
class TestableGatewayProvisioner extends GatewayProvisioner {
  public healthCheckResult = true;

  // Override the private waitForHealthy method via prototype
  constructor(portAllocator?: any, tenantsBasePath?: string) {
    super(portAllocator, tenantsBasePath);
    // Override the private method to return immediately
    (this as any).waitForHealthy = async () => this.healthCheckResult;
  }
}

describe("gateway-provisioner.ts", () => {
  const mockOrgId = "org-123";
  const mockOrganization = {
    id: mockOrgId,
    name: "Test Org",
    slug: "test-org",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockGateway = {
    id: "gw-1",
    organizationId: mockOrgId,
    port: 18001,
    pid: 12345,
    status: "PROVISIONING",
    lastHealthCheck: null,
    consecutiveFailures: 0,
    configPath: `/tenants/${mockOrgId}/config/openclaw.json`,
    statePath: `/tenants/${mockOrgId}/state`,
    workspacePath: `/tenants/${mockOrgId}/workspace`,
    startedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTenantConfig = {
    id: "tc-1",
    organizationId: mockOrgId,
    model: "anthropic/claude-sonnet-4-20250514",
    agentName: "Assistant",
    systemPrompt: null,
    features: {},
    maxTokensPerDay: 50000,
    maxConcurrentSessions: 2,
    maxMemoryMb: 256,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let mockPortAllocator: ReturnType<typeof createPortAllocator>;
  let provisioner: TestableGatewayProvisioner;

  beforeEach(() => {
    vi.clearAllMocks();
    _resetDefaultProvisioner();

    // Reset mock port allocator
    mockPortAllocator = {
      allocate: vi.fn().mockResolvedValue(18001),
      release: vi.fn().mockResolvedValue(true),
    } as any;

    vi.mocked(createPortAllocator).mockReturnValue(mockPortAllocator);
    provisioner = new TestableGatewayProvisioner(mockPortAllocator, "/tenants");

    // Default successful health check
    mockFetch.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GatewayProvisioner", () => {
    describe("provisionTenant", () => {
      it("should successfully provision a new tenant gateway", async () => {
        vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization);
        vi.mocked(prisma.tenantGateway.findUnique)
          .mockResolvedValueOnce(null) // First check - no existing gateway
          .mockResolvedValueOnce(mockGateway); // After allocation
        vi.mocked(prisma.tenantConfig.findUnique).mockResolvedValue(mockTenantConfig);
        vi.mocked(prisma.tenantConfig.create).mockResolvedValue(mockTenantConfig);
        vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
          ...mockGateway,
          status: "HEALTHY",
        });

        const result = await provisioner.provisionTenant(mockOrgId);

        expect(result.success).toBe(true);
        expect(result.organizationId).toBe(mockOrgId);
        expect(result.port).toBe(18001);
        expect(result.status).toBe("HEALTHY");
      });

      it("should create workspace directories during provisioning", async () => {
        vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization);
        vi.mocked(prisma.tenantGateway.findUnique)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(mockGateway);
        vi.mocked(prisma.tenantConfig.findUnique).mockResolvedValue(mockTenantConfig);
        vi.mocked(prisma.tenantConfig.create).mockResolvedValue(mockTenantConfig);
        vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
          ...mockGateway,
          status: "HEALTHY",
        });

        await provisioner.provisionTenant(mockOrgId);

        expect(fs.mkdir).toHaveBeenCalled();
        // Should create config, state, workspace, sessions, memory directories
        expect(fs.mkdir).toHaveBeenCalledTimes(5);
      });

      it("should allocate port via PortAllocator", async () => {
        vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization);
        vi.mocked(prisma.tenantGateway.findUnique)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(mockGateway);
        vi.mocked(prisma.tenantConfig.findUnique).mockResolvedValue(mockTenantConfig);
        vi.mocked(prisma.tenantConfig.create).mockResolvedValue(mockTenantConfig);
        vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
          ...mockGateway,
          status: "HEALTHY",
        });

        await provisioner.provisionTenant(mockOrgId);

        expect(mockPortAllocator.allocate).toHaveBeenCalledWith(
          mockOrgId,
          expect.stringContaining("config/openclaw.json"),
          expect.stringContaining("state"),
          expect.stringContaining("workspace"),
        );
      });

      it("should create TenantConfig with plan defaults", async () => {
        vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization);
        vi.mocked(prisma.tenantGateway.findUnique)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(mockGateway);
        vi.mocked(prisma.tenantConfig.findUnique).mockResolvedValue(mockTenantConfig);
        vi.mocked(prisma.tenantConfig.create).mockResolvedValue(mockTenantConfig);
        vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
          ...mockGateway,
          status: "HEALTHY",
        });

        await provisioner.provisionTenant(mockOrgId, { plan: "pro" });

        expect(prisma.tenantConfig.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            organizationId: mockOrgId,
            model: "anthropic/claude-sonnet-4-20250514",
            agentName: "Assistant",
            maxTokensPerDay: 500000, // Pro plan limit
            maxConcurrentSessions: 10, // Pro plan limit
          }),
        });
      });

      it("should generate and write config file", async () => {
        vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization);
        vi.mocked(prisma.tenantGateway.findUnique)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(mockGateway);
        vi.mocked(prisma.tenantConfig.findUnique).mockResolvedValue(mockTenantConfig);
        vi.mocked(prisma.tenantConfig.create).mockResolvedValue(mockTenantConfig);
        vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
          ...mockGateway,
          status: "HEALTHY",
        });

        await provisioner.provisionTenant(mockOrgId);

        expect(generateTenantConfig).toHaveBeenCalledWith(
          mockOrganization,
          mockTenantConfig,
          mockGateway,
        );
        expect(writeConfigToFile).toHaveBeenCalledWith(mockOrgId, expect.any(Object));
      });

      it("should spawn gateway via GatewayManager", async () => {
        vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization);
        vi.mocked(prisma.tenantGateway.findUnique)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(mockGateway);
        vi.mocked(prisma.tenantConfig.findUnique).mockResolvedValue(mockTenantConfig);
        vi.mocked(prisma.tenantConfig.create).mockResolvedValue(mockTenantConfig);
        vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
          ...mockGateway,
          status: "HEALTHY",
        });

        await provisioner.provisionTenant(mockOrgId);

        expect(spawnGateway).toHaveBeenCalledWith(mockOrgId);
      });

      it("should wait for health check to pass", async () => {
        vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization);
        vi.mocked(prisma.tenantGateway.findUnique)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(mockGateway)
          .mockResolvedValue(mockGateway); // For health checks
        vi.mocked(prisma.tenantConfig.findUnique).mockResolvedValue(mockTenantConfig);
        vi.mocked(prisma.tenantConfig.create).mockResolvedValue(mockTenantConfig);
        vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
          ...mockGateway,
          status: "HEALTHY",
        });

        // Health check returns ok
        provisioner.healthCheckResult = true;

        const result = await provisioner.provisionTenant(mockOrgId);

        expect(result.success).toBe(true);
        expect(result.status).toBe("HEALTHY");
      });

      it("should return UNHEALTHY if health check fails", async () => {
        vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization);
        vi.mocked(prisma.tenantGateway.findUnique)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(mockGateway)
          .mockResolvedValue(mockGateway);
        vi.mocked(prisma.tenantConfig.findUnique).mockResolvedValue(mockTenantConfig);
        vi.mocked(prisma.tenantConfig.create).mockResolvedValue(mockTenantConfig);
        vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
          ...mockGateway,
          status: "UNHEALTHY",
        });

        // Set health check to fail
        provisioner.healthCheckResult = false;

        const result = await provisioner.provisionTenant(mockOrgId);

        expect(result.success).toBe(false);
        expect(result.status).toBe("UNHEALTHY");
        expect(result.error).toContain("failed health check");
      });

      it("should fail if organization not found", async () => {
        vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

        const result = await provisioner.provisionTenant(mockOrgId);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Organization not found");
      });

      it("should fail if gateway already exists", async () => {
        vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization);
        vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(mockGateway);

        const result = await provisioner.provisionTenant(mockOrgId);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Gateway already exists");
        expect(result.port).toBe(mockGateway.port);
      });

      it("should fail if no ports available", async () => {
        vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization);
        vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(null);
        mockPortAllocator.allocate = vi.fn().mockResolvedValue(null);

        const result = await provisioner.provisionTenant(mockOrgId);

        expect(result.success).toBe(false);
        expect(result.error).toContain("No ports available");
      });

      it("should rollback on failure", async () => {
        vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization);
        vi.mocked(prisma.tenantGateway.findUnique)
          .mockResolvedValueOnce(null)
          .mockResolvedValue(mockGateway);
        vi.mocked(prisma.tenantConfig.create).mockResolvedValue(mockTenantConfig);
        vi.mocked(prisma.tenantConfig.findUnique).mockResolvedValue(mockTenantConfig);
        vi.mocked(prisma.tenantConfig.deleteMany).mockResolvedValue({ count: 1 });
        vi.mocked(prisma.tenantGateway.update).mockResolvedValue(mockGateway);

        // Fail during spawn
        vi.mocked(spawnGateway).mockRejectedValueOnce(new Error("Spawn failed"));

        const result = await provisioner.provisionTenant(mockOrgId);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Spawn failed");

        // Should have attempted rollback
        expect(stopGateway).toHaveBeenCalled();
        expect(prisma.tenantConfig.deleteMany).toHaveBeenCalled();
        expect(mockPortAllocator.release).toHaveBeenCalled();
        expect(fs.rm).toHaveBeenCalled();
      });

      it("should use custom limits when provided", async () => {
        vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization);
        vi.mocked(prisma.tenantGateway.findUnique)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(mockGateway);
        vi.mocked(prisma.tenantConfig.findUnique).mockResolvedValue(mockTenantConfig);
        vi.mocked(prisma.tenantConfig.create).mockResolvedValue(mockTenantConfig);
        vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
          ...mockGateway,
          status: "HEALTHY",
        });

        await provisioner.provisionTenant(mockOrgId, {
          plan: "free",
          customLimits: {
            maxTokensPerDay: 100000,
            maxConcurrentSessions: 5,
          },
        });

        expect(prisma.tenantConfig.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            maxTokensPerDay: 100000,
            maxConcurrentSessions: 5,
          }),
        });
      });
    });

    describe("deprovisionTenant", () => {
      it("should successfully deprovision a tenant gateway", async () => {
        vi.mocked(prisma.tenantConfig.deleteMany).mockResolvedValue({ count: 1 });
        vi.mocked(deleteAllCredentials).mockResolvedValue(3);

        const result = await provisioner.deprovisionTenant(mockOrgId);

        expect(result.success).toBe(true);
        expect(result.organizationId).toBe(mockOrgId);
        expect(result.portReleased).toBe(true);
        expect(result.credentialsDeleted).toBe(3);
      });

      it("should stop gateway process", async () => {
        vi.mocked(prisma.tenantConfig.deleteMany).mockResolvedValue({ count: 1 });

        await provisioner.deprovisionTenant(mockOrgId);

        expect(stopGateway).toHaveBeenCalledWith(mockOrgId);
      });

      it("should delete credentials", async () => {
        vi.mocked(prisma.tenantConfig.deleteMany).mockResolvedValue({ count: 1 });
        vi.mocked(deleteAllCredentials).mockResolvedValue(5);

        const result = await provisioner.deprovisionTenant(mockOrgId);

        expect(deleteAllCredentials).toHaveBeenCalledWith(mockOrgId);
        expect(result.credentialsDeleted).toBe(5);
      });

      it("should keep credentials when option set", async () => {
        vi.mocked(prisma.tenantConfig.deleteMany).mockResolvedValue({ count: 1 });

        const result = await provisioner.deprovisionTenant(mockOrgId, {
          keepCredentials: true,
        });

        expect(deleteAllCredentials).not.toHaveBeenCalled();
        expect(result.credentialsDeleted).toBe(0);
      });

      it("should archive workspace by default", async () => {
        vi.mocked(prisma.tenantConfig.deleteMany).mockResolvedValue({ count: 1 });

        await provisioner.deprovisionTenant(mockOrgId);

        expect(fs.rename).toHaveBeenCalled();
        expect(fs.rm).not.toHaveBeenCalled();
      });

      it("should delete workspace when option set", async () => {
        vi.mocked(prisma.tenantConfig.deleteMany).mockResolvedValue({ count: 1 });

        await provisioner.deprovisionTenant(mockOrgId, {
          deleteWorkspace: true,
        });

        expect(fs.rm).toHaveBeenCalledWith(expect.stringContaining(mockOrgId), {
          recursive: true,
          force: true,
        });
      });

      it("should release port via PortAllocator", async () => {
        vi.mocked(prisma.tenantConfig.deleteMany).mockResolvedValue({ count: 1 });

        await provisioner.deprovisionTenant(mockOrgId);

        expect(mockPortAllocator.release).toHaveBeenCalledWith(mockOrgId);
      });

      it("should delete TenantConfig", async () => {
        vi.mocked(prisma.tenantConfig.deleteMany).mockResolvedValue({ count: 1 });

        await provisioner.deprovisionTenant(mockOrgId);

        expect(prisma.tenantConfig.deleteMany).toHaveBeenCalledWith({
          where: { organizationId: mockOrgId },
        });
      });

      it("should handle gateway not running gracefully", async () => {
        vi.mocked(stopGateway).mockRejectedValueOnce(new Error("Not running"));
        vi.mocked(prisma.tenantConfig.deleteMany).mockResolvedValue({ count: 1 });

        const result = await provisioner.deprovisionTenant(mockOrgId);

        // Should still succeed
        expect(result.success).toBe(true);
      });
    });

    describe("getProvisioningStatus", () => {
      it("should return status for existing gateway", async () => {
        const runningGateway = {
          ...mockGateway,
          status: "HEALTHY",
          startedAt: new Date(Date.now() - 60000), // Started 1 minute ago
          lastHealthCheck: new Date(),
        };
        vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(runningGateway);

        const status = await provisioner.getProvisioningStatus(mockOrgId);

        expect(status).not.toBeNull();
        expect(status?.organizationId).toBe(mockOrgId);
        expect(status?.status).toBe("HEALTHY");
        expect(status?.port).toBe(18001);
        expect(status?.uptime).toBeGreaterThan(0);
      });

      it("should return null for non-existent gateway", async () => {
        vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(null);

        const status = await provisioner.getProvisioningStatus(mockOrgId);

        expect(status).toBeNull();
      });

      it("should calculate uptime correctly", async () => {
        const startTime = new Date(Date.now() - 120000); // 2 minutes ago
        vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue({
          ...mockGateway,
          status: "HEALTHY",
          startedAt: startTime,
        });

        const status = await provisioner.getProvisioningStatus(mockOrgId);

        expect(status?.uptime).toBeGreaterThanOrEqual(120000);
        expect(status?.uptime).toBeLessThan(130000);
      });

      it("should return null uptime for stopped gateway", async () => {
        vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue({
          ...mockGateway,
          status: "STOPPED",
          startedAt: new Date(Date.now() - 60000),
        });

        const status = await provisioner.getProvisioningStatus(mockOrgId);

        expect(status?.uptime).toBeNull();
      });
    });

    describe("restartTenant", () => {
      it("should stop and restart gateway", async () => {
        vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(mockGateway);
        vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
          ...mockGateway,
          status: "HEALTHY",
          startedAt: new Date(),
        });

        await provisioner.restartTenant(mockOrgId);

        expect(stopGateway).toHaveBeenCalledWith(mockOrgId);
        expect(spawnGateway).toHaveBeenCalledWith(mockOrgId);
      });

      it("should return null for non-existent gateway", async () => {
        vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(null);

        const result = await provisioner.restartTenant(mockOrgId);

        expect(result).toBeNull();
      });

      it("should update status to HEALTHY after restart", async () => {
        vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(mockGateway);
        vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
          ...mockGateway,
          status: "HEALTHY",
          startedAt: new Date(),
        });
        mockFetch.mockResolvedValue({ ok: true });

        await provisioner.restartTenant(mockOrgId);

        expect(prisma.tenantGateway.update).toHaveBeenCalledWith({
          where: { organizationId: mockOrgId },
          data: expect.objectContaining({
            status: "HEALTHY",
          }),
        });
      });
    });
  });

  describe("Convenience Functions", () => {
    describe("provisionTenant", () => {
      it("should use default provisioner", async () => {
        vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization);
        vi.mocked(prisma.tenantGateway.findUnique)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(mockGateway);
        vi.mocked(prisma.tenantConfig.findUnique).mockResolvedValue(mockTenantConfig);
        vi.mocked(prisma.tenantConfig.create).mockResolvedValue(mockTenantConfig);
        vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
          ...mockGateway,
          status: "HEALTHY",
        });

        const result = await provisionTenant(mockOrgId);

        expect(result.success).toBe(true);
      });
    });

    describe("deprovisionTenant", () => {
      it("should use default provisioner", async () => {
        vi.mocked(prisma.tenantConfig.deleteMany).mockResolvedValue({ count: 1 });

        const result = await deprovisionTenant(mockOrgId);

        expect(result.success).toBe(true);
      });
    });

    describe("getProvisioningStatus", () => {
      it("should use default provisioner", async () => {
        vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(mockGateway);

        const status = await getProvisioningStatus(mockOrgId);

        expect(status).not.toBeNull();
      });
    });

    describe("restartTenant", () => {
      it("should use default provisioner", async () => {
        vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(mockGateway);
        vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
          ...mockGateway,
          status: "HEALTHY",
        });

        const status = await restartTenant(mockOrgId);

        expect(status).not.toBeNull();
      });
    });
  });

  describe("ProvisioningError", () => {
    it("should include organization ID and phase", () => {
      const error = new ProvisioningError("Test error", mockOrgId, "port_allocation");

      expect(error.message).toBe("Test error");
      expect(error.organizationId).toBe(mockOrgId);
      expect(error.phase).toBe("port_allocation");
      expect(error.name).toBe("ProvisioningError");
    });

    it("should include cause when provided", () => {
      const cause = new Error("Root cause");
      const error = new ProvisioningError("Test error", mockOrgId, "spawn", cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe("createGatewayProvisioner", () => {
    it("should create provisioner with default options", () => {
      const provisioner = createGatewayProvisioner();
      expect(provisioner).toBeInstanceOf(GatewayProvisioner);
    });

    it("should accept custom port allocator", () => {
      const customAllocator = {
        allocate: vi.fn(),
        release: vi.fn(),
      } as any;

      const provisioner = createGatewayProvisioner(customAllocator);
      expect(provisioner).toBeInstanceOf(GatewayProvisioner);
    });

    it("should accept custom tenants base path", () => {
      const provisioner = createGatewayProvisioner(undefined, "/custom/path");
      expect(provisioner).toBeInstanceOf(GatewayProvisioner);
    });
  });
});
