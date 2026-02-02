/**
 * Permission Checking Tests
 *
 * Tests the permission checking logic
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkPermissionForUser,
  getUserPermissionsFromData,
  isAdminRole,
  canManageRole,
  type PermissionCheckUser,
} from "../check-permission.js";
import { PERMISSIONS } from "../permissions.js";

describe("check-permission.ts", () => {
  describe("checkPermissionForUser", () => {
    it("should grant all permissions to SUPER_ADMIN", () => {
      const user: PermissionCheckUser = {
        id: "user-1",
        role: "SUPER_ADMIN",
        organizationId: "org-1",
      };

      expect(checkPermissionForUser(user, [], PERMISSIONS.MANAGE_USERS)).toBe(true);
      expect(checkPermissionForUser(user, [], PERMISSIONS.USE_AI_AGENTS)).toBe(true);
      expect(checkPermissionForUser(user, [], PERMISSIONS.CRM_DELETE)).toBe(true);
      expect(checkPermissionForUser(user, [], "ANY_PERMISSION")).toBe(true);
    });

    it("should grant implicit permissions to ADMIN", () => {
      const user: PermissionCheckUser = {
        id: "user-1",
        role: "ADMIN",
        organizationId: "org-1",
      };

      expect(checkPermissionForUser(user, [], PERMISSIONS.MANAGE_USERS)).toBe(true);
      expect(checkPermissionForUser(user, [], PERMISSIONS.MANAGE_MODELS)).toBe(true);
      expect(checkPermissionForUser(user, [], PERMISSIONS.USE_AI_AGENTS)).toBe(true);
      expect(checkPermissionForUser(user, [], PERMISSIONS.VIEW_AUDIT_LOGS)).toBe(true);
    });

    it("should deny non-implicit permissions to ADMIN without explicit grant", () => {
      const user: PermissionCheckUser = {
        id: "user-1",
        role: "ADMIN",
        organizationId: "org-1",
      };

      // CRM operations are not implicit for ADMIN
      expect(checkPermissionForUser(user, [], PERMISSIONS.CRM_CREATE)).toBe(false);
      expect(checkPermissionForUser(user, [], PERMISSIONS.CRM_DELETE)).toBe(false);
      expect(checkPermissionForUser(user, [], PERMISSIONS.SQL_EXECUTE)).toBe(false);
    });

    it("should grant implicit permissions to USER", () => {
      const user: PermissionCheckUser = {
        id: "user-1",
        role: "USER",
        organizationId: "org-1",
      };

      expect(checkPermissionForUser(user, [], PERMISSIONS.USE_AI_AGENTS)).toBe(true);
      expect(checkPermissionForUser(user, [], PERMISSIONS.USE_SKILLS)).toBe(true);
      expect(checkPermissionForUser(user, [], PERMISSIONS.VIEW_TEAM_MEMBERS)).toBe(true);
    });

    it("should deny admin permissions to USER", () => {
      const user: PermissionCheckUser = {
        id: "user-1",
        role: "USER",
        organizationId: "org-1",
      };

      expect(checkPermissionForUser(user, [], PERMISSIONS.MANAGE_USERS)).toBe(false);
      expect(checkPermissionForUser(user, [], PERMISSIONS.MANAGE_MODELS)).toBe(false);
      expect(checkPermissionForUser(user, [], PERMISSIONS.VIEW_AUDIT_LOGS)).toBe(false);
    });

    it("should grant explicit permissions", () => {
      const user: PermissionCheckUser = {
        id: "user-1",
        role: "USER",
        organizationId: "org-1",
      };

      const explicitPerms = [PERMISSIONS.CRM_CREATE, PERMISSIONS.CRM_UPDATE];

      expect(checkPermissionForUser(user, explicitPerms, PERMISSIONS.CRM_CREATE)).toBe(true);
      expect(checkPermissionForUser(user, explicitPerms, PERMISSIONS.CRM_UPDATE)).toBe(true);
      expect(checkPermissionForUser(user, explicitPerms, PERMISSIONS.CRM_DELETE)).toBe(false);
    });

    it("should grant billing permission to BILLING role", () => {
      const user: PermissionCheckUser = {
        id: "user-1",
        role: "BILLING",
        organizationId: "org-1",
      };

      expect(checkPermissionForUser(user, [], PERMISSIONS.MANAGE_BILLING)).toBe(true);
      expect(checkPermissionForUser(user, [], PERMISSIONS.USE_AI_AGENTS)).toBe(false);
    });

    it("should grant only view permissions to VIEWER role", () => {
      const user: PermissionCheckUser = {
        id: "user-1",
        role: "VIEWER",
        organizationId: "org-1",
      };

      expect(checkPermissionForUser(user, [], PERMISSIONS.VIEW_TEAM_MEMBERS)).toBe(true);
      expect(checkPermissionForUser(user, [], PERMISSIONS.USE_AI_AGENTS)).toBe(false);
      expect(checkPermissionForUser(user, [], PERMISSIONS.MANAGE_USERS)).toBe(false);
    });
  });

  describe("getUserPermissionsFromData", () => {
    it("should combine implicit and explicit permissions", () => {
      const perms = getUserPermissionsFromData("USER", [PERMISSIONS.CRM_CREATE]);

      expect(perms).toContain(PERMISSIONS.USE_AI_AGENTS);
      expect(perms).toContain(PERMISSIONS.USE_SKILLS);
      expect(perms).toContain(PERMISSIONS.CRM_CREATE);
    });

    it("should deduplicate permissions", () => {
      const perms = getUserPermissionsFromData("USER", [
        PERMISSIONS.USE_AI_AGENTS, // Already implicit for USER
        PERMISSIONS.CRM_CREATE,
      ]);

      // Count occurrences of USE_AI_AGENTS
      const count = perms.filter((p) => p === PERMISSIONS.USE_AI_AGENTS).length;
      expect(count).toBe(1);
    });

    it("should return all permissions for SUPER_ADMIN", () => {
      const perms = getUserPermissionsFromData("SUPER_ADMIN", []);

      expect(perms).toContain(PERMISSIONS.MANAGE_USERS);
      expect(perms).toContain(PERMISSIONS.USE_AI_AGENTS);
      expect(perms).toContain(PERMISSIONS.CRM_CREATE);
      expect(perms).toContain(PERMISSIONS.MANAGE_BILLING);
    });
  });

  describe("isAdminRole", () => {
    it("should return true for ADMIN", () => {
      expect(isAdminRole("ADMIN")).toBe(true);
    });

    it("should return true for SUPER_ADMIN", () => {
      expect(isAdminRole("SUPER_ADMIN")).toBe(true);
    });

    it("should return false for USER", () => {
      expect(isAdminRole("USER")).toBe(false);
    });

    it("should return false for BILLING", () => {
      expect(isAdminRole("BILLING")).toBe(false);
    });

    it("should return false for VIEWER", () => {
      expect(isAdminRole("VIEWER")).toBe(false);
    });
  });

  describe("canManageRole", () => {
    it("SUPER_ADMIN can manage anyone", () => {
      expect(canManageRole("SUPER_ADMIN", "SUPER_ADMIN")).toBe(true);
      expect(canManageRole("SUPER_ADMIN", "ADMIN")).toBe(true);
      expect(canManageRole("SUPER_ADMIN", "USER")).toBe(true);
      expect(canManageRole("SUPER_ADMIN", "BILLING")).toBe(true);
      expect(canManageRole("SUPER_ADMIN", "VIEWER")).toBe(true);
    });

    it("ADMIN can manage non-admin roles", () => {
      expect(canManageRole("ADMIN", "USER")).toBe(true);
      expect(canManageRole("ADMIN", "BILLING")).toBe(true);
      expect(canManageRole("ADMIN", "VIEWER")).toBe(true);
    });

    it("ADMIN cannot manage ADMIN or SUPER_ADMIN", () => {
      expect(canManageRole("ADMIN", "ADMIN")).toBe(false);
      expect(canManageRole("ADMIN", "SUPER_ADMIN")).toBe(false);
    });

    it("USER cannot manage anyone", () => {
      expect(canManageRole("USER", "USER")).toBe(false);
      expect(canManageRole("USER", "VIEWER")).toBe(false);
      expect(canManageRole("USER", "ADMIN")).toBe(false);
    });

    it("BILLING cannot manage anyone", () => {
      expect(canManageRole("BILLING", "USER")).toBe(false);
      expect(canManageRole("BILLING", "VIEWER")).toBe(false);
    });

    it("VIEWER cannot manage anyone", () => {
      expect(canManageRole("VIEWER", "USER")).toBe(false);
      expect(canManageRole("VIEWER", "VIEWER")).toBe(false);
    });
  });
});
