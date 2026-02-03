/**
 * Workflow Tools Tests
 *
 * Tests for agent-accessible workflow tools.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Workflow, WorkflowExecution, WorkflowDefinition } from "../../types.js";
import {
  executeWorkflowList,
  executeWorkflowGet,
  executeWorkflowCreate,
  executeWorkflowUpdate,
  executeWorkflowExecute,
  executeWorkflowStatus,
  createWorkflowTools,
  type WorkflowService,
  type WorkflowExecutor,
  type WorkflowToolContext,
} from "../index.js";

// =============================================================================
// MOCKS
// =============================================================================

const mockWorkflow: Workflow = {
  id: "wf-123",
  tenantId: "tenant-1",
  name: "Test Workflow",
  description: "A test workflow",
  definition: {
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 0, y: 0 },
        data: { label: "Start", config: { triggerType: "MANUAL" } },
      },
      {
        id: "agent-1",
        type: "agent",
        position: { x: 300, y: 0 },
        data: { label: "Process", config: { prompt: "Do something" } },
      },
    ],
    edges: [{ id: "e1", source: "trigger-1", target: "agent-1" }],
  },
  status: "ACTIVE",
  triggerType: "MANUAL",
  triggerConfig: { triggerType: "MANUAL" },
  createdBy: "user-1",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockExecution: WorkflowExecution = {
  id: "exec-123",
  workflowId: "wf-123",
  status: "RUNNING",
  context: { inputs: {}, nodeOutputs: {}, globalVariables: {} },
  logs: [{ timestamp: new Date(), message: "Started", level: "info" }],
  triggeredBy: "user-1",
  startedAt: new Date(),
  finishedAt: null,
  error: null,
};

function createMockService(): WorkflowService {
  return {
    listWorkflows: vi.fn().mockResolvedValue({ workflows: [mockWorkflow], total: 1 }),
    getWorkflow: vi.fn().mockResolvedValue(mockWorkflow),
    createWorkflow: vi.fn().mockResolvedValue(mockWorkflow),
    updateWorkflow: vi.fn().mockResolvedValue(mockWorkflow),
    getExecution: vi.fn().mockResolvedValue(mockExecution),
    createExecution: vi.fn().mockResolvedValue(mockExecution),
  };
}

function createMockExecutor(): WorkflowExecutor {
  return {
    startExecution: vi.fn().mockResolvedValue(undefined),
  };
}

const mockContext: WorkflowToolContext = {
  tenantId: "tenant-1",
  userId: "user-1",
};

// =============================================================================
// WORKFLOW_LIST TESTS
// =============================================================================

describe("executeWorkflowList", () => {
  it("should list workflows without filters", async () => {
    const service = createMockService();

    const result = await executeWorkflowList({}, mockContext, service);

    expect(service.listWorkflows).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      status: undefined,
      limit: 20,
      offset: 0,
    });
    expect(result.workflows).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("should list workflows with status filter", async () => {
    const service = createMockService();

    await executeWorkflowList({ status: "ACTIVE" }, mockContext, service);

    expect(service.listWorkflows).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      status: "ACTIVE",
      limit: 20,
      offset: 0,
    });
  });

  it("should respect pagination parameters", async () => {
    const service = createMockService();

    await executeWorkflowList({ limit: 10, offset: 5 }, mockContext, service);

    expect(service.listWorkflows).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      status: undefined,
      limit: 10,
      offset: 5,
    });
  });
});

// =============================================================================
// WORKFLOW_GET TESTS
// =============================================================================

describe("executeWorkflowGet", () => {
  it("should get workflow by id", async () => {
    const service = createMockService();

    const result = await executeWorkflowGet({ workflowId: "wf-123" }, mockContext, service);

    expect(service.getWorkflow).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      workflowId: "wf-123",
    });
    expect(result).toEqual(mockWorkflow);
  });

  it("should return null for non-existent workflow", async () => {
    const service = createMockService();
    service.getWorkflow = vi.fn().mockResolvedValue(null);

    const result = await executeWorkflowGet({ workflowId: "non-existent" }, mockContext, service);

    expect(result).toBeNull();
  });
});

// =============================================================================
// WORKFLOW_CREATE TESTS
// =============================================================================

describe("executeWorkflowCreate", () => {
  it("should create workflow from definition", async () => {
    const service = createMockService();
    const definition: WorkflowDefinition = {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: { config: { triggerType: "MANUAL" } },
        },
      ],
      edges: [],
    };

    await executeWorkflowCreate({ name: "New Workflow", definition }, mockContext, service);

    expect(service.createWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        createdBy: "user-1",
        name: "New Workflow",
        status: "DRAFT",
      }),
    );
  });

  it("should throw error without prompt or definition", async () => {
    const service = createMockService();

    await expect(
      executeWorkflowCreate({ name: "Bad Workflow" }, mockContext, service),
    ).rejects.toThrow("Either 'prompt' or 'definition' is required");
  });

  it("should throw error for invalid definition", async () => {
    const service = createMockService();

    await expect(
      executeWorkflowCreate(
        { name: "Bad", definition: { nodes: [], edges: [] } as any },
        mockContext,
        service,
      ),
    ).rejects.toThrow("Invalid workflow definition");
  });

  it("should create workflow from prompt with LLM provider", async () => {
    const service = createMockService();
    const mockLLM = {
      generateText: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          definition: {
            nodes: [
              {
                id: "trigger-1",
                type: "trigger",
                position: { x: 0, y: 0 },
                data: { config: { triggerType: "CRON" } },
              },
            ],
            edges: [],
          },
          triggerType: "CRON",
          triggerConfig: { triggerType: "CRON", cronExpression: "0 9 * * 1" },
          confidence: 0.9,
          warnings: [],
        }),
      }),
    };

    const contextWithLLM = { ...mockContext, llmProvider: mockLLM };

    await executeWorkflowCreate(
      { name: "Generated", prompt: "Every Monday at 9am" },
      contextWithLLM,
      service,
    );

    expect(mockLLM.generateText).toHaveBeenCalled();
    expect(service.createWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerType: "CRON",
      }),
    );
  });

  it("should throw error when prompt provided without LLM provider", async () => {
    const service = createMockService();

    await expect(
      executeWorkflowCreate({ name: "No LLM", prompt: "Do something" }, mockContext, service),
    ).rejects.toThrow("LLM provider required");
  });
});

// =============================================================================
// WORKFLOW_UPDATE TESTS
// =============================================================================

describe("executeWorkflowUpdate", () => {
  it("should update workflow name", async () => {
    const service = createMockService();

    await executeWorkflowUpdate({ workflowId: "wf-123", name: "New Name" }, mockContext, service);

    expect(service.updateWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: "wf-123",
        name: "New Name",
      }),
    );
  });

  it("should update workflow status", async () => {
    const service = createMockService();

    await executeWorkflowUpdate({ workflowId: "wf-123", status: "PAUSED" }, mockContext, service);

    expect(service.updateWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "PAUSED",
      }),
    );
  });

  it("should return null for non-existent workflow", async () => {
    const service = createMockService();
    service.updateWorkflow = vi.fn().mockResolvedValue(null);

    const result = await executeWorkflowUpdate(
      { workflowId: "non-existent", name: "X" },
      mockContext,
      service,
    );

    expect(result).toBeNull();
  });

  it("should validate definition if provided", async () => {
    const service = createMockService();

    await expect(
      executeWorkflowUpdate(
        { workflowId: "wf-123", definition: { nodes: "invalid" } as any },
        mockContext,
        service,
      ),
    ).rejects.toThrow("Invalid workflow definition");
  });
});

// =============================================================================
// WORKFLOW_EXECUTE TESTS
// =============================================================================

describe("executeWorkflowExecute", () => {
  it("should execute workflow and return execution id", async () => {
    const service = createMockService();
    const executor = createMockExecutor();

    const result = await executeWorkflowExecute(
      { workflowId: "wf-123" },
      mockContext,
      service,
      executor,
    );

    expect(service.getWorkflow).toHaveBeenCalled();
    expect(service.createExecution).toHaveBeenCalledWith({
      workflowId: "wf-123",
      triggeredBy: "user-1",
      inputs: {},
    });
    expect(executor.startExecution).toHaveBeenCalledWith("exec-123");
    expect(result.executionId).toBe("exec-123");
  });

  it("should pass inputs to execution", async () => {
    const service = createMockService();
    const executor = createMockExecutor();

    await executeWorkflowExecute(
      { workflowId: "wf-123", inputs: { region: "West" } },
      mockContext,
      service,
      executor,
    );

    expect(service.createExecution).toHaveBeenCalledWith({
      workflowId: "wf-123",
      triggeredBy: "user-1",
      inputs: { region: "West" },
    });
  });

  it("should throw error for non-existent workflow", async () => {
    const service = createMockService();
    service.getWorkflow = vi.fn().mockResolvedValue(null);
    const executor = createMockExecutor();

    await expect(
      executeWorkflowExecute({ workflowId: "non-existent" }, mockContext, service, executor),
    ).rejects.toThrow("Workflow not found");
  });

  it("should throw error for archived workflow", async () => {
    const service = createMockService();
    service.getWorkflow = vi.fn().mockResolvedValue({ ...mockWorkflow, status: "ARCHIVED" });
    const executor = createMockExecutor();

    await expect(
      executeWorkflowExecute({ workflowId: "wf-123" }, mockContext, service, executor),
    ).rejects.toThrow("Cannot execute workflow with status: ARCHIVED");
  });
});

// =============================================================================
// WORKFLOW_STATUS TESTS
// =============================================================================

describe("executeWorkflowStatus", () => {
  it("should get execution status", async () => {
    const service = createMockService();

    const result = await executeWorkflowStatus({ executionId: "exec-123" }, mockContext, service);

    expect(service.getExecution).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      executionId: "exec-123",
    });
    expect(result).toEqual(mockExecution);
  });

  it("should return null for non-existent execution", async () => {
    const service = createMockService();
    service.getExecution = vi.fn().mockResolvedValue(null);

    const result = await executeWorkflowStatus(
      { executionId: "non-existent" },
      mockContext,
      service,
    );

    expect(result).toBeNull();
  });
});

// =============================================================================
// CREATE WORKFLOW TOOLS TESTS
// =============================================================================

describe("createWorkflowTools", () => {
  it("should create all 6 workflow tools", () => {
    const service = createMockService();
    const executor = createMockExecutor();

    const tools = createWorkflowTools(mockContext, { service, executor });

    expect(tools).toHaveLength(6);
    expect(tools.map((t) => t.name)).toEqual([
      "workflow_list",
      "workflow_get",
      "workflow_create",
      "workflow_update",
      "workflow_execute",
      "workflow_status",
    ]);
  });

  it("should have correct labels", () => {
    const service = createMockService();
    const executor = createMockExecutor();

    const tools = createWorkflowTools(mockContext, { service, executor });

    expect(tools.find((t) => t.name === "workflow_list")?.label).toBe("Workflow List");
    expect(tools.find((t) => t.name === "workflow_create")?.label).toBe("Workflow Create");
  });

  it("workflow_list tool should execute successfully", async () => {
    const service = createMockService();
    const executor = createMockExecutor();

    const tools = createWorkflowTools(mockContext, { service, executor });
    const listTool = tools.find((t) => t.name === "workflow_list")!;

    const result = await listTool.execute("call-1", {});

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.workflows).toHaveLength(1);
  });

  it("workflow_get tool should return error for not found", async () => {
    const service = createMockService();
    service.getWorkflow = vi.fn().mockResolvedValue(null);
    const executor = createMockExecutor();

    const tools = createWorkflowTools(mockContext, { service, executor });
    const getTool = tools.find((t) => t.name === "workflow_get")!;

    const result = await getTool.execute("call-1", { workflowId: "bad" });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toContain("not found");
    expect(parsed.code).toBe("NOT_FOUND");
  });
});
