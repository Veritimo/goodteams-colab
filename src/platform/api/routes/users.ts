/**
 * User routes for platform API
 *
 * Handles user management within an organization.
 *
 * Endpoints:
 * - GET    /api/platform/users         - List organization users
 * - GET    /api/platform/users/:id     - Get specific user
 * - PUT    /api/platform/users/:id/role - Change user role (admin only)
 * - DELETE /api/platform/users/:id     - Remove user from organization (admin only)
 * - GET    /api/platform/users/me      - Get current user profile
 *
 * @see docs/RBAC-STAFF-ONBOARDING.md §6.3 User Management
 */

import type { UserRole } from "@prisma/client";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../middleware/context.js";
import { AUDIT_ACTIONS, TARGET_TYPES } from "../../audit/actions.js";
import { logAudit, type AuditContext } from "../../audit/logger.js";
import { validateAdminChange, AdminContinuityError } from "../../auth/admin-guard.js";
import { prisma } from "../../db/client.js";
import { sendError, handleError } from "../middleware/errors.js";
import {
  requireAuth,
  requireAdmin,
  requireOrganization,
  composeMiddleware,
} from "../middleware/require-permission.js";
import { handlePermissions } from "./permissions.js";
import { sendJson, parseBody, type RouteHandler } from "./utils.js";

/**
 * User data structure for API responses
 */
export interface UserResponse {
  id: string;
  email: string;
  username: string | null;
  role: string;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * User list response
 */
export interface UsersListResponse {
  users: UserResponse[];
  total: number;
}

/**
 * Role change request body
 */
export interface RoleChangeRequest {
  role: "ADMIN" | "USER" | "BILLING" | "VIEWER";
}

/**
 * Handle user routes
 */
export const handleUsers: RouteHandler = async (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method?.toUpperCase() ?? "GET";

  try {
    // Forward permission-related routes to permissions handler
    // Matches: /api/platform/users/:id/permissions (GET, POST)
    // Matches: /api/platform/users/:id/permissions/:name (DELETE)
    if (path.includes("/permissions")) {
      await handlePermissions(req, res, ctx);
      return;
    }

    // GET /api/platform/users/me - Get current user profile
    if (path === "/api/platform/users/me" && method === "GET") {
      await handleGetCurrentUser(req, res, ctx);
      return;
    }

    // PUT /api/platform/users/:id/role - Change user role
    const roleMatch = path.match(/^\/api\/platform\/users\/([^/]+)\/role$/);
    if (roleMatch && method === "PUT") {
      const userId = roleMatch[1];
      await handleChangeRole(req, res, ctx, userId);
      return;
    }

    // GET /api/platform/users/:id - Get specific user
    const userMatch = path.match(/^\/api\/platform\/users\/([^/]+)$/);
    if (userMatch && method === "GET") {
      const userId = userMatch[1];
      await handleGetUser(req, res, ctx, userId);
      return;
    }

    // DELETE /api/platform/users/:id - Remove user from organization
    if (userMatch && method === "DELETE") {
      const userId = userMatch[1];
      await handleRemoveUser(req, res, ctx, userId);
      return;
    }

    // GET /api/platform/users - List organization users
    if (path === "/api/platform/users" && method === "GET") {
      await handleListUsers(req, res, ctx);
      return;
    }

    // Method not allowed
    sendError(res, "METHOD_NOT_ALLOWED", `Method ${method} not allowed for ${path}`);
  } catch (error) {
    handleError(res, error);
  }
};

/**
 * GET /api/platform/users - List organization users
 */
async function handleListUsers(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> {
  // Require auth + org membership
  const middleware = composeMiddleware(requireAuth(), requireOrganization());
  if (!(await middleware(ctx, res))) return;

  const users = await prisma.user.findMany({
    where: { organizationId: ctx.user!.orgId },
    orderBy: { createdAt: "asc" },
  });

  const response: UsersListResponse = {
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      externalId: user.externalId,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    })),
    total: users.length,
  };

  sendJson(res, response);
}

/**
 * GET /api/platform/users/:id - Get specific user
 */
async function handleGetUser(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
  userId: string,
): Promise<void> {
  // Require auth + org membership
  const middleware = composeMiddleware(requireAuth(), requireOrganization());
  if (!(await middleware(ctx, res))) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      permissions: true,
    },
  });

  if (!user) {
    sendError(res, "NOT_FOUND", "User not found");
    return;
  }

  // Check user belongs to same organization
  if (user.organizationId !== ctx.user!.orgId) {
    sendError(res, "FORBIDDEN", "User does not belong to your organization");
    return;
  }

  const response: UserResponse & { permissions: string[] } = {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    externalId: user.externalId,
    permissions: user.permissions.map((p) => p.name),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };

  sendJson(res, response);
}

/**
 * GET /api/platform/users/me - Get current user profile
 */
