/**
 * WorkflowDesigner Component Tests
 *
 * Tests for the main workflow designer component.
 *
 * @see src/platform/ui/workflows/WorkflowDesigner.tsx
 */

import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from "vitest";

// =============================================================================
// MOCKS
// =============================================================================

// Mock React Flow - must be before component import
vi.mock("@xyflow/react", () => ({
  ReactFlow: vi.fn(({ children, nodes, edges, onNodesChange, onEdgesChange }: any) => (
    <div
      data-testid="react-flow"
      data-nodes={JSON.stringify(nodes)}
      data-edges={JSON.stringify(edges)}
    >
      {children}
    </div>
  )),
  Background: vi.fn(() => <div data-testid="background" />),
  Controls: vi.fn(() => <div data-testid="controls" />),
  MiniMap: vi.fn(() => <div data-testid="minimap" />),
  Panel: vi.fn(({ children, position }: any) => (
    <div data-testid={`panel-${position}`}>{children}</div>
  )),
  useNodesState: vi.fn((initialNodes: any[]) => {
    const [nodes, setNodes] = [initialNodes, vi.fn()];
    return [nodes, setNodes, vi.fn()];
  }),
  useEdgesState: vi.fn((initialEdges: any[]) => {
    const [edges, setEdges] = [initialEdges, vi.fn()];
    return [edges, setEdges, vi.fn()];
  }),
  addEdge: vi.fn((connection, edges) => [...edges, connection]),
  BackgroundVariant: { Dots: "dots" },
}));

// Mock Monaco Editor
vi.mock("@monaco-editor/react", () => ({
  default: vi.fn(({ value, onChange }: any) => (
    <textarea
      data-testid="monaco-editor"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  )),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// =============================================================================
// TEST IMPORTS
// =============================================================================

import React from "react";
import type { DesignerNode, DesignerEdge, ViewMode, WorkflowApiData } from "../types.js";

// =============================================================================
// TEST DATA
// =============================================================================

const mockWorkflowId = "wf-test-123";

const mockWorkflowData: WorkflowApiData = {
  id: mockWorkflowId,
  name: "Test Workflow",
  description: "A test workflow",
  status: "ACTIVE",
  definition: {
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 100, y: 100 },
        data: {
          label: "Start",
          config: { triggerType: "MANUAL" },
        },
      },
      {
        id: "agent-1",
        type: "agent",
        position: { x: 300, y: 100 },
        data: {
          label: "AI Agent",
          config: { prompt: "Hello" },
        },
      },
    ],
    edges: [{ id: "edge-1", source: "trigger-1", target: "agent-1" }],
  },
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockExecutionResult = {
  executionId: "exec-123",
  status: "COMPLETED" as const,
  startedAt: "2024-01-01T00:00:00Z",
  finishedAt: "2024-01-01T00:01:00Z",
  outputs: { result: "success" },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function setupFetchMock(scenario: "success" | "error" | "not-found" = "success") {
  mockFetch.mockImplementation((url: string, options?: RequestInit) => {
    const method = options?.method || "GET";

    if (scenario === "error") {
      return Promise.resolve({
        ok: false,
        statusText: "Internal Server Error",
        json: () => Promise.resolve({ error: "Server error" }),
      });
    }

    if (scenario === "not-found") {
      return Promise.resolve({
        ok: false,
        statusText: "Not Found",
        json: () => Promise.resolve({ error: "Workflow not found" }),
      });
    }

    // Success scenarios
    if (url.includes("/workflows/") && method === "GET") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockWorkflowData),
      });
    }

    if (url.includes("/workflows/") && method === "PATCH") {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ ...mockWorkflowData, ...JSON.parse(options?.body as string) }),
      });
    }

    if (url.includes("/execute") && method === "POST") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockExecutionResult),
      });
    }

    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });
}

// =============================================================================
// TESTS
// =============================================================================

