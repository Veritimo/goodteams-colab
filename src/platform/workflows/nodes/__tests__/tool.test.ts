/**
 * Tool Node Executor Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ToolRegistry, ToolDefinition, ExecutionContext, ToolNodeConfig } from "../types.js";
import {
  executeToolNode,
  resolveArgsVariables,
  validateToolConfig,
  setDefaultToolRegistry,
  getToolRegistry,
  createToolRegistry,
} from "../tool.js";
import { NodeExecutionError } from "../types.js";

// Helper to create execution context
function createContext(overrides?: Partial<ExecutionContext>): ExecutionContext {
  return {
    inputs: {},
    nodeOutputs: {},
    globalVariables: {},
    ...overrides,
  };
}

// Create mock tool
function createMockTool(name: string, result: unknown = { success: true }): ToolDefinition {
  return {
    name,
    description: `Mock tool: ${name}`,
    execute: vi.fn().mockResolvedValue(result),
  };
}

describe("Tool Node Executor", () => {
  let originalRegistry: ToolRegistry | undefined;

  beforeEach(() => {
    originalRegistry = getToolRegistry();
  });

  afterEach(() => {
    if (originalRegistry) {
      setDefaultToolRegistry(originalRegistry);
    }
  });

  describe("executeToolNode", () => {
    it("should execute a tool by name", async () => {
      const mockTool = createMockTool("test_tool", { data: "result" });
      const registry = createToolRegistry([mockTool]);

      const config: ToolNodeConfig = {
        toolName: "test_tool",
        param1: "value1",
      };
      const context = createContext();

      const result = await executeToolNode(config, context, registry);

      expect(result).toEqual({ data: "result" });
      expect(mockTool.execute).toHaveBeenCalledWith({ param1: "value1" }, context);
    });

    it("should resolve variables in tool arguments", async () => {
      const mockTool = createMockTool("sql_query");
      const registry = createToolRegistry([mockTool]);

      const config: ToolNodeConfig = {
        toolName: "sql_query",
        query: "SELECT * FROM users WHERE region = '{{inputs.region}}'",
      };
      const context = createContext({
        inputs: { region: "West" },
      });

      await executeToolNode(config, context, registry);

      expect(mockTool.execute).toHaveBeenCalledWith(
        { query: "SELECT * FROM users WHERE region = 'West'" },
        context,
      );
    });

    it("should resolve variables from node outputs", async () => {
      const mockTool = createMockTool("send_email");
      const registry = createToolRegistry([mockTool]);

      const config: ToolNodeConfig = {
        toolName: "send_email",
        body: "Report: {{nodes.report.summary}}",
      };
      const context = createContext({
        nodeOutputs: { report: { summary: "All systems operational" } },
      });

      await executeToolNode(config, context, registry);

      expect(mockTool.execute).toHaveBeenCalledWith(
        { body: "Report: All systems operational" },
        context,
      );
    });

    it("should preserve type for single variable reference", async () => {
      const mockTool = createMockTool("process_data");
      const registry = createToolRegistry([mockTool]);

      const config: ToolNodeConfig = {
        toolName: "process_data",
        data: "{{inputs.items}}", // Should return array, not string
      };
      const context = createContext({
        inputs: { items: [1, 2, 3] },
      });

      await executeToolNode(config, context, registry);

      expect(mockTool.execute).toHaveBeenCalledWith({ data: [1, 2, 3] }, context);
    });

    it("should throw error when tool not found", async () => {
      const registry = createToolRegistry([]);

      const config: ToolNodeConfig = {
        toolName: "nonexistent_tool",
      };
      const context = createContext();

      await expect(executeToolNode(config, context, registry)).rejects.toThrow(
        "Tool 'nonexistent_tool' not found",
      );
    });

    it("should throw error when toolName is missing", async () => {
      const registry = createToolRegistry([]);
      const config = {} as ToolNodeConfig;
      const context = createContext();

      await expect(executeToolNode(config, context, registry)).rejects.toThrow(
        "Missing 'toolName' in configuration",
      );
    });

    it("should throw error when registry not configured", async () => {
      const config: ToolNodeConfig = { toolName: "test" };
      const context = createContext();

      await expect(executeToolNode(config, context)).rejects.toThrow(
        "Tool registry not configured",
      );
    });

    it("should handle tool execution errors", async () => {
      const mockTool: ToolDefinition = {
        name: "failing_tool",
        execute: vi.fn().mockRejectedValue(new Error("Database connection failed")),
      };
      const registry = createToolRegistry([mockTool]);

      const config: ToolNodeConfig = { toolName: "failing_tool" };
      const context = createContext();

      await expect(executeToolNode(config, context, registry)).rejects.toThrow(
        "Tool 'failing_tool' execution failed: Database connection failed",
      );
    });

    it("should use default registry when set", async () => {
      const mockTool = createMockTool("default_tool", { default: true });
      const registry = createToolRegistry([mockTool]);
      setDefaultToolRegistry(registry);

      const config: ToolNodeConfig = { toolName: "default_tool" };
      const context = createContext();

      const result = await executeToolNode(config, context);

      expect(result).toEqual({ default: true });
    });
  });

  describe("resolveArgsVariables", () => {
    it("should resolve nested object variables", () => {
      const args = {
        nested: {
          value: "{{inputs.name}}",
        },
      };
      const context = createContext({ inputs: { name: "John" } });

      const result = resolveArgsVariables(args, context);

      expect(result).toEqual({ nested: { value: "John" } });
    });

    it("should resolve array variables", () => {
      const args = {
        items: ["{{inputs.a}}", "{{inputs.b}}"],
      };
      const context = createContext({ inputs: { a: "first", b: "second" } });

      const result = resolveArgsVariables(args, context);

      expect(result).toEqual({ items: ["first", "second"] });
    });

    it("should skip label field", () => {
      const args = {
        label: "Do Not Resolve {{this}}",
        actual: "{{inputs.val}}",
      };
      const context = createContext({ inputs: { val: "value" } });

      const result = resolveArgsVariables(args, context);

      expect(result).toEqual({ actual: "value" });
      expect(result).not.toHaveProperty("label");
    });

    it("should handle null and undefined values", () => {
      const args = {
        nullVal: null,
        undefinedVal: undefined,
        normalVal: "test",
      };
      const context = createContext();

      const result = resolveArgsVariables(args, context);

      expect(result.nullVal).toBeNull();
      expect(result.undefinedVal).toBeUndefined();
      expect(result.normalVal).toBe("test");
    });
  });

  describe("createToolRegistry", () => {
    it("should create empty registry", () => {
      const registry = createToolRegistry();

      expect(registry.listTools()).toEqual([]);
      expect(registry.hasTool("test")).toBe(false);
    });

    it("should create registry with tools", () => {
      const tools = [createMockTool("tool1"), createMockTool("tool2")];
      const registry = createToolRegistry(tools);

      expect(registry.listTools()).toEqual(["tool1", "tool2"]);
      expect(registry.hasTool("tool1")).toBe(true);
      expect(registry.hasTool("tool2")).toBe(true);
      expect(registry.hasTool("tool3")).toBe(false);
    });

    it("should retrieve tool by name", () => {
      const tool = createMockTool("my_tool");
      const registry = createToolRegistry([tool]);

      const retrieved = registry.getTool("my_tool");

      expect(retrieved).toBe(tool);
    });

    it("should return undefined for missing tool", () => {
      const registry = createToolRegistry([]);

      expect(registry.getTool("missing")).toBeUndefined();
    });
  });

  describe("validateToolConfig", () => {
    it("should return empty array for valid config", () => {
      const config: ToolNodeConfig = { toolName: "test_tool" };
      expect(validateToolConfig(config)).toEqual([]);
    });

    it("should require toolName", () => {
      const config = {} as ToolNodeConfig;
      expect(validateToolConfig(config)).toContain("toolName is required");
    });

    it("should validate tool exists in registry when provided", () => {
      const registry = createToolRegistry([createMockTool("existing")]);
      const config: ToolNodeConfig = { toolName: "nonexistent" };

      expect(validateToolConfig(config, registry)).toContain(
        "Tool 'nonexistent' not found in registry",
      );
    });

    it("should pass validation when tool exists", () => {
      const registry = createToolRegistry([createMockTool("existing")]);
      const config: ToolNodeConfig = { toolName: "existing" };

      expect(validateToolConfig(config, registry)).toEqual([]);
    });
  });
});
