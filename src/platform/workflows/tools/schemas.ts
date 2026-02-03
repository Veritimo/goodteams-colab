/**
 * Workflow Tool Schemas
 *
 * TypeBox schemas for agent-accessible workflow tools.
 * Reference: docs/IMPLEMENTATION-PLAN-PHASE7.md §6
 */

import { Type, type Static } from "@sinclair/typebox";

// =============================================================================
// COMMON TYPES
// =============================================================================

const WorkflowStatusEnum = Type.Union([
  Type.Literal("DRAFT"),
  Type.Literal("ACTIVE"),
  Type.Literal("PAUSED"),
  Type.Literal("ARCHIVED"),
]);

const TriggerTypeEnum = Type.Union([
  Type.Literal("MANUAL"),
  Type.Literal("CRON"),
  Type.Literal("WEBHOOK"),
  Type.Literal("CHAT"),
  Type.Literal("EMAIL"),
]);

const ExecutionStatusEnum = Type.Union([
  Type.Literal("PENDING"),
  Type.Literal("RUNNING"),
  Type.Literal("COMPLETED"),
  Type.Literal("FAILED"),
  Type.Literal("WAITING_FOR_INPUT"),
]);

// =============================================================================
// WORKFLOW_LIST
// =============================================================================

export const WorkflowListSchema = Type.Object({
  status: Type.Optional(WorkflowStatusEnum),
  limit: Type.Optional(
    Type.Number({
      minimum: 1,
      maximum: 100,
      default: 20,
      description: "Maximum number of workflows to return (1-100)",
    }),
  ),
  offset: Type.Optional(
    Type.Number({
      minimum: 0,
      default: 0,
      description: "Number of workflows to skip for pagination",
    }),
  ),
});

export type WorkflowListParams = Static<typeof WorkflowListSchema>;

// =============================================================================
// WORKFLOW_GET
// =============================================================================

export const WorkflowGetSchema = Type.Object({
  workflowId: Type.String({
    description: "Unique identifier of the workflow",
  }),
});

export type WorkflowGetParams = Static<typeof WorkflowGetSchema>;

// =============================================================================
// WORKFLOW_CREATE
// =============================================================================

export const WorkflowCreateSchema = Type.Object({
  name: Type.String({
    description: "Name for the workflow",
    minLength: 1,
    maxLength: 200,
  }),
  description: Type.Optional(
    Type.String({
      description: "Optional description of what the workflow does",
      maxLength: 2000,
    }),
  ),
  prompt: Type.Optional(
    Type.String({
      description:
        "Natural language description to generate workflow from. Use this OR definition, not both.",
      maxLength: 10000,
    }),
  ),
  definition: Type.Optional(
    Type.Object(
      {
        nodes: Type.Array(
          Type.Object({
            id: Type.String(),
            type: Type.String(),
            position: Type.Object({
              x: Type.Number(),
              y: Type.Number(),
            }),
            data: Type.Object({
              label: Type.Optional(Type.String()),
              config: Type.Record(Type.String(), Type.Unknown()),
            }),
          }),
        ),
        edges: Type.Array(
          Type.Object({
            id: Type.String(),
            source: Type.String(),
            target: Type.String(),
            sourceHandle: Type.Optional(Type.String()),
          }),
        ),
        globalConfig: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
      },
      {
        description: "Explicit workflow definition. Use this OR prompt, not both.",
      },
    ),
  ),
  triggerType: Type.Optional(TriggerTypeEnum),
  triggerConfig: Type.Optional(
    Type.Object(
      {},
      {
        additionalProperties: true,
        description: "Trigger-specific configuration (cron expression, webhook secret, etc.)",
      },
    ),
  ),
});

export type WorkflowCreateParams = Static<typeof WorkflowCreateSchema>;

// =============================================================================
// WORKFLOW_UPDATE
// =============================================================================

