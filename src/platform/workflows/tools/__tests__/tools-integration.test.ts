/**
 * Workflow Tools Integration Tests
 *
 * Tests for agent-accessible workflow tools working together.
 * Covers workflow_create, workflow_execute, workflow_status, and LLM generation.
 *
 * @see docs/IMPLEMENTATION-PLAN-PHASE7.md §6 Agent Tools
 */

import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from "vitest";

// =============================================================================
// MOCKS
// =============================================================================

// Mock Prisma client
vi.mock("../../../db/client.js", () => ({
  prisma: {
    workflow: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    workflowExecution: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import type {
  Workflow,
  WorkflowExecution,
  WorkflowDefinition,
  ExecutionContext,
  TriggerType,
} from "../../types.js";
import type {
  WorkflowService,
  WorkflowExecutor,
  WorkflowToolContext,
  WorkflowToolDependencies,
  LLMProvider,
  WorkflowCreateParams,
  WorkflowExecuteParams,
} from "../index.js";
import { prisma } from "../../../db/client.js";
import {
  createWorkflowTools,
  executeWorkflowList,
  executeWorkflowGet,
  executeWorkflowCreate,
  executeWorkflowUpdate,
  executeWorkflowExecute,
  executeWorkflowStatus,
  generateWorkflowFromPrompt,
  validateWorkflowDefinition,
  EXAMPLE_WORKFLOWS,
} from "../index.js";

// =============================================================================
// TEST DATA
// =============================================================================

const mockTenantId = "tenant-tools-test";
const mockUserId = "user-tools-test";

function createMockWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: "wf-tools-1",
    organizationId: mockTenantId,
    name: "Tools Test Workflow",
    description: "Test workflow for tools",
    definition: {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: { config: { triggerType: "MANUAL" } },
        },
        {
          id: "agent-1",
          type: "agent",
          position: { x: 300, y: 0 },
          data: { config: { prompt: "Process {{inputs.data}}" } },
        },
      ],
      edges: [{ id: "e1", source: "trigger-1", target: "agent-1" }],
    } as WorkflowDefinition,
    status: "ACTIVE",
    triggerType: "MANUAL",
    triggerConfig: null,
    createdBy: mockUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Workflow;
}

function createMockExecution(overrides: Partial<WorkflowExecution> = {}): WorkflowExecution {
  return {
    id: "exec-tools-1",
    workflowId: "wf-tools-1",
    status: "PENDING",
    context: { inputs: {}, nodeOutputs: {}, globalVariables: {} } as ExecutionContext,
    logs: [],
    triggeredBy: mockUserId,
    startedAt: new Date(),
    finishedAt: null,
    error: null,
    ...overrides,
  } as WorkflowExecution;
}

function createMockWorkflowService(): WorkflowService {
  return {
    listWorkflows: vi.fn().mockResolvedValue({ workflows: [], total: 0 }),
    getWorkflow: vi.fn().mockResolvedValue(null),
    createWorkflow: vi.fn().mockResolvedValue(createMockWorkflow()),
    updateWorkflow: vi.fn().mockResolvedValue(createMockWorkflow()),
    getExecution: vi.fn().mockResolvedValue(null),
    createExecution: vi.fn().mockResolvedValue(createMockExecution()),
  };
}

function createMockExecutor(): WorkflowExecutor {
  return {
    startExecution: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockLLMProvider(): LLMProvider {
  return {
    generateText: vi.fn().mockResolvedValue({
      text: JSON.stringify({
        definition: {
          nodes: [
            {
              id: "trigger-1",
              type: "trigger",
              position: { x: 0, y: 0 },
              data: { config: { triggerType: "MANUAL" } },
            },
            {
              id: "agent-1",
              type: "agent",
              position: { x: 300, y: 0 },
              data: { config: { prompt: "Generated prompt" } },
            },
          ],
          edges: [{ id: "e1", source: "trigger-1", target: "agent-1" }],
        },
        triggerType: "MANUAL",
        triggerConfig: { triggerType: "MANUAL" },
        suggestedName: "Generated Workflow",
        suggestedDescription: "AI-generated workflow",
        confidence: 0.85,
        warnings: [],
      }),
    }),
  };
}

// =============================================================================
// WORKFLOW_LIST TOOL TESTS
// =============================================================================

describe("workflow_list Tool Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list workflows with default pagination", async () => {
    const service = createMockWorkflowService();
    service.listWorkflows = vi.fn().mockResolvedValue({
      workflows: [
        createMockWorkflow(),
        createMockWorkflow({ id: "wf-2", name: "Second Workflow" }),
      ],
      total: 2,
    });

    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };
    const result = await executeWorkflowList({}, context, service);

    expect(result.workflows).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(service.listWorkflows).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: mockTenantId,
        limit: 20,
        offset: 0,
      }),
    );
  });

  it("should filter workflows by status", async () => {
    const service = createMockWorkflowService();
    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };

    await executeWorkflowList({ status: "ACTIVE" }, context, service);

    expect(service.listWorkflows).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ACTIVE" }),
    );
  });

  it("should support custom pagination", async () => {
    const service = createMockWorkflowService();
    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };

    await executeWorkflowList({ limit: 10, offset: 20 }, context, service);

    expect(service.listWorkflows).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 20 }),
    );
  });
});

