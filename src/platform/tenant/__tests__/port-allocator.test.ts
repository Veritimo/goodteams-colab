/**
 * Tests for Port Allocator
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Prisma client
vi.mock("../../db/client.js", () => ({
  prisma: {
    tenantGateway: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from "../../db/client.js";
import { PortAllocator, createPortAllocator, PORT_RANGE, TOTAL_PORTS } from "../port-allocator.js";

describe("PortAllocator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should use default port range when no options provided", () => {
      const allocator = new PortAllocator(prisma as any);
      expect(allocator.totalPorts).toBe(TOTAL_PORTS);
    });

    it("should accept custom port range", () => {
      const allocator = new PortAllocator(prisma as any, {
        minPort: 20000,
        maxPort: 20100,
      });
      expect(allocator.totalPorts).toBe(101);
    });

    it("should throw error when minPort > maxPort", () => {
      expect(() => {
        new PortAllocator(prisma as any, { minPort: 20000, maxPort: 19000 });
      }).toThrow("Invalid port range");
    });

    it("should throw error for invalid port numbers", () => {
      expect(() => {
        new PortAllocator(prisma as any, { minPort: 0, maxPort: 100 });
      }).toThrow("Port range must be between 1 and 65535");

      expect(() => {
        new PortAllocator(prisma as any, { minPort: 1000, maxPort: 70000 });
      }).toThrow("Port range must be between 1 and 65535");
    });
  });

  describe("allocate", () => {
    it("should allocate first available port when none are allocated", async () => {
      vi.mocked(prisma.tenantGateway.findMany).mockResolvedValue([]);
      vi.mocked(prisma.tenantGateway.create).mockResolvedValue({
        id: "gw-001",
        organizationId: "org-123",
        port: PORT_RANGE.MIN,
        pid: null,
        status: "PROVISIONING",
        lastHealthCheck: null,
        consecutiveFailures: 0,
        memoryMb: null,
        cpuPercent: null,
        activeSessions: 0,
        configPath: "/config",
        statePath: "/state",
        workspacePath: "/workspace",
        startedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const allocator = new PortAllocator(prisma as any);
      const port = await allocator.allocate("org-123", "/config", "/state", "/workspace");

      expect(port).toBe(PORT_RANGE.MIN);
      expect(prisma.tenantGateway.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-123",
          port: PORT_RANGE.MIN,
          configPath: "/config",
          statePath: "/state",
          workspacePath: "/workspace",
        },
      });
    });

    it("should avoid already-allocated ports", async () => {
      vi.mocked(prisma.tenantGateway.findMany).mockResolvedValue([
        { port: PORT_RANGE.MIN, organizationId: "org-existing" },
        { port: PORT_RANGE.MIN + 1, organizationId: "org-another" },
      ]);
      vi.mocked(prisma.tenantGateway.create).mockResolvedValue({
        id: "gw-002",
        organizationId: "org-new",
        port: PORT_RANGE.MIN + 2,
        pid: null,
        status: "PROVISIONING",
        lastHealthCheck: null,
        consecutiveFailures: 0,
        memoryMb: null,
        cpuPercent: null,
        activeSessions: 0,
        configPath: "/config",
        statePath: "/state",
        workspacePath: "/workspace",
        startedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const allocator = new PortAllocator(prisma as any);
      const port = await allocator.allocate("org-new", "/config", "/state", "/workspace");

      expect(port).toBe(PORT_RANGE.MIN + 2);
    });

    it("should return null when no ports are available", async () => {
      // Create a small range for testing
      const allocator = new PortAllocator(prisma as any, {
        minPort: 18001,
        maxPort: 18003,
      });

      // All 3 ports are allocated
      vi.mocked(prisma.tenantGateway.findMany).mockResolvedValue([
        { port: 18001, organizationId: "org-1" },
        { port: 18002, organizationId: "org-2" },
        { port: 18003, organizationId: "org-3" },
      ]);

      const port = await allocator.allocate("org-new", "/config", "/state", "/workspace");

      expect(port).toBeNull();
      expect(prisma.tenantGateway.create).not.toHaveBeenCalled();
    });

    it("should handle concurrent allocation race condition", async () => {
      vi.mocked(prisma.tenantGateway.findMany).mockResolvedValue([]);

      // First port fails due to concurrent allocation, second succeeds
      vi.mocked(prisma.tenantGateway.create)
        .mockRejectedValueOnce(new Error("Unique constraint failed on port"))
        .mockResolvedValueOnce({
          id: "gw-003",
          organizationId: "org-concurrent",
          port: PORT_RANGE.MIN + 1,
          pid: null,
          status: "PROVISIONING",
          lastHealthCheck: null,
          consecutiveFailures: 0,
          memoryMb: null,
          cpuPercent: null,
          activeSessions: 0,
          configPath: "/config",
          statePath: "/state",
          workspacePath: "/workspace",
          startedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      const allocator = new PortAllocator(prisma as any);
      const port = await allocator.allocate("org-concurrent", "/config", "/state", "/workspace");

      expect(port).toBe(PORT_RANGE.MIN + 1);
      expect(prisma.tenantGateway.create).toHaveBeenCalledTimes(2);
    });

    it("should rethrow non-unique-constraint errors", async () => {
      vi.mocked(prisma.tenantGateway.findMany).mockResolvedValue([]);
      vi.mocked(prisma.tenantGateway.create).mockRejectedValue(
        new Error("Database connection failed"),
      );

      const allocator = new PortAllocator(prisma as any);

      await expect(
        allocator.allocate("org-error", "/config", "/state", "/workspace"),
      ).rejects.toThrow("Database connection failed");
    });
  });

  describe("release", () => {
    it("should release port for an organization", async () => {
      vi.mocked(prisma.tenantGateway.deleteMany).mockResolvedValue({ count: 1 });

      const allocator = new PortAllocator(prisma as any);
      const released = await allocator.release("org-123");

      expect(released).toBe(true);
      expect(prisma.tenantGateway.deleteMany).toHaveBeenCalledWith({
        where: { organizationId: "org-123" },
      });
    });

    it("should return false when no port was allocated", async () => {
      vi.mocked(prisma.tenantGateway.deleteMany).mockResolvedValue({ count: 0 });

      const allocator = new PortAllocator(prisma as any);
      const released = await allocator.release("org-nonexistent");

      expect(released).toBe(false);
    });
  });

  describe("releasePort", () => {
    it("should release a specific port", async () => {
      vi.mocked(prisma.tenantGateway.deleteMany).mockResolvedValue({ count: 1 });

      const allocator = new PortAllocator(prisma as any);
      const released = await allocator.releasePort(18005);

      expect(released).toBe(true);
      expect(prisma.tenantGateway.deleteMany).toHaveBeenCalledWith({
        where: { port: 18005 },
      });
    });

    it("should return false when port was not allocated", async () => {
      vi.mocked(prisma.tenantGateway.deleteMany).mockResolvedValue({ count: 0 });

      const allocator = new PortAllocator(prisma as any);
      const released = await allocator.releasePort(18005);

      expect(released).toBe(false);
    });
  });

  describe("getAllocatedPorts", () => {
    it("should return all allocated ports", async () => {
      const mockGateways = [
        { port: 18001, organizationId: "org-1" },
        { port: 18005, organizationId: "org-2" },
        { port: 18010, organizationId: "org-3" },
      ];
      vi.mocked(prisma.tenantGateway.findMany).mockResolvedValue(mockGateways);

      const allocator = new PortAllocator(prisma as any);
      const ports = await allocator.getAllocatedPorts();

      expect(ports).toEqual(mockGateways);
      expect(prisma.tenantGateway.findMany).toHaveBeenCalledWith({
        select: { port: true, organizationId: true },
      });
    });
  });

  describe("getPortForOrganization", () => {
    it("should return port for an organization", async () => {
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue({
        port: 18042,
      } as any);

      const allocator = new PortAllocator(prisma as any);
      const port = await allocator.getPortForOrganization("org-123");

      expect(port).toBe(18042);
      expect(prisma.tenantGateway.findUnique).toHaveBeenCalledWith({
        where: { organizationId: "org-123" },
        select: { port: true },
      });
    });

    it("should return null when organization has no port", async () => {
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(null);

      const allocator = new PortAllocator(prisma as any);
      const port = await allocator.getPortForOrganization("org-nonexistent");

      expect(port).toBeNull();
    });
  });

  describe("isPortAvailable", () => {
    it("should return true when port is available", async () => {
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue(null);

      const allocator = new PortAllocator(prisma as any);
      const available = await allocator.isPortAvailable(18050);

      expect(available).toBe(true);
    });

    it("should return false when port is allocated", async () => {
      vi.mocked(prisma.tenantGateway.findUnique).mockResolvedValue({
        id: "gw-001",
        port: 18050,
      } as any);

      const allocator = new PortAllocator(prisma as any);
      const available = await allocator.isPortAvailable(18050);

      expect(available).toBe(false);
    });

    it("should return false when port is outside range", async () => {
      const allocator = new PortAllocator(prisma as any);
      const available = await allocator.isPortAvailable(17000);

      expect(available).toBe(false);
      expect(prisma.tenantGateway.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("getAvailablePortCount", () => {
    it("should return correct count of available ports", async () => {
      vi.mocked(prisma.tenantGateway.count).mockResolvedValue(50);

      const allocator = new PortAllocator(prisma as any);
      const count = await allocator.getAvailablePortCount();

      expect(count).toBe(TOTAL_PORTS - 50);
    });
  });

  describe("isValidPort", () => {
    it("should return true for ports within range", () => {
      const allocator = new PortAllocator(prisma as any);

      expect(allocator.isValidPort(PORT_RANGE.MIN)).toBe(true);
      expect(allocator.isValidPort(PORT_RANGE.MAX)).toBe(true);
      expect(allocator.isValidPort(18500)).toBe(true);
    });

    it("should return false for ports outside range", () => {
      const allocator = new PortAllocator(prisma as any);

      expect(allocator.isValidPort(PORT_RANGE.MIN - 1)).toBe(false);
      expect(allocator.isValidPort(PORT_RANGE.MAX + 1)).toBe(false);
      expect(allocator.isValidPort(80)).toBe(false);
    });
  });

  describe("createPortAllocator factory", () => {
    it("should create a PortAllocator instance", () => {
      const allocator = createPortAllocator(prisma as any);
      expect(allocator).toBeInstanceOf(PortAllocator);
    });

    it("should pass options to constructor", () => {
      const allocator = createPortAllocator(prisma as any, {
        minPort: 30000,
        maxPort: 30100,
      });
      expect(allocator.totalPorts).toBe(101);
    });
  });

  describe("constants", () => {
    it("should export correct port range", () => {
      expect(PORT_RANGE.MIN).toBe(18001);
      expect(PORT_RANGE.MAX).toBe(18999);
    });

    it("should export correct total ports", () => {
      expect(TOTAL_PORTS).toBe(999);
    });
  });
});
