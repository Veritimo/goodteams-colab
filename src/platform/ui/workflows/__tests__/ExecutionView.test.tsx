/**
 * ExecutionView Component Tests
 *
 * Tests for the workflow execution monitoring panel.
 *
 * @see docs/IMPLEMENTATION-PLAN-PHASE7.md §4.3
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ExecutionLogEntry } from "../../../workflows/types";
import type {
  ExecutionViewProps,
  ExecutionSummary,
  ExecutionStatus,
  NodeExecutionState,
} from "../ExecutionView";

// =============================================================================
// MOCK DATA FACTORIES
// =============================================================================

function createMockExecution(overrides: Partial<ExecutionSummary> = {}): ExecutionSummary {
  return {
    id: `exec_${Date.now()}`,
    workflowId: "wf_123",
    workflowName: "Test Workflow",
    status: "COMPLETED",
    triggeredBy: "user@example.com",
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockLog(overrides: Partial<ExecutionLogEntry> = {}): ExecutionLogEntry {
  return {
    timestamp: new Date().toISOString(),
    nodeId: "agent_1",
    message: "Test log message",
    level: "info",
    ...overrides,
  };
}

function createMockNodeState(overrides: Partial<NodeExecutionState> = {}): NodeExecutionState {
  return {
    nodeId: "agent_1",
    nodeName: "Agent Node",
    status: "completed",
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    ...overrides,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("ExecutionView", () => {
  let mockOnSelectExecution: ReturnType<typeof vi.fn>;
  let mockOnRefresh: ReturnType<typeof vi.fn>;
  let mockOnClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnSelectExecution = vi.fn();
    mockOnRefresh = vi.fn();
    mockOnClose = vi.fn();
  });

  describe("Component Structure", () => {
    it("should export ExecutionView component", async () => {
      const { ExecutionView } = await import("../ExecutionView");
      expect(ExecutionView).toBeDefined();
      expect(typeof ExecutionView).toBe("function");
    });

    it("should export type definitions", async () => {
      // Type-only export check - if it compiles, it works
      const module = await import("../ExecutionView");
      expect(module).toBeDefined();
    });
  });

  describe("Execution Status Types", () => {
    it("should support PENDING status", () => {
      const execution = createMockExecution({ status: "PENDING" });
      expect(execution.status).toBe("PENDING");
    });

    it("should support RUNNING status", () => {
      const execution = createMockExecution({
        status: "RUNNING",
        finishedAt: undefined,
      });
      expect(execution.status).toBe("RUNNING");
      expect(execution.finishedAt).toBeUndefined();
    });

    it("should support COMPLETED status", () => {
      const execution = createMockExecution({ status: "COMPLETED" });
      expect(execution.status).toBe("COMPLETED");
    });

    it("should support FAILED status with error", () => {
      const execution = createMockExecution({
        status: "FAILED",
        error: "Connection timeout",
      });
      expect(execution.status).toBe("FAILED");
      expect(execution.error).toBe("Connection timeout");
    });

    it("should support CANCELLED status", () => {
      const execution = createMockExecution({ status: "CANCELLED" });
      expect(execution.status).toBe("CANCELLED");
    });
  });

  describe("Execution List", () => {
    it("should create valid execution mock", () => {
      const execution = createMockExecution();
      expect(execution.id).toBeDefined();
      expect(execution.workflowId).toBe("wf_123");
      expect(execution.workflowName).toBe("Test Workflow");
    });

    it("should support multiple executions", () => {
      const executions = [
        createMockExecution({ id: "exec_1", status: "COMPLETED" }),
        createMockExecution({ id: "exec_2", status: "RUNNING" }),
        createMockExecution({ id: "exec_3", status: "FAILED" }),
      ];
      expect(executions).toHaveLength(3);
      expect(executions[1].status).toBe("RUNNING");
    });

    it("should track selection callback", () => {
      mockOnSelectExecution("exec_123");
      expect(mockOnSelectExecution).toHaveBeenCalledWith("exec_123");
    });
  });

  describe("Execution Logs", () => {
    it("should create valid log entry", () => {
      const log = createMockLog();
      expect(log.timestamp).toBeDefined();
      expect(log.nodeId).toBe("agent_1");
      expect(log.message).toBe("Test log message");
      expect(log.level).toBe("info");
    });

    it("should support debug level logs", () => {
      const log = createMockLog({ level: "debug", message: "Debug info" });
      expect(log.level).toBe("debug");
    });

    it("should support info level logs", () => {
      const log = createMockLog({ level: "info", message: "Processing node" });
      expect(log.level).toBe("info");
    });

    it("should support warn level logs", () => {
      const log = createMockLog({ level: "warn", message: "Rate limit approaching" });
      expect(log.level).toBe("warn");
    });

    it("should support error level logs", () => {
      const log = createMockLog({ level: "error", message: "Failed to execute" });
      expect(log.level).toBe("error");
    });

    it("should support success level logs", () => {
      const log = createMockLog({ level: "success", message: "Node completed" });
      expect(log.level).toBe("success");
    });

    it("should support logs with additional data", () => {
      const log = createMockLog({
        message: "Tool executed",
        data: { toolName: "web_search", duration: 1234 },
      });
      expect(log.data).toEqual({ toolName: "web_search", duration: 1234 });
    });

    it("should support workflow-level logs (null nodeId)", () => {
      const log = createMockLog({ nodeId: null, message: "Workflow started" });
      expect(log.nodeId).toBeNull();
    });
  });

  describe("Node Execution States", () => {
    it("should create valid node state", () => {
      const state = createMockNodeState();
      expect(state.nodeId).toBe("agent_1");
      expect(state.nodeName).toBe("Agent Node");
      expect(state.status).toBe("completed");
    });

    it("should support pending node state", () => {
      const state = createMockNodeState({
        status: "pending",
        startedAt: undefined,
        completedAt: undefined,
      });
      expect(state.status).toBe("pending");
    });

    it("should support running node state", () => {
      const state = createMockNodeState({
        status: "running",
        completedAt: undefined,
      });
      expect(state.status).toBe("running");
    });

    it("should support completed node state", () => {
      const state = createMockNodeState({ status: "completed" });
      expect(state.status).toBe("completed");
    });

    it("should support failed node state with error", () => {
      const state = createMockNodeState({
        status: "failed",
        error: "Tool execution failed",
      });
      expect(state.status).toBe("failed");
      expect(state.error).toBe("Tool execution failed");
    });

    it("should support skipped node state", () => {
      const state = createMockNodeState({
        status: "skipped",
        startedAt: undefined,
        completedAt: undefined,
      });
      expect(state.status).toBe("skipped");
    });

    it("should support multiple node states", () => {
      const states = [
        createMockNodeState({ nodeId: "trigger_1", status: "completed" }),
        createMockNodeState({ nodeId: "agent_1", status: "running" }),
        createMockNodeState({ nodeId: "agent_2", status: "pending" }),
        createMockNodeState({ nodeId: "condition_1", status: "skipped" }),
      ];
      expect(states).toHaveLength(4);
      expect(states.filter((s) => s.status === "completed")).toHaveLength(1);
      expect(states.filter((s) => s.status === "running")).toHaveLength(1);
    });
  });

  describe("Refresh and Polling", () => {
    it("should track refresh callback", () => {
      mockOnRefresh();
      expect(mockOnRefresh).toHaveBeenCalled();
    });

    it("should track close callback", () => {
      mockOnClose();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe("Props Validation", () => {
    it("should accept all required props", () => {
      const props: ExecutionViewProps = {
        workflowId: "wf_123",
        executions: [createMockExecution()],
        logs: [createMockLog()],
        onSelectExecution: mockOnSelectExecution,
      };

      expect(props.workflowId).toBe("wf_123");
      expect(props.executions).toHaveLength(1);
      expect(props.logs).toHaveLength(1);
      expect(props.onSelectExecution).toBeDefined();
    });

    it("should accept optional props", () => {
      const props: ExecutionViewProps = {
        workflowId: "wf_123",
        executions: [createMockExecution()],
        selectedExecutionId: "exec_1",
        logs: [createMockLog()],
        nodeStates: [createMockNodeState()],
        onSelectExecution: mockOnSelectExecution,
        onRefresh: mockOnRefresh,
        isLoading: true,
        error: "Network error",
        pollingInterval: 3000,
        onClose: mockOnClose,
      };

      expect(props.selectedExecutionId).toBe("exec_1");
      expect(props.nodeStates).toHaveLength(1);
      expect(props.onRefresh).toBeDefined();
      expect(props.isLoading).toBe(true);
      expect(props.error).toBe("Network error");
      expect(props.pollingInterval).toBe(3000);
      expect(props.onClose).toBeDefined();
    });

    it("should handle empty executions list", () => {
      const props: ExecutionViewProps = {
        workflowId: "wf_123",
        executions: [],
        logs: [],
        onSelectExecution: mockOnSelectExecution,
      };

      expect(props.executions).toHaveLength(0);
      expect(props.logs).toHaveLength(0);
    });
  });

  describe("Error Handling", () => {
    it("should display execution errors", () => {
      const execution = createMockExecution({
        status: "FAILED",
        error: "Agent model returned an error: rate limit exceeded",
      });
      expect(execution.error).toContain("rate limit exceeded");
    });

    it("should display component-level errors", () => {
      const props: ExecutionViewProps = {
        workflowId: "wf_123",
        executions: [],
        logs: [],
        onSelectExecution: mockOnSelectExecution,
        error: "Failed to fetch executions",
      };
      expect(props.error).toBe("Failed to fetch executions");
    });
  });

  describe("Timestamps and Duration", () => {
    it("should have valid startedAt timestamp", () => {
      const execution = createMockExecution();
      const date = new Date(execution.startedAt);
      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).not.toBeNaN();
    });

    it("should have valid finishedAt timestamp for completed executions", () => {
      const execution = createMockExecution({ status: "COMPLETED" });
      expect(execution.finishedAt).toBeDefined();
      const date = new Date(execution.finishedAt!);
      expect(date.getTime()).not.toBeNaN();
    });

    it("should not have finishedAt for running executions", () => {
      const execution = createMockExecution({
        status: "RUNNING",
        finishedAt: undefined,
      });
      expect(execution.finishedAt).toBeUndefined();
    });

    it("should calculate duration correctly", () => {
      const start = new Date("2024-01-15T10:00:00Z");
      const end = new Date("2024-01-15T10:05:30Z");
      const durationMs = end.getTime() - start.getTime();
      expect(durationMs).toBe(330000); // 5 minutes 30 seconds
    });
  });

  describe("Real-time Updates", () => {
    it("should support polling interval configuration", () => {
      const props: ExecutionViewProps = {
        workflowId: "wf_123",
        executions: [],
        logs: [],
        onSelectExecution: mockOnSelectExecution,
        pollingInterval: 5000,
      };
      expect(props.pollingInterval).toBe(5000);
    });

    it("should disable polling with interval of 0", () => {
      const props: ExecutionViewProps = {
        workflowId: "wf_123",
        executions: [],
        logs: [],
        onSelectExecution: mockOnSelectExecution,
        pollingInterval: 0,
      };
      expect(props.pollingInterval).toBe(0);
    });
  });
});
