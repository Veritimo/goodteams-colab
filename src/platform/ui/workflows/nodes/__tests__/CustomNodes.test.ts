/**
 * Custom workflow node components tests
 *
 * Note: Full DOM rendering tests are skipped due to React version conflict between
 * reactflow (React 18) and the project (React 19). These tests verify exports,
 * types, and component structure without rendering.
 */
import { describe, it, expect } from "vitest";
import {
  TriggerNode,
  AgentNode,
  ToolNode,
  ConditionNode,
  CommunicationNode,
  IteratorNode,
  nodeTypes,
} from "../index";

describe("TriggerNode", () => {
  it("is exported and is a function component", () => {
    expect(TriggerNode).toBeDefined();
    expect(typeof TriggerNode).toBe("object"); // memo wrapped
  });

  it("has displayName", () => {
    expect(TriggerNode.displayName).toBe("TriggerNode");
  });
});

describe("AgentNode", () => {
  it("is exported and is a function component", () => {
    expect(AgentNode).toBeDefined();
    expect(typeof AgentNode).toBe("object");
  });

  it("has displayName", () => {
    expect(AgentNode.displayName).toBe("AgentNode");
  });
});

describe("ToolNode", () => {
  it("is exported and is a function component", () => {
    expect(ToolNode).toBeDefined();
    expect(typeof ToolNode).toBe("object");
  });

  it("has displayName", () => {
    expect(ToolNode.displayName).toBe("ToolNode");
  });
});

describe("ConditionNode", () => {
  it("is exported and is a function component", () => {
    expect(ConditionNode).toBeDefined();
    expect(typeof ConditionNode).toBe("object");
  });

  it("has displayName", () => {
    expect(ConditionNode.displayName).toBe("ConditionNode");
  });
});

describe("CommunicationNode", () => {
  it("is exported and is a function component", () => {
    expect(CommunicationNode).toBeDefined();
    expect(typeof CommunicationNode).toBe("object");
  });

  it("has displayName", () => {
    expect(CommunicationNode.displayName).toBe("CommunicationNode");
  });
});

describe("IteratorNode", () => {
  it("is exported and is a function component", () => {
    expect(IteratorNode).toBeDefined();
    expect(typeof IteratorNode).toBe("object");
  });

  it("has displayName", () => {
    expect(IteratorNode.displayName).toBe("IteratorNode");
  });
});

describe("nodeTypes export", () => {
  it("exports all node types", () => {
    expect(nodeTypes).toHaveProperty("trigger");
    expect(nodeTypes).toHaveProperty("agent");
    expect(nodeTypes).toHaveProperty("tool");
    expect(nodeTypes).toHaveProperty("condition");
    expect(nodeTypes).toHaveProperty("communication");
    expect(nodeTypes).toHaveProperty("iterator");
  });

  it("has correct node components", () => {
    expect(nodeTypes.trigger).toBe(TriggerNode);
    expect(nodeTypes.agent).toBe(AgentNode);
    expect(nodeTypes.tool).toBe(ToolNode);
    expect(nodeTypes.condition).toBe(ConditionNode);
    expect(nodeTypes.communication).toBe(CommunicationNode);
    expect(nodeTypes.iterator).toBe(IteratorNode);
  });

  it("has exactly 6 node types", () => {
    expect(Object.keys(nodeTypes)).toHaveLength(6);
  });
});

describe("Node types are valid for React Flow", () => {
  it("all node types are memo-wrapped React components", () => {
    // React.memo components have a $$typeof Symbol for type checking
    Object.values(nodeTypes).forEach((NodeComponent) => {
      expect(NodeComponent).toBeDefined();
      // Memo components have a 'type' property with the wrapped component
      expect(NodeComponent).toHaveProperty("type");
    });
  });
});
