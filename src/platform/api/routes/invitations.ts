/**
 * Invitation routes for platform API
 *
 * STUB: Returns 501 Not Implemented for Phase 1.
 * Full implementation in Phase 2 with staff onboarding.
 *
 * Planned endpoints:
 * - GET    /api/platform/invitations          - List pending invitations
 * - POST   /api/platform/invitations          - Create new invitation
 * - GET    /api/platform/invitations/:id      - Get invitation details
 * - DELETE /api/platform/invitations/:id      - Revoke invitation
 * - POST   /api/platform/invitations/:id/resend - Resend invitation email
 * - POST   /api/platform/invitations/accept   - Accept invitation (public)
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../middleware/context.js";
import { sendError } from "../middleware/errors.js";
import type { RouteHandler } from "./utils.js";

/**
 * Invitation data structure (for reference)
 */
export interface Invitation {
  id: string;
  email: string;
  role: "admin" | "member" | "viewer";
  status: "pending" | "accepted" | "expired" | "revoked";
  invitedBy: {
    id: string;
    name: string;
  };
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

/**
 * Create invitation request
 */
export interface CreateInvitationRequest {
  email: string;
  role: "admin" | "member" | "viewer";
  message?: string;
}

/**
 * Accept invitation request
 */
export interface AcceptInvitationRequest {
  token: string;
}

/**
 * Handle invitation routes
 *
 * STUB: All routes return 501 Not Implemented
 */
export const handleInvitations: RouteHandler = async (
  req: IncomingMessage,
  res: ServerResponse,
  _ctx: RequestContext,
): Promise<void> => {
  // All invitation routes are not yet implemented
  sendError(res, "NOT_IMPLEMENTED", "Invitation management is not yet implemented", {
    availableIn: "Phase 2",
    method: req.method,
    path: req.url,
  });
};
