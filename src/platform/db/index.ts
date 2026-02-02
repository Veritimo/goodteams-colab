/**
 * Platform Database Module
 *
 * Exports Prisma client and utilities for database operations.
 *
 * Usage:
 *   import { prisma, checkDatabaseHealth } from '@/platform/db';
 */

export { prisma, disconnectPrisma, checkDatabaseHealth } from "./client.js";

// Re-export Prisma types for convenience
export {
  UserRole,
  InvitationStatus,
  OrgStatus,
  type Organization,
  type User,
  type OrganizationInvitation,
  type UserPermission,
  type OrganizationSkill,
  type AuditLog,
} from "@prisma/client";