// =============================================================================
// WORKFLOW_GET TOOL TESTS
// =============================================================================

describe("workflow_get Tool Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should get workflow by ID", async () => {
    const mockWorkflow = createMockWorkflow();
    const service = createMockWorkflowService();
    service.getWorkflow = vi.fn().mockResolvedValue(mockWorkflow);

    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };
    const result = await executeWorkflowGet({ workflowId: "wf-tools-1" }, context, service);

    expect(result).toBeDefined();
    expect(result?.id).toBe("wf-tools-1");
    expect(service.getWorkflow).toHaveBeenCalledWith({
      tenantId: mockTenantId,
      workflowId: "wf-tools-1",
    });
  });

  it("should return null for non-existent workflow", async () => {
    const service = createMockWorkflowService();
    service.getWorkflow = vi.fn().mockResolvedValue(null);

    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };
    const result = await executeWorkflowGet({ workflowId: "non-existent" }, context, service);

    expect(result).toBeNull();
  });
});

// =============================================================================
// WORKFLOW_CREATE TOOL TESTS
// =============================================================================

describe("workflow_create Tool Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create workflow with provided definition", async () => {
    const service = createMockWorkflowService();
    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };

    const definition: WorkflowDefinition = {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: { config: { triggerType: "MANUAL" } },
        },
        {
          id: "agent-1",
          type: "agent",
          position: { x: 300, y: 0 },
          data: { config: { prompt: "Hello world" } },
        },
      ],
      edges: [{ id: "e1", source: "trigger-1", target: "agent-1" }],
    };

    const params: WorkflowCreateParams = {
      name: "Test Workflow",
      description: "A test workflow",
      definition,
      triggerType: "MANUAL",
    };

    const result = await executeWorkflowCreate(params, context, service);

    expect(result).toBeDefined();
    expect(service.createWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: mockTenantId,
        createdBy: mockUserId,
        name: "Test Workflow",
        definition,
        status: "DRAFT",
      }),
    );
  });

  it("should generate workflow from prompt using LLM", async () => {
    const service = createMockWorkflowService();
    const llmProvider = createMockLLMProvider();
    const context: WorkflowToolContext = {
      tenantId: mockTenantId,
      userId: mockUserId,
      llmProvider,
    };

    const params: WorkflowCreateParams = {
      name: "AI Generated Workflow",
      prompt: "Create a workflow that processes customer orders and sends confirmation emails",
    };

    const result = await executeWorkflowCreate(params, context, service);

    expect(result).toBeDefined();
    expect(llmProvider.generateText).toHaveBeenCalled();
    expect(service.createWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "AI Generated Workflow",
      }),
    );
  });

  it("should throw error when prompt provided but no LLM", async () => {
    const service = createMockWorkflowService();
    const context: WorkflowToolContext = {
      tenantId: mockTenantId,
      userId: mockUserId,
      // No llmProvider
    };

    const params: WorkflowCreateParams = {
      name: "Test",
      prompt: "Generate a workflow",
    };

    await expect(executeWorkflowCreate(params, context, service)).rejects.toThrow(
      "LLM provider required",
    );
  });

  it("should throw error when neither prompt nor definition provided", async () => {
    const service = createMockWorkflowService();
    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };

    const params: WorkflowCreateParams = {
      name: "Test",
    };

    await expect(executeWorkflowCreate(params, context, service)).rejects.toThrow(
      "Either 'prompt' or 'definition' is required",
    );
  });

  it("should validate definition before creating", async () => {
    const service = createMockWorkflowService();
    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };

    const invalidDefinition = {
      nodes: [], // No trigger node
      edges: [],
    } as WorkflowDefinition;

    const params: WorkflowCreateParams = {
      name: "Invalid Workflow",
      definition: invalidDefinition,
    };

    await expect(executeWorkflowCreate(params, context, service)).rejects.toThrow(
      "Invalid workflow definition",
    );
  });
});

