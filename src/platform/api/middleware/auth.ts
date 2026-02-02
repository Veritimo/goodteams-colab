/**
 * Authentication middleware for platform API
 *
 * Provides utilities for JWT verification and authentication.
 * Integrates with the RBAC permission system.
 *
 * Phase 2: Basic JWT stub + RBAC integration
 * Future: Full Entra SSO verification
 */

import type { ServerResponse } from "node:http";
import type { UserRole } from "@prisma/client";
import type { RequestContext, RequestUser } from "./context.js";
import { sendError } from "./errors.js";
import { getImplicitPermissionsForRole } from "../../auth/permissions.js";
import {
  checkPermissionForUser,
  type PermissionCheckUser,
} from "../../auth/check-permission.js";

/**
 * Legacy permission types (kept for backwards compatibility)
 * @deprecated Use PERMISSIONS from permissions.ts instead
 */
export type Permission =
  | "org:read"
  | "org:write"
  | "org:delete"
  | "users:read"
  | "users:write"
  | "users:delete"
  | "invitations:read"
  | "invitations:write"
  | "invitations:delete"
  | "audit:read"
  | "settings:read"
  | "settings:write";

/**
 * Legacy role-based permission mapping
 * @deprecated Use getImplicitPermissionsForRole from permissions.ts instead
 */
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: [
    "org:read",
    "org:write",
    "org:delete",
    "users:read",
    "users:write",
    "users:delete",
    "invitations:read",
    "invitations:write",
    "invitations:delete",
    "audit:read",
    "settings:read",
    "settings:write",
  ],
  admin: [
    "org:read",
    "org:write",
    "users:read",
    "users:write",
    "invitations:read",
    "invitations:write",
    "invitations:delete",
    "audit:read",
    "settings:read",
    "settings:write",
  ],
  member: ["org:read", "users:read", "settings:read"],
  viewer: ["org:read"],
};

/**
 * Map context role to Prisma UserRole
 */
function mapToPrismaRole(role: string): UserRole {
  switch (role.toLowerCase()) {
    case "owner":
      return "ADMIN";
    case "admin":
      return "ADMIN";
    case "member":
      return "USER";
    case "viewer":
      return "VIEWER";
    case "billing":
      return "BILLING";
    case "super_admin":
      return "SUPER_ADMIN";
    default:
      return "USER";
  }
}

/**
 * Check if context has a specific permission (legacy route permissions)
 */
export function hasPermission(ctx: RequestContext, permission: Permission): boolean {
  if (!ctx.user) {
    return false;
  }
  const rolePerms = ROLE_PERMISSIONS[ctx.user.role] ?? [];
  return rolePerms.includes(permission);
}

/**
 * Check if context has a permission using the new RBAC system
 */
export function hasRbacPermission(ctx: RequestContext, permission: string): boolean {
  if (!ctx.user) {
    return false;
  }

  const user: PermissionCheckUser = {
    id: ctx.user.id,
    role: mapToPrismaRole(ctx.user.role),
    organizationId: ctx.user.orgId,
  };

  return checkPermissionForUser(user, ctx.user.permissions ?? [], permission);
}

/**
 * Check if context has all specified permissions
 */
export function hasAllPermissions(ctx: RequestContext, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(ctx, p));
}

/**
 * Check if context has any of the specified permissions
 */
export function hasAnyPermission(ctx: RequestContext, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(ctx, p));
}

/**
 * Require authentication - returns false and sends error if not authenticated
 */
export function requireAuth(ctx: RequestContext, res: ServerResponse): boolean {
  if (!ctx.user) {
    sendError(res, "UNAUTHORIZED", "Authentication required");
    return false;
  }
  return true;
}

/**
 * Require specific permission - returns false and sends error if not permitted
 */
export function requirePermission(
  ctx: RequestContext,
  res: ServerResponse,
  permission: Permission,
): boolean {
  if (!requireAuth(ctx, res)) {
    return false;
  }
  if (!hasPermission(ctx, permission)) {
    sendError(res, "FORBIDDEN", "You don't have permission to perform this action", {
      required: permission,
    });
    return false;
  }
  return true;
}

/**
 * Require all specified permissions
 */
export function requireAllPermissions(
  ctx: RequestContext,
  res: ServerResponse,
  permissions: Permission[],
): boolean {
  if (!requireAuth(ctx, res)) {
    return false;
  }
  const missing = permissions.filter((p) => !hasPermission(ctx, p));
  if (missing.length > 0) {
    sendError(res, "FORBIDDEN", "You don't have permission to perform this action", {
      required: permissions,
      missing,
    });
    return false;
  }
  return true;
}

/**
 * Require any of the specified permissions
 */
export function requireAnyPermission(
  ctx: RequestContext,
  res: ServerResponse,
  permissions: Permission[],
): boolean {
  if (!requireAuth(ctx, res)) {
    return false;
  }
  if (!hasAnyPermission(ctx, permissions)) {
    sendError(res, "FORBIDDEN", "You don't have permission to perform this action", {
      requiredAny: permissions,
    });
    return false;
  }
  return true;
}

/**
 * Create a test JWT token (stub) for development/testing
 *
 * Format: "stub:" + base64(JSON user object)
 *
 * @param user - User data to encode
 * @returns Token string that can be used in Authorization header
 */
export function createTestToken(user: RequestUser): string {
  const json = JSON.stringify({
    id: user.id,
    email: user.email,
    name: user.name,
    orgId: user.orgId,
    role: user.role,
    permissions: user.permissions ?? [],
  });
  return `stub:${Buffer.from(json).toString("base64")}`;
}

/**
 * Get all permissions for the authenticated user
 *
 * Combines implicit role-based permissions with explicit grants
 */
export function getUserAllPermissions(ctx: RequestContext): string[] {
  if (!ctx.user) {
    return [];
  }

  const prismaRole = mapToPrismaRole(ctx.user.role);
  const implicitPerms = getImplicitPermissionsForRole(prismaRole);
  const explicitPerms = ctx.user.permissions ?? [];

  return Array.from(new Set([...implicitPerms, ...explicitPerms]));
}
