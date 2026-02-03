/**
 * Workflow Designer UI Types
 *
 * UI-specific type definitions for the workflow designer component.
 * Extends base workflow types with React Flow integration.
 *
 * @see src/platform/workflows/types.ts for core workflow types
 */

import type { Node, Edge } from "@xyflow/react";
import type { WorkflowNodeType, NodeConfig, WorkflowNodeData } from "../../workflows/types.js";

// =============================================================================
// VIEW MODES
// =============================================================================

/**
 * Designer view modes
 */
export type ViewMode = "DESIGN" | "JSON";

// =============================================================================
// DESIGNER NODE TYPES
// =============================================================================

/**
 * Extended node data for the designer UI
 */
export interface DesignerNodeData extends WorkflowNodeData {
  /** Human-readable label */
  label: string;
  /** Type-specific configuration */
  config: NodeConfig;
  /** Tool name for tool nodes */
  toolName?: string;
  /** Tool description for display */
  toolDescription?: string;
  /** Full tool schema for properties panel */
  toolSchema?: ToolSchema;
  /** Whether the node is selected */
  selected?: boolean;
}

/**
 * A node in the designer canvas
 * Extends React Flow's Node type with our data structure
 */
export type DesignerNode = Node<DesignerNodeData, WorkflowNodeType>;

/**
 * An edge in the designer canvas
 * Extends React Flow's Edge type with optional label
 */
export interface DesignerEdge extends Edge {
  /** Optional label for conditional edges */
  label?: string;
  /** Animation state */
  animated?: boolean;
}

// =============================================================================
// NODE PALETTE
// =============================================================================

/**
 * Category of nodes in the palette
 */
export type NodeCategory = "logic" | "sql" | "tools";

/**
 * Item in the node palette for drag-and-drop
 */
export interface NodePaletteItem {
  /** Node type to create */
  type: WorkflowNodeType;
  /** Display label */
  label: string;
  /** Description shown on hover */
  description?: string;
  /** Icon name or component */
  icon?: string;
  /** Color theme for the node */
  color?: string;
  /** Category for grouping */
  category: NodeCategory;
  /** Default configuration */
  defaultConfig?: Partial<NodeConfig>;
}

/**
 * Schema for a tool (from engine registry)
 */
export interface ToolSchema {
  /** Tool name */
  name: string;
  /** Tool description */
  description?: string;
  /** Input parameters schema */
  parameters?: {
    type: string;
    properties?: Record<
      string,
      {
        type: string;
        description?: string;
        required?: boolean;
        enum?: string[];
        default?: unknown;
      }
    >;
    required?: string[];
  };
}

// =============================================================================
// WORKFLOW STATE
// =============================================================================

/**
 * Current state of the workflow in the designer
 */
export interface WorkflowDesignerState {
  /** Current nodes */
  nodes: DesignerNode[];
  /** Current edges */
  edges: DesignerEdge[];
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Currently selected node ID */
  selectedNodeId: string | null;
  /** Current view mode */
  viewMode: ViewMode;
  /** JSON content for JSON view */
  jsonContent: string;
}

// =============================================================================
// API TYPES
// =============================================================================

/**
 * Workflow data from the API
 */
export interface WorkflowApiData {
  id: string;
  name: string;
  description?: string;
  status: string;
  definition?: {
    nodes: DesignerNode[];
    edges: DesignerEdge[];
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Execution result from running a workflow
 */
export interface WorkflowExecutionResult {
  executionId: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  startedAt?: string;
  finishedAt?: string;
  outputs?: Record<string, unknown>;
  error?: string;
}

// =============================================================================
// DESIGNER CALLBACKS
// =============================================================================

/**
 * Callbacks for the workflow designer
 */
export interface WorkflowDesignerCallbacks {
  /** Called when workflow is saved */
  onSave?: (nodes: DesignerNode[], edges: DesignerEdge[]) => Promise<void>;
  /** Called when workflow is executed */
  onExecute?: () => Promise<WorkflowExecutionResult>;
  /** Called when a node is selected */
  onNodeSelect?: (nodeId: string | null) => void;
  /** Called when view mode changes */
  onViewChange?: (mode: ViewMode) => void;
  /** Called when navigating away */
  onNavigateBack?: () => void;
}
