/**
 * Workflow Validation Tests
 *
 * Tests for workflow definition validation including
 * structure, cycles, and node-specific configuration.
 *
 * @see src/platform/workflows/validation.ts
 */

import { describe, it, expect } from "vitest";
import type {
  WorkflowDefinition,
  WorkflowNode,
  AgentNodeConfig,
  ConditionNodeConfig,
} from "../types.js";
import {
  validateDefinition,
  validateNodeConfig,
  extractVariableReferences,
  validateVariableReferences,
  ValidationErrorCodes,
} from "../validation.js";

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createTriggerNode(id = "trigger-1"): WorkflowNode {
  return {
    id,
    type: "trigger",
    position: { x: 0, y: 0 },
    data: {
      label: "Start",
      config: { triggerType: "MANUAL" },
    },
  };
}

function createAgentNode(id = "agent-1", config?: Partial<AgentNodeConfig>): WorkflowNode {
  return {
    id,
    type: "agent",
    position: { x: 200, y: 0 },
    data: {
      label: "Agent",
      config: { prompt: "Test prompt", ...config },
    },
  };
}

function createConditionNode(id = "condition-1", expression = "true"): WorkflowNode {
  return {
    id,
    type: "condition",
    position: { x: 400, y: 0 },
    data: {
      label: "Condition",
      config: { expression },
    },
  };
}

// =============================================================================
// BASIC STRUCTURE TESTS
// =============================================================================

describe("validateDefinition - Basic Structure", () => {
  it("should accept valid workflow definition", () => {
    const definition: WorkflowDefinition = {
      nodes: [createTriggerNode(), createAgentNode()],
      edges: [{ id: "edge-1", source: "trigger-1", target: "agent-1" }],
    };

    const result = validateDefinition(definition);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should accept empty workflow", () => {
    const definition: WorkflowDefinition = {
      nodes: [],
      edges: [],
    };

    const result = validateDefinition(definition);

    expect(result.valid).toBe(true);
  });

  it("should reject null definition", () => {
    const result = validateDefinition(null as unknown as WorkflowDefinition);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: ValidationErrorCodes.EMPTY_DEFINITION }),
    );
  });

  it("should reject non-array nodes", () => {
    const definition = {
      nodes: "not an array",
      edges: [],
    } as unknown as WorkflowDefinition;

    const result = validateDefinition(definition);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: ValidationErrorCodes.INVALID_NODE_STRUCTURE }),
    );
  });

  it("should reject non-array edges", () => {
    const definition = {
      nodes: [],
      edges: "not an array",
    } as unknown as WorkflowDefinition;

    const result = validateDefinition(definition);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: ValidationErrorCodes.INVALID_EDGE_STRUCTURE }),
    );
  });
});

// =============================================================================
// NODE VALIDATION TESTS
// =============================================================================

describe("validateDefinition - Node Validation", () => {
  it("should reject node without id", () => {
    const definition: WorkflowDefinition = {
      nodes: [
        {
          type: "trigger",
          position: { x: 0, y: 0 },
          data: { config: {} },
        } as unknown as WorkflowNode,
      ],
      edges: [],
    };

    const result = validateDefinition(definition);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: ValidationErrorCodes.INVALID_NODE_STRUCTURE }),
    );
  });

  it("should reject node with invalid type", () => {
    const definition: WorkflowDefinition = {
      nodes: [
        {
          id: "node-1",
          type: "invalid" as any,
          position: { x: 0, y: 0 },
          data: { config: {} },
        },
      ],
      edges: [],
    };

    const result = validateDefinition(definition);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: ValidationErrorCodes.INVALID_NODE_TYPE }),
    );
  });

  it("should reject node without position", () => {
    const definition: WorkflowDefinition = {
      nodes: [{ id: "node-1", type: "trigger", data: { config: {} } } as unknown as WorkflowNode],
      edges: [],
    };

    const result = validateDefinition(definition);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: ValidationErrorCodes.INVALID_NODE_STRUCTURE,
        path: expect.stringContaining("position"),
      }),
    );
  });

  it("should reject node without data.config", () => {
    const definition: WorkflowDefinition = {
      nodes: [
        {
          id: "node-1",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: {},
        } as unknown as WorkflowNode,
      ],
      edges: [],
    };

    const result = validateDefinition(definition);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: ValidationErrorCodes.INVALID_NODE_STRUCTURE }),
    );
  });

  it("should reject duplicate node IDs", () => {
    const definition: WorkflowDefinition = {
      nodes: [createTriggerNode("same-id"), createAgentNode("same-id")],
      edges: [],
    };

    const result = validateDefinition(definition);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: ValidationErrorCodes.DUPLICATE_NODE_ID }),
    );
  });
});

