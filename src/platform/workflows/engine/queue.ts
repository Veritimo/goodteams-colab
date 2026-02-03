/**
 * BullMQ Queue Setup
 *
 * Initializes the workflow job queue with Redis connection.
 * Provides queue instance for job processing.
 */

import { Queue, type ConnectionOptions, type JobsOptions } from "bullmq";
import type { WorkflowJobData } from "../types.js";

/**
 * Queue name for workflow jobs
 */
export const WORKFLOW_QUEUE_NAME = "workflow-jobs";

/**
 * Default Redis connection options
 */
export function getRedisConnectionOptions(): ConnectionOptions {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    // Parse Redis URL (redis://[:password@]host[:port][/db])
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: url.port ? parseInt(url.port, 10) : 6379,
      password: url.password || undefined,
      db: url.pathname ? parseInt(url.pathname.slice(1), 10) || 0 : 0,
    };
  }

  // Default local Redis connection
  return {
    host: process.env.REDIS_HOST ?? "localhost",
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
    password: process.env.REDIS_PASSWORD ?? undefined,
    db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0,
  };
}

/**
 * Default job options for workflow jobs
 */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1000,
  },
  removeOnComplete: {
    count: 1000, // Keep last 1000 completed jobs
    age: 24 * 60 * 60, // Keep completed jobs for 24 hours
  },
  removeOnFail: {
    count: 5000, // Keep last 5000 failed jobs
    age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
  },
};

// Singleton queue instance
let workflowQueue: Queue<WorkflowJobData> | null = null;

/**
 * Get or create the workflow queue
 */
export function getWorkflowQueue(): Queue<WorkflowJobData> {
  if (!workflowQueue) {
    workflowQueue = createWorkflowQueue();
  }
  return workflowQueue;
}

/**
 * Create a new workflow queue instance
 */
export function createWorkflowQueue(connection?: ConnectionOptions): Queue<WorkflowJobData> {
  const queue = new Queue<WorkflowJobData>(WORKFLOW_QUEUE_NAME, {
    connection: connection ?? getRedisConnectionOptions(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });

  // Handle connection errors
  queue.on("error", (error) => {
    console.error("[WorkflowQueue] Redis connection error:", error.message);
  });

  return queue;
}

/**
 * Add a node execution job to the queue
 */
export async function enqueueNodeExecution(
  executionId: string,
  nodeId: string,
  options?: Partial<JobsOptions>,
): Promise<string> {
  const queue = getWorkflowQueue();

  const job = await queue.add(
    `exec-${executionId}-${nodeId}`,
    { executionId, nodeId },
    {
      ...DEFAULT_JOB_OPTIONS,
      ...options,
    },
  );

  return job.id ?? `${executionId}-${nodeId}`;
}

/**
 * Close the queue connection
 */
export async function closeWorkflowQueue(): Promise<void> {
  if (workflowQueue) {
    await workflowQueue.close();
    workflowQueue = null;
  }
}

/**
 * Check if queue is connected
 */
export async function isQueueConnected(): Promise<boolean> {
  if (!workflowQueue) return false;

  try {
    // Attempt a simple operation to check connection
    await workflowQueue.getJobCounts();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const queue = getWorkflowQueue();
  const counts = await queue.getJobCounts("waiting", "active", "completed", "failed", "delayed");

  return {
    waiting: counts.waiting ?? 0,
    active: counts.active ?? 0,
    completed: counts.completed ?? 0,
    failed: counts.failed ?? 0,
    delayed: counts.delayed ?? 0,
  };
}
