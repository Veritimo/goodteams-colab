/**
 * Workflow Integration Tests
 *
 * End-to-end tests verifying all workflow components work together.
 * Tests create workflows via service, execute them, and verify results.
 *
 * @see docs/IMPLEMENTATION-PLAN-PHASE7.md §Integration Testing
 */

import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from "vitest";

// =============================================================================
// MOCKS
// =============================================================================

// Mock Prisma client
vi.mock("../../db/client.js", () => ({
  prisma: {
    workflow: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    workflowExecution: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

// Mock BullMQ
vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: "job-1" }),
    close: vi.fn().mockResolvedValue(undefined),
  })),
  Worker: vi.fn().mockImplementation((name, processor, opts) => ({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

import type { LLMClient, ToolRegistry, ToolDefinition } from "../nodes/types.js";
import type {
  WorkflowDefinition,
  ExecutionContext,
  ExecutionStatus,
  WorkflowNode,
  AgentNodeConfig,
  ConditionNodeConfig,
  IteratorNodeConfig,
  ToolNodeConfig,
  ExecutionLogEntry,
} from "../types.js";
import { prisma } from "../../db/client.js";
import { ExecutionContextManager } from "../engine/context.js";
import { WorkflowEngine } from "../engine/engine.js";
import {
  processNode,
  type ExecutionRepository,
  type NodeExecutorRegistry,
} from "../engine/processor.js";
import {
  executeNode,
  executeConditionNode,
  executeIteratorNode,
  executeAgentNode,
  executeToolNode,
  setDefaultLLMClient,
  setDefaultToolRegistry,
  createToolRegistry,
} from "../nodes/index.js";
import {
  createWorkflow,
  createExecution,
  updateExecution,
  getExecution,
  setNodeOutput,
  appendExecutionLog,
  WorkflowValidationError,
  WorkflowNotActiveError,
} from "../service.js";

// =============================================================================
// TEST DATA
// =============================================================================

const mockOrgId = "org-integration-test";
const mockUserId = "user-integration-test";
const mockWorkflowId = "workflow-integration-1";
const mockExecutionId = "exec-integration-1";

/**
 * Creates a complete linear workflow: trigger → agent → tool → communication
 */
function createLinearWorkflowDefinition(): WorkflowDefinition {
  return {
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 0, y: 0 },
        data: {
          label: "Manual Start",
          config: { triggerType: "MANUAL" },
        },
      },
      {
        id: "agent-1",
        type: "agent",
        position: { x: 300, y: 0 },
        data: {
          label: "Process Input",
          config: {
            prompt: "Process the following data: {{inputs.data}}",
            systemPrompt: "You are a data processor.",
          },
        },
      },
      {
        id: "tool-1",
        type: "tool",
        position: { x: 600, y: 0 },
        data: {
          label: "Save Result",
          config: {
            toolName: "save_data",
            content: "{{nodes.agent-1.text}}",
          },
        },
      },
    ],
    edges: [
      { id: "edge-1", source: "trigger-1", target: "agent-1" },
      { id: "edge-2", source: "agent-1", target: "tool-1" },
    ],
  };
}

/**
 * Creates a workflow with conditional branching
 */
function createConditionWorkflowDefinition(): WorkflowDefinition {
  return {
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 0, y: 0 },
        data: {
          label: "Start",
          config: { triggerType: "MANUAL" },
        },
      },
      {
        id: "condition-1",
        type: "condition",
        position: { x: 300, y: 0 },
        data: {
          label: "Check Value",
          config: {
            expression: "{{inputs.value}} > 10",
          },
        },
      },
      {
        id: "agent-true",
        type: "agent",
        position: { x: 600, y: -100 },
        data: {
          label: "High Value Path",
          config: {
            prompt: "Processing high value: {{inputs.value}}",
          },
        },
      },
      {
        id: "agent-false",
        type: "agent",
        position: { x: 600, y: 100 },
        data: {
          label: "Low Value Path",
          config: {
            prompt: "Processing low value: {{inputs.value}}",
          },
        },
      },
    ],
    edges: [
      { id: "edge-1", source: "trigger-1", target: "condition-1" },
      { id: "edge-2", source: "condition-1", target: "agent-true", sourceHandle: "true" },
      { id: "edge-3", source: "condition-1", target: "agent-false", sourceHandle: "false" },
    ],
  };
}

/**
 * Creates a workflow with an iterator node
 */