// =============================================================================
// EDGE VALIDATION TESTS
// =============================================================================

describe("validateDefinition - Edge Validation", () => {
  it("should reject edge without id", () => {
    const definition: WorkflowDefinition = {
      nodes: [createTriggerNode(), createAgentNode()],
      edges: [{ source: "trigger-1", target: "agent-1" } as any],
    };

    const result = validateDefinition(definition);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: ValidationErrorCodes.INVALID_EDGE_STRUCTURE }),
    );
  });

  it("should reject edge referencing non-existent source", () => {
    const definition: WorkflowDefinition = {
      nodes: [createTriggerNode(), createAgentNode()],
      edges: [{ id: "edge-1", source: "nonexistent", target: "agent-1" }],
    };

    const result = validateDefinition(definition);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: ValidationErrorCodes.DANGLING_EDGE }),
    );
  });

  it("should reject edge referencing non-existent target", () => {
    const definition: WorkflowDefinition = {
      nodes: [createTriggerNode(), createAgentNode()],
      edges: [{ id: "edge-1", source: "trigger-1", target: "nonexistent" }],
    };

    const result = validateDefinition(definition);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: ValidationErrorCodes.DANGLING_EDGE }),
    );
  });

  it("should reject duplicate edge IDs", () => {
    const definition: WorkflowDefinition = {
      nodes: [createTriggerNode(), createAgentNode("agent-1"), createAgentNode("agent-2")],
      edges: [
        { id: "same-id", source: "trigger-1", target: "agent-1" },
        { id: "same-id", source: "trigger-1", target: "agent-2" },
      ],
    };

    const result = validateDefinition(definition);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: ValidationErrorCodes.DUPLICATE_EDGE_ID }),
    );
  });
});

// =============================================================================
// GRAPH STRUCTURE TESTS
// =============================================================================

describe("validateDefinition - Graph Structure", () => {
  it("should require at least one trigger node", () => {
    const definition: WorkflowDefinition = {
      nodes: [createAgentNode()],
      edges: [],
    };

    const result = validateDefinition(definition);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: ValidationErrorCodes.MISSING_TRIGGER }),
    );
  });

  it("should reject multiple trigger nodes", () => {
    const definition: WorkflowDefinition = {
      nodes: [createTriggerNode("trigger-1"), createTriggerNode("trigger-2")],
      edges: [],
    };

    const result = validateDefinition(definition);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: ValidationErrorCodes.MULTIPLE_TRIGGERS }),
    );
  });

  it("should detect orphan nodes", () => {
    const definition: WorkflowDefinition = {
      nodes: [
        createTriggerNode(),
        createAgentNode("agent-1"),
        createAgentNode("agent-2"), // Orphan - no incoming edge
      ],
      edges: [{ id: "edge-1", source: "trigger-1", target: "agent-1" }],
    };

    const result = validateDefinition(definition);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: ValidationErrorCodes.ORPHAN_NODE,
        nodeId: "agent-2",
      }),
    );
  });

  it("should detect cycles in graph", () => {
    const definition: WorkflowDefinition = {
      nodes: [createTriggerNode(), createAgentNode("agent-1"), createAgentNode("agent-2")],
      edges: [
        { id: "e1", source: "trigger-1", target: "agent-1" },
        { id: "e2", source: "agent-1", target: "agent-2" },
        { id: "e3", source: "agent-2", target: "agent-1" }, // Creates cycle
      ],
    };

    const result = validateDefinition(definition);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: ValidationErrorCodes.CYCLE_DETECTED }),
    );
  });

  it("should detect self-loops", () => {
    const definition: WorkflowDefinition = {
      nodes: [createTriggerNode(), createAgentNode()],
      edges: [
        { id: "e1", source: "trigger-1", target: "agent-1" },
        { id: "e2", source: "agent-1", target: "agent-1" }, // Self-loop
      ],
    };

    const result = validateDefinition(definition);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: ValidationErrorCodes.CYCLE_DETECTED }),
    );
  });
});

// =============================================================================
// CONDITION NODE TESTS
// =============================================================================

