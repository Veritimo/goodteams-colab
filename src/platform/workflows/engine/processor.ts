/**
 * Workflow Job Processor
 *
 * BullMQ Worker that processes workflow node execution jobs.
 * Handles loading state, executing nodes, and queueing next steps.
 */

import { Worker, type Job, type ConnectionOptions } from "bullmq";
import type {
  WorkflowJobData,
  WorkflowDefinition,
  ExecutionContext,
  ExecutionStatus,
  ExecutionLogEntry,
  WorkflowNode,
  ConditionResult,
} from "../types.js";
import { ExecutionContextManager } from "./context.js";
import { WorkflowEngine } from "./engine.js";
import { WORKFLOW_QUEUE_NAME, getRedisConnectionOptions, enqueueNodeExecution } from "./queue.js";

/**
 * Database interface for execution persistence
 * Allows dependency injection for testing
 */
export interface ExecutionRepository {
  getExecution(executionId: string): Promise<{
    id: string;
    workflowId: string;
    status: ExecutionStatus;
    context: ExecutionContext;
    logs: ExecutionLogEntry[];
    workflow: {
      id: string;
      definition: WorkflowDefinition;
      tenantId: string;
    };
  } | null>;

  updateExecution(
    executionId: string,
    data: {
      status?: ExecutionStatus;
      context?: ExecutionContext;
      logs?: ExecutionLogEntry[];
      finishedAt?: Date;
      error?: string;
    },
  ): Promise<void>;
}

/**
 * Node executor interface
 * Implementations handle specific node types (agent, tool, condition, etc.)
 */
export interface NodeExecutor {
  execute(
    node: WorkflowNode,
    resolvedConfig: Record<string, unknown>,
    context: ExecutionContext,
    executionMeta: ExecutionMeta,
  ): Promise<unknown>;
}

/**
 * Metadata passed to node executors
 */
export interface ExecutionMeta {
  executionId: string;
  workflowId: string;
  tenantId: string;
}

/**
 * Node executor registry
 */
export type NodeExecutorRegistry = Record<string, NodeExecutor>;

/**
 * Processor configuration
 */
export interface ProcessorConfig {
  repository: ExecutionRepository;
  executors: NodeExecutorRegistry;
  connection?: ConnectionOptions;
  concurrency?: number;
}

/**
 * Create log entry helper
 */
function createLogEntry(
  message: string,
  level: ExecutionLogEntry["level"],
  nodeId?: string,
): ExecutionLogEntry {
  return {
    timestamp: new Date().toISOString(),
    nodeId: nodeId ?? null,
    message,
    level,
  };
}

/**
 * Process a single workflow node
 */
