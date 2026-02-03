/**
 * Workflow Generator Tests
 *
 * Tests for LLM-based workflow generation.
 */

import { describe, it, expect, vi } from "vitest";
import {
  generateWorkflowFromPrompt,
  validateWorkflowDefinition,
  EXAMPLE_WORKFLOWS,
  type LLMProvider,
  type GeneratorContext,
} from "../workflow-generator.js";

// =============================================================================
// VALIDATION TESTS
// =============================================================================

describe("validateWorkflowDefinition", () => {
  it("should validate a correct definition", () => {
    const result = validateWorkflowDefinition(EXAMPLE_WORKFLOWS.simpleManual.definition);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject non-object definition", () => {
    const result = validateWorkflowDefinition("not an object");

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Definition must be an object");
  });

  it("should reject definition without nodes array", () => {
    const result = validateWorkflowDefinition({ edges: [] });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Definition must have a nodes array");
  });

  it("should reject definition without edges array", () => {
    const result = validateWorkflowDefinition({
      nodes: [{ id: "1", type: "trigger", position: { x: 0, y: 0 }, data: { config: {} } }],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Definition must have an edges array");
  });

  it("should reject node without id", () => {
    const result = validateWorkflowDefinition({
      nodes: [{ type: "trigger", position: { x: 0, y: 0 }, data: { config: {} } }],
      edges: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("must have a string id"))).toBe(true);
  });

  it("should reject node with invalid type", () => {
    const result = validateWorkflowDefinition({
      nodes: [
        {
          id: "1",
          type: "invalid_type",
          position: { x: 0, y: 0 },
          data: { config: {} },
        },
      ],
      edges: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("invalid type"))).toBe(true);
  });

  it("should reject duplicate node ids", () => {
    const result = validateWorkflowDefinition({
      nodes: [
        { id: "1", type: "trigger", position: { x: 0, y: 0 }, data: { config: {} } },
        { id: "1", type: "agent", position: { x: 100, y: 0 }, data: { config: {} } },
      ],
      edges: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Duplicate node id: 1");
  });

  it("should reject edge referencing non-existent source", () => {
    const result = validateWorkflowDefinition({
      nodes: [{ id: "1", type: "trigger", position: { x: 0, y: 0 }, data: { config: {} } }],
      edges: [{ id: "e1", source: "non-existent", target: "1" }],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("non-existent source"))).toBe(true);
  });

  it("should reject edge referencing non-existent target", () => {
    const result = validateWorkflowDefinition({
      nodes: [{ id: "1", type: "trigger", position: { x: 0, y: 0 }, data: { config: {} } }],
      edges: [{ id: "e1", source: "1", target: "non-existent" }],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("non-existent target"))).toBe(true);
  });

  it("should reject definition without trigger node", () => {
    const result = validateWorkflowDefinition({
      nodes: [{ id: "1", type: "agent", position: { x: 0, y: 0 }, data: { config: {} } }],
      edges: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Workflow must have at least one trigger node");
  });

  it("should validate complex workflow definition", () => {
    const result = validateWorkflowDefinition(EXAMPLE_WORKFLOWS.cronWithCondition.definition);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// =============================================================================
// GENERATOR TESTS
// =============================================================================

describe("generateWorkflowFromPrompt", () => {
  const mockContext: GeneratorContext = {
    tenantId: "tenant-1",
    userId: "user-1",
  };

  it("should generate workflow from simple prompt", async () => {
    const mockLLM: LLMProvider = {
      generateText: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          definition: EXAMPLE_WORKFLOWS.simpleManual.definition,
          triggerType: "MANUAL",
          triggerConfig: { triggerType: "MANUAL" },
          suggestedName: "Simple Workflow",
          confidence: 0.9,
          warnings: [],
        }),
      }),
    };

    const result = await generateWorkflowFromPrompt(
      "Create a simple workflow",
      mockContext,
      mockLLM,
    );

    expect(result.definition).toBeDefined();
    expect(result.triggerType).toBe("MANUAL");
    expect(result.confidence).toBe(0.9);
  });

  it("should handle JSON in markdown code blocks", async () => {
    const mockLLM: LLMProvider = {
      generateText: vi.fn().mockResolvedValue({
        text: `Here's the workflow:
\`\`\`json
${JSON.stringify({
  definition: EXAMPLE_WORKFLOWS.simpleManual.definition,
  triggerType: "MANUAL",
  triggerConfig: { triggerType: "MANUAL" },
  confidence: 0.8,
  warnings: [],
})}
\`\`\``,
      }),
    };

    const result = await generateWorkflowFromPrompt("Test", mockContext, mockLLM);

    expect(result.definition).toBeDefined();
    expect(result.confidence).toBe(0.8);
  });

  it("should throw error on invalid JSON response", async () => {
    const mockLLM: LLMProvider = {
      generateText: vi.fn().mockResolvedValue({
        text: "This is not JSON",
      }),
    };

    await expect(generateWorkflowFromPrompt("Test", mockContext, mockLLM)).rejects.toThrow(
      "Failed to parse LLM response as JSON",
    );
  });

  it("should throw error when definition is missing", async () => {
    const mockLLM: LLMProvider = {
      generateText: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          triggerType: "MANUAL",
          confidence: 0.5,
        }),
      }),
    };

    await expect(generateWorkflowFromPrompt("Test", mockContext, mockLLM)).rejects.toThrow(
      "missing 'definition' field",
    );
  });

  it("should throw error for invalid generated definition", async () => {
    const mockLLM: LLMProvider = {
      generateText: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          definition: { nodes: [], edges: [] }, // Missing trigger
          triggerType: "MANUAL",
          confidence: 0.5,
        }),
      }),
    };

    await expect(generateWorkflowFromPrompt("Test", mockContext, mockLLM)).rejects.toThrow(
      "Invalid workflow definition",
    );
  });

  it("should include available tools in prompt", async () => {
    const mockLLM: LLMProvider = {
      generateText: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          definition: EXAMPLE_WORKFLOWS.simpleManual.definition,
          triggerType: "MANUAL",
          triggerConfig: { triggerType: "MANUAL" },
          confidence: 0.9,
          warnings: [],
        }),
      }),
    };

    const contextWithTools: GeneratorContext = {
      ...mockContext,
      availableTools: ["execute_sql_query", "execute_crm_query"],
    };

    await generateWorkflowFromPrompt("Create workflow", contextWithTools, mockLLM);

    const callArgs = (mockLLM.generateText as any).mock.calls[0][0];
    expect(callArgs.userPrompt).toContain("execute_sql_query");
    expect(callArgs.userPrompt).toContain("execute_crm_query");
  });

  it("should include existing connections in prompt", async () => {
    const mockLLM: LLMProvider = {
      generateText: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          definition: EXAMPLE_WORKFLOWS.simpleManual.definition,
          triggerType: "MANUAL",
          triggerConfig: { triggerType: "MANUAL" },
          confidence: 0.9,
          warnings: [],
        }),
      }),
    };

    const contextWithConnections: GeneratorContext = {
      ...mockContext,
      existingConnections: [{ id: "conn-1", name: "Production DB", type: "SQL_SERVER" }],
    };

    await generateWorkflowFromPrompt("Create workflow", contextWithConnections, mockLLM);

    const callArgs = (mockLLM.generateText as any).mock.calls[0][0];
    expect(callArgs.userPrompt).toContain("Production DB");
    expect(callArgs.userPrompt).toContain("SQL_SERVER");
  });

  it("should default triggerType to MANUAL if not provided", async () => {
    const mockLLM: LLMProvider = {
      generateText: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          definition: EXAMPLE_WORKFLOWS.simpleManual.definition,
          confidence: 0.9,
          warnings: [],
        }),
      }),
    };

    const result = await generateWorkflowFromPrompt("Test", mockContext, mockLLM);

    expect(result.triggerType).toBe("MANUAL");
  });

  it("should extract warnings from response", async () => {
    const mockLLM: LLMProvider = {
      generateText: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          definition: EXAMPLE_WORKFLOWS.simpleManual.definition,
          triggerType: "MANUAL",
          triggerConfig: { triggerType: "MANUAL" },
          confidence: 0.7,
          warnings: ["Assumed daily schedule", "May need adjustment"],
        }),
      }),
    };

    const result = await generateWorkflowFromPrompt("Test", mockContext, mockLLM);

    expect(result.warnings).toHaveLength(2);
    expect(result.warnings).toContain("Assumed daily schedule");
  });
});

// =============================================================================
// EXAMPLE WORKFLOWS TESTS
// =============================================================================

describe("EXAMPLE_WORKFLOWS", () => {
  it("simpleManual should be valid", () => {
    const result = validateWorkflowDefinition(EXAMPLE_WORKFLOWS.simpleManual.definition);
    expect(result.valid).toBe(true);
  });

  it("cronWithCondition should be valid", () => {
    const result = validateWorkflowDefinition(EXAMPLE_WORKFLOWS.cronWithCondition.definition);
    expect(result.valid).toBe(true);
  });

  it("cronWithCondition should have condition with two output edges", () => {
    const { definition } = EXAMPLE_WORKFLOWS.cronWithCondition;
    const conditionNode = definition.nodes.find((n) => n.type === "condition");
    const conditionEdges = definition.edges.filter((e) => e.source === conditionNode?.id);

    expect(conditionEdges).toHaveLength(2);
    expect(conditionEdges.map((e) => e.sourceHandle).sort()).toEqual(["false", "true"]);
  });
});
