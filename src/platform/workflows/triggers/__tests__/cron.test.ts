/**
 * Cron Trigger Tests
 *
 * Tests for schedule-based workflow execution.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Workflow } from "../../types.js";
import {
  registerCronTrigger,
  unregisterCronTrigger,
  getCronJob,
  getAllCronJobs,
  clearAllCronJobs,
  initCronTriggers,
  validateCronExpression,
  validateTimezone,
  CronTriggerError,
  type CronScheduler,
} from "../cron.js";

// =============================================================================
// MOCKS
// =============================================================================

function createMockScheduler(): CronScheduler & { tasks: Map<string, () => void> } {
  const tasks = new Map<string, () => void>();
  return {
    tasks,
    schedule: vi.fn((expression: string, callback: () => void) => {
      const id = `${expression}-${Date.now()}`;
      tasks.set(id, callback);
      return {
        stop: vi.fn(() => {
          tasks.delete(id);
        }),
      };
    }),
    validate: vi.fn((expr: string) => {
      const parts = expr.split(/\s+/);
      return parts.length === 5 || parts.length === 6;
    }),
  };
}

const mockWorkflow: Workflow = {
  id: "wf-cron-1",
  tenantId: "tenant-1",
  name: "Cron Workflow",
  description: null,
  definition: {
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 0, y: 0 },
        data: { config: { triggerType: "CRON" } },
      },
    ],
    edges: [],
  },
  status: "ACTIVE",
  triggerType: "CRON",
  triggerConfig: {
    triggerType: "CRON",
    cronExpression: "0 9 * * 1",
    timezone: "America/New_York",
  },
  createdBy: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// =============================================================================
// SETUP / TEARDOWN
// =============================================================================

beforeEach(() => {
  clearAllCronJobs();
});

afterEach(() => {
  clearAllCronJobs();
});

// =============================================================================
// CRON EXPRESSION VALIDATION TESTS
// =============================================================================

describe("validateCronExpression", () => {
  it("should accept valid 5-part cron expression", () => {
    const result = validateCronExpression("0 9 * * 1");
    expect(result.valid).toBe(true);
  });

  it("should accept valid 6-part cron expression with seconds", () => {
    const result = validateCronExpression("0 0 9 * * 1");
    expect(result.valid).toBe(true);
  });

  it("should accept wildcards", () => {
    const result = validateCronExpression("* * * * *");
    expect(result.valid).toBe(true);
  });

  it("should accept step values", () => {
    const result = validateCronExpression("*/15 * * * *");
    expect(result.valid).toBe(true);
  });

  it("should accept ranges", () => {
    const result = validateCronExpression("0-30 * * * *");
    expect(result.valid).toBe(true);
  });

  it("should accept lists", () => {
    const result = validateCronExpression("0,15,30,45 * * * *");
    expect(result.valid).toBe(true);
  });

  it("should reject empty expression", () => {
    const result = validateCronExpression("");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("non-empty string");
  });

  it("should reject expression with wrong number of parts", () => {
    const result = validateCronExpression("* * *");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Expected 5 or 6 parts");
  });
});

// =============================================================================
// TIMEZONE VALIDATION TESTS
// =============================================================================

describe("validateTimezone", () => {
  it("should accept valid timezone", () => {
    expect(validateTimezone("America/New_York")).toBe(true);
    expect(validateTimezone("Europe/London")).toBe(true);
    expect(validateTimezone("UTC")).toBe(true);
  });

  it("should reject invalid timezone", () => {
    expect(validateTimezone("Invalid/Timezone")).toBe(false);
    expect(validateTimezone("")).toBe(false);
    expect(validateTimezone("NotATimezone")).toBe(false);
  });
});

// =============================================================================
// REGISTER CRON TRIGGER TESTS
// =============================================================================

describe("registerCronTrigger", () => {
  it("should register a cron trigger", () => {
    const scheduler = createMockScheduler();
    const onTrigger = vi.fn();

    const job = registerCronTrigger("wf-1", "0 9 * * 1", undefined, scheduler, onTrigger);

    expect(job.workflowId).toBe("wf-1");
    expect(job.expression).toBe("0 9 * * 1");
    expect(scheduler.schedule).toHaveBeenCalled();
  });

  it("should register with timezone", () => {
    const scheduler = createMockScheduler();
    const onTrigger = vi.fn();

    const job = registerCronTrigger("wf-1", "0 9 * * 1", "America/New_York", scheduler, onTrigger);

    expect(job.timezone).toBe("America/New_York");
    expect(scheduler.schedule).toHaveBeenCalledWith("0 9 * * 1", expect.any(Function), {
      timezone: "America/New_York",
    });
  });

  it("should throw error for invalid expression", () => {
    const scheduler = createMockScheduler();
    const onTrigger = vi.fn();

    expect(() => registerCronTrigger("wf-1", "invalid", undefined, scheduler, onTrigger)).toThrow(
      CronTriggerError,
    );
  });

  it("should throw error for invalid timezone", () => {
    const scheduler = createMockScheduler();
    const onTrigger = vi.fn();

    expect(() =>
      registerCronTrigger("wf-1", "0 9 * * 1", "Invalid/TZ", scheduler, onTrigger),
    ).toThrow(CronTriggerError);
  });

  it("should replace existing job for same workflow", () => {
    const scheduler = createMockScheduler();
    const onTrigger = vi.fn();

    const job1 = registerCronTrigger("wf-1", "0 9 * * 1", undefined, scheduler, onTrigger);
    const job2 = registerCronTrigger("wf-1", "0 10 * * 1", undefined, scheduler, onTrigger);

    expect(job2.expression).toBe("0 10 * * 1");
    expect(getAllCronJobs()).toHaveLength(1);
  });
});

