/**
 * Tests for Audit Query Utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { UserRole, AuditLog } from "@prisma/client";

// Mock Prisma client
vi.mock("../../db/client.js", () => ({
  prisma: {
    auditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

import { prisma } from "../../db/client.js";
import {
  queryAuditLogs,
  queryAuditLogsPaginated,
  countAuditLogs,
  getAuditStats,
  getUserActivity,
  getResourceActivity,
  getHighRiskEvents,
} from "../query.js";
import { AUDIT_ACTIONS } from "../actions.js";

describe("Audit Query Utilities", () => {
  const mockAuditLogs: AuditLog[] = [
    {
      id: "audit-001",
      organizationId: "org-456",
      actorId: "user-123",
      actorRole: "ADMIN" as UserRole,
      action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
      targetType: "user",
      targetId: "target-user-1",
      details: { riskLevel: "high" },
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0",
      createdAt: new Date("2026-02-01T10:00:00Z"),
    },
    {
      id: "audit-002",
      organizationId: "org-456",
      actorId: "user-123",
      actorRole: "ADMIN" as UserRole,
      action: AUDIT_ACTIONS.USER_CREATED,
      targetType: "user",
      targetId: "target-user-2",
      details: { riskLevel: "medium" },
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0",
      createdAt: new Date("2026-02-01T09:00:00Z"),
    },
    {
      id: "audit-003",
      organizationId: "org-456",
      actorId: "user-456",
      actorRole: "USER" as UserRole,
      action: AUDIT_ACTIONS.USER_LOGIN,
      targetType: "session",
      targetId: null,
      details: { riskLevel: "low" },
      ipAddress: "10.0.0.1",
      userAgent: "Chrome/120.0",
      createdAt: new Date("2026-02-01T08:00:00Z"),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("queryAuditLogs", () => {
    it("should query with organization filter", async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue(mockAuditLogs);

      const result = await queryAuditLogs({
        organizationId: "org-456",
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-456" },
        take: 100,
        skip: 0,
        orderBy: { createdAt: "desc" },
      });
      expect(result).toEqual(mockAuditLogs);
    });

    it("should filter by actorId", async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([mockAuditLogs[0], mockAuditLogs[1]]);

      await queryAuditLogs({
        organizationId: "org-456",
        actorId: "user-123",
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            actorId: "user-123",
          }),
        }),
      );
    });

    it("should filter by exact action", async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([mockAuditLogs[0]]);

      await queryAuditLogs({
        organizationId: "org-456",
        action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
          }),
        }),
      );
    });

    it("should filter by action wildcard pattern", async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([mockAuditLogs[0], mockAuditLogs[1]]);

      await queryAuditLogs({
        organizationId: "org-456",
        action: "user.*",
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: { startsWith: "user." },
          }),
        }),
      );
    });

    it("should filter by multiple actions", async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([mockAuditLogs[0], mockAuditLogs[1]]);

      await queryAuditLogs({
        organizationId: "org-456",
        actions: [AUDIT_ACTIONS.USER_ROLE_CHANGED, AUDIT_ACTIONS.USER_CREATED],
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: { in: [AUDIT_ACTIONS.USER_ROLE_CHANGED, AUDIT_ACTIONS.USER_CREATED] },
          }),
        }),
      );
    });

    it("should filter by date range", async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([mockAuditLogs[0]]);

      const startDate = new Date("2026-02-01T09:30:00Z");
      const endDate = new Date("2026-02-01T10:30:00Z");

      await queryAuditLogs({
        organizationId: "org-456",
        startDate,
        endDate,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          }),
        }),
      );
    });

    it("should filter by target type and ID", async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([mockAuditLogs[0]]);

      await queryAuditLogs({
        organizationId: "org-456",
        targetType: "user",
        targetId: "target-user-1",
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            targetType: "user",
            targetId: "target-user-1",
          }),
        }),
      );
    });

    it("should respect limit and offset", async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([mockAuditLogs[1]]);

      await queryAuditLogs({
        organizationId: "org-456",
        limit: 1,
        offset: 1,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1,
          skip: 1,
        }),
      );
    });

    it("should cap limit at 1000", async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);

      await queryAuditLogs({
        organizationId: "org-456",
        limit: 5000,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1000,
        }),
      );
    });

    it("should support custom ordering", async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue(mockAuditLogs);

      await queryAuditLogs({
        organizationId: "org-456",
        orderBy: "action",
        orderDirection: "asc",
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { action: "asc" },
        }),
      );
    });
  });

  describe("countAuditLogs", () => {
    it("should count logs with filters", async () => {
      vi.mocked(prisma.auditLog.count).mockResolvedValue(42);

      const count = await countAuditLogs({
        organizationId: "org-456",
        action: "user.*",
      });

      expect(prisma.auditLog.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          organizationId: "org-456",
          action: { startsWith: "user." },
        }),
      });
      expect(count).toBe(42);
    });
  });

  describe("queryAuditLogsPaginated", () => {
    it("should return paginated results with metadata", async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue(mockAuditLogs.slice(0, 2));
      vi.mocked(prisma.auditLog.count).mockResolvedValue(3);

      const result = await queryAuditLogsPaginated({
        organizationId: "org-456",
        limit: 2,
        offset: 0,
      });

      expect(result).toEqual({
        logs: mockAuditLogs.slice(0, 2),
        total: 3,
        page: 1,
        pageSize: 2,
        totalPages: 2,
        hasMore: true,
      });
    });

    it("should indicate no more pages", async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([mockAuditLogs[2]]);
      vi.mocked(prisma.auditLog.count).mockResolvedValue(3);

      const result = await queryAuditLogsPaginated({
        organizationId: "org-456",
        limit: 2,
        offset: 2,
      });

      expect(result.hasMore).toBe(false);
      expect(result.page).toBe(2);
    });
  });

  describe("getAuditStats", () => {
    it("should return aggregated statistics", async () => {
      vi.mocked(prisma.auditLog.count).mockResolvedValue(100);
      vi.mocked(prisma.auditLog.groupBy).mockImplementation(async (args) => {
        const by = args?.by as string[];
        if (by.includes("action")) {
          return [
            { action: "user.role.changed", _count: { action: 50 } },
            { action: "user.login", _count: { action: 30 } },
          ] as any;
        }
        if (by.includes("actorId")) {
          return [
            { actorId: "user-123", _count: { actorId: 60 } },
            { actorId: "user-456", _count: { actorId: 40 } },
          ] as any;
        }
        if (by.includes("targetType")) {
          return [
            { targetType: "user", _count: { targetType: 80 } },
            { targetType: "session", _count: { targetType: 20 } },
          ] as any;
        }
        return [];
      });

      const stats = await getAuditStats({ organizationId: "org-456" });

      expect(stats.totalEvents).toBe(100);
      expect(stats.byAction).toEqual({
        "user.role.changed": 50,
        "user.login": 30,
      });
      expect(stats.byActor).toEqual({
        "user-123": 60,
        "user-456": 40,
      });
      expect(stats.byTargetType).toEqual({
        user: 80,
        session: 20,
      });
    });
  });

  describe("getUserActivity", () => {
    it("should query user's audit logs", async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([mockAuditLogs[0], mockAuditLogs[1]]);

      const result = await getUserActivity("org-456", "user-123", 10);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-456",
            actorId: "user-123",
          }),
          take: 10,
          orderBy: { createdAt: "desc" },
        }),
      );
      expect(result).toHaveLength(2);
    });
  });

  describe("getResourceActivity", () => {
    it("should query resource's audit logs", async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([mockAuditLogs[0]]);

      const result = await getResourceActivity("org-456", "user", "target-user-1", 25);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-456",
            targetType: "user",
            targetId: "target-user-1",
          }),
          take: 25,
        }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("getHighRiskEvents", () => {
    it("should query high-risk events within time window", async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([mockAuditLogs[0]]);

      const result = await getHighRiskEvents("org-456", 24, 50);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-456",
          }),
          take: 50,
        }),
      );
      expect(result).toHaveLength(1);
    });
  });
});
