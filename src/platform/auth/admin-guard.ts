/**
 * Admin Continuity Guard
 *
 * Ensures that organizations always have at least one ADMIN.
 * Prevents scenarios that could lock an organization out of admin access.
 *
 * Based on: docs/RBAC-STAFF-ONBOARDING.md §3.3 Admin Continuity Rule
 */

import type { UserRole } from "@prisma/client";
import { prisma } from "../db/client.js";

/**
 * Error thrown when admin continuity would be violated
 */
export class AdminContinuityError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "LAST_ADMIN_REMOVAL"
      | "LAST_ADMIN_DEMOTION"
      | "SELF_DEMOTION"
      | "SELF_REMOVAL"
  ) {
    super(message);
    this.name = "AdminContinuityError";
  }
}

/**
 * Validate that an admin change won't violate continuity rules
 *
 * Rules enforced:
 * 1. Cannot remove the last ADMIN from an organization
 * 2. Cannot demote the last ADMIN to a non-admin role
 * 3. Admins cannot demote themselves (prevents lockout)
 * 4. Admins cannot remove themselves
 *
 * @param targetUserId - The user being modified
 * @param newRole - The new role (null means removal from organization)
 * @param organizationId - The organization ID
 * @param actorUserId - The user performing the action (optional, for self-action checks)
 * @throws AdminContinuityError if the change would violate admin continuity
 */
export async function validateAdminChange(
  targetUserId: string,
  newRole: UserRole | null,
  organizationId: string,
  actorUserId?: string
): Promise<void> {
  // Get the target user
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      role: true,
      organizationId: true,
    },
  });

  if (!targetUser) {
    throw new Error(`User not found: ${targetUserId}`);
  }

  // Verify user belongs to the organization
  if (targetUser.organizationId !== organizationId) {
    throw new Error(`User ${targetUserId} does not belong to organization ${organizationId}`);
  }

  // Check for self-actions if actorUserId is provided
  if (actorUserId && targetUserId === actorUserId) {
    if (newRole === null) {
      throw new AdminContinuityError(
        "You cannot remove yourself from the organization. Ask another admin to remove you.",
        "SELF_REMOVAL"
      );
    }

    // Self-demotion check only if currently admin and new role is not admin
    if (isAdminRole(targetUser.role) && !isAdminRole(newRole)) {
      throw new AdminContinuityError(
        "You cannot demote yourself. Ask another admin to change your role.",
        "SELF_DEMOTION"
      );
    }
  }

  // Only check admin continuity if target is currently an admin
  // and the change would remove admin status
  if (!isAdminRole(targetUser.role)) {
    return; // Not an admin, no continuity check needed
  }

  // If new role is still admin, no continuity check needed
  if (newRole !== null && isAdminRole(newRole)) {
    return;
  }

  // Count current admins in the organization
  const adminCount = await prisma.user.count({
    where: {
      organizationId,
      role: { in: ["ADMIN", "SUPER_ADMIN"] },
    },
  });

  // If this is the last admin, block the change
  if (adminCount <= 1) {
    if (newRole === null) {
      throw new AdminContinuityError(
        "Cannot remove the last administrator. Assign another admin first.",
        "LAST_ADMIN_REMOVAL"
      );
    } else {
      throw new AdminContinuityError(
        "Cannot demote the last administrator. Assign another admin first.",
        "LAST_ADMIN_DEMOTION"
      );
    }
  }
}

/**
 * Validate a role change specifically
 */
export async function validateRoleChange(
  targetUserId: string,
  newRole: UserRole,
  organizationId: string,
  actorUserId?: string
): Promise<void> {
  return validateAdminChange(targetUserId, newRole, organizationId, actorUserId);
}

/**
 * Validate user removal from organization
 */
export async function validateUserRemoval(
  targetUserId: string,
  organizationId: string,
  actorUserId?: string
): Promise<void> {
  return validateAdminChange(targetUserId, null, organizationId, actorUserId);
}

/**
 * Check if a role is an admin-level role
 */
function isAdminRole(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/**
 * Get admin count for an organization
 * Useful for UI to show warnings when there's only one admin
 */
export async function getAdminCount(organizationId: string): Promise<number> {
  return prisma.user.count({
    where: {
      organizationId,
      role: { in: ["ADMIN", "SUPER_ADMIN"] },
    },
  });
}

/**
 * Check if removing a user would leave the organization without admins
 */
export async function wouldRemoveLastAdmin(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user || !isAdminRole(user.role)) {
    return false;
  }

  const adminCount = await getAdminCount(organizationId);
  return adminCount <= 1;
}