function createIteratorWorkflowDefinition(): WorkflowDefinition {
  return {
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 0, y: 0 },
        data: {
          label: "Start",
          config: { triggerType: "MANUAL" },
        },
      },
      {
        id: "iterator-1",
        type: "iterator",
        position: { x: 300, y: 0 },
        data: {
          label: "Process Items",
          config: {
            collection: "{{inputs.items}}",
            itemVariable: "currentItem",
          },
        },
      },
      {
        id: "agent-1",
        type: "agent",
        position: { x: 600, y: 0 },
        data: {
          label: "Process Each",
          config: {
            prompt: "Process item: {{currentItem}}",
          },
        },
      },
    ],
    edges: [
      { id: "edge-1", source: "trigger-1", target: "iterator-1" },
      { id: "edge-2", source: "iterator-1", target: "agent-1" },
    ],
  };
}

/**
 * Creates a complex multi-path workflow
 */
function createComplexWorkflowDefinition(): WorkflowDefinition {
  return {
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 0, y: 0 },
        data: { config: { triggerType: "MANUAL" } },
      },
      {
        id: "tool-query",
        type: "tool",
        position: { x: 300, y: 0 },
        data: {
          config: {
            toolName: "execute_query",
            query: "SELECT * FROM orders WHERE status = '{{inputs.status}}'",
          },
        },
      },
      {
        id: "condition-1",
        type: "condition",
        position: { x: 600, y: 0 },
        data: {
          config: {
            expression: "{{nodes.tool-query.rowCount}} > 0",
          },
        },
      },
      {
        id: "agent-summarize",
        type: "agent",
        position: { x: 900, y: -100 },
        data: {
          config: {
            prompt: "Summarize these orders: {{nodes.tool-query.rows}}",
          },
        },
      },
      {
        id: "comm-notify",
        type: "communication",
        position: { x: 1200, y: -100 },
        data: {
          config: {
            method: "email",
            to: "{{inputs.notifyEmail}}",
            subject: "Order Summary",
            body: "{{nodes.agent-summarize.text}}",
          },
        },
      },
      {
        id: "agent-no-orders",
        type: "agent",
        position: { x: 900, y: 100 },
        data: {
          config: {
            prompt: "No orders found for status {{inputs.status}}",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "tool-query" },
      { id: "e2", source: "tool-query", target: "condition-1" },
      { id: "e3", source: "condition-1", target: "agent-summarize", sourceHandle: "true" },
      { id: "e4", source: "condition-1", target: "agent-no-orders", sourceHandle: "false" },
      { id: "e5", source: "agent-summarize", target: "comm-notify" },
    ],
  };
}

// =============================================================================
// MOCK SETUP HELPERS
// =============================================================================

function createMockLLMClient(): LLMClient {
  return {
    generateText: vi.fn().mockResolvedValue({
      text: "Mock LLM response",
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    }),
  };
}

function createMockToolRegistry(): ToolRegistry {
  const tools: ToolDefinition[] = [
    {
      name: "save_data",
      description: "Save data to storage",
      execute: vi.fn().mockResolvedValue({ success: true, savedId: "saved-123" }),
    },
    {
      name: "execute_query",
      description: "Execute a database query",
      execute: vi.fn().mockResolvedValue({
        rows: [
          { id: 1, status: "pending" },
          { id: 2, status: "pending" },
        ],
        rowCount: 2,
      }),
    },
    {
      name: "send_email",
      description: "Send an email",
      execute: vi.fn().mockResolvedValue({ sent: true, messageId: "msg-123" }),
    },
  ];
  return createToolRegistry(tools);
}

