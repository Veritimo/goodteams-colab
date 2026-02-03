/**
 * useWorkflowDesigner Hook
 *
 * Custom hook for managing workflow designer state including
 * loading, saving, change tracking, and execution.
 */

import { useNodesState, useEdgesState, addEdge, type Connection } from "@xyflow/react";
import { useState, useCallback, useEffect, useMemo } from "react";
import type { WorkflowNodeType } from "../../../workflows/types.js";
import type {
  DesignerNode,
  DesignerEdge,
  ViewMode,
  WorkflowApiData,
  WorkflowExecutionResult,
  NodePaletteItem,
} from "../types.js";

// =============================================================================
// TYPES
// =============================================================================

export interface UseWorkflowDesignerOptions {
  /** Workflow ID to load */
  workflowId: string;
  /** API base URL */
  apiBaseUrl?: string;
  /** Default model for agent nodes */
  defaultModel?: string;
}

export interface UseWorkflowDesignerResult {
  /** Current nodes */
  nodes: DesignerNode[];
  /** Current edges */
  edges: DesignerEdge[];
  /** React Flow node change handler */
  onNodesChange: ReturnType<typeof useNodesState>[2];
  /** React Flow edge change handler */
  onEdgesChange: ReturnType<typeof useEdgesState>[2];
  /** React Flow connection handler */
  onConnect: (connection: Connection) => void;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Whether the workflow is loading */
  isLoading: boolean;
  /** Whether save is in progress */
  isSaving: boolean;
  /** Whether execution is in progress */
  isExecuting: boolean;
  /** Current error message */
  error: string | null;
  /** Loaded workflow data */
  workflow: WorkflowApiData | null;
  /** Current view mode */
  viewMode: ViewMode;
  /** Selected node ID */
  selectedNodeId: string | null;
  /** JSON content for JSON view */
  jsonContent: string;
  /** Save the workflow */
  saveWorkflow: () => Promise<boolean>;
  /** Execute the workflow */
  executeWorkflow: (inputs?: Record<string, unknown>) => Promise<WorkflowExecutionResult | null>;
  /** Add a node from the palette */
  addNode: (item: NodePaletteItem) => void;
  /** Delete a node */
  deleteNode: (nodeId: string) => void;
  /** Select a node */
  selectNode: (nodeId: string | null) => void;
  /** Update a node's data */
  updateNodeData: (nodeId: string, data: Partial<DesignerNode["data"]>) => void;
  /** Toggle view mode */
  toggleViewMode: (mode: ViewMode) => void;
  /** Set JSON content (for JSON view) */
  setJsonContent: (content: string) => void;
  /** Get workflow fingerprint for comparison */
  getWorkflowFingerprint: () => string;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useWorkflowDesigner(
  options: UseWorkflowDesignerOptions,
): UseWorkflowDesignerResult {
  const { workflowId, apiBaseUrl = "/api/platform", defaultModel = "gpt-4" } = options;

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<DesignerNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<DesignerEdge>([]);

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>("DESIGN");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [jsonContent, setJsonContent] = useState("");

  // Loading/saving state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowApiData | null>(null);

  // Change tracking
  const [lastSavedFingerprint, setLastSavedFingerprint] = useState("");

  // ---------------------------------------------------------------------------
  // FINGERPRINT - for change detection
  // ---------------------------------------------------------------------------

  const getWorkflowFingerprint = useCallback(() => {
    const essentialNodes = nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    }));
    const essentialEdges = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    }));
    return JSON.stringify({ nodes: essentialNodes, edges: essentialEdges });
  }, [nodes, edges]);

  const hasUnsavedChanges = useMemo(() => {
    if (!lastSavedFingerprint) return false;
    return getWorkflowFingerprint() !== lastSavedFingerprint;
  }, [getWorkflowFingerprint, lastSavedFingerprint]);

  // ---------------------------------------------------------------------------
  // LOAD WORKFLOW
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let mounted = true;

    async function loadWorkflow() {
      if (!workflowId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiBaseUrl}/workflows/${workflowId}`);
        if (!response.ok) {
          throw new Error(`Failed to load workflow: ${response.statusText}`);
        }

        const data: WorkflowApiData = await response.json();

        if (!mounted) return;

        setWorkflow(data);

        // Parse definition and set nodes/edges
        if (data.definition) {
          const loadedNodes = (data.definition.nodes || []).map((n, i) => ({
            ...n,
            position: n.position || { x: 100 + i * 300, y: 100 + i * 50 },
            data: n.data || { label: "Untitled", config: {} },
          }));
          setNodes(loadedNodes as DesignerNode[]);
          setEdges((data.definition.edges || []) as DesignerEdge[]);

          // Set initial fingerprint
          const fingerprint = JSON.stringify({
            nodes: loadedNodes.map((n) => ({
              id: n.id,
              type: n.type,
              position: n.position,
              data: n.data,
            })),
            edges: (data.definition.edges || []).map((e) => ({
              id: e.id,
              source: e.source,
              target: e.target,
              sourceHandle: e.sourceHandle,
              targetHandle: e.targetHandle,
            })),
          });
          setLastSavedFingerprint(fingerprint);
        }
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load workflow");
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadWorkflow();

    return () => {
      mounted = false;
    };
  }, [workflowId, apiBaseUrl, setNodes, setEdges]);

  // ---------------------------------------------------------------------------
  // SAVE WORKFLOW
  // ---------------------------------------------------------------------------

  const saveWorkflow = useCallback(async (): Promise<boolean> => {
    if (!workflowId) {
      setError("No workflow ID");
      return false;
    }

    setIsSaving(true);
    setError(null);

    try {
      let finalNodes = nodes;
      let finalEdges = edges;

      // If in JSON view, parse JSON content
      if (viewMode === "JSON") {
        try {
          const parsed = JSON.parse(jsonContent);
          finalNodes = parsed.nodes || [];
          finalEdges = parsed.edges || [];
        } catch {
          setError("Invalid JSON content");
          setIsSaving(false);
          return false;
        }
      }

      const response = await fetch(`${apiBaseUrl}/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          definition: { nodes: finalNodes, edges: finalEdges },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save workflow: ${response.statusText}`);
      }

      // Update nodes/edges if we parsed from JSON
      if (viewMode === "JSON") {
        setNodes(finalNodes as DesignerNode[]);
        setEdges(finalEdges as DesignerEdge[]);
      }

      // Update saved fingerprint
      const fingerprint = JSON.stringify({
        nodes: finalNodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data,
        })),
        edges: finalEdges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
        })),
      });
      setLastSavedFingerprint(fingerprint);

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save workflow");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [workflowId, apiBaseUrl, nodes, edges, viewMode, jsonContent, setNodes, setEdges]);

  // ---------------------------------------------------------------------------
  // EXECUTE WORKFLOW
  // ---------------------------------------------------------------------------

  const executeWorkflow = useCallback(
    async (inputs?: Record<string, unknown>): Promise<WorkflowExecutionResult | null> => {
      if (!workflowId) {
        setError("No workflow ID");
        return null;
      }

      setIsExecuting(true);
      setError(null);

      try {
        const response = await fetch(`${apiBaseUrl}/workflows/${workflowId}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inputs }),
        });

        if (!response.ok) {
          throw new Error(`Failed to execute workflow: ${response.statusText}`);
        }

        const result: WorkflowExecutionResult = await response.json();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to execute workflow");
        return null;
      } finally {
        setIsExecuting(false);
      }
    },
    [workflowId, apiBaseUrl],
  );

  // ---------------------------------------------------------------------------
  // NODE OPERATIONS
  // ---------------------------------------------------------------------------

  const addNode = useCallback(
    (item: NodePaletteItem) => {
      const id = `${item.type}_${Date.now()}`;
      const newNode: DesignerNode = {
        id,
        type: item.type,
        position: {
          x: Math.random() * 400 + 200,
          y: Math.random() * 400 + 200,
        },
        data: {
          label: item.label,
          config:
            item.type === "agent"
              ? { prompt: "", modelName: defaultModel, ...item.defaultConfig }
              : { ...item.defaultConfig },
        },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes, defaultModel],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
    },
    [setNodes, setEdges, selectedNodeId],
  );

  const selectNode = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  }, []);

  const updateNodeData = useCallback(
    (nodeId: string, data: Partial<DesignerNode["data"]>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)),
      );
    },
    [setNodes],
  );

  // ---------------------------------------------------------------------------
  // CONNECTION HANDLER
  // ---------------------------------------------------------------------------

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges],
  );

  // ---------------------------------------------------------------------------
  // VIEW MODE
  // ---------------------------------------------------------------------------

  const toggleViewMode = useCallback(
    (mode: ViewMode) => {
      if (mode === "JSON") {
        // Serialize current state to JSON
        const payload = { nodes, edges };
        setJsonContent(JSON.stringify(payload, null, 2));
      } else {
        // Parse JSON and apply to canvas (if valid)
        try {
          const parsed = JSON.parse(jsonContent);
          if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
            setNodes(parsed.nodes);
            setEdges(parsed.edges);
          }
        } catch {
          // Keep existing state if JSON is invalid
        }
      }
      setViewMode(mode);
    },
    [nodes, edges, jsonContent, setNodes, setEdges],
  );

  // ---------------------------------------------------------------------------
  // WARN ON UNSAVED CHANGES
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // ---------------------------------------------------------------------------
  // RETURN
  // ---------------------------------------------------------------------------

  return {
    // State
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    hasUnsavedChanges,
    isLoading,
    isSaving,
    isExecuting,
    error,
    workflow,
    viewMode,
    selectedNodeId,
    jsonContent,

    // Actions
    saveWorkflow,
    executeWorkflow,
    addNode,
    deleteNode,
    selectNode,
    updateNodeData,
    toggleViewMode,
    setJsonContent,
    getWorkflowFingerprint,
  };
}

export default useWorkflowDesigner;
