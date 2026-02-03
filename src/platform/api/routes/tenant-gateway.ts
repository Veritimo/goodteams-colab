/**
 * Tenant Gateway Routes for Platform API
 *
 * Handles tenant gateway management operations including status checks,
 * restart operations, configuration management, and provisioning.
 *
 * Endpoints:
 * - GET    /api/platform/tenant/gateway          - Get gateway status
 * - POST   /api/platform/tenant/gateway/restart  - Restart gateway (admin only)
 * - GET    /api/platform/tenant/config           - Get tenant config
 * - PUT    /api/platform/tenant/config           - Update tenant config (admin only)
 * - POST   /api/platform/tenant/provision        - Provision tenant (admin only)
 * - DELETE /api/platform/tenant/:orgId           - Deprovision tenant (admin only)
 *
 * @see docs/MULTI-TENANCY-ARCHITECTURE.md
 */

import type { UserRole } from "@prisma/client";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../middleware/context.js";
import { AUDIT_ACTIONS, TARGET_TYPES } from "../../audit/actions.js";
import { logAudit, type AuditContext } from "../../audit/logger.js";
import { prisma } from "../../db/client.js";
import { generateAndWriteConfig, getConfigPath } from "../../tenant/config-generator.js";
import {
  getGatewayStatus,
  restartGateway,
  sendSignal,
  type GatewayInfo,
} from "../../tenant/gateway-manager.js";
import { sendError, handleError } from "../middleware/errors.js";
import {
  requireAuth,
  requireAdmin,
  requireOrganization,
  composeMiddleware,
} from "../middleware/require-permission.js";
import { sendJson, parseBody, parsePathParams, type RouteHandler } from "./utils.js";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Gateway status response structure
 */
export interface GatewayStatusResponse {
  status: string;
  port: number;
  pid: number | null;
  uptime: number | null;
  health: {
    lastCheck: string | null;
    consecutiveFailures: number;
  };
  resources: {
    memoryMb: number | null;
    cpuPercent: number | null;
    activeSessions: number;
  };
}

/**
 * Tenant config response structure
 */
export interface TenantConfigResponse {
  model: string;
  agentName: string;
  systemPrompt: string | null;
  features: Record<string, unknown>;
  limits: {
    maxTokensPerDay: number;
    maxConcurrentSessions: number;
    maxMemoryMb: number;
  };
}

/**
 * Tenant config update request
 */
export interface UpdateTenantConfigRequest {
  model?: string;
  agentName?: string;
  systemPrompt?: string | null;
  features?: Record<string, unknown>;
}

/**
 * Provision request body
 */
export interface ProvisionRequest {
  organizationId: string;
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate update config request
 */
function validateUpdateConfig(
  data: unknown,
): { ok: true; value: UpdateTenantConfigRequest } | { ok: false; error: string } {
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: "Request body must be an object" };
  }

  const obj = data as Record<string, unknown>;

  if (obj.model !== undefined) {
    if (typeof obj.model !== "string" || obj.model.length < 1 || obj.model.length > 100) {
      return { ok: false, error: "model must be a string between 1 and 100 characters" };
    }
  }

  if (obj.agentName !== undefined) {
    if (
      typeof obj.agentName !== "string" ||
      obj.agentName.length < 1 ||
      obj.agentName.length > 100
    ) {
      return { ok: false, error: "agentName must be a string between 1 and 100 characters" };
    }
  }

  if (obj.systemPrompt !== undefined && obj.systemPrompt !== null) {
    if (typeof obj.systemPrompt !== "string" || obj.systemPrompt.length > 10000) {
      return { ok: false, error: "systemPrompt must be a string up to 10000 characters or null" };
    }
  }

  if (obj.features !== undefined) {
    if (typeof obj.features !== "object" || obj.features === null || Array.isArray(obj.features)) {
      return { ok: false, error: "features must be an object" };
    }
  }

  return {
    ok: true,
    value: {
      model: obj.model as string | undefined,
      agentName: obj.agentName as string | undefined,
      systemPrompt: obj.systemPrompt as string | null | undefined,
      features: obj.features as Record<string, unknown> | undefined,
    },
  };
}

/**
 * Validate provision request
 */