export async function processNode(
  job: Job<WorkflowJobData>,
  config: ProcessorConfig,
): Promise<void> {
  const { executionId, nodeId } = job.data;
  const { repository, executors } = config;

  // 1. Load execution state from database
  const execution = await repository.getExecution(executionId);
  if (!execution) {
    console.error(`[WorkflowProcessor] Execution ${executionId} not found`);
    throw new Error(`Execution ${executionId} not found`);
  }

  // 2. Mark as RUNNING if currently PENDING
  if (execution.status === "PENDING") {
    await repository.updateExecution(executionId, { status: "RUNNING" });
    execution.status = "RUNNING";
  }

  // 3. Initialize engine with current context
  const contextManager = ExecutionContextManager.fromJSON(execution.context);
  const engine = new WorkflowEngine(execution.workflow.definition, contextManager.getContext());

  // 4. Find the node to execute
  const node = engine.getNode(nodeId);
  if (!node) {
    const errorMsg = `Node ${nodeId} not found in workflow ${execution.workflow.id}`;
    console.error(`[WorkflowProcessor] ${errorMsg}`);

    await repository.updateExecution(executionId, {
      status: "FAILED",
      finishedAt: new Date(),
      error: errorMsg,
      logs: [...execution.logs, createLogEntry(errorMsg, "error", nodeId)],
    });
    return;
  }

  // 5. Get the executor for this node type
  const executor = executors[node.type];
  if (!executor) {
    const errorMsg = `No executor found for node type: ${node.type}`;
    console.error(`[WorkflowProcessor] ${errorMsg}`);

    await repository.updateExecution(executionId, {
      status: "FAILED",
      finishedAt: new Date(),
      error: errorMsg,
      logs: [...execution.logs, createLogEntry(errorMsg, "error", nodeId)],
    });
    return;
  }

  // 6. Resolve variables in node config
  const nodeConfig = node.data?.config ?? {};
  const resolvedConfig = engine.resolveVariables(nodeConfig) as Record<string, unknown>;

  console.log(
    `[WorkflowProcessor] Executing node ${nodeId} (${node.type})`,
    JSON.stringify(resolvedConfig).substring(0, 200),
  );

  // 7. Execute the node
  let result: unknown;
  try {
    result = await executor.execute(node, resolvedConfig, contextManager.getContext(), {
      executionId,
      workflowId: execution.workflow.id,
      tenantId: execution.workflow.tenantId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[WorkflowProcessor] Error in node ${nodeId}:`, errorMessage);

    await repository.updateExecution(executionId, {
      status: "FAILED",
      finishedAt: new Date(),
      error: errorMessage,
      logs: [
        ...execution.logs,
        createLogEntry(`Error in node ${nodeId}: ${errorMessage}`, "error", nodeId),
      ],
    });
    throw error; // Re-throw for BullMQ retry handling
  }

  // 8. Store node output in context
  contextManager.setNodeOutput(nodeId, result);

  // 9. Determine next nodes
  const conditionResult = isConditionResult(result) ? result : undefined;
  engine.updateContext(contextManager.getContext());
  const nextNodeIds = engine.getNextNodes(nodeId, conditionResult);

  // 10. Persist updated context and logs
  const successLog = createLogEntry(
    `Node ${nodeId} (${node.type}) completed successfully`,
    "success",
    nodeId,
  );
  const updatedLogs = [...execution.logs, successLog];

  await repository.updateExecution(executionId, {
    context: contextManager.getContext(),
    logs: updatedLogs,
  });

  // 11. Either complete or queue next nodes
  if (nextNodeIds.length === 0) {
    // No more nodes to execute - workflow complete
    await repository.updateExecution(executionId, {
      status: "COMPLETED",
      finishedAt: new Date(),
      logs: [...updatedLogs, createLogEntry("Workflow completed", "success")],
    });
    console.log(`[WorkflowProcessor] Execution ${executionId} completed`);
  } else {
    // Queue next nodes for execution
    for (const nextId of nextNodeIds) {
      await enqueueNodeExecution(executionId, nextId);
      console.log(`[WorkflowProcessor] Queued node ${nextId} for execution ${executionId}`);
    }
  }
}

/**
 * Type guard for condition result
 */
function isConditionResult(value: unknown): value is ConditionResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "nextHandle" in value &&
    (value as ConditionResult).nextHandle in { true: 1, false: 1 }
  );
}

/**
 * Create and start a workflow processor worker
 */
export function createWorkflowWorker(config: ProcessorConfig): Worker<WorkflowJobData> {
  const worker = new Worker<WorkflowJobData>(
    WORKFLOW_QUEUE_NAME,
    async (job) => processNode(job, config),
    {
      connection: config.connection ?? getRedisConnectionOptions(),
      concurrency: config.concurrency ?? 5,
    },
  );

  // Log worker events
  worker.on("completed", (job) => {
    console.log(`[WorkflowWorker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, error) => {
    console.error(`[WorkflowWorker] Job ${job?.id} failed:`, error.message);
  });

  worker.on("error", (error) => {
    console.error("[WorkflowWorker] Worker error:", error.message);
  });

  return worker;
}

/**
 * Default trigger executor (pass-through)
 */
export const triggerExecutor: NodeExecutor = {
  async execute() {
    return { triggered: true, timestamp: new Date().toISOString() };
  },
};

/**
 * Create a basic executor registry with trigger executor
 */
export function createBaseExecutorRegistry(): NodeExecutorRegistry {
  return {
    trigger: triggerExecutor,
  };
}
