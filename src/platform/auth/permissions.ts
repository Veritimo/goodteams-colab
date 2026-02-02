/**
 * Permission Constants for Platform RBAC
 *
 * Defines all available permissions in the system.
 * Based on: docs/RBAC-STAFF-ONBOARDING.md §5 Permission System
 */

import type { UserRole } from "@prisma/client";

/**
 * All available permissions in the system
 */
export const PERMISSIONS = {
  // User Management
  MANAGE_USERS: "MANAGE_USERS",

  // AI & Models
  MANAGE_MODELS: "MANAGE_MODELS",
  USE_AI_AGENTS: "USE_AI_AGENTS",

  // Skills & Tools
  MANAGE_SKILLS: "MANAGE_SKILLS",
  USE_SKILLS: "USE_SKILLS",

  // Integrations
  MANAGE_INTEGRATIONS: "MANAGE_INTEGRATIONS",

  // Data Operations
  CRM_CREATE: "CRM_CREATE",
  CRM_UPDATE: "CRM_UPDATE",
  CRM_DELETE: "CRM_DELETE",
  SQL_EXECUTE: "SQL_EXECUTE",

  // Admin
  MANAGE_GUARDRAILS: "MANAGE_GUARDRAILS",
  VIEW_AUDIT_LOGS: "VIEW_AUDIT_LOGS",
  MANAGE_BILLING: "MANAGE_BILLING",

  // Team visibility (implicit for most roles)
  VIEW_TEAM_MEMBERS: "VIEW_TEAM_MEMBERS",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Permissions implicitly granted to SUPER_ADMIN role
 * SUPER_ADMIN has ALL permissions, so this is effectively all keys
 */
export const SUPER_ADMIN_IMPLICIT_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS);

/**
 * Permissions implicitly granted to ADMIN role
 * Based on docs/RBAC-STAFF-ONBOARDING.md §5.1
 */
export const ADMIN_IMPLICIT_PERMISSIONS: readonly Permission[] = [
  PERMISSIONS.MANAGE_USERS,
  PERMISSIONS.MANAGE_MODELS,
  PERMISSIONS.MANAGE_SKILLS,
  PERMISSIONS.MANAGE_INTEGRATIONS,
  PERMISSIONS.MANAGE_GUARDRAILS,
  PERMISSIONS.VIEW_AUDIT_LOGS,
  PERMISSIONS.USE_AI_AGENTS,
  PERMISSIONS.USE_SKILLS,
  PERMISSIONS.VIEW_TEAM_MEMBERS,
];

/**
 * Permissions implicitly granted to USER role
 * Based on docs/RBAC-STAFF-ONBOARDING.md §5.1
 */
export const USER_IMPLICIT_PERMISSIONS: readonly Permission[] = [
  PERMISSIONS.USE_AI_AGENTS,
  PERMISSIONS.USE_SKILLS,
  PERMISSIONS.VIEW_TEAM_MEMBERS,
];

/**
 * Permissions implicitly granted to BILLING role
 */
export const BILLING_IMPLICIT_PERMISSIONS: readonly Permission[] = [
  PERMISSIONS.MANAGE_BILLING,
  PERMISSIONS.VIEW_TEAM_MEMBERS,
];

/**
 * Permissions implicitly granted to VIEWER role
 */
export const VIEWER_IMPLICIT_PERMISSIONS: readonly Permission[] = [
  PERMISSIONS.VIEW_TEAM_MEMBERS,
];

/**
 * Permissions that can be explicitly assigned to users
 * These are data/integration-level permissions beyond basic role capabilities
 */
export const ASSIGNABLE_PERMISSIONS: readonly Permission[] = [
  PERMISSIONS.CRM_CREATE,
  PERMISSIONS.CRM_UPDATE,
  PERMISSIONS.CRM_DELETE,
  PERMISSIONS.SQL_EXECUTE,
];

/**
 * Get implicit permissions for a given role
 */
export function getImplicitPermissionsForRole(role: UserRole): readonly Permission[] {
  switch (role) {
    case "SUPER_ADMIN":
      return SUPER_ADMIN_IMPLICIT_PERMISSIONS;
    case "ADMIN":
      return ADMIN_IMPLICIT_PERMISSIONS;
    case "USER":
      return USER_IMPLICIT_PERMISSIONS;
    case "BILLING":
      return BILLING_IMPLICIT_PERMISSIONS;
    case "VIEWER":
      return VIEWER_IMPLICIT_PERMISSIONS;
    default:
      return [];
  }
}

/**
 * Check if a permission can be explicitly assigned
 */
export function isAssignablePermission(permission: string): boolean {
  return ASSIGNABLE_PERMISSIONS.includes(permission as Permission);
}

/**
 * All permission values as an array (for API exposure)
 */
export function getAllPermissions(): Permission[] {
  return Object.values(PERMISSIONS);
}