function createMockWorkflow(definition: WorkflowDefinition, overrides = {}) {
  return {
    id: mockWorkflowId,
    organizationId: mockOrgId,
    name: "Integration Test Workflow",
    description: "Test workflow",
    definition,
    status: "ACTIVE",
    triggerType: "MANUAL",
    triggerConfig: null,
    createdBy: mockUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockExecution(
  context: ExecutionContext = { inputs: {}, nodeOutputs: {}, globalVariables: {} },
) {
  return {
    id: mockExecutionId,
    workflowId: mockWorkflowId,
    status: "PENDING" as ExecutionStatus,
    context,
    logs: [] as ExecutionLogEntry[],
    triggeredBy: mockUserId,
    startedAt: new Date(),
    finishedAt: null,
    error: null,
  };
}

// =============================================================================
// WORKFLOW CREATION & VALIDATION INTEGRATION TESTS
// =============================================================================

describe("Workflow Creation Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createWorkflow → validate → store", () => {
    it("should create a valid linear workflow", async () => {
      const definition = createLinearWorkflowDefinition();
      const mockCreated = createMockWorkflow(definition, { status: "DRAFT" });

      (prisma.workflow.create as Mock).mockResolvedValue(mockCreated);

      const result = await createWorkflow(mockOrgId, mockUserId, {
        name: "Linear Workflow",
        description: "A simple linear workflow",
        definition,
        triggerType: "MANUAL",
      });

      expect(result.id).toBe(mockWorkflowId);
      expect(result.definition.nodes).toHaveLength(3);
      expect(result.definition.edges).toHaveLength(2);
      expect(prisma.workflow.create).toHaveBeenCalledOnce();
    });

    it("should create a valid conditional workflow", async () => {
      const definition = createConditionWorkflowDefinition();
      const mockCreated = createMockWorkflow(definition, { status: "DRAFT" });

      (prisma.workflow.create as Mock).mockResolvedValue(mockCreated);

      const result = await createWorkflow(mockOrgId, mockUserId, {
        name: "Conditional Workflow",
        definition,
      });

      expect(result.definition.nodes).toHaveLength(4);
      // Should have edges with sourceHandle for condition branching
      const conditionEdges = result.definition.edges.filter((e) => e.sourceHandle);
      expect(conditionEdges).toHaveLength(2);
    });

    it("should reject workflow with invalid variable references", async () => {
      const invalidDefinition: WorkflowDefinition = {
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
            data: {
              config: {
                prompt: "Use {{nodes.nonexistent.output}}",
              },
            },
          },
        ],
        edges: [{ id: "e1", source: "trigger-1", target: "agent-1" }],
      };

      await expect(
        createWorkflow(mockOrgId, mockUserId, {
          name: "Invalid Workflow",
          definition: invalidDefinition,
        }),
      ).rejects.toThrow(WorkflowValidationError);
    });

    it("should reject workflow without trigger node", async () => {
      const noTriggerDefinition: WorkflowDefinition = {
        nodes: [
          {
            id: "agent-1",
            type: "agent",
            position: { x: 0, y: 0 },
            data: { config: { prompt: "Hello" } },
          },
        ],
        edges: [],
      };

      await expect(
        createWorkflow(mockOrgId, mockUserId, {
          name: "No Trigger",
          definition: noTriggerDefinition,
        }),
      ).rejects.toThrow(WorkflowValidationError);
    });
  });
});

// =============================================================================
// EXECUTION FLOW INTEGRATION TESTS
// =============================================================================