// =============================================================================
// WORKFLOW_UPDATE TOOL TESTS
// =============================================================================

describe("workflow_update Tool Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update workflow name and description", async () => {
    const service = createMockWorkflowService();
    service.updateWorkflow = vi
      .fn()
      .mockResolvedValue(
        createMockWorkflow({ name: "Updated Name", description: "Updated description" }),
      );

    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };

    const result = await executeWorkflowUpdate(
      {
        workflowId: "wf-tools-1",
        name: "Updated Name",
        description: "Updated description",
      },
      context,
      service,
    );

    expect(result?.name).toBe("Updated Name");
    expect(service.updateWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: "wf-tools-1",
        name: "Updated Name",
        description: "Updated description",
      }),
    );
  });

  it("should update workflow status to ACTIVE", async () => {
    const service = createMockWorkflowService();
    service.updateWorkflow = vi.fn().mockResolvedValue(createMockWorkflow({ status: "ACTIVE" }));

    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };

    const result = await executeWorkflowUpdate(
      { workflowId: "wf-tools-1", status: "ACTIVE" },
      context,
      service,
    );

    expect(result?.status).toBe("ACTIVE");
  });

  it("should validate new definition on update", async () => {
    const service = createMockWorkflowService();
    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };

    const invalidDefinition = {
      nodes: "not an array", // Invalid
      edges: [],
    } as unknown as WorkflowDefinition;

    await expect(
      executeWorkflowUpdate(
        { workflowId: "wf-tools-1", definition: invalidDefinition },
        context,
        service,
      ),
    ).rejects.toThrow("Invalid workflow definition");
  });
});

// =============================================================================
// WORKFLOW_EXECUTE TOOL TESTS
// =============================================================================

describe("workflow_execute Tool Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should execute active workflow", async () => {
    const service = createMockWorkflowService();
    const executor = createMockExecutor();

    service.getWorkflow = vi.fn().mockResolvedValue(createMockWorkflow({ status: "ACTIVE" }));
    service.createExecution = vi.fn().mockResolvedValue(createMockExecution());

    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };

    const params: WorkflowExecuteParams = {
      workflowId: "wf-tools-1",
      inputs: { data: "test input" },
    };

    const result = await executeWorkflowExecute(params, context, service, executor);

    expect(result.executionId).toBe("exec-tools-1");
    expect(result.status).toBe("PENDING");
    expect(service.createExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: "wf-tools-1",
        triggeredBy: mockUserId,
        inputs: { data: "test input" },
      }),
    );
    expect(executor.startExecution).toHaveBeenCalledWith("exec-tools-1");
  });

  it("should execute draft workflow (for testing)", async () => {
    const service = createMockWorkflowService();
    const executor = createMockExecutor();

    service.getWorkflow = vi.fn().mockResolvedValue(createMockWorkflow({ status: "DRAFT" }));
    service.createExecution = vi.fn().mockResolvedValue(createMockExecution());

    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };

    const result = await executeWorkflowExecute(
      { workflowId: "wf-tools-1" },
      context,
      service,
      executor,
    );

    expect(result.executionId).toBeDefined();
  });

  it("should throw error for non-existent workflow", async () => {
    const service = createMockWorkflowService();
    const executor = createMockExecutor();

    service.getWorkflow = vi.fn().mockResolvedValue(null);

    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };

    await expect(
      executeWorkflowExecute({ workflowId: "non-existent" }, context, service, executor),
    ).rejects.toThrow("Workflow not found");
  });

  it("should throw error for paused workflow", async () => {
    const service = createMockWorkflowService();
    const executor = createMockExecutor();

    service.getWorkflow = vi.fn().mockResolvedValue(createMockWorkflow({ status: "PAUSED" }));

    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };

    await expect(
      executeWorkflowExecute({ workflowId: "wf-tools-1" }, context, service, executor),
    ).rejects.toThrow("Cannot execute workflow with status");
  });

  it("should pass empty inputs when none provided", async () => {
    const service = createMockWorkflowService();
    const executor = createMockExecutor();

    service.getWorkflow = vi.fn().mockResolvedValue(createMockWorkflow({ status: "ACTIVE" }));
    service.createExecution = vi.fn().mockResolvedValue(createMockExecution());

    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };

    await executeWorkflowExecute({ workflowId: "wf-tools-1" }, context, service, executor);

    expect(service.createExecution).toHaveBeenCalledWith(expect.objectContaining({ inputs: {} }));
  });
});

