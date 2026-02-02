/**
 * Gateway Manager Tests
 *
 * Tests for the gateway process lifecycle manager
 */

import type { ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock child_process
vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

// Mock prisma
vi.mock("../../db/client.js", () => ({
  prisma: {
    tenantGateway: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { spawn } from "child_process";
import { prisma } from "../../db/client.js";
import {
  spawnGateway,
  stopGateway,
  restartGateway,
  getGatewayProcess,
  getGatewayStatus,
  sendSignal,
  isGatewayRunning,
  getRunningGatewayIds,
  stopAllGateways,
  _getRunningGatewaysMap,
  _clearRunningGateways,
} from "../gateway-manager.js";

// Create a mock ChildProcess
function createMockProcess(): ChildProcess & EventEmitter {
  const emitter = new EventEmitter() as ChildProcess & EventEmitter;
  emitter.pid = 12345;
  emitter.stdin = null;
  emitter.stdout = new EventEmitter() as any;
  emitter.stderr = new EventEmitter() as any;
  emitter.stdio = [null, emitter.stdout, emitter.stderr, null, null];
  emitter.killed = false;
  emitter.connected = true;
  emitter.exitCode = null;
  emitter.signalCode = null;
  emitter.spawnargs = [];
  emitter.spawnfile = "openclaw";
  emitter.kill = vi.fn().mockReturnValue(true);
  emitter.send = vi.fn();
  emitter.disconnect = vi.fn();
  emitter.unref = vi.fn();
  emitter.ref = vi.fn();
  (emitter as any)[Symbol.dispose] = vi.fn();
  return emitter;
}

describe("gateway-manager.ts", () => {
  const mockOrgId = "org-123";
  const mockGateway = {
    id: "gw-1",
    organizationId: mockOrgId,
    status: "PROVISIONING",
    port: 8080,
    configPath: "/config/org-123.yaml",
    pid: null,
    lastHealthCheck: null,
    consecutiveFailures: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    _clearRunningGateways();
  });

  afterEach(() => {
    _clearRunningGateways();
  });

  describe("spawnGateway", () => {
    it("should spawn gateway process correctly", async () => {
      const mockProcess = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess);
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(mockGateway);
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
        ...mockGateway,
        status: "STARTING",
      });

      await spawnGateway(mockOrgId);

      expect(spawn).toHaveBeenCalledWith(
        "openclaw",
        ["gateway", "run", "--config", mockGateway.configPath, "--port", "8080"],
        expect.objectContaining({
          detached: false,
          stdio: ["ignore", "pipe", "pipe"],
        }),
      );
    });

    it("should update status to STARTING", async () => {
      const mockProcess = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess);
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(mockGateway);
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
        ...mockGateway,
        status: "STARTING",
      });

      await spawnGateway(mockOrgId);

      expect(prisma.tenantGateway.update).toHaveBeenCalledWith({
        where: { organizationId: mockOrgId },
        data: {
          status: "STARTING",
          pid: 12345,
          consecutiveFailures: 0,
        },
      });
    });

    it("should track process in runningGateways map", async () => {
      const mockProcess = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess);
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(mockGateway);
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
        ...mockGateway,
        status: "STARTING",
      });

      await spawnGateway(mockOrgId);

      expect(isGatewayRunning(mockOrgId)).toBe(true);
      const gatewayProcess = getGatewayProcess(mockOrgId);
      expect(gatewayProcess).toBeDefined();
      expect(gatewayProcess?.port).toBe(8080);
    });

    it("should throw error if gateway not found", async () => {
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(null);

      await expect(spawnGateway(mockOrgId)).rejects.toThrow(
        `Gateway not found for organization: ${mockOrgId}`,
      );
    });

    it("should throw error if gateway in invalid status", async () => {
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue({
        ...mockGateway,
        status: "HEALTHY",
      });

      await expect(spawnGateway(mockOrgId)).rejects.toThrow(
        "Cannot spawn gateway in status: HEALTHY",
      );
    });

    it("should throw error if gateway already running", async () => {
      const mockProcess = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess);
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(mockGateway);
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
        ...mockGateway,
        status: "STARTING",
      });

      await spawnGateway(mockOrgId);

      // Reset mocks for second call
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue({
        ...mockGateway,
        status: "STOPPED",
      });

      await expect(spawnGateway(mockOrgId)).rejects.toThrow(
        `Gateway already running for organization: ${mockOrgId}`,
      );
    });

    it("should allow spawning from STOPPED status", async () => {
      const mockProcess = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess);
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue({
        ...mockGateway,
        status: "STOPPED",
      });
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
        ...mockGateway,
        status: "STARTING",
      });

      await spawnGateway(mockOrgId);

      expect(spawn).toHaveBeenCalled();
    });

    it("should allow spawning from FAILED status", async () => {
      const mockProcess = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess);
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue({
        ...mockGateway,
        status: "FAILED",
      });
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
        ...mockGateway,
        status: "STARTING",
      });

      await spawnGateway(mockOrgId);

      expect(spawn).toHaveBeenCalled();
    });

    it("should handle spawn errors gracefully", async () => {
      const mockProcess = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess);
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(mockGateway);
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
        ...mockGateway,
        status: "STARTING",
      });

      await spawnGateway(mockOrgId);

      // Simulate spawn error
      mockProcess.emit("error", new Error("spawn failed"));

      // Should have cleaned up
      expect(isGatewayRunning(mockOrgId)).toBe(false);
    });

    it("should update DB status to FAILED on unexpected exit", async () => {
      const mockProcess = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess);
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(mockGateway);
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
        ...mockGateway,
        status: "STARTING",
      });

      await spawnGateway(mockOrgId);

      // Simulate crash (exit code 1, no signal)
      mockProcess.emit("exit", 1, null);

      // Allow promise to resolve
      await new Promise((r) => setTimeout(r, 10));

      expect(prisma.tenantGateway.update).toHaveBeenLastCalledWith({
        where: { organizationId: mockOrgId },
        data: {
          status: "FAILED",
          pid: null,
        },
      });
    });

    it("should update DB status to STOPPED on graceful exit", async () => {
      const mockProcess = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess);
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(mockGateway);
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
        ...mockGateway,
        status: "STARTING",
      });

      await spawnGateway(mockOrgId);

      // Simulate SIGTERM exit
      mockProcess.emit("exit", null, "SIGTERM");

      // Allow promise to resolve
      await new Promise((r) => setTimeout(r, 10));

      expect(prisma.tenantGateway.update).toHaveBeenLastCalledWith({
        where: { organizationId: mockOrgId },
        data: {
          status: "STOPPED",
          pid: null,
        },
      });
    });
  });

  describe("stopGateway", () => {
    it("should send SIGTERM to stop gateway", async () => {
      const mockProcess = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess);
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(mockGateway);
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
        ...mockGateway,
        status: "STARTING",
      });

      // Spawn first
      await spawnGateway(mockOrgId);

      const killSpy = vi.spyOn(process, "kill").mockImplementation(() => {
        // Simulate process exit after SIGTERM
        setTimeout(() => mockProcess.emit("exit", 0, "SIGTERM"), 10);
        return true;
      });

      await stopGateway(mockOrgId);

      expect(killSpy).toHaveBeenCalledWith(12345, "SIGTERM");
      killSpy.mockRestore();
    });

    it("should force kill after timeout", async () => {
      vi.useFakeTimers();

      const mockProcess = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess);
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(mockGateway);
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
        ...mockGateway,
        status: "STARTING",
      });

      await spawnGateway(mockOrgId);

      const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);

      const stopPromise = stopGateway(mockOrgId);

      // Advance past timeout
      await vi.advanceTimersByTimeAsync(11_000);

      await stopPromise;

      // Should have been called twice: SIGTERM then SIGKILL
      expect(killSpy).toHaveBeenCalledWith(12345, "SIGTERM");
      expect(killSpy).toHaveBeenCalledWith(12345, "SIGKILL");

      killSpy.mockRestore();
      vi.useRealTimers();
    });

    it("should update DB status to STOPPED", async () => {
      const mockProcess = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess);
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(mockGateway);
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
        ...mockGateway,
        status: "STOPPED",
      });

      await spawnGateway(mockOrgId);

      vi.spyOn(process, "kill").mockImplementation(() => {
        setTimeout(() => mockProcess.emit("exit", 0, "SIGTERM"), 10);
        return true;
      });

      await stopGateway(mockOrgId);

      expect(prisma.tenantGateway.update).toHaveBeenLastCalledWith({
        where: { organizationId: mockOrgId },
        data: { status: "STOPPED", pid: null },
      });
    });

    it("should remove from runningGateways map", async () => {
      const mockProcess = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess);
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(mockGateway);
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
        ...mockGateway,
        status: "STOPPED",
      });

      await spawnGateway(mockOrgId);
      expect(isGatewayRunning(mockOrgId)).toBe(true);

      vi.spyOn(process, "kill").mockImplementation(() => {
        setTimeout(() => mockProcess.emit("exit", 0, "SIGTERM"), 10);
        return true;
      });

      await stopGateway(mockOrgId);

      expect(isGatewayRunning(mockOrgId)).toBe(false);
    });

    it("should handle stopping non-running gateway gracefully", async () => {
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
        ...mockGateway,
        status: "STOPPED",
      });

      // Should not throw
      await stopGateway(mockOrgId);

      expect(prisma.tenantGateway.update).toHaveBeenCalledWith({
        where: { organizationId: mockOrgId },
        data: { status: "STOPPED", pid: null },
      });
    });
  });

  describe("restartGateway", () => {
    it("should stop and then start gateway", async () => {
      const mockProcess1 = createMockProcess();
      const mockProcess2 = createMockProcess();
      mockProcess2.pid = 67890;

      let spawnCallCount = 0;
      vi.mocked(spawn).mockImplementation(() => {
        spawnCallCount++;
        return spawnCallCount === 1 ? mockProcess1 : mockProcess2;
      });

      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(mockGateway);
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
        ...mockGateway,
        status: "STARTING",
      });

      // First spawn
      await spawnGateway(mockOrgId);

      vi.spyOn(process, "kill").mockImplementation(() => {
        setTimeout(() => mockProcess1.emit("exit", 0, "SIGTERM"), 10);
        return true;
      });

      // Need to reset mock to allow respawn
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue({
        ...mockGateway,
        status: "STOPPED",
      });

      await restartGateway(mockOrgId);

      // Should have spawned twice
      expect(spawn).toHaveBeenCalledTimes(2);
    });
  });

  describe("getGatewayProcess", () => {
    it("should return process if running", async () => {
      const mockProcess = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess);
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(mockGateway);
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
        ...mockGateway,
        status: "STARTING",
      });

      await spawnGateway(mockOrgId);

      const gatewayProcess = getGatewayProcess(mockOrgId);
      expect(gatewayProcess).toBeDefined();
      expect(gatewayProcess?.port).toBe(8080);
      expect(gatewayProcess?.organizationId).toBe(mockOrgId);
    });

    it("should return undefined if not running", () => {
      const gatewayProcess = getGatewayProcess("non-existent");
      expect(gatewayProcess).toBeUndefined();
    });
  });

  describe("getGatewayStatus", () => {
    it("should return gateway info from database", async () => {
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue({
        ...mockGateway,
        status: "HEALTHY",
        pid: 12345,
        consecutiveFailures: 0,
      });

      const status = await getGatewayStatus(mockOrgId);

      expect(status).toEqual({
        organizationId: mockOrgId,
        port: 8080,
        status: "HEALTHY",
        pid: 12345,
        lastHealthCheck: null,
        consecutiveFailures: 0,
      });
    });

    it("should return null if gateway not found", async () => {
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(null);

      const status = await getGatewayStatus("non-existent");

      expect(status).toBeNull();
    });
  });

  describe("sendSignal", () => {
    it("should send signal to running gateway", async () => {
      const mockProcess = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess);
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(mockGateway);
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
        ...mockGateway,
        status: "STARTING",
      });

      await spawnGateway(mockOrgId);

      const killSpy = vi.spyOn(process, "kill").mockReturnValue(true);

      const result = sendSignal(mockOrgId, "SIGUSR1");

      expect(result).toBe(true);
      expect(killSpy).toHaveBeenCalledWith(12345, "SIGUSR1");
      killSpy.mockRestore();
    });

    it("should return false if gateway not running", () => {
      const result = sendSignal("non-existent", "SIGUSR1");
      expect(result).toBe(false);
    });

    it("should return false if process has no pid", async () => {
      const mockProcess = createMockProcess();
      mockProcess.pid = undefined;
      vi.mocked(spawn).mockReturnValue(mockProcess);
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(mockGateway);
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
        ...mockGateway,
        status: "STARTING",
      });

      await spawnGateway(mockOrgId);

      const result = sendSignal(mockOrgId, "SIGUSR1");
      expect(result).toBe(false);
    });
  });

  describe("getRunningGatewayIds", () => {
    it("should return all running gateway IDs", async () => {
      const mockProcess1 = createMockProcess();
      const mockProcess2 = createMockProcess();
      mockProcess2.pid = 67890;

      let callCount = 0;
      vi.mocked(spawn).mockImplementation(() => {
        callCount++;
        return callCount === 1 ? mockProcess1 : mockProcess2;
      });

      const gateway2 = { ...mockGateway, organizationId: "org-456", port: 8081 };

      vi.mocked(prisma.tenantGateway.findUnique)
        .mockResolvedValueOnce(mockGateway)
        .mockResolvedValueOnce(gateway2);
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
        ...mockGateway,
        status: "STARTING",
      });

      await spawnGateway("org-123");
      await spawnGateway("org-456");

      const ids = getRunningGatewayIds();
      expect(ids).toContain("org-123");
      expect(ids).toContain("org-456");
      expect(ids).toHaveLength(2);
    });
  });

  describe("stopAllGateways", () => {
    it("should stop all running gateways", async () => {
      const mockProcess1 = createMockProcess();
      const mockProcess2 = createMockProcess();
      mockProcess2.pid = 67890;

      let callCount = 0;
      vi.mocked(spawn).mockImplementation(() => {
        callCount++;
        return callCount === 1 ? mockProcess1 : mockProcess2;
      });

      const gateway2 = { ...mockGateway, organizationId: "org-456", port: 8081 };

      vi.mocked(prisma.tenantGateway.findUnique)
        .mockResolvedValueOnce(mockGateway)
        .mockResolvedValueOnce(gateway2);
      vi.mocked(prisma.tenantGateway.update).mockResolvedValue({
        ...mockGateway,
        status: "STOPPED",
      });

      await spawnGateway("org-123");
      await spawnGateway("org-456");

      vi.spyOn(process, "kill").mockImplementation((pid) => {
        setTimeout(() => {
          if (pid === 12345) mockProcess1.emit("exit", 0, "SIGTERM");
          else mockProcess2.emit("exit", 0, "SIGTERM");
        }, 10);
        return true;
      });

      await stopAllGateways();

      expect(getRunningGatewayIds()).toHaveLength(0);
    });
  });
});
