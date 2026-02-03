/**
 * Workflow Service Tests
 *
 * Tests for workflow and execution CRUD operations.
 *
 * @see src/platform/workflows/service.ts
 */

import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from "vitest";

// Mock Prisma client
vi.mock("../../db/client.js", () => ({
  prisma: {
    workflow: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
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

import type { WorkflowDefinition } from "../types.js";
import { prisma } from "../../db/client.js";
import {
  createWorkflow,
  getWorkflow,
  getWorkflowWithExecutions,
  listWorkflows,
  updateWorkflow,
  deleteWorkflow,
  hardDeleteWorkflow,
  createExecution,
  getExecution,
  listExecutions,
  updateExecution,
  appendExecutionLog,
  setNodeOutput,
  workflowExists,
  getActiveWorkflowsByTrigger,
  getExecutionStats,
  WorkflowNotFoundError,
  WorkflowAlreadyExistsError,
  WorkflowValidationError,
  ExecutionNotFoundError,
  WorkflowNotActiveError,
  WorkflowAccessDeniedError,
} from "../service.js";

// =============================================================================
// TEST DATA
// =============================================================================

const mockOrgId = "org-123";
const mockUserId = "user-456";
const mockWorkflowId = "workflow-789";
const mockExecutionId = "exec-abc";

const validDefinition: WorkflowDefinition = {
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
      id: "agent-1",
      type: "agent",
      position: { x: 200, y: 0 },
      data: {
        label: "AI Agent",
        config: { prompt: "Hello world" },
      },
    },
  ],
  edges: [{ id: "edge-1", source: "trigger-1", target: "agent-1" }],
};

const mockWorkflow = {
  id: mockWorkflowId,
  organizationId: mockOrgId,
  name: "Test Workflow",
  description: "A test workflow",
  definition: validDefinition,
  status: "DRAFT",
  triggerType: "MANUAL",
  triggerConfig: null,
  createdBy: mockUserId,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockExecution = {
  id: mockExecutionId,
  workflowId: mockWorkflowId,
  status: "PENDING",
  context: { inputs: {}, nodeOutputs: {}, globalVariables: {} },
  logs: [],
  triggeredBy: mockUserId,
  startedAt: new Date("2024-01-01"),
  finishedAt: null,
  error: null,
};

// =============================================================================
// WORKFLOW CRUD TESTS
// =============================================================================

describe("Workflow CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createWorkflow", () => {
    it("should create a workflow with valid definition", async () => {
      (prisma.workflow.create as Mock).mockResolvedValue(mockWorkflow);

      const result = await createWorkflow(mockOrgId, mockUserId, {
        name: "Test Workflow",
        description: "A test workflow",
        definition: validDefinition,
        triggerType: "MANUAL",
      });

      expect(result.id).toBe(mockWorkflowId);
      expect(result.name).toBe("Test Workflow");
      expect(result.definition).toEqual(validDefinition);
      expect(prisma.workflow.create).toHaveBeenCalledOnce();
    });

    it("should throw WorkflowValidationError for invalid definition", async () => {
      const invalidDefinition: WorkflowDefinition = {
        nodes: [], // Empty - no trigger
        edges: [],
      };

      // Empty workflow is actually valid per our implementation
      // Let's test with actual invalid data
      const reallyInvalid = {
        nodes: "not an array",
        edges: [],
      } as unknown as WorkflowDefinition;

      await expect(
        createWorkflow(mockOrgId, mockUserId, {
          name: "Test",
          definition: reallyInvalid,
        }),
      ).rejects.toThrow(WorkflowValidationError);
    });

    it("should throw WorkflowAlreadyExistsError on duplicate name", async () => {
      (prisma.workflow.create as Mock).mockRejectedValue(
        new Error("Unique constraint failed on the fields: (`organizationId`,`name`)"),
      );

      await expect(
        createWorkflow(mockOrgId, mockUserId, {
          name: "Existing Workflow",
          definition: validDefinition,
        }),
      ).rejects.toThrow(WorkflowAlreadyExistsError);
    });

    it("should validate variable references in definition", async () => {
      const defWithBadRef: WorkflowDefinition = {
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
            position: { x: 200, y: 0 },
            data: {
              label: "Agent",
              config: { prompt: "Use {{nodes.nonexistent.data}}" },
            },
          },
        ],
        edges: [{ id: "e1", source: "trigger-1", target: "agent-1" }],
      };

      await expect(
        createWorkflow(mockOrgId, mockUserId, {
          name: "Test",
          definition: defWithBadRef,
        }),
      ).rejects.toThrow(WorkflowValidationError);
    });
  });

  describe("getWorkflow", () => {
    it("should return workflow for valid ID", async () => {
      (prisma.workflow.findUnique as Mock).mockResolvedValue(mockWorkflow);

      const result = await getWorkflow(mockWorkflowId, mockOrgId);

      expect(result.id).toBe(mockWorkflowId);
      expect(result.name).toBe("Test Workflow");
    });

    it("should throw WorkflowNotFoundError for non-existent ID", async () => {
      (prisma.workflow.findUnique as Mock).mockResolvedValue(null);

      await expect(getWorkflow("nonexistent", mockOrgId)).rejects.toThrow(WorkflowNotFoundError);
    });

    it("should throw WorkflowAccessDeniedError for wrong organization", async () => {
      (prisma.workflow.findUnique as Mock).mockResolvedValue({
        ...mockWorkflow,
        organizationId: "different-org",
      });

      await expect(getWorkflow(mockWorkflowId, mockOrgId)).rejects.toThrow(
        WorkflowAccessDeniedError,
      );
    });

    it("should allow access without org check when orgId is undefined", async () => {
      (prisma.workflow.findUnique as Mock).mockResolvedValue(mockWorkflow);

      const result = await getWorkflow(mockWorkflowId);

      expect(result.id).toBe(mockWorkflowId);
    });
  });

  describe("getWorkflowWithExecutions", () => {
    it("should return workflow with executions", async () => {
      (prisma.workflow.findUnique as Mock).mockResolvedValue({
        ...mockWorkflow,
        executions: [mockExecution],
      });

      const result = await getWorkflowWithExecutions(mockWorkflowId, mockOrgId);

      expect(result.id).toBe(mockWorkflowId);
      expect(result.executions).toHaveLength(1);
      expect(result.executions[0].id).toBe(mockExecutionId);
    });

    it("should limit executions returned", async () => {
      (prisma.workflow.findUnique as Mock).mockResolvedValue({
        ...mockWorkflow,
        executions: [],
      });

      await getWorkflowWithExecutions(mockWorkflowId, mockOrgId, 5);

      expect(prisma.workflow.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            executions: expect.objectContaining({ take: 5 }),
          },
        }),
      );
    });
  });

  describe("listWorkflows", () => {
    it("should return paginated workflows", async () => {
      (prisma.workflow.findMany as Mock).mockResolvedValue([mockWorkflow]);
      (prisma.workflow.count as Mock).mockResolvedValue(1);

      const result = await listWorkflows(mockOrgId);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    it("should filter by status", async () => {
      (prisma.workflow.findMany as Mock).mockResolvedValue([]);
      (prisma.workflow.count as Mock).mockResolvedValue(0);

      await listWorkflows(mockOrgId, { status: "ACTIVE" });

      expect(prisma.workflow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "ACTIVE" }),
        }),
      );
    });

    it("should filter by trigger type", async () => {
      (prisma.workflow.findMany as Mock).mockResolvedValue([]);
      (prisma.workflow.count as Mock).mockResolvedValue(0);

      await listWorkflows(mockOrgId, { triggerType: "CRON" });

      expect(prisma.workflow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ triggerType: "CRON" }),
        }),
      );
    });

    it("should search by name and description", async () => {
      (prisma.workflow.findMany as Mock).mockResolvedValue([]);
      (prisma.workflow.count as Mock).mockResolvedValue(0);

      await listWorkflows(mockOrgId, { search: "test" });

      expect(prisma.workflow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: "test", mode: "insensitive" } },
              { description: { contains: "test", mode: "insensitive" } },
            ],
          }),
        }),
      );
    });

    it("should respect pagination parameters", async () => {
      (prisma.workflow.findMany as Mock).mockResolvedValue([]);
      (prisma.workflow.count as Mock).mockResolvedValue(0);

      await listWorkflows(mockOrgId, { limit: 10, offset: 20 });

      expect(prisma.workflow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        }),
      );
    });
  });

  describe("updateWorkflow", () => {
    it("should update workflow name", async () => {
      (prisma.workflow.findUnique as Mock).mockResolvedValue(mockWorkflow);
      (prisma.workflow.update as Mock).mockResolvedValue({
        ...mockWorkflow,
        name: "Updated Name",
      });

      const result = await updateWorkflow(mockWorkflowId, mockOrgId, {
        name: "Updated Name",
      });

      expect(result.name).toBe("Updated Name");
    });

    it("should update workflow status", async () => {
      (prisma.workflow.findUnique as Mock).mockResolvedValue(mockWorkflow);
      (prisma.workflow.update as Mock).mockResolvedValue({
        ...mockWorkflow,
        status: "ACTIVE",
      });

      const result = await updateWorkflow(mockWorkflowId, mockOrgId, {
        status: "ACTIVE",
      });

      expect(result.status).toBe("ACTIVE");
    });

    it("should validate definition on update", async () => {
      (prisma.workflow.findUnique as Mock).mockResolvedValue(mockWorkflow);

      const invalidDef = { nodes: "invalid" } as unknown as WorkflowDefinition;

      await expect(
        updateWorkflow(mockWorkflowId, mockOrgId, { definition: invalidDef }),
      ).rejects.toThrow(WorkflowValidationError);
    });

    it("should throw WorkflowNotFoundError if workflow doesn't exist", async () => {
      (prisma.workflow.findUnique as Mock).mockResolvedValue(null);

      await expect(updateWorkflow("nonexistent", mockOrgId, { name: "New Name" })).rejects.toThrow(
        WorkflowNotFoundError,
      );
    });
  });

  describe("deleteWorkflow", () => {
    it("should archive workflow (soft delete)", async () => {
      (prisma.workflow.findUnique as Mock).mockResolvedValue(mockWorkflow);
      (prisma.workflow.update as Mock).mockResolvedValue({
        ...mockWorkflow,
        status: "ARCHIVED",
      });

      const result = await deleteWorkflow(mockWorkflowId, mockOrgId);

      expect(result.status).toBe("ARCHIVED");
      expect(prisma.workflow.update).toHaveBeenCalledWith({
        where: { id: mockWorkflowId },
        data: { status: "ARCHIVED" },
      });
    });

    it("should throw WorkflowNotFoundError if workflow doesn't exist", async () => {
      (prisma.workflow.findUnique as Mock).mockResolvedValue(null);

      await expect(deleteWorkflow("nonexistent", mockOrgId)).rejects.toThrow(WorkflowNotFoundError);
    });
  });

  describe("hardDeleteWorkflow", () => {
    it("should permanently delete workflow", async () => {
      (prisma.workflow.findUnique as Mock).mockResolvedValue(mockWorkflow);
      (prisma.workflow.delete as Mock).mockResolvedValue(mockWorkflow);

      await hardDeleteWorkflow(mockWorkflowId, mockOrgId);

      expect(prisma.workflow.delete).toHaveBeenCalledWith({
        where: { id: mockWorkflowId },
      });
    });
  });

  describe("workflowExists", () => {
    it("should return true for existing workflow", async () => {
      (prisma.workflow.count as Mock).mockResolvedValue(1);

      const result = await workflowExists(mockWorkflowId);

      expect(result).toBe(true);
    });

    it("should return false for non-existing workflow", async () => {
      (prisma.workflow.count as Mock).mockResolvedValue(0);

      const result = await workflowExists("nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("getActiveWorkflowsByTrigger", () => {
    it("should return active workflows with specified trigger", async () => {
      (prisma.workflow.findMany as Mock).mockResolvedValue([
        { ...mockWorkflow, status: "ACTIVE", triggerType: "CRON" },
      ]);

      const result = await getActiveWorkflowsByTrigger("CRON");

      expect(result).toHaveLength(1);
      expect(prisma.workflow.findMany).toHaveBeenCalledWith({
        where: {
          triggerType: "CRON",
          status: "ACTIVE",
        },
      });
    });
  });
});

// =============================================================================
// EXECUTION CRUD TESTS
// =============================================================================

describe("Execution CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createExecution", () => {
    it("should create execution for active workflow", async () => {
      (prisma.workflow.findUnique as Mock).mockResolvedValue({
        ...mockWorkflow,
        status: "ACTIVE",
      });
      (prisma.workflowExecution.create as Mock).mockResolvedValue(mockExecution);

      const result = await createExecution(mockWorkflowId, {
        inputs: { key: "value" },
        triggeredBy: mockUserId,
      });

      expect(result.id).toBe(mockExecutionId);
      expect(result.status).toBe("PENDING");
    });

    it("should create execution for draft workflow (testing)", async () => {
      (prisma.workflow.findUnique as Mock).mockResolvedValue({
        ...mockWorkflow,
        status: "DRAFT",
      });
      (prisma.workflowExecution.create as Mock).mockResolvedValue(mockExecution);

      const result = await createExecution(mockWorkflowId);

      expect(result.id).toBe(mockExecutionId);
    });

    it("should throw WorkflowNotFoundError for non-existent workflow", async () => {
      (prisma.workflow.findUnique as Mock).mockResolvedValue(null);

      await expect(createExecution("nonexistent")).rejects.toThrow(WorkflowNotFoundError);
    });

    it("should throw WorkflowNotActiveError for paused workflow", async () => {
      (prisma.workflow.findUnique as Mock).mockResolvedValue({
        ...mockWorkflow,
        status: "PAUSED",
      });

      await expect(createExecution(mockWorkflowId)).rejects.toThrow(WorkflowNotActiveError);
    });

    it("should throw WorkflowNotActiveError for archived workflow", async () => {
      (prisma.workflow.findUnique as Mock).mockResolvedValue({
        ...mockWorkflow,
        status: "ARCHIVED",
      });

      await expect(createExecution(mockWorkflowId)).rejects.toThrow(WorkflowNotActiveError);
    });
  });

  describe("getExecution", () => {
    it("should return execution with workflow", async () => {
      (prisma.workflowExecution.findUnique as Mock).mockResolvedValue({
        ...mockExecution,
        workflow: mockWorkflow,
      });

      const result = await getExecution(mockExecutionId, mockOrgId);

      expect(result.id).toBe(mockExecutionId);
      expect(result.workflow.id).toBe(mockWorkflowId);
    });

    it("should throw ExecutionNotFoundError for non-existent execution", async () => {
      (prisma.workflowExecution.findUnique as Mock).mockResolvedValue(null);

      await expect(getExecution("nonexistent", mockOrgId)).rejects.toThrow(ExecutionNotFoundError);
    });

    it("should throw WorkflowAccessDeniedError for wrong organization", async () => {
      (prisma.workflowExecution.findUnique as Mock).mockResolvedValue({
        ...mockExecution,
        workflow: { ...mockWorkflow, organizationId: "different-org" },
      });

      await expect(getExecution(mockExecutionId, mockOrgId)).rejects.toThrow(
        WorkflowAccessDeniedError,
      );
    });
  });

  describe("listExecutions", () => {
    it("should return paginated executions", async () => {
      (prisma.workflow.findUnique as Mock).mockResolvedValue(mockWorkflow);
      (prisma.workflowExecution.findMany as Mock).mockResolvedValue([mockExecution]);
      (prisma.workflowExecution.count as Mock).mockResolvedValue(1);

      const result = await listExecutions(mockWorkflowId, mockOrgId);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("should filter by status", async () => {
      (prisma.workflow.findUnique as Mock).mockResolvedValue(mockWorkflow);
      (prisma.workflowExecution.findMany as Mock).mockResolvedValue([]);
      (prisma.workflowExecution.count as Mock).mockResolvedValue(0);

      await listExecutions(mockWorkflowId, mockOrgId, { status: "COMPLETED" });

      expect(prisma.workflowExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workflowId: mockWorkflowId, status: "COMPLETED" },
        }),
      );
    });
  });

  describe("updateExecution", () => {
    it("should update execution status", async () => {
      (prisma.workflowExecution.findUnique as Mock).mockResolvedValue(mockExecution);
      (prisma.workflowExecution.update as Mock).mockResolvedValue({
        ...mockExecution,
        status: "RUNNING",
      });

      const result = await updateExecution(mockExecutionId, { status: "RUNNING" });

      expect(result.status).toBe("RUNNING");
    });

    it("should update execution context", async () => {
      const newContext = {
        inputs: { key: "value" },
        nodeOutputs: { "node-1": { result: "test" } },
        globalVariables: {},
      };

      (prisma.workflowExecution.findUnique as Mock).mockResolvedValue(mockExecution);
      (prisma.workflowExecution.update as Mock).mockResolvedValue({
        ...mockExecution,
        context: newContext,
      });

      const result = await updateExecution(mockExecutionId, { context: newContext });

      expect(result.context).toEqual(newContext);
    });

    it("should throw ExecutionNotFoundError for non-existent execution", async () => {
      (prisma.workflowExecution.findUnique as Mock).mockResolvedValue(null);

      await expect(updateExecution("nonexistent", { status: "RUNNING" })).rejects.toThrow(
        ExecutionNotFoundError,
      );
    });
  });

  describe("appendExecutionLog", () => {
    it("should append log entry to execution", async () => {
      const existingLogs = [
        {
          timestamp: "2024-01-01T00:00:00Z",
          nodeId: null,
          message: "Started",
          level: "info" as const,
        },
      ];
      const newLog = {
        timestamp: "2024-01-01T00:01:00Z",
        nodeId: "agent-1",
        message: "Processing",
        level: "info" as const,
      };

      (prisma.workflowExecution.findUnique as Mock).mockResolvedValue({
        ...mockExecution,
        logs: existingLogs,
      });
      (prisma.workflowExecution.update as Mock).mockResolvedValue({
        ...mockExecution,
        logs: [...existingLogs, newLog],
      });

      const result = await appendExecutionLog(mockExecutionId, newLog);

      expect(result.logs).toHaveLength(2);
      expect(prisma.workflowExecution.update).toHaveBeenCalledWith({
        where: { id: mockExecutionId },
        data: { logs: [...existingLogs, newLog] },
      });
    });
  });

  describe("setNodeOutput", () => {
    it("should set node output in context", async () => {
      const nodeOutput = { result: "test data", success: true };

      (prisma.workflowExecution.findUnique as Mock).mockResolvedValue(mockExecution);
      (prisma.workflowExecution.update as Mock).mockResolvedValue({
        ...mockExecution,
        context: {
          ...mockExecution.context,
          nodeOutputs: { "agent-1": nodeOutput },
        },
      });

      const result = await setNodeOutput(mockExecutionId, "agent-1", nodeOutput);

      expect(result.context.nodeOutputs["agent-1"]).toEqual(nodeOutput);
    });
  });

  describe("getExecutionStats", () => {
    it("should return execution counts by status", async () => {
      (prisma.workflowExecution.groupBy as Mock).mockResolvedValue([
        { status: "COMPLETED", _count: 10 },
        { status: "FAILED", _count: 2 },
        { status: "RUNNING", _count: 1 },
      ]);

      const result = await getExecutionStats(mockWorkflowId);

      expect(result).toEqual({
        PENDING: 0,
        RUNNING: 1,
        COMPLETED: 10,
        FAILED: 2,
        WAITING_FOR_INPUT: 0,
      });
    });
  });
});
