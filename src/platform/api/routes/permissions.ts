/**
 * Permission management routes for platform API
 *
 * Endpoints:
 * - GET    /api/platform/permissions                 - List all permission types
 * - GET    /api/platform/users/:id/permissions       - Get user's permissions
 * - POST   /api/platform/users/:id/permissions       - Grant permission (admin only)
 * - DELETE /api/platform/users/:id/permissions/:name - Revoke permission (admin only)
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../middleware/context.js";
import { sendError } from "../middleware/errors.js";
import {
  requireAuth,
  requireAdmin,
} from "../middleware/require-permission.js";
import type { RouteHandler } from "./utils.js";
import { sendJson, readJsonBody, parsePathParams } from "./utils.js";
import {
  getAllPermissions,
  ASSIGNABLE_PERMISSIONS,
  PERMISSIONS,
  isAssignablePermission,
  getImplicitPermissionsForRole,
} from "../../auth/permissions.js";
import {
  getUserPermissions,
  getExplicitPermissions,
  grantPermission,
  revokePermission,
} from "../../auth/check-permission.js";
import { prisma } from "../../db/client.js";

/**
 * Base path for these routes
 */
const BASE_PATH = "/api/platform";

/**
 * Handle permission routes
 */
export const handlePermissions: RouteHandler = async (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext
): Promise<void> => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;
  const method = req.method ?? "GET";

  // GET /api/platform/permissions - List all permission types
  if (path === `${BASE_PATH}/permissions` && method === "GET") {
    return handleListPermissionTypes(req, res, ctx);
  }

  // Routes for user-specific permissions
  // GET /api/platform/users/:id/permissions
  // POST /api/platform/users/:id/permissions
  const userPermsMatch = parsePathParams(
    `${BASE_PATH}/users/:id/permissions`,
    path
  );
  if (userPermsMatch) {
    const userId = userPermsMatch.id;

    if (method === "GET") {
      return handleGetUserPermissions(req, res, ctx, userId);
    }

    if (method === "POST") {
      return handleGrantPermission(req, res, ctx, userId);
    }
  }

  // DELETE /api/platform/users/:id/permissions/:name
  const revokeMatch = parsePathParams(
    `${BASE_PATH}/users/:id/permissions/:name`,
    path
  );
  if (revokeMatch && method === "DELETE") {
    return handleRevokePermission(req, res, ctx, revokeMatch.id, revokeMatch.name);
  }

  // Method not allowed or route not found
  sendError(res, "NOT_FOUND", `Route not found: ${method} ${path}`);
};

/**
 * GET /api/platform/permissions
 * List all available permission types
 */
async function handleListPermissionTypes(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext
): Promise<void> {
  // Require authentication
  if (!requireAuth()(ctx, res)) {
    return;
  }

  const allPermissions = getAllPermissions();

  sendJson(res, {
    permissions: allPermissions.map((p) => ({
      name: p,
      assignable: isAssignablePermission(p),
      description: getPermissionDescription(p),
    })),
    assignablePermissions: ASSIGNABLE_PERMISSIONS,
    total: allPermissions.length,
  }, 200);
}

/**
 * GET /api/platform/users/:id/permissions
 * Get all permissions for a specific user
 */
async function handleGetUserPermissions(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
  userId: string
): Promise<void> {
  // Require authentication
  if (!requireAuth()(ctx, res)) {
    return;
  }

  // Users can view their own permissions, admins can view anyone's
  const isSelf = ctx.user?.id === userId;
  if (!isSelf && !requireAdmin()(ctx, res)) {
    return;
  }

  // Get user with role
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      organizationId: true,
    },
  });

  if (!user) {
    sendError(res, "NOT_FOUND", "User not found");
    return;
  }

  // Check org membership for non-self queries
  if (!isSelf && user.organizationId !== ctx.user?.orgId) {
    sendError(res, "FORBIDDEN", "User not in your organization");
    return;
  }

  // Get all permissions
  const allPermissions = await getUserPermissions(userId);
  const explicitPermissions = await getExplicitPermissions(userId);
  const implicitPermissions = getImplicitPermissionsForRole(user.role);

  sendJson(res, {
    userId: user.id,
    email: user.email,
    role: user.role,
    permissions: allPermissions,
    implicitPermissions: Array.from(implicitPermissions),
    explicitPermissions: explicitPermissions.map((p) => ({
      name: p.name,
      grantedAt: p.grantedAt.toISOString(),
      grantedBy: p.grantedBy,
    })),
  }, 200);
}

