/**
 * Condition Node Executor Tests
 */

import { describe, it, expect } from "vitest";
import type { ExecutionContext, ConditionNodeConfig } from "../types.js";
import { executeConditionNode, evaluateExpression, validateConditionConfig } from "../condition.js";
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

describe("Condition Node Executor", () => {
  describe("executeConditionNode", () => {
    it("should evaluate simple comparison (greater than)", async () => {
      const config: ConditionNodeConfig = {
        expression: "{{inputs.count}} > 10",
      };
      const context = createContext({ inputs: { count: 15 } });

      const result = await executeConditionNode(config, context);

      expect(result.result).toBe(true);
      expect(result.nextHandle).toBe("true");
    });

    it("should return false handle when condition is false", async () => {
      const config: ConditionNodeConfig = {
        expression: "{{inputs.count}} > 10",
      };
      const context = createContext({ inputs: { count: 5 } });

      const result = await executeConditionNode(config, context);

      expect(result.result).toBe(false);
      expect(result.nextHandle).toBe("false");
    });

    it("should evaluate equality with strings", async () => {
      const config: ConditionNodeConfig = {
        expression: '{{inputs.status}} === "active"',
      };
      const context = createContext({ inputs: { status: "active" } });

      const result = await executeConditionNode(config, context);

      expect(result.result).toBe(true);
    });

    it("should evaluate node output values", async () => {
      const config: ConditionNodeConfig = {
        expression: "{{nodes.query.rowCount}} > 0",
      };
      const context = createContext({
        nodeOutputs: { query: { rowCount: 42 } },
      });

      const result = await executeConditionNode(config, context);

      expect(result.result).toBe(true);
    });

    it("should evaluate boolean AND expressions", async () => {
      const config: ConditionNodeConfig = {
        expression: "{{inputs.a}} > 5 && {{inputs.b}} < 20",
      };
      const context = createContext({ inputs: { a: 10, b: 15 } });

      const result = await executeConditionNode(config, context);

      expect(result.result).toBe(true);
    });

    it("should evaluate boolean OR expressions", async () => {
      const config: ConditionNodeConfig = {
        expression: "{{inputs.a}} > 100 || {{inputs.b}} < 20",
      };
      const context = createContext({ inputs: { a: 10, b: 15 } });

      const result = await executeConditionNode(config, context);

      expect(result.result).toBe(true);
    });

    it("should evaluate NOT expressions", async () => {
      const config: ConditionNodeConfig = {
        expression: "!{{inputs.disabled}}",
      };
      const context = createContext({ inputs: { disabled: false } });

      const result = await executeConditionNode(config, context);

      expect(result.result).toBe(true);
    });

    it("should throw error for missing expression", async () => {
      const config = {} as ConditionNodeConfig;
      const context = createContext();

      await expect(executeConditionNode(config, context)).rejects.toThrow(
        "Missing 'expression' in configuration",
      );
    });

    it("should include evaluated expression in output", async () => {
      const config: ConditionNodeConfig = {
        expression: "{{inputs.value}} === 42",
      };
      const context = createContext({ inputs: { value: 42 } });

      const result = await executeConditionNode(config, context);

      expect(result.evaluatedExpression).toBe("42 === 42");
    });
  });

  describe("evaluateExpression", () => {
    describe("comparison operators", () => {
      it("should evaluate ===", () => {
        expect(evaluateExpression("5 === 5")).toBe(true);
        expect(evaluateExpression("5 === 6")).toBe(false);
        expect(evaluateExpression('"hello" === "hello"')).toBe(true);
      });

      it("should evaluate !==", () => {
        expect(evaluateExpression("5 !== 6")).toBe(true);
        expect(evaluateExpression("5 !== 5")).toBe(false);
      });

      it("should evaluate ==", () => {
        expect(evaluateExpression("5 == 5")).toBe(true);
        expect(evaluateExpression("5 == 6")).toBe(false);
      });

      it("should evaluate !=", () => {
        expect(evaluateExpression("5 != 6")).toBe(true);
        expect(evaluateExpression("5 != 5")).toBe(false);
      });

      it("should evaluate >", () => {
        expect(evaluateExpression("10 > 5")).toBe(true);
        expect(evaluateExpression("5 > 10")).toBe(false);
      });

      it("should evaluate <", () => {
        expect(evaluateExpression("5 < 10")).toBe(true);
        expect(evaluateExpression("10 < 5")).toBe(false);
      });

      it("should evaluate >=", () => {
        expect(evaluateExpression("10 >= 10")).toBe(true);
        expect(evaluateExpression("10 >= 5")).toBe(true);
        expect(evaluateExpression("5 >= 10")).toBe(false);
      });

      it("should evaluate <=", () => {
        expect(evaluateExpression("10 <= 10")).toBe(true);
        expect(evaluateExpression("5 <= 10")).toBe(true);
        expect(evaluateExpression("10 <= 5")).toBe(false);
      });
    });

    describe("logical operators", () => {
      it("should evaluate &&", () => {
        expect(evaluateExpression("true && true")).toBe(true);
        expect(evaluateExpression("true && false")).toBe(false);
        expect(evaluateExpression("false && true")).toBe(false);
      });

      it("should evaluate ||", () => {
        expect(evaluateExpression("true || false")).toBe(true);
        expect(evaluateExpression("false || true")).toBe(true);
        expect(evaluateExpression("false || false")).toBe(false);
      });

      it("should evaluate !", () => {
        expect(evaluateExpression("!true")).toBe(false);
        expect(evaluateExpression("!false")).toBe(true);
        expect(evaluateExpression("!!true")).toBe(true);
      });
    });

    describe("arithmetic operators", () => {
      it("should evaluate +", () => {
        expect(evaluateExpression("5 + 3")).toBe(8);
      });

      it("should evaluate -", () => {
        expect(evaluateExpression("10 - 3")).toBe(7);
      });
    });

    describe("literals", () => {
      it("should evaluate numbers", () => {
        expect(evaluateExpression("42")).toBe(42);
        expect(evaluateExpression("3.14")).toBeCloseTo(3.14);
        expect(evaluateExpression("-5")).toBe(-5);
      });

      it("should evaluate strings", () => {
        expect(evaluateExpression('"hello"')).toBe("hello");
        expect(evaluateExpression("'world'")).toBe("world");
      });

      it("should evaluate booleans", () => {
        expect(evaluateExpression("true")).toBe(true);
        expect(evaluateExpression("false")).toBe(false);
      });

      it("should evaluate null", () => {
        expect(evaluateExpression("null")).toBe(null);
      });

      it("should evaluate undefined", () => {
        expect(evaluateExpression("undefined")).toBe(undefined);
      });
    });

    describe("parentheses", () => {
      it("should respect parentheses for grouping", () => {
        expect(evaluateExpression("(5 + 3) > 7")).toBe(true);
        expect(evaluateExpression("5 + 3 > 7")).toBe(true);
        expect(evaluateExpression("(true || false) && false")).toBe(false);
      });
    });

    describe("string operations", () => {
      // Note: Direct method calls on string literals (e.g., "hello".includes("world"))
      // are not supported in this safe expression evaluator.
      // Use variables resolved from context instead: {{inputs.str}}.includes("world")

      it("should compare strings with ===", () => {
        expect(evaluateExpression('"hello" === "hello"')).toBe(true);
        expect(evaluateExpression('"hello" === "world"')).toBe(false);
      });

      it("should compare strings with !==", () => {
        expect(evaluateExpression('"hello" !== "world"')).toBe(true);
        expect(evaluateExpression('"hello" !== "hello"')).toBe(false);
      });

      it("should concatenate strings with +", () => {
        expect(evaluateExpression('"hello" + " world"')).toBe("hello world");
      });
    });

    describe("array literals", () => {
      it("should evaluate array literals", () => {
        expect(evaluateExpression("[1, 2, 3]")).toEqual([1, 2, 3]);
        expect(evaluateExpression('["a", "b"]')).toEqual(["a", "b"]);
      });

      it("should evaluate empty arrays", () => {
        expect(evaluateExpression("[]")).toEqual([]);
      });

      it("should evaluate nested array comparisons", () => {
        // Arrays can be used in comparisons when resolved from variables
        expect(evaluateExpression("[1, 2, 3] === [1, 2, 3]")).toBe(false); // different references
        expect(evaluateExpression("[] === []")).toBe(false); // different references
      });
    });

    describe("error handling", () => {
      it("should throw on unexpected token", () => {
        expect(() => evaluateExpression("5 @ 3")).toThrow();
      });

      it("should throw on unclosed parenthesis", () => {
        expect(() => evaluateExpression("(5 + 3")).toThrow("Expected closing parenthesis");
      });
    });
  });

  describe("validateConditionConfig", () => {
    it("should return empty array for valid config", () => {
      const config: ConditionNodeConfig = { expression: "true" };
      expect(validateConditionConfig(config)).toEqual([]);
    });

    it("should require expression", () => {
      const config = {} as ConditionNodeConfig;
      expect(validateConditionConfig(config)).toContain("Expression is required");
    });

    it("should detect syntax errors in expression", () => {
      const config: ConditionNodeConfig = { expression: "5 @ 3" };
      const errors = validateConditionConfig(config);
      expect(errors.some((e) => e.includes("Invalid expression syntax"))).toBe(true);
    });
  });
});
