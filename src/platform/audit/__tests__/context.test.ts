/**
 * Tests for Audit Context Helper
 */

import { describe, it, expect } from "vitest";
import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import type { UserRole } from "@prisma/client";
import type { RequestContext, RequestUser } from "../../api/middleware/context.js";
import {
  createAuditContext,
  createAuditContextFromUser,
  extractClientIp,
  sanitizeUserAgent,
  hasAuditContext,
} from "../context.js";

describe("Audit Context Helper", () => {
  describe("createAuditContext", () => {
    const mockUser: RequestUser = {
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
      orgId: "org-456",
      role: "admin",
    };

    const mockSocket = {
      remoteAddress: "127.0.0.1",
    } as Socket;

    function createMockRequest(headers: Record<string, string> = {}): IncomingMessage {
      return {
        headers,
        socket: mockSocket,
      } as IncomingMessage;
    }

    it("should create audit context from authenticated request", () => {
      const req = createMockRequest({ "user-agent": "Mozilla/5.0" });
      const ctx: RequestContext = {
        requestId: "req-789",
        timestamp: new Date(),
        user: mockUser,
        tenant: null,
        ip: "192.168.1.1",
      };

      const auditCtx = createAuditContext(req, ctx);

      expect(auditCtx).not.toBeNull();
      expect(auditCtx!.user).toEqual({
        id: "user-123",
        role: "ADMIN",
        organizationId: "org-456",
      });
      expect(auditCtx!.ip).toBe("192.168.1.1");
      expect(auditCtx!.userAgent).toBe("Mozilla/5.0");
      expect(auditCtx!.requestId).toBe("req-789");
    });

    it("should return null for unauthenticated request", () => {
      const req = createMockRequest();
      const ctx: RequestContext = {
        requestId: "req-789",
        timestamp: new Date(),
        user: null,
        tenant: null,
        ip: "192.168.1.1",
      };

      const auditCtx = createAuditContext(req, ctx);

      expect(auditCtx).toBeNull();
    });

    it("should map owner role to ADMIN", () => {
      const req = createMockRequest();
      const ctx: RequestContext = {
        requestId: "req-789",
        timestamp: new Date(),
        user: { ...mockUser, role: "owner" },
        tenant: null,
        ip: "192.168.1.1",
      };

      const auditCtx = createAuditContext(req, ctx);

      expect(auditCtx!.user.role).toBe("ADMIN");
    });

    it("should map member role to USER", () => {
      const req = createMockRequest();
      const ctx: RequestContext = {
        requestId: "req-789",
        timestamp: new Date(),
        user: { ...mockUser, role: "member" },
        tenant: null,
        ip: "192.168.1.1",
      };

      const auditCtx = createAuditContext(req, ctx);

      expect(auditCtx!.user.role).toBe("USER");
    });

    it("should map viewer role to VIEWER", () => {
      const req = createMockRequest();
      const ctx: RequestContext = {
        requestId: "req-789",
        timestamp: new Date(),
        user: { ...mockUser, role: "viewer" },
        tenant: null,
        ip: "192.168.1.1",
      };

      const auditCtx = createAuditContext(req, ctx);

      expect(auditCtx!.user.role).toBe("VIEWER");
    });

    it("should handle missing user-agent", () => {
      const req = createMockRequest({}); // No user-agent header
      const ctx: RequestContext = {
        requestId: "req-789",
        timestamp: new Date(),
        user: mockUser,
        tenant: null,
        ip: "192.168.1.1",
      };

      const auditCtx = createAuditContext(req, ctx);

      expect(auditCtx!.userAgent).toBeUndefined();
    });
  });

  describe("createAuditContextFromUser", () => {
    it("should create audit context from user data", () => {
      const user = {
        id: "user-123",
        role: "ADMIN" as UserRole,
        organizationId: "org-456",
      };

      const auditCtx = createAuditContextFromUser(user);

      expect(auditCtx.user).toEqual(user);
      expect(auditCtx.ip).toBeUndefined();
      expect(auditCtx.userAgent).toBeUndefined();
    });

    it("should include optional fields when provided", () => {
      const user = {
        id: "user-123",
        role: "ADMIN" as UserRole,
        organizationId: "org-456",
      };

      const auditCtx = createAuditContextFromUser(user, {
        ip: "10.0.0.1",
        userAgent: "Background Job",
        requestId: "job-123",
        sessionId: "sess-456",
      });

      expect(auditCtx.ip).toBe("10.0.0.1");
      expect(auditCtx.userAgent).toBe("Background Job");
      expect(auditCtx.requestId).toBe("job-123");
      expect(auditCtx.sessionId).toBe("sess-456");
    });
  });

  describe("extractClientIp", () => {
    const mockSocket = {
      remoteAddress: "127.0.0.1",
    } as Socket;

    function createMockRequest(headers: Record<string, string> = {}): IncomingMessage {
      return {
        headers,
        socket: mockSocket,
      } as IncomingMessage;
    }

    it("should extract IP from X-Forwarded-For header", () => {
      const req = createMockRequest({
        "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178",
      });

      const ip = extractClientIp(req);

      expect(ip).toBe("203.0.113.195");
    });

    it("should extract IP from X-Real-IP header", () => {
      const req = createMockRequest({
        "x-real-ip": "203.0.113.195",
      });

      const ip = extractClientIp(req);

      expect(ip).toBe("203.0.113.195");
    });

    it("should prefer X-Forwarded-For over X-Real-IP", () => {
      const req = createMockRequest({
        "x-forwarded-for": "10.0.0.1",
        "x-real-ip": "203.0.113.195",
      });

      const ip = extractClientIp(req);

      expect(ip).toBe("10.0.0.1");
    });

    it("should skip trusted proxies", () => {
      const req = createMockRequest({
        "x-forwarded-for": "10.0.0.1, 192.168.1.1",
      });

      const ip = extractClientIp(req, ["10.0.0.1"]);

      expect(ip).toBe("192.168.1.1");
    });

    it("should fall back to socket address", () => {
      const req = createMockRequest({});

      const ip = extractClientIp(req);

      expect(ip).toBe("127.0.0.1");
    });

    it("should return unknown when no IP available", () => {
      const req = {
        headers: {},
        socket: { remoteAddress: undefined },
      } as unknown as IncomingMessage;

      const ip = extractClientIp(req);

      expect(ip).toBe("unknown");
    });
  });

  describe("sanitizeUserAgent", () => {
    it("should return undefined for undefined input", () => {
      expect(sanitizeUserAgent(undefined)).toBeUndefined();
    });

    it("should pass through normal user agents", () => {
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
      expect(sanitizeUserAgent(ua)).toBe(ua);
    });

    it("should truncate long user agents", () => {
      const longUa = "A".repeat(600);
      const result = sanitizeUserAgent(longUa, 500);

      expect(result).toHaveLength(503); // 500 + "..."
      expect(result?.endsWith("...")).toBe(true);
    });

    it("should respect custom max length", () => {
      const ua = "A".repeat(200);
      const result = sanitizeUserAgent(ua, 100);

      expect(result).toHaveLength(103);
    });
  });

  describe("hasAuditContext", () => {
    it("should return true for valid audit context", () => {
      const ctx = {
        user: {
          id: "user-123",
          role: "ADMIN" as UserRole,
          organizationId: "org-456",
        },
      };

      expect(hasAuditContext(ctx)).toBe(true);
    });

    it("should return false for null context", () => {
      expect(hasAuditContext(null)).toBe(false);
    });
  });
});
