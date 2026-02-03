/**
 * Workflow Tools
 *
 * Agent-accessible tools for workflow management.
 * Reference: docs/IMPLEMENTATION-PLAN-PHASE7.md §6
 */

import { Type } from "@sinclair/typebox";
import type {
  Workflow,
  WorkflowExecution,
  WorkflowDefinition,
  WorkflowStatus,
  TriggerType,
  TriggerNodeConfig,
  ExecutionContext,
} from "../types.js";
import {
  WorkflowListSchema,
  WorkflowGetSchema,
  WorkflowCreateSchema,
  WorkflowUpdateSchema,
  WorkflowExecuteSchema,
  WorkflowStatusSchema,
  WORKFLOW_TOOL_DEFINITIONS,
  type WorkflowListParams,
  type WorkflowGetParams,
  type WorkflowCreateParams,
  type WorkflowUpdateParams,
  type WorkflowExecuteParams,
  type WorkflowStatusParams,
} from "./schemas.js";
import {
  generateWorkflowFromPrompt,
  validateWorkflowDefinition,
  type LLMProvider,
  type GeneratorContext,
} from "./workflow-generator.js";

// =============================================================================
// TYPES
// =============================================================================

export interface WorkflowToolContext {
  tenantId: string;
  userId: string;
  llmProvider?: LLMProvider;
}

