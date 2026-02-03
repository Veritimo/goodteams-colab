/**
 * WorkflowDesigner Component
 *
 * Main visual workflow designer using React Flow.
 * Provides drag-and-drop node creation, edge connections,
 * and real-time validation.
 *
 * @see docs/IMPLEMENTATION-PLAN-PHASE7.md §5
 */

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type OnConnect,
  BackgroundVariant,
} from "@xyflow/react";
import { useCallback, useState, useMemo } from "react";
import type { DesignerNode, DesignerEdge, ViewMode, WorkflowDesignerCallbacks } from "./types";
import { nodeTypes } from "./nodes";

// =============================================================================
// TYPES
// =============================================================================

export interface WorkflowDesignerProps {
  /** Workflow ID (null for new workflow) */
  workflowId?: string | null;
  /** Workflow name */
  name?: string;
  /** Initial nodes */
  initialNodes?: DesignerNode[];
  /** Initial edges */
  initialEdges?: DesignerEdge[];
  /** Whether designer is read-only */
  readOnly?: boolean;
  /** Callbacks for designer events */
  callbacks?: WorkflowDesignerCallbacks;
  /** CSS class for the container */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Visual workflow designer component
 */
export function WorkflowDesigner({
  workflowId,
  name = "Untitled Workflow",
  initialNodes = [],
  initialEdges = [],
  readOnly = false,
  callbacks,
  className,
}: WorkflowDesignerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<DesignerNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<DesignerEdge>(initialEdges);
  const [viewMode, setViewMode] = useState<ViewMode>("DESIGN");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Handle new connections
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
      setHasUnsavedChanges(true);
    },
    [setEdges],
  );

  // Handle node selection
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: DesignerNode) => {
      setSelectedNodeId(node.id);
      callbacks?.onNodeSelect?.(node.id);
    },
    [callbacks],
  );

  // Handle pane click (deselect)
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    callbacks?.onNodeSelect?.(null);
  }, [callbacks]);

  // Handle node changes
  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes);
      setHasUnsavedChanges(true);
    },
    [onNodesChange],
  );

  // Handle edge changes
  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      onEdgesChange(changes);
      setHasUnsavedChanges(true);
    },
    [onEdgesChange],
  );

  // Save workflow
  const handleSave = useCallback(async () => {
    if (callbacks?.onSave) {
      await callbacks.onSave(nodes, edges);
      setHasUnsavedChanges(false);
    }
  }, [callbacks, nodes, edges]);

  // Execute workflow
  const handleExecute = useCallback(async () => {
    if (callbacks?.onExecute) {
      return callbacks.onExecute();
    }
    return null;
  }, [callbacks]);

  // Toggle view mode
  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      callbacks?.onViewChange?.(mode);
    },
    [callbacks],
  );

  // Get selected node
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  // Render JSON view
  if (viewMode === "JSON") {
    const jsonContent = JSON.stringify({ nodes, edges }, null, 2);
    return (
      <div
        className={className}
        style={{ display: "flex", flexDirection: "column", height: "100%" }}
      >
        <div
          style={{ padding: "8px", borderBottom: "1px solid #eee", display: "flex", gap: "8px" }}
        >
          <button onClick={() => handleViewModeChange("DESIGN")}>Design View</button>
          <span style={{ marginLeft: "auto", color: "#666" }}>{name}</span>
        </div>
        <pre
          style={{
            flex: 1,
            overflow: "auto",
            margin: 0,
            padding: "16px",
            backgroundColor: "#f5f5f5",
            fontFamily: "monospace",
            fontSize: "12px",
          }}
        >
          {jsonContent}
        </pre>
      </div>
    );
  }

  // Render design view
  return (
    <div className={className} style={{ display: "flex", height: "100%" }}>
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={readOnly ? undefined : handleNodesChange}
          onEdgesChange={readOnly ? undefined : handleEdgesChange}
          onConnect={readOnly ? undefined : onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls showInteractive={!readOnly} />
          <MiniMap nodeStrokeWidth={3} zoomable pannable />
          <Panel position="top-left">
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <strong>{name}</strong>
              {hasUnsavedChanges && (
                <span style={{ color: "#f59e0b", fontSize: "12px" }}>(unsaved changes)</span>
              )}
            </div>
          </Panel>
          <Panel position="top-right">
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => handleViewModeChange("JSON")}>JSON View</button>
              {!readOnly && (
                <>
                  <button onClick={handleSave} disabled={!hasUnsavedChanges}>
                    Save
                  </button>
                  <button onClick={handleExecute}>Execute</button>
                </>
              )}
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

export default WorkflowDesigner;