describe("validateDefinition - Condition Nodes", () => {
  it("should require both branches for condition nodes with handles", () => {
    const definition: WorkflowDefinition = {
      nodes: [createTriggerNode(), createConditionNode("cond-1"), createAgentNode("agent-1")],
      edges: [
        { id: "e1", source: "trigger-1", target: "cond-1" },
        { id: "e2", source: "cond-1", target: "agent-1", sourceHandle: "true" },
        // Missing false branch
      ],
    };

    const result = validateDefinition(definition);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: ValidationErrorCodes.MISSING_CONDITION_BRANCHES }),
    );
  });

  it("should accept condition nodes with both branches", () => {
    const definition: WorkflowDefinition = {
      nodes: [
        createTriggerNode(),
        createConditionNode("cond-1"),
        createAgentNode("agent-true"),
        createAgentNode("agent-false"),
      ],
      edges: [
        { id: "e1", source: "trigger-1", target: "cond-1" },
        { id: "e2", source: "cond-1", target: "agent-true", sourceHandle: "true" },
        { id: "e3", source: "cond-1", target: "agent-false", sourceHandle: "false" },
      ],
    };

    const result = validateDefinition(definition);

    expect(result.valid).toBe(true);
  });

  it("should accept condition nodes with no branches (terminal condition)", () => {
    const definition: WorkflowDefinition = {
      nodes: [createTriggerNode(), createConditionNode("cond-1"), createAgentNode("agent-1")],
      edges: [
        { id: "e1", source: "trigger-1", target: "cond-1" },
        { id: "e2", source: "cond-1", target: "agent-1" }, // No sourceHandle
      ],
    };

    const result = validateDefinition(definition);

    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// NODE CONFIG VALIDATION TESTS
// =============================================================================

describe("validateNodeConfig", () => {
  it("should require prompt for agent node", () => {
    const node: WorkflowNode = {
      id: "agent-1",
      type: "agent",
      position: { x: 0, y: 0 },
      data: { label: "Agent", config: {} },
    };

    const errors = validateNodeConfig(node);

    expect(errors).toContainEqual(
      expect.objectContaining({ code: ValidationErrorCodes.MISSING_REQUIRED_CONFIG }),
    );
  });

  it("should validate agent temperature range", () => {
    const node: WorkflowNode = {
      id: "agent-1",
      type: "agent",
      position: { x: 0, y: 0 },
      data: { label: "Agent", config: { prompt: "test", temperature: 3 } },
    };

    const errors = validateNodeConfig(node);

    expect(errors).toContainEqual(
      expect.objectContaining({
        code: ValidationErrorCodes.INVALID_CONFIG_VALUE,
        path: expect.stringContaining("temperature"),
      }),
    );
  });

  it("should require toolName for tool node", () => {
    const node: WorkflowNode = {
      id: "tool-1",
      type: "tool",
      position: { x: 0, y: 0 },
      data: { label: "Tool", config: {} },
    };

    const errors = validateNodeConfig(node);

    expect(errors).toContainEqual(
      expect.objectContaining({
        code: ValidationErrorCodes.MISSING_REQUIRED_CONFIG,
        path: expect.stringContaining("toolName"),
      }),
    );
  });

  it("should require expression for condition node", () => {
    const node: WorkflowNode = {
      id: "cond-1",
      type: "condition",
      position: { x: 0, y: 0 },
      data: { label: "Condition", config: {} },
    };

    const errors = validateNodeConfig(node);

    expect(errors).toContainEqual(
      expect.objectContaining({
        code: ValidationErrorCodes.MISSING_REQUIRED_CONFIG,
        path: expect.stringContaining("expression"),
      }),
    );
  });

  it("should validate communication node method", () => {
    const node: WorkflowNode = {
      id: "comm-1",
      type: "communication",
      position: { x: 0, y: 0 },
      data: { label: "Send", config: { method: "invalid", body: "test" } },
    };

    const errors = validateNodeConfig(node);

    expect(errors).toContainEqual(
      expect.objectContaining({ code: ValidationErrorCodes.MISSING_REQUIRED_CONFIG }),
    );
  });

  it("should require to for email communication", () => {
    const node: WorkflowNode = {
      id: "comm-1",
      type: "communication",
      position: { x: 0, y: 0 },
      data: { label: "Send", config: { method: "email", body: "test" } },
    };

    const errors = validateNodeConfig(node);

    expect(errors).toContainEqual(
      expect.objectContaining({
        code: ValidationErrorCodes.MISSING_REQUIRED_CONFIG,
        path: expect.stringContaining("to"),
      }),
    );
  });

  it("should validate cron expression for trigger", () => {
    const node: WorkflowNode = {
      id: "trigger-1",
      type: "trigger",
      position: { x: 0, y: 0 },
      data: {
        label: "Cron",
        config: { triggerType: "CRON", cronExpression: "invalid cron" },
      },
    };

    const errors = validateNodeConfig(node);

    expect(errors).toContainEqual(
      expect.objectContaining({
        code: ValidationErrorCodes.INVALID_CONFIG_VALUE,
        path: expect.stringContaining("cronExpression"),
      }),
    );
  });

  it("should accept valid cron expression", () => {
    const node: WorkflowNode = {
      id: "trigger-1",
      type: "trigger",
      position: { x: 0, y: 0 },
      data: {
        label: "Cron",
        config: { triggerType: "CRON", cronExpression: "0 9 * * 1" },
      },
    };

    const errors = validateNodeConfig(node);

    expect(errors).toHaveLength(0);
  });
});

// =============================================================================
// VARIABLE REFERENCE TESTS
// =============================================================================

describe("extractVariableReferences", () => {
  it("should extract simple variable references", () => {
    const refs = extractVariableReferences("Hello {{inputs.name}}!");

    expect(refs).toEqual(["inputs.name"]);
  });

  it("should extract multiple references", () => {
    const refs = extractVariableReferences(
      "{{inputs.a}} and {{nodes.agent.result}} and {{globalVariables.x}}",
    );

    expect(refs).toEqual(["inputs.a", "nodes.agent.result", "globalVariables.x"]);
  });

  it("should handle nested references", () => {
    const refs = extractVariableReferences("{{nodes.query.data.rows[0].name}}");

    expect(refs).toEqual(["nodes.query.data.rows[0].name"]);
  });

  it("should return empty array for no references", () => {
    const refs = extractVariableReferences("No variables here");

    expect(refs).toEqual([]);
  });
});

describe("validateVariableReferences", () => {
  it("should detect invalid variable prefix", () => {
    const definition: WorkflowDefinition = {
      nodes: [
        createTriggerNode(),
        {
          id: "agent-1",
          type: "agent",
          position: { x: 0, y: 0 },
          data: {
            label: "Agent",
            config: { prompt: "{{invalid.prefix}}" },
          },
        },
      ],
      edges: [{ id: "e1", source: "trigger-1", target: "agent-1" }],
    };

    const errors = validateVariableReferences(definition);

    expect(errors).toContainEqual(
      expect.objectContaining({ code: ValidationErrorCodes.INVALID_VARIABLE_REFERENCE }),
    );
  });

  it("should detect reference to non-existent node", () => {
    const definition: WorkflowDefinition = {
      nodes: [
        createTriggerNode(),
        {
          id: "agent-1",
          type: "agent",
          position: { x: 0, y: 0 },
          data: {
            label: "Agent",
            config: { prompt: "{{nodes.nonexistent.result}}" },
          },
        },
      ],
      edges: [{ id: "e1", source: "trigger-1", target: "agent-1" }],
    };

    const errors = validateVariableReferences(definition);

    expect(errors).toContainEqual(
      expect.objectContaining({
        code: ValidationErrorCodes.INVALID_VARIABLE_REFERENCE,
        message: expect.stringContaining("nonexistent"),
      }),
    );
  });

  it("should accept valid variable references", () => {
    const definition: WorkflowDefinition = {
      nodes: [
        createTriggerNode(),
        createAgentNode("agent-1", { prompt: "{{inputs.name}}" }),
        {
          id: "agent-2",
          type: "agent",
          position: { x: 400, y: 0 },
          data: {
            label: "Agent 2",
            config: { prompt: "Previous result: {{nodes.agent-1.result}}" },
          },
        },
      ],
      edges: [
        { id: "e1", source: "trigger-1", target: "agent-1" },
        { id: "e2", source: "agent-1", target: "agent-2" },
      ],
    };

    const errors = validateVariableReferences(definition);

    expect(errors).toHaveLength(0);
  });
});

// =============================================================================
// WARNINGS TESTS
// =============================================================================

describe("validateDefinition - Warnings", () => {
  it("should warn about large workflows", () => {
    // Create a workflow with 51 nodes
    const nodes: WorkflowNode[] = [createTriggerNode()];
    const edges = [];

    for (let i = 1; i <= 50; i++) {
      nodes.push(createAgentNode(`agent-${i}`));
      edges.push({
        id: `edge-${i}`,
        source: i === 1 ? "trigger-1" : `agent-${i - 1}`,
        target: `agent-${i}`,
      });
    }

    const definition: WorkflowDefinition = { nodes, edges };

    const result = validateDefinition(definition);

    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: "LARGE_WORKFLOW",
        message: expect.stringContaining("51 nodes"),
      }),
    );
  });
});
