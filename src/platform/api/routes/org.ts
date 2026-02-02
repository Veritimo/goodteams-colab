/**
 * Organization routes for platform API
 *
 * STUB: Returns 501 Not Implemented for Phase 1.
 * Full implementation in Phase 2-3 with database and multi-tenancy.
 *
 * Planned endpoints:
 * - GET    /api/platform/org           - Get current organization
 * - PUT    /api/platform/org           - Update organization settings
 * - GET    /api/platform/org/settings  - Get organization settings
 * - PUT    /api/platform/org/settings  - Update organization settings
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../middleware/context.js";
import { sendError } from "../middleware/errors.js";
import type { RouteHandler } from "./utils.js";

/**
 * Organization data structure (for reference)
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  settings: {
    defaultRole: "member" | "viewer";
    allowInvitations: boolean;
    ssoRequired: boolean;
  };
}

/**
 * Handle organization routes
 *
 * STUB: All routes return 501 Not Implemented
 */
export const handleOrg: RouteHandler = async (
  req: IncomingMessage,
  res: ServerResponse,
  _ctx: RequestContext,
): Promise<void> => {
  // All org routes are not yet implemented
  sendError(res, "NOT_IMPLEMENTED", "Organization management is not yet implemented", {
    availableIn: "Phase 2",
    method: req.method,
    path: req.url,
  });
};
