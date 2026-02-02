/**
 * Tests for Audit Export Utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { UserRole, AuditLog } from "@prisma/client";

// Mock query module
vi.mock("../query.js", () => ({
  queryAuditLogs: vi.fn(),
}));

import { queryAuditLogs } from "../query.js";
import {
  auditLogsToCsv,
  auditLogsToJson,
  exportAuditLogs,
  getExportContentType,
  getExportFilename,
  streamAuditExport,
} from "../export.js";
import { AUDIT_ACTIONS } from "../actions.js";

describe("Audit Export Utilities", () => {
  const mockAuditLogs: AuditLog[] = [
    {
      id: "audit-001",
      organizationId: "org-456",
      actorId: "user-123",
      actorRole: "ADMIN" as UserRole,
      action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
      targetType: "user",
      targetId: "target-user-1",
      details: { previousRole: "USER", newRole: "ADMIN" },
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
      details: { email: "test@example.com" },
      ipAddress: "192.168.1.1",
      userAgent: "Chrome/120.0",
      createdAt: new Date("2026-02-01T09:00:00Z"),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("auditLogsToCsv", () => {
    it("should convert logs to CSV format with header", () => {
      const csv = auditLogsToCsv(mockAuditLogs);
      const lines = csv.split("\n");

      expect(lines[0]).toBe(
        "ID,Timestamp,Organization ID,Actor ID,Actor Role,Action,Target Type,Target ID,IP Address,User Agent,Details",
      );
      expect(lines).toHaveLength(3); // Header + 2 data rows
      expect(lines[1]).toContain("audit-001");
      expect(lines[1]).toContain("2026-02-01T10:00:00.000Z");
      expect(lines[1]).toContain(AUDIT_ACTIONS.USER_ROLE_CHANGED);
    });

    it("should convert logs without header", () => {
      const csv = auditLogsToCsv(mockAuditLogs, false);
      const lines = csv.split("\n");

      expect(lines).toHaveLength(2); // No header, just data
      expect(lines[0]).toContain("audit-001");
    });

    it("should escape values with commas", () => {
      const logsWithCommas: AuditLog[] = [
        {
          ...mockAuditLogs[0],
          userAgent: "Mozilla/5.0, Chrome/120",
        },
      ];

      const csv = auditLogsToCsv(logsWithCommas);
      expect(csv).toContain('"Mozilla/5.0, Chrome/120"');
    });

    it("should escape values with quotes", () => {
      const logsWithQuotes: AuditLog[] = [
        {
          ...mockAuditLogs[0],
          userAgent: 'Test "quoted" value',
        },
      ];

      const csv = auditLogsToCsv(logsWithQuotes);
      expect(csv).toContain('"Test ""quoted"" value"');
    });

    it("should handle null values", () => {
      const logsWithNulls: AuditLog[] = [
        {
          ...mockAuditLogs[0],
          targetId: null,
          ipAddress: null,
          userAgent: null,
        },
      ];

      const csv = auditLogsToCsv(logsWithNulls);
      const lines = csv.split("\n");
      expect(lines[1]).toContain(",,"); // Empty values for null fields
    });
  });

  describe("auditLogsToJson", () => {
    it("should convert logs to JSON format", () => {
      const json = auditLogsToJson(mockAuditLogs);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual({
        id: "audit-001",
        timestamp: "2026-02-01T10:00:00.000Z",
        organizationId: "org-456",
        actor: {
          id: "user-123",
          role: "ADMIN",
        },
        action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
        target: {
          type: "user",
          id: "target-user-1",
        },
        details: { previousRole: "USER", newRole: "ADMIN" },
        metadata: {
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0",
        },
      });
    });

    it("should support pretty printing", () => {
      const json = auditLogsToJson(mockAuditLogs, true);
      expect(json).toContain("\n");
      expect(json).toContain("  ");
    });

    it("should not pretty print by default", () => {
      const json = auditLogsToJson(mockAuditLogs);
      expect(json).not.toContain("\n  ");
    });
  });

  describe("exportAuditLogs", () => {
    it("should export as CSV", async () => {
      vi.mocked(queryAuditLogs).mockResolvedValue(mockAuditLogs);

      const result = await exportAuditLogs({ organizationId: "org-456" }, "csv");

      expect(queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-456",
          limit: 10000,
        }),
      );
      expect(result).toContain("ID,Timestamp");
      expect(result).toContain("audit-001");
    });

    it("should export as JSON", async () => {
      vi.mocked(queryAuditLogs).mockResolvedValue(mockAuditLogs);

      const result = await exportAuditLogs({ organizationId: "org-456" }, "json");

      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(2);
    });

    it("should respect limit parameter up to max", async () => {
      vi.mocked(queryAuditLogs).mockResolvedValue(mockAuditLogs);

      await exportAuditLogs({ organizationId: "org-456", limit: 100000 }, "json");

      expect(queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50000, // Capped at 50000
        }),
      );
    });
  });

  describe("getExportContentType", () => {
    it("should return correct content type for CSV", () => {
      expect(getExportContentType("csv")).toBe("text/csv; charset=utf-8");
    });

    it("should return correct content type for JSON", () => {
      expect(getExportContentType("json")).toBe("application/json; charset=utf-8");
    });
  });

  describe("getExportFilename", () => {
    it("should generate filename with date", () => {
      const filename = getExportFilename("csv", "org-456");

      expect(filename).toMatch(/^audit-logs-org-456-\d{4}-\d{2}-\d{2}\.csv$/);
    });

    it("should use correct extension for JSON", () => {
      const filename = getExportFilename("json", "org-456");

      expect(filename).toMatch(/\.json$/);
    });
  });

  describe("streamAuditExport", () => {
    it("should stream CSV in chunks", async () => {
      vi.mocked(queryAuditLogs)
        .mockResolvedValueOnce(mockAuditLogs)
        .mockResolvedValueOnce([]);

      const chunks: string[] = [];
      for await (const chunk of streamAuditExport(
        { organizationId: "org-456" },
        "csv",
        2,
      )) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toContain("ID,Timestamp"); // Header in first chunk
    });

    it("should stream JSON with proper array formatting", async () => {
      vi.mocked(queryAuditLogs)
        .mockResolvedValueOnce(mockAuditLogs)
        .mockResolvedValueOnce([]);

      const chunks: string[] = [];
      for await (const chunk of streamAuditExport(
        { organizationId: "org-456" },
        "json",
        2,
      )) {
        chunks.push(chunk);
      }

      const fullJson = chunks.join("");
      expect(fullJson).toMatch(/^\[/);
      expect(fullJson).toMatch(/\]$/);

      const parsed = JSON.parse(fullJson);
      expect(parsed).toHaveLength(2);
    });

    it("should handle multiple chunks for JSON", async () => {
      vi.mocked(queryAuditLogs)
        .mockResolvedValueOnce([mockAuditLogs[0]])
        .mockResolvedValueOnce([mockAuditLogs[1]])
        .mockResolvedValueOnce([]);

      const chunks: string[] = [];
      for await (const chunk of streamAuditExport(
        { organizationId: "org-456" },
        "json",
        1,
      )) {
        chunks.push(chunk);
      }

      const fullJson = chunks.join("");
      const parsed = JSON.parse(fullJson);
      expect(parsed).toHaveLength(2);
    });
  });
});