describe("Workflow Execution Integration", () => {
  let mockLLM: LLMClient;
  let mockTools: ToolRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLLM = createMockLLMClient();
    mockTools = createMockToolRegistry();
    setDefaultLLMClient(mockLLM);
    setDefaultToolRegistry(mockTools);
  });

  afterEach(() => {
    setDefaultLLMClient(undefined as unknown as LLMClient);
    setDefaultToolRegistry(undefined as unknown as ToolRegistry);
  });

  describe("Linear Workflow Execution", () => {
    it("should execute all nodes in sequence with variable resolution", async () => {
      const definition = createLinearWorkflowDefinition();
      const context: ExecutionContext = {
        inputs: { data: "test input data" },
        nodeOutputs: {},
        globalVariables: {},
      };

      // Execute trigger node
      const engine = new WorkflowEngine(definition, context);
      const triggerNode = engine.getNode("trigger-1");
      expect(triggerNode).toBeDefined();

      // Execute agent node with resolved variables
      const agentNode = engine.getNode("agent-1")!;
      const resolvedAgentConfig = engine.resolveVariables(agentNode.data.config);

      expect(resolvedAgentConfig).toEqual({
        prompt: "Process the following data: test input data",
        systemPrompt: "You are a data processor.",
      });

      // Execute agent
      const agentOutput = await executeAgentNode(
        resolvedAgentConfig as AgentNodeConfig,
        context,
        mockLLM,
      );
      expect(agentOutput.text).toBe("Mock LLM response");

      // Update context with agent output
      context.nodeOutputs["agent-1"] = agentOutput;

      // Execute tool node with resolved variables
      const toolNode = engine.getNode("tool-1")!;
      engine.updateContext(context);
      const resolvedToolConfig = engine.resolveVariables(toolNode.data.config);

      expect(resolvedToolConfig).toEqual({
        toolName: "save_data",
        content: "Mock LLM response",
      });

      // Execute tool
      const toolOutput = await executeToolNode(
        resolvedToolConfig as ToolNodeConfig,
        context,
        mockTools,
      );
      expect(toolOutput).toEqual({ success: true, savedId: "saved-123" });
    });

    it("should track execution status transitions correctly", async () => {
      const definition = createLinearWorkflowDefinition();
      const mockWorkflow = createMockWorkflow(definition);
      let currentExecution = createMockExecution({
        inputs: { data: "test" },
        nodeOutputs: {},
        globalVariables: {},
      });

      // Mock database calls
      (prisma.workflow.findUnique as Mock).mockResolvedValue(mockWorkflow);
      (prisma.workflowExecution.create as Mock).mockResolvedValue(currentExecution);
      (prisma.workflowExecution.findUnique as Mock).mockImplementation(() =>
        Promise.resolve(currentExecution),
      );
      (prisma.workflowExecution.update as Mock).mockImplementation(
        (args: { data: { status?: ExecutionStatus; context?: ExecutionContext } }) => {
          currentExecution = { ...currentExecution, ...args.data };
          return Promise.resolve(currentExecution);
        },
      );

      // Create execution (PENDING)
      const execution = await createExecution(mockWorkflowId, {
        inputs: { data: "test" },
        triggeredBy: mockUserId,
      });
      expect(execution.status).toBe("PENDING");

      // Update to RUNNING
      const running = await updateExecution(mockExecutionId, { status: "RUNNING" });
      expect(running.status).toBe("RUNNING");

      // Update to COMPLETED
      const completed = await updateExecution(mockExecutionId, {
        status: "COMPLETED",
        finishedAt: new Date(),
      });
      expect(completed.status).toBe("COMPLETED");
    });
  });

  describe("Condition Branching", () => {
    it("should take true path when condition evaluates to true", async () => {
      const definition = createConditionWorkflowDefinition();
      const context: ExecutionContext = {
        inputs: { value: 25 }, // > 10, should be true
        nodeOutputs: {},
        globalVariables: {},
      };

      const engine = new WorkflowEngine(definition, context);

      // Execute condition node
      const conditionNode = engine.getNode("condition-1")!;
      const resolvedConfig = engine.resolveVariables(conditionNode.data.config);

      const conditionOutput = await executeConditionNode(
        resolvedConfig as ConditionNodeConfig,
        context,
      );

      expect(conditionOutput.result).toBe(true);
      expect(conditionOutput.nextHandle).toBe("true");

      // Verify next nodes
      const nextNodes = engine.getNextNodes("condition-1", conditionOutput);
      expect(nextNodes).toEqual(["agent-true"]);
    });

    it("should take false path when condition evaluates to false", async () => {
      const definition = createConditionWorkflowDefinition();
      const context: ExecutionContext = {
        inputs: { value: 5 }, // <= 10, should be false
        nodeOutputs: {},
        globalVariables: {},
      };

      const engine = new WorkflowEngine(definition, context);
      const conditionNode = engine.getNode("condition-1")!;
      const resolvedConfig = engine.resolveVariables(conditionNode.data.config);

      const conditionOutput = await executeConditionNode(
        resolvedConfig as ConditionNodeConfig,
        context,
      );

      expect(conditionOutput.result).toBe(false);
      expect(conditionOutput.nextHandle).toBe("false");

      const nextNodes = engine.getNextNodes("condition-1", conditionOutput);
      expect(nextNodes).toEqual(["agent-false"]);
    });

    it("should handle complex boolean expressions", async () => {
      const context: ExecutionContext = {
        inputs: { a: 10, b: 20, c: "test" },
        nodeOutputs: {},
        globalVariables: {},
      };

      // Test compound conditions
      const config1: ConditionNodeConfig = {
        expression: '{{inputs.a}} < {{inputs.b}} && {{inputs.c}} === "test"',
      };
      const engine = new WorkflowEngine({ nodes: [], edges: [] }, context);
      const resolved1 = engine.resolveVariables(config1) as ConditionNodeConfig;
      const result1 = await executeConditionNode(resolved1, context);
      expect(result1.result).toBe(true);

      // Test OR condition
      const config2: ConditionNodeConfig = {
        expression: "{{inputs.a}} > 100 || {{inputs.b}} === 20",
      };
      const resolved2 = engine.resolveVariables(config2) as ConditionNodeConfig;
      const result2 = await executeConditionNode(resolved2, context);
      expect(result2.result).toBe(true);
    });

    it("should handle string comparisons in conditions", async () => {
      const context: ExecutionContext = {
        inputs: { status: "active", role: "admin" },
        nodeOutputs: {},
        globalVariables: {},
      };

      const config: ConditionNodeConfig = {
        expression: '{{inputs.status}} === "active"',
      };

      const engine = new WorkflowEngine({ nodes: [], edges: [] }, context);
      const resolved = engine.resolveVariables(config) as ConditionNodeConfig;
      const result = await executeConditionNode(resolved, context);
      expect(result.result).toBe(true);
    });
  });

  describe("Iterator Loops", () => {
    it("should iterate over array collections", async () => {
      const context: ExecutionContext = {
        inputs: { items: ["apple", "banana", "cherry"] },
        nodeOutputs: {},
        globalVariables: {},
      };

      // Iterator uses the raw config with variable references
      // and resolves them internally
      const config: IteratorNodeConfig = {
        collection: "{{inputs.items}}",
        itemVariable: "fruit",
      };

      const output = await executeIteratorNode(config, context);

      expect(output.iterations).toBe(3);
      expect(output.results).toHaveLength(3);
      expect(output.errors).toHaveLength(0);
    });

    it("should iterate over array from previous node output", async () => {
      const context: ExecutionContext = {
        inputs: {},
        nodeOutputs: {
          "query-1": {
            rows: [
              { id: 1, name: "A" },
              { id: 2, name: "B" },
            ],
          },
        },
        globalVariables: {},
      };

      const config: IteratorNodeConfig = {
        collection: "{{nodes.query-1.rows}}",
        itemVariable: "row",
      };

      const output = await executeIteratorNode(config, context);

      expect(output.iterations).toBe(2);
    });

    it("should process items with callback", async () => {
      const context: ExecutionContext = {
        inputs: { numbers: [1, 2, 3, 4, 5] },
        nodeOutputs: {},
        globalVariables: {},
      };

      const config: IteratorNodeConfig = {
        collection: "{{inputs.numbers}}",
        itemVariable: "num",
        maxConcurrency: 1,
      };

      const output = await executeIteratorNode(config, context, async (item, index) => {
        return (item as number) * 2;
      });

      expect(output.results).toEqual([2, 4, 6, 8, 10]);
    });

    it("should handle empty collections gracefully", async () => {
      const context: ExecutionContext = {
        inputs: { items: [] },
        nodeOutputs: {},
        globalVariables: {},
      };

      const config: IteratorNodeConfig = {
        collection: "{{inputs.items}}",
        itemVariable: "item",
      };

      const output = await executeIteratorNode(config, context);

      expect(output.iterations).toBe(0);
      expect(output.results).toEqual([]);
    });
  });

  describe("Variable Resolution Between Nodes", () => {
    it("should resolve variables from multiple upstream nodes", async () => {
      const context: ExecutionContext = {
        inputs: { userId: "user-123" },
        nodeOutputs: {
          "fetch-user": { name: "John", email: "john@example.com" },
          "fetch-orders": { count: 5, total: 250.0 },
        },
        globalVariables: { currency: "USD" },
      };

      const engine = new WorkflowEngine({ nodes: [], edges: [] }, context);

      // Template using multiple sources
      const template =
        "User {{nodes.fetch-user.name}} has {{nodes.fetch-orders.count}} orders totaling {{nodes.fetch-orders.total}} {{currency}}";
      const resolved = engine.resolveVariables(template);

      expect(resolved).toBe("User John has 5 orders totaling 250 USD");
    });

    it("should preserve object types for exact variable matches", async () => {
      const context: ExecutionContext = {
        inputs: {},
        nodeOutputs: {
          "query-1": { rows: [{ id: 1 }, { id: 2 }], count: 2 },
        },
        globalVariables: {},
      };

      const engine = new WorkflowEngine({ nodes: [], edges: [] }, context);

      // Exact match should return raw array
      const rows = engine.resolveVariables("{{nodes.query-1.rows}}");
      expect(Array.isArray(rows)).toBe(true);
      expect(rows).toEqual([{ id: 1 }, { id: 2 }]);

      // Inline should stringify
      const message = engine.resolveVariables("Rows: {{nodes.query-1.rows}}");
      expect(typeof message).toBe("string");
      expect(message).toContain("[{");
    });

    it("should handle deep nested path resolution", async () => {
      const context: ExecutionContext = {
        inputs: {},
        nodeOutputs: {
          "api-call": {
            data: {
              users: [{ profile: { settings: { theme: "dark" } } }],
            },
          },
        },
        globalVariables: {},
      };

      const engine = new WorkflowEngine({ nodes: [], edges: [] }, context);

      const theme = engine.resolveVariables("{{nodes.api-call.data.users}}");
      expect(Array.isArray(theme)).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle missing node output gracefully", async () => {
      const context: ExecutionContext = {
        inputs: {},
        nodeOutputs: {},
        globalVariables: {},
      };

      const engine = new WorkflowEngine({ nodes: [], edges: [] }, context);

      // Missing node reference should return original template
      const result = engine.resolveVariables("{{nodes.nonexistent.output}}");
      expect(result).toBe("{{nodes.nonexistent.output}}");
    });

    it("should handle LLM errors gracefully", async () => {
      const failingLLM: LLMClient = {
        generateText: vi.fn().mockRejectedValue(new Error("API rate limit exceeded")),
      };

      const config: AgentNodeConfig = {
        prompt: "Test prompt",
      };

      await expect(
        executeAgentNode(config, { inputs: {}, nodeOutputs: {}, globalVariables: {} }, failingLLM),
      ).rejects.toThrow("LLM call failed: API rate limit exceeded");
    });

    it("should handle tool execution errors", async () => {
      const failingTool: ToolDefinition = {
        name: "failing_tool",
        description: "A tool that fails",
        execute: vi.fn().mockRejectedValue(new Error("Database connection failed")),
      };

      const registry = createToolRegistry([failingTool]);

      await expect(
        executeToolNode(
          { toolName: "failing_tool" },
          { inputs: {}, nodeOutputs: {}, globalVariables: {} },
          registry,
        ),
      ).rejects.toThrow("Tool 'failing_tool' execution failed: Database connection failed");
    });

    it("should handle condition evaluation errors", async () => {
      const config: ConditionNodeConfig = {
        expression: "{{inputs.value}}.unknownMethod()",
      };

      await expect(
        executeConditionNode(config, {
          inputs: { value: 5 },
          nodeOutputs: {},
          globalVariables: {},
        }),
      ).rejects.toThrow();
    });
  });
});