function validateProvisionRequest(
  data: unknown,
): { ok: true; value: ProvisionRequest } | { ok: false; error: string } {
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: "Request body must be an object" };
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.organizationId !== "string" || !UUID_REGEX.test(obj.organizationId)) {
    return { ok: false, error: "organizationId must be a valid UUID" };
  }

  return {
    ok: true,
    value: { organizationId: obj.organizationId },
  };
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/**
 * Handle tenant gateway routes
 */
export const handleTenantGateway: RouteHandler = async (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method?.toUpperCase() ?? "GET";

  try {
    // GET /api/platform/tenant/gateway - Get gateway status
    if (path === "/api/platform/tenant/gateway" && method === "GET") {
      await handleGetGatewayStatus(req, res, ctx);
      return;
    }

    // POST /api/platform/tenant/gateway/restart - Restart gateway
    if (path === "/api/platform/tenant/gateway/restart" && method === "POST") {
      await handleRestartGateway(req, res, ctx);
      return;
    }

    // GET /api/platform/tenant/config - Get tenant config
    if (path === "/api/platform/tenant/config" && method === "GET") {
      await handleGetConfig(req, res, ctx);
      return;
    }

    // PUT /api/platform/tenant/config - Update tenant config
    if (path === "/api/platform/tenant/config" && method === "PUT") {
      await handleUpdateConfig(req, res, ctx);
      return;
    }

    // POST /api/platform/tenant/provision - Provision tenant
    if (path === "/api/platform/tenant/provision" && method === "POST") {
      await handleProvision(req, res, ctx);
      return;
    }

    // DELETE /api/platform/tenant/:orgId - Deprovision tenant
    // Must check that path matches UUID pattern to avoid matching /gateway, /config, /provision
    const deleteMatch = parsePathParams("/api/platform/tenant/:orgId", path);
    if (deleteMatch && method === "DELETE" && UUID_REGEX.test(deleteMatch.orgId)) {
      await handleDeprovision(req, res, ctx, deleteMatch.orgId);
      return;
    }

    // Handle known paths with wrong methods
    if (
      path === "/api/platform/tenant/gateway" ||
      path === "/api/platform/tenant/gateway/restart" ||
      path === "/api/platform/tenant/config" ||
      path === "/api/platform/tenant/provision"
    ) {
      sendError(res, "METHOD_NOT_ALLOWED", `Method ${method} not allowed for ${path}`);
      return;
    }

    // For paths with :orgId pattern, check if it's a valid UUID
    if (deleteMatch && !UUID_REGEX.test(deleteMatch.orgId)) {
      sendError(res, "BAD_REQUEST", "Invalid organization ID format");
      return;
    }

    // Method not allowed for other paths
    sendError(res, "METHOD_NOT_ALLOWED", `Method ${method} not allowed for ${path}`);
  } catch (error) {
    handleError(res, error);
  }
};

// =============================================================================
// HANDLERS
// =============================================================================

/**
 * GET /api/platform/tenant/gateway - Get current tenant's gateway status
 */
