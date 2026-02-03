/**
 * Tests for WorkflowEngine - Variable Resolution and Graph Traversal
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { WorkflowDefinition, ExecutionContext } from "../../types.js";
import { WorkflowEngine } from "../engine.js";

describe("WorkflowEngine", () => {
  // Minimal workflow for testing
  function createTestWorkflow(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
    return {
      nodes: overrides.nodes ?? [
        {
          id: "trigger1",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: { label: "Start", config: {} },
        },
      ],
      edges: overrides.edges ?? [],
      ...overrides,
    };
  }

  function createTestContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
    return {
      inputs: overrides.inputs ?? {},
      nodeOutputs: overrides.nodeOutputs ?? {},
      globalVariables: overrides.globalVariables ?? {},
    };
  }

  describe("resolveVariables - string exact match", () => {
    it("resolves {{inputs.name}} to input value", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow(),
        createTestContext({ inputs: { name: "Alice" } }),
      );
      expect(engine.resolveVariables("{{inputs.name}}")).toBe("Alice");
    });

    it("resolves {inputs.name} single-brace syntax", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow(),
        createTestContext({ inputs: { name: "Bob" } }),
      );
      expect(engine.resolveVariables("{inputs.name}")).toBe("Bob");
    });

    it("resolves {{nodes.step1.output}} to node output", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow(),
        createTestContext({ nodeOutputs: { step1: { output: 42 } } }),
      );
      expect(engine.resolveVariables("{{nodes.step1.output}}")).toBe(42);
    });

    it("resolves deep paths in node outputs", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow(),
        createTestContext({
          nodeOutputs: {
            query: { data: { rows: [{ id: 1 }, { id: 2 }] } },
          },
        }),
      );
      expect(engine.resolveVariables("{{nodes.query.data.rows}}")).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it("resolves direct node reference without nodes prefix", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow(),
        createTestContext({ nodeOutputs: { myNode: { value: "direct" } } }),
      );
      expect(engine.resolveVariables("{{myNode.value}}")).toBe("direct");
    });

    it("resolves global variable reference", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow(),
        createTestContext({ globalVariables: { tenant: "acme" } }),
      );
      expect(engine.resolveVariables("{{tenant}}")).toBe("acme");
    });

    it("returns original for unresolved exact variable", () => {
      const engine = new WorkflowEngine(createTestWorkflow(), createTestContext());
      expect(engine.resolveVariables("{{unknown.path}}")).toBe("{{unknown.path}}");
    });

    it("returns object values intact for exact match", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow(),
        createTestContext({
          nodeOutputs: { data: { items: [1, 2, 3], meta: { count: 3 } } },
        }),
      );
      expect(engine.resolveVariables("{{nodes.data.items}}")).toEqual([1, 2, 3]);
      expect(engine.resolveVariables("{{nodes.data.meta}}")).toEqual({ count: 3 });
    });

    it("handles hyphenated node IDs", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow(),
        createTestContext({ nodeOutputs: { "my-node-1": { result: "ok" } } }),
      );
      expect(engine.resolveVariables("{{nodes.my-node-1.result}}")).toBe("ok");
    });
  });

  describe("resolveVariables - string templates (inline)", () => {
    it("replaces variables in string template", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow(),
        createTestContext({ inputs: { name: "World" } }),
      );
      expect(engine.resolveVariables("Hello {{inputs.name}}!")).toBe("Hello World!");
    });

    it("replaces multiple variables in template", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow(),
        createTestContext({
          inputs: { firstName: "John", lastName: "Doe" },
        }),
      );
      expect(engine.resolveVariables("Name: {{inputs.firstName}} {{inputs.lastName}}")).toBe(
        "Name: John Doe",
      );
    });

    it("stringifies objects in templates", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow(),
        createTestContext({
          nodeOutputs: { data: { items: [1, 2] } },
        }),
      );
      expect(engine.resolveVariables("Data: {{nodes.data.items}}")).toBe("Data: [1,2]");
    });

    it("returns empty string for null/undefined in templates", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow(),
        createTestContext({ inputs: { name: null as unknown as string } }),
      );
      expect(engine.resolveVariables("Hello {{inputs.name}}!")).toBe("Hello !");
    });

    it("handles mixed single and double brace in template", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow(),
        createTestContext({ inputs: { a: "A", b: "B" } }),
      );
      expect(engine.resolveVariables("{inputs.a} and {{inputs.b}}")).toBe("A and B");
    });
  });

  describe("resolveVariables - objects and arrays", () => {
    it("resolves variables in nested objects", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow(),
        createTestContext({ inputs: { region: "west", limit: 10 } }),
      );
      const config = {
        query: "SELECT * FROM customers WHERE region = '{{inputs.region}}'",
        options: { limit: "{{inputs.limit}}" },
      };
      expect(engine.resolveVariables(config)).toEqual({
        query: "SELECT * FROM customers WHERE region = 'west'",
        options: { limit: 10 },
      });
    });

    it("resolves variables in arrays", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow(),
        createTestContext({ inputs: { a: "A", b: "B" } }),
      );
      expect(engine.resolveVariables(["{{inputs.a}}", "{{inputs.b}}", "static"])).toEqual([
        "A",
        "B",
        "static",
      ]);
    });

    it("handles deeply nested structures", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow(),
        createTestContext({ inputs: { val: 42 } }),
      );
      const config = {
        level1: {
          level2: {
            level3: ["{{inputs.val}}"],
          },
        },
      };
      expect(engine.resolveVariables(config)).toEqual({
        level1: { level2: { level3: [42] } },
      });
    });
  });

  describe("resolveVariables - edge cases", () => {
    it("passes through numbers unchanged", () => {
      const engine = new WorkflowEngine(createTestWorkflow(), createTestContext());
      expect(engine.resolveVariables(42)).toBe(42);
    });

    it("passes through booleans unchanged", () => {
      const engine = new WorkflowEngine(createTestWorkflow(), createTestContext());
      expect(engine.resolveVariables(true)).toBe(true);
      expect(engine.resolveVariables(false)).toBe(false);
    });

    it("passes through null unchanged", () => {
      const engine = new WorkflowEngine(createTestWorkflow(), createTestContext());
      expect(engine.resolveVariables(null)).toBeNull();
    });

    it("passes through undefined unchanged", () => {
      const engine = new WorkflowEngine(createTestWorkflow(), createTestContext());
      expect(engine.resolveVariables(undefined)).toBeUndefined();
    });

    it("does not resolve JSON-like strings", () => {
      const engine = new WorkflowEngine(createTestWorkflow(), createTestContext());
      // Strings with colons or quotes shouldn't be mistaken for variables
      expect(engine.resolveVariables('{"key": "value"}')).toBe('{"key": "value"}');
    });

    it("handles empty string", () => {
      const engine = new WorkflowEngine(createTestWorkflow(), createTestContext());
      expect(engine.resolveVariables("")).toBe("");
    });
  });

  describe("getNextNodes", () => {
    it("returns empty array for node with no outgoing edges", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow({
          nodes: [{ id: "end", type: "trigger", position: { x: 0, y: 0 }, data: { config: {} } }],
          edges: [],
        }),
        createTestContext(),
      );
      expect(engine.getNextNodes("end")).toEqual([]);
    });

    it("returns all target nodes for non-condition node", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow({
          nodes: [
            { id: "start", type: "trigger", position: { x: 0, y: 0 }, data: { config: {} } },
            { id: "a", type: "agent", position: { x: 100, y: 0 }, data: { config: {} } },
            { id: "b", type: "agent", position: { x: 200, y: 0 }, data: { config: {} } },
          ],
          edges: [
            { id: "e1", source: "start", target: "a" },
            { id: "e2", source: "start", target: "b" },
          ],
        }),
        createTestContext(),
      );
      expect(engine.getNextNodes("start")).toEqual(["a", "b"]);
    });

    it("filters by sourceHandle for condition node with true result", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow({
          nodes: [
            { id: "cond", type: "condition", position: { x: 0, y: 0 }, data: { config: {} } },
            { id: "yes", type: "agent", position: { x: 100, y: -50 }, data: { config: {} } },
            { id: "no", type: "agent", position: { x: 100, y: 50 }, data: { config: {} } },
          ],
          edges: [
            { id: "e1", source: "cond", target: "yes", sourceHandle: "true" },
            { id: "e2", source: "cond", target: "no", sourceHandle: "false" },
          ],
        }),
        createTestContext(),
      );
      expect(engine.getNextNodes("cond", { result: true, nextHandle: "true" })).toEqual(["yes"]);
    });

    it("filters by sourceHandle for condition node with false result", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow({
          nodes: [
            { id: "cond", type: "condition", position: { x: 0, y: 0 }, data: { config: {} } },
            { id: "yes", type: "agent", position: { x: 100, y: -50 }, data: { config: {} } },
            { id: "no", type: "agent", position: { x: 100, y: 50 }, data: { config: {} } },
          ],
          edges: [
            { id: "e1", source: "cond", target: "yes", sourceHandle: "true" },
            { id: "e2", source: "cond", target: "no", sourceHandle: "false" },
          ],
        }),
        createTestContext(),
      );
      expect(engine.getNextNodes("cond", { result: false, nextHandle: "false" })).toEqual(["no"]);
    });

    it("returns empty for non-existent node", () => {
      const engine = new WorkflowEngine(createTestWorkflow(), createTestContext());
      expect(engine.getNextNodes("nonexistent")).toEqual([]);
    });
  });

  describe("getStartNodes", () => {
    it("returns nodes with no incoming edges", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow({
          nodes: [
            { id: "trigger", type: "trigger", position: { x: 0, y: 0 }, data: { config: {} } },
            { id: "step1", type: "agent", position: { x: 100, y: 0 }, data: { config: {} } },
            { id: "step2", type: "agent", position: { x: 200, y: 0 }, data: { config: {} } },
          ],
          edges: [
            { id: "e1", source: "trigger", target: "step1" },
            { id: "e2", source: "step1", target: "step2" },
          ],
        }),
        createTestContext(),
      );
      expect(engine.getStartNodes()).toEqual(["trigger"]);
    });

    it("returns multiple start nodes if disconnected", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow({
          nodes: [
            { id: "a", type: "trigger", position: { x: 0, y: 0 }, data: { config: {} } },
            { id: "b", type: "trigger", position: { x: 0, y: 100 }, data: { config: {} } },
          ],
          edges: [],
        }),
        createTestContext(),
      );
      expect(engine.getStartNodes()).toEqual(["a", "b"]);
    });
  });

  describe("getTriggerNodes", () => {
    it("returns only trigger type nodes", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow({
          nodes: [
            { id: "t1", type: "trigger", position: { x: 0, y: 0 }, data: { config: {} } },
            { id: "a1", type: "agent", position: { x: 100, y: 0 }, data: { config: {} } },
            { id: "t2", type: "trigger", position: { x: 0, y: 100 }, data: { config: {} } },
          ],
        }),
        createTestContext(),
      );
      const triggers = engine.getTriggerNodes();
      expect(triggers).toHaveLength(2);
      expect(triggers.map((t) => t.id)).toEqual(["t1", "t2"]);
    });
  });

  describe("validateEdges", () => {
    it("returns valid for correct edges", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow({
          nodes: [
            { id: "a", type: "trigger", position: { x: 0, y: 0 }, data: { config: {} } },
            { id: "b", type: "agent", position: { x: 100, y: 0 }, data: { config: {} } },
          ],
          edges: [{ id: "e1", source: "a", target: "b" }],
        }),
        createTestContext(),
      );
      expect(engine.validateEdges()).toEqual({ valid: true, errors: [] });
    });

    it("returns errors for invalid source", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow({
          nodes: [{ id: "b", type: "agent", position: { x: 100, y: 0 }, data: { config: {} } }],
          edges: [{ id: "e1", source: "missing", target: "b" }],
        }),
        createTestContext(),
      );
      const result = engine.validateEdges();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Edge e1 has invalid source: missing");
    });

    it("returns errors for invalid target", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow({
          nodes: [{ id: "a", type: "trigger", position: { x: 0, y: 0 }, data: { config: {} } }],
          edges: [{ id: "e1", source: "a", target: "missing" }],
        }),
        createTestContext(),
      );
      const result = engine.validateEdges();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Edge e1 has invalid target: missing");
    });
  });

  describe("getNode", () => {
    it("finds node by id", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow({
          nodes: [
            {
              id: "myNode",
              type: "agent",
              position: { x: 0, y: 0 },
              data: { label: "My Node", config: {} },
            },
          ],
        }),
        createTestContext(),
      );
      const node = engine.getNode("myNode");
      expect(node).toBeDefined();
      expect(node?.data.label).toBe("My Node");
    });

    it("returns undefined for missing node", () => {
      const engine = new WorkflowEngine(createTestWorkflow(), createTestContext());
      expect(engine.getNode("nonexistent")).toBeUndefined();
    });
  });

  describe("updateContext", () => {
    it("updates the internal context", () => {
      const engine = new WorkflowEngine(
        createTestWorkflow(),
        createTestContext({ inputs: { old: true } }),
      );

      engine.updateContext(createTestContext({ inputs: { new: true } }));

      expect(engine.resolveVariables("{{inputs.new}}")).toBe(true);
      expect(engine.resolveVariables("{{inputs.old}}")).toBe("{{inputs.old}}");
    });
  });
});