// =============================================================================
// COMPLEX WORKFLOW INTEGRATION TESTS
// =============================================================================

describe("Complex Workflow Scenarios", () => {
  let mockLLM: LLMClient;
  let mockTools: ToolRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLLM = createMockLLMClient();
    mockTools = createMockToolRegistry();
    setDefaultLLMClient(mockLLM);
    setDefaultToolRegistry(mockTools);
  });

  afterEach(() => {
    setDefaultLLMClient(undefined as unknown as LLMClient);
    setDefaultToolRegistry(undefined as unknown as ToolRegistry);
  });

  it("should execute multi-path workflow with tool → condition → agent → communication", async () => {
    const definition = createComplexWorkflowDefinition();
    const context: ExecutionContext = {
      inputs: { status: "pending", notifyEmail: "admin@example.com" },
      nodeOutputs: {},
      globalVariables: {},
    };

    const engine = new WorkflowEngine(definition, context);

    // Step 1: Execute tool-query
    const toolNode = engine.getNode("tool-query")!;
    const resolvedToolConfig = engine.resolveVariables(toolNode.data.config) as ToolNodeConfig;

    const toolOutput = await executeToolNode(resolvedToolConfig, context, mockTools);
    context.nodeOutputs["tool-query"] = toolOutput;

    expect(toolOutput).toEqual({
      rows: [
        { id: 1, status: "pending" },
        { id: 2, status: "pending" },
      ],
      rowCount: 2,
    });

    // Step 2: Execute condition-1
    engine.updateContext(context);
    const conditionNode = engine.getNode("condition-1")!;
    const resolvedConditionConfig = engine.resolveVariables(
      conditionNode.data.config,
    ) as ConditionNodeConfig;

    const conditionOutput = await executeConditionNode(resolvedConditionConfig, context);
    context.nodeOutputs["condition-1"] = conditionOutput;

    expect(conditionOutput.result).toBe(true);
    expect(conditionOutput.nextHandle).toBe("true");

    // Step 3: Get next node (should be agent-summarize)
    const nextNodes = engine.getNextNodes("condition-1", conditionOutput);
    expect(nextNodes).toEqual(["agent-summarize"]);

    // Step 4: Execute agent-summarize
    engine.updateContext(context);
    const agentNode = engine.getNode("agent-summarize")!;
    const resolvedAgentConfig = engine.resolveVariables(agentNode.data.config) as AgentNodeConfig;

    const agentOutput = await executeAgentNode(resolvedAgentConfig, context, mockLLM);
    context.nodeOutputs["agent-summarize"] = agentOutput;

    expect(agentOutput.text).toBe("Mock LLM response");

    // Step 5: Execute comm-notify
    engine.updateContext(context);
    const commNode = engine.getNode("comm-notify")!;
    const resolvedCommConfig = engine.resolveVariables(commNode.data.config);

    expect(resolvedCommConfig).toEqual({
      method: "email",
      to: "admin@example.com",
      subject: "Order Summary",
      body: "Mock LLM response",
    });
  });

  it("should take alternative path when condition is false", async () => {
    const definition = createComplexWorkflowDefinition();

    // Mock tool to return no rows
    const emptyTools = createToolRegistry([
      {
        name: "execute_query",
        description: "Execute a database query",
        execute: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      },
    ]);

    const context: ExecutionContext = {
      inputs: { status: "nonexistent", notifyEmail: "admin@example.com" },
      nodeOutputs: {},
      globalVariables: {},
    };

    const engine = new WorkflowEngine(definition, context);

    // Execute tool
    const toolNode = engine.getNode("tool-query")!;
    const resolvedToolConfig = engine.resolveVariables(toolNode.data.config) as ToolNodeConfig;
    const toolOutput = await executeToolNode(resolvedToolConfig, context, emptyTools);
    context.nodeOutputs["tool-query"] = toolOutput;

    // Execute condition
    engine.updateContext(context);
    const conditionNode = engine.getNode("condition-1")!;
    const resolvedConditionConfig = engine.resolveVariables(
      conditionNode.data.config,
    ) as ConditionNodeConfig;
    const conditionOutput = await executeConditionNode(resolvedConditionConfig, context);

    expect(conditionOutput.result).toBe(false);
    expect(conditionOutput.nextHandle).toBe("false");

    // Should go to agent-no-orders
    const nextNodes = engine.getNextNodes("condition-1", conditionOutput);
    expect(nextNodes).toEqual(["agent-no-orders"]);
  });
});