// =============================================================================
// WORKFLOW_STATUS TOOL TESTS
// =============================================================================

describe("workflow_status Tool Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return execution status", async () => {
    const service = createMockWorkflowService();
    const mockExecution = createMockExecution({
      status: "RUNNING",
      logs: [
        {
          timestamp: "2024-01-01T00:00:00Z",
          nodeId: null,
          message: "Started",
          level: "info" as const,
        },
        {
          timestamp: "2024-01-01T00:01:00Z",
          nodeId: "agent-1",
          message: "Processing",
          level: "info" as const,
        },
      ],
    });

    service.getExecution = vi.fn().mockResolvedValue(mockExecution);

    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };

    const result = await executeWorkflowStatus({ executionId: "exec-tools-1" }, context, service);

    expect(result).toBeDefined();
    expect(result?.status).toBe("RUNNING");
    expect(result?.logs).toHaveLength(2);
  });

  it("should return completed execution with finishedAt", async () => {
    const service = createMockWorkflowService();
    const mockExecution = createMockExecution({
      status: "COMPLETED",
      finishedAt: new Date("2024-01-01T01:00:00Z"),
    });

    service.getExecution = vi.fn().mockResolvedValue(mockExecution);

    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };

    const result = await executeWorkflowStatus({ executionId: "exec-tools-1" }, context, service);

    expect(result?.status).toBe("COMPLETED");
    expect(result?.finishedAt).toBeDefined();
  });

  it("should return failed execution with error", async () => {
    const service = createMockWorkflowService();
    const mockExecution = createMockExecution({
      status: "FAILED",
      error: "LLM API rate limit exceeded",
      finishedAt: new Date(),
    });

    service.getExecution = vi.fn().mockResolvedValue(mockExecution);

    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };

    const result = await executeWorkflowStatus({ executionId: "exec-tools-1" }, context, service);

    expect(result?.status).toBe("FAILED");
    expect(result?.error).toBe("LLM API rate limit exceeded");
  });

  it("should return null for non-existent execution", async () => {
    const service = createMockWorkflowService();
    service.getExecution = vi.fn().mockResolvedValue(null);

    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };

    const result = await executeWorkflowStatus({ executionId: "non-existent" }, context, service);

    expect(result).toBeNull();
  });
});

// =============================================================================
// WORKFLOW GENERATOR INTEGRATION TESTS
// =============================================================================

