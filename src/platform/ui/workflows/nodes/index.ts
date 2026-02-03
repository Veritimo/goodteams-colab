/**
 * Custom React Flow node components for workflow builder
 */

import { AgentNode } from "./AgentNode";
import { CommunicationNode } from "./CommunicationNode";
import { ConditionNode } from "./ConditionNode";
import { IteratorNode } from "./IteratorNode";
import { ToolNode } from "./ToolNode";
import { TriggerNode } from "./TriggerNode";

// Re-export components
export { TriggerNode, AgentNode, ToolNode, ConditionNode, CommunicationNode, IteratorNode };

// Re-export types
export type { TriggerNodeData } from "./TriggerNode";
export type { AgentNodeData } from "./AgentNode";
export type { ToolNodeData } from "./ToolNode";
export type { ConditionNodeData } from "./ConditionNode";
export type { CommunicationNodeData } from "./CommunicationNode";
export type { IteratorNodeData } from "./IteratorNode";

/**
 * Node types registry for React Flow
 * Pass this to <ReactFlow nodeTypes={nodeTypes} />
 */
export const nodeTypes = {
  trigger: TriggerNode,
  agent: AgentNode,
  tool: ToolNode,
  condition: ConditionNode,
  communication: CommunicationNode,
  iterator: IteratorNode,
} as const;

export type WorkflowNodeType = keyof typeof nodeTypes;
