/**
 * Entra Directory routes for platform API
 *
 * Provides admin access to search the organization's Microsoft Entra directory
 * for inviting team members.
 *
 * Endpoints:
 * - GET /api/platform/entra/users?query=... - Search directory users (admin only)
 *
 * @see docs/RBAC-STAFF-ONBOARDING.md §4.2 Entra Directory Search
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../middleware/context.js";
import { searchUsers, type EntraUser, DirectorySearchError } from "../../auth/entra/directory.js";
import { prisma } from "../../db/client.js";
import { sendError, handleError } from "../middleware/errors.js";
import {
  requireAuth,
  requireAdmin,
  requireOrganization,
  composeMiddleware,
} from "../middleware/require-permission.js";
import { sendJson, type RouteHandler } from "./utils.js";

/**
 * Entra user response format
 */
export interface EntraUserResponse {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  jobTitle?: string;
  department?: string;
}

/**
 * Handle Entra directory routes
 */
export const handleEntra: RouteHandler = async (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method?.toUpperCase() ?? "GET";

  try {
    // GET /api/platform/entra/users - Search directory users
    if (path === "/api/platform/entra/users" && method === "GET") {
      await handleSearchUsers(req, res, ctx);
      return;
    }

    // Method not allowed
    sendError(res, "METHOD_NOT_ALLOWED", `Method ${method} not allowed for ${path}`);
  } catch (error) {
    handleError(res, error);
  }
};

/**
 * GET /api/platform/entra/users?query=... - Search directory users (admin only)
 *
 * Searches the organization's Microsoft Entra directory for users.
 * Requires the current user to have a valid Microsoft token.
 */
async function handleSearchUsers(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> {
  // Require admin + org
  const middleware = composeMiddleware(requireAuth(), requireOrganization(), requireAdmin());
  if (!(await middleware(ctx, res))) return;

  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const query = url.searchParams.get("query") ?? "";
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 50) : 10;
  const includeGuests = url.searchParams.get("includeGuests") === "true";

  // Validate query
  if (!query || query.length < 2) {
    sendError(res, "BAD_REQUEST", "Query parameter is required and must be at least 2 characters");
    return;
  }

  // Check organization has Entra connected
  const org = await prisma.organization.findUnique({
    where: { id: ctx.user!.orgId },
    select: { externalTenantId: true },
  });

  if (!org?.externalTenantId) {
    sendError(res, "FORBIDDEN", "Organization is not connected to Microsoft Entra", {
      code: "ENTRA_NOT_CONNECTED",
    });
    return;
  }

  // Get Microsoft access token for current user
  // In production, this would come from the user's stored OAuth tokens
  // For now, we expect it in the X-Microsoft-Token header (passed from frontend)
  const msToken = req.headers["x-microsoft-token"] as string | undefined;

  if (!msToken) {
    sendError(
      res,
      "UNAUTHORIZED",
      "Microsoft access token required. Please sign in with Microsoft.",
      {
        code: "MS_TOKEN_REQUIRED",
      },
    );
    return;
  }

  try {
    const result = await searchUsers(msToken, query, {
      limit,
      includeGuests,
    });

    // Filter out users who are already members of this org
    const existingUserEmails = await prisma.user.findMany({
      where: {
        organizationId: ctx.user!.orgId,
        email: { not: undefined },
      },
      select: { email: true, externalId: true },
    });

    const existingEmails = new Set(existingUserEmails.map((u) => u.email.toLowerCase()));
    const existingExternalIds = new Set(
      existingUserEmails.map((u) => u.externalId).filter(Boolean),
    );

    // Also filter out users with pending invitations
    const pendingInvitations = await prisma.organizationInvitation.findMany({
      where: {
        organizationId: ctx.user!.orgId,
        status: "PENDING",
      },
      select: { email: true, externalId: true },
    });

    const pendingEmails = new Set(pendingInvitations.map((i) => i.email.toLowerCase()));
    const pendingExternalIds = new Set(pendingInvitations.map((i) => i.externalId).filter(Boolean));

    const users: EntraUserResponse[] = result.users
      .filter((user) => {
        const email = (user.mail ?? user.userPrincipalName).toLowerCase();
        const isExistingMember = existingEmails.has(email) || existingExternalIds.has(user.id);
        const hasPendingInvite = pendingEmails.has(email) || pendingExternalIds.has(user.id);
        return !isExistingMember && !hasPendingInvite;
      })
      .map((user) => ({
        id: user.id,
        displayName: user.displayName,
        mail: user.mail,
        userPrincipalName: user.userPrincipalName,
        jobTitle: user.jobTitle,
        department: user.department,
      }));

    sendJson(res, {
      users,
      total: users.length,
      hasMore: result.nextLink !== undefined,
    });
  } catch (error) {
    if (error instanceof DirectorySearchError) {
      if (error.isAuthError()) {
        sendError(
          res,
          "UNAUTHORIZED",
          "Microsoft token is invalid or expired. Please sign in again.",
          {
            code: "MS_TOKEN_INVALID",
          },
        );
        return;
      }
      if (error.isPermissionError()) {
        sendError(
          res,
          "FORBIDDEN",
          "Insufficient permissions to search directory. Requires User.Read.All or User.ReadBasic.All scope.",
          {
            code: "MS_PERMISSION_DENIED",
          },
        );
        return;
      }
      if (error.isRateLimited()) {
        sendError(
          res,
          "TOO_MANY_REQUESTS",
          "Microsoft Graph API rate limit exceeded. Please try again later.",
        );
        return;
      }
    }
    throw error;
  }
}
