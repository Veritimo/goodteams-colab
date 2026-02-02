/**
 * Invitation routes for platform API
 *
 * Handles the full invitation lifecycle for staff onboarding.
 *
 * Endpoints:
 * - GET    /api/platform/invitations          - List pending invitations (admin only)
 * - POST   /api/platform/invitations          - Create new invitation (admin only)
 * - POST   /api/platform/invitations/:token/accept - Accept invitation (public with token)
 * - DELETE /api/platform/invitations/:id      - Revoke invitation (admin only)
 * - POST   /api/platform/invitations/:id/resend - Resend invitation email (admin only)
 *
 * @see docs/RBAC-STAFF-ONBOARDING.md §4 Staff Onboarding Flow
 */

import type { UserRole } from "@prisma/client";
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { RequestContext } from "../middleware/context.js";
import { AUDIT_ACTIONS, TARGET_TYPES } from "../../audit/actions.js";
import { logAudit, type AuditContext } from "../../audit/logger.js";
import { prisma } from "../../db/client.js";
import { sendInvitationEmail } from "../../email/index.js";
import { sendError, errors, handleError } from "../middleware/errors.js";
import {
  requireAuth,
  requireAdmin,
  requireOrganization,
  composeMiddleware,
} from "../middleware/require-permission.js";
import { sendJson, parseBody, type RouteHandler } from "./utils.js";

/**
 * Invitation data structure for API responses
 */
export interface InvitationResponse {
  id: string;
  email: string;
  role: string;
  status: string;
  invitedBy: {
    id: string;
    email: string;
    name: string | null;
  };
  externalId: string | null;
  entraUsername: string | null;
  entraDisplayName: string | null;
  createdAt: string;
  expiresAt: string;
}

/**
 * Create invitation request body
 */
export interface CreateInvitationRequest {
  email: string;
  role: "ADMIN" | "USER" | "BILLING" | "VIEWER";
  externalId?: string;
  entraUsername?: string;
  entraDisplayName?: string;
}

/**
 * Accept invitation request body
 */
export interface AcceptInvitationRequest {
  /** Optional user email - if not provided, uses auth context */
  email?: string;
}

// Invitation expiry in days
const INVITATION_EXPIRY_DAYS = 7;

/**
 * Handle invitation routes
 */
export const handleInvitations: RouteHandler = async (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method?.toUpperCase() ?? "GET";

  try {
    // POST /api/platform/invitations/:token/accept - Accept invitation (public route)
    const acceptMatch = path.match(/^\/api\/platform\/invitations\/([^/]+)\/accept$/);
    if (acceptMatch && method === "POST") {
      const token = acceptMatch[1];
      await handleAcceptInvitation(req, res, ctx, token);
      return;
    }

    // POST /api/platform/invitations/:id/resend - Resend invitation (admin only)
    const resendMatch = path.match(/^\/api\/platform\/invitations\/([^/]+)\/resend$/);
    if (resendMatch && method === "POST") {
      const id = resendMatch[1];
      await handleResendInvitation(req, res, ctx, id);
      return;
    }

    // DELETE /api/platform/invitations/:id - Revoke invitation (admin only)
    const deleteMatch = path.match(/^\/api\/platform\/invitations\/([^/]+)$/);
    if (deleteMatch && method === "DELETE") {
      const id = deleteMatch[1];
      await handleRevokeInvitation(req, res, ctx, id);
      return;
    }

    // GET /api/platform/invitations - List invitations (admin only)
    if (path === "/api/platform/invitations" && method === "GET") {
      await handleListInvitations(req, res, ctx);
      return;
    }

    // POST /api/platform/invitations - Create invitation (admin only)
    if (path === "/api/platform/invitations" && method === "POST") {
      await handleCreateInvitation(req, res, ctx);
      return;
    }

    // Method not allowed
    sendError(res, "METHOD_NOT_ALLOWED", `Method ${method} not allowed for ${path}`);
  } catch (error) {
    handleError(res, error);
  }
};

