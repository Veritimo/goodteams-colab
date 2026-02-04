/**
 * Organization routes for platform API
 *
 * Handles organization management operations.
 *
 * Endpoints:
 * - GET    /api/platform/org           - Get current organization
 * - PUT    /api/platform/org           - Update organization settings (admin only)
 * - GET    /api/platform/org/members   - List members (alias for /users)
 *
 * @see docs/RBAC-STAFF-ONBOARDING.md §6 Admin Functions
 */

import type { UserRole } from "@prisma/client";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../middleware/context.js";
import { AUDIT_ACTIONS, TARGET_TYPES } from "../../audit/actions.js";
import { logAudit, type AuditContext } from "../../audit/logger.js";
import { prisma } from "../../db/client.js";
import { sendError, handleError } from "../middleware/errors.js";
import {
  requireAuth,
  requireAdmin,
  requireOrganization,
  composeMiddleware,
} from "../middleware/require-permission.js";
import { sendJson, parseBody, type RouteHandler } from "./utils.js";

/**
 * Organization data structure for API responses
 */
export interface OrganizationResponse {
  id: string;
  name: string;
  status: string;
  externalTenantId: string | null;
  authorizedModels: string[];
  defaultModelId: string | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Organization update request
 */
export interface UpdateOrganizationRequest {
  name?: string;
  defaultModelId?: string | null;
  authorizedModels?: string[];
}

/**
 * Member data structure for API responses
 */
export interface MemberResponse {
  id: string;
  email: string;
  username: string | null;
  role: string;
  externalId: string | null;
  createdAt: string;
}

/**
 * Handle organization routes
 */
export const handleOrg: RouteHandler = async (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method?.toUpperCase() ?? "GET";

  try {
    // GET /api/platform/org/members - List organization members
    if (path === "/api/platform/org/members" && method === "GET") {
      await handleListMembers(req, res, ctx);
      return;
    }

    // POST /api/platform/org/entra/disconnect - Disconnect Entra integration
    if (path === "/api/platform/org/entra/disconnect" && method === "POST") {
      await handleDisconnectEntra(req, res, ctx);
      return;
    }

    // GET /api/platform/org - Get current organization
    if (path === "/api/platform/org" && method === "GET") {
      await handleGetOrganization(req, res, ctx);
      return;
    }

    // PUT /api/platform/org - Update organization
    if (path === "/api/platform/org" && method === "PUT") {
      await handleUpdateOrganization(req, res, ctx);
      return;
    }

    // Method not allowed
    sendError(res, "METHOD_NOT_ALLOWED", `Method ${method} not allowed for ${path}`);
  } catch (error) {
    handleError(res, error);
  }
};

/**
 * GET /api/platform/org - Get current organization details
 */
async function handleGetOrganization(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> {
  // Require auth + org membership
  const middleware = composeMiddleware(requireAuth(), requireOrganization());
  if (!(await middleware(ctx, res))) return;

  const org = await prisma.organization.findUnique({
    where: { id: ctx.user!.orgId },
    include: {
      _count: {
        select: { users: true },
      },
    },
  });

  if (!org) {
    sendError(res, "NOT_FOUND", "Organization not found");
    return;
  }

  const response: OrganizationResponse = {
    id: org.id,
    name: org.name,
    status: org.status,
    externalTenantId: org.externalTenantId,
    authorizedModels: parseAuthorizedModels(org.authorizedModels),
    defaultModelId: org.defaultModelId,
    memberCount: org._count.users,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  };

  sendJson(res, response);
}

/**
 * PUT /api/platform/org - Update organization settings (admin only)
 */
async function handleUpdateOrganization(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> {
  // Require admin + org
  const middleware = composeMiddleware(requireAuth(), requireOrganization(), requireAdmin());
  if (!(await middleware(ctx, res))) return;

  // Parse body
  const body = await parseBody<UpdateOrganizationRequest>(req);
  if (!body.ok) {
    sendError(res, "BAD_REQUEST", body.error);
    return;
  }

  const { name, defaultModelId, authorizedModels } = body.value;

  // Validate name if provided
  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length < 2) {
      sendError(res, "BAD_REQUEST", "Organization name must be at least 2 characters");
      return;
    }
  }

  // Get current org for comparison
  const currentOrg = await prisma.organization.findUnique({
    where: { id: ctx.user!.orgId },
  });

  if (!currentOrg) {
    sendError(res, "NOT_FOUND", "Organization not found");
    return;
  }

  // Build update data
  const updateData: Record<string, unknown> = {};
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  if (name !== undefined && name !== currentOrg.name) {
    updateData.name = name.trim();
    changes.name = { old: currentOrg.name, new: name.trim() };
  }

  if (defaultModelId !== undefined && defaultModelId !== currentOrg.defaultModelId) {
    updateData.defaultModelId = defaultModelId;
    changes.defaultModelId = { old: currentOrg.defaultModelId, new: defaultModelId };
  }

  if (authorizedModels !== undefined) {
    const currentModels = parseAuthorizedModels(currentOrg.authorizedModels);
    const newModels = Array.isArray(authorizedModels) ? authorizedModels : [];
    if (JSON.stringify(currentModels.sort()) !== JSON.stringify(newModels.sort())) {
      updateData.authorizedModels = newModels;
      changes.authorizedModels = { old: currentModels, new: newModels };
    }
  }

  // If no changes, return current state
  if (Object.keys(updateData).length === 0) {
    const response: OrganizationResponse = {
      id: currentOrg.id,
      name: currentOrg.name,
      status: currentOrg.status,
      externalTenantId: currentOrg.externalTenantId,
      authorizedModels: parseAuthorizedModels(currentOrg.authorizedModels),
      defaultModelId: currentOrg.defaultModelId,
      memberCount: 0, // Will be updated below
      createdAt: currentOrg.createdAt.toISOString(),
      updatedAt: currentOrg.updatedAt.toISOString(),
    };
    sendJson(res, response);
    return;
  }

  // Update organization
  const updatedOrg = await prisma.organization.update({
    where: { id: ctx.user!.orgId },
    data: updateData,
    include: {
      _count: {
        select: { users: true },
      },
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

  await logAudit(auditCtx, AUDIT_ACTIONS.ORG_UPDATED, TARGET_TYPES.ORGANIZATION, ctx.user!.orgId, {
    changes,
  });

  const response: OrganizationResponse = {
    id: updatedOrg.id,
    name: updatedOrg.name,
    status: updatedOrg.status,
    externalTenantId: updatedOrg.externalTenantId,
    authorizedModels: parseAuthorizedModels(updatedOrg.authorizedModels),
    defaultModelId: updatedOrg.defaultModelId,
    memberCount: updatedOrg._count.users,
    createdAt: updatedOrg.createdAt.toISOString(),
    updatedAt: updatedOrg.updatedAt.toISOString(),
  };

  sendJson(res, response);
}

/**
 * POST /api/platform/org/entra/disconnect - Disconnect Entra integration
 *
 * Removes the Microsoft Entra tenant connection from the organization.
 * This allows re-onboarding with a different tenant or re-consenting.
 * Admin only.
 */
async function handleDisconnectEntra(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> {
  // Require admin + org
  const middleware = composeMiddleware(requireAuth(), requireOrganization(), requireAdmin());
  if (!(await middleware(ctx, res))) return;

  // Get current org
  const currentOrg = await prisma.organization.findUnique({
    where: { id: ctx.user!.orgId },
  });

  if (!currentOrg) {
    sendError(res, "NOT_FOUND", "Organization not found");
    return;
  }

  if (!currentOrg.externalTenantId) {
    sendError(res, "BAD_REQUEST", "Organization is not connected to Microsoft Entra");
    return;
  }

  const previousTenantId = currentOrg.externalTenantId;

  // Remove the tenant connection
  await prisma.organization.update({
    where: { id: ctx.user!.orgId },
    data: {
      externalTenantId: null,
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

  await logAudit(
    auditCtx,
    "organization.entra.disconnected",
    TARGET_TYPES.ORGANIZATION,
    ctx.user!.orgId,
    {
      previousTenantId,
    },
  );

  sendJson(res, { success: true, message: "Microsoft Entra disconnected successfully" });
}

/**
 * GET /api/platform/org/members - List organization members
 *
 * This is an alias for GET /api/platform/users, provided for convenience
 * when working with organization-scoped endpoints.
 */
async function handleListMembers(
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

  const members: MemberResponse[] = users.map((user) => ({
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    externalId: user.externalId,
    createdAt: user.createdAt.toISOString(),
  }));

  sendJson(res, { members, total: members.length });
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Parse authorized models from JSON
 */
function parseAuthorizedModels(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v) => typeof v === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((v) => typeof v === "string");
      }
    } catch {
      // Ignore parse errors
    }
  }
  return [];
}

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