describe("Workflow Generator Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateWorkflowFromPrompt", () => {
    it("should generate valid workflow from simple prompt", async () => {
      const llmProvider = createMockLLMProvider();
      const context = { tenantId: mockTenantId, userId: mockUserId };

      const result = await generateWorkflowFromPrompt(
        "Create a workflow that sends a daily report email",
        context,
        llmProvider,
      );

      expect(result.definition).toBeDefined();
      expect(result.definition.nodes).toBeDefined();
      expect(result.triggerType).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should include available tools in LLM context", async () => {
      const llmProvider = createMockLLMProvider();
      const context = {
        tenantId: mockTenantId,
        userId: mockUserId,
        availableTools: ["execute_sql_query", "send_email", "slack_post"],
      };

      await generateWorkflowFromPrompt("Query the database and send results", context, llmProvider);

      expect(llmProvider.generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          userPrompt: expect.stringContaining("execute_sql_query"),
        }),
      );
    });

    it("should handle LLM returning markdown code blocks", async () => {
      const llmProvider: LLMProvider = {
        generateText: vi.fn().mockResolvedValue({
          text:
            "```json\n" +
            JSON.stringify({
              definition: {
                nodes: [
                  {
                    id: "trigger-1",
                    type: "trigger",
                    position: { x: 0, y: 0 },
                    data: { config: { triggerType: "MANUAL" } },
                  },
                ],
                edges: [],
              },
              triggerType: "MANUAL",
              triggerConfig: { triggerType: "MANUAL" },
              confidence: 0.9,
              warnings: [],
            }) +
            "\n```",
        }),
      };

      const context = { tenantId: mockTenantId, userId: mockUserId };

      const result = await generateWorkflowFromPrompt("Simple workflow", context, llmProvider);

      expect(result.definition).toBeDefined();
    });

    it("should throw error for invalid LLM response", async () => {
      const llmProvider: LLMProvider = {
        generateText: vi.fn().mockResolvedValue({ text: "not valid json" }),
      };

      const context = { tenantId: mockTenantId, userId: mockUserId };

      await expect(generateWorkflowFromPrompt("Test", context, llmProvider)).rejects.toThrow(
        "Failed to parse LLM response",
      );
    });

    it("should throw error when LLM response has invalid workflow", async () => {
      const llmProvider: LLMProvider = {
        generateText: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            definition: {
              nodes: [], // Missing trigger
              edges: [],
            },
            triggerType: "MANUAL",
          }),
        }),
      };

      const context = { tenantId: mockTenantId, userId: mockUserId };

      await expect(generateWorkflowFromPrompt("Test", context, llmProvider)).rejects.toThrow(
        "Invalid workflow definition",
      );
    });
  });

  describe("validateWorkflowDefinition", () => {
    it("should validate complete workflow definition", () => {
      const definition = {
        nodes: [
          { id: "trigger-1", type: "trigger", position: { x: 0, y: 0 }, data: { config: {} } },
          {
            id: "agent-1",
            type: "agent",
            position: { x: 300, y: 0 },
            data: { config: { prompt: "test" } },
          },
        ],
        edges: [{ id: "e1", source: "trigger-1", target: "agent-1" }],
      };

      const result = validateWorkflowDefinition(definition);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject definition without trigger", () => {
      const definition = {
        nodes: [{ id: "agent-1", type: "agent", position: { x: 0, y: 0 }, data: { config: {} } }],
        edges: [],
      };

      const result = validateWorkflowDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Workflow must have at least one trigger node");
    });

    it("should reject definition with invalid node type", () => {
      const definition = {
        nodes: [
          { id: "trigger-1", type: "trigger", position: { x: 0, y: 0 }, data: { config: {} } },
          {
            id: "invalid-1",
            type: "invalid_type",
            position: { x: 100, y: 0 },
            data: { config: {} },
          },
        ],
        edges: [],
      };

      const result = validateWorkflowDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("invalid type"))).toBe(true);
    });

    it("should reject definition with duplicate node IDs", () => {
      const definition = {
        nodes: [
          { id: "node-1", type: "trigger", position: { x: 0, y: 0 }, data: { config: {} } },
          { id: "node-1", type: "agent", position: { x: 100, y: 0 }, data: { config: {} } },
        ],
        edges: [],
      };

      const result = validateWorkflowDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Duplicate node id"))).toBe(true);
    });

    it("should reject edges referencing non-existent nodes", () => {
      const definition = {
        nodes: [
          { id: "trigger-1", type: "trigger", position: { x: 0, y: 0 }, data: { config: {} } },
        ],
        edges: [{ id: "e1", source: "trigger-1", target: "non-existent" }],
      };

      const result = validateWorkflowDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("non-existent target node"))).toBe(true);
    });
  });

  describe("EXAMPLE_WORKFLOWS", () => {
    it("should have valid simpleManual example", () => {
      const result = validateWorkflowDefinition(EXAMPLE_WORKFLOWS.simpleManual.definition);
      expect(result.valid).toBe(true);
    });

    it("should have valid cronWithCondition example", () => {
      const result = validateWorkflowDefinition(EXAMPLE_WORKFLOWS.cronWithCondition.definition);
      expect(result.valid).toBe(true);
    });
  });
});

// =============================================================================
// TOOL FACTORY INTEGRATION TESTS
// =============================================================================