async function handleGetGatewayStatus(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> {
  // Require auth + org membership
  const middleware = composeMiddleware(requireAuth(), requireOrganization());
  if (!(await middleware(ctx, res))) return;

  const orgId = ctx.user!.orgId;

  // Get gateway info from database
  const gatewayInfo = await getGatewayStatus(orgId);

  if (!gatewayInfo) {
    sendError(res, "NOT_FOUND", "Gateway not found for this organization");
    return;
  }

  // Get additional gateway details from database
  const gateway = await prisma.tenantGateway.findUnique({
    where: { organizationId: orgId },
  });

  if (!gateway) {
    sendError(res, "NOT_FOUND", "Gateway not found for this organization");
    return;
  }

  // Calculate uptime if gateway has a started time
  let uptime: number | null = null;
  if (gateway.startedAt && gatewayInfo.status === "HEALTHY") {
    uptime = Math.floor((Date.now() - gateway.startedAt.getTime()) / 1000);
  }

  const response: GatewayStatusResponse = {
    status: gatewayInfo.status,
    port: gatewayInfo.port,
    pid: gatewayInfo.pid,
    uptime,
    health: {
      lastCheck: gatewayInfo.lastHealthCheck?.toISOString() ?? null,
      consecutiveFailures: gatewayInfo.consecutiveFailures,
    },
    resources: {
      memoryMb: gateway.memoryMb,
      cpuPercent: gateway.cpuPercent,
      activeSessions: gateway.activeSessions,
    },
  };

  sendJson(res, response);
}

/**
 * POST /api/platform/tenant/gateway/restart - Restart tenant's gateway
 */
async function handleRestartGateway(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> {
  // Require admin + org
  const middleware = composeMiddleware(requireAuth(), requireOrganization(), requireAdmin());
  if (!(await middleware(ctx, res))) return;

  const orgId = ctx.user!.orgId;

  // Check gateway exists
  const gateway = await prisma.tenantGateway.findUnique({
    where: { organizationId: orgId },
  });

  if (!gateway) {
    sendError(res, "NOT_FOUND", "Gateway not found for this organization");
    return;
  }

  // Restart the gateway
  try {
    await restartGateway(orgId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to restart gateway";
    sendError(res, "INTERNAL_ERROR", message);
    return;
  }

  // Get updated status
  const updatedGateway = await prisma.tenantGateway.findUnique({
    where: { organizationId: orgId },
  });

  // Log audit event
  const auditCtx: AuditContext = {
    user: {
      id: ctx.user!.id,
      role: mapRoleToPrisma(ctx.user!.role),
      organizationId: orgId,
    },
    ip: ctx.ip,
  };

  await logAudit(
    auditCtx,
    AUDIT_ACTIONS.TENANT_GATEWAY_RESTARTED,
    TARGET_TYPES.TENANT_GATEWAY,
    gateway.id,
    { previousPid: gateway.pid, newPid: updatedGateway?.pid },
  );

  sendJson(res, {
    success: true,
    message: "Gateway restart initiated",
    newPid: updatedGateway?.pid ?? null,
  });
}

/**
 * GET /api/platform/tenant/config - Get tenant configuration
 */
async function handleGetConfig(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> {
  // Require auth + org membership
  const middleware = composeMiddleware(requireAuth(), requireOrganization());
  if (!(await middleware(ctx, res))) return;

  const orgId = ctx.user!.orgId;

  const config = await prisma.tenantConfig.findUnique({
    where: { organizationId: orgId },
  });

  if (!config) {
    sendError(res, "NOT_FOUND", "Configuration not found for this organization");
    return;
  }

  const response: TenantConfigResponse = {
    model: config.model,
    agentName: config.agentName,
    systemPrompt: config.systemPrompt,
    features: config.features as Record<string, unknown>,
    limits: {
      maxTokensPerDay: config.maxTokensPerDay,
      maxConcurrentSessions: config.maxConcurrentSessions,
      maxMemoryMb: config.maxMemoryMb,
    },
  };

  sendJson(res, response);
}

/**
 * PUT /api/platform/tenant/config - Update tenant configuration
 */
async function handleUpdateConfig(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> {
  // Require admin + org
  const middleware = composeMiddleware(requireAuth(), requireOrganization(), requireAdmin());
  if (!(await middleware(ctx, res))) return;

  const orgId = ctx.user!.orgId;

  // Parse body
  const body = await parseBody<unknown>(req);
  if (!body.ok) {
    sendError(res, "BAD_REQUEST", body.error);
    return;
  }

  // Validate
  const validation = validateUpdateConfig(body.value);
  if (!validation.ok) {
    sendError(res, "BAD_REQUEST", validation.error);
    return;
  }

  const { model, agentName, systemPrompt, features } = validation.value;

  // Get current config
  const currentConfig = await prisma.tenantConfig.findUnique({
    where: { organizationId: orgId },
  });

  if (!currentConfig) {
    sendError(res, "NOT_FOUND", "Configuration not found for this organization");
    return;
  }

  // Build update data and track changes
  const updateData: Record<string, unknown> = {};
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  if (model !== undefined && model !== currentConfig.model) {
    updateData.model = model;
    changes.model = { old: currentConfig.model, new: model };
  }

  if (agentName !== undefined && agentName !== currentConfig.agentName) {
    updateData.agentName = agentName;
    changes.agentName = { old: currentConfig.agentName, new: agentName };
  }

  if (systemPrompt !== undefined && systemPrompt !== currentConfig.systemPrompt) {
    updateData.systemPrompt = systemPrompt;
    changes.systemPrompt = { old: currentConfig.systemPrompt, new: systemPrompt };
  }

  if (features !== undefined) {
    const currentFeatures = currentConfig.features as Record<string, unknown>;
    if (JSON.stringify(currentFeatures) !== JSON.stringify(features)) {
      updateData.features = features;
      changes.features = { old: currentFeatures, new: features };
    }
  }

  // If no changes, return current state
  if (Object.keys(updateData).length === 0) {
    const response: TenantConfigResponse = {
      model: currentConfig.model,
      agentName: currentConfig.agentName,
      systemPrompt: currentConfig.systemPrompt,
      features: currentConfig.features as Record<string, unknown>,
      limits: {
        maxTokensPerDay: currentConfig.maxTokensPerDay,
        maxConcurrentSessions: currentConfig.maxConcurrentSessions,
        maxMemoryMb: currentConfig.maxMemoryMb,
      },
    };
    sendJson(res, response);
    return;
  }

  // Update config
  const updatedConfig = await prisma.tenantConfig.update({
    where: { organizationId: orgId },
    data: updateData,
  });

  // Regenerate config file and signal gateway to reload
  try {
    const [organization, gateway] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId } }),
      prisma.tenantGateway.findUnique({ where: { organizationId: orgId } }),
    ]);

    if (organization && gateway) {
      await generateAndWriteConfig(organization, updatedConfig, gateway);
      // Send SIGUSR1 to trigger config reload
      sendSignal(orgId, "SIGUSR1");
    }
  } catch (error) {
    // Log but don't fail - config is updated, reload may need manual intervention
    console.error("[tenant-gateway] Failed to regenerate config:", error);
  }

  // Log audit event
  const auditCtx: AuditContext = {
    user: {
      id: ctx.user!.id,
      role: mapRoleToPrisma(ctx.user!.role),
      organizationId: orgId,
    },
    ip: ctx.ip,
  };

  await logAudit(
    auditCtx,
    AUDIT_ACTIONS.TENANT_CONFIG_UPDATED,
    TARGET_TYPES.TENANT_CONFIG,
    currentConfig.id,
    { changes },
  );

  const response: TenantConfigResponse = {
    model: updatedConfig.model,
    agentName: updatedConfig.agentName,
    systemPrompt: updatedConfig.systemPrompt,
    features: updatedConfig.features as Record<string, unknown>,
    limits: {
      maxTokensPerDay: updatedConfig.maxTokensPerDay,
      maxConcurrentSessions: updatedConfig.maxConcurrentSessions,
      maxMemoryMb: updatedConfig.maxMemoryMb,
    },
  };

  sendJson(res, response);
}