/**
 * POST /api/platform/users/:id/permissions
 * Grant a permission to a user
 */
async function handleGrantPermission(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
  userId: string
): Promise<void> {
  // Require admin role
  if (!requireAdmin()(ctx, res)) {
    return;
  }

  // Parse request body
  const bodyResult = await readJsonBody<{ permission: string }>(req);
  if (!bodyResult.ok) {
    // Type narrowed to { ok: false; error: string }
    const errorResult = bodyResult as { ok: false; error: string };
    sendError(res, "BAD_REQUEST", errorResult.error);
    return;
  }
  const body = bodyResult.value;

  const { permission } = body;
  if (!permission) {
    sendError(res, "BAD_REQUEST", "permission is required");
    return;
  }

  // Validate permission is assignable
  if (!isAssignablePermission(permission)) {
    sendError(
      res,
      "BAD_REQUEST",
      `Permission "${permission}" cannot be explicitly assigned. Assignable permissions: ${ASSIGNABLE_PERMISSIONS.join(", ")}`
    );
    return;
  }

  // Check target user exists and is in same org
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, organizationId: true },
  });

  if (!targetUser) {
    sendError(res, "NOT_FOUND", "User not found");
    return;
  }

  if (targetUser.organizationId !== ctx.user?.orgId) {
    sendError(res, "FORBIDDEN", "User not in your organization");
    return;
  }

  // Check if permission already exists
  const existing = await prisma.userPermission.findUnique({
    where: {
      userId_name: { userId, name: permission },
    },
  });

  if (existing) {
    sendError(res, "CONFLICT", "User already has this permission");
    return;
  }

  // Grant permission (user guaranteed by requireAdmin check above)
  const grantedById = ctx.user?.id ?? "";
  const granted = await grantPermission(userId, permission, grantedById);

  sendJson(res, {
    message: "Permission granted",
    permission: {
      id: granted.id,
      name: granted.name,
      userId: granted.userId,
      grantedAt: granted.grantedAt.toISOString(),
      grantedBy: granted.grantedBy,
    },
  }, 201);
}

/**
 * DELETE /api/platform/users/:id/permissions/:name
 * Revoke a permission from a user
 */
async function handleRevokePermission(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
  userId: string,
  permissionName: string
): Promise<void> {
  // Require admin role
  if (!requireAdmin()(ctx, res)) {
    return;
  }

  // Check target user exists and is in same org
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, organizationId: true },
  });

  if (!targetUser) {
    sendError(res, "NOT_FOUND", "User not found");
    return;
  }

  if (targetUser.organizationId !== ctx.user?.orgId) {
    sendError(res, "FORBIDDEN", "User not in your organization");
    return;
  }

  // Check if permission exists
  const existing = await prisma.userPermission.findUnique({
    where: {
      userId_name: { userId, name: permissionName },
    },
  });

  if (!existing) {
    sendError(res, "NOT_FOUND", "Permission not found for this user");
    return;
  }

  // Revoke permission
  await revokePermission(userId, permissionName);

  sendJson(res, {
    message: "Permission revoked",
    userId,
    permission: permissionName,
  }, 200);
}

/**
 * Get human-readable description for a permission
 */
function getPermissionDescription(permission: string): string {
  const descriptions: Record<string, string> = {
    [PERMISSIONS.MANAGE_USERS]: "Create, update, and remove organization members",
    [PERMISSIONS.MANAGE_MODELS]: "Configure authorized AI models and defaults",
    [PERMISSIONS.USE_AI_AGENTS]: "Interact with AI agents",
    [PERMISSIONS.MANAGE_SKILLS]: "Install, configure, and remove skills",
    [PERMISSIONS.USE_SKILLS]: "Use installed skills",
    [PERMISSIONS.MANAGE_INTEGRATIONS]: "Configure third-party integrations",
    [PERMISSIONS.CRM_CREATE]: "Create CRM records",
    [PERMISSIONS.CRM_UPDATE]: "Update CRM records",
    [PERMISSIONS.CRM_DELETE]: "Delete CRM records",
    [PERMISSIONS.SQL_EXECUTE]: "Execute SQL queries",
    [PERMISSIONS.MANAGE_GUARDRAILS]: "Configure AI guardrails and policies",
    [PERMISSIONS.VIEW_AUDIT_LOGS]: "View organization audit logs",
    [PERMISSIONS.MANAGE_BILLING]: "Access billing and subscription settings",
    [PERMISSIONS.VIEW_TEAM_MEMBERS]: "View organization team members",
  };

  return descriptions[permission] ?? "No description available";
}
