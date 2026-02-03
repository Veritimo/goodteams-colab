/**
 * Workflow Generator
 *
 * Uses LLM to generate workflow definitions from natural language prompts.
 * Reference: docs/IMPLEMENTATION-PLAN-PHASE7.md §6.2
 */

import type { WorkflowDefinition, TriggerType, TriggerNodeConfig } from "../types.js";

// =============================================================================
// TYPES
// =============================================================================

export interface GeneratorContext {
  tenantId: string;
  userId: string;
  availableTools?: string[];
  existingConnections?: Array<{ id: string; name: string; type: string }>;
}

export interface GeneratedWorkflow {
  definition: WorkflowDefinition;
  triggerType: TriggerType;
  triggerConfig: TriggerNodeConfig;
  suggestedName?: string;
  suggestedDescription?: string;
  confidence: number;
  warnings: string[];
}

export interface LLMProvider {
  generateText(params: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<{ text: string }>;
}

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

const WORKFLOW_GENERATOR_SYSTEM_PROMPT = `You are a workflow automation expert. Generate JSON workflow definitions from natural language descriptions.

## Available Node Types

### 1. trigger
Starting point for workflow execution.
Config:
- triggerType: "MANUAL" | "CRON" | "WEBHOOK" | "CHAT"
- cronExpression: string (for CRON, e.g., "0 9 * * 1" for every Monday at 9am)
- timezone: string (e.g., "America/New_York")
- triggerPhrase: string (for CHAT triggers)
- webhookPath: string (auto-generated for WEBHOOK)

### 2. agent
LLM execution with optional tool access.
Config:
- prompt: string (supports {{variables}} like {{inputs.name}} or {{nodes.nodeId.output}})
- systemPrompt: string (optional)
- tools: string[] (optional, tool names agent can use)
- model: string (optional, override default)
- temperature: number (optional, 0-1)

### 3. tool
Direct tool execution without LLM.
Config:
- toolName: string (e.g., "execute_sql_query", "execute_crm_query")
- Additional tool-specific parameters

### 4. condition
Branch based on expression.
Config:
- expression: string (JavaScript expression, e.g., "{{nodes.query.rowCount}} > 0")
Output handles: "true" and "false"

### 5. communication
Send notifications.
Config:
- method: "email" | "teams" | "chat"
- to: string (for email)
- subject: string (for email)
- body: string (supports {{variables}})
- teamId/channelId: string (for Teams)
- conversationId: string (for chat)

### 6. iterator
Loop over arrays.
Config:
- collection: string (variable path like {{nodes.query.data.rows}})
- itemVariable: string (name for current item)

## Variable Resolution
- \`{{inputs.fieldName}}\` - Access workflow input
- \`{{nodes.nodeId.fieldName}}\` - Access output from previous node
- \`{{globalVariables.fieldName}}\` - Access global variables

## Output Format
Return a JSON object with this structure:
{
  "definition": {
    "nodes": [...],
    "edges": [...],
    "globalConfig": {...}
  },
  "triggerType": "MANUAL" | "CRON" | "WEBHOOK" | "CHAT",
  "triggerConfig": {...},
  "suggestedName": "string",
  "suggestedDescription": "string",
  "confidence": 0.0-1.0,
  "warnings": ["any concerns or assumptions"]
}

## Rules
1. Always include a trigger node as the first node
2. Connect nodes with edges (source -> target)
3. Use unique node IDs (e.g., "trigger-1", "agent-1", "condition-1")
4. Position nodes for visual clarity (increment x by 300, y for branches)
5. For conditions, use sourceHandle "true" or "false" on edges
6. Validate variable references exist in previous nodes
7. Set confidence based on how well you understood the request
8. Add warnings for any assumptions or ambiguities`;

// =============================================================================
// VALIDATION
// =============================================================================

export function validateWorkflowDefinition(definition: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!definition || typeof definition !== "object") {
    return { valid: false, errors: ["Definition must be an object"] };
  }

