/**
 * Integration Tests for Workflow API Routes
 *
 * Tests CRUD operations, execution management, webhook triggers,
 * and tenant isolation for the workflow API.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// =============================================================================
// MOCKS
// =============================================================================

// Mock the workflow service
vi.mock("../../../workflows/service.js", () => ({
  createWorkflow: vi.fn(),
  getWorkflow: vi.fn(),
  getWorkflowWithExecutions: vi.fn(),
  listWorkflows: vi.fn(),
  updateWorkflow: vi.fn(),
  deleteWorkflow: vi.fn(),
  createExecution: vi.fn(),
  getExecution: vi.fn(),
  listExecutions: vi.fn(),
  getWorkflowByWebhookPath: vi.fn(),
  WorkflowNotFoundError: class extends Error {
    constructor(id: string) {
      super(`Workflow not found: ${id}`);
      this.name = "WorkflowNotFoundError";
    }
  },
  WorkflowAlreadyExistsError: class extends Error {
    constructor(name: string) {
      super(`Workflow with name '${name}' already exists`);
      this.name = "WorkflowAlreadyExistsError";
    }
  },
  WorkflowValidationError: class extends Error {
    errors: Array<{ code: string; message: string }>;
    constructor(errors: Array<{ code: string; message: string }>) {
      super("Validation failed");
      this.name = "WorkflowValidationError";
      this.errors = errors;
    }
  },
  ExecutionNotFoundError: class extends Error {
    constructor(id: string) {
      super(`Execution not found: ${id}`);
      this.name = "ExecutionNotFoundError";
    }
  },
  WorkflowNotActiveError: class extends Error {
    constructor(id: string) {
      super(`Workflow ${id} is not active`);
      this.name = "WorkflowNotActiveError";
    }
  },
  WorkflowAccessDeniedError: class extends Error {
    constructor() {
      super("Access denied");
      this.name = "WorkflowAccessDeniedError";
    }
  },
}));

// Mock the audit logger
vi.mock("../../../audit/logger.js", () => ({
  logAudit: vi.fn(),
}));

import type { RequestContext } from "../../middleware/context.js";
// Import mocked functions
import {
  createWorkflow,
  getWorkflow,
  getWorkflowWithExecutions,
  listWorkflows,
  updateWorkflow,
  deleteWorkflow,
  createExecution,
  getExecution,
  listExecutions,
  getWorkflowByWebhookPath,
  WorkflowNotFoundError,
  WorkflowAlreadyExistsError,
  WorkflowValidationError,
  ExecutionNotFoundError,
  WorkflowNotActiveError,
  WorkflowAccessDeniedError,
} from "../../../workflows/service.js";
import { handleWorkflows } from "../workflows.js";

// =============================================================================
// TEST HELPERS
// =============================================================================

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

function createMockResponse(): ServerResponse & {
  _status: number;
  _body: string;
  _headers: Record<string, string>;
} {
  let _statusCode = 200;
  const res = {
    _status: 200,
    _body: "",
    _headers: {} as Record<string, string>,
    setHeader: vi.fn(function (this: any, name: string, value: string) {
      this._headers[name] = value;
    }),
    end: vi.fn(function (this: any, body?: string) {
      if (body) this._body = body;
    }),
    get statusCode() {
      return _statusCode;
    },
    set statusCode(code: number) {
      _statusCode = code;
      this._status = code;
    },
  } as unknown as ServerResponse & {
    _status: number;
    _body: string;
    _headers: Record<string, string>;
  };

  return res;
}

function createMockContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    requestId: "test-request-id",
    timestamp: new Date(),
    ip: "127.0.0.1",
    userAgent: "test-agent",
    method: "GET",
    path: "/api/platform/workflows",
    user: {
      id: "user-123",
      email: "test@example.com",
      orgId: "org-456",
      role: "ADMIN",
    },
    ...overrides,
  };
}

// Test workflow data
const mockWorkflow = {
  id: "workflow-123",
  organizationId: "org-456",
  name: "Test Workflow",
  description: "A test workflow",
  definition: { nodes: [], edges: [] },
  status: "DRAFT" as const,
  triggerType: "MANUAL" as const,
  triggerConfig: null,
  createdBy: "user-123",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-02"),
};

const mockExecution = {
  id: "exec-789",
  workflowId: "workflow-123",
  status: "PENDING" as const,
  context: { inputs: {}, nodeOutputs: {}, globalVariables: {} },
  logs: [],
  triggeredBy: "user-123",
  startedAt: new Date("2024-01-01T10:00:00Z"),
  finishedAt: null,
  error: null,
  workflow: { id: "workflow-123", name: "Test Workflow" },
};

// =============================================================================
// TESTS
// =============================================================================

describe("Workflow API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // LIST WORKFLOWS
  // ===========================================================================

  describe("GET /api/platform/workflows", () => {
    it("should list workflows for authenticated user", async () => {
      const mockResult = {
        items: [mockWorkflow],
        total: 1,
        limit: 20,
        offset: 0,
      };
      vi.mocked(listWorkflows).mockResolvedValue(mockResult);

      const req = createMockRequest("GET", "/api/platform/workflows");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(200);
      expect(listWorkflows).toHaveBeenCalledWith("org-456", expect.any(Object));
      const body = JSON.parse(res._body);
      expect(body.workflows).toHaveLength(1);
      expect(body.total).toBe(1);
    });

    it("should filter workflows by status", async () => {
      vi.mocked(listWorkflows).mockResolvedValue({
        items: [],
        total: 0,
        limit: 20,
        offset: 0,
      });

      const req = createMockRequest("GET", "/api/platform/workflows?status=ACTIVE");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(listWorkflows).toHaveBeenCalledWith(
        "org-456",
        expect.objectContaining({ status: "ACTIVE" }),
      );
    });

    it("should filter workflows by trigger type", async () => {
      vi.mocked(listWorkflows).mockResolvedValue({
        items: [],
        total: 0,
        limit: 20,
        offset: 0,
      });

      const req = createMockRequest("GET", "/api/platform/workflows?triggerType=WEBHOOK");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(listWorkflows).toHaveBeenCalledWith(
        "org-456",
        expect.objectContaining({ triggerType: "WEBHOOK" }),
      );
    });

    it("should support search query", async () => {
      vi.mocked(listWorkflows).mockResolvedValue({
        items: [],
        total: 0,
        limit: 20,
        offset: 0,
      });

      const req = createMockRequest("GET", "/api/platform/workflows?search=test");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(listWorkflows).toHaveBeenCalledWith(
        "org-456",
        expect.objectContaining({ search: "test" }),
      );
    });

    it("should support pagination", async () => {
      vi.mocked(listWorkflows).mockResolvedValue({
        items: [],
        total: 100,
        limit: 10,
        offset: 20,
      });

      const req = createMockRequest("GET", "/api/platform/workflows?limit=10&offset=20");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(listWorkflows).toHaveBeenCalledWith(
        "org-456",
        expect.objectContaining({ limit: 10, offset: 20 }),
      );
    });

    it("should require authentication", async () => {
      const req = createMockRequest("GET", "/api/platform/workflows");
      const res = createMockResponse();
      const ctx = createMockContext({ user: undefined });

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(401);
    });

    it("should require organization", async () => {
      const req = createMockRequest("GET", "/api/platform/workflows");
      const res = createMockResponse();
      const ctx = createMockContext({
        user: { id: "user-123", email: "test@example.com", orgId: undefined as any, role: "ADMIN" },
      });

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(403);
    });
  });

  // ===========================================================================
  // CREATE WORKFLOW
  // ===========================================================================

  describe("POST /api/platform/workflows", () => {
    it("should create a new workflow", async () => {
      vi.mocked(createWorkflow).mockResolvedValue(mockWorkflow);

      const body = {
        name: "Test Workflow",
        description: "A test workflow",
        definition: { nodes: [], edges: [] },
      };

      const req = createMockRequest("POST", "/api/platform/workflows", body);
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(201);
      expect(createWorkflow).toHaveBeenCalledWith(
        "org-456",
        "user-123",
        expect.objectContaining({ name: "Test Workflow" }),
      );
    });

    it("should validate required name field", async () => {
      const body = {
        definition: { nodes: [], edges: [] },
      };

      const req = createMockRequest("POST", "/api/platform/workflows", body);
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(400);
      expect(createWorkflow).not.toHaveBeenCalled();
    });

    it("should validate required definition field", async () => {
      const body = {
        name: "Test Workflow",
      };

      const req = createMockRequest("POST", "/api/platform/workflows", body);
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(400);
      expect(createWorkflow).not.toHaveBeenCalled();
    });

    it("should handle validation errors", async () => {
      vi.mocked(createWorkflow).mockRejectedValue(
        new (WorkflowValidationError as any)([
          { code: "INVALID_NODE", message: "Invalid node configuration" },
        ]),
      );

      const body = {
        name: "Test Workflow",
        definition: { nodes: [{ invalid: true }], edges: [] },
      };

      const req = createMockRequest("POST", "/api/platform/workflows", body);
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(422);
    });

    it("should handle duplicate name error", async () => {
      vi.mocked(createWorkflow).mockRejectedValue(
        new (WorkflowAlreadyExistsError as any)("Test Workflow"),
      );

      const body = {
        name: "Test Workflow",
        definition: { nodes: [], edges: [] },
      };

      const req = createMockRequest("POST", "/api/platform/workflows", body);
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(409);
    });

    it("should create workflow with trigger configuration", async () => {
      vi.mocked(createWorkflow).mockResolvedValue({
        ...mockWorkflow,
        triggerType: "WEBHOOK",
        triggerConfig: { webhookPath: "abc123" },
      });

      const body = {
        name: "Webhook Workflow",
        definition: { nodes: [], edges: [] },
        triggerType: "WEBHOOK",
        triggerConfig: { webhookPath: "abc123" },
      };

      const req = createMockRequest("POST", "/api/platform/workflows", body);
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(201);
      expect(createWorkflow).toHaveBeenCalledWith(
        "org-456",
        "user-123",
        expect.objectContaining({
          triggerType: "WEBHOOK",
          triggerConfig: { webhookPath: "abc123" },
        }),
      );
    });
  });

  // ===========================================================================
  // GET WORKFLOW
  // ===========================================================================

  describe("GET /api/platform/workflows/:id", () => {
    it("should get workflow by ID", async () => {
      vi.mocked(getWorkflow).mockResolvedValue(mockWorkflow);

      const req = createMockRequest("GET", "/api/platform/workflows/workflow-123");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(200);
      expect(getWorkflow).toHaveBeenCalledWith("workflow-123", "org-456");
      const body = JSON.parse(res._body);
      expect(body.id).toBe("workflow-123");
    });

    it("should return 404 for non-existent workflow", async () => {
      vi.mocked(getWorkflow).mockRejectedValue(new (WorkflowNotFoundError as any)("workflow-999"));

      const req = createMockRequest("GET", "/api/platform/workflows/workflow-999");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(404);
    });

    it("should return 403 for workflow from another org", async () => {
      vi.mocked(getWorkflow).mockRejectedValue(new (WorkflowAccessDeniedError as any)());

      const req = createMockRequest("GET", "/api/platform/workflows/workflow-other");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(403);
    });

    it("should include executions when requested", async () => {
      vi.mocked(getWorkflowWithExecutions).mockResolvedValue({
        ...mockWorkflow,
        executions: [mockExecution],
      });

      const req = createMockRequest(
        "GET",
        "/api/platform/workflows/workflow-123?includeExecutions=true",
      );
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(200);
      expect(getWorkflowWithExecutions).toHaveBeenCalledWith("workflow-123", "org-456", 10);
      const body = JSON.parse(res._body);
      expect(body.executions).toHaveLength(1);
    });
  });

  // ===========================================================================
  // UPDATE WORKFLOW
  // ===========================================================================

  describe("PUT /api/platform/workflows/:id", () => {
    it("should update workflow", async () => {
      vi.mocked(updateWorkflow).mockResolvedValue({
        ...mockWorkflow,
        name: "Updated Workflow",
      });

      const body = {
        name: "Updated Workflow",
      };

      const req = createMockRequest("PUT", "/api/platform/workflows/workflow-123", body);
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(200);
      expect(updateWorkflow).toHaveBeenCalledWith(
        "workflow-123",
        "org-456",
        expect.objectContaining({ name: "Updated Workflow" }),
      );
    });

    it("should update workflow status", async () => {
      vi.mocked(updateWorkflow).mockResolvedValue({
        ...mockWorkflow,
        status: "ACTIVE",
      });

      const body = {
        status: "ACTIVE",
      };

      const req = createMockRequest("PUT", "/api/platform/workflows/workflow-123", body);
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(200);
      expect(updateWorkflow).toHaveBeenCalledWith(
        "workflow-123",
        "org-456",
        expect.objectContaining({ status: "ACTIVE" }),
      );
    });

    it("should update workflow definition", async () => {
      vi.mocked(updateWorkflow).mockResolvedValue({
        ...mockWorkflow,
        definition: { nodes: [{ id: "1" }], edges: [] } as any,
      });

      const body = {
        definition: { nodes: [{ id: "1" }], edges: [] },
      };

      const req = createMockRequest("PUT", "/api/platform/workflows/workflow-123", body);
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(200);
      expect(updateWorkflow).toHaveBeenCalledWith(
        "workflow-123",
        "org-456",
        expect.objectContaining({ definition: body.definition }),
      );
    });

    it("should return 404 for non-existent workflow", async () => {
      vi.mocked(updateWorkflow).mockRejectedValue(
        new (WorkflowNotFoundError as any)("workflow-999"),
      );

      const body = { name: "Updated" };
      const req = createMockRequest("PUT", "/api/platform/workflows/workflow-999", body);
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(404);
    });
  });

  // ===========================================================================
  // DELETE WORKFLOW
  // ===========================================================================

  describe("DELETE /api/platform/workflows/:id", () => {
    it("should delete (archive) workflow", async () => {
      vi.mocked(deleteWorkflow).mockResolvedValue({
        ...mockWorkflow,
        status: "ARCHIVED",
      });

      const req = createMockRequest("DELETE", "/api/platform/workflows/workflow-123");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(200);
      expect(deleteWorkflow).toHaveBeenCalledWith("workflow-123", "org-456");
    });

    it("should return 404 for non-existent workflow", async () => {
      vi.mocked(deleteWorkflow).mockRejectedValue(
        new (WorkflowNotFoundError as any)("workflow-999"),
      );

      const req = createMockRequest("DELETE", "/api/platform/workflows/workflow-999");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(404);
    });
  });

  // ===========================================================================
  // EXECUTE WORKFLOW
  // ===========================================================================

  describe("POST /api/platform/workflows/:id/execute", () => {
    it("should execute workflow", async () => {
      vi.mocked(getWorkflow).mockResolvedValue({
        ...mockWorkflow,
        status: "ACTIVE",
      });
      vi.mocked(createExecution).mockResolvedValue(mockExecution);

      const req = createMockRequest("POST", "/api/platform/workflows/workflow-123/execute", {
        inputs: { key: "value" },
      });
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(201);
      expect(createExecution).toHaveBeenCalledWith(
        "workflow-123",
        expect.objectContaining({
          inputs: { key: "value" },
          triggeredBy: "user-123",
        }),
      );
    });

    it("should execute workflow without inputs", async () => {
      vi.mocked(getWorkflow).mockResolvedValue({
        ...mockWorkflow,
        status: "ACTIVE",
      });
      vi.mocked(createExecution).mockResolvedValue(mockExecution);

      const req = createMockRequest("POST", "/api/platform/workflows/workflow-123/execute", {});
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(201);
    });

    it("should return 404 for non-existent workflow", async () => {
      vi.mocked(getWorkflow).mockRejectedValue(new (WorkflowNotFoundError as any)("workflow-999"));

      const req = createMockRequest("POST", "/api/platform/workflows/workflow-999/execute");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(404);
    });

    it("should return 422 for inactive workflow", async () => {
      vi.mocked(getWorkflow).mockResolvedValue(mockWorkflow);
      vi.mocked(createExecution).mockRejectedValue(
        new (WorkflowNotActiveError as any)("workflow-123"),
      );

      const req = createMockRequest("POST", "/api/platform/workflows/workflow-123/execute");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(422);
    });
  });

  // ===========================================================================
  // LIST EXECUTIONS
  // ===========================================================================

  describe("GET /api/platform/workflows/:id/executions", () => {
    it("should list executions for workflow", async () => {
      vi.mocked(listExecutions).mockResolvedValue({
        items: [mockExecution],
        total: 1,
        limit: 20,
        offset: 0,
      });

      const req = createMockRequest("GET", "/api/platform/workflows/workflow-123/executions");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(200);
      expect(listExecutions).toHaveBeenCalledWith("workflow-123", "org-456", expect.any(Object));
      const body = JSON.parse(res._body);
      expect(body.executions).toHaveLength(1);
    });

    it("should filter executions by status", async () => {
      vi.mocked(listExecutions).mockResolvedValue({
        items: [],
        total: 0,
        limit: 20,
        offset: 0,
      });

      const req = createMockRequest(
        "GET",
        "/api/platform/workflows/workflow-123/executions?status=COMPLETED",
      );
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(listExecutions).toHaveBeenCalledWith(
        "workflow-123",
        "org-456",
        expect.objectContaining({ status: "COMPLETED" }),
      );
    });

    it("should support pagination", async () => {
      vi.mocked(listExecutions).mockResolvedValue({
        items: [],
        total: 50,
        limit: 10,
        offset: 10,
      });

      const req = createMockRequest(
        "GET",
        "/api/platform/workflows/workflow-123/executions?limit=10&offset=10",
      );
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(listExecutions).toHaveBeenCalledWith(
        "workflow-123",
        "org-456",
        expect.objectContaining({ limit: 10, offset: 10 }),
      );
    });
  });

  // ===========================================================================
  // GET EXECUTION
  // ===========================================================================

  describe("GET /api/platform/executions/:id", () => {
    it("should get execution by ID", async () => {
      vi.mocked(getExecution).mockResolvedValue(mockExecution);

      const req = createMockRequest("GET", "/api/platform/executions/exec-789");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(200);
      expect(getExecution).toHaveBeenCalledWith("exec-789", "org-456");
      const body = JSON.parse(res._body);
      expect(body.id).toBe("exec-789");
      expect(body.workflow).toEqual({ id: "workflow-123", name: "Test Workflow" });
    });

    it("should return 404 for non-existent execution", async () => {
      vi.mocked(getExecution).mockRejectedValue(new (ExecutionNotFoundError as any)("exec-999"));

      const req = createMockRequest("GET", "/api/platform/executions/exec-999");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(404);
    });
  });

  // ===========================================================================
  // WEBHOOK TRIGGER
  // ===========================================================================

  describe("POST /api/platform/webhooks/:webhookPath", () => {
    it("should trigger workflow via webhook", async () => {
      const webhookWorkflow = {
        ...mockWorkflow,
        status: "ACTIVE" as const,
        triggerType: "WEBHOOK" as const,
        triggerConfig: { webhookPath: "abc123" },
      };
      vi.mocked(getWorkflowByWebhookPath).mockResolvedValue(webhookWorkflow);
      vi.mocked(createExecution).mockResolvedValue(mockExecution);

      const req = createMockRequest("POST", "/api/platform/webhooks/abc123", {
        event: "test",
        data: { foo: "bar" },
      });
      const res = createMockResponse();
      const ctx = createMockContext({ user: undefined });

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(202);
      expect(getWorkflowByWebhookPath).toHaveBeenCalledWith("abc123");
      expect(createExecution).toHaveBeenCalledWith(
        "workflow-123",
        expect.objectContaining({
          inputs: expect.objectContaining({
            webhook: expect.objectContaining({
              path: "abc123",
              payload: { event: "test", data: { foo: "bar" } },
            }),
          }),
          triggeredBy: "webhook",
        }),
      );
    });

    it("should return 404 for unknown webhook path", async () => {
      vi.mocked(getWorkflowByWebhookPath).mockResolvedValue(null);

      const req = createMockRequest("POST", "/api/platform/webhooks/unknown-path");
      const res = createMockResponse();
      const ctx = createMockContext({ user: undefined });

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(404);
    });

    it("should return 422 for inactive workflow", async () => {
      vi.mocked(getWorkflowByWebhookPath).mockResolvedValue({
        ...mockWorkflow,
        status: "DRAFT",
        triggerType: "WEBHOOK",
      });

      const req = createMockRequest("POST", "/api/platform/webhooks/abc123");
      const res = createMockResponse();
      const ctx = createMockContext({ user: undefined });

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(422);
    });

    it("should return 422 for non-webhook workflow", async () => {
      vi.mocked(getWorkflowByWebhookPath).mockResolvedValue({
        ...mockWorkflow,
        status: "ACTIVE",
        triggerType: "MANUAL",
      });

      const req = createMockRequest("POST", "/api/platform/webhooks/abc123");
      const res = createMockResponse();
      const ctx = createMockContext({ user: undefined });

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(422);
    });

    it("should not require authentication for webhooks", async () => {
      const webhookWorkflow = {
        ...mockWorkflow,
        status: "ACTIVE" as const,
        triggerType: "WEBHOOK" as const,
      };
      vi.mocked(getWorkflowByWebhookPath).mockResolvedValue(webhookWorkflow);
      vi.mocked(createExecution).mockResolvedValue(mockExecution);

      const req = createMockRequest("POST", "/api/platform/webhooks/abc123");
      const res = createMockResponse();
      // No user in context
      const ctx = createMockContext({ user: undefined });

      await handleWorkflows(req, res, ctx);

      // Should succeed (202) not fail with 401
      expect(res._status).toBe(202);
    });
  });

  // ===========================================================================
  // TENANT ISOLATION
  // ===========================================================================

  describe("Tenant Isolation", () => {
    it("should only list workflows for user's organization", async () => {
      vi.mocked(listWorkflows).mockResolvedValue({
        items: [mockWorkflow],
        total: 1,
        limit: 20,
        offset: 0,
      });

      const req = createMockRequest("GET", "/api/platform/workflows");
      const res = createMockResponse();
      const ctx = createMockContext({ user: { ...createMockContext().user!, orgId: "other-org" } });

      await handleWorkflows(req, res, ctx);

      expect(listWorkflows).toHaveBeenCalledWith("other-org", expect.any(Object));
    });

    it("should enforce org check when getting workflow", async () => {
      vi.mocked(getWorkflow).mockRejectedValue(new (WorkflowAccessDeniedError as any)());

      const req = createMockRequest("GET", "/api/platform/workflows/workflow-123");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(403);
    });

    it("should enforce org check when updating workflow", async () => {
      vi.mocked(updateWorkflow).mockRejectedValue(new (WorkflowAccessDeniedError as any)());

      const req = createMockRequest("PUT", "/api/platform/workflows/workflow-123", {
        name: "Updated",
      });
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(403);
    });

    it("should enforce org check when deleting workflow", async () => {
      vi.mocked(deleteWorkflow).mockRejectedValue(new (WorkflowAccessDeniedError as any)());

      const req = createMockRequest("DELETE", "/api/platform/workflows/workflow-123");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(403);
    });

    it("should enforce org check when executing workflow", async () => {
      vi.mocked(getWorkflow).mockRejectedValue(new (WorkflowAccessDeniedError as any)());

      const req = createMockRequest("POST", "/api/platform/workflows/workflow-123/execute");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(403);
    });

    it("should enforce org check when listing executions", async () => {
      vi.mocked(listExecutions).mockRejectedValue(new (WorkflowAccessDeniedError as any)());

      const req = createMockRequest("GET", "/api/platform/workflows/workflow-123/executions");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(403);
    });

    it("should enforce org check when getting execution", async () => {
      vi.mocked(getExecution).mockRejectedValue(new (WorkflowAccessDeniedError as any)());

      const req = createMockRequest("GET", "/api/platform/executions/exec-789");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(403);
    });
  });

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  describe("Error Handling", () => {
    it("should handle invalid JSON body", async () => {
      const req = {
        method: "POST",
        url: "/api/platform/workflows",
        headers: { host: "localhost:3000" },
        on: vi.fn((event, callback) => {
          if (event === "data") {
            callback(Buffer.from("{ invalid json }"));
          }
          if (event === "end") {
            callback();
          }
          return req;
        }),
      } as unknown as IncomingMessage;

      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(400);
    });

    it("should return 405 for unsupported methods on workflow list", async () => {
      const req = createMockRequest("PATCH", "/api/platform/workflows");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(405);
    });

    it("should return 405 for unsupported methods on workflow detail", async () => {
      const req = createMockRequest("PATCH", "/api/platform/workflows/workflow-123");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      expect(res._status).toBe(405);
    });
  });

  // ===========================================================================
  // RESPONSE FORMAT
  // ===========================================================================

  describe("Response Format", () => {
    it("should serialize dates as ISO strings", async () => {
      vi.mocked(getWorkflow).mockResolvedValue(mockWorkflow);

      const req = createMockRequest("GET", "/api/platform/workflows/workflow-123");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      const body = JSON.parse(res._body);
      expect(body.createdAt).toBe("2024-01-01T00:00:00.000Z");
      expect(body.updatedAt).toBe("2024-01-02T00:00:00.000Z");
    });

    it("should include pagination metadata in list response", async () => {
      vi.mocked(listWorkflows).mockResolvedValue({
        items: [mockWorkflow],
        total: 50,
        limit: 20,
        offset: 0,
      });

      const req = createMockRequest("GET", "/api/platform/workflows");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      const body = JSON.parse(res._body);
      expect(body.total).toBe(50);
      expect(body.limit).toBe(20);
      expect(body.offset).toBe(0);
    });

    it("should include workflow info in execution detail response", async () => {
      vi.mocked(getExecution).mockResolvedValue(mockExecution);

      const req = createMockRequest("GET", "/api/platform/executions/exec-789");
      const res = createMockResponse();
      const ctx = createMockContext();

      await handleWorkflows(req, res, ctx);

      const body = JSON.parse(res._body);
      expect(body.workflow).toBeDefined();
      expect(body.workflow.id).toBe("workflow-123");
      expect(body.workflow.name).toBe("Test Workflow");
    });
  });
});
