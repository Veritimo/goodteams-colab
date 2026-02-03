/**
 * Workflow Module Exports Test
 *
 * Verifies all public exports from the workflow module are accessible
 * and properly typed.
 */

import { describe, it, expect } from "vitest";
// Import from platform index to verify re-exports
import * as platform from "../../index.js";
// Import everything from the main workflows index
import * as workflows from "../index.js";

describe("Workflow Module Exports", () => {
  describe("Types", () => {
    it("should export all workflow types", () => {
      // These are type-only exports, so we verify they're importable
      // by importing them in a type position
      type _NodeId = workflows.NodeId;
      type _WorkflowNode = workflows.WorkflowNode;
      type _WorkflowEdge = workflows.WorkflowEdge;
      type _WorkflowDefinition = workflows.WorkflowDefinition;
      type _WorkflowGlobalConfig = workflows.WorkflowGlobalConfig;
      type _WorkflowNodeType = workflows.WorkflowNodeType;
      type _ExecutionContext = workflows.ExecutionContext;
      type _ExecutionLogEntry = workflows.ExecutionLogEntry;
      type _AgentNodeOutput = workflows.AgentNodeOutput;
      type _ConditionNodeOutput = workflows.ConditionNodeOutput;

      // These type aliases exist just to verify exports compile
      expect(true).toBe(true);
    });

    it("should export service types", () => {
      type _WorkflowWithDefinition = workflows.WorkflowWithDefinition;
      type _WorkflowWithExecutions = workflows.WorkflowWithExecutions;
      type _WorkflowExecutionWithContext = workflows.WorkflowExecutionWithContext;
      type _CreateWorkflowInput = workflows.CreateWorkflowInput;
      type _UpdateWorkflowInput = workflows.UpdateWorkflowInput;
      type _ListWorkflowsFilters = workflows.ListWorkflowsFilters;
      type _PaginatedResponse<T> = workflows.PaginatedResponse<T>;

      expect(true).toBe(true);
    });

    it("should export validation types", () => {
      type _ValidationResult = workflows.ValidationResult;
      type _ValidationError = workflows.ValidationError;
      type _ValidationWarning = workflows.ValidationWarning;

      expect(true).toBe(true);
    });
  });

  describe("Validation Functions", () => {
    it("should export validateDefinition", () => {
      expect(typeof workflows.validateDefinition).toBe("function");
    });

    it("should export validateNodeConfig", () => {
      expect(typeof workflows.validateNodeConfig).toBe("function");
    });

    it("should export extractVariableReferences", () => {
      expect(typeof workflows.extractVariableReferences).toBe("function");
    });

    it("should export validateVariableReferences", () => {
      expect(typeof workflows.validateVariableReferences).toBe("function");
    });

    it("should export ValidationErrorCodes", () => {
      expect(workflows.ValidationErrorCodes).toBeDefined();
      expect(workflows.ValidationErrorCodes.EMPTY_DEFINITION).toBe("EMPTY_DEFINITION");
      expect(workflows.ValidationErrorCodes.CYCLE_DETECTED).toBe("CYCLE_DETECTED");
    });

    it("should export ValidationWarningCodes", () => {
      expect(workflows.ValidationWarningCodes).toBeDefined();
      expect(workflows.ValidationWarningCodes.LARGE_WORKFLOW).toBe("LARGE_WORKFLOW");
    });
  });

  describe("Service Functions", () => {
    it("should export workflow CRUD functions", () => {
      expect(typeof workflows.createWorkflow).toBe("function");
      expect(typeof workflows.getWorkflow).toBe("function");
      expect(typeof workflows.getWorkflowWithExecutions).toBe("function");
      expect(typeof workflows.listWorkflows).toBe("function");
      expect(typeof workflows.updateWorkflow).toBe("function");
      expect(typeof workflows.deleteWorkflow).toBe("function");
      expect(typeof workflows.hardDeleteWorkflow).toBe("function");
    });

    it("should export execution CRUD functions", () => {
      expect(typeof workflows.createExecution).toBe("function");
      expect(typeof workflows.getExecution).toBe("function");
      expect(typeof workflows.listExecutions).toBe("function");
      expect(typeof workflows.updateExecution).toBe("function");
      expect(typeof workflows.appendExecutionLog).toBe("function");
      expect(typeof workflows.setNodeOutput).toBe("function");
    });

    it("should export utility functions", () => {
      expect(typeof workflows.workflowExists).toBe("function");
      expect(typeof workflows.getActiveWorkflowsByTrigger).toBe("function");
      expect(typeof workflows.getExecutionStats).toBe("function");
      expect(typeof workflows.getWorkflowByWebhookPath).toBe("function");
    });

    it("should export error classes", () => {
      expect(workflows.WorkflowNotFoundError).toBeDefined();
      expect(workflows.WorkflowAlreadyExistsError).toBeDefined();
      expect(workflows.WorkflowValidationError).toBeDefined();
      expect(workflows.ExecutionNotFoundError).toBeDefined();
      expect(workflows.WorkflowNotActiveError).toBeDefined();
      expect(workflows.WorkflowAccessDeniedError).toBeDefined();

      // Verify they are constructable
      const err = new workflows.WorkflowNotFoundError("test-id");
      expect(err.message).toContain("test-id");
    });
  });

  describe("Node Executors", () => {
    it("should export main dispatcher functions", () => {
      expect(typeof workflows.executeNode).toBe("function");
      expect(typeof workflows.executeTypedNode).toBe("function");
      expect(typeof workflows.validateNode).toBe("function");
      expect(typeof workflows.isValidNodeType).toBe("function");
      expect(typeof workflows.getSupportedNodeTypes).toBe("function");
      expect(typeof workflows.registerNodeExecutor).toBe("function");
      expect(typeof workflows.unregisterNodeExecutor).toBe("function");
    });

    it("should export individual executors", () => {
      expect(typeof workflows.executeTriggerNode).toBe("function");
      expect(typeof workflows.executeAgentNode).toBe("function");
      expect(typeof workflows.executeToolNode).toBe("function");
      expect(typeof workflows.executeConditionNode).toBe("function");
      expect(typeof workflows.executeCommunicationNode).toBe("function");
      expect(typeof workflows.executeIteratorNode).toBe("function");
    });

    it("should export executor utilities", () => {
      expect(typeof workflows.resolveVariables).toBe("function");
      expect(typeof workflows.evaluateExpression).toBe("function");
      expect(typeof workflows.getIterationItems).toBe("function");
    });

    it("should export NodeExecutionError", () => {
      expect(workflows.NodeExecutionError).toBeDefined();
      const err = new workflows.NodeExecutionError("agent", "test error");
      expect(err.message).toContain("agent");
      expect(err.nodeType).toBe("agent");
    });
  });

  describe("Tools", () => {
    it("should export tool factory", () => {
      expect(typeof workflows.createWorkflowTools).toBe("function");
    });

    it("should export tool executors", () => {
      expect(typeof workflows.executeWorkflowList).toBe("function");
      expect(typeof workflows.executeWorkflowGet).toBe("function");
      expect(typeof workflows.executeWorkflowCreate).toBe("function");
      expect(typeof workflows.executeWorkflowUpdate).toBe("function");
      expect(typeof workflows.executeWorkflowExecute).toBe("function");
      expect(typeof workflows.executeWorkflowStatus).toBe("function");
    });

    it("should export workflow generator", () => {
      expect(typeof workflows.generateWorkflowFromPrompt).toBe("function");
      expect(typeof workflows.validateWorkflowDefinition).toBe("function");
      expect(workflows.EXAMPLE_WORKFLOWS).toBeDefined();
    });

    it("should export tool schemas", () => {
      expect(workflows.WorkflowListSchema).toBeDefined();
      expect(workflows.WorkflowGetSchema).toBeDefined();
      expect(workflows.WorkflowCreateSchema).toBeDefined();
      expect(workflows.WorkflowUpdateSchema).toBeDefined();
      expect(workflows.WorkflowExecuteSchema).toBeDefined();
      expect(workflows.WorkflowStatusSchema).toBeDefined();
      expect(workflows.WORKFLOW_TOOL_DEFINITIONS).toBeDefined();
    });
  });

  describe("Triggers", () => {
    it("should export manual trigger functions", () => {
      expect(typeof workflows.executeManualTrigger).toBe("function");
      expect(typeof workflows.validateInputs).toBe("function");
      expect(typeof workflows.findTriggerNode).toBe("function");
      expect(workflows.ManualTriggerError).toBeDefined();
    });

    it("should export cron trigger functions", () => {
      expect(typeof workflows.registerCronTrigger).toBe("function");
      expect(typeof workflows.unregisterCronTrigger).toBe("function");
      expect(typeof workflows.getCronJob).toBe("function");
      expect(typeof workflows.getAllCronJobs).toBe("function");
      expect(typeof workflows.clearAllCronJobs).toBe("function");
      expect(typeof workflows.initCronTriggers).toBe("function");
      expect(typeof workflows.validateCronExpression).toBe("function");
      expect(typeof workflows.validateTimezone).toBe("function");
      expect(workflows.CronTriggerError).toBeDefined();
    });

    it("should export webhook trigger functions", () => {
      expect(typeof workflows.handleWebhookRequest).toBe("function");
      expect(typeof workflows.setupWebhookTrigger).toBe("function");
      expect(typeof workflows.regenerateWebhookSecret).toBe("function");
      expect(typeof workflows.generateWebhookSecret).toBe("function");
      expect(typeof workflows.generateWebhookPath).toBe("function");
      expect(typeof workflows.computeSignature).toBe("function");
      expect(typeof workflows.verifySignature).toBe("function");
      expect(typeof workflows.extractSignature).toBe("function");
      expect(typeof workflows.createWebhookRouteHandler).toBe("function");
      expect(workflows.WebhookTriggerError).toBeDefined();
    });

    it("should export chat trigger functions", () => {
      expect(typeof workflows.checkChatTriggers).toBe("function");
      expect(typeof workflows.executeChatTrigger).toBe("function");
      expect(typeof workflows.handleChatMessage).toBe("function");
      expect(typeof workflows.matchesTriggerPhrase).toBe("function");
      expect(typeof workflows.normalizeText).toBe("function");
      expect(typeof workflows.validateTriggerPhrase).toBe("function");
      expect(typeof workflows.suggestTriggerPhrase).toBe("function");
    });

    it("should export trigger registry", () => {
      expect(workflows.TRIGGER_REGISTRY).toBeDefined();
      expect(typeof workflows.getTriggerInfo).toBe("function");
      expect(typeof workflows.validateTriggerConfig).toBe("function");
      expect(typeof workflows.initializeTriggers).toBe("function");
      expect(typeof workflows.shutdownTriggers).toBe("function");
    });
  });

  describe("Platform Re-exports", () => {
    it("should re-export workflow types from platform", () => {
      type _NodeId = platform.NodeId;
      type _WorkflowDefinition = platform.WorkflowDefinition;
      expect(true).toBe(true);
    });

    it("should re-export validation from platform", () => {
      expect(typeof platform.validateDefinition).toBe("function");
      expect(platform.ValidationErrorCodes).toBeDefined();
    });

    it("should re-export service from platform", () => {
      expect(typeof platform.createWorkflow).toBe("function");
      expect(typeof platform.getWorkflow).toBe("function");
      expect(platform.WorkflowNotFoundError).toBeDefined();
    });

    it("should re-export node executors from platform", () => {
      expect(typeof platform.executeNode).toBe("function");
      expect(typeof platform.executeAgentNode).toBe("function");
      expect(platform.NodeExecutionError).toBeDefined();
    });

    it("should re-export tools from platform", () => {
      expect(typeof platform.createWorkflowTools).toBe("function");
      expect(typeof platform.generateWorkflowFromPrompt).toBe("function");
    });

    it("should re-export triggers from platform", () => {
      expect(typeof platform.executeManualTrigger).toBe("function");
      expect(typeof platform.registerCronTrigger).toBe("function");
      expect(platform.TRIGGER_REGISTRY).toBeDefined();
    });
  });

  describe("No Circular Dependencies", () => {
    it("should import workflow index without circular dependency issues", async () => {
      // If there were circular dependencies, this import would fail or hang
      const mod = await import("../index.js");
      expect(mod).toBeDefined();
      expect(Object.keys(mod).length).toBeGreaterThan(0);
    });

    it("should import platform index without circular dependency issues", async () => {
      const mod = await import("../../index.js");
      expect(mod).toBeDefined();
      expect(mod.validateDefinition).toBeDefined();
    });
  });

  describe("getSupportedNodeTypes", () => {
    it("should return all supported node types", () => {
      const types = workflows.getSupportedNodeTypes();
      expect(types).toContain("trigger");
      expect(types).toContain("agent");
      expect(types).toContain("tool");
      expect(types).toContain("condition");
      expect(types).toContain("communication");
      expect(types).toContain("iterator");
      expect(types.length).toBe(6);
    });
  });

  describe("isValidNodeType", () => {
    it("should validate known node types", () => {
      expect(workflows.isValidNodeType("trigger")).toBe(true);
      expect(workflows.isValidNodeType("agent")).toBe(true);
      expect(workflows.isValidNodeType("tool")).toBe(true);
      expect(workflows.isValidNodeType("condition")).toBe(true);
      expect(workflows.isValidNodeType("communication")).toBe(true);
      expect(workflows.isValidNodeType("iterator")).toBe(true);
    });

    it("should reject unknown node types", () => {
      expect(workflows.isValidNodeType("unknown")).toBe(false);
      expect(workflows.isValidNodeType("")).toBe(false);
      expect(workflows.isValidNodeType("TRIGGER")).toBe(false); // case sensitive
    });
  });
});
