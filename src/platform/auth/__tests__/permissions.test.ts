/**
 * Permission Constants Tests
 *
 * Tests the permission constants and utility functions
 */

import { describe, it, expect } from "vitest";
import {
  PERMISSIONS,
  ADMIN_IMPLICIT_PERMISSIONS,
  USER_IMPLICIT_PERMISSIONS,
  BILLING_IMPLICIT_PERMISSIONS,
  VIEWER_IMPLICIT_PERMISSIONS,
  SUPER_ADMIN_IMPLICIT_PERMISSIONS,
  ASSIGNABLE_PERMISSIONS,
  getImplicitPermissionsForRole,
  isAssignablePermission,
  getAllPermissions,
} from "../permissions.js";

describe("permissions.ts", () => {
  describe("PERMISSIONS constant", () => {
    it("should define all expected permissions", () => {
      expect(PERMISSIONS.MANAGE_USERS).toBe("MANAGE_USERS");
      expect(PERMISSIONS.MANAGE_MODELS).toBe("MANAGE_MODELS");
      expect(PERMISSIONS.USE_AI_AGENTS).toBe("USE_AI_AGENTS");
      expect(PERMISSIONS.MANAGE_SKILLS).toBe("MANAGE_SKILLS");
      expect(PERMISSIONS.USE_SKILLS).toBe("USE_SKILLS");
      expect(PERMISSIONS.MANAGE_INTEGRATIONS).toBe("MANAGE_INTEGRATIONS");
      expect(PERMISSIONS.CRM_CREATE).toBe("CRM_CREATE");
      expect(PERMISSIONS.CRM_UPDATE).toBe("CRM_UPDATE");
      expect(PERMISSIONS.CRM_DELETE).toBe("CRM_DELETE");
      expect(PERMISSIONS.SQL_EXECUTE).toBe("SQL_EXECUTE");
      expect(PERMISSIONS.MANAGE_GUARDRAILS).toBe("MANAGE_GUARDRAILS");
      expect(PERMISSIONS.VIEW_AUDIT_LOGS).toBe("VIEW_AUDIT_LOGS");
      expect(PERMISSIONS.MANAGE_BILLING).toBe("MANAGE_BILLING");
      expect(PERMISSIONS.VIEW_TEAM_MEMBERS).toBe("VIEW_TEAM_MEMBERS");
    });

    it("should be readonly (values match keys)", () => {
      for (const [key, value] of Object.entries(PERMISSIONS)) {
        expect(key).toBe(value);
      }
    });
  });

  describe("ADMIN_IMPLICIT_PERMISSIONS", () => {
    it("should include management permissions", () => {
      expect(ADMIN_IMPLICIT_PERMISSIONS).toContain("MANAGE_USERS");
      expect(ADMIN_IMPLICIT_PERMISSIONS).toContain("MANAGE_MODELS");
      expect(ADMIN_IMPLICIT_PERMISSIONS).toContain("MANAGE_SKILLS");
      expect(ADMIN_IMPLICIT_PERMISSIONS).toContain("MANAGE_INTEGRATIONS");
      expect(ADMIN_IMPLICIT_PERMISSIONS).toContain("MANAGE_GUARDRAILS");
      expect(ADMIN_IMPLICIT_PERMISSIONS).toContain("VIEW_AUDIT_LOGS");
    });

    it("should include user permissions", () => {
      expect(ADMIN_IMPLICIT_PERMISSIONS).toContain("USE_AI_AGENTS");
      expect(ADMIN_IMPLICIT_PERMISSIONS).toContain("USE_SKILLS");
    });

    it("should not include billing permissions", () => {
      expect(ADMIN_IMPLICIT_PERMISSIONS).not.toContain("MANAGE_BILLING");
    });
  });

  describe("USER_IMPLICIT_PERMISSIONS", () => {
    it("should include basic usage permissions", () => {
      expect(USER_IMPLICIT_PERMISSIONS).toContain("USE_AI_AGENTS");
      expect(USER_IMPLICIT_PERMISSIONS).toContain("USE_SKILLS");
      expect(USER_IMPLICIT_PERMISSIONS).toContain("VIEW_TEAM_MEMBERS");
    });

    it("should not include management permissions", () => {
      expect(USER_IMPLICIT_PERMISSIONS).not.toContain("MANAGE_USERS");
      expect(USER_IMPLICIT_PERMISSIONS).not.toContain("MANAGE_MODELS");
      expect(USER_IMPLICIT_PERMISSIONS).not.toContain("MANAGE_SKILLS");
    });
  });

  describe("BILLING_IMPLICIT_PERMISSIONS", () => {
    it("should include billing permission", () => {
      expect(BILLING_IMPLICIT_PERMISSIONS).toContain("MANAGE_BILLING");
    });

    it("should not include management permissions", () => {
      expect(BILLING_IMPLICIT_PERMISSIONS).not.toContain("MANAGE_USERS");
      expect(BILLING_IMPLICIT_PERMISSIONS).not.toContain("USE_AI_AGENTS");
    });
  });

  describe("VIEWER_IMPLICIT_PERMISSIONS", () => {
    it("should only have view permissions", () => {
      expect(VIEWER_IMPLICIT_PERMISSIONS).toContain("VIEW_TEAM_MEMBERS");
    });

    it("should not include any usage or management permissions", () => {
      expect(VIEWER_IMPLICIT_PERMISSIONS).not.toContain("USE_AI_AGENTS");
      expect(VIEWER_IMPLICIT_PERMISSIONS).not.toContain("USE_SKILLS");
      expect(VIEWER_IMPLICIT_PERMISSIONS).not.toContain("MANAGE_USERS");
    });
  });

  describe("SUPER_ADMIN_IMPLICIT_PERMISSIONS", () => {
    it("should include all permissions", () => {
      const allPerms = getAllPermissions();
      for (const perm of allPerms) {
        expect(SUPER_ADMIN_IMPLICIT_PERMISSIONS).toContain(perm);
      }
    });
  });

  describe("ASSIGNABLE_PERMISSIONS", () => {
    it("should include data operation permissions", () => {
      expect(ASSIGNABLE_PERMISSIONS).toContain("CRM_CREATE");
      expect(ASSIGNABLE_PERMISSIONS).toContain("CRM_UPDATE");
      expect(ASSIGNABLE_PERMISSIONS).toContain("CRM_DELETE");
      expect(ASSIGNABLE_PERMISSIONS).toContain("SQL_EXECUTE");
    });

    it("should not include role-based permissions", () => {
      expect(ASSIGNABLE_PERMISSIONS).not.toContain("MANAGE_USERS");
      expect(ASSIGNABLE_PERMISSIONS).not.toContain("USE_AI_AGENTS");
    });
  });

  describe("getImplicitPermissionsForRole", () => {
    it("should return admin permissions for ADMIN role", () => {
      const perms = getImplicitPermissionsForRole("ADMIN");
      expect(perms).toContain("MANAGE_USERS");
      expect(perms).toContain("USE_AI_AGENTS");
    });

    it("should return user permissions for USER role", () => {
      const perms = getImplicitPermissionsForRole("USER");
      expect(perms).toContain("USE_AI_AGENTS");
      expect(perms).not.toContain("MANAGE_USERS");
    });

    it("should return all permissions for SUPER_ADMIN role", () => {
      const perms = getImplicitPermissionsForRole("SUPER_ADMIN");
      const allPerms = getAllPermissions();
      expect(perms.length).toBe(allPerms.length);
    });

    it("should return billing permissions for BILLING role", () => {
      const perms = getImplicitPermissionsForRole("BILLING");
      expect(perms).toContain("MANAGE_BILLING");
      expect(perms).not.toContain("USE_AI_AGENTS");
    });

    it("should return view permissions for VIEWER role", () => {
      const perms = getImplicitPermissionsForRole("VIEWER");
      expect(perms).toContain("VIEW_TEAM_MEMBERS");
      expect(perms).not.toContain("USE_AI_AGENTS");
    });
  });

  describe("isAssignablePermission", () => {
    it("should return true for assignable permissions", () => {
      expect(isAssignablePermission("CRM_CREATE")).toBe(true);
      expect(isAssignablePermission("CRM_UPDATE")).toBe(true);
      expect(isAssignablePermission("CRM_DELETE")).toBe(true);
      expect(isAssignablePermission("SQL_EXECUTE")).toBe(true);
    });

    it("should return false for non-assignable permissions", () => {
      expect(isAssignablePermission("MANAGE_USERS")).toBe(false);
      expect(isAssignablePermission("USE_AI_AGENTS")).toBe(false);
      expect(isAssignablePermission("MANAGE_BILLING")).toBe(false);
    });

    it("should return false for unknown permissions", () => {
      expect(isAssignablePermission("UNKNOWN_PERMISSION")).toBe(false);
    });
  });

  describe("getAllPermissions", () => {
    it("should return all permission values", () => {
      const allPerms = getAllPermissions();
      expect(allPerms.length).toBeGreaterThan(0);
      expect(allPerms).toContain("MANAGE_USERS");
      expect(allPerms).toContain("USE_AI_AGENTS");
      expect(allPerms).toContain("CRM_CREATE");
    });

    it("should return an array", () => {
      const allPerms = getAllPermissions();
      expect(Array.isArray(allPerms)).toBe(true);
    });
  });
});