// =============================================================================
// UNREGISTER CRON TRIGGER TESTS
// =============================================================================

describe("unregisterCronTrigger", () => {
  it("should unregister a cron trigger", () => {
    const scheduler = createMockScheduler();
    const onTrigger = vi.fn();

    registerCronTrigger("wf-1", "0 9 * * 1", undefined, scheduler, onTrigger);
    expect(getAllCronJobs()).toHaveLength(1);

    const result = unregisterCronTrigger("wf-1");

    expect(result).toBe(true);
    expect(getAllCronJobs()).toHaveLength(0);
  });

  it("should return false for non-existent job", () => {
    const result = unregisterCronTrigger("non-existent");
    expect(result).toBe(false);
  });
});

// =============================================================================
// GET CRON JOB TESTS
// =============================================================================

describe("getCronJob", () => {
  it("should get registered job", () => {
    const scheduler = createMockScheduler();
    const onTrigger = vi.fn();

    registerCronTrigger("wf-1", "0 9 * * 1", undefined, scheduler, onTrigger);

    const job = getCronJob("wf-1");

    expect(job).toBeDefined();
    expect(job?.workflowId).toBe("wf-1");
  });

  it("should return undefined for non-existent job", () => {
    const job = getCronJob("non-existent");
    expect(job).toBeUndefined();
  });
});

// =============================================================================
// INIT CRON TRIGGERS TESTS
// =============================================================================

describe("initCronTriggers", () => {
  it("should initialize cron triggers from repository", async () => {
    const scheduler = createMockScheduler();
    const repository = {
      getActiveWorkflowsWithCronTrigger: vi.fn().mockResolvedValue([mockWorkflow]),
      getWorkflow: vi.fn().mockResolvedValue(mockWorkflow),
    };
    const executionService = {
      createExecution: vi.fn().mockResolvedValue({ id: "exec-1" }),
    };
    const queue = {
      enqueue: vi.fn().mockResolvedValue(undefined),
    };

    const result = await initCronTriggers(repository, scheduler, executionService, queue);

    expect(result.registered).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(getAllCronJobs()).toHaveLength(1);
  });

  it("should skip workflows without cron expression", async () => {
    const scheduler = createMockScheduler();
    const workflowWithoutCron = {
      ...mockWorkflow,
      triggerConfig: { triggerType: "CRON" as const },
    };
    const repository = {
      getActiveWorkflowsWithCronTrigger: vi.fn().mockResolvedValue([workflowWithoutCron]),
      getWorkflow: vi.fn().mockResolvedValue(workflowWithoutCron),
    };
    const executionService = {
      createExecution: vi.fn().mockResolvedValue({ id: "exec-1" }),
    };
    const queue = {
      enqueue: vi.fn().mockResolvedValue(undefined),
    };

    const result = await initCronTriggers(repository, scheduler, executionService, queue);

    expect(result.registered).toBe(0);
  });

  it("should collect errors for failed registrations", async () => {
    const scheduler = createMockScheduler();
    const badWorkflow = {
      ...mockWorkflow,
      triggerConfig: {
        triggerType: "CRON" as const,
        cronExpression: "invalid",
      },
    };
    const repository = {
      getActiveWorkflowsWithCronTrigger: vi.fn().mockResolvedValue([badWorkflow]),
      getWorkflow: vi.fn().mockResolvedValue(badWorkflow),
    };
    const executionService = {
      createExecution: vi.fn().mockResolvedValue({ id: "exec-1" }),
    };
    const queue = {
      enqueue: vi.fn().mockResolvedValue(undefined),
    };

    const result = await initCronTriggers(repository, scheduler, executionService, queue);

    expect(result.registered).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain(badWorkflow.id);
  });

  it("should clear existing jobs before initializing", async () => {
    const scheduler = createMockScheduler();

    // Pre-register a job
    registerCronTrigger("old-wf", "0 1 * * *", undefined, scheduler, vi.fn());
    expect(getAllCronJobs()).toHaveLength(1);

    const repository = {
      getActiveWorkflowsWithCronTrigger: vi.fn().mockResolvedValue([mockWorkflow]),
      getWorkflow: vi.fn().mockResolvedValue(mockWorkflow),
    };
    const executionService = {
      createExecution: vi.fn().mockResolvedValue({ id: "exec-1" }),
    };
    const queue = {
      enqueue: vi.fn().mockResolvedValue(undefined),
    };

    await initCronTriggers(repository, scheduler, executionService, queue);

    // Old job should be gone, new job should be present
    expect(getCronJob("old-wf")).toBeUndefined();
    expect(getCronJob(mockWorkflow.id)).toBeDefined();
  });
});