export const WorkflowUpdateSchema = Type.Object({
  workflowId: Type.String({
    description: "Unique identifier of the workflow to update",
  }),
  name: Type.Optional(
    Type.String({
      description: "New name for the workflow",
      minLength: 1,
      maxLength: 200,
    }),
  ),
  description: Type.Optional(
    Type.String({
      description: "New description",
      maxLength: 2000,
    }),
  ),
  definition: Type.Optional(
    Type.Object(
      {
        nodes: Type.Array(Type.Unknown()),
        edges: Type.Array(Type.Unknown()),
        globalConfig: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
      },
      { description: "Updated workflow definition" },
    ),
  ),
  status: Type.Optional(
    Type.Union([Type.Literal("DRAFT"), Type.Literal("ACTIVE"), Type.Literal("PAUSED")], {
      description: "New status (cannot set to ARCHIVED via update)",
    }),
  ),
  triggerType: Type.Optional(TriggerTypeEnum),
  triggerConfig: Type.Optional(Type.Object({}, { additionalProperties: true })),
});

export type WorkflowUpdateParams = Static<typeof WorkflowUpdateSchema>;

// =============================================================================
// WORKFLOW_EXECUTE
// =============================================================================

export const WorkflowExecuteSchema = Type.Object({
  workflowId: Type.String({
    description: "Unique identifier of the workflow to execute",
  }),
  inputs: Type.Optional(
    Type.Record(Type.String(), Type.Unknown(), {
      description: "Input variables for the workflow execution",
    }),
  ),
});

export type WorkflowExecuteParams = Static<typeof WorkflowExecuteSchema>;

// =============================================================================
// WORKFLOW_STATUS
// =============================================================================

export const WorkflowStatusSchema = Type.Object({
  executionId: Type.String({
    description: "Unique identifier of the workflow execution",
  }),
});

export type WorkflowStatusParams = Static<typeof WorkflowStatusSchema>;

// =============================================================================
// TOOL DEFINITIONS FOR REGISTRATION
// =============================================================================

export const WORKFLOW_TOOL_DEFINITIONS = {
  workflow_list: {
    name: "workflow_list",
    description: `List workflows in the current tenant.

USAGE:
- List all active workflows: workflow_list({ status: "ACTIVE" })
- List all workflows: workflow_list({})
- Paginate: workflow_list({ limit: 10, offset: 20 })

Returns array of workflows with id, name, status, description, and trigger info.`,
    schema: WorkflowListSchema,
  },

  workflow_get: {
    name: "workflow_get",
    description: `Get detailed information about a specific workflow.

USAGE:
- workflow_get({ workflowId: "abc123" })

Returns full workflow including definition, trigger config, and execution history.`,
    schema: WorkflowGetSchema,
  },

  workflow_create: {
    name: "workflow_create",
    description: `Create a new workflow from a natural language description OR explicit definition.

USAGE WITH PROMPT (recommended):
workflow_create({
  name: "Weekly Sales Report",
  prompt: "Every Monday at 9am, query our CRM for new leads from last week, and send a summary email to sales@company.com"
})

USAGE WITH DEFINITION:
workflow_create({
  name: "Manual Report",
  definition: {
    nodes: [...],
    edges: [...]
  },
  triggerType: "MANUAL"
})

Creates workflow in DRAFT status. Use workflow_update to activate.`,
    schema: WorkflowCreateSchema,
  },

  workflow_update: {
    name: "workflow_update",
    description: `Update an existing workflow's configuration or definition.

USAGE:
- Activate: workflow_update({ workflowId: "abc123", status: "ACTIVE" })
- Rename: workflow_update({ workflowId: "abc123", name: "New Name" })
- Update definition: workflow_update({ workflowId: "abc123", definition: {...} })

Cannot update ARCHIVED workflows.`,
    schema: WorkflowUpdateSchema,
  },

  workflow_execute: {
    name: "workflow_execute",
    description: `Manually trigger a workflow execution.

USAGE:
workflow_execute({
  workflowId: "abc123",
  inputs: { region: "West", startDate: "2024-01-01" }
})

Starts async execution and returns executionId. Use workflow_status to check progress.`,
    schema: WorkflowExecuteSchema,
  },

  workflow_status: {
    name: "workflow_status",
    description: `Check the status of a workflow execution.

USAGE:
workflow_status({ executionId: "exec-123" })

Returns status, progress, logs, and any errors.`,
    schema: WorkflowStatusSchema,
  },
} as const;
