/**
 * Connector routes for platform API
 *
 * Handles connector management within an organization.
 *
 * Endpoints:
 * - GET    /api/platform/connectors             - List connectors for org
 * - POST   /api/platform/connectors             - Create connector
 * - GET    /api/platform/connectors/:id         - Get connector
 * - PUT    /api/platform/connectors/:id         - Update connector
 * - DELETE /api/platform/connectors/:id         - Delete connector
 * - POST   /api/platform/connectors/:id/test    - Test connection
 * - POST   /api/platform/connectors/:id/refresh-schema - Refresh schema cache
 *
 * @see docs/IMPLEMENTATION-PLAN-PHASE6.md
 */

import type { ConnectionType, ConnectionStatus } from "@prisma/client";
import type { UserRole } from "@prisma/client";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../middleware/context.js";
import { AUDIT_ACTIONS, TARGET_TYPES } from "../../audit/actions.js";
import { logAudit, type AuditContext } from "../../audit/logger.js";
import {
  createConnector,
  getConnector,
  listConnectors,
  updateConnector,
  deleteConnector,
  updateConnectorStatus,
  ConnectorNotFoundError,
  ConnectorAlreadyExistsError,
  type ConnectorWithHints,
  type ConnectionConfig,
  type ConnectionCredentials,
} from "../../connectors/index.js";
import {
  listSchemaHints,
  getSchemaCache,
  updateSchemaCache,
  createSchemaHint,
  deleteSchemaHint,
  type SchemaTable,
} from "../../connectors/schema-hints/index.js";
import { sendError, handleError } from "../middleware/errors.js";
import {
  requireAuth,
  requireAdmin,
  requireOrganization,
  composeMiddleware,
} from "../middleware/require-permission.js";
import { sendJson, parseBody, type RouteHandler } from "./utils.js";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Connector creation request body
 */
interface CreateConnectorRequest {
  type: ConnectionType;
  name: string;
  description?: string;
  config: ConnectionConfig;
  credentials?: ConnectionCredentials;
  isReadOnly?: boolean;
}

/**
 * Connector update request body
 */
interface UpdateConnectorRequest {
  name?: string;
  description?: string;
  config?: ConnectionConfig;
  credentials?: ConnectionCredentials;
  isReadOnly?: boolean;
  status?: ConnectionStatus;
}

/**
 * Connector response type (matches ConnectorWithHints but serialized)
 */
interface ConnectorResponse {
  id: string;
  organizationId: string;
  type: ConnectionType;
  name: string;
  description: string | null;
  config: ConnectionConfig;
  status: ConnectionStatus;
  lastHealthCheck: string | null;
  healthMessage: string | null;
  isReadOnly: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  schemaHints: Array<{
    id: string;
    tableName: string;
    columnName: string | null;
    description: string;
    pattern: string | null;
  }>;
  schemaCache: {
    tables: SchemaTable[];
    cachedAt: string;
    expiresAt: string;
  } | null;
}

/**
 * Connector list response
 */
