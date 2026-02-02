/**
 * Permission Checking Functions
 *
 * Provides utilities to check if a user has specific permissions,
 * combining role-based implicit permissions with explicit grants.
 *
 * Based on: docs/RBAC-STAFF-ONBOARDING.md §5.2 Permission Check Flow
 */

import type { UserRole } from "@prisma/client";
import { prisma } from "../db/client.js";
import {
  type Permission,
  getImplicitPermissionsForRole,
} from "./permissions.js";

/**
 * User data required for permission checking
 */
export interface PermissionCheckUser {
  id: string;
  role: UserRole;
  organizationId: string | null;
}

/**
 * Check if a user has a specific permission
 *
 * Permission check priority:
 * 1. SUPER_ADMIN has everything
 * 2. Check implicit permissions by role
 * 3. Check explicit permissions from UserPermission table
 *
 * @param userId - The user's ID
 * @param permission - The permission to check
 * @returns true if the user has the permission
 */
export async function checkPermission(
  userId: string,
  permission: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      organizationId: true,
      permissions: {
        select: { name: true },
      },
    },
  });

  if (!user) {
    return false;
  }

  return checkPermissionForUser(
    user,
    user.permissions.map((p) => p.name),
    permission
  );
}

/**
 * Check permission using pre-loaded user data
 * Useful when user data is already available to avoid extra DB queries
 */
export function checkPermissionForUser(
  user: PermissionCheckUser,
  explicitPermissions: string[],
  permission: string
): boolean {
  // 1. SUPER_ADMIN has everything
  if (user.role === "SUPER_ADMIN") {
    return true;
  }

  // 2. Check implicit permissions by role
  const implicitPerms = getImplicitPermissionsForRole(user.role);
  if (implicitPerms.includes(permission as Permission)) {
    return true;
  }

  // 3. Check explicit permissions
  return explicitPermissions.includes(permission);
}

/**
 * Get all permissions for a user
 *
 * Returns the union of:
 * - Implicit permissions based on role
 * - Explicitly granted permissions from UserPermission table
 *
 * @param userId - The user's ID
 * @returns Array of permission strings
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      permissions: {
        select: { name: true },
      },
    },
  });

  if (!user) {
    return [];
  }

  // Get implicit permissions for role
  const implicitPerms = getImplicitPermissionsForRole(user.role);

  // Get explicit permissions
  const explicitPerms = user.permissions.map((p) => p.name);

  // Merge and deduplicate
  const allPerms = new Set([...implicitPerms, ...explicitPerms]);
  return Array.from(allPerms);
}

/**
 * Get all permissions for a user using pre-loaded user data
 */
export function getUserPermissionsFromData(
  role: UserRole,
  explicitPermissions: string[]
): string[] {
  const implicitPerms = getImplicitPermissionsForRole(role);
  const allPerms = new Set([...implicitPerms, ...explicitPermissions]);
  return Array.from(allPerms);
}

/**
 * Check if a user has all of the specified permissions
 */
export async function checkAllPermissions(
  userId: string,
  permissions: string[]
): Promise<boolean> {
  const userPerms = await getUserPermissions(userId);
  return permissions.every((p) => userPerms.includes(p));
}

/**
 * Check if a user has any of the specified permissions
 */
export async function checkAnyPermission(
  userId: string,
  permissions: string[]
): Promise<boolean> {
  const userPerms = await getUserPermissions(userId);
  return permissions.some((p) => userPerms.includes(p));
}

/**
 * Check if a user has a specific role
 */
export async function checkRole(
  userId: string,
  ...roles: UserRole[]
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) {
    return false;
  }

  return roles.includes(user.role);
}

/**
 * Grant a permission to a user
 * Only assignable permissions can be granted explicitly
 *
 * @param userId - Target user ID
 * @param permission - Permission to grant
 * @param grantedBy - User ID of the granting admin
 * @returns The created permission record
 */
export async function grantPermission(
  userId: string,
  permission: string,
  grantedBy: string
): Promise<{ id: string; name: string; userId: string; grantedAt: Date; grantedBy: string | null }> {
  return prisma.userPermission.create({
    data: {
      userId,
      name: permission,
      grantedBy,
    },
  });
}

/**
 * Revoke a permission from a user
 *
 * @param userId - Target user ID
 * @param permission - Permission to revoke
 */
export async function revokePermission(
  userId: string,
  permission: string
): Promise<void> {
  await prisma.userPermission.deleteMany({
    where: {
      userId,
      name: permission,
    },
  });
}

/**
 * Get all explicit permissions granted to a user
 */
export async function getExplicitPermissions(userId: string): Promise<
  Array<{
    id: string;
    name: string;
    grantedAt: Date;
    grantedBy: string | null;
  }>
> {
  return prisma.userPermission.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      grantedAt: true,
      grantedBy: true,
    },
  });
}

/**
 * Check if user is an admin (ADMIN or SUPER_ADMIN role)
 */
export function isAdminRole(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/**
 * Check if a role can manage another role
 * SUPER_ADMIN > ADMIN > all others
 */
export function canManageRole(actorRole: UserRole, targetRole: UserRole): boolean {
  // SUPER_ADMIN can manage anyone
  if (actorRole === "SUPER_ADMIN") {
    return true;
  }

  // ADMIN can manage non-admin roles
  if (actorRole === "ADMIN") {
    return targetRole !== "SUPER_ADMIN" && targetRole !== "ADMIN";
  }

  // Other roles cannot manage users
  return false;
}
