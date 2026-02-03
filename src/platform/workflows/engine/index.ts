/**
 * Workflow Engine Module
 *
 * Exports all engine components for workflow execution.
 */

// Engine
export { WorkflowEngine } from "./engine.js";

// Context
export { ExecutionContextManager, type SerializedContext } from "./context.js";

// Queue
export {
  WORKFLOW_QUEUE_NAME,
  getRedisConnectionOptions,
  getWorkflowQueue,
  createWorkflowQueue,
  enqueueNodeExecution,
  closeWorkflowQueue,
  isQueueConnected,
  getQueueStats,
  DEFAULT_JOB_OPTIONS,
} from "./queue.js";

// Processor
export {
  processNode,
  createWorkflowWorker,
  triggerExecutor,
  createBaseExecutorRegistry,
  type ExecutionRepository,
  type NodeExecutor,
  type NodeExecutorRegistry,
  type ProcessorConfig,
  type ExecutionMeta,
} from "./processor.js";