/**
 * GET /api/platform/invitations - List pending invitations (admin only)
 */
async function handleListInvitations(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> {
  // Require admin + org
  const middleware = composeMiddleware(requireAuth(), requireOrganization(), requireAdmin());
  if (!(await middleware(ctx, res))) return;

  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const status = url.searchParams.get("status") ?? "PENDING";

  const invitations = await prisma.organizationInvitation.findMany({
    where: {
      organizationId: ctx.user!.orgId,
      ...(status !== "all"
        ? { status: status as "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED" }
        : {}),
    },
    include: {
      issuer: {
        select: { id: true, email: true, username: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const response: InvitationResponse[] = invitations.map((inv) => ({
    id: inv.id,
    email: inv.email,
    role: inv.role,
    status: inv.status,
    invitedBy: {
      id: inv.issuer.id,
      email: inv.issuer.email,
      name: inv.issuer.username,
    },
    externalId: inv.externalId,
    entraUsername: inv.entraUsername,
    entraDisplayName: inv.entraDisplayName,
    createdAt: inv.createdAt.toISOString(),
    expiresAt: inv.expiresAt.toISOString(),
  }));

  sendJson(res, { invitations: response, total: response.length });
}

/**
 * POST /api/platform/invitations - Create new invitation (admin only)
 */
async function handleCreateInvitation(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> {
  // Require admin + org
  const middleware = composeMiddleware(requireAuth(), requireOrganization(), requireAdmin());
  if (!(await middleware(ctx, res))) return;

  // Parse body
  const body = await parseBody<CreateInvitationRequest>(_req);
  if (!body.ok) {
    sendError(res, "BAD_REQUEST", body.error);
    return;
  }

  const { email, role, externalId, entraUsername, entraDisplayName } = body.value;

  // Validate required fields
  if (!email || !role) {
    sendError(res, "BAD_REQUEST", "Email and role are required");
    return;
  }

  // Validate email format
  if (!isValidEmail(email)) {
    sendError(res, "BAD_REQUEST", "Invalid email format");
    return;
  }

  // Validate role
  const validRoles: UserRole[] = ["ADMIN", "USER", "BILLING", "VIEWER"];
  if (!validRoles.includes(role as UserRole)) {
    sendError(res, "BAD_REQUEST", `Invalid role. Must be one of: ${validRoles.join(", ")}`);
    return;
  }

  // Check organization has Entra connected (externalTenantId)
  const org = await prisma.organization.findUnique({
    where: { id: ctx.user!.orgId },
  });

  if (!org) {
    sendError(res, "NOT_FOUND", "Organization not found");
    return;
  }

  if (!org.externalTenantId) {
    sendError(
      res,
      "FORBIDDEN",
      "Organization must be connected to Microsoft Entra before inviting users",
      {
        code: "ENTRA_NOT_CONNECTED",
      },
    );
    return;
  }

  // Check for existing user with same email in this org
  const existingUser = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
      organizationId: ctx.user!.orgId,
    },
  });

  if (existingUser) {
    sendError(res, "CONFLICT", "A user with this email already exists in the organization", {
      code: "USER_EXISTS",
    });
    return;
  }

  // Check for existing pending invitation
  const existingInvitation = await prisma.organizationInvitation.findFirst({
    where: {
      email: email.toLowerCase(),
      organizationId: ctx.user!.orgId,
      status: "PENDING",
    },
  });

  if (existingInvitation) {
    sendError(res, "CONFLICT", "A pending invitation already exists for this email", {
      code: "INVITATION_EXISTS",
      invitationId: existingInvitation.id,
    });
    return;
  }

  // Generate secure token and expiry
  const token = randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

  // Create invitation
  const invitation = await prisma.organizationInvitation.create({
    data: {
      email: email.toLowerCase(),
      role: role as UserRole,
      token,
      expiresAt,
      externalId,
      entraUsername,
      entraDisplayName,
      organizationId: ctx.user!.orgId,
      issuerId: ctx.user!.id,
    },
    include: {
      issuer: {
        select: { id: true, email: true, username: true },
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

  await logAudit(
    auditCtx,
    AUDIT_ACTIONS.INVITATION_CREATED,
    TARGET_TYPES.INVITATION,
    invitation.id,
    {
      email: invitation.email,
      role: invitation.role,
      externalId: invitation.externalId,
      expiresAt: invitation.expiresAt.toISOString(),
    },
  );

  // Send invitation email (stub)
  await sendInvitationEmail(
    {
      id: invitation.id,
      email: invitation.email,
      token: invitation.token,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    },
    org.name,
    ctx.user!.email,
  );

  const response: InvitationResponse = {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    invitedBy: {
      id: invitation.issuer.id,
      email: invitation.issuer.email,
      name: invitation.issuer.username,
    },
    externalId: invitation.externalId,
    entraUsername: invitation.entraUsername,
    entraDisplayName: invitation.entraDisplayName,
    createdAt: invitation.createdAt.toISOString(),
    expiresAt: invitation.expiresAt.toISOString(),
  };

  sendJson(res, response, 201);
}

/**
 * POST /api/platform/invitations/:token/accept - Accept invitation
 */
async function handleAcceptInvitation(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
  token: string,
): Promise<void> {
  // Must be authenticated
  if (!(await requireAuth()(ctx, res))) return;

  // Find invitation by token
  const invitation = await prisma.organizationInvitation.findUnique({
    where: { token },
    include: {
      organization: true,
    },
  });

  if (!invitation) {
    sendError(res, "NOT_FOUND", "Invitation not found or invalid token");
    return;
  }

  // Check status is PENDING
  if (invitation.status !== "PENDING") {
    sendError(res, "CONFLICT", `Invitation has already been ${invitation.status.toLowerCase()}`, {
      status: invitation.status,
    });
    return;
  }

  // Check not expired
  if (new Date() > invitation.expiresAt) {
    // Update status to EXPIRED
    await prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { status: "EXPIRED" },
    });

    sendError(res, "CONFLICT", "Invitation has expired", {
      status: "EXPIRED",
      expiredAt: invitation.expiresAt.toISOString(),
    });
    return;
  }

  // Verify the accepting user's email matches the invitation
  // (or allow any authenticated user if email matches)
  const userEmail = ctx.user!.email.toLowerCase();
  const invitationEmail = invitation.email.toLowerCase();

  if (userEmail !== invitationEmail) {
    sendError(res, "FORBIDDEN", "This invitation was sent to a different email address", {
      invitationEmail: invitation.email,
      yourEmail: ctx.user!.email,
    });
    return;
  }

  // Check if user is already in an organization
  const existingUser = await prisma.user.findUnique({
    where: { id: ctx.user!.id },
    select: { organizationId: true },
  });

  if (existingUser?.organizationId) {
    sendError(
      res,
      "CONFLICT",
      "You are already a member of an organization. Leave your current organization first.",
    );
    return;
  }

  // Link user to organization and set role
  const updatedUser = await prisma.user.update({
    where: { id: ctx.user!.id },
    data: {
      organizationId: invitation.organizationId,
      role: invitation.role,
      externalId: invitation.externalId,
    },
  });

  // Update invitation status to ACCEPTED
  await prisma.organizationInvitation.update({
    where: { id: invitation.id },
    data: { status: "ACCEPTED" },
  });

  // Log audit event
  const auditCtx: AuditContext = {
    user: {
      id: ctx.user!.id,
      role: invitation.role,
      organizationId: invitation.organizationId,
    },
    ip: ctx.ip,
  };

  await logAudit(
    auditCtx,
    AUDIT_ACTIONS.INVITATION_ACCEPTED,
    TARGET_TYPES.INVITATION,
    invitation.id,
    {
      email: invitation.email,
      role: invitation.role,
      issuerId: invitation.issuerId,
    },
  );

  sendJson(res, {
    success: true,
    message: "Invitation accepted successfully",
    organization: {
      id: invitation.organization.id,
      name: invitation.organization.name,
    },
    role: updatedUser.role,
  });
}

/**
 * DELETE /api/platform/invitations/:id - Revoke invitation (admin only)
 */
async function handleRevokeInvitation(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
  invitationId: string,
): Promise<void> {
  // Require admin + org
  const middleware = composeMiddleware(requireAuth(), requireOrganization(), requireAdmin());
  if (!(await middleware(ctx, res))) return;

  // Find invitation
  const invitation = await prisma.organizationInvitation.findUnique({
    where: { id: invitationId },
  });

  if (!invitation) {
    sendError(res, "NOT_FOUND", "Invitation not found");
    return;
  }

  // Check invitation belongs to this organization
  if (invitation.organizationId !== ctx.user!.orgId) {
    sendError(res, "FORBIDDEN", "Invitation does not belong to your organization");
    return;
  }

  // Check it's PENDING
  if (invitation.status !== "PENDING") {
    sendError(res, "CONFLICT", `Cannot revoke invitation with status: ${invitation.status}`);
    return;
  }

  // Update status to REVOKED
  await prisma.organizationInvitation.update({
    where: { id: invitationId },
    data: { status: "REVOKED" },
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
    AUDIT_ACTIONS.INVITATION_REVOKED,
    TARGET_TYPES.INVITATION,
    invitation.id,
    {
      email: invitation.email,
      role: invitation.role,
      originalIssuerId: invitation.issuerId,
    },
  );

  sendJson(res, { success: true, message: "Invitation revoked" });
}

/**
 * POST /api/platform/invitations/:id/resend - Resend invitation email (admin only)
 */
async function handleResendInvitation(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
  invitationId: string,
): Promise<void> {
  // Require admin + org
  const middleware = composeMiddleware(requireAuth(), requireOrganization(), requireAdmin());
  if (!(await middleware(ctx, res))) return;

  // Find invitation
  const invitation = await prisma.organizationInvitation.findUnique({
    where: { id: invitationId },
    include: {
      organization: true,
    },
  });

  if (!invitation) {
    sendError(res, "NOT_FOUND", "Invitation not found");
    return;
  }

  // Check invitation belongs to this organization
  if (invitation.organizationId !== ctx.user!.orgId) {
    sendError(res, "FORBIDDEN", "Invitation does not belong to your organization");
    return;
  }

  // Can only resend PENDING or EXPIRED invitations
  if (invitation.status !== "PENDING" && invitation.status !== "EXPIRED") {
    sendError(res, "CONFLICT", `Cannot resend invitation with status: ${invitation.status}`);
    return;
  }

  // Reset expiry date
  const newExpiresAt = new Date();
  newExpiresAt.setDate(newExpiresAt.getDate() + INVITATION_EXPIRY_DAYS);

  await prisma.organizationInvitation.update({
    where: { id: invitationId },
    data: {
      expiresAt: newExpiresAt,
      status: "PENDING", // Reset to PENDING if it was EXPIRED
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
    AUDIT_ACTIONS.INVITATION_RESENT,
    TARGET_TYPES.INVITATION,
    invitation.id,
    {
      email: invitation.email,
      newExpiresAt: newExpiresAt.toISOString(),
    },
  );

  // Send invitation email (stub)
  await sendInvitationEmail(
    {
      id: invitation.id,
      email: invitation.email,
      token: invitation.token,
      role: invitation.role,
      expiresAt: newExpiresAt,
    },
    invitation.organization.name,
    ctx.user!.email,
  );

  sendJson(res, {
    success: true,
    message: "Invitation resent",
    expiresAt: newExpiresAt.toISOString(),
  });
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Map context role to Prisma UserRole
 */
function mapRoleToPrisma(role: string): import("@prisma/client").UserRole {
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