/**
 * POST /api/platform/tenant/provision - Manually trigger provisioning
 */
async function handleProvision(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> {
  // Require admin
  const middleware = composeMiddleware(requireAuth(), requireAdmin());
  if (!(await middleware(ctx, res))) return;

  // Parse body
  const body = await parseBody<unknown>(req);
  if (!body.ok) {
    sendError(res, "BAD_REQUEST", body.error);
    return;
  }

  // Validate
  const validation = validateProvisionRequest(body.value);
  if (!validation.ok) {
    sendError(res, "BAD_REQUEST", validation.error);
    return;
  }

  const { organizationId } = validation.value;

  // Check organization exists
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!organization) {
    sendError(res, "NOT_FOUND", "Organization not found");
    return;
  }

  // Check if already provisioned
  const existingGateway = await prisma.tenantGateway.findUnique({
    where: { organizationId },
  });

  if (existingGateway) {
    sendError(res, "CONFLICT", "Tenant already provisioned", {
      gatewayId: existingGateway.id,
      status: existingGateway.status,
    });
    return;
  }

  // Find available port (simple implementation - in production use port allocator)
  const usedPorts = await prisma.tenantGateway.findMany({
    select: { port: true },
  });
  const usedPortSet = new Set(usedPorts.map((p) => p.port));

  let port = 40000;
  while (usedPortSet.has(port) && port < 50000) {
    port++;
  }

  if (port >= 50000) {
    sendError(res, "SERVICE_UNAVAILABLE", "No available ports for new gateway");
    return;
  }

  // Create gateway and config records
  const configPath = getConfigPath(organizationId);
  const statePath = `/tenants/${organizationId}/state`;
  const workspacePath = `/tenants/${organizationId}/workspace`;

  const [gateway, config] = await prisma.$transaction([
    prisma.tenantGateway.create({
      data: {
        organizationId,
        port,
        status: "PROVISIONING",
        configPath,
        statePath,
        workspacePath,
      },
    }),
    prisma.tenantConfig.create({
      data: {
        organizationId,
        model: "anthropic/claude-sonnet-4-20250514",
        agentName: organization.name ? `${organization.name} Assistant` : "Assistant",
      },
    }),
  ]);

  // Generate config file
  try {
    await generateAndWriteConfig(organization, config, gateway);
  } catch (error) {
    // Rollback on config generation failure
    await prisma.tenantConfig.deleteMany({ where: { id: config.id } });
    await prisma.tenantGateway.delete({ where: { id: gateway.id } });
    const message = error instanceof Error ? error.message : "Failed to generate configuration";
    sendError(res, "INTERNAL_ERROR", message);
    return;
  }

  // Log audit event
  const auditCtx: AuditContext = {
    user: {
      id: ctx.user!.id,
      role: mapRoleToPrisma(ctx.user!.role),
      organizationId: ctx.user!.orgId,
    },
    ip: ctx.ip,
  };

  await logAudit(
    auditCtx,
    AUDIT_ACTIONS.TENANT_PROVISIONED,
    TARGET_TYPES.TENANT_GATEWAY,
    gateway.id,
    { organizationId, port },
  );

  sendJson(
    res,
    {
      success: true,
      message: "Tenant provisioned successfully",
      gateway: {
        id: gateway.id,
        port: gateway.port,
        status: gateway.status,
        configPath: gateway.configPath,
      },
    },
    201,
  );
}

