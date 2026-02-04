/**
 * Session Service Tests
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "../../db/client.js";
import { verifyAccessToken, verifyRefreshToken } from "../jwt.js";
import {
  getSessionConfig,
  createSession,
  refreshSession,
  revokeSession,
  revokeAllUserSessions,
  getUserSessions,
  getSession,
  cleanupExpiredSessions,
} from "../service.js";
import { SessionError, DEFAULT_SESSION_CONFIG } from "../types.js";

// Set up test environment
beforeAll(() => {
  if (!process.env.JWT_SECRET && !process.env.CREDENTIAL_ENCRYPTION_KEY) {
    process.env.JWT_SECRET = "test-secret-key-for-jwt-signing-must-be-long-enough";
  }
});

describe("Session Service", () => {
  // Test user and org
  let testUserId: string;
  let testOrgId: string;

  beforeEach(async () => {
    // Create test organization
    const org = await prisma.organization.create({
      data: {
        name: "Test Org",
        status: "ACTIVE",
      },
    });
    testOrgId = org.id;

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        role: "USER",
        organizationId: testOrgId,
      },
    });
    testUserId = user.id;
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.session.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.organization.deleteMany({ where: { id: testOrgId } });
  });

  describe("getSessionConfig", () => {
    it("should return defaults when no org specified", async () => {
      const config = await getSessionConfig(null);
      expect(config).toEqual(DEFAULT_SESSION_CONFIG);
    });

    it("should return defaults for non-existent org", async () => {
      const config = await getSessionConfig("non-existent-org");
      expect(config).toEqual(DEFAULT_SESSION_CONFIG);
    });

    it("should return org-specific config when available", async () => {
      // Create tenant config with custom values
      await prisma.tenantConfig.create({
        data: {
          organizationId: testOrgId,
          sessionAccessTokenTtlMinutes: 30,
          sessionRefreshTokenTtlDays: 7,
          sessionAbsoluteMaxDays: 60,
          sessionSlidingWindow: false,
          sessionMaxConcurrent: 5,
        },
      });

      const config = await getSessionConfig(testOrgId);
      expect(config.accessTokenTtlMinutes).toBe(30);
      expect(config.refreshTokenTtlDays).toBe(7);
      expect(config.absoluteMaxDays).toBe(60);
      expect(config.slidingWindow).toBe(false);
      expect(config.maxConcurrent).toBe(5);

      // Cleanup
      await prisma.tenantConfig.delete({ where: { organizationId: testOrgId } });
    });
  });

  describe("createSession", () => {
    it("should create a session and return tokens", async () => {
      const result = await createSession({
        userId: testUserId,
        userAgent: "Test Agent",
        ipAddress: "127.0.0.1",
      });

      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      expect(result.accessTokenExpiresAt).toBeGreaterThan(Date.now());
      expect(result.refreshTokenExpiresAt).toBeGreaterThan(Date.now());

      // Verify access token
      const accessPayload = await verifyAccessToken(result.accessToken);
      expect(accessPayload.sub).toBe(testUserId);

      // Verify refresh token
      const refreshPayload = await verifyRefreshToken(result.refreshToken);
      expect(refreshPayload.sub).toBe(testUserId);
    });

    it("should store session in database", async () => {
      const result = await createSession({ userId: testUserId });

      const refreshPayload = await verifyRefreshToken(result.refreshToken);
      const session = await prisma.session.findUnique({
        where: { id: refreshPayload.sid },
      });

      expect(session).toBeTruthy();
      expect(session?.userId).toBe(testUserId);
    });

    it("should throw for non-existent user", async () => {
      await expect(createSession({ userId: "non-existent-user" })).rejects.toThrow(SessionError);
    });

    it("should revoke oldest session when max concurrent reached", async () => {
      // Create tenant config with max 2 sessions
      await prisma.tenantConfig.create({
        data: {
          organizationId: testOrgId,
          sessionMaxConcurrent: 2,
        },
      });

      // Create 2 sessions
      const session1 = await createSession({ userId: testUserId });
      const session2 = await createSession({ userId: testUserId });

      // Create 3rd session - should revoke session1
      const session3 = await createSession({ userId: testUserId });

      // Check session1 is revoked
      const payload1 = await verifyRefreshToken(session1.refreshToken);
      const dbSession1 = await prisma.session.findUnique({
        where: { id: payload1.sid },
      });
      expect(dbSession1?.revokedAt).toBeTruthy();

      // Session2 and session3 should be active
      const payload2 = await verifyRefreshToken(session2.refreshToken);
      const dbSession2 = await prisma.session.findUnique({
        where: { id: payload2.sid },
      });
      expect(dbSession2?.revokedAt).toBeNull();

      // Cleanup
      await prisma.tenantConfig.delete({ where: { organizationId: testOrgId } });
    });
  });

  describe("refreshSession", () => {
    it("should refresh tokens and rotate refresh token", async () => {
      const original = await createSession({ userId: testUserId });

      // Wait a tiny bit to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10));

      const refreshed = await refreshSession(original.refreshToken);

      expect(refreshed.accessToken).toBeTruthy();
      expect(refreshed.refreshToken).toBeTruthy();
      expect(refreshed.refreshToken).not.toBe(original.refreshToken);
    });

    it("should reject reused refresh tokens", async () => {
      const original = await createSession({ userId: testUserId });

      // Use the refresh token once
      await refreshSession(original.refreshToken);

      // Try to reuse the old refresh token
      await expect(refreshSession(original.refreshToken)).rejects.toThrow(SessionError);
    });

    it("should reject revoked sessions", async () => {
      const original = await createSession({ userId: testUserId });
      const payload = await verifyRefreshToken(original.refreshToken);

      // Revoke the session
      await revokeSession(payload.sid);

      await expect(refreshSession(original.refreshToken)).rejects.toThrow(SessionError);
    });

    it("should extend expiry with sliding window", async () => {
      const original = await createSession({ userId: testUserId });
      const originalPayload = await verifyRefreshToken(original.refreshToken);

      // Get original expiry
      const originalSession = await prisma.session.findUnique({
        where: { id: originalPayload.sid },
      });
      const originalExpiry = originalSession!.expiresAt.getTime();

      // Wait a bit
      await new Promise((r) => setTimeout(r, 50));

      // Refresh
      await refreshSession(original.refreshToken);

      // Check new expiry is later (sliding window extends it)
      const updatedSession = await prisma.session.findUnique({
        where: { id: originalPayload.sid },
      });
      expect(updatedSession!.expiresAt.getTime()).toBeGreaterThan(originalExpiry);
    });
  });

  describe("revokeSession", () => {
    it("should mark session as revoked", async () => {
      const original = await createSession({ userId: testUserId });
      const payload = await verifyRefreshToken(original.refreshToken);

      await revokeSession(payload.sid, "test_reason");

      const session = await prisma.session.findUnique({
        where: { id: payload.sid },
      });
      expect(session?.revokedAt).toBeTruthy();
      expect(session?.revokedReason).toBe("test_reason");
    });
  });

  describe("revokeAllUserSessions", () => {
    it("should revoke all sessions for a user", async () => {
      // Create multiple sessions
      await createSession({ userId: testUserId });
      await createSession({ userId: testUserId });
      await createSession({ userId: testUserId });

      const count = await revokeAllUserSessions(testUserId, "logout_all");
      expect(count).toBe(3);

      // Check all are revoked
      const sessions = await prisma.session.findMany({
        where: { userId: testUserId },
      });
      expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);
    });
  });

  describe("getUserSessions", () => {
    it("should return active sessions only", async () => {
      // Create sessions
      const session1 = await createSession({ userId: testUserId });
      await createSession({ userId: testUserId });

      // Revoke one
      const payload1 = await verifyRefreshToken(session1.refreshToken);
      await revokeSession(payload1.sid);

      const sessions = await getUserSessions(testUserId);
      expect(sessions.length).toBe(1);
      expect(sessions[0].isRevoked).toBe(false);
    });
  });

  describe("getSession", () => {
    it("should return session info", async () => {
      const original = await createSession({
        userId: testUserId,
        userAgent: "Test Agent",
        ipAddress: "192.168.1.1",
      });
      const payload = await verifyRefreshToken(original.refreshToken);

      const session = await getSession(payload.sid);
      expect(session).toBeTruthy();
      expect(session?.userId).toBe(testUserId);
      expect(session?.userAgent).toBe("Test Agent");
      expect(session?.ipAddress).toBe("192.168.1.1");
    });

    it("should return null for non-existent session", async () => {
      const session = await getSession("non-existent-session");
      expect(session).toBeNull();
    });
  });

  describe("cleanupExpiredSessions", () => {
    it("should delete old expired sessions", async () => {
      // Create a session and manually set it as very old
      const result = await createSession({ userId: testUserId });
      const payload = await verifyRefreshToken(result.refreshToken);

      // Set session as expired 60 days ago
      const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      await prisma.session.update({
        where: { id: payload.sid },
        data: {
          expiresAt: oldDate,
          absoluteExpiresAt: oldDate,
        },
      });

      const deleted = await cleanupExpiredSessions();
      expect(deleted).toBeGreaterThanOrEqual(1);

      // Session should be gone
      const session = await prisma.session.findUnique({
        where: { id: payload.sid },
      });
      expect(session).toBeNull();
    });
  });
});