// =============================================================================
// EXECUTION PERSISTENCE INTEGRATION TESTS
// =============================================================================

describe("Execution Persistence Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should persist node outputs correctly", async () => {
    const definition = createLinearWorkflowDefinition();
    const mockWorkflow = createMockWorkflow(definition);
    let currentExecution = createMockExecution();

    (prisma.workflow.findUnique as Mock).mockResolvedValue(mockWorkflow);
    (prisma.workflowExecution.create as Mock).mockResolvedValue(currentExecution);
    (prisma.workflowExecution.findUnique as Mock).mockImplementation(() =>
      Promise.resolve(currentExecution),
    );
    (prisma.workflowExecution.update as Mock).mockImplementation(
      (args: { data: Partial<typeof currentExecution> }) => {
        currentExecution = { ...currentExecution, ...args.data };
        return Promise.resolve(currentExecution);
      },
    );

    // Create execution
    await createExecution(mockWorkflowId, { inputs: { data: "test" } });

    // Set node output
    const nodeOutput = { text: "Agent response", usage: { tokens: 100 } };
    await setNodeOutput(mockExecutionId, "agent-1", nodeOutput);

    // Verify update was called with correct context
    expect(prisma.workflowExecution.update).toHaveBeenCalledWith({
      where: { id: mockExecutionId },
      data: {
        context: expect.objectContaining({
          nodeOutputs: { "agent-1": nodeOutput },
        }),
      },
    });
  });

  it("should append execution logs correctly", async () => {
    let currentExecution = createMockExecution();
    currentExecution.logs = [
      {
        timestamp: "2024-01-01T00:00:00Z",
        nodeId: null,
        message: "Started",
        level: "info" as const,
      },
    ];

    (prisma.workflowExecution.findUnique as Mock).mockImplementation(() =>
      Promise.resolve(currentExecution),
    );
    (prisma.workflowExecution.update as Mock).mockImplementation(
      (args: { data: { logs?: ExecutionLogEntry[] } }) => {
        currentExecution = { ...currentExecution, logs: args.data.logs ?? currentExecution.logs };
        return Promise.resolve(currentExecution);
      },
    );

    const newLog: ExecutionLogEntry = {
      timestamp: "2024-01-01T00:01:00Z",
      nodeId: "agent-1",
      message: "Processing...",
      level: "info",
    };

    await appendExecutionLog(mockExecutionId, newLog);

    expect(prisma.workflowExecution.update).toHaveBeenCalledWith({
      where: { id: mockExecutionId },
      data: {
        logs: expect.arrayContaining([
          expect.objectContaining({ message: "Started" }),
          expect.objectContaining({ message: "Processing..." }),
        ]),
      },
    });
  });
});

