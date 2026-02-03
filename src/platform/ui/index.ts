/**
 * Platform UI Components
 *
 * Public exports for platform UI components.
 * Import from '@platform/ui' to access these components.
 *
 * NOTE: This module is for React/frontend builds (e.g., Vite).
 * It is excluded from the main Node.js TypeScript compilation.
 *
 * @see docs/IMPLEMENTATION-PLAN-PHASE7.md §5
 */

// =============================================================================
// WORKFLOW COMPONENTS
// =============================================================================

export { WorkflowDesigner } from "./workflows/WorkflowDesigner.js";
export type { WorkflowDesignerProps } from "./workflows/WorkflowDesigner.js";

export { PropertiesPanel } from "./workflows/PropertiesPanel.js";
export type { PropertiesPanelProps } from "./workflows/PropertiesPanel.js";

export { ExecutionView } from "./workflows/ExecutionView.js";
export type { ExecutionViewProps, ExecutionData, ExecutionLog } from "./workflows/ExecutionView.js";

// =============================================================================
// WORKFLOW NODES
// =============================================================================

export {
  TriggerNode,
  AgentNode,
  ToolNode,
  ConditionNode,
  CommunicationNode,
  IteratorNode,
  nodeTypes,
} from "./workflows/nodes/index.js";

export type {
  TriggerNodeData,
  AgentNodeData,
  ToolNodeData,
  ConditionNodeData,
  CommunicationNodeData,
  IteratorNodeData,
  WorkflowNodeType,
} from "./workflows/nodes/index.js";

// =============================================================================
// WORKFLOW TYPES
// =============================================================================

export type {
  ViewMode,
  DesignerNode,
  DesignerNodeData,
  DesignerEdge,
  NodePaletteItem,
  NodeCategory,
  ToolSchema,
  WorkflowDesignerState,
  WorkflowApiData,
  WorkflowExecutionResult,
  WorkflowDesignerCallbacks,
} from "./workflows/types.js";

// =============================================================================
// SHARED COMPONENTS
// =============================================================================

export { FormField } from "./workflows/components/FormField.js";
export { ExecutionLogEntry } from "./workflows/components/ExecutionLogEntry.js";