/**
 * DELETE /api/platform/tenant/:orgId - Deprovision a tenant
 */
async function handleDeprovision(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
  orgId: string,
): Promise<void> {
  // Require admin
  const middleware = composeMiddleware(requireAuth(), requireAdmin());
  if (!(await middleware(ctx, res))) return;

  // Validate orgId is a UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(orgId)) {
    sendError(res, "BAD_REQUEST", "Invalid organization ID format");
    return;
  }

  // Check gateway exists
  const gateway = await prisma.tenantGateway.findUnique({
    where: { organizationId: orgId },
    include: { organization: true },
  });

  if (!gateway) {
    sendError(res, "NOT_FOUND", "Gateway not found for organization");
    return;
  }

  // Stop gateway if running
  if (
    gateway.status === "HEALTHY" ||
    gateway.status === "STARTING" ||
    gateway.status === "UNHEALTHY"
  ) {
    try {
      const { stopGateway } = await import("../../tenant/gateway-manager.js");
      await stopGateway(orgId);
    } catch (error) {
      // Log but continue with deprovision
      console.error("[tenant-gateway] Failed to stop gateway:", error);
    }
  }

  // Delete gateway and config records
  await prisma.$transaction([
    prisma.tenantCredential.deleteMany({ where: { organizationId: orgId } }),
    prisma.tenantConfig.deleteMany({ where: { organizationId: orgId } }),
    prisma.tenantGateway.delete({ where: { organizationId: orgId } }),
  ]);

  // Log audit event
  const auditCtx: AuditContext = {
    user: {
      id: ctx.user!.id,
      role: mapRoleToPrisma(ctx.user!.role),
      organizationId: ctx.user!.orgId,
    },
    ip: ctx.ip,
  };

  await logAudit(
    auditCtx,
    AUDIT_ACTIONS.TENANT_DEPROVISIONED,
    TARGET_TYPES.TENANT_GATEWAY,
    gateway.id,
    {
      organizationId: orgId,
      organizationName: gateway.organization?.name,
      port: gateway.port,
    },
  );

  sendJson(res, {
    success: true,
    message: "Tenant deprovisioned successfully",
    organizationId: orgId,
  });
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Map context role to Prisma UserRole
 */
function mapRoleToPrisma(role: string): UserRole {
  switch (role.toLowerCase()) {
    case "owner":
    case "admin":
      return "ADMIN";
    case "member":
    case "user":
      return "USER";
    case "viewer":
      return "VIEWER";
    case "billing":
      return "BILLING";
    case "super_admin":
      return "SUPER_ADMIN";
    default:
      return "USER";
  }
}