// =============================================================================
// CONTEXT MANAGER INTEGRATION TESTS
// =============================================================================

describe("ExecutionContextManager Integration", () => {
  it("should serialize and deserialize context correctly", () => {
    const initialContext: ExecutionContext = {
      inputs: { name: "test", count: 5 },
      nodeOutputs: {
        "node-1": { result: "data", array: [1, 2, 3] },
      },
      globalVariables: { tenant: "acme" },
    };

    const manager = new ExecutionContextManager(initialContext);
    const serialized = manager.toJSON();
    const restored = ExecutionContextManager.fromJSON(serialized);

    expect(restored.getContext()).toEqual(initialContext);
  });

  it("should track node outputs correctly", () => {
    const manager = new ExecutionContextManager();

    manager.setNodeOutput("step-1", { value: 100 });
    manager.setNodeOutput("step-2", { value: 200 });

    const context = manager.getContext();
    expect(context.nodeOutputs["step-1"]).toEqual({ value: 100 });
    expect(context.nodeOutputs["step-2"]).toEqual({ value: 200 });
  });

  it("should manage global variables", () => {
    const manager = new ExecutionContextManager();

    manager.setGlobalVariable("counter", 0);
    manager.setGlobalVariable("counter", 1);
    manager.setGlobalVariable("flag", true);

    const context = manager.getContext();
    expect(context.globalVariables.counter).toBe(1);
    expect(context.globalVariables.flag).toBe(true);
  });
});

