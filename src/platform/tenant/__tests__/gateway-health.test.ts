/**
 * Gateway Health Monitor Tests
 *
 * Tests for the gateway health monitoring and auto-restart functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock prisma
vi.mock("../../db/client.js", () => ({
  prisma: {
    tenantGateway: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock gateway-manager
vi.mock("../gateway-manager.js", () => ({
  restartGateway: vi.fn(),
  getGatewayProcess: vi.fn(),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { prisma } from "../../db/client.js";
import {
  startHealthMonitor,
  stopHealthMonitor,
  isHealthMonitorRunning,
  checkGatewayHealth,
  getBackoffInfo,
  clearBackoff,
  triggerHealthCheck,
  _getLastRestartAttempts,
  _clearLastRestartAttempts,
  _constants,
} from "../gateway-health.js";
import { restartGateway, getGatewayProcess } from "../gateway-manager.js";

describe("gateway-health.ts", () => {
  const mockOrgId = "org-123";
  const mockGateway = {
    id: "gw-1",
    organizationId: mockOrgId,
    status: "HEALTHY",
    port: 8080,
    configPath: "/config/org-123.yaml",
    pid: 12345,
    lastHealthCheck: null,
    consecutiveFailures: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    _clearLastRestartAttempts();
    stopHealthMonitor();
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopHealthMonitor();
    _clearLastRestartAttempts();
    vi.useRealTimers();
  });

  describe("startHealthMonitor / stopHealthMonitor", () => {
    it("should start health monitor", () => {
      expect(isHealthMonitorRunning()).toBe(false);
      startHealthMonitor();
      expect(isHealthMonitorRunning()).toBe(true);
    });

    it("should stop health monitor", () => {
      startHealthMonitor();
      expect(isHealthMonitorRunning()).toBe(true);
      stopHealthMonitor();
      expect(isHealthMonitorRunning()).toBe(false);
    });

    it("should not start multiple monitors", () => {
      startHealthMonitor();
      startHealthMonitor();
      expect(isHealthMonitorRunning()).toBe(true);
      stopHealthMonitor();
      expect(isHealthMonitorRunning()).toBe(false);
    });
  });

  describe("checkGatewayHealth", () => {
    it("should return true for healthy gateway", async () => {
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(mockGateway);
      vi.mocked(getGatewayProcess).mockReturnValue({
        process: {} as any,
        port: 8080,
        organizationId: mockOrgId,
        startedAt: new Date(),
      });
      mockFetch.mockResolvedValue({ ok: true });

      const isHealthy = await checkGatewayHealth(mockOrgId);

      expect(isHealthy).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://127.0.0.1:8080/health",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("should return false if gateway not found", async () => {
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(null);

      const isHealthy = await checkGatewayHealth(mockOrgId);

      expect(isHealthy).toBe(false);
    });

    it("should return false if process not running", async () => {
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(mockGateway);
      vi.mocked(getGatewayProcess).mockReturnValue(undefined);

      const isHealthy = await checkGatewayHealth(mockOrgId);

      expect(isHealthy).toBe(false);
    });

    it("should return false if health endpoint returns non-ok", async () => {
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(mockGateway);
      vi.mocked(getGatewayProcess).mockReturnValue({
        process: {} as any,
        port: 8080,
        organizationId: mockOrgId,
        startedAt: new Date(),
      });
      mockFetch.mockResolvedValue({ ok: false, status: 503 });

      const isHealthy = await checkGatewayHealth(mockOrgId);

      expect(isHealthy).toBe(false);
    });

    it("should return false if fetch throws", async () => {
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(mockGateway);
      vi.mocked(getGatewayProcess).mockReturnValue({
        process: {} as any,
        port: 8080,
        organizationId: mockOrgId,
        startedAt: new Date(),
      });
      mockFetch.mockRejectedValue(new Error("Connection refused"));

      const isHealthy = await checkGatewayHealth(mockOrgId);

      expect(isHealthy).toBe(false);
    });
  });

  describe("triggerHealthCheck", () => {
    it("should clear failures on successful check", async () => {
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue({
        ...mockGateway,
        consecutiveFailures: 2,
      });
      vi.mocked(getGatewayProcess).mockReturnValue({
        process: {} as any,
        port: 8080,
        organizationId: mockOrgId,
        startedAt: new Date(),
      });
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue({ ...mockGateway });
      mockFetch.mockResolvedValue({ ok: true });

      const status = await triggerHealthCheck(mockOrgId);

      expect(status).toBe("HEALTHY");
      expect(prisma.tenantGateway.update).toHaveBeenCalledWith({
        where: { organizationId: mockOrgId },
        data: {
          consecutiveFailures: 0,
          status: "HEALTHY",
          lastHealthCheck: expect.any(Date),
        },
      });
    });

    it("should increment failures on failed check", async () => {
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue({
        ...mockGateway,
        consecutiveFailures: 1,
      });
      vi.mocked(getGatewayProcess).mockReturnValue(undefined);
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue({ ...mockGateway });

      const status = await triggerHealthCheck(mockOrgId);

      expect(prisma.tenantGateway.update).toHaveBeenCalledWith({
        where: { organizationId: mockOrgId },
        data: {
          consecutiveFailures: 2,
          status: "HEALTHY", // Not UNHEALTHY yet (< 3 failures)
          lastHealthCheck: expect.any(Date),
        },
      });
    });

    it("should set status to UNHEALTHY after 3 failures", async () => {
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue({
        ...mockGateway,
        consecutiveFailures: 2,
        status: "HEALTHY",
      });
      vi.mocked(getGatewayProcess).mockReturnValue(undefined);
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue({ ...mockGateway });

      const status = await triggerHealthCheck(mockOrgId);

      expect(status).toBe("UNHEALTHY");
      expect(prisma.tenantGateway.update).toHaveBeenCalledWith({
        where: { organizationId: mockOrgId },
        data: {
          consecutiveFailures: 3,
          status: "UNHEALTHY",
          lastHealthCheck: expect.any(Date),
        },
      });
    });

    it("should return null if gateway not found", async () => {
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(null);

      const status = await triggerHealthCheck("non-existent");

      expect(status).toBeNull();
    });
  });

  describe("exponential backoff", () => {
    it("should track restart attempts", async () => {
      const restartMap = _getLastRestartAttempts();
      expect(restartMap.size).toBe(0);

      // Manually set a restart attempt
      restartMap.set(mockOrgId, { time: Date.now(), attempts: 1 });

      expect(restartMap.get(mockOrgId)?.attempts).toBe(1);
    });

    it("should calculate backoff info correctly", async () => {
      const restartMap = _getLastRestartAttempts();
      const now = Date.now();

      // Set restart attempt 10 seconds ago with 1 attempt
      restartMap.set(mockOrgId, { time: now - 10_000, attempts: 1 });

      const backoffInfo = getBackoffInfo(mockOrgId);

      expect(backoffInfo).not.toBeNull();
      expect(backoffInfo?.attempts).toBe(1);
      // Base backoff is 30s, so remaining should be ~20s
      expect(backoffInfo?.remainingMs).toBeGreaterThan(15_000);
      expect(backoffInfo?.remainingMs).toBeLessThanOrEqual(30_000);
    });

    it("should return null if no backoff active", () => {
      const backoffInfo = getBackoffInfo("non-existent");
      expect(backoffInfo).toBeNull();
    });

    it("should use exponential backoff (2x per attempt)", () => {
      const restartMap = _getLastRestartAttempts();
      const now = Date.now();

      // Attempt 1: base backoff (30s)
      restartMap.set(mockOrgId, { time: now, attempts: 1 });
      let info = getBackoffInfo(mockOrgId);
      expect(info?.remainingMs).toBeLessThanOrEqual(_constants.BASE_BACKOFF_MS);

      // Attempt 2: 2x backoff (60s)
      restartMap.set(mockOrgId, { time: now, attempts: 2 });
      info = getBackoffInfo(mockOrgId);
      expect(info?.remainingMs).toBeLessThanOrEqual(_constants.BASE_BACKOFF_MS * 2);

      // Attempt 3: 4x backoff (120s)
      restartMap.set(mockOrgId, { time: now, attempts: 3 });
      info = getBackoffInfo(mockOrgId);
      expect(info?.remainingMs).toBeLessThanOrEqual(_constants.BASE_BACKOFF_MS * 4);
    });

    it("should cap backoff at MAX_BACKOFF_MS", () => {
      const restartMap = _getLastRestartAttempts();
      const now = Date.now();

      // Many attempts should cap at max
      restartMap.set(mockOrgId, { time: now, attempts: 10 });
      const info = getBackoffInfo(mockOrgId);

      expect(info?.remainingMs).toBeLessThanOrEqual(_constants.MAX_BACKOFF_MS);
    });

    it("should clear backoff with clearBackoff", () => {
      const restartMap = _getLastRestartAttempts();
      restartMap.set(mockOrgId, { time: Date.now(), attempts: 3 });

      expect(getBackoffInfo(mockOrgId)).not.toBeNull();

      clearBackoff(mockOrgId);

      expect(getBackoffInfo(mockOrgId)).toBeNull();
    });
  });

  describe("health monitor loop", () => {
    it("should run health checks at interval", async () => {
      vi.mocked(prisma.tenantGateway.findMany).mockResolvedValue([mockGateway]);
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(mockGateway);
      vi.mocked(getGatewayProcess).mockReturnValue({
        process: {} as any,
        port: 8080,
        organizationId: mockOrgId,
        startedAt: new Date(),
      });
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue(mockGateway);
      mockFetch.mockResolvedValue({ ok: true });

      startHealthMonitor();

      // Advance past one interval
      await vi.advanceTimersByTimeAsync(_constants.HEALTH_CHECK_INTERVAL + 100);

      expect(prisma.tenantGateway.findMany).toHaveBeenCalled();
    });

    it("should trigger restart after MAX_CONSECUTIVE_FAILURES", async () => {
      // Gateway with 2 failures (next failure = 3 = restart)
      const unhealthyGateway = {
        ...mockGateway,
        consecutiveFailures: 2,
        status: "HEALTHY",
      };

      vi.mocked(prisma.tenantGateway.findMany).mockResolvedValue([unhealthyGateway]);
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(unhealthyGateway);
      vi.mocked(getGatewayProcess).mockReturnValue(undefined); // Not running = unhealthy
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
        ...unhealthyGateway,
        consecutiveFailures: 3,
        status: "UNHEALTHY",
      });
      vi.mocked(restartGateway).mockResolvedValue();

      startHealthMonitor();

      // Advance past one interval
      await vi.advanceTimersByTimeAsync(_constants.HEALTH_CHECK_INTERVAL + 100);

      expect(restartGateway).toHaveBeenCalledWith(mockOrgId);
    });

    it("should not restart if in backoff period", async () => {
      // Set up backoff
      const restartMap = _getLastRestartAttempts();
      restartMap.set(mockOrgId, { time: Date.now(), attempts: 1 });

      // Gateway already unhealthy
      const unhealthyGateway = {
        ...mockGateway,
        consecutiveFailures: 3,
        status: "UNHEALTHY",
      };

      vi.mocked(prisma.tenantGateway.findMany).mockResolvedValue([unhealthyGateway]);
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(unhealthyGateway);
      vi.mocked(getGatewayProcess).mockReturnValue(undefined);
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue(unhealthyGateway);

      startHealthMonitor();

      // Advance past one interval (but not past backoff)
      await vi.advanceTimersByTimeAsync(_constants.HEALTH_CHECK_INTERVAL + 100);

      // Should NOT restart because we're in backoff
      expect(restartGateway).not.toHaveBeenCalled();
    });

    it("should reset failures on successful health check", async () => {
      const gatewayWithFailures = {
        ...mockGateway,
        consecutiveFailures: 2,
      };

      vi.mocked(prisma.tenantGateway.findMany).mockResolvedValue([gatewayWithFailures]);
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(gatewayWithFailures);
      vi.mocked(getGatewayProcess).mockReturnValue({
        process: {} as any,
        port: 8080,
        organizationId: mockOrgId,
        startedAt: new Date(),
      });
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
        ...mockGateway,
        consecutiveFailures: 0,
      });
      mockFetch.mockResolvedValue({ ok: true });

      startHealthMonitor();

      await vi.advanceTimersByTimeAsync(_constants.HEALTH_CHECK_INTERVAL + 100);

      expect(prisma.tenantGateway.update).toHaveBeenCalledWith({
        where: { organizationId: mockOrgId },
        data: {
          consecutiveFailures: 0,
          status: "HEALTHY",
          lastHealthCheck: expect.any(Date),
        },
      });
    });

    it("should handle errors gracefully without crashing monitor", async () => {
      vi.mocked(prisma.tenantGateway.findMany).mockRejectedValue(new Error("DB error"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      startHealthMonitor();

      // Advance past multiple intervals
      await vi.advanceTimersByTimeAsync(_constants.HEALTH_CHECK_INTERVAL * 3);

      expect(isHealthMonitorRunning()).toBe(true); // Still running despite errors
      consoleSpy.mockRestore();
    });
  });
});
