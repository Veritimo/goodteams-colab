/**
 * Permission Middleware for Platform API
 *
 * Provides middleware functions to protect routes based on
 * permissions and roles.
 *
 * Based on: docs/RBAC-STAFF-ONBOARDING.md §5.3 Feature Gating
 */

import type { ServerResponse } from "node:http";
import type { UserRole } from "@prisma/client";
import type { RequestContext } from "./context.js";
import { sendError } from "./errors.js";
import {
  checkPermissionForUser,
  type PermissionCheckUser,
} from "../../auth/check-permission.js";

/**
 * Middleware result type
 * Returns true if the check passed, false if it failed (and response was sent)
 */
export type MiddlewareResult = boolean;

/**
 * Middleware function signature
 */
export type Middleware = (
  ctx: RequestContext,
  res: ServerResponse
) => MiddlewareResult | Promise<MiddlewareResult>;

/**
 * Require authentication middleware
 *
 * Ensures the request has a valid authenticated user.
 * Returns false and sends 401 error if not authenticated.
 *
 * @returns Middleware function
 */
export function requireAuth(): Middleware {
  return (ctx: RequestContext, res: ServerResponse): MiddlewareResult => {
    if (!ctx.user) {
      sendError(res, "UNAUTHORIZED", "Authentication required");
      return false;
    }
    return true;
  };
}

/**
 * Require specific role(s) middleware
 *
 * Ensures the authenticated user has one of the specified roles.
 * Returns false and sends 403 error if role check fails.
 *
 * @param roles - One or more roles that are allowed
 * @returns Middleware function
 */
export function requireRole(...roles: UserRole[]): Middleware {
  return (ctx: RequestContext, res: ServerResponse): MiddlewareResult => {
    // First check authentication
    if (!ctx.user) {
      sendError(res, "UNAUTHORIZED", "Authentication required");
      return false;
    }

    // Map context user role to Prisma UserRole
    const userRole = mapContextRoleToPrisma(ctx.user.role);

    if (!roles.includes(userRole)) {
      sendError(
        res,
        "FORBIDDEN",
        `This action requires one of the following roles: ${roles.join(", ")}`,
        { requiredRoles: roles, currentRole: userRole }
      );
      return false;
    }

    return true;
  };
}

/**
 * Require specific permission middleware
 *
 * Ensures the authenticated user has the specified permission,
 * either through their role or explicit grant.
 *
 * @param permission - The permission required
 * @returns Middleware function
 */
export function requirePermission(permission: string): Middleware {
  return (ctx: RequestContext, res: ServerResponse): MiddlewareResult => {
    // First check authentication
    if (!ctx.user) {
      sendError(res, "UNAUTHORIZED", "Authentication required");
      return false;
    }

    // Build permission check user from context
    const user: PermissionCheckUser = {
      id: ctx.user.id,
      role: mapContextRoleToPrisma(ctx.user.role),
      organizationId: ctx.user.orgId,
    };

    // Get explicit permissions (from context if available, empty array otherwise)
    const explicitPerms = ctx.user.permissions ?? [];

    // Check permission
    if (!checkPermissionForUser(user, explicitPerms, permission)) {
      sendError(
        res,
        "FORBIDDEN",
        `Permission denied: ${permission} is required for this action`,
        { requiredPermission: permission }
      );
      return false;
    }

    return true;
  };
}

/**
 * Require all of the specified permissions middleware
 *
 * @param permissions - Array of permissions all required
 * @returns Middleware function
 */
export function requireAllPermissions(permissions: string[]): Middleware {
  return (ctx: RequestContext, res: ServerResponse): MiddlewareResult => {
    if (!ctx.user) {
      sendError(res, "UNAUTHORIZED", "Authentication required");
      return false;
    }

    const user: PermissionCheckUser = {
      id: ctx.user.id,
      role: mapContextRoleToPrisma(ctx.user.role),
      organizationId: ctx.user.orgId,
    };

    const explicitPerms = ctx.user.permissions ?? [];
    const missing = permissions.filter(
      (p) => !checkPermissionForUser(user, explicitPerms, p)
    );

    if (missing.length > 0) {
      sendError(
        res,
        "FORBIDDEN",
        `Missing required permissions: ${missing.join(", ")}`,
        { requiredPermissions: permissions, missing }
      );
      return false;
    }

    return true;
  };
}

/**
 * Require any of the specified permissions middleware
 *
 * @param permissions - Array of permissions (at least one required)
 * @returns Middleware function
 */
export function requireAnyPermission(permissions: string[]): Middleware {
  return (ctx: RequestContext, res: ServerResponse): MiddlewareResult => {
    if (!ctx.user) {
      sendError(res, "UNAUTHORIZED", "Authentication required");
      return false;
    }

    const user: PermissionCheckUser = {
      id: ctx.user.id,
      role: mapContextRoleToPrisma(ctx.user.role),
      organizationId: ctx.user.orgId,
    };

    const explicitPerms = ctx.user.permissions ?? [];
    const hasAny = permissions.some((p) =>
      checkPermissionForUser(user, explicitPerms, p)
    );

    if (!hasAny) {
      sendError(
        res,
        "FORBIDDEN",
        `At least one of these permissions is required: ${permissions.join(", ")}`,
        { requiredAny: permissions }
      );
      return false;
    }

    return true;
  };
}

/**
 * Require organization membership middleware
 *
 * Ensures the user belongs to an organization.
 *
 * @returns Middleware function
 */
export function requireOrganization(): Middleware {
  return (ctx: RequestContext, res: ServerResponse): MiddlewareResult => {
    if (!ctx.user) {
      sendError(res, "UNAUTHORIZED", "Authentication required");
      return false;
    }

    if (!ctx.user.orgId) {
      sendError(
        res,
        "FORBIDDEN",
        "You must belong to an organization to perform this action"
      );
      return false;
    }

    return true;
  };
}

/**
 * Require admin role middleware
 * Shorthand for requireRole("ADMIN", "SUPER_ADMIN")
 *
 * @returns Middleware function
 */
export function requireAdmin(): Middleware {
  return requireRole("ADMIN", "SUPER_ADMIN");
}

/**
 * Compose multiple middleware functions
 *
 * Runs each middleware in order, stopping if any returns false.
 *
 * @param middlewares - Array of middleware functions
 * @returns Combined middleware function
 */
export function composeMiddleware(...middlewares: Middleware[]): Middleware {
  return async (
    ctx: RequestContext,
    res: ServerResponse
  ): Promise<MiddlewareResult> => {
    for (const middleware of middlewares) {
      const result = await middleware(ctx, res);
      if (!result) {
        return false;
      }
    }
    return true;
  };
}

/**
 * Map context role string to Prisma UserRole enum
 *
 * The RequestContext uses lowercase role strings, but Prisma uses
 * uppercase enum values. This function handles the mapping.
 */
function mapContextRoleToPrisma(
  role: "owner" | "admin" | "member" | "viewer" | string
): UserRole {
  switch (role.toLowerCase()) {
    case "owner":
      return "ADMIN"; // Owner maps to ADMIN
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