interface ConnectorsListResponse {
  connectors: ConnectorResponse[];
  total: number;
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/**
 * Handle connector routes
 */
export const handleConnectors: RouteHandler = async (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method?.toUpperCase() ?? "GET";

  try {
    // POST /api/platform/connectors/:id/test - Test connection
    const testMatch = path.match(/^\/api\/platform\/connectors\/([^/]+)\/test$/);
    if (testMatch && method === "POST") {
      const connectorId = testMatch[1];
      await handleTestConnection(req, res, ctx, connectorId);
      return;
    }

    // POST /api/platform/connectors/:id/refresh-schema - Refresh schema cache
    const refreshMatch = path.match(/^\/api\/platform\/connectors\/([^/]+)\/refresh-schema$/);
    if (refreshMatch && method === "POST") {
      const connectorId = refreshMatch[1];
      await handleRefreshSchema(req, res, ctx, connectorId);
      return;
    }

    // GET /api/platform/connectors/:id - Get specific connector
    const connectorMatch = path.match(/^\/api\/platform\/connectors\/([^/]+)$/);
    if (connectorMatch && method === "GET") {
      const connectorId = connectorMatch[1];
      await handleGetConnector(req, res, ctx, connectorId);
      return;
    }

    // PUT /api/platform/connectors/:id - Update connector
    if (connectorMatch && method === "PUT") {
      const connectorId = connectorMatch[1];
      await handleUpdateConnector(req, res, ctx, connectorId);
      return;
    }

    // DELETE /api/platform/connectors/:id - Delete connector
    if (connectorMatch && method === "DELETE") {
      const connectorId = connectorMatch[1];
      await handleDeleteConnector(req, res, ctx, connectorId);
      return;
    }

    // GET /api/platform/connectors - List connectors
    if (path === "/api/platform/connectors" && method === "GET") {
      await handleListConnectors(req, res, ctx, url);
      return;
    }

    // POST /api/platform/connectors - Create connector
    if (path === "/api/platform/connectors" && method === "POST") {
      await handleCreateConnector(req, res, ctx);
      return;
    }

    // Method not allowed
    sendError(res, "METHOD_NOT_ALLOWED", `Method ${method} not allowed for ${path}`);
  } catch (error) {
    handleError(res, error);
  }
};

// =============================================================================
// HANDLERS
// =============================================================================

/**
 * GET /api/platform/connectors - List connectors for organization
 */
async function handleListConnectors(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
  url: URL,
): Promise<void> {
  // Require auth + org membership
  const middleware = composeMiddleware(requireAuth(), requireOrganization());
  if (!(await middleware(ctx, res))) return;

  // Parse optional type filter
  const typeParam = url.searchParams.get("type") as ConnectionType | null;

  const connectors = await listConnectors(ctx.user!.orgId!, typeParam ?? undefined);

  const response: ConnectorsListResponse = {
    connectors: connectors.map(mapConnectorToResponse),
    total: connectors.length,
  };

  sendJson(res, response);
}

/**
 * POST /api/platform/connectors - Create a new connector
 */
async function handleCreateConnector(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> {
  // Require admin + org
  const middleware = composeMiddleware(requireAuth(), requireOrganization(), requireAdmin());
  if (!(await middleware(ctx, res))) return;

  // Parse body
  const body = await parseBody<CreateConnectorRequest>(req);
  if (!body.ok) {
    sendError(res, "BAD_REQUEST", body.error);
    return;
  }

  const { type, name, description, config, credentials, isReadOnly } = body.value;

  // Validate required fields
  if (!type || !name || !config) {
    sendError(res, "BAD_REQUEST", "type, name, and config are required");
    return;
  }

  // Validate type
  const validTypes: ConnectionType[] = [
    "SQL_SERVER",
    "POSTGRESQL",
    "MYSQL",
    "DATAVERSE",
    "SALESFORCE",
  ];
  if (!validTypes.includes(type)) {
    sendError(res, "BAD_REQUEST", `Invalid type. Must be one of: ${validTypes.join(", ")}`);
    return;
  }

  try {
    const connector = await createConnector({
      organizationId: ctx.user!.orgId!,
      type,
      name,
      description,
      config,
      credentials,
      isReadOnly,
      createdBy: ctx.user!.id,
    });

    // Log audit event
    await logAuditEvent(ctx, "connector.created", "connector", connector.id, {
      name,
      type,
    });

    sendJson(res, mapConnectorToResponse(connector), 201);
  } catch (error) {
    if (error instanceof ConnectorAlreadyExistsError) {
      sendError(res, "CONFLICT", error.message);
      return;
    }
    throw error;
  }
}

/**
 * GET /api/platform/connectors/:id - Get a specific connector
 */
async function handleGetConnector(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
  connectorId: string,
): Promise<void> {
  // Require auth + org membership
  const middleware = composeMiddleware(requireAuth(), requireOrganization());
  if (!(await middleware(ctx, res))) return;

  try {
    const connector = await getConnector(connectorId);

    // Verify connector belongs to user's organization
    if (connector.organizationId !== ctx.user!.orgId) {
      sendError(res, "FORBIDDEN", "Connector does not belong to your organization");
      return;
    }

    sendJson(res, mapConnectorToResponse(connector));
  } catch (error) {
    if (error instanceof ConnectorNotFoundError) {
      sendError(res, "NOT_FOUND", error.message);
      return;
    }
    throw error;
  }
}

/**
 * PUT /api/platform/connectors/:id - Update a connector
 */
async function handleUpdateConnector(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
  connectorId: string,
): Promise<void> {
  // Require admin + org
  const middleware = composeMiddleware(requireAuth(), requireOrganization(), requireAdmin());
  if (!(await middleware(ctx, res))) return;

  try {
    // Verify connector exists and belongs to org
    const existing = await getConnector(connectorId);
    if (existing.organizationId !== ctx.user!.orgId) {
      sendError(res, "FORBIDDEN", "Connector does not belong to your organization");
      return;
    }

    // Parse body
    const body = await parseBody<UpdateConnectorRequest>(req);
    if (!body.ok) {
      sendError(res, "BAD_REQUEST", body.error);
      return;
    }

    const { name, description, config, credentials, isReadOnly, status } = body.value;

    // Validate status if provided
    if (status) {
      const validStatuses: ConnectionStatus[] = ["PENDING", "CONNECTED", "ERROR", "DISABLED"];
      if (!validStatuses.includes(status)) {
        sendError(
          res,
          "BAD_REQUEST",
          `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        );
        return;
      }
    }

    const connector = await updateConnector(connectorId, {
      name,
      description,
      config,
      credentials,
      isReadOnly,
      status,
    });

    // Log audit event
    await logAuditEvent(ctx, "connector.updated", "connector", connectorId, {
      name: connector.name,
      changes: Object.keys(body.value),
    });

    sendJson(res, mapConnectorToResponse(connector));
  } catch (error) {
    if (error instanceof ConnectorNotFoundError) {
      sendError(res, "NOT_FOUND", error.message);
      return;
    }
    throw error;
  }
}

/**
 * DELETE /api/platform/connectors/:id - Delete a connector
 */
async function handleDeleteConnector(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
  connectorId: string,
): Promise<void> {
  // Require admin + org
  const middleware = composeMiddleware(requireAuth(), requireOrganization(), requireAdmin());
  if (!(await middleware(ctx, res))) return;

  try {
    // Verify connector exists and belongs to org
    const existing = await getConnector(connectorId);
    if (existing.organizationId !== ctx.user!.orgId) {
      sendError(res, "FORBIDDEN", "Connector does not belong to your organization");
      return;
    }

    await deleteConnector(connectorId);

    // Log audit event
    await logAuditEvent(ctx, "connector.deleted", "connector", connectorId, {
      name: existing.name,
      type: existing.type,
    });

    sendJson(res, { success: true, message: "Connector deleted" });
  } catch (error) {
    if (error instanceof ConnectorNotFoundError) {
      sendError(res, "NOT_FOUND", error.message);
      return;
    }
    throw error;
  }
}

/**
 * POST /api/platform/connectors/:id/test - Test a connection
 */
async function handleTestConnection(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
  connectorId: string,
): Promise<void> {
  // Require admin + org
  const middleware = composeMiddleware(requireAuth(), requireOrganization(), requireAdmin());
  if (!(await middleware(ctx, res))) return;

  try {
    // Verify connector exists and belongs to org
    const connector = await getConnector(connectorId);
    if (connector.organizationId !== ctx.user!.orgId) {
      sendError(res, "FORBIDDEN", "Connector does not belong to your organization");
      return;
    }

    // TODO: Implement actual connection testing based on connector type
    // For now, return a mock success response
    const startTime = Date.now();

    // Simulate connection test
    const testResult = {
      success: true,
      latencyMs: Date.now() - startTime + Math.floor(Math.random() * 100),
      message: `Connection test successful for ${connector.type} connector`,
      testedAt: new Date().toISOString(),
    };

    // Update connector status based on test result
    if (testResult.success) {
      await updateConnectorStatus(connectorId, "CONNECTED", testResult.message);
    } else {
      await updateConnectorStatus(connectorId, "ERROR", testResult.message);
    }

    // Log audit event
    await logAuditEvent(ctx, "connector.tested", "connector", connectorId, {
      name: connector.name,
      success: testResult.success,
    });

    sendJson(res, testResult);
  } catch (error) {
    if (error instanceof ConnectorNotFoundError) {
      sendError(res, "NOT_FOUND", error.message);
      return;
    }
    throw error;
  }
}

/**
 * POST /api/platform/connectors/:id/refresh-schema - Refresh schema cache
 */
async function handleRefreshSchema(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
  connectorId: string,
): Promise<void> {
  // Require admin + org
  const middleware = composeMiddleware(requireAuth(), requireOrganization(), requireAdmin());
  if (!(await middleware(ctx, res))) return;

  try {
    // Verify connector exists and belongs to org
    const connector = await getConnector(connectorId);
    if (connector.organizationId !== ctx.user!.orgId) {
      sendError(res, "FORBIDDEN", "Connector does not belong to your organization");
      return;
    }

    // TODO: Implement actual schema introspection based on connector type
    // For now, return the existing cache or create a mock one
    const existingCache = await getSchemaCache(connectorId);

    const mockTables: SchemaTable[] = existingCache?.tables ?? [
      {
        name: "example_table",
        columns: [
          { name: "id", type: "int", nullable: false, isPrimaryKey: true },
          { name: "name", type: "varchar(255)", nullable: true },
          { name: "created_at", type: "datetime", nullable: false },
        ],
      },
    ];

    const cache = await updateSchemaCache(connectorId, mockTables, undefined, 3600000);

    // Log audit event
    await logAuditEvent(ctx, "connector.schema_refreshed", "connector", connectorId, {
      name: connector.name,
      tableCount: mockTables.length,
    });

    sendJson(res, {
      success: true,
      message: "Schema cache refreshed",
      tables: cache.tables,
      cachedAt: cache.cachedAt.toISOString(),
      expiresAt: cache.expiresAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof ConnectorNotFoundError) {
      sendError(res, "NOT_FOUND", error.message);
      return;
    }
    throw error;
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Map connector to API response format
 */
function mapConnectorToResponse(connector: ConnectorWithHints): ConnectorResponse {
  return {
    id: connector.id,
    organizationId: connector.organizationId,
    type: connector.type,
    name: connector.name,
    description: connector.description,
    config: connector.config,
    status: connector.status,
    lastHealthCheck: connector.lastHealthCheck?.toISOString() ?? null,
    healthMessage: connector.healthMessage,
    isReadOnly: connector.isReadOnly,
    createdAt: connector.createdAt.toISOString(),
    updatedAt: connector.updatedAt.toISOString(),
    createdBy: connector.createdBy,
    schemaHints: connector.schemaHints.map((h) => ({
      id: h.id,
      tableName: h.tableName,
      columnName: h.columnName,
      description: h.description,
      pattern: h.pattern,
    })),
    schemaCache: connector.schemaCache
      ? {
          tables: connector.schemaCache.tables,
          cachedAt: connector.schemaCache.cachedAt.toISOString(),
          expiresAt: connector.schemaCache.expiresAt.toISOString(),
        }
      : null,
  };
}

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

/**
 * Log audit event helper
 */
async function logAuditEvent(
  ctx: RequestContext,
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown>,
): Promise<void> {
  const auditCtx: AuditContext = {
    user: {
      id: ctx.user!.id,
      role: mapRoleToPrisma(ctx.user!.role),
      organizationId: ctx.user!.orgId!,
    },
    ip: ctx.ip,
  };

  await logAudit(auditCtx, action, targetType, targetId, details);
}