async function handleGetCurrentUser(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> {
  // Only require auth (not org membership - user might not be in an org yet)
  if (!(await requireAuth()(ctx, res))) return;

  const user = await prisma.user.findUnique({
    where: { id: ctx.user!.id },
    include: {
      permissions: true,
      organization: {
        select: { id: true, name: true, status: true },
      },
    },
  });

  // If user not in DB (e.g., stub auth for testing), return context info
  if (!user) {
    sendJson(res, {
      id: ctx.user!.id,
      email: ctx.user!.email,
      username: ctx.user!.name,
      role: ctx.user!.role.toUpperCase(),
      externalId: null,
      permissions: ctx.user!.permissions ?? [],
      organization: ctx.user!.orgId
        ? { id: ctx.user!.orgId, name: "Unknown", status: "ACTIVE" }
        : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _stub: true, // Indicates this is from stub auth, not DB
    });
    return;
  }

  sendJson(res, {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    externalId: user.externalId,
    permissions: user.permissions.map((p) => p.name),
    organization: user.organization
      ? {
          id: user.organization.id,
          name: user.organization.name,
          status: user.organization.status,
        }
      : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  });
}

/**
 * PUT /api/platform/users/:id/role - Change user role (admin only)
 */
async function handleChangeRole(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
  targetUserId: string,
): Promise<void> {
  // Require admin + org
  const middleware = composeMiddleware(requireAuth(), requireOrganization(), requireAdmin());
  if (!(await middleware(ctx, res))) return;

  // Parse body
  const body = await parseBody<RoleChangeRequest>(req);
  if (!body.ok) {
    sendError(res, "BAD_REQUEST", body.error);
    return;
  }

  const { role } = body.value;

  // Validate role
  const validRoles: UserRole[] = ["ADMIN", "USER", "BILLING", "VIEWER"];
  if (!role || !validRoles.includes(role as UserRole)) {
    sendError(res, "BAD_REQUEST", `Invalid role. Must be one of: ${validRoles.join(", ")}`);
    return;
  }

  // Check target user exists and belongs to this org
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    sendError(res, "NOT_FOUND", "User not found");
    return;
  }

  if (targetUser.organizationId !== ctx.user!.orgId) {
    sendError(res, "FORBIDDEN", "User does not belong to your organization");
    return;
  }

  // Validate admin continuity rules
  try {
    await validateAdminChange(
      targetUserId,
      role as UserRole,
      ctx.user!.orgId,
      ctx.user!.id, // Pass actor for self-action checks
    );
  } catch (error) {
    if (error instanceof AdminContinuityError) {
      sendError(res, "CONFLICT", error.message, { code: error.code });
      return;
    }
    throw error;
  }

  // Store old role for audit
  const oldRole = targetUser.role;

  // Update role
  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: { role: role as UserRole },
  });

  // Log audit event
  const auditCtx: AuditContext = {
    user: {
      id: ctx.user!.id,
      role: mapRoleToPrisma(ctx.user!.role),
      organizationId: ctx.user!.orgId,
    },
    ip: ctx.ip,
  };

  await logAudit(auditCtx, AUDIT_ACTIONS.USER_ROLE_CHANGED, TARGET_TYPES.USER, targetUserId, {
    email: targetUser.email,
    oldRole,
    newRole: role,
  });

  const response: UserResponse = {
    id: updatedUser.id,
    email: updatedUser.email,
    username: updatedUser.username,
    role: updatedUser.role,
    externalId: updatedUser.externalId,
    createdAt: updatedUser.createdAt.toISOString(),
    updatedAt: updatedUser.updatedAt.toISOString(),
  };

  sendJson(res, response);
}

/**
 * DELETE /api/platform/users/:id - Remove user from organization (admin only)
 */
async function handleRemoveUser(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
  targetUserId: string,
): Promise<void> {
  // Require admin + org
  const middleware = composeMiddleware(requireAuth(), requireOrganization(), requireAdmin());
  if (!(await middleware(ctx, res))) return;

  // Check target user exists and belongs to this org
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    sendError(res, "NOT_FOUND", "User not found");
    return;
  }

  if (targetUser.organizationId !== ctx.user!.orgId) {
    sendError(res, "FORBIDDEN", "User does not belong to your organization");
    return;
  }

  // Validate admin continuity rules (null = removal)
  try {
    await validateAdminChange(
      targetUserId,
      null, // null indicates removal
      ctx.user!.orgId,
      ctx.user!.id, // Pass actor for self-action checks
    );
  } catch (error) {
    if (error instanceof AdminContinuityError) {
      sendError(res, "CONFLICT", error.message, { code: error.code });
      return;
    }
    throw error;
  }

  // Unlink user from organization (don't delete user record)
  await prisma.user.update({
    where: { id: targetUserId },
    data: {
      organizationId: null,
      role: "USER", // Reset to default role
    },
  });

  // Log audit event
  const auditCtx: AuditContext = {
    user: {
      id: ctx.user!.id,
      role: mapRoleToPrisma(ctx.user!.role),
      organizationId: ctx.user!.orgId,
    },
    ip: ctx.ip,
  };

  await logAudit(auditCtx, AUDIT_ACTIONS.USER_REMOVED, TARGET_TYPES.USER, targetUserId, {
    email: targetUser.email,
    previousRole: targetUser.role,
  });

  sendJson(res, { success: true, message: "User removed from organization" });
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Map context role to Prisma UserRole
 */
function mapRoleToPrisma(role: string): UserRole {
  switch (role.toLowerCase()) {
    case "owner":
    case "admin":
      return "ADMIN";
    case "member":
    case "user":
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
