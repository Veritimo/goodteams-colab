/**
 * Audit Action Constants
 *
 * Defines all auditable actions in the GoodTeams platform.
 * Actions follow the format: "resource.verb" for consistency.
 *
 * See: docs/AUDIT-LOGGING-SPEC.md §3 Event Catalog
 */

/**
 * All audit action constants
 */
export const AUDIT_ACTIONS = {
  // =========================================================================
  // Authentication
  // =========================================================================
  USER_LOGIN: "user.login",
  USER_LOGOUT: "user.logout",
  USER_LOGIN_FAILED: "user.login.failed",
  USER_TOKEN_REFRESH: "user.token.refresh",

  // =========================================================================
  // Organization
  // =========================================================================
  ORG_CREATED: "organization.created",
  ORG_UPDATED: "organization.updated",
  ORG_ENTRA_CONNECTED: "organization.entra.connected",
  ORG_ENTRA_DISCONNECTED: "organization.entra.disconnected",
  ORG_SETTINGS_UPDATED: "organization.settings.updated",
  ORG_SUSPENDED: "organization.suspended",
  ORG_REACTIVATED: "organization.reactivated",

  // =========================================================================
  // User Management
  // =========================================================================
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",
  USER_ROLE_CHANGED: "user.role.changed",
  USER_REMOVED: "user.removed",
  USER_SUSPENDED: "user.suspended",
  USER_REACTIVATED: "user.reactivated",
  USER_PERMISSION_GRANTED: "user.permission.granted",
  USER_PERMISSION_REVOKED: "user.permission.revoked",

  // =========================================================================
  // Invitations
  // =========================================================================
  INVITATION_CREATED: "invitation.created",
  INVITATION_ACCEPTED: "invitation.accepted",
  INVITATION_REVOKED: "invitation.revoked",
  INVITATION_EXPIRED: "invitation.expired",
  INVITATION_RESENT: "invitation.resent",

  // =========================================================================
  // Models
  // =========================================================================
  MODELS_UPDATED: "models.updated",
  MODEL_AUTHORIZED: "model.authorized",
  MODEL_REVOKED: "model.revoked",
  DEFAULT_MODEL_CHANGED: "model.default.changed",

  // =========================================================================
  // Skills
  // =========================================================================
  SKILL_INSTALLED: "skill.installed",
  SKILL_CONFIGURED: "skill.configured",
  SKILL_ENABLED: "skill.enabled",
  SKILL_DISABLED: "skill.disabled",
  SKILL_REMOVED: "skill.removed",

  // =========================================================================
  // API Keys
  // =========================================================================
  API_KEY_CREATED: "api_key.created",
  API_KEY_REVOKED: "api_key.revoked",
  API_KEY_USED: "api_key.used",

  // =========================================================================
  // Security Events
  // =========================================================================
  SECURITY_ANOMALY_DETECTED: "security.anomaly.detected",
  SECURITY_RATE_LIMITED: "security.rate.limited",
  SECURITY_GUARDRAIL_TRIGGERED: "security.guardrail.triggered",
} as const;

/**
 * Type for audit action values
 */
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/**
 * Target types that can be referenced in audit logs
 */
export const TARGET_TYPES = {
  USER: "user",
  ORGANIZATION: "organization",
  INVITATION: "invitation",
  SKILL: "skill",
  MODEL: "model",
  API_KEY: "api_key",
  PERMISSION: "permission",
  SETTINGS: "settings",
  SESSION: "session",
} as const;

/**
 * Type for target type values
 */
export type TargetType = (typeof TARGET_TYPES)[keyof typeof TARGET_TYPES];

/**
 * Risk levels for audit events
 * Used for filtering and alerting
 */
export const RISK_LEVELS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
} as const;

export type RiskLevel = (typeof RISK_LEVELS)[keyof typeof RISK_LEVELS];

/**
 * Map actions to their risk levels
 * Used for automatic risk classification
 */
export const ACTION_RISK_LEVELS: Record<AuditAction, RiskLevel> = {
  // Authentication - mostly low risk
  [AUDIT_ACTIONS.USER_LOGIN]: "low",
  [AUDIT_ACTIONS.USER_LOGOUT]: "low",
  [AUDIT_ACTIONS.USER_LOGIN_FAILED]: "medium",
  [AUDIT_ACTIONS.USER_TOKEN_REFRESH]: "low",

  // Organization - medium to high risk
  [AUDIT_ACTIONS.ORG_CREATED]: "medium",
  [AUDIT_ACTIONS.ORG_UPDATED]: "medium",
  [AUDIT_ACTIONS.ORG_ENTRA_CONNECTED]: "high",
  [AUDIT_ACTIONS.ORG_ENTRA_DISCONNECTED]: "high",
  [AUDIT_ACTIONS.ORG_SETTINGS_UPDATED]: "medium",
  [AUDIT_ACTIONS.ORG_SUSPENDED]: "high",
  [AUDIT_ACTIONS.ORG_REACTIVATED]: "high",

  // User Management - mostly high risk
  [AUDIT_ACTIONS.USER_CREATED]: "medium",
  [AUDIT_ACTIONS.USER_UPDATED]: "low",
  [AUDIT_ACTIONS.USER_ROLE_CHANGED]: "high",
  [AUDIT_ACTIONS.USER_REMOVED]: "high",
  [AUDIT_ACTIONS.USER_SUSPENDED]: "high",
  [AUDIT_ACTIONS.USER_REACTIVATED]: "high",
  [AUDIT_ACTIONS.USER_PERMISSION_GRANTED]: "high",
  [AUDIT_ACTIONS.USER_PERMISSION_REVOKED]: "high",

  // Invitations - medium risk
  [AUDIT_ACTIONS.INVITATION_CREATED]: "medium",
  [AUDIT_ACTIONS.INVITATION_ACCEPTED]: "medium",
  [AUDIT_ACTIONS.INVITATION_REVOKED]: "medium",
  [AUDIT_ACTIONS.INVITATION_EXPIRED]: "low",
  [AUDIT_ACTIONS.INVITATION_RESENT]: "medium",

  // Models - medium risk
  [AUDIT_ACTIONS.MODELS_UPDATED]: "medium",
  [AUDIT_ACTIONS.MODEL_AUTHORIZED]: "medium",
  [AUDIT_ACTIONS.MODEL_REVOKED]: "medium",
  [AUDIT_ACTIONS.DEFAULT_MODEL_CHANGED]: "medium",

  // Skills - medium risk
  [AUDIT_ACTIONS.SKILL_INSTALLED]: "medium",
  [AUDIT_ACTIONS.SKILL_CONFIGURED]: "medium",
  [AUDIT_ACTIONS.SKILL_ENABLED]: "low",
  [AUDIT_ACTIONS.SKILL_DISABLED]: "low",
  [AUDIT_ACTIONS.SKILL_REMOVED]: "medium",

  // API Keys - high risk
  [AUDIT_ACTIONS.API_KEY_CREATED]: "high",
  [AUDIT_ACTIONS.API_KEY_REVOKED]: "high",
  [AUDIT_ACTIONS.API_KEY_USED]: "low",

  // Security Events - high to critical risk
  [AUDIT_ACTIONS.SECURITY_ANOMALY_DETECTED]: "high",
  [AUDIT_ACTIONS.SECURITY_RATE_LIMITED]: "medium",
  [AUDIT_ACTIONS.SECURITY_GUARDRAIL_TRIGGERED]: "critical",
};
