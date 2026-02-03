/**
 * Agent Node Executor Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { LLMClient, ExecutionContext, AgentNodeConfig } from "../types.js";
import {
  executeAgentNode,
  resolveVariables,
  validateAgentConfig,
  setDefaultLLMClient,
  getLLMClient,
} from "../agent.js";
import { NodeExecutionError } from "../types.js";

// Mock LLM Client
function createMockLLMClient(
  overrides?: Partial<ReturnType<LLMClient["generateText"]>>,
): LLMClient {
  return {
    generateText: vi.fn().mockResolvedValue({
      text: "Mock response",
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      ...overrides,
    }),
  };
}

// Helper to create execution context
function createContext(overrides?: Partial<ExecutionContext>): ExecutionContext {
  return {
    inputs: {},
    nodeOutputs: {},
    globalVariables: {},
    ...overrides,
  };
}

describe("Agent Node Executor", () => {
  let originalClient: LLMClient | undefined;

  beforeEach(() => {
    originalClient = getLLMClient();
  });

  afterEach(() => {
    if (originalClient) {
      setDefaultLLMClient(originalClient);
    }
  });

  describe("executeAgentNode", () => {
    it("should execute with basic prompt", async () => {
      const mockClient = createMockLLMClient();
      const config: AgentNodeConfig = {
        prompt: "Hello, world!",
      };
      const context = createContext();

      const result = await executeAgentNode(config, context, mockClient);

      expect(result.text).toBe("Mock response");
      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      });
      expect(mockClient.generateText).toHaveBeenCalledTimes(1);
    });

    it("should include system prompt with anti-hallucination rules", async () => {
      const mockClient = createMockLLMClient();
      const config: AgentNodeConfig = {
        prompt: "Test prompt",
        systemPrompt: "You are a helpful assistant",
      };
      const context = createContext();

      await executeAgentNode(config, context, mockClient);

      const call = (mockClient.generateText as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.systemPrompt).toContain("You are a helpful assistant");
      expect(call.systemPrompt).toContain("NEVER make up, fabricate, or hallucinate");
    });

    it("should pass model configuration", async () => {
      const mockClient = createMockLLMClient();
      const config: AgentNodeConfig = {
        prompt: "Test",
        model: "claude-opus-4-20250514",
        temperature: 0.5,
        maxTokens: 1000,
      };
      const context = createContext();

      await executeAgentNode(config, context, mockClient);

      const call = (mockClient.generateText as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.model).toBe("claude-opus-4-20250514");
      expect(call.temperature).toBe(0.5);
      expect(call.maxTokens).toBe(1000);
    });

    it("should use default model when not specified", async () => {
      const mockClient = createMockLLMClient();
      const config: AgentNodeConfig = { prompt: "Test" };
      const context = createContext();

      await executeAgentNode(config, context, mockClient);

      const call = (mockClient.generateText as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.model).toBe("claude-sonnet-4-20250514");
    });

    it("should pass tools array to LLM client", async () => {
      const mockClient = createMockLLMClient();
      const config: AgentNodeConfig = {
        prompt: "Test",
        tools: ["web_search", "calculator"],
      };
      const context = createContext();

      await executeAgentNode(config, context, mockClient);

      const call = (mockClient.generateText as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.tools).toEqual(["web_search", "calculator"]);
    });

    it("should return tool calls from LLM response", async () => {
      const mockClient = createMockLLMClient({
        toolCalls: [{ name: "web_search", args: { query: "test" }, result: { data: "result" } }],
      } as any);
      const config: AgentNodeConfig = {
        prompt: "Search for test",
        tools: ["web_search"],
      };
      const context = createContext();

      const result = await executeAgentNode(config, context, mockClient);

      expect(result.toolCalls).toEqual([
        { name: "web_search", args: { query: "test" }, result: { data: "result" } },
      ]);
    });

    it("should throw error when LLM client not configured", async () => {
      const config: AgentNodeConfig = { prompt: "Test" };
      const context = createContext();

      await expect(executeAgentNode(config, context)).rejects.toThrow(NodeExecutionError);
      await expect(executeAgentNode(config, context)).rejects.toThrow("LLM client not configured");
    });

    it("should throw error when prompt is missing", async () => {
      const mockClient = createMockLLMClient();
      const config = {} as AgentNodeConfig;
      const context = createContext();

      await expect(executeAgentNode(config, context, mockClient)).rejects.toThrow(
        "Missing 'prompt' in configuration",
      );
    });

    it("should handle LLM errors gracefully", async () => {
      const mockClient: LLMClient = {
        generateText: vi.fn().mockRejectedValue(new Error("API rate limit exceeded")),
      };
      const config: AgentNodeConfig = { prompt: "Test" };
      const context = createContext();

      await expect(executeAgentNode(config, context, mockClient)).rejects.toThrow(
        "LLM call failed: API rate limit exceeded",
      );
    });

    it("should use default client when set", async () => {
      const mockClient = createMockLLMClient();
      setDefaultLLMClient(mockClient);

      const config: AgentNodeConfig = { prompt: "Test" };
      const context = createContext();

      const result = await executeAgentNode(config, context);

      expect(result.text).toBe("Mock response");
      expect(mockClient.generateText).toHaveBeenCalled();
    });
  });

  describe("resolveVariables", () => {
    it("should resolve input variables", () => {
      const template = "Hello, {{inputs.name}}!";
      const context = createContext({
        inputs: { name: "World" },
      });

      const result = resolveVariables(template, context);

      expect(result).toBe("Hello, World!");
    });

    it("should resolve node output variables", () => {
      const template = "Result: {{nodes.query.data}}";
      const context = createContext({
        nodeOutputs: { query: { data: "test data" } },
      });

      const result = resolveVariables(template, context);

      expect(result).toBe("Result: test data");
    });

    it("should resolve global variables", () => {
      const template = "Org: {{globals.orgName}}";
      const context = createContext({
        globalVariables: { orgName: "Acme Corp" },
      });

      const result = resolveVariables(template, context);

      expect(result).toBe("Org: Acme Corp");
    });

    it("should resolve nested paths", () => {
      const template = "User: {{nodes.fetch.data.user.name}}";
      const context = createContext({
        nodeOutputs: {
          fetch: { data: { user: { name: "John" } } },
        },
      });

      const result = resolveVariables(template, context);

      expect(result).toBe("User: John");
    });

    it("should handle missing variables gracefully", () => {
      const template = "Value: {{inputs.missing}}";
      const context = createContext();

      const result = resolveVariables(template, context);

      expect(result).toBe("Value: {{inputs.missing}}");
    });

    it("should convert objects to JSON", () => {
      const template = "Data: {{inputs.obj}}";
      const context = createContext({
        inputs: { obj: { a: 1, b: 2 } },
      });

      const result = resolveVariables(template, context);

      expect(result).toBe('Data: {"a":1,"b":2}');
    });

    it("should resolve unprefixed variables from inputs", () => {
      const template = "Hello, {{name}}!";
      const context = createContext({
        inputs: { name: "World" },
      });

      const result = resolveVariables(template, context);

      expect(result).toBe("Hello, World!");
    });

    it("should resolve multiple variables in one string", () => {
      const template = "{{greeting}}, {{name}}!";
      const context = createContext({
        inputs: { greeting: "Hello", name: "World" },
      });

      const result = resolveVariables(template, context);

      expect(result).toBe("Hello, World!");
    });
  });

  describe("validateAgentConfig", () => {
    it("should return empty array for valid config", () => {
      const config: AgentNodeConfig = { prompt: "Test prompt" };
      expect(validateAgentConfig(config)).toEqual([]);
    });

    it("should require prompt", () => {
      const config = {} as AgentNodeConfig;
      expect(validateAgentConfig(config)).toContain("Prompt is required");
    });

    it("should validate temperature range", () => {
      expect(validateAgentConfig({ prompt: "Test", temperature: -1 })).toContain(
        "Temperature must be between 0 and 2",
      );
      expect(validateAgentConfig({ prompt: "Test", temperature: 3 })).toContain(
        "Temperature must be between 0 and 2",
      );
      expect(validateAgentConfig({ prompt: "Test", temperature: 1.5 })).toEqual([]);
    });

    it("should validate maxTokens range", () => {
      expect(validateAgentConfig({ prompt: "Test", maxTokens: 0 })).toContain(
        "maxTokens must be between 1 and 100000",
      );
      expect(validateAgentConfig({ prompt: "Test", maxTokens: 200000 })).toContain(
        "maxTokens must be between 1 and 100000",
      );
      expect(validateAgentConfig({ prompt: "Test", maxTokens: 4096 })).toEqual([]);
    });

    it("should validate tools is an array", () => {
      expect(validateAgentConfig({ prompt: "Test", tools: "invalid" as any })).toContain(
        "tools must be an array of tool names",
      );
      expect(validateAgentConfig({ prompt: "Test", tools: ["valid"] })).toEqual([]);
    });
  });
});