describe("createWorkflowTools Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create all workflow tools", () => {
    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };
    const dependencies: WorkflowToolDependencies = {
      service: createMockWorkflowService(),
      executor: createMockExecutor(),
    };

    const tools = createWorkflowTools(context, dependencies);

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

  it("should execute workflow_list tool correctly", async () => {
    const service = createMockWorkflowService();
    service.listWorkflows = vi.fn().mockResolvedValue({
      workflows: [createMockWorkflow()],
      total: 1,
    });

    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };
    const tools = createWorkflowTools(context, { service, executor: createMockExecutor() });

    const listTool = tools.find((t) => t.name === "workflow_list")!;
    const result = await listTool.execute("call-1", {});

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.workflows).toHaveLength(1);
    expect(parsed.total).toBe(1);
  });

  it("should execute workflow_create tool with error handling", async () => {
    const service = createMockWorkflowService();
    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };
    const tools = createWorkflowTools(context, { service, executor: createMockExecutor() });

    const createTool = tools.find((t) => t.name === "workflow_create")!;

    // Call without required params
    const result = await createTool.execute("call-1", { name: "Test" });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBeDefined();
    expect(parsed.code).toBe("WORKFLOW_CREATE_ERROR");
  });

  it("should execute workflow_execute tool and start execution", async () => {
    const service = createMockWorkflowService();
    const executor = createMockExecutor();

    service.getWorkflow = vi.fn().mockResolvedValue(createMockWorkflow({ status: "ACTIVE" }));
    service.createExecution = vi.fn().mockResolvedValue(createMockExecution());

    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };
    const tools = createWorkflowTools(context, { service, executor });

    const executeTool = tools.find((t) => t.name === "workflow_execute")!;
    const result = await executeTool.execute("call-1", {
      workflowId: "wf-tools-1",
      inputs: { data: "test" },
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.executionId).toBe("exec-tools-1");
    expect(parsed.message).toContain("Workflow execution started");
  });

  it("should execute workflow_status tool and return state", async () => {
    const service = createMockWorkflowService();
    service.getExecution = vi.fn().mockResolvedValue(
      createMockExecution({
        status: "COMPLETED",
        context: {
          inputs: { data: "test" },
          nodeOutputs: { "agent-1": { text: "Result" } },
          globalVariables: {},
        } as ExecutionContext,
      }),
    );

    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };
    const tools = createWorkflowTools(context, { service, executor: createMockExecutor() });

    const statusTool = tools.find((t) => t.name === "workflow_status")!;
    const result = await statusTool.execute("call-1", { executionId: "exec-tools-1" });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("COMPLETED");
    expect(parsed.id).toBe("exec-tools-1");
  });

  it("should handle not found errors gracefully", async () => {
    const service = createMockWorkflowService();
    service.getWorkflow = vi.fn().mockResolvedValue(null);
    service.getExecution = vi.fn().mockResolvedValue(null);

    const context: WorkflowToolContext = { tenantId: mockTenantId, userId: mockUserId };
    const tools = createWorkflowTools(context, { service, executor: createMockExecutor() });

    // workflow_get not found
    const getTool = tools.find((t) => t.name === "workflow_get")!;
    const getResult = await getTool.execute("call-1", { workflowId: "non-existent" });
    const getParsed = JSON.parse(getResult.content[0].text);
    expect(getParsed.error).toContain("not found");
    expect(getParsed.code).toBe("NOT_FOUND");

    // workflow_status not found
    const statusTool = tools.find((t) => t.name === "workflow_status")!;
    const statusResult = await statusTool.execute("call-1", { executionId: "non-existent" });
    const statusParsed = JSON.parse(statusResult.content[0].text);
    expect(statusParsed.error).toContain("not found");
  });
});

// =============================================================================
// END-TO-END WORKFLOW TOOL FLOW TESTS
// =============================================================================

