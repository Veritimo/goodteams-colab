/**
 * Audit Logger
 *
 * Core audit logging functionality for GoodTeams platform.
 * Creates immutable audit records for all significant platform actions.
 *
 * See: docs/AUDIT-LOGGING-SPEC.md
 */

import { prisma } from "../db/client.js";
import type { UserRole, AuditLog } from "@prisma/client";
import { ACTION_RISK_LEVELS, type AuditAction, type RiskLevel } from "./actions.js";

/**
 * Context for audit logging, containing actor information
 */
export interface AuditContext {
  user: {
    id: string;
    role: UserRole;
    organizationId: string;
  };
  ip?: string;
  userAgent?: string;
  /** Optional request ID for correlation */
  requestId?: string;
  /** Optional session ID for correlation */
  sessionId?: string;
}

/**
 * System context for actions not initiated by a user
 */
export interface SystemAuditContext {
  /** Use 'SYSTEM' for automated actions */
  actorId: "SYSTEM";
  organizationId: string;
  /** Optional description of the system process */
  systemProcess?: string;
}

/**
 * Options for log creation
 */
export interface LogAuditOptions {
  /** Override the automatic risk level classification */
  riskLevel?: RiskLevel;
  /** Correlation ID to link related events */
  correlationId?: string;
}

/**
 * Log an audit event
 *
 * @param ctx - The audit context containing actor information
 * @param action - The action being performed (use AUDIT_ACTIONS constants)
 * @param targetType - The type of resource being acted upon
 * @param targetId - The ID of the target resource (null for general actions)
 * @param details - Additional context about the action
 * @param options - Optional configuration for the log entry
 */
export async function logAudit(
  ctx: AuditContext,
  action: AuditAction | string,
  targetType: string,
  targetId: string | null,
  details: Record<string, unknown>,
  options?: LogAuditOptions,
): Promise<AuditLog> {
  const riskLevel = options?.riskLevel ?? ACTION_RISK_LEVELS[action as AuditAction] ?? "medium";

  const auditLog = await prisma.auditLog.create({
    data: {
      organizationId: ctx.user.organizationId,
      actorId: ctx.user.id,
      actorRole: ctx.user.role,
      action,
      targetType,
      targetId,
      details: {
        ...details,
        riskLevel,
        ...(ctx.requestId && { requestId: ctx.requestId }),
        ...(ctx.sessionId && { sessionId: ctx.sessionId }),
        ...(options?.correlationId && { correlationId: options.correlationId }),
      },
      ipAddress: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    },
  });

  return auditLog;
}

/**
 * Log an audit event for system-initiated actions
 *
 * @param ctx - System context
 * @param action - The action being performed
 * @param targetType - The type of resource being acted upon
 * @param targetId - The ID of the target resource
 * @param details - Additional context about the action
 * @param options - Optional configuration for the log entry
 */
export async function logSystemAudit(
  ctx: SystemAuditContext,
  action: AuditAction | string,
  targetType: string,
  targetId: string | null,
  details: Record<string, unknown>,
  options?: LogAuditOptions,
): Promise<AuditLog> {
  const riskLevel = options?.riskLevel ?? ACTION_RISK_LEVELS[action as AuditAction] ?? "medium";

  const auditLog = await prisma.auditLog.create({
    data: {
      organizationId: ctx.organizationId,
      actorId: ctx.actorId,
      // System actions use SUPER_ADMIN role for tracking
      actorRole: "SUPER_ADMIN",
      action,
      targetType,
      targetId,
      details: {
        ...details,
        riskLevel,
        isSystemAction: true,
        ...(ctx.systemProcess && { systemProcess: ctx.systemProcess }),
        ...(options?.correlationId && { correlationId: options.correlationId }),
      },
      ipAddress: null,
      userAgent: "SYSTEM",
    },
  });

  return auditLog;
}

/**
 * Batch log multiple audit events
 * Useful for bulk operations
 *
 * @param entries - Array of audit log entries to create
 */
export async function logAuditBatch(
  entries: Array<{
    ctx: AuditContext;
    action: AuditAction | string;
    targetType: string;
    targetId: string | null;
    details: Record<string, unknown>;
    options?: LogAuditOptions;
  }>,
): Promise<number> {
  const data = entries.map((entry) => {
    const riskLevel =
      entry.options?.riskLevel ?? ACTION_RISK_LEVELS[entry.action as AuditAction] ?? "medium";

    return {
      organizationId: entry.ctx.user.organizationId,
      actorId: entry.ctx.user.id,
      actorRole: entry.ctx.user.role,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      details: {
        ...entry.details,
        riskLevel,
        ...(entry.ctx.requestId && { requestId: entry.ctx.requestId }),
        ...(entry.ctx.sessionId && { sessionId: entry.ctx.sessionId }),
        ...(entry.options?.correlationId && { correlationId: entry.options.correlationId }),
      },
      ipAddress: entry.ctx.ip ?? null,
      userAgent: entry.ctx.userAgent ?? null,
    };
  });

  const result = await prisma.auditLog.createMany({ data });
  return result.count;
}

/**
 * Get a single audit log entry by ID
 *
 * @param id - The audit log ID
 * @param organizationId - The organization ID (for tenant isolation)
 */
export async function getAuditLogById(
  id: string,
  organizationId: string,
): Promise<AuditLog | null> {
  return prisma.auditLog.findFirst({
    where: {
      id,
      organizationId,
    },
  });
}
