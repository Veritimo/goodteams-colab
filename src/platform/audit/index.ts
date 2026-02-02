/**
 * Platform Audit Logging Module
 *
 * Placeholder for Phase 2 implementation.
 *
 * This module will provide:
 * - Structured audit event logging
 * - Audit log storage (database)
 * - Audit log queries and filters
 * - Compliance reporting
 *
 * See: docs/AUDIT-LOGGING-SPEC.md
 */

export const AUDIT_MODULE_VERSION = "0.0.0-stub";

/**
 * Audit event types (for reference during Phase 2 implementation)
 */
export type AuditEventType =
  // Authentication events
  | "auth.login"
  | "auth.logout"
  | "auth.login_failed"
  | "auth.token_refresh"
  // User management events
  | "user.created"
  | "user.updated"
  | "user.deleted"
  | "user.role_changed"
  // Organization events
  | "org.settings_updated"
  // Invitation events
  | "invitation.created"
  | "invitation.accepted"
  | "invitation.revoked"
  | "invitation.expired";

/**
 * Audit log entry structure (for reference)
 */
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  actorId: string | null;
  actorEmail: string | null;
  targetType: "user" | "org" | "invitation" | "session" | null;
  targetId: string | null;
  orgId: string;
  ip: string;
  userAgent: string | null;
  details: Record<string, unknown>;
}

/**
 * Log an audit event
 *
 * STUB: Does nothing in Phase 1. Will write to database in Phase 2.
 */
export async function logAudit(_entry: Omit<AuditLogEntry, "id" | "timestamp">): Promise<void> {
  // TODO Phase 2: Implement audit logging to database
}