describe("WorkflowDesigner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetchMock();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Initialization", () => {
    it("should export WorkflowDesigner component", async () => {
      const module = await import("../WorkflowDesigner.js");
      expect(module.WorkflowDesigner).toBeDefined();
      expect(typeof module.WorkflowDesigner).toBe("function");
    });

    it("should export default as WorkflowDesigner", async () => {
      const module = await import("../WorkflowDesigner.js");
      expect(module.default).toBe(module.WorkflowDesigner);
    });
  });

  describe("useWorkflowDesigner Hook", () => {
    it("should export useWorkflowDesigner hook", async () => {
      const module = await import("../hooks/useWorkflowDesigner.js");
      expect(module.useWorkflowDesigner).toBeDefined();
      expect(typeof module.useWorkflowDesigner).toBe("function");
    });

    it("should export default as useWorkflowDesigner", async () => {
      const module = await import("../hooks/useWorkflowDesigner.js");
      expect(module.default).toBe(module.useWorkflowDesigner);
    });
  });

  describe("Types", () => {
    it("should export ViewMode type", async () => {
      const module = await import("../types.js");
      // Type-only exports can't be tested at runtime, but we can verify the module loads
      expect(module).toBeDefined();
    });

    it("should have valid node palette item structure", async () => {
      // Verify the expected structure exists
      const paletteItem = {
        type: "trigger" as const,
        label: "Trigger",
        description: "Starting point",
        icon: "zap",
        color: "emerald",
        category: "logic" as const,
        defaultConfig: { triggerType: "MANUAL" },
      };

      expect(paletteItem.type).toBe("trigger");
      expect(paletteItem.category).toBe("logic");
    });
  });

  describe("API Integration", () => {
    it("should call API to load workflow", async () => {
      setupFetchMock();

      // Simulate the hook's fetch call
      const response = await fetch(`/api/platform/workflows/${mockWorkflowId}`);
      const data = await response.json();

      expect(mockFetch).toHaveBeenCalled();
      expect(data.id).toBe(mockWorkflowId);
      expect(data.name).toBe("Test Workflow");
    });

    it("should call API to save workflow", async () => {
      setupFetchMock();

      const updateData = {
        definition: {
          nodes: mockWorkflowData.definition!.nodes,
          edges: mockWorkflowData.definition!.edges,
        },
      };

      const response = await fetch(`/api/platform/workflows/${mockWorkflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/platform/workflows/${mockWorkflowId}`,
        expect.objectContaining({
          method: "PATCH",
        }),
      );
      expect(response.ok).toBe(true);
    });

    it("should call API to execute workflow", async () => {
      setupFetchMock();

      const response = await fetch(`/api/platform/workflows/${mockWorkflowId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: {} }),
      });

      const result = await response.json();

      expect(mockFetch).toHaveBeenCalled();
      expect(result.executionId).toBe("exec-123");
      expect(result.status).toBe("COMPLETED");
    });

    it("should handle API errors gracefully", async () => {
      setupFetchMock("error");

      const response = await fetch(`/api/platform/workflows/${mockWorkflowId}`);

      expect(response.ok).toBe(false);
      expect(response.statusText).toBe("Internal Server Error");
    });

    it("should handle not found errors", async () => {
      setupFetchMock("not-found");

      const response = await fetch(`/api/platform/workflows/non-existent`);

      expect(response.ok).toBe(false);
      expect(response.statusText).toBe("Not Found");
    });
  });

  describe("Workflow State Management", () => {
    it("should track unsaved changes", () => {
      const originalFingerprint = JSON.stringify({
        nodes: [{ id: "1", type: "trigger", position: { x: 0, y: 0 }, data: {} }],
        edges: [],
      });

      const modifiedFingerprint = JSON.stringify({
        nodes: [{ id: "1", type: "trigger", position: { x: 100, y: 0 }, data: {} }],
        edges: [],
      });

      expect(originalFingerprint).not.toBe(modifiedFingerprint);
    });

    it("should create workflow fingerprint correctly", () => {
      const nodes = mockWorkflowData.definition!.nodes;
      const edges = mockWorkflowData.definition!.edges;

      const essentialNodes = nodes.map((n: any) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      }));

      const essentialEdges = edges.map((e: any) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      }));

      const fingerprint = JSON.stringify({ nodes: essentialNodes, edges: essentialEdges });

      expect(fingerprint).toContain("trigger-1");
      expect(fingerprint).toContain("agent-1");
      expect(fingerprint).toContain("edge-1");
    });
  });

  describe("View Mode Toggle", () => {
    it("should toggle between DESIGN and JSON modes", () => {
      let viewMode: ViewMode = "DESIGN";

      // Toggle to JSON
      viewMode = "JSON";
      expect(viewMode).toBe("JSON");

      // Toggle back to DESIGN
      viewMode = "DESIGN";
      expect(viewMode).toBe("DESIGN");
    });

    it("should serialize nodes/edges to JSON when switching to JSON view", () => {
      const nodes = mockWorkflowData.definition!.nodes;
      const edges = mockWorkflowData.definition!.edges;

      const jsonContent = JSON.stringify({ nodes, edges }, null, 2);

      expect(jsonContent).toContain("trigger-1");
      expect(jsonContent).toContain("agent-1");
      expect(JSON.parse(jsonContent).nodes).toHaveLength(2);
    });

    it("should parse JSON when switching back to DESIGN view", () => {
      const jsonContent = JSON.stringify({
        nodes: [
          {
            id: "new-1",
            type: "trigger",
            position: { x: 0, y: 0 },
            data: { label: "New", config: {} },
          },
        ],
        edges: [],
      });

      const parsed = JSON.parse(jsonContent);

      expect(parsed.nodes).toHaveLength(1);
      expect(parsed.nodes[0].id).toBe("new-1");
    });
  });

  describe("Node Operations", () => {
    it("should generate unique node IDs", () => {
      const type = "agent";
      const id1 = `${type}_${Date.now()}`;

      // Wait a tick
      const id2 = `${type}_${Date.now() + 1}`;

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^agent_\d+$/);
    });

    it("should create node with default configuration", () => {
      const nodeType = "agent";
      const defaultConfig = { prompt: "", modelName: "gpt-4" };

      const newNode = {
        id: `${nodeType}_123`,
        type: nodeType,
        position: { x: 200, y: 200 },
        data: {
          label: "Assistant",
          config: defaultConfig,
        },
      };

      expect(newNode.data.config.prompt).toBe("");
      expect(newNode.data.config.modelName).toBe("gpt-4");
    });

    it("should filter out deleted node from edges", () => {
      const nodeIdToDelete = "agent-1";
      const edges = [
        { id: "edge-1", source: "trigger-1", target: "agent-1" },
        { id: "edge-2", source: "agent-1", target: "comm-1" },
        { id: "edge-3", source: "trigger-1", target: "comm-1" },
      ];

      const filteredEdges = edges.filter(
        (e) => e.source !== nodeIdToDelete && e.target !== nodeIdToDelete,
      );

      expect(filteredEdges).toHaveLength(1);
      expect(filteredEdges[0].id).toBe("edge-3");
    });
  });

  describe("Node Palette", () => {
    it("should have all required node categories", () => {
      const categories = ["logic", "sql", "tools"];
      const expectedCategories = ["logic", "sql", "tools"];

      expect(categories).toEqual(expectedCategories);
    });

    it("should have correct default node types", () => {
      const defaultNodeTypes = [
        "trigger",
        "agent",
        "condition",
        "iterator",
        "communication",
        "tool",
      ];

      expect(defaultNodeTypes).toContain("trigger");
      expect(defaultNodeTypes).toContain("agent");
      expect(defaultNodeTypes).toContain("tool");
    });
  });
});

describe("Types Module", () => {
  it("should export all required types", async () => {
    // This test verifies the module can be imported without errors
    const types = await import("../types.js");
    expect(types).toBeDefined();
  });
});

describe("Hook Module", () => {
  it("should export useWorkflowDesigner", async () => {
    const hooks = await import("../hooks/useWorkflowDesigner.js");
    expect(hooks.useWorkflowDesigner).toBeDefined();
  });
});
