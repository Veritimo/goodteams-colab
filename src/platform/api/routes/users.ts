/**
 * User routes for platform API
 *
 * STUB: Returns 501 Not Implemented for Phase 1.
 * Full implementation in Phase 2 with RBAC.
 *
 * Planned endpoints:
 * - GET    /api/platform/users         - List organization users
 * - GET    /api/platform/users/:id     - Get specific user
 * - PUT    /api/platform/users/:id     - Update user (role, permissions)
 * - DELETE /api/platform/users/:id     - Remove user from organization
 * - GET    /api/platform/users/me      - Get current user profile
 * - PUT    /api/platform/users/me      - Update current user profile
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../middleware/context.js";
import { sendError } from "../middleware/errors.js";
import type { RouteHandler } from "./utils.js";

/**
 * User data structure (for reference)
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "member" | "viewer";
  status: "active" | "suspended" | "pending";
  createdAt: string;
  lastLoginAt: string | null;
  permissions?: string[];
}

/**
 * User list response
 */
export interface UsersListResponse {
  users: User[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Handle user routes
 *
 * STUB: All routes return 501 Not Implemented
 */
export const handleUsers: RouteHandler = async (
  req: IncomingMessage,
  res: ServerResponse,
  _ctx: RequestContext,
): Promise<void> => {
  // All user routes are not yet implemented
  sendError(res, "NOT_IMPLEMENTED", "User management is not yet implemented", {
    availableIn: "Phase 2",
    method: req.method,
    path: req.url,
  });
};
