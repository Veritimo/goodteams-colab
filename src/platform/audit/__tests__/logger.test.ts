/**
 * Tests for Audit Logger
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { UserRole } from "@prisma/client";

// Mock Prisma client
vi.mock("../../db/client.js", () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
      createMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "../../db/client.js";
import { logAudit, logSystemAudit, logAuditBatch, getAuditLogById } from "../logger.js";
import { AUDIT_ACTIONS } from "../actions.js";
import type { AuditContext, SystemAuditContext } from "../logger.js";

describe("Audit Logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("logAudit", () => {
    const mockContext: AuditContext = {
      user: {
        id: "user-123",
        role: "ADMIN" as UserRole,
        organizationId: "org-456",
      },
      ip: "192.168.1.1",
      userAgent: "Mozilla/5.0",
      requestId: "req-789",
    };

    it("should create an audit log entry", async () => {
      const mockAuditLog = {
        id: "audit-001",
        organizationId: "org-456",
        actorId: "user-123",
        actorRole: "ADMIN",
        action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
        targetType: "user",
        targetId: "target-user-123",
        details: {},
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        createdAt: new Date(),
      };

      vi.mocked(prisma.auditLog.create).mockResolvedValue(mockAuditLog);

      const result = await logAudit(
        mockContext,
        AUDIT_ACTIONS.USER_ROLE_CHANGED,
        "user",
        "target-user-123",
        { previousRole: "USER", newRole: "ADMIN" },
      );

      expect(prisma.auditLog.create).toHaveBeenCalledOnce();
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-456",
          actorId: "user-123",
          actorRole: "ADMIN",
          action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
          targetType: "user",
          targetId: "target-user-123",
          details: expect.objectContaining({
            previousRole: "USER",
            newRole: "ADMIN",
            riskLevel: "high",
            requestId: "req-789",
          }),
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0",
        },
      });
      expect(result).toEqual(mockAuditLog);
    });

    it("should handle null targetId", async () => {
      const mockAuditLog = {
        id: "audit-002",
        organizationId: "org-456",
        actorId: "user-123",
        actorRole: "ADMIN",
        action: AUDIT_ACTIONS.ORG_SETTINGS_UPDATED,
        targetType: "settings",
        targetId: null,
        details: {},
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        createdAt: new Date(),
      };

      vi.mocked(prisma.auditLog.create).mockResolvedValue(mockAuditLog);

      await logAudit(mockContext, AUDIT_ACTIONS.ORG_SETTINGS_UPDATED, "settings", null, {
        setting: "notifications",
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            targetId: null,
          }),
        }),
      );
    });

    it("should allow overriding risk level", async () => {
      const mockAuditLog = {
        id: "audit-003",
        organizationId: "org-456",
        actorId: "user-123",
        actorRole: "ADMIN",
        action: AUDIT_ACTIONS.USER_LOGIN,
        targetType: "session",
        targetId: null,
        details: {},
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        createdAt: new Date(),
      };

      vi.mocked(prisma.auditLog.create).mockResolvedValue(mockAuditLog);

      await logAudit(
        mockContext,
        AUDIT_ACTIONS.USER_LOGIN,
        "session",
        null,
        { suspicious: true },
        { riskLevel: "high" },
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            details: expect.objectContaining({
              riskLevel: "high",
              suspicious: true,
            }),
          }),
        }),
      );
    });

    it("should include correlation ID when provided", async () => {
      const mockAuditLog = {
        id: "audit-004",
        organizationId: "org-456",
        actorId: "user-123",
        actorRole: "ADMIN",
        action: AUDIT_ACTIONS.INVITATION_CREATED,
        targetType: "invitation",
        targetId: "inv-123",
        details: {},
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        createdAt: new Date(),
      };

      vi.mocked(prisma.auditLog.create).mockResolvedValue(mockAuditLog);

      await logAudit(
        mockContext,
        AUDIT_ACTIONS.INVITATION_CREATED,
        "invitation",
        "inv-123",
        { email: "test@example.com" },
        { correlationId: "batch-001" },
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            details: expect.objectContaining({
              correlationId: "batch-001",
            }),
          }),
        }),
      );
    });
  });

  describe("logSystemAudit", () => {
    const mockSystemContext: SystemAuditContext = {
      actorId: "SYSTEM",
      organizationId: "org-456",
      systemProcess: "invitation-expiry-cleanup",
    };

    it("should create a system audit log entry", async () => {
      const mockAuditLog = {
        id: "audit-sys-001",
        organizationId: "org-456",
        actorId: "SYSTEM",
        actorRole: "SUPER_ADMIN",
        action: AUDIT_ACTIONS.INVITATION_EXPIRED,
        targetType: "invitation",
        targetId: "inv-123",
        details: {},
        ipAddress: null,
        userAgent: "SYSTEM",
        createdAt: new Date(),
      };

      vi.mocked(prisma.auditLog.create).mockResolvedValue(mockAuditLog);

      const result = await logSystemAudit(
        mockSystemContext,
        AUDIT_ACTIONS.INVITATION_EXPIRED,
        "invitation",
        "inv-123",
        { reason: "Past expiry date" },
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-456",
          actorId: "SYSTEM",
          actorRole: "SUPER_ADMIN",
          action: AUDIT_ACTIONS.INVITATION_EXPIRED,
          targetType: "invitation",
          targetId: "inv-123",
          details: expect.objectContaining({
            reason: "Past expiry date",
            isSystemAction: true,
            systemProcess: "invitation-expiry-cleanup",
          }),
          ipAddress: null,
          userAgent: "SYSTEM",
        },
      });
      expect(result).toEqual(mockAuditLog);
    });
  });

  describe("logAuditBatch", () => {
    it("should create multiple audit log entries", async () => {
      vi.mocked(prisma.auditLog.createMany).mockResolvedValue({ count: 3 });

      const mockContext: AuditContext = {
        user: {
          id: "user-123",
          role: "ADMIN" as UserRole,
          organizationId: "org-456",
        },
      };

      const entries = [
        {
          ctx: mockContext,
          action: AUDIT_ACTIONS.USER_PERMISSION_GRANTED,
          targetType: "permission",
          targetId: "perm-1",
          details: { permission: "CRM_READ" },
        },
        {
          ctx: mockContext,
          action: AUDIT_ACTIONS.USER_PERMISSION_GRANTED,
          targetType: "permission",
          targetId: "perm-2",
          details: { permission: "CRM_WRITE" },
        },
        {
          ctx: mockContext,
          action: AUDIT_ACTIONS.USER_PERMISSION_GRANTED,
          targetType: "permission",
          targetId: "perm-3",
          details: { permission: "SQL_READ" },
        },
      ];

      const count = await logAuditBatch(entries);

      expect(prisma.auditLog.createMany).toHaveBeenCalledOnce();
      expect(prisma.auditLog.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            organizationId: "org-456",
            actorId: "user-123",
            action: AUDIT_ACTIONS.USER_PERMISSION_GRANTED,
          }),
        ]),
      });
      expect(count).toBe(3);
    });
  });

  describe("getAuditLogById", () => {
    it("should return audit log entry when found", async () => {
      const mockAuditLog = {
        id: "audit-001",
        organizationId: "org-456",
        actorId: "user-123",
        actorRole: "ADMIN" as UserRole,
        action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
        targetType: "user",
        targetId: "target-user-123",
        details: {},
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        createdAt: new Date(),
      };

      vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(mockAuditLog);

      const result = await getAuditLogById("audit-001", "org-456");

      expect(prisma.auditLog.findFirst).toHaveBeenCalledWith({
        where: {
          id: "audit-001",
          organizationId: "org-456",
        },
      });
      expect(result).toEqual(mockAuditLog);
    });

    it("should return null when not found", async () => {
      vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null);

      const result = await getAuditLogById("nonexistent", "org-456");

      expect(result).toBeNull();
    });

    it("should enforce tenant isolation", async () => {
      vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null);

      await getAuditLogById("audit-001", "different-org");

      expect(prisma.auditLog.findFirst).toHaveBeenCalledWith({
        where: {
          id: "audit-001",
          organizationId: "different-org",
        },
      });
    });
  });
});