describe("End-to-End Workflow Tool Flow", () => {
  let service: WorkflowService;
  let executor: WorkflowExecutor;
  let tools: ReturnType<typeof createWorkflowTools>;

  beforeEach(() => {
    vi.clearAllMocks();

    service = createMockWorkflowService();
    executor = createMockExecutor();

    const context: WorkflowToolContext = {
      tenantId: mockTenantId,
      userId: mockUserId,
      llmProvider: createMockLLMProvider(),
    };

    tools = createWorkflowTools(context, { service, executor, llmProvider: context.llmProvider });
  });

  it("should complete full workflow lifecycle: create → get → execute → status", async () => {
    // Step 1: Create workflow
    const createTool = tools.find((t) => t.name === "workflow_create")!;

    const mockCreatedWorkflow = createMockWorkflow({ id: "wf-new-1", status: "DRAFT" });
    (service.createWorkflow as Mock).mockResolvedValue(mockCreatedWorkflow);

    const createResult = await createTool.execute("call-1", {
      name: "New Workflow",
      definition: EXAMPLE_WORKFLOWS.simpleManual.definition,
    });

    const created = JSON.parse(createResult.content[0].text);
    expect(created.id).toBe("wf-new-1");
    expect(created.status).toBe("DRAFT");

    // Step 2: Get workflow
    const getTool = tools.find((t) => t.name === "workflow_get")!;
    (service.getWorkflow as Mock).mockResolvedValue(mockCreatedWorkflow);

    const getResult = await getTool.execute("call-2", { workflowId: "wf-new-1" });
    const gotten = JSON.parse(getResult.content[0].text);
    expect(gotten.id).toBe("wf-new-1");

    // Step 3: Update to ACTIVE
    const updateTool = tools.find((t) => t.name === "workflow_update")!;
    (service.updateWorkflow as Mock).mockResolvedValue({
      ...mockCreatedWorkflow,
      status: "ACTIVE",
    });

    const updateResult = await updateTool.execute("call-3", {
      workflowId: "wf-new-1",
      status: "ACTIVE",
    });

    const updated = JSON.parse(updateResult.content[0].text);
    expect(updated.status).toBe("ACTIVE");

    // Step 4: Execute workflow
    const executeTool = tools.find((t) => t.name === "workflow_execute")!;
    (service.getWorkflow as Mock).mockResolvedValue({ ...mockCreatedWorkflow, status: "ACTIVE" });

    const mockExecution = createMockExecution({ id: "exec-new-1" });
    (service.createExecution as Mock).mockResolvedValue(mockExecution);

    const executeResult = await executeTool.execute("call-4", {
      workflowId: "wf-new-1",
      inputs: { data: "test" },
    });

    const executed = JSON.parse(executeResult.content[0].text);
    expect(executed.executionId).toBe("exec-new-1");
    expect(executor.startExecution).toHaveBeenCalledWith("exec-new-1");

    // Step 5: Check status (RUNNING)
    const statusTool = tools.find((t) => t.name === "workflow_status")!;
    (service.getExecution as Mock).mockResolvedValue({
      ...mockExecution,
      status: "RUNNING",
    });

    const statusResult1 = await statusTool.execute("call-5", { executionId: "exec-new-1" });
    const status1 = JSON.parse(statusResult1.content[0].text);
    expect(status1.status).toBe("RUNNING");

    // Step 6: Check status (COMPLETED)
    (service.getExecution as Mock).mockResolvedValue({
      ...mockExecution,
      status: "COMPLETED",
      finishedAt: new Date(),
    });

    const statusResult2 = await statusTool.execute("call-6", { executionId: "exec-new-1" });
    const status2 = JSON.parse(statusResult2.content[0].text);
    expect(status2.status).toBe("COMPLETED");
    expect(status2.finishedAt).toBeDefined();
  });

  it("should create workflow from prompt and execute it", async () => {
    const createTool = tools.find((t) => t.name === "workflow_create")!;

    const mockGeneratedWorkflow = createMockWorkflow({
      id: "wf-generated-1",
      name: "AI Generated",
      status: "DRAFT",
    });
    (service.createWorkflow as Mock).mockResolvedValue(mockGeneratedWorkflow);

    // Create from prompt
    const createResult = await createTool.execute("call-1", {
      name: "AI Generated",
      prompt: "Create a workflow that processes orders and sends notifications",
    });

    const created = JSON.parse(createResult.content[0].text);
    expect(created.id).toBe("wf-generated-1");

    // Activate and execute
    (service.updateWorkflow as Mock).mockResolvedValue({
      ...mockGeneratedWorkflow,
      status: "ACTIVE",
    });
    (service.getWorkflow as Mock).mockResolvedValue({
      ...mockGeneratedWorkflow,
      status: "ACTIVE",
    });
    (service.createExecution as Mock).mockResolvedValue(createMockExecution({ id: "exec-gen-1" }));

    const executeTool = tools.find((t) => t.name === "workflow_execute")!;
    const executeResult = await executeTool.execute("call-3", {
      workflowId: "wf-generated-1",
      inputs: { orderId: "order-123" },
    });

    const executed = JSON.parse(executeResult.content[0].text);
    expect(executed.executionId).toBe("exec-gen-1");
  });
});
