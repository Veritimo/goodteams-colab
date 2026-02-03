/**
 * Tests for Connector API Routes
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies
vi.mock("../../../audit/logger.js", () => ({
  logAudit: vi.fn(),
}));

vi.mock("../../../connectors/index.js", () => ({
  createConnector: vi.fn(),
  getConnector: vi.fn(),
  listConnectors: vi.fn(),
  updateConnector: vi.fn(),
  deleteConnector: vi.fn(),
  updateConnectorStatus: vi.fn(),
  ConnectorNotFoundError: class extends Error {
    constructor(id: string) {
      super(`Connector not found: ${id}`);
      this.name = "ConnectorNotFoundError";
    }
  },
  ConnectorAlreadyExistsError: class extends Error {
    constructor(name: string) {
      super(`Connector with name '${name}' already exists`);
      this.name = "ConnectorAlreadyExistsError";
    }
  },
}));

vi.mock("../../../connectors/schema-hints/index.js", () => ({
  listSchemaHints: vi.fn(),
  getSchemaCache: vi.fn(),
  updateSchemaCache: vi.fn(),
  createSchemaHint: vi.fn(),
  deleteSchemaHint: vi.fn(),
}));

import type { RequestContext } from "../../middleware/context.js";
import { logAudit } from "../../../audit/logger.js";
import {
  createConnector,
  getConnector,
  listConnectors,
  updateConnector,
  deleteConnector,
  updateConnectorStatus,
  ConnectorNotFoundError,
  ConnectorAlreadyExistsError,
} from "../../../connectors/index.js";
import { getSchemaCache, updateSchemaCache } from "../../../connectors/schema-hints/index.js";
import { handleConnectors } from "../connectors.js";

// Helper to create mock request
function createMockRequest(method: string, path: string, body?: object): IncomingMessage {
  const req = {
    method,
    url: path,
    headers: { host: "localhost:3000" },
    on: vi.fn((event, callback) => {
      if (event === "data" && body) {
        callback(Buffer.from(JSON.stringify(body)));
      }
      if (event === "end") {
        callback();
      }
      return req;
    }),
    destroy: vi.fn(),
  } as unknown as IncomingMessage;

  return req;
}

// Helper to create mock response
function createMockResponse(): ServerResponse & {
  _status: number;
  _body: string;
  _headers: Record<string, string>;
} {
  const res = {
    _status: 200,
    _body: "",
    _headers: {} as Record<string, string>,
    statusCode: 200,
    setHeader: vi.fn(function (this: any, name: string, value: string) {
      this._headers[name] = value;
    }),
    end: vi.fn(function (this: any, body?: string) {
      if (body) this._body = body;
    }),
    get statusCode() {
      return this._status;
    },
    set statusCode(code: number) {
      this._status = code;
    },
  } as unknown as ServerResponse & {
    _status: number;
    _body: string;
    _headers: Record<string, string>;
  };

  return res;
}

// Helper to create mock context
function createMockContext(overrides?: Partial<RequestContext>): RequestContext {
  return {
    user: {
      id: "user-123",
      email: "test@example.com",
      role: "admin",
      orgId: "org-123",
    },
    ip: "127.0.0.1",
    requestId: "req-123",
    ...overrides,
  } as RequestContext;
}

describe("Connector API Routes", () => {
  const mockConnector = {
    id: "conn-123",
    organizationId: "org-123",
    type: "SQL_SERVER" as const,
    name: "Test Database",
    description: "A test database",
    config: { host: "localhost", port: 1433 },
    status: "CONNECTED" as const,
    lastHealthCheck: new Date(),
    healthMessage: "OK",
    isReadOnly: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: "user-123",
    schemaHints: [],
    schemaCache: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // LIST CONNECTORS
  // ===========================================================================

  describe("GET /api/platform/connectors", () => {
    it("should list connectors for organization", async () => {
      vi.mocked(listConnectors).mockResolvedValue([mockConnector]);

      const req = createMockRequest("GET", "/api/platform/connectors");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleConnectors(req, res, ctx);

      expect(res._status).toBe(200);
      const body = JSON.parse(res._body);
      expect(body.connectors).toHaveLength(1);
      expect(body.total).toBe(1);
    });

    it("should filter by type", async () => {
      vi.mocked(listConnectors).mockResolvedValue([]);

      const req = createMockRequest("GET", "/api/platform/connectors?type=SQL_SERVER");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleConnectors(req, res, ctx);

      expect(listConnectors).toHaveBeenCalledWith("org-123", "SQL_SERVER");
    });

    it("should require authentication", async () => {
      const req = createMockRequest("GET", "/api/platform/connectors");
      const res = createMockResponse();
      const ctx = createMockContext({ user: undefined as any });

      await handleConnectors(req, res, ctx);

      expect(res._status).toBe(401);
    });

    it("should require organization membership", async () => {
      const req = createMockRequest("GET", "/api/platform/connectors");
      const res = createMockResponse();
      const ctx = createMockContext({
        user: { id: "user-123", email: "test@example.com", role: "admin", orgId: undefined as any },
      });

      await handleConnectors(req, res, ctx);

      expect(res._status).toBe(403);
    });
  });

  // ===========================================================================
  // CREATE CONNECTOR
  // ===========================================================================

  describe("POST /api/platform/connectors", () => {
    it("should create a connector", async () => {
      vi.mocked(createConnector).mockResolvedValue(mockConnector);

      const req = createMockRequest("POST", "/api/platform/connectors", {
        type: "SQL_SERVER",
        name: "Test Database",
        config: { host: "localhost" },
      });
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleConnectors(req, res, ctx);

      expect(res._status).toBe(201);
      const body = JSON.parse(res._body);
      expect(body.id).toBe("conn-123");
      expect(logAudit).toHaveBeenCalled();
    });

    it("should require admin role", async () => {
      const req = createMockRequest("POST", "/api/platform/connectors", {
        type: "SQL_SERVER",
        name: "Test",
        config: {},
      });
      const res = createMockResponse();
      const ctx = createMockContext({
        user: { id: "user-123", email: "test@example.com", role: "member", orgId: "org-123" },
      });

      await handleConnectors(req, res, ctx);

      expect(res._status).toBe(403);
    });

    it("should validate required fields", async () => {
      const req = createMockRequest("POST", "/api/platform/connectors", {
        name: "Test", // missing type and config
      });
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleConnectors(req, res, ctx);

      expect(res._status).toBe(400);
    });

    it("should validate connection type", async () => {
      const req = createMockRequest("POST", "/api/platform/connectors", {
        type: "INVALID_TYPE",
        name: "Test",
        config: {},
      });
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleConnectors(req, res, ctx);

      expect(res._status).toBe(400);
      const body = JSON.parse(res._body);
      expect(body.error.message).toContain("Invalid type");
    });

    it("should handle duplicate name conflict", async () => {
      vi.mocked(createConnector).mockRejectedValue(new ConnectorAlreadyExistsError("Test"));

      const req = createMockRequest("POST", "/api/platform/connectors", {
        type: "SQL_SERVER",
        name: "Test",
        config: {},
      });
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleConnectors(req, res, ctx);

      expect(res._status).toBe(409);
    });
  });

  // ===========================================================================
  // GET CONNECTOR
  // ===========================================================================

  describe("GET /api/platform/connectors/:id", () => {
    it("should return connector by ID", async () => {
      vi.mocked(getConnector).mockResolvedValue(mockConnector);

      const req = createMockRequest("GET", "/api/platform/connectors/conn-123");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleConnectors(req, res, ctx);

      expect(res._status).toBe(200);
      const body = JSON.parse(res._body);
      expect(body.id).toBe("conn-123");
    });

    it("should return 404 for missing connector", async () => {
      vi.mocked(getConnector).mockRejectedValue(new ConnectorNotFoundError("nonexistent"));

      const req = createMockRequest("GET", "/api/platform/connectors/nonexistent");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleConnectors(req, res, ctx);

      expect(res._status).toBe(404);
    });

    it("should return 403 for connector from different org", async () => {
      vi.mocked(getConnector).mockResolvedValue({
        ...mockConnector,
        organizationId: "other-org",
      });

      const req = createMockRequest("GET", "/api/platform/connectors/conn-123");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleConnectors(req, res, ctx);

      expect(res._status).toBe(403);
    });
  });

  // ===========================================================================
  // UPDATE CONNECTOR
  // ===========================================================================

  describe("PUT /api/platform/connectors/:id", () => {
    it("should update connector", async () => {
      vi.mocked(getConnector).mockResolvedValue(mockConnector);
      vi.mocked(updateConnector).mockResolvedValue({
        ...mockConnector,
        name: "Updated Name",
      });

      const req = createMockRequest("PUT", "/api/platform/connectors/conn-123", {
        name: "Updated Name",
      });
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleConnectors(req, res, ctx);

      expect(res._status).toBe(200);
      const body = JSON.parse(res._body);
      expect(body.name).toBe("Updated Name");
      expect(logAudit).toHaveBeenCalled();
    });

    it("should require admin role", async () => {
      const req = createMockRequest("PUT", "/api/platform/connectors/conn-123", {
        name: "Updated",
      });
      const res = createMockResponse();
      const ctx = createMockContext({
        user: { id: "user-123", email: "test@example.com", role: "member", orgId: "org-123" },
      });

      await handleConnectors(req, res, ctx);

      expect(res._status).toBe(403);
    });

    it("should validate status", async () => {
      vi.mocked(getConnector).mockResolvedValue(mockConnector);

      const req = createMockRequest("PUT", "/api/platform/connectors/conn-123", {
        status: "INVALID_STATUS",
      });
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleConnectors(req, res, ctx);

      expect(res._status).toBe(400);
    });
  });

  // ===========================================================================
  // DELETE CONNECTOR
  // ===========================================================================

  describe("DELETE /api/platform/connectors/:id", () => {
    it("should delete connector", async () => {
      vi.mocked(getConnector).mockResolvedValue(mockConnector);
      vi.mocked(deleteConnector).mockResolvedValue(true);

      const req = createMockRequest("DELETE", "/api/platform/connectors/conn-123");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleConnectors(req, res, ctx);

      expect(res._status).toBe(200);
      const body = JSON.parse(res._body);
      expect(body.success).toBe(true);
      expect(logAudit).toHaveBeenCalled();
    });

    it("should require admin role", async () => {
      const req = createMockRequest("DELETE", "/api/platform/connectors/conn-123");
      const res = createMockResponse();
      const ctx = createMockContext({
        user: { id: "user-123", email: "test@example.com", role: "member", orgId: "org-123" },
      });

      await handleConnectors(req, res, ctx);

      expect(res._status).toBe(403);
    });
  });

  // ===========================================================================
  // TEST CONNECTION
  // ===========================================================================

  describe("POST /api/platform/connectors/:id/test", () => {
    it("should test connection", async () => {
      vi.mocked(getConnector).mockResolvedValue(mockConnector);
      vi.mocked(updateConnectorStatus).mockResolvedValue(mockConnector);

      const req = createMockRequest("POST", "/api/platform/connectors/conn-123/test");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleConnectors(req, res, ctx);

      expect(res._status).toBe(200);
      const body = JSON.parse(res._body);
      expect(body.success).toBe(true);
      expect(body.latencyMs).toBeDefined();
      expect(logAudit).toHaveBeenCalled();
    });

    it("should return 404 for missing connector", async () => {
      vi.mocked(getConnector).mockRejectedValue(new ConnectorNotFoundError("conn-123"));

      const req = createMockRequest("POST", "/api/platform/connectors/conn-123/test");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleConnectors(req, res, ctx);

      expect(res._status).toBe(404);
    });
  });

  // ===========================================================================
  // REFRESH SCHEMA
  // ===========================================================================

  describe("POST /api/platform/connectors/:id/refresh-schema", () => {
    it("should refresh schema cache", async () => {
      vi.mocked(getConnector).mockResolvedValue(mockConnector);
      vi.mocked(getSchemaCache).mockResolvedValue(null);
      vi.mocked(updateSchemaCache).mockResolvedValue({
        id: "cache-123",
        connectionId: "conn-123",
        tables: [{ name: "example_table", columns: [] }],
        relationships: null,
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      });

      const req = createMockRequest("POST", "/api/platform/connectors/conn-123/refresh-schema");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleConnectors(req, res, ctx);

      expect(res._status).toBe(200);
      const body = JSON.parse(res._body);
      expect(body.success).toBe(true);
      expect(body.tables).toBeDefined();
      expect(logAudit).toHaveBeenCalled();
    });

    it("should return 404 for missing connector", async () => {
      vi.mocked(getConnector).mockRejectedValue(new ConnectorNotFoundError("conn-123"));

      const req = createMockRequest("POST", "/api/platform/connectors/conn-123/refresh-schema");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleConnectors(req, res, ctx);

      expect(res._status).toBe(404);
    });
  });

  // ===========================================================================
  // METHOD NOT ALLOWED
  // ===========================================================================

  describe("Method not allowed", () => {
    it("should return 405 for unsupported methods", async () => {
      const req = createMockRequest("PATCH", "/api/platform/connectors/conn-123");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleConnectors(req, res, ctx);

      expect(res._status).toBe(405);
    });
  });
});
