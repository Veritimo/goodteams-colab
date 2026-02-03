/**
 * Tests for ExecutionContextManager
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ExecutionContextManager } from "../context.js";

describe("ExecutionContextManager", () => {
  let ctx: ExecutionContextManager;

  beforeEach(() => {
    ctx = new ExecutionContextManager();
  });

  describe("constructor", () => {
    it("creates empty context by default", () => {
      const context = ctx.getContext();
      expect(context.inputs).toEqual({});
      expect(context.nodeOutputs).toEqual({});
      expect(context.globalVariables).toEqual({});
    });

    it("accepts initial context", () => {
      const initial = {
        inputs: { name: "test" },
        nodeOutputs: { node1: { result: 42 } },
        globalVariables: { env: "prod" },
      };
      const ctxWithInitial = new ExecutionContextManager(initial);
      expect(ctxWithInitial.getContext()).toEqual(initial);
    });
  });

  describe("inputs", () => {
    it("setInput stores a value", () => {
      ctx.setInput("region", "west");
      expect(ctx.getInput("region")).toBe("west");
    });

    it("getInput returns undefined for missing key", () => {
      expect(ctx.getInput("missing")).toBeUndefined();
    });

    it("getInputs returns all inputs", () => {
      ctx.setInput("a", 1);
      ctx.setInput("b", 2);
      expect(ctx.getInputs()).toEqual({ a: 1, b: 2 });
    });

    it("setInputs merges with existing", () => {
      ctx.setInput("existing", true);
      ctx.setInputs({ new1: "val1", new2: "val2" });
      expect(ctx.getInputs()).toEqual({
        existing: true,
        new1: "val1",
        new2: "val2",
      });
    });
  });

  describe("node outputs", () => {
    it("setNodeOutput stores output", () => {
      ctx.setNodeOutput("step1", { rows: [1, 2, 3] });
      expect(ctx.getNodeOutput("step1")).toEqual({ rows: [1, 2, 3] });
    });

    it("getNodeOutput returns undefined for missing node", () => {
      expect(ctx.getNodeOutput("nonexistent")).toBeUndefined();
    });

    it("hasNodeOutput returns true for existing", () => {
      ctx.setNodeOutput("node1", "result");
      expect(ctx.hasNodeOutput("node1")).toBe(true);
    });

    it("hasNodeOutput returns false for missing", () => {
      expect(ctx.hasNodeOutput("missing")).toBe(false);
    });

    it("getNodeOutputs returns all outputs", () => {
      ctx.setNodeOutput("a", 1);
      ctx.setNodeOutput("b", 2);
      expect(ctx.getNodeOutputs()).toEqual({ a: 1, b: 2 });
    });
  });

  describe("global variables", () => {
    it("setGlobalVariable stores value", () => {
      ctx.setGlobalVariable("tenant", "acme");
      expect(ctx.getGlobalVariable("tenant")).toBe("acme");
    });

    it("getGlobalVariable returns undefined for missing", () => {
      expect(ctx.getGlobalVariable("missing")).toBeUndefined();
    });

    it("getGlobalVariables returns all globals", () => {
      ctx.setGlobalVariable("x", 1);
      ctx.setGlobalVariable("y", 2);
      expect(ctx.getGlobalVariables()).toEqual({ x: 1, y: 2 });
    });
  });

  describe("serialization", () => {
    it("toJSON serializes context", () => {
      ctx.setInput("in", "val");
      ctx.setNodeOutput("node", "out");
      ctx.setGlobalVariable("global", "var");

      const json = ctx.toJSON();
      expect(json).toEqual({
        inputs: { in: "val" },
        nodeOutputs: { node: "out" },
        globalVariables: { global: "var" },
      });
    });

    it("fromJSON deserializes context", () => {
      const json = {
        inputs: { a: 1 },
        nodeOutputs: { b: 2 },
        globalVariables: { c: 3 },
      };
      const restored = ExecutionContextManager.fromJSON(json);
      expect(restored.getContext()).toEqual(json);
    });

    it("clone creates independent copy", () => {
      ctx.setInput("original", true);
      const cloned = ctx.clone();
      cloned.setInput("cloned", true);

      expect(ctx.getInput("cloned")).toBeUndefined();
      expect(cloned.getInput("original")).toBe(true);
    });
  });

  describe("reset operations", () => {
    it("clearNodeOutputs removes all outputs", () => {
      ctx.setNodeOutput("a", 1);
      ctx.setNodeOutput("b", 2);
      ctx.clearNodeOutputs();
      expect(ctx.getNodeOutputs()).toEqual({});
    });

    it("reset clears everything", () => {
      ctx.setInput("in", 1);
      ctx.setNodeOutput("node", 2);
      ctx.setGlobalVariable("global", 3);
      ctx.reset();

      expect(ctx.getContext()).toEqual({
        inputs: {},
        nodeOutputs: {},
        globalVariables: {},
      });
    });
  });
});