  const def = definition as Record<string, unknown>;

  // Check nodes
  if (!Array.isArray(def.nodes)) {
    errors.push("Definition must have a nodes array");
  } else {
    const nodeIds = new Set<string>();

    for (let i = 0; i < def.nodes.length; i++) {
      const node = def.nodes[i] as Record<string, unknown>;

      if (!node.id || typeof node.id !== "string") {
        errors.push(`Node ${i} must have a string id`);
      } else {
        if (nodeIds.has(node.id)) {
          errors.push(`Duplicate node id: ${node.id}`);
        }
        nodeIds.add(node.id);
      }

      if (!node.type || typeof node.type !== "string") {
        errors.push(`Node ${i} must have a string type`);
      }

      const validTypes = ["trigger", "agent", "tool", "condition", "communication", "iterator"];
      if (node.type && !validTypes.includes(node.type as string)) {
        errors.push(`Node ${i} has invalid type: ${node.type}`);
      }

      if (!node.position || typeof node.position !== "object") {
        errors.push(`Node ${i} must have a position object`);
      }

      if (!node.data || typeof node.data !== "object") {
        errors.push(`Node ${i} must have a data object`);
      }
    }
  }

  // Check edges
  if (!Array.isArray(def.edges)) {
    errors.push("Definition must have an edges array");
  } else {
    const nodeIds = new Set(
      Array.isArray(def.nodes)
        ? def.nodes.map((n) => (n as Record<string, unknown>).id as string)
        : [],
    );

    for (let i = 0; i < def.edges.length; i++) {
      const edge = def.edges[i] as Record<string, unknown>;

      if (!edge.id || typeof edge.id !== "string") {
        errors.push(`Edge ${i} must have a string id`);
      }

      if (!edge.source || typeof edge.source !== "string") {
        errors.push(`Edge ${i} must have a string source`);
      } else if (!nodeIds.has(edge.source)) {
        errors.push(`Edge ${i} references non-existent source node: ${edge.source}`);
      }

      if (!edge.target || typeof edge.target !== "string") {
        errors.push(`Edge ${i} must have a string target`);
      } else if (!nodeIds.has(edge.target)) {
        errors.push(`Edge ${i} references non-existent target node: ${edge.target}`);
      }
    }
  }

