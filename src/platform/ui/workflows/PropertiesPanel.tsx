/**
 * PropertiesPanel Component
 *
 * Displays and edits properties for the selected workflow node.
 * Renders type-specific configuration forms.
 *
 * @see docs/IMPLEMENTATION-PLAN-PHASE7.md §5
 */

import { useCallback, useMemo } from "react";
import type { DesignerNode, DesignerNodeData } from "./types";
import { FormField } from "./components/FormField";

// =============================================================================
// TYPES
// =============================================================================

export interface PropertiesPanelProps {
  /** Currently selected node */
  selectedNode: DesignerNode | null;
  /** Callback when node properties change */
  onNodeChange?: (nodeId: string, data: Partial<DesignerNodeData>) => void;
  /** Whether the panel is read-only */
  readOnly?: boolean;
  /** CSS class for the container */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Properties panel for editing selected node configuration
 */
export function PropertiesPanel({
  selectedNode,
  onNodeChange,
  readOnly = false,
  className,
}: PropertiesPanelProps) {
  // Handle field value change
  const handleChange = useCallback(
    (field: string, value: unknown) => {
      if (!selectedNode || !onNodeChange || readOnly) return;

      if (field === "label") {
        onNodeChange(selectedNode.id, { label: value as string });
      } else {
        // Update nested config
        onNodeChange(selectedNode.id, {
          config: {
            ...selectedNode.data.config,
            [field]: value,
          },
        });
      }
    },
    [selectedNode, onNodeChange, readOnly],
  );

  // Get node-specific fields
  const fields = useMemo(() => {
    if (!selectedNode) return [];

    const nodeType = selectedNode.type;
    const config = selectedNode.data.config;

    const commonFields = [
      {
        name: "label",
        label: "Label",
        type: "text" as const,
        value: selectedNode.data.label || "",
      },
    ];

    switch (nodeType) {
      case "trigger":
        return [
          ...commonFields,
          {
            name: "triggerType",
            label: "Trigger Type",
            type: "select" as const,
            value: (config as any).triggerType || "MANUAL",
            options: ["MANUAL", "WEBHOOK", "SCHEDULED", "CHAT", "EMAIL"],
          },
          {
            name: "cronExpression",
            label: "Cron Expression",
            type: "text" as const,
            value: (config as any).cronExpression || "",
            condition: (config as any).triggerType === "SCHEDULED",
          },
          {
            name: "webhookPath",
            label: "Webhook Path",
            type: "text" as const,
            value: (config as any).webhookPath || "",
            condition: (config as any).triggerType === "WEBHOOK",
            readOnly: true,
          },
        ];

      case "agent":
        return [
          ...commonFields,
          {
            name: "prompt",
            label: "Prompt",
            type: "textarea" as const,
            value: (config as any).prompt || "",
            rows: 4,
          },
          {
            name: "systemPrompt",
            label: "System Prompt",
            type: "textarea" as const,
            value: (config as any).systemPrompt || "",
            rows: 2,
          },
          {
            name: "model",
            label: "Model",
            type: "text" as const,
            value: (config as any).model || "",
          },
          {
            name: "temperature",
            label: "Temperature",
            type: "number" as const,
            value: (config as any).temperature ?? 0.7,
            min: 0,
            max: 2,
            step: 0.1,
          },
        ];

      case "tool":
        return [
          ...commonFields,
          {
            name: "toolName",
            label: "Tool Name",
            type: "text" as const,
            value: (config as any).toolName || "",
          },
        ];

      case "condition":
        return [
          ...commonFields,
          {
            name: "expression",
            label: "Expression",
            type: "textarea" as const,
            value: (config as any).expression || "",
            rows: 3,
            placeholder: "e.g., {{inputs.count}} > 5",
          },
        ];

      case "communication":
        return [
          ...commonFields,
          {
            name: "method",
            label: "Method",
            type: "select" as const,
            value: (config as any).method || "email",
            options: ["email", "teams", "chat", "webhook"],
          },
          {
            name: "to",
            label: "To",
            type: "text" as const,
            value: (config as any).to || "",
            condition: (config as any).method === "email",
          },
          {
            name: "subject",
            label: "Subject",
            type: "text" as const,
            value: (config as any).subject || "",
            condition: (config as any).method === "email",
          },
          {
            name: "body",
            label: "Body",
            type: "textarea" as const,
            value: (config as any).body || "",
            rows: 4,
          },
        ];

      case "iterator":
        return [
          ...commonFields,
          {
            name: "collection",
            label: "Collection Path",
            type: "text" as const,
            value: (config as any).collection || "",
            placeholder: "e.g., {{inputs.items}}",
          },
          {
            name: "itemVariable",
            label: "Item Variable",
            type: "text" as const,
            value: (config as any).itemVariable || "item",
          },
          {
            name: "indexVariable",
            label: "Index Variable",
            type: "text" as const,
            value: (config as any).indexVariable || "index",
          },
          {
            name: "maxIterations",
            label: "Max Iterations",
            type: "number" as const,
            value: (config as any).maxIterations ?? 100,
            min: 1,
            max: 1000,
          },
        ];

      default:
        return commonFields;
    }
  }, [selectedNode]);

  // Filter out fields with false conditions
  const visibleFields = fields.filter((f) => f.condition !== false);

  // Render empty state
  if (!selectedNode) {
    return (
      <div
        className={className}
        style={{
          padding: "16px",
          color: "#666",
          textAlign: "center",
        }}
      >
        <p>Select a node to view its properties</p>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <h3 style={{ margin: 0, borderBottom: "1px solid #eee", paddingBottom: "8px" }}>
        {selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1)} Node
      </h3>

      {visibleFields.map((field) => (
        <FormField
          key={field.name}
          name={field.name}
          label={field.label}
          type={field.type}
          value={field.value}
          onChange={(value) => handleChange(field.name, value)}
          disabled={readOnly || field.readOnly}
          options={field.options}
          rows={field.rows}
          min={field.min}
          max={field.max}
          step={field.step}
          placeholder={field.placeholder}
        />
      ))}

      <div style={{ marginTop: "auto", fontSize: "12px", color: "#999" }}>
        Node ID: {selectedNode.id}
      </div>
    </div>
  );
}

export default PropertiesPanel;
