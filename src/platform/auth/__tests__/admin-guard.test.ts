/**
 * Admin Continuity Guard Tests
 *
 * Tests the admin continuity logic that prevents
 * organizations from being locked out of admin access.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AdminContinuityError } from "../admin-guard.js";

// Mock Prisma
vi.mock("../../db/client.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import {
  validateAdminChange,
  validateRoleChange,
  validateUserRemoval,
  getAdminCount,
  wouldRemoveLastAdmin,
} from "../admin-guard.js";
import { prisma } from "../../db/client.js";

const mockPrisma = prisma as unknown as {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

describe("admin-guard.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateAdminChange", () => {
    it("should allow changing non-admin user role", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        role: "USER",
        organizationId: "org-1",
      });

      // Should not throw
      await expect(
        validateAdminChange("user-1", "VIEWER", "org-1")
      ).resolves.toBeUndefined();
    });

    it("should allow promoting user to admin", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        role: "USER",
        organizationId: "org-1",
      });

      await expect(
        validateAdminChange("user-1", "ADMIN", "org-1")
      ).resolves.toBeUndefined();
    });

    it("should allow demoting admin when multiple admins exist", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "admin-1",
        role: "ADMIN",
        organizationId: "org-1",
      });
      mockPrisma.user.count.mockResolvedValue(2);

      await expect(
        validateAdminChange("admin-1", "USER", "org-1")
      ).resolves.toBeUndefined();
    });

    it("should prevent demoting last admin", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "admin-1",
        role: "ADMIN",
        organizationId: "org-1",
      });
      mockPrisma.user.count.mockResolvedValue(1);

      await expect(
        validateAdminChange("admin-1", "USER", "org-1")
      ).rejects.toThrow(AdminContinuityError);

      try {
        await validateAdminChange("admin-1", "USER", "org-1");
      } catch (error) {
        expect(error).toBeInstanceOf(AdminContinuityError);
        expect((error as AdminContinuityError).code).toBe("LAST_ADMIN_DEMOTION");
      }
    });

    it("should prevent removing last admin", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "admin-1",
        role: "ADMIN",
        organizationId: "org-1",
      });
      mockPrisma.user.count.mockResolvedValue(1);

      await expect(
        validateAdminChange("admin-1", null, "org-1")
      ).rejects.toThrow(AdminContinuityError);

      try {
        await validateAdminChange("admin-1", null, "org-1");
      } catch (error) {
        expect(error).toBeInstanceOf(AdminContinuityError);
        expect((error as AdminContinuityError).code).toBe("LAST_ADMIN_REMOVAL");
      }
    });

    it("should prevent self-removal", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "admin-1",
        role: "ADMIN",
        organizationId: "org-1",
      });

      await expect(
        validateAdminChange("admin-1", null, "org-1", "admin-1")
      ).rejects.toThrow(AdminContinuityError);

      try {
        await validateAdminChange("admin-1", null, "org-1", "admin-1");
      } catch (error) {
        expect(error).toBeInstanceOf(AdminContinuityError);
        expect((error as AdminContinuityError).code).toBe("SELF_REMOVAL");
      }
    });

    it("should prevent self-demotion for admin", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "admin-1",
        role: "ADMIN",
        organizationId: "org-1",
      });

      await expect(
        validateAdminChange("admin-1", "USER", "org-1", "admin-1")
      ).rejects.toThrow(AdminContinuityError);

      try {
        await validateAdminChange("admin-1", "USER", "org-1", "admin-1");
      } catch (error) {
        expect(error).toBeInstanceOf(AdminContinuityError);
        expect((error as AdminContinuityError).code).toBe("SELF_DEMOTION");
      }
    });

    it("should throw error if user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        validateAdminChange("nonexistent", "USER", "org-1")
      ).rejects.toThrow("User not found");
    });

    it("should throw error if user not in organization", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        role: "USER",
        organizationId: "org-2", // Different org
      });

      await expect(
        validateAdminChange("user-1", "VIEWER", "org-1")
      ).rejects.toThrow("does not belong to organization");
    });

    it("should allow admin-to-admin role change", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "admin-1",
        role: "ADMIN",
        organizationId: "org-1",
      });

      // Changing from ADMIN to ADMIN (no-op) or SUPER_ADMIN should be allowed
      await expect(
        validateAdminChange("admin-1", "ADMIN", "org-1")
      ).resolves.toBeUndefined();
    });
  });

  describe("validateRoleChange", () => {
    it("should delegate to validateAdminChange", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        role: "USER",
        organizationId: "org-1",
      });

      await expect(
        validateRoleChange("user-1", "VIEWER", "org-1")
      ).resolves.toBeUndefined();
    });
  });

  describe("validateUserRemoval", () => {
    it("should delegate to validateAdminChange with null role", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        role: "USER",
        organizationId: "org-1",
      });

      await expect(
        validateUserRemoval("user-1", "org-1")
      ).resolves.toBeUndefined();
    });
  });

  describe("getAdminCount", () => {
    it("should return count of admins", async () => {
      mockPrisma.user.count.mockResolvedValue(3);

      const count = await getAdminCount("org-1");
      expect(count).toBe(3);
      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          role: { in: ["ADMIN", "SUPER_ADMIN"] },
        },
      });
    });
  });

  describe("wouldRemoveLastAdmin", () => {
    it("should return true when removing last admin", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "admin-1",
        role: "ADMIN",
      });
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await wouldRemoveLastAdmin("admin-1", "org-1");
      expect(result).toBe(true);
    });

    it("should return false when multiple admins exist", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "admin-1",
        role: "ADMIN",
      });
      mockPrisma.user.count.mockResolvedValue(2);

      const result = await wouldRemoveLastAdmin("admin-1", "org-1");
      expect(result).toBe(false);
    });

    it("should return false for non-admin user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        role: "USER",
      });

      const result = await wouldRemoveLastAdmin("user-1", "org-1");
      expect(result).toBe(false);
    });

    it("should return false for non-existent user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await wouldRemoveLastAdmin("nonexistent", "org-1");
      expect(result).toBe(false);
    });
  });

  describe("AdminContinuityError", () => {
    it("should have correct name and code", () => {
      const error = new AdminContinuityError("Test message", "LAST_ADMIN_REMOVAL");

      expect(error.name).toBe("AdminContinuityError");
      expect(error.code).toBe("LAST_ADMIN_REMOVAL");
      expect(error.message).toBe("Test message");
    });

    it("should be instanceof Error", () => {
      const error = new AdminContinuityError("Test", "SELF_DEMOTION");
      expect(error).toBeInstanceOf(Error);
    });
  });
});
