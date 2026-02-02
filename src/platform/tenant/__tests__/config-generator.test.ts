/**
 * Tests for Tenant Config Generator
 */

import type {
  Organization,
  TenantConfig,
  TenantGateway,
  OrgStatus,
  GatewayStatus,
} from "@prisma/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fs module
vi.mock("fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

import * as fs from "fs/promises";
import {
  generateTenantConfig,
  generateTenantToken,
  writeConfigToFile,
  getConfigPath,
  getTenantBasePath,
  generateAndWriteConfig,
  type GeneratedConfig,
} from "../config-generator.js";

describe("Config Generator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test fixtures
  const mockOrganization: Organization = {
    id: "org-test-123",
    name: "Test Organization",
    externalTenantId: "entra-tenant-456",
    status: "ACTIVE" as OrgStatus,
    authorizedModels: [],
    defaultModelId: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  const mockTenantConfig: TenantConfig = {
    id: "config-789",
    organizationId: "org-test-123",
    model: "anthropic/claude-sonnet-4-20250514",
    agentName: "TestBot",
    systemPrompt: "You are a helpful assistant.",
    features: {},
    maxTokensPerDay: 100000,
    maxConcurrentSessions: 10,
    maxMemoryMb: 512,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  const mockTenantGateway: TenantGateway = {
    id: "gateway-abc",
    organizationId: "org-test-123",
    port: 8100,
    pid: null,
    status: "HEALTHY" as GatewayStatus,
    lastHealthCheck: new Date("2024-01-01"),
    consecutiveFailures: 0,
    memoryMb: 256,
    cpuPercent: 5.0,
    activeSessions: 2,
    configPath: "/tenants/org-test-123/openclaw.json",
    statePath: "/tenants/org-test-123/state",
    workspacePath: "/tenants/org-test-123/workspace",
    startedAt: new Date("2024-01-01"),
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  describe("generateTenantToken", () => {
    it("should generate a token with correct prefix", async () => {
      const token = await generateTenantToken("org-123");
      expect(token).toMatch(/^gt_org-123_/);
    });

    it("should generate unique tokens for same org", async () => {
      const token1 = await generateTenantToken("org-123");
      const token2 = await generateTenantToken("org-123");
      expect(token1).not.toBe(token2);
    });

    it("should generate tokens with UUID suffix", async () => {
      const token = await generateTenantToken("org-123");
      const parts = token.split("_");
      expect(parts).toHaveLength(3);
      // UUID format check (8-4-4-4-12)
      expect(parts[2]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  describe("generateTenantConfig", () => {
    it("should generate valid config structure", async () => {
      const config = await generateTenantConfig(
        mockOrganization,
        mockTenantConfig,
        mockTenantGateway,
      );

      expect(config).toHaveProperty("gateway");
      expect(config).toHaveProperty("model");
      expect(config).toHaveProperty("agent");
      expect(config).toHaveProperty("stateDir");
      expect(config).toHaveProperty("sessions");
      expect(config).toHaveProperty("memory");
      expect(config).toHaveProperty("limits");
    });

    it("should include correct gateway port", async () => {
      const config = await generateTenantConfig(
        mockOrganization,
        mockTenantConfig,
        mockTenantGateway,
      );

      expect(config.gateway.port).toBe(8100);
    });

    it("should bind to localhost", async () => {
      const config = await generateTenantConfig(
        mockOrganization,
        mockTenantConfig,
        mockTenantGateway,
      );

      expect(config.gateway.bind).toBe("127.0.0.1");
    });

    it("should use token auth mode", async () => {
      const config = await generateTenantConfig(
        mockOrganization,
        mockTenantConfig,
        mockTenantGateway,
      );

      expect(config.gateway.auth.mode).toBe("token");
      expect(config.gateway.auth.token).toMatch(/^gt_org-test-123_/);
    });

    it("should include correct model", async () => {
      const config = await generateTenantConfig(
        mockOrganization,
        mockTenantConfig,
        mockTenantGateway,
      );

      expect(config.model).toBe("anthropic/claude-sonnet-4-20250514");
    });

    it("should include agent name and system prompt", async () => {
      const config = await generateTenantConfig(
        mockOrganization,
        mockTenantConfig,
        mockTenantGateway,
      );

      expect(config.agent.name).toBe("TestBot");
      expect(config.agent.systemPrompt).toBe("You are a helpful assistant.");
    });

    it("should handle missing systemPrompt (undefined)", async () => {
      const configWithoutPrompt = {
        ...mockTenantConfig,
        systemPrompt: null,
      };

      const config = await generateTenantConfig(
        mockOrganization,
        configWithoutPrompt,
        mockTenantGateway,
      );

      expect(config.agent.systemPrompt).toBeUndefined();
    });

    it("should generate correct paths using organization ID", async () => {
      const config = await generateTenantConfig(
        mockOrganization,
        mockTenantConfig,
        mockTenantGateway,
      );

      expect(config.stateDir).toBe("/tenants/org-test-123/state");
      expect(config.sessions.dir).toBe("/tenants/org-test-123/sessions");
      expect(config.memory.path).toBe("/tenants/org-test-123/memory/vectors.db");
    });

    it("should enable memory with sqlite-vec provider", async () => {
      const config = await generateTenantConfig(
        mockOrganization,
        mockTenantConfig,
        mockTenantGateway,
      );

      expect(config.memory.enabled).toBe(true);
      expect(config.memory.provider).toBe("sqlite-vec");
    });

    it("should include correct limits", async () => {
      const config = await generateTenantConfig(
        mockOrganization,
        mockTenantConfig,
        mockTenantGateway,
      );

      expect(config.limits.maxTokensPerDay).toBe(100000);
      expect(config.limits.maxConcurrentSessions).toBe(10);
      expect(config.limits.maxMemoryMb).toBe(512);
    });

    it("should use different ports for different gateways", async () => {
      const gateway1 = { ...mockTenantGateway, port: 8100 };
      const gateway2 = { ...mockTenantGateway, port: 8200 };

      const config1 = await generateTenantConfig(mockOrganization, mockTenantConfig, gateway1);
      const config2 = await generateTenantConfig(mockOrganization, mockTenantConfig, gateway2);

      expect(config1.gateway.port).toBe(8100);
      expect(config2.gateway.port).toBe(8200);
    });
  });

  describe("writeConfigToFile", () => {
    it("should create directory before writing", async () => {
      const config: GeneratedConfig = {
        gateway: { port: 8100, bind: "127.0.0.1", auth: { mode: "token", token: "test" } },
        model: "test-model",
        agent: { name: "Test" },
        stateDir: "/test/state",
        sessions: { dir: "/test/sessions" },
        memory: { enabled: true, provider: "sqlite-vec", path: "/test/memory.db" },
        limits: { maxTokensPerDay: 1000, maxConcurrentSessions: 5, maxMemoryMb: 256 },
      };

      await writeConfigToFile("org-123", config);

      expect(fs.mkdir).toHaveBeenCalledWith("/tenants/org-123", { recursive: true });
    });

    it("should write config as formatted JSON", async () => {
      const config: GeneratedConfig = {
        gateway: { port: 8100, bind: "127.0.0.1", auth: { mode: "token", token: "test" } },
        model: "test-model",
        agent: { name: "Test" },
        stateDir: "/test/state",
        sessions: { dir: "/test/sessions" },
        memory: { enabled: true, provider: "sqlite-vec", path: "/test/memory.db" },
        limits: { maxTokensPerDay: 1000, maxConcurrentSessions: 5, maxMemoryMb: 256 },
      };

      await writeConfigToFile("org-456", config);

      expect(fs.writeFile).toHaveBeenCalledWith(
        "/tenants/org-456/openclaw.json",
        JSON.stringify(config, null, 2),
      );
    });

    it("should return the config path", async () => {
      const config: GeneratedConfig = {
        gateway: { port: 8100, bind: "127.0.0.1", auth: { mode: "token", token: "test" } },
        model: "test-model",
        agent: { name: "Test" },
        stateDir: "/test/state",
        sessions: { dir: "/test/sessions" },
        memory: { enabled: true, provider: "sqlite-vec", path: "/test/memory.db" },
        limits: { maxTokensPerDay: 1000, maxConcurrentSessions: 5, maxMemoryMb: 256 },
      };

      const result = await writeConfigToFile("org-789", config);

      expect(result).toBe("/tenants/org-789/openclaw.json");
    });
  });

  describe("getConfigPath", () => {
    it("should return correct path for organization", () => {
      expect(getConfigPath("org-123")).toBe("/tenants/org-123/openclaw.json");
    });

    it("should handle UUID organization IDs", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      expect(getConfigPath(uuid)).toBe(`/tenants/${uuid}/openclaw.json`);
    });
  });

  describe("getTenantBasePath", () => {
    it("should return correct base path for organization", () => {
      expect(getTenantBasePath("org-123")).toBe("/tenants/org-123");
    });
  });

  describe("generateAndWriteConfig", () => {
    it("should generate config and write to file", async () => {
      const result = await generateAndWriteConfig(
        mockOrganization,
        mockTenantConfig,
        mockTenantGateway,
      );

      expect(result.config).toHaveProperty("gateway");
      expect(result.config.gateway.port).toBe(8100);
      expect(result.path).toBe("/tenants/org-test-123/openclaw.json");
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });
});