// =============================================================================
// NODE TYPE EXECUTION TESTS
// =============================================================================

describe("All Node Types Integration", () => {
  let mockLLM: LLMClient;
  let mockTools: ToolRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLLM = createMockLLMClient();
    mockTools = createMockToolRegistry();
    setDefaultLLMClient(mockLLM);
    setDefaultToolRegistry(mockTools);
  });

  afterEach(() => {
    setDefaultLLMClient(undefined as unknown as LLMClient);
    setDefaultToolRegistry(undefined as unknown as ToolRegistry);
  });

  it("should execute trigger node", async () => {
    const output = await executeNode(
      "trigger",
      { triggerType: "manual" }, // lowercase per implementation
      { inputs: {}, nodeOutputs: {}, globalVariables: {} },
    );

    expect(output).toMatchObject({
      triggered: true,
      triggerType: "manual",
    });
    expect(output).toHaveProperty("timestamp");
  });

  it("should execute agent node", async () => {
    const output = await executeNode(
      "agent",
      { prompt: "Hello world" },
      { inputs: {}, nodeOutputs: {}, globalVariables: {} },
    );

    expect(output).toHaveProperty("text");
    expect(mockLLM.generateText).toHaveBeenCalled();
  });

  it("should execute tool node", async () => {
    const output = await executeNode(
      "tool",
      { toolName: "save_data", content: "test" },
      { inputs: {}, nodeOutputs: {}, globalVariables: {} },
    );

    expect(output).toEqual({ success: true, savedId: "saved-123" });
  });

  it("should execute condition node", async () => {
    const output = await executeNode(
      "condition",
      { expression: "5 > 3" },
      { inputs: {}, nodeOutputs: {}, globalVariables: {} },
    );

    expect(output).toHaveProperty("result", true);
    expect(output).toHaveProperty("nextHandle", "true");
  });

  it("should execute iterator node", async () => {
    const output = await executeNode(
      "iterator",
      { collection: "{{inputs.items}}", itemVariable: "item" },
      { inputs: { items: [1, 2, 3] }, nodeOutputs: {}, globalVariables: {} },
    );

    expect(output).toHaveProperty("iterations", 3);
  });
});
