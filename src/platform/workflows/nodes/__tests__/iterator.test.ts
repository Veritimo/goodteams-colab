/**
 * Iterator Node Executor Tests
 */

import { describe, it, expect, vi } from "vitest";
import type { ExecutionContext, IteratorNodeConfig, IteratorNodeOutput } from "../types.js";
import { executeIteratorNode, validateIteratorConfig, getIterationItems } from "../iterator.js";
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

describe("Iterator Node Executor", () => {
  describe("executeIteratorNode", () => {
    it("should iterate over array without callback", async () => {
      const config: IteratorNodeConfig = {
        collection: "{{inputs.items}}",
        itemVariable: "item",
      };
      const context = createContext({
        inputs: { items: [1, 2, 3] },
      });

      const result = await executeIteratorNode(config, context);

      expect(result.iterations).toBe(3);
      expect(result.results).toHaveLength(3);
      expect(result.errors).toEqual([]);
    });

    it("should resolve collection from node outputs", async () => {
      const config: IteratorNodeConfig = {
        collection: "{{nodes.query.data.rows}}",
        itemVariable: "row",
      };
      const context = createContext({
        nodeOutputs: {
          query: { data: { rows: ["a", "b", "c"] } },
        },
      });

      const result = await executeIteratorNode(config, context);

      expect(result.iterations).toBe(3);
    });

    it("should include item and index in results", async () => {
      const config: IteratorNodeConfig = {
        collection: "{{inputs.items}}",
        itemVariable: "item",
      };
      const context = createContext({
        inputs: { items: ["x", "y"] },
      });

      const result = await executeIteratorNode(config, context);

      expect(result.results[0]).toMatchObject({
        index: 0,
        item: "x",
      });
      expect(result.results[1]).toMatchObject({
        index: 1,
        item: "y",
      });
    });

    it("should execute callback for each item sequentially", async () => {
      const config: IteratorNodeConfig = {
        collection: "{{inputs.items}}",
        itemVariable: "item",
        maxConcurrency: 1,
      };
      const context = createContext({
        inputs: { items: [1, 2, 3] },
      });

      const callback = vi.fn().mockImplementation(async (item) => item * 2);

      const result = await executeIteratorNode(config, context, callback);

      expect(result.iterations).toBe(3);
      expect(result.results).toEqual([2, 4, 6]);
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it("should execute callback with item context", async () => {
      const config: IteratorNodeConfig = {
        collection: "{{inputs.items}}",
        itemVariable: "currentItem",
        maxConcurrency: 1,
      };
      const context = createContext({
        inputs: { items: ["a", "b"] },
      });

      const contextCaptures: ExecutionContext[] = [];
      const callback = vi.fn().mockImplementation(async (item, index, ctx) => {
        contextCaptures.push(ctx);
        return item;
      });

      await executeIteratorNode(config, context, callback);

      expect(contextCaptures[0].inputs.currentItem).toBe("a");
      expect(contextCaptures[0].inputs.currentItemIndex).toBe(0);
      expect(contextCaptures[1].inputs.currentItem).toBe("b");
      expect(contextCaptures[1].inputs.currentItemIndex).toBe(1);
    });

    it("should handle callback errors gracefully", async () => {
      const config: IteratorNodeConfig = {
        collection: "{{inputs.items}}",
        itemVariable: "item",
        maxConcurrency: 1,
      };
      const context = createContext({
        inputs: { items: [1, 2, 3] },
      });

      const callback = vi.fn().mockImplementation(async (item) => {
        if (item === 2) throw new Error("Processing failed");
        return item;
      });

      const result = await executeIteratorNode(config, context, callback);

      expect(result.iterations).toBe(3);
      expect(result.results[0]).toBe(1);
      expect(result.results[2]).toBe(3);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        index: 1,
        item: 2,
        error: "Processing failed",
      });
    });

    it("should process items in parallel with concurrency limit", async () => {
      const config: IteratorNodeConfig = {
        collection: "{{inputs.items}}",
        itemVariable: "item",
        maxConcurrency: 2,
      };
      const context = createContext({
        inputs: { items: [1, 2, 3, 4] },
      });

      const startTimes: number[] = [];
      const callback = vi.fn().mockImplementation(async (item) => {
        startTimes.push(Date.now());
        await new Promise((resolve) => setTimeout(resolve, 10));
        return item * 2;
      });

      const result = await executeIteratorNode(config, context, callback);

      expect(result.results).toEqual([2, 4, 6, 8]);
      // With maxConcurrency=2, items should be processed in pairs
      // Items 1,2 start together, then 3,4 start together
    });

    it("should throw error when collection is not an array", async () => {
      const config: IteratorNodeConfig = {
        collection: "{{inputs.value}}",
        itemVariable: "item",
      };
      const context = createContext({
        inputs: { value: "not an array" },
      });

      await expect(executeIteratorNode(config, context)).rejects.toThrow(
        "Collection '{{inputs.value}}' is not an array",
      );
    });

    it("should throw error when collection is missing", async () => {
      const config = { itemVariable: "item" } as IteratorNodeConfig;
      const context = createContext();

      await expect(executeIteratorNode(config, context)).rejects.toThrow("Missing 'collection'");
    });

    it("should throw error when itemVariable is missing", async () => {
      const config = { collection: "{{inputs.items}}" } as IteratorNodeConfig;
      const context = createContext({ inputs: { items: [1] } });

      await expect(executeIteratorNode(config, context)).rejects.toThrow("Missing 'itemVariable'");
    });

    it("should handle empty array", async () => {
      const config: IteratorNodeConfig = {
        collection: "{{inputs.items}}",
        itemVariable: "item",
      };
      const context = createContext({
        inputs: { items: [] },
      });

      const result = await executeIteratorNode(config, context);

      expect(result.iterations).toBe(0);
      expect(result.results).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it("should resolve collection path without variable syntax", async () => {
      const config: IteratorNodeConfig = {
        collection: "inputs.items",
        itemVariable: "item",
      };
      const context = createContext({
        inputs: { items: [1, 2, 3] },
      });

      const result = await executeIteratorNode(config, context);

      expect(result.iterations).toBe(3);
    });
  });

  describe("validateIteratorConfig", () => {
    it("should return empty array for valid config", () => {
      const config: IteratorNodeConfig = {
        collection: "{{inputs.items}}",
        itemVariable: "item",
      };
      expect(validateIteratorConfig(config)).toEqual([]);
    });

    it("should require collection", () => {
      const config = { itemVariable: "item" } as IteratorNodeConfig;
      expect(validateIteratorConfig(config)).toContain("collection is required");
    });

    it("should require itemVariable", () => {
      const config = { collection: "{{inputs.items}}" } as IteratorNodeConfig;
      expect(validateIteratorConfig(config)).toContain("itemVariable is required");
    });

    it("should validate itemVariable is valid identifier", () => {
      const config: IteratorNodeConfig = {
        collection: "{{inputs.items}}",
        itemVariable: "123invalid",
      };
      expect(validateIteratorConfig(config)).toContain(
        "itemVariable must be a valid identifier (letters, numbers, underscore)",
      );
    });

    it("should accept valid itemVariable with underscore", () => {
      const config: IteratorNodeConfig = {
        collection: "{{inputs.items}}",
        itemVariable: "_my_item_123",
      };
      expect(validateIteratorConfig(config)).toEqual([]);
    });

    it("should validate maxConcurrency minimum", () => {
      const config: IteratorNodeConfig = {
        collection: "{{inputs.items}}",
        itemVariable: "item",
        maxConcurrency: 0,
      };
      expect(validateIteratorConfig(config)).toContain("maxConcurrency must be at least 1");
    });

    it("should validate maxConcurrency maximum", () => {
      const config: IteratorNodeConfig = {
        collection: "{{inputs.items}}",
        itemVariable: "item",
        maxConcurrency: 200,
      };
      expect(validateIteratorConfig(config)).toContain("maxConcurrency cannot exceed 100");
    });
  });

  describe("getIterationItems", () => {
    it("should extract iteration items from output", () => {
      const output: IteratorNodeOutput = {
        iterations: 3,
        results: [
          { index: 0, item: "a" },
          { index: 1, item: "b" },
          { index: 2, item: "c" },
        ],
        errors: [],
      };

      const items = getIterationItems(output, "currentItem");

      expect(items).toHaveLength(3);
      expect(items[0]).toEqual({
        item: "a",
        index: 0,
        contextVars: { currentItem: "a", currentItemIndex: 0 },
      });
      expect(items[1]).toEqual({
        item: "b",
        index: 1,
        contextVars: { currentItem: "b", currentItemIndex: 1 },
      });
    });

    it("should handle raw values in results", () => {
      const output: IteratorNodeOutput = {
        iterations: 2,
        results: [1, 2],
        errors: [],
      };

      const items = getIterationItems(output, "num");

      expect(items[0]).toEqual({
        item: 1,
        index: 0,
        contextVars: { num: 1, numIndex: 0 },
      });
    });
  });
});