export interface WorkflowService {
  listWorkflows(params: {
    tenantId: string;
    status?: WorkflowStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ workflows: Workflow[]; total: number }>;

  getWorkflow(params: { tenantId: string; workflowId: string }): Promise<Workflow | null>;

  createWorkflow(params: {
    tenantId: string;
    createdBy: string;
    name: string;
    description?: string;
    definition: WorkflowDefinition;
    status?: WorkflowStatus;
    triggerType?: TriggerType;
    triggerConfig?: TriggerNodeConfig;
  }): Promise<Workflow>;

  updateWorkflow(params: {
    tenantId: string;
    workflowId: string;
    name?: string;
    description?: string;
    definition?: WorkflowDefinition;
    status?: WorkflowStatus;
    triggerType?: TriggerType;
    triggerConfig?: TriggerNodeConfig;
  }): Promise<Workflow | null>;

  getExecution(params: {
    tenantId: string;
    executionId: string;
  }): Promise<WorkflowExecution | null>;

  createExecution(params: {
    workflowId: string;
    triggeredBy: string;
    inputs: Record<string, unknown>;
  }): Promise<WorkflowExecution>;
}

export interface WorkflowExecutor {
  startExecution(executionId: string): Promise<void>;
}

// biome-ignore lint/suspicious/noExplicitAny: Tool schema type from pi-agent-core
export type AnyAgentTool = {
  label: string;
  name: string;
  description: string;
  parameters: any;
  execute: (
    toolCallId: string,
    args: unknown,
  ) => Promise<{
    content: Array<{ type: string; text: string }>;
    details?: unknown;
  }>;
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

function errorResult(error: string, code?: string) {
  return jsonResult({ error, code });
}

function readParam<T>(params: Record<string, unknown>, key: string): T | undefined {
  return params[key] as T | undefined;
}

// =============================================================================
// WORKFLOW_LIST
// =============================================================================

export async function executeWorkflowList(
  params: WorkflowListParams,
  context: WorkflowToolContext,
  service: WorkflowService,
): Promise<{ workflows: Workflow[]; total: number }> {
  return service.listWorkflows({
    tenantId: context.tenantId,
    status: params.status as WorkflowStatus | undefined,
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
  });
}

// =============================================================================
// WORKFLOW_GET
// =============================================================================

export async function executeWorkflowGet(
  params: WorkflowGetParams,
  context: WorkflowToolContext,
  service: WorkflowService,
): Promise<Workflow | null> {
  return service.getWorkflow({
    tenantId: context.tenantId,
    workflowId: params.workflowId,
  });
}

// =============================================================================
// WORKFLOW_CREATE
// =============================================================================

export async function executeWorkflowCreate(
  params: WorkflowCreateParams,
  context: WorkflowToolContext,
  service: WorkflowService,
): Promise<Workflow> {
  let definition: WorkflowDefinition;
  let triggerType: TriggerType = (params.triggerType as TriggerType) || "MANUAL";
  let triggerConfig: TriggerNodeConfig | undefined = params.triggerConfig as TriggerNodeConfig;

  // Generate from prompt or use provided definition
  if (params.prompt && !params.definition) {
    if (!context.llmProvider) {
      throw new Error("LLM provider required for prompt-based workflow generation");
    }

    const generatorContext: GeneratorContext = {
      tenantId: context.tenantId,
      userId: context.userId,
    };

    const generated = await generateWorkflowFromPrompt(
      params.prompt,
      generatorContext,
      context.llmProvider,
    );

    definition = generated.definition;
    triggerType = generated.triggerType;
    triggerConfig = generated.triggerConfig;
  } else if (params.definition) {
    // Validate provided definition
    const validation = validateWorkflowDefinition(params.definition);
    if (!validation.valid) {
      throw new Error(`Invalid workflow definition: ${validation.errors.join("; ")}`);
    }
    definition = params.definition as WorkflowDefinition;
  } else {
    throw new Error("Either 'prompt' or 'definition' is required");
  }

  return service.createWorkflow({
    tenantId: context.tenantId,
    createdBy: context.userId,
    name: params.name,
    description: params.description,
    definition,
    status: "DRAFT",
    triggerType,
    triggerConfig,
  });
}

// =============================================================================
// WORKFLOW_UPDATE
// =============================================================================

export async function executeWorkflowUpdate(
  params: WorkflowUpdateParams,
  context: WorkflowToolContext,
  service: WorkflowService,
): Promise<Workflow | null> {
  // Validate definition if provided
  if (params.definition) {
    const validation = validateWorkflowDefinition(params.definition);
    if (!validation.valid) {
      throw new Error(`Invalid workflow definition: ${validation.errors.join("; ")}`);
    }
  }

  return service.updateWorkflow({
    tenantId: context.tenantId,
    workflowId: params.workflowId,
    name: params.name,
    description: params.description,
    definition: params.definition as WorkflowDefinition | undefined,
    status: params.status as WorkflowStatus | undefined,
    triggerType: params.triggerType as TriggerType | undefined,
    triggerConfig: params.triggerConfig as TriggerNodeConfig | undefined,
  });
}

// =============================================================================
// WORKFLOW_EXECUTE
// =============================================================================

export async function executeWorkflowExecute(
  params: WorkflowExecuteParams,
  context: WorkflowToolContext,
  service: WorkflowService,
  executor: WorkflowExecutor,
): Promise<{ executionId: string; status: string }> {
  // Verify workflow exists and is active
  const workflow = await service.getWorkflow({
    tenantId: context.tenantId,
    workflowId: params.workflowId,
  });

  if (!workflow) {
    throw new Error(`Workflow not found: ${params.workflowId}`);
  }

  if (workflow.status !== "ACTIVE" && workflow.status !== "DRAFT") {
    throw new Error(`Cannot execute workflow with status: ${workflow.status}`);
  }

  // Create execution
  const execution = await service.createExecution({
    workflowId: params.workflowId,
    triggeredBy: context.userId,
    inputs: params.inputs || {},
  });

  // Start execution asynchronously
  executor.startExecution(execution.id).catch((error) => {
    console.error(`Failed to start execution ${execution.id}:`, error);
  });

  return {
    executionId: execution.id,
    status: execution.status,
  };
}

// =============================================================================
// WORKFLOW_STATUS
// =============================================================================

export async function executeWorkflowStatus(
  params: WorkflowStatusParams,
  context: WorkflowToolContext,
  service: WorkflowService,
): Promise<WorkflowExecution | null> {
  return service.getExecution({
    tenantId: context.tenantId,
    executionId: params.executionId,
  });
}

// =============================================================================
// TOOL FACTORY
// =============================================================================

export interface WorkflowToolDependencies {
  service: WorkflowService;
  executor: WorkflowExecutor;
  llmProvider?: LLMProvider;
}

export function createWorkflowTools(
  context: WorkflowToolContext,
  dependencies: WorkflowToolDependencies,
): AnyAgentTool[] {
  const { service, executor } = dependencies;
  const toolContext: WorkflowToolContext = {
    ...context,
    llmProvider: dependencies.llmProvider,
  };

  return [
    // workflow_list
    {
      label: "Workflow List",
      name: "workflow_list",
      description: WORKFLOW_TOOL_DEFINITIONS.workflow_list.description,
      parameters: WorkflowListSchema,
      execute: async (_toolCallId, args) => {
        try {
          const params = args as WorkflowListParams;
          const result = await executeWorkflowList(params, toolContext, service);
          return jsonResult({
            workflows: result.workflows.map((w) => ({
              id: w.id,
              name: w.name,
              description: w.description,
              status: w.status,
              triggerType: w.triggerType,
              createdAt: w.createdAt,
              updatedAt: w.updatedAt,
            })),
            total: result.total,
            limit: params.limit ?? 20,
            offset: params.offset ?? 0,
          });
        } catch (error) {
          return errorResult(
            error instanceof Error ? error.message : "Unknown error",
            "WORKFLOW_LIST_ERROR",
          );
        }
      },
    },

    // workflow_get
    {
      label: "Workflow Get",
      name: "workflow_get",
      description: WORKFLOW_TOOL_DEFINITIONS.workflow_get.description,
      parameters: WorkflowGetSchema,
      execute: async (_toolCallId, args) => {
        try {
          const params = args as WorkflowGetParams;
          const workflow = await executeWorkflowGet(params, toolContext, service);

          if (!workflow) {
            return errorResult(`Workflow not found: ${params.workflowId}`, "NOT_FOUND");
          }

          return jsonResult(workflow);
        } catch (error) {
          return errorResult(
            error instanceof Error ? error.message : "Unknown error",
            "WORKFLOW_GET_ERROR",
          );
        }
      },
    },

    // workflow_create
    {
      label: "Workflow Create",
      name: "workflow_create",
      description: WORKFLOW_TOOL_DEFINITIONS.workflow_create.description,
      parameters: WorkflowCreateSchema,
      execute: async (_toolCallId, args) => {
        try {
          const params = args as WorkflowCreateParams;
          const workflow = await executeWorkflowCreate(params, toolContext, service);
          return jsonResult({
            id: workflow.id,
            name: workflow.name,
            description: workflow.description,
            status: workflow.status,
            triggerType: workflow.triggerType,
            message: "Workflow created in DRAFT status. Use workflow_update to activate.",
          });
        } catch (error) {
          return errorResult(
            error instanceof Error ? error.message : "Unknown error",
            "WORKFLOW_CREATE_ERROR",
          );
        }
      },
    },

    // workflow_update
    {
      label: "Workflow Update",
      name: "workflow_update",
      description: WORKFLOW_TOOL_DEFINITIONS.workflow_update.description,
      parameters: WorkflowUpdateSchema,
      execute: async (_toolCallId, args) => {
        try {
          const params = args as WorkflowUpdateParams;
          const workflow = await executeWorkflowUpdate(params, toolContext, service);

          if (!workflow) {
            return errorResult(`Workflow not found: ${params.workflowId}`, "NOT_FOUND");
          }

          return jsonResult({
            id: workflow.id,
            name: workflow.name,
            description: workflow.description,
            status: workflow.status,
            triggerType: workflow.triggerType,
            updatedAt: workflow.updatedAt,
          });
        } catch (error) {
          return errorResult(
            error instanceof Error ? error.message : "Unknown error",
            "WORKFLOW_UPDATE_ERROR",
          );
        }
      },
    },

    // workflow_execute
    {
      label: "Workflow Execute",
      name: "workflow_execute",
      description: WORKFLOW_TOOL_DEFINITIONS.workflow_execute.description,
      parameters: WorkflowExecuteSchema,
      execute: async (_toolCallId, args) => {
        try {
          const params = args as WorkflowExecuteParams;
          const result = await executeWorkflowExecute(params, toolContext, service, executor);
          return jsonResult({
            executionId: result.executionId,
            status: result.status,
            message: "Workflow execution started. Use workflow_status to check progress.",
          });
        } catch (error) {
          return errorResult(
            error instanceof Error ? error.message : "Unknown error",
            "WORKFLOW_EXECUTE_ERROR",
          );
        }
      },
    },

    // workflow_status
    {
      label: "Workflow Status",
      name: "workflow_status",
      description: WORKFLOW_TOOL_DEFINITIONS.workflow_status.description,
      parameters: WorkflowStatusSchema,
      execute: async (_toolCallId, args) => {
        try {
          const params = args as WorkflowStatusParams;
          const execution = await executeWorkflowStatus(params, toolContext, service);

          if (!execution) {
            return errorResult(`Execution not found: ${params.executionId}`, "NOT_FOUND");
          }

          return jsonResult({
            id: execution.id,
            workflowId: execution.workflowId,
            status: execution.status,
            startedAt: execution.startedAt,
            finishedAt: execution.finishedAt,
            error: execution.error,
            logs: execution.logs,
          });
        } catch (error) {
          return errorResult(
            error instanceof Error ? error.message : "Unknown error",
            "WORKFLOW_STATUS_ERROR",
          );
        }
      },
    },
  ];
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  WorkflowListSchema,
  WorkflowGetSchema,
  WorkflowCreateSchema,
  WorkflowUpdateSchema,
  WorkflowExecuteSchema,
  WorkflowStatusSchema,
  WORKFLOW_TOOL_DEFINITIONS,
} from "./schemas.js";

export {
  generateWorkflowFromPrompt,
  validateWorkflowDefinition,
  EXAMPLE_WORKFLOWS,
} from "./workflow-generator.js";

export type {
  WorkflowListParams,
  WorkflowGetParams,
  WorkflowCreateParams,
  WorkflowUpdateParams,
  WorkflowExecuteParams,
  WorkflowStatusParams,
} from "./schemas.js";

export type { LLMProvider, GeneratorContext, GeneratedWorkflow } from "./workflow-generator.js";
