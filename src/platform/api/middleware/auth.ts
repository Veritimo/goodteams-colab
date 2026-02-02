/**
 * Authentication middleware for platform API
 *
 * STUB: Basic structure for Phase 1. Full implementation in Phase 2 with Entra SSO.
 */

import type { ServerResponse } from "node:http";
import type { RequestContext } from "./context.js";
import { sendError } from "./errors.js";

/**
 * Permission types that can be required for endpoints
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
 * Role-based permission mapping
 *
 * STUB: Will be expanded in Phase 2 based on RBAC-STAFF-ONBOARDING.md
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
 * Check if context has a specific permission
 */
export function hasPermission(ctx: RequestContext, permission: Permission): boolean {
  if (!ctx.user) {
    return false;
  }
  const rolePerms = ROLE_PERMISSIONS[ctx.user.role] ?? [];
  return rolePerms.includes(permission);
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
