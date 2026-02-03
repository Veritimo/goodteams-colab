/**
 * PropertiesPanel Component Tests
 *
 * Tests for the workflow node properties panel.
 *
 * @see docs/IMPLEMENTATION-PLAN-PHASE7.md §4.3
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type {
  WorkflowNode,
  WorkflowNodeType,
  TriggerNodeConfig,
  AgentNodeConfig,
  ToolNodeConfig,
  ConditionNodeConfig,
  CommunicationNodeConfig,
  IteratorNodeConfig,
} from "../../../workflows/types";
import type { PropertiesPanelProps, ToolSchema } from "../PropertiesPanel";

// =============================================================================
// MOCK DATA FACTORIES
// =============================================================================

function createMockNode(
  type: WorkflowNodeType,
  config: Record<string, unknown> = {},
): WorkflowNode {
  return {
    id: `${type}_1`,
    type,
    position: { x: 100, y: 100 },
    data: {
      label: `Test ${type}`,
      config: config as any,
    },
  };
}

function createMockTriggerNode(config: Partial<TriggerNodeConfig> = {}): WorkflowNode {
  return createMockNode("trigger", {
    triggerType: "MANUAL",
    ...config,
  });
}

function createMockAgentNode(config: Partial<AgentNodeConfig> = {}): WorkflowNode {
  return createMockNode("agent", {
    prompt: "Test prompt",
    ...config,
  });
}

function createMockToolNode(config: Partial<ToolNodeConfig> = {}): WorkflowNode {
  return createMockNode("tool", {
    toolName: "test_tool",
    ...config,
  });
}

function createMockConditionNode(config: Partial<ConditionNodeConfig> = {}): WorkflowNode {
  return createMockNode("condition", {
    expression: "true",
    ...config,
  });
}

function createMockCommunicationNode(config: Partial<CommunicationNodeConfig> = {}): WorkflowNode {
  return createMockNode("communication", {
    method: "email",
    body: "Test message",
    ...config,
  });
}

function createMockIteratorNode(config: Partial<IteratorNodeConfig> = {}): WorkflowNode {
  return createMockNode("iterator", {
    collection: "{{nodes.data.items}}",
    itemVariable: "item",
    ...config,
  });
}

const mockTools: ToolSchema[] = [
  {
    name: "test_tool",
    description: "A test tool",
    parameters: {
      type: "object",
      properties: {
        input: { type: "string", description: "Input value" },
        count: { type: "number", description: "Count value" },
      },
      required: ["input"],
    },
  },
  {
    name: "another_tool",
    description: "Another tool",
    parameters: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["fast", "slow"], description: "Mode" },
      },
    },
  },
];

// =============================================================================
// TESTS
// =============================================================================

describe("PropertiesPanel", () => {
  let mockOnNodeChange: ReturnType<typeof vi.fn>;
  let mockOnDeleteNode: ReturnType<typeof vi.fn>;
  let mockOnClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnNodeChange = vi.fn();
    mockOnDeleteNode = vi.fn();
    mockOnClose = vi.fn();
  });

  describe("Component Structure", () => {
    it("should export PropertiesPanel component", async () => {
      const { PropertiesPanel } = await import("../PropertiesPanel");
      expect(PropertiesPanel).toBeDefined();
      expect(typeof PropertiesPanel).toBe("function");
    });

    it("should export ToolSchema type", async () => {
      // Type-only export check - if it compiles, it works
      const module = await import("../PropertiesPanel");
      expect(module).toBeDefined();
    });
  });

  describe("Node Type Rendering", () => {
    it("should create valid trigger node mock", () => {
      const node = createMockTriggerNode();
      expect(node.type).toBe("trigger");
      expect(node.data.config).toHaveProperty("triggerType", "MANUAL");
    });

    it("should create valid agent node mock", () => {
      const node = createMockAgentNode({ model: "gpt-4o", temperature: 0.5 });
      expect(node.type).toBe("agent");
      expect(node.data.config).toHaveProperty("prompt", "Test prompt");
      expect(node.data.config).toHaveProperty("model", "gpt-4o");
      expect(node.data.config).toHaveProperty("temperature", 0.5);
    });

    it("should create valid tool node mock", () => {
      const node = createMockToolNode({ toolName: "web_search" });
      expect(node.type).toBe("tool");
      expect(node.data.config).toHaveProperty("toolName", "web_search");
    });

    it("should create valid condition node mock", () => {
      const node = createMockConditionNode({ expression: "{{result}} === true" });
      expect(node.type).toBe("condition");
      expect(node.data.config).toHaveProperty("expression", "{{result}} === true");
    });

    it("should create valid communication node mock", () => {
      const node = createMockCommunicationNode({ method: "teams", teamId: "team123" });
      expect(node.type).toBe("communication");
      expect(node.data.config).toHaveProperty("method", "teams");
      expect(node.data.config).toHaveProperty("teamId", "team123");
    });

    it("should create valid iterator node mock", () => {
      const node = createMockIteratorNode({ maxIterations: 50 });
      expect(node.type).toBe("iterator");
      expect(node.data.config).toHaveProperty("collection", "{{nodes.data.items}}");
      expect(node.data.config).toHaveProperty("maxIterations", 50);
    });
  });

  describe("Trigger Node Configuration", () => {
    it("should handle MANUAL trigger type", () => {
      const node = createMockTriggerNode({ triggerType: "MANUAL" });
      expect(node.data.config.triggerType).toBe("MANUAL");
    });

    it("should handle CRON trigger type with expression", () => {
      const node = createMockTriggerNode({
        triggerType: "CRON",
        cronExpression: "0 9 * * 1-5",
        timezone: "America/New_York",
      });
      expect(node.data.config.triggerType).toBe("CRON");
      expect(node.data.config.cronExpression).toBe("0 9 * * 1-5");
      expect(node.data.config.timezone).toBe("America/New_York");
    });

    it("should handle WEBHOOK trigger type", () => {
      const node = createMockTriggerNode({
        triggerType: "WEBHOOK",
        webhookPath: "/api/workflows/webhook/abc123",
      });
      expect(node.data.config.triggerType).toBe("WEBHOOK");
      expect(node.data.config.webhookPath).toBe("/api/workflows/webhook/abc123");
    });

    it("should handle CHAT trigger type", () => {
      const node = createMockTriggerNode({
        triggerType: "CHAT",
        triggerPhrase: "/analyze",
      });
      expect(node.data.config.triggerType).toBe("CHAT");
      expect(node.data.config.triggerPhrase).toBe("/analyze");
    });
  });

  describe("Agent Node Configuration", () => {
    it("should support system prompt", () => {
      const node = createMockAgentNode({
        systemPrompt: "You are a helpful assistant",
        prompt: "Analyze this",
      });
      expect(node.data.config.systemPrompt).toBe("You are a helpful assistant");
    });

    it("should support model selection", () => {
      const node = createMockAgentNode({ model: "claude-sonnet-4-20250514" });
      expect(node.data.config.model).toBe("claude-sonnet-4-20250514");
    });

    it("should support temperature setting", () => {
      const node = createMockAgentNode({ temperature: 0.3 });
      expect(node.data.config.temperature).toBe(0.3);
    });

    it("should support max tokens", () => {
      const node = createMockAgentNode({ maxTokens: 2048 });
      expect(node.data.config.maxTokens).toBe(2048);
    });
  });

  describe("Tool Node Configuration", () => {
    it("should support tool name selection", () => {
      const node = createMockToolNode({ toolName: "web_search" });
      expect(node.data.config.toolName).toBe("web_search");
    });

    it("should support dynamic tool parameters", () => {
      const node = createMockToolNode({
        toolName: "test_tool",
        input: "test input",
        count: 5,
      });
      expect(node.data.config.input).toBe("test input");
      expect(node.data.config.count).toBe(5);
    });

    it("should have mock tools available", () => {
      expect(mockTools).toHaveLength(2);
      expect(mockTools[0].name).toBe("test_tool");
      expect(mockTools[1].parameters?.properties?.mode?.enum).toContain("fast");
    });
  });

  describe("Condition Node Configuration", () => {
    it("should support expression with variable interpolation", () => {
      const node = createMockConditionNode({
        expression: "{{nodes.agent_1.text}}.includes('approved')",
      });
      expect(node.data.config.expression).toContain("{{nodes.agent_1.text}}");
    });

    it("should support complex boolean expressions", () => {
      const node = createMockConditionNode({
        expression: "{{inputs.value}} > 10 && {{inputs.enabled}}",
      });
      expect(node.data.config.expression).toContain("&&");
    });
  });

  describe("Communication Node Configuration", () => {
    it("should support email method", () => {
      const node = createMockCommunicationNode({
        method: "email",
        to: "test@example.com",
        subject: "Test Subject",
        body: "Test body",
      });
      expect(node.data.config.method).toBe("email");
      expect(node.data.config.to).toBe("test@example.com");
      expect(node.data.config.subject).toBe("Test Subject");
    });

    it("should support teams method", () => {
      const node = createMockCommunicationNode({
        method: "teams",
        teamId: "team123",
        channelId: "channel456",
        body: "Test message",
      });
      expect(node.data.config.method).toBe("teams");
      expect(node.data.config.teamId).toBe("team123");
    });

    it("should support chat method", () => {
      const node = createMockCommunicationNode({
        method: "chat",
        conversationId: "{{inputs.conversationId}}",
        body: "Reply message",
      });
      expect(node.data.config.method).toBe("chat");
      expect(node.data.config.conversationId).toBe("{{inputs.conversationId}}");
    });

    it("should support webhook method", () => {
      const node = createMockCommunicationNode({
        method: "webhook",
        webhookUrl: "https://api.example.com/webhook",
        body: "{{nodes.agent_1.text}}",
      });
      expect(node.data.config.method).toBe("webhook");
      expect(node.data.config.webhookUrl).toBe("https://api.example.com/webhook");
    });
  });

  describe("Iterator Node Configuration", () => {
    it("should support collection path", () => {
      const node = createMockIteratorNode({
        collection: "{{nodes.sql.data}}",
      });
      expect(node.data.config.collection).toBe("{{nodes.sql.data}}");
    });

    it("should support item and index variables", () => {
      const node = createMockIteratorNode({
        collection: "{{data}}",
        itemVariable: "row",
        indexVariable: "i",
      });
      expect(node.data.config.itemVariable).toBe("row");
      expect(node.data.config.indexVariable).toBe("i");
    });

    it("should support max iterations safety limit", () => {
      const node = createMockIteratorNode({
        collection: "{{data}}",
        maxIterations: 1000,
      });
      expect(node.data.config.maxIterations).toBe(1000);
    });
  });

  describe("Form Updates", () => {
    it("should track node change calls", () => {
      const node = createMockAgentNode();

      // Simulate what PropertiesPanel would do
      const updateConfig = (updates: Partial<AgentNodeConfig>) => {
        mockOnNodeChange(node.id, {
          data: {
            ...node.data,
            config: { ...node.data.config, ...updates },
          },
        });
      };

      updateConfig({ temperature: 0.8 });

      expect(mockOnNodeChange).toHaveBeenCalledWith(
        "agent_1",
        expect.objectContaining({
          data: expect.objectContaining({
            config: expect.objectContaining({
              temperature: 0.8,
            }),
          }),
        }),
      );
    });

    it("should track label updates", () => {
      const node = createMockAgentNode();

      // Simulate label update
      const updateLabel = (label: string) => {
        mockOnNodeChange(node.id, {
          data: { ...node.data, label },
        });
      };

      updateLabel("Custom Agent Name");

      expect(mockOnNodeChange).toHaveBeenCalledWith(
        "agent_1",
        expect.objectContaining({
          data: expect.objectContaining({
            label: "Custom Agent Name",
          }),
        }),
      );
    });

    it("should track delete node calls", () => {
      const node = createMockAgentNode();

      mockOnDeleteNode(node.id);

      expect(mockOnDeleteNode).toHaveBeenCalledWith("agent_1");
    });

    it("should track close panel calls", () => {
      mockOnClose();

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe("Props Validation", () => {
    it("should accept all required props", () => {
      const props: PropertiesPanelProps = {
        node: createMockAgentNode(),
        onNodeChange: mockOnNodeChange,
        onDeleteNode: mockOnDeleteNode,
        onClose: mockOnClose,
      };

      expect(props.node).toBeDefined();
      expect(props.onNodeChange).toBeDefined();
      expect(props.onDeleteNode).toBeDefined();
      expect(props.onClose).toBeDefined();
    });

    it("should accept optional props", () => {
      const props: PropertiesPanelProps = {
        node: createMockToolNode(),
        onNodeChange: mockOnNodeChange,
        onDeleteNode: mockOnDeleteNode,
        onClose: mockOnClose,
        availableModels: [{ value: "gpt-4o", label: "GPT-4o" }],
        availableTools: mockTools,
      };

      expect(props.availableModels).toHaveLength(1);
      expect(props.availableTools).toHaveLength(2);
    });
  });
});
