/**
 * Tests for Workflow Job Processor
 */

import type { Job } from "bullmq";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { WorkflowDefinition, ExecutionContext, ExecutionStatus } from "../../types.js";
import type {
  ExecutionRepository,
  NodeExecutor,
  NodeExecutorRegistry,
  ProcessorConfig,
} from "../processor.js";
import { processNode, triggerExecutor, createBaseExecutorRegistry } from "../processor.js";

// Mock the queue module to prevent actual Redis connections
vi.mock("../queue.js", () => ({
  WORKFLOW_QUEUE_NAME: "workflow-jobs",
  getRedisConnectionOptions: () => ({ host: "localhost", port: 6379 }),
  enqueueNodeExecution: vi.fn().mockResolvedValue("job-id"),
}));

// Import after mock
import { enqueueNodeExecution } from "../queue.js";

describe("processNode", () => {
  let mockRepository: ExecutionRepository;
  let mockExecutors: NodeExecutorRegistry;
  let config: ProcessorConfig;

  const testWorkflow: WorkflowDefinition = {
    nodes: [
      {
        id: "trigger1",
        type: "trigger",
        position: { x: 0, y: 0 },
        data: { label: "Start", config: {} },
      },
      {
        id: "agent1",
        type: "agent",
        position: { x: 100, y: 0 },
        data: { label: "Agent", config: { prompt: "Hello {{inputs.name}}" } },
      },
      {
        id: "end1",
        type: "communication",
        position: { x: 200, y: 0 },
        data: { label: "End", config: {} },
      },
    ],
    edges: [
      { id: "e1", source: "trigger1", target: "agent1" },
      { id: "e2", source: "agent1", target: "end1" },
    ],
  };

  const testContext: ExecutionContext = {
    inputs: { name: "World" },
    nodeOutputs: {},
    globalVariables: {},
  };

  function createMockJob(
    executionId: string,
    nodeId: string,
  ): Job<{ executionId: string; nodeId: string }> {
    return {
      id: `job-${executionId}-${nodeId}`,
      data: { executionId, nodeId },
    } as Job<{ executionId: string; nodeId: string }>;
  }

  beforeEach(() => {
    vi.clearAllMocks();

    mockRepository = {
      getExecution: vi.fn(),
      updateExecution: vi.fn().mockResolvedValue(undefined),
    };

    // Create executors with mock agent executor
    mockExecutors = {
      ...createBaseExecutorRegistry(),
      agent: {
        execute: vi.fn().mockResolvedValue({ text: "Agent response" }),
      },
      communication: {
        execute: vi.fn().mockResolvedValue({ sent: true }),
      },
    };

    config = {
      repository: mockRepository,
      executors: mockExecutors,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("basic execution", () => {
    it("processes a trigger node and queues next", async () => {
      (mockRepository.getExecution as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "exec1",
        workflowId: "wf1",
        status: "PENDING" as ExecutionStatus,
        context: testContext,
        logs: [],
        workflow: {
          id: "wf1",
          definition: testWorkflow,
          tenantId: "tenant1",
        },
      });

      const job = createMockJob("exec1", "trigger1");
      await processNode(job, config);

      // Should update status to RUNNING
      expect(mockRepository.updateExecution).toHaveBeenCalledWith("exec1", {
        status: "RUNNING",
      });

      // Should queue next node
      expect(enqueueNodeExecution).toHaveBeenCalledWith("exec1", "agent1");
    });

    it("executes agent node with resolved variables", async () => {
      (mockRepository.getExecution as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "exec1",
        workflowId: "wf1",
        status: "RUNNING" as ExecutionStatus,
        context: testContext,
        logs: [],
        workflow: {
          id: "wf1",
          definition: testWorkflow,
          tenantId: "tenant1",
        },
      });

      const job = createMockJob("exec1", "agent1");
      await processNode(job, config);

      // Check executor was called with resolved config
      expect(mockExecutors.agent.execute).toHaveBeenCalledWith(
        expect.objectContaining({ id: "agent1" }),
        expect.objectContaining({ prompt: "Hello World" }),
        expect.any(Object),
        expect.objectContaining({
          executionId: "exec1",
          workflowId: "wf1",
          tenantId: "tenant1",
        }),
      );
    });

    it("stores node output in context", async () => {
      (mockRepository.getExecution as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "exec1",
        workflowId: "wf1",
        status: "RUNNING" as ExecutionStatus,
        context: testContext,
        logs: [],
        workflow: {
          id: "wf1",
          definition: testWorkflow,
          tenantId: "tenant1",
        },
      });

      const job = createMockJob("exec1", "agent1");
      await processNode(job, config);

      // Check context was updated with node output
      const updateCalls = (mockRepository.updateExecution as ReturnType<typeof vi.fn>).mock.calls;
      const contextUpdate = updateCalls.find((call) => call[1].context);
      expect(contextUpdate).toBeDefined();
      expect(contextUpdate[1].context.nodeOutputs.agent1).toEqual({
        text: "Agent response",
      });
    });
  });

  describe("workflow completion", () => {
    it("marks execution as COMPLETED when no next nodes", async () => {
      const workflowWithEndNode: WorkflowDefinition = {
        nodes: [
          {
            id: "end",
            type: "communication",
            position: { x: 0, y: 0 },
            data: { config: {} },
          },
        ],
        edges: [],
      };

      (mockRepository.getExecution as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "exec1",
        workflowId: "wf1",
        status: "RUNNING" as ExecutionStatus,
        context: testContext,
        logs: [],
        workflow: {
          id: "wf1",
          definition: workflowWithEndNode,
          tenantId: "tenant1",
        },
      });

      const job = createMockJob("exec1", "end");
      await processNode(job, config);

      // Should mark as COMPLETED
      const updateCalls = (mockRepository.updateExecution as ReturnType<typeof vi.fn>).mock.calls;
      const completionUpdate = updateCalls.find((call) => call[1].status === "COMPLETED");
      expect(completionUpdate).toBeDefined();
      expect(completionUpdate[1].finishedAt).toBeInstanceOf(Date);
    });
  });

  describe("error handling", () => {
    it("marks execution as FAILED when execution not found", async () => {
      (mockRepository.getExecution as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const job = createMockJob("missing", "node1");
      await expect(processNode(job, config)).rejects.toThrow("Execution missing not found");
    });

    it("marks execution as FAILED when node not found", async () => {
      (mockRepository.getExecution as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "exec1",
        workflowId: "wf1",
        status: "RUNNING" as ExecutionStatus,
        context: testContext,
        logs: [],
        workflow: {
          id: "wf1",
          definition: testWorkflow,
          tenantId: "tenant1",
        },
      });

      const job = createMockJob("exec1", "nonexistent");
      await processNode(job, config);

      const updateCalls = (mockRepository.updateExecution as ReturnType<typeof vi.fn>).mock.calls;
      const failUpdate = updateCalls.find((call) => call[1].status === "FAILED");
      expect(failUpdate).toBeDefined();
      expect(failUpdate[1].error).toContain("Node nonexistent not found");
    });

    it("marks execution as FAILED when no executor for node type", async () => {
      const workflowWithUnknownType: WorkflowDefinition = {
        nodes: [
          {
            id: "unknown",
            type: "unknown-type" as never,
            position: { x: 0, y: 0 },
            data: { config: {} },
          },
        ],
        edges: [],
      };

      (mockRepository.getExecution as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "exec1",
        workflowId: "wf1",
        status: "RUNNING" as ExecutionStatus,
        context: testContext,
        logs: [],
        workflow: {
          id: "wf1",
          definition: workflowWithUnknownType,
          tenantId: "tenant1",
        },
      });

      const job = createMockJob("exec1", "unknown");
      await processNode(job, config);

      const updateCalls = (mockRepository.updateExecution as ReturnType<typeof vi.fn>).mock.calls;
      const failUpdate = updateCalls.find((call) => call[1].status === "FAILED");
      expect(failUpdate).toBeDefined();
      expect(failUpdate[1].error).toContain("No executor found");
    });

    it("marks execution as FAILED and rethrows when executor throws", async () => {
      const errorExecutor: NodeExecutor = {
        execute: vi.fn().mockRejectedValue(new Error("Executor failed")),
      };

      (mockRepository.getExecution as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "exec1",
        workflowId: "wf1",
        status: "RUNNING" as ExecutionStatus,
        context: testContext,
        logs: [],
        workflow: {
          id: "wf1",
          definition: testWorkflow,
          tenantId: "tenant1",
        },
      });

      const configWithError: ProcessorConfig = {
        repository: mockRepository,
        executors: { ...mockExecutors, agent: errorExecutor },
      };

      const job = createMockJob("exec1", "agent1");
      await expect(processNode(job, configWithError)).rejects.toThrow("Executor failed");

      const updateCalls = (mockRepository.updateExecution as ReturnType<typeof vi.fn>).mock.calls;
      const failUpdate = updateCalls.find((call) => call[1].status === "FAILED");
      expect(failUpdate).toBeDefined();
      expect(failUpdate[1].error).toBe("Executor failed");
    });
  });

  describe("condition node handling", () => {
    it("routes to true branch when condition returns true", async () => {
      const conditionWorkflow: WorkflowDefinition = {
        nodes: [
          {
            id: "cond",
            type: "condition",
            position: { x: 0, y: 0 },
            data: { config: { expression: "{{inputs.count}} > 0" } },
          },
          {
            id: "yes",
            type: "agent",
            position: { x: 100, y: -50 },
            data: { config: {} },
          },
          {
            id: "no",
            type: "agent",
            position: { x: 100, y: 50 },
            data: { config: {} },
          },
        ],
        edges: [
          { id: "e1", source: "cond", target: "yes", sourceHandle: "true" },
          { id: "e2", source: "cond", target: "no", sourceHandle: "false" },
        ],
      };

      const conditionExecutor: NodeExecutor = {
        execute: vi.fn().mockResolvedValue({ result: true, nextHandle: "true" }),
      };

      (mockRepository.getExecution as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "exec1",
        workflowId: "wf1",
        status: "RUNNING" as ExecutionStatus,
        context: { inputs: { count: 5 }, nodeOutputs: {}, globalVariables: {} },
        logs: [],
        workflow: {
          id: "wf1",
          definition: conditionWorkflow,
          tenantId: "tenant1",
        },
      });

      const configWithCondition: ProcessorConfig = {
        repository: mockRepository,
        executors: { ...mockExecutors, condition: conditionExecutor },
      };

      const job = createMockJob("exec1", "cond");
      await processNode(job, configWithCondition);

      // Should queue only the "yes" node
      expect(enqueueNodeExecution).toHaveBeenCalledWith("exec1", "yes");
      expect(enqueueNodeExecution).not.toHaveBeenCalledWith("exec1", "no");
    });

    it("routes to false branch when condition returns false", async () => {
      const conditionWorkflow: WorkflowDefinition = {
        nodes: [
          {
            id: "cond",
            type: "condition",
            position: { x: 0, y: 0 },
            data: { config: { expression: "{{inputs.count}} > 0" } },
          },
          {
            id: "yes",
            type: "agent",
            position: { x: 100, y: -50 },
            data: { config: {} },
          },
          {
            id: "no",
            type: "agent",
            position: { x: 100, y: 50 },
            data: { config: {} },
          },
        ],
        edges: [
          { id: "e1", source: "cond", target: "yes", sourceHandle: "true" },
          { id: "e2", source: "cond", target: "no", sourceHandle: "false" },
        ],
      };

      const conditionExecutor: NodeExecutor = {
        execute: vi.fn().mockResolvedValue({ result: false, nextHandle: "false" }),
      };

      (mockRepository.getExecution as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "exec1",
        workflowId: "wf1",
        status: "RUNNING" as ExecutionStatus,
        context: { inputs: { count: 0 }, nodeOutputs: {}, globalVariables: {} },
        logs: [],
        workflow: {
          id: "wf1",
          definition: conditionWorkflow,
          tenantId: "tenant1",
        },
      });

      const configWithCondition: ProcessorConfig = {
        repository: mockRepository,
        executors: { ...mockExecutors, condition: conditionExecutor },
      };

      const job = createMockJob("exec1", "cond");
      await processNode(job, configWithCondition);

      // Should queue only the "no" node
      expect(enqueueNodeExecution).toHaveBeenCalledWith("exec1", "no");
      expect(enqueueNodeExecution).not.toHaveBeenCalledWith("exec1", "yes");
    });
  });

  describe("logging", () => {
    it("appends success log entry after node execution", async () => {
      (mockRepository.getExecution as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "exec1",
        workflowId: "wf1",
        status: "RUNNING" as ExecutionStatus,
        context: testContext,
        logs: [{ timestamp: new Date(), message: "Previous log", level: "info" }],
        workflow: {
          id: "wf1",
          definition: testWorkflow,
          tenantId: "tenant1",
        },
      });

      const job = createMockJob("exec1", "agent1");
      await processNode(job, config);

      const updateCalls = (mockRepository.updateExecution as ReturnType<typeof vi.fn>).mock.calls;
      const logsUpdate = updateCalls.find((call) => call[1].logs);
      expect(logsUpdate).toBeDefined();

      const logs = logsUpdate[1].logs;
      expect(logs.length).toBeGreaterThan(1);
      const successLog = logs.find(
        (l: { level: string }) => l.level === "success" && l.nodeId === "agent1",
      );
      expect(successLog).toBeDefined();
    });

    it("appends error log entry on failure", async () => {
      const errorExecutor: NodeExecutor = {
        execute: vi.fn().mockRejectedValue(new Error("Test error")),
      };

      (mockRepository.getExecution as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "exec1",
        workflowId: "wf1",
        status: "RUNNING" as ExecutionStatus,
        context: testContext,
        logs: [],
        workflow: {
          id: "wf1",
          definition: testWorkflow,
          tenantId: "tenant1",
        },
      });

      const configWithError: ProcessorConfig = {
        repository: mockRepository,
        executors: { ...mockExecutors, agent: errorExecutor },
      };

      const job = createMockJob("exec1", "agent1");
      await expect(processNode(job, configWithError)).rejects.toThrow();

      const updateCalls = (mockRepository.updateExecution as ReturnType<typeof vi.fn>).mock.calls;
      const failUpdate = updateCalls.find((call) => call[1].status === "FAILED");
      expect(failUpdate[1].logs).toBeDefined();
      const errorLog = failUpdate[1].logs.find((l: { level: string }) => l.level === "error");
      expect(errorLog).toBeDefined();
      expect(errorLog.message).toContain("Test error");
    });
  });
});

describe("triggerExecutor", () => {
  it("returns triggered: true with timestamp", async () => {
    const result = await triggerExecutor.execute(
      { id: "t1", type: "trigger", position: { x: 0, y: 0 }, data: { config: {} } },
      {},
      { inputs: {}, nodeOutputs: {}, globalVariables: {} },
      { executionId: "e1", workflowId: "w1", tenantId: "t1" },
    );

    expect(result).toEqual({
      triggered: true,
      timestamp: expect.any(String),
    });
  });
});

describe("createBaseExecutorRegistry", () => {
  it("includes trigger executor", () => {
    const registry = createBaseExecutorRegistry();
    expect(registry.trigger).toBeDefined();
    expect(registry.trigger).toBe(triggerExecutor);
  });
});