  // Check for trigger node
  if (Array.isArray(def.nodes)) {
    const hasTrigger = def.nodes.some((n) => (n as Record<string, unknown>).type === "trigger");
    if (!hasTrigger) {
      errors.push("Workflow must have at least one trigger node");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// GENERATOR
// =============================================================================

export async function generateWorkflowFromPrompt(
  prompt: string,
  context: GeneratorContext,
  llmProvider: LLMProvider,
): Promise<GeneratedWorkflow> {
  // Build user prompt with context
  let userPrompt = `Create a workflow for the following request:\n\n${prompt}`;

  if (context.availableTools && context.availableTools.length > 0) {
    userPrompt += `\n\nAvailable tools: ${context.availableTools.join(", ")}`;
  }

  if (context.existingConnections && context.existingConnections.length > 0) {
    userPrompt += `\n\nExisting connections:\n${context.existingConnections
      .map((c) => `- ${c.name} (${c.type}, id: ${c.id})`)
      .join("\n")}`;
  }

  userPrompt += "\n\nRespond with valid JSON only, no markdown code blocks.";

  // Call LLM
  const response = await llmProvider.generateText({
    systemPrompt: WORKFLOW_GENERATOR_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 4000,
    temperature: 0.3,
  });

  // Parse response
  let parsed: unknown;
  try {
    // Try to extract JSON from response (handle markdown code blocks)
    let jsonText = response.text.trim();
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }
    parsed = JSON.parse(jsonText);
  } catch (parseError) {
    throw new Error(
      `Failed to parse LLM response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
    );
  }

  // Validate structure
  const result = parsed as Record<string, unknown>;

  if (!result.definition) {
    throw new Error("LLM response missing 'definition' field");
  }

  const validation = validateWorkflowDefinition(result.definition);
  if (!validation.valid) {
    throw new Error(`Invalid workflow definition: ${validation.errors.join("; ")}`);
  }

  // Extract trigger info
  const triggerType = (result.triggerType as TriggerType) || "MANUAL";
  const triggerConfig = (result.triggerConfig as TriggerNodeConfig) || {
    triggerType,
  };

  return {
    definition: result.definition as WorkflowDefinition,
    triggerType,
    triggerConfig,
    suggestedName: typeof result.suggestedName === "string" ? result.suggestedName : undefined,
    suggestedDescription:
      typeof result.suggestedDescription === "string" ? result.suggestedDescription : undefined,
    confidence: typeof result.confidence === "number" ? result.confidence : 0.5,
    warnings: Array.isArray(result.warnings)
      ? result.warnings.filter((w): w is string => typeof w === "string")
      : [],
  };
}

// =============================================================================
// EXAMPLES
// =============================================================================

/**
 * Example workflow definitions for reference and testing
 */
export const EXAMPLE_WORKFLOWS = {
  simpleManual: {
    definition: {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger" as const,
          position: { x: 0, y: 0 },
          data: {
            label: "Manual Trigger",
            config: { triggerType: "MANUAL" },
          },
        },
        {
          id: "agent-1",
          type: "agent" as const,
          position: { x: 300, y: 0 },
          data: {
            label: "Process Request",
            config: {
              prompt: "Process the following input: {{inputs.data}}",
            },
          },
        },
      ],
      edges: [
        {
          id: "edge-1",
          source: "trigger-1",
          target: "agent-1",
        },
      ],
    },
    triggerType: "MANUAL" as TriggerType,
    triggerConfig: { triggerType: "MANUAL" as const },
  },

  cronWithCondition: {
    definition: {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger" as const,
          position: { x: 0, y: 0 },
          data: {
            label: "Weekly Trigger",
            config: {
              triggerType: "CRON",
              cronExpression: "0 9 * * 1",
              timezone: "America/New_York",
            },
          },
        },
        {
          id: "tool-1",
          type: "tool" as const,
          position: { x: 300, y: 0 },
          data: {
            label: "Query Database",
            config: {
              toolName: "execute_sql_query",
              query:
                "SELECT COUNT(*) as count FROM orders WHERE created_at > NOW() - INTERVAL '7 days'",
            },
          },
        },
        {
          id: "condition-1",
          type: "condition" as const,
          position: { x: 600, y: 0 },
          data: {
            label: "Has Orders?",
            config: {
              expression: "{{nodes.tool-1.count}} > 0",
            },
          },
        },
        {
          id: "comm-1",
          type: "communication" as const,
          position: { x: 900, y: -100 },
          data: {
            label: "Send Report",
            config: {
              method: "email",
              to: "team@example.com",
              subject: "Weekly Orders Report",
              body: "We had {{nodes.tool-1.count}} orders this week.",
            },
          },
        },
        {
          id: "comm-2",
          type: "communication" as const,
          position: { x: 900, y: 100 },
          data: {
            label: "No Orders Alert",
            config: {
              method: "email",
              to: "team@example.com",
              subject: "No Orders This Week",
              body: "No new orders were recorded this week.",
            },
          },
        },
      ],
      edges: [
        { id: "edge-1", source: "trigger-1", target: "tool-1" },
        { id: "edge-2", source: "tool-1", target: "condition-1" },
        { id: "edge-3", source: "condition-1", target: "comm-1", sourceHandle: "true" },
        { id: "edge-4", source: "condition-1", target: "comm-2", sourceHandle: "false" },
      ],
    },
    triggerType: "CRON" as TriggerType,
    triggerConfig: {
      triggerType: "CRON" as const,
      cronExpression: "0 9 * * 1",
      timezone: "America/New_York",
    },
  },
} as const;
