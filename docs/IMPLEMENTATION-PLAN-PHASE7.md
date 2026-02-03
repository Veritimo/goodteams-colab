# Phase 7: Visual Workflow Engine

> No-code workflow automation with agent-assisted creation

**Duration:** 6 weeks (Weeks 35-40)  
**Status:** ✅ COMPLETE  
**Reference:** `/Users/dawie/Repos/goodteams_ai/platform/app/src/workflows/`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Data Model](#3-data-model)
4. [Week-by-Week Plan](#4-week-by-week-plan)
5. [Node Types](#5-node-types)
6. [Agent Tools](#6-agent-tools)
7. [Triggers](#7-triggers)
8. [Testing Strategy](#8-testing-strategy)
9. [Files to Create](#9-files-to-create)

---

## 1. Overview

### Goals

- **Visual workflow designer** using React Flow canvas
- **Agent-assisted creation** - main agent can create workflows from prompts via tools
- **Execution engine** with job queue for reliable async processing
- **Multiple triggers** - cron, webhook, chat, manual
- **Tool-based approach** - SQL/CRM operations as tools, not separate node types

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| SQL/CRM as **tools**, not nodes | Simpler - agent node calls tools, no duplicate logic |
| No separate workflow agent | Main agent creates workflows via `workflow_create` tool |
| BullMQ for job queue | Redis-backed, reliable, OpenClaw already uses Redis |
| Prisma for workflow storage | Consistent with platform DB layer |

### Reference Implementation

From `goodteams_ai/platform/app/src/workflows/`:

```
engine.ts        → Variable resolution, graph traversal
types.ts         → WorkflowDefinition, ExecutionContext
jobs.ts          → Node execution dispatcher
nodes/
  agent.ts       → LLM prompt execution
  tool.ts        → Call external tools
  communication.ts → Email, Teams, chat
  decision.ts    → Conditional branching
  iterator.ts    → Loop over collections
```

---

## 2. Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         WORKFLOW SYSTEM                              │
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │   Designer   │───▶│   Storage    │◀───│  Agent Tools         │  │
│  │  (React Flow)│    │   (Prisma)   │    │  (workflow_create)   │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
│          │                  │                       │               │
│          ▼                  ▼                       ▼               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     EXECUTION ENGINE                          │  │
│  │                                                               │  │
│  │   Triggers        Queue           Executors                   │  │
│  │   ─────────       ─────           ─────────                   │  │
│  │   • Cron      ───▶ BullMQ ───▶   • AgentExecutor             │  │
│  │   • Webhook                       • ToolExecutor              │  │
│  │   • Chat                          • ConditionExecutor         │  │
│  │   • Manual                        • CommunicationExecutor     │  │
│  │                                                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     EXECUTION LOGS                            │  │
│  │   • Per-node results    • Error traces    • Timing            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Integration with Existing Tools

Workflows call the **same tools** the agent uses:

```typescript
// Agent node in workflow calls SQL tool
await executeAgentNode({
  prompt: "Get all customers from {{inputs.region}}",
  tools: ["execute_sql_query", "generate_sql_query"]
});

// Or: Tool node calls directly
await executeToolNode({
  toolName: "execute_crm_query",
  entityName: "contacts",
  query: "{{nodes.generator.soql}}"
});
```

---

## 3. Data Model

### Prisma Schema Additions

```prisma
// Add to src/platform/db/schema.prisma

model Workflow {
  id              String            @id @default(uuid())
  tenantId        String
  name            String
  description     String?
  definition      Json              // { nodes: [], edges: [], globalConfig: {} }
  status          WorkflowStatus    @default(DRAFT)
  triggerType     TriggerType?
  triggerConfig   Json?             // cron expression, webhook secret, etc.
  createdBy       String
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  
  executions      WorkflowExecution[]
  tenant          Tenant            @relation(fields: [tenantId], references: [id])
  
  @@index([tenantId])
  @@index([status])
}

model WorkflowExecution {
  id              String            @id @default(uuid())
  workflowId      String
  status          ExecutionStatus   @default(PENDING)
  context         Json              // { inputs: {}, nodeOutputs: {}, globalVariables: {} }
  logs            Json              @default("[]") // [{ timestamp, nodeId, message, level }]
  triggeredBy     String?           // userId or "cron" or "webhook"
  startedAt       DateTime          @default(now())
  finishedAt      DateTime?
  error           String?
  
  workflow        Workflow          @relation(fields: [workflowId], references: [id])
  
  @@index([workflowId])
  @@index([status])
}

enum WorkflowStatus {
  DRAFT
  ACTIVE
  PAUSED
  ARCHIVED
}

enum ExecutionStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  WAITING_FOR_INPUT
}

enum TriggerType {
  MANUAL
  CRON
  WEBHOOK
  CHAT
  EMAIL
}
```

### Workflow Definition JSON

```typescript
interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  globalConfig?: {
    maxExecutionTime?: number;      // ms
    retryOnError?: boolean;
    notifyOnComplete?: boolean;
  };
}

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'agent' | 'tool' | 'condition' | 'communication' | 'iterator';
  position: { x: number; y: number };
  data: {
    label?: string;
    config: Record<string, unknown>;  // Type-specific config
  };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;  // For conditions: 'true' | 'false'
}
```

---

## 4. Week-by-Week Plan

### Week 35: Foundation & Data Model

| Task | Description | Test |
|------|-------------|------|
| Schema migration | Workflow + WorkflowExecution models | Migration runs |
| CRUD service | Create, read, update, delete workflows | All ops work |
| API routes | `/api/workflows/*` endpoints | Routes respond |
| Definition validation | Validate node/edge structure | Invalid rejected |

**Files:**
- `src/platform/workflows/types.ts`
- `src/platform/workflows/service.ts`
- `src/platform/api/routes/workflows.ts`
- `src/platform/db/schema.prisma` (additions)

### Week 36: Execution Engine Core

| Task | Description | Test |
|------|-------------|------|
| BullMQ setup | Redis queue for workflow jobs | Queue works |
| Engine class | Variable resolution, graph traversal | Variables resolve |
| Job processor | Dequeue and execute nodes | Jobs process |
| Context management | Track inputs/outputs per node | Context persists |

**Files:**
- `src/platform/workflows/engine/queue.ts`
- `src/platform/workflows/engine/engine.ts`
- `src/platform/workflows/engine/processor.ts`
- `src/platform/workflows/engine/context.ts`

### Week 37: Node Executors

| Task | Description | Test |
|------|-------------|------|
| Trigger executor | Pass-through for start | Triggers fire |
| Agent executor | LLM call with tools | Agent responds |
| Tool executor | Call registered tools | Tools execute |
| Condition executor | Branch on expression | Branches correctly |
| Communication executor | Email, Teams, chat | Messages sent |

**Files:**
- `src/platform/workflows/nodes/trigger.ts`
- `src/platform/workflows/nodes/agent.ts`
- `src/platform/workflows/nodes/tool.ts`
- `src/platform/workflows/nodes/condition.ts`
- `src/platform/workflows/nodes/communication.ts`

### Week 38: Agent Tools for Workflow Creation

| Task | Description | Test |
|------|-------------|------|
| workflow_list | List workflows for tenant | Returns list |
| workflow_get | Get workflow details | Returns definition |
| workflow_create | Create from prompt/spec | Creates workflow |
| workflow_update | Modify existing workflow | Updates saved |
| workflow_execute | Trigger workflow run | Execution starts |
| workflow_status | Check execution status | Status returned |

**Files:**
- `src/platform/workflows/tools/index.ts`
- `src/platform/workflows/tools/schemas.ts`
- `src/tools/workflow-tools.ts` (register with agent)

### Week 39: Triggers

| Task | Description | Test |
|------|-------------|------|
| Manual trigger | API call to start | Starts execution |
| Cron trigger | Schedule via node-cron | Fires on schedule |
| Webhook trigger | HTTP endpoint per workflow | Receives payload |
| Chat trigger | Start from conversation | Workflow starts |

**Files:**
- `src/platform/workflows/triggers/manual.ts`
- `src/platform/workflows/triggers/cron.ts`
- `src/platform/workflows/triggers/webhook.ts`
- `src/platform/workflows/triggers/chat.ts`

### Week 40: React Flow Designer UI

| Task | Description | Test |
|------|-------------|------|
| Canvas setup | React Flow integration | Renders |
| Node components | Custom node UIs | All types render |
| Edge handling | Connect nodes | Edges work |
| Node palette | Drag to add nodes | Drag works |
| Properties panel | Edit node config | Edits save |
| Save/load | Persist to API | Workflow saved |
| Run button | Execute from designer | Starts execution |
| Execution view | Show run status/logs | Status shown |

**Files:**
- `src/platform/ui/workflows/WorkflowDesigner.tsx`
- `src/platform/ui/workflows/nodes/*.tsx`
- `src/platform/ui/workflows/PropertiesPanel.tsx`
- `src/platform/ui/workflows/ExecutionView.tsx`

---

## 5. Node Types

### 5.1 Trigger Node

Starting point for workflow execution.

```typescript
interface TriggerNodeConfig {
  triggerType: 'manual' | 'cron' | 'webhook' | 'chat' | 'email';
  // Cron-specific
  cronExpression?: string;
  timezone?: string;
  // Webhook-specific
  webhookPath?: string;  // Auto-generated unique path
  webhookSecret?: string;
  // Chat-specific
  triggerPhrase?: string;  // e.g., "run sales report"
}
```

### 5.2 Agent Node

LLM execution with optional tool access.

```typescript
interface AgentNodeConfig {
  systemPrompt?: string;
  prompt: string;                    // Supports {{variables}}
  model?: string;                    // Override tenant default
  temperature?: number;
  tools?: string[];                  // Tool names agent can use
  maxTokens?: number;
}

// Output
interface AgentNodeOutput {
  text: string;
  toolCalls?: { name: string; result: unknown }[];
  usage?: { promptTokens: number; completionTokens: number };
}
```

### 5.3 Tool Node

Direct tool execution (no LLM).

```typescript
interface ToolNodeConfig {
  toolName: string;                  // Registered tool name
  [key: string]: unknown;            // Tool-specific args
}

// Example: Execute SQL
{
  toolName: "execute_sql_query",
  connectionId: "{{inputs.connId}}",
  query: "SELECT * FROM customers WHERE region = '{{inputs.region}}'"
}
```

### 5.4 Condition Node

Branch based on expression.

```typescript
interface ConditionNodeConfig {
  expression: string;                // JavaScript expression
  // e.g., "{{nodes.query.rowCount}} > 0"
}

// Has two output handles: 'true' and 'false'
```

### 5.5 Communication Node

Send notifications.

```typescript
interface CommunicationNodeConfig {
  method: 'email' | 'teams' | 'chat';
  // Email
  to?: string;
  subject?: string;
  body: string;                      // Supports {{variables}}
  // Teams
  teamId?: string;
  channelId?: string;
  // Chat
  conversationId?: string;
}
```

### 5.6 Iterator Node

Loop over arrays.

```typescript
interface IteratorNodeConfig {
  collection: string;                // {{nodes.query.data.rows}}
  itemVariable: string;              // Name for current item
  // Child nodes execute for each item
}
```

---

## 6. Agent Tools

The main agent can create and manage workflows via these tools:

### 6.1 workflow_list

```typescript
// Schema
{
  name: "workflow_list",
  description: "List workflows in the current tenant",
  parameters: {
    status: { type: "string", enum: ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"], optional: true },
    limit: { type: "number", default: 20 }
  }
}

// Usage
"Show me all active workflows"
→ workflow_list({ status: "ACTIVE" })
```

### 6.2 workflow_create

```typescript
// Schema
{
  name: "workflow_create",
  description: "Create a new workflow from a natural language description",
  parameters: {
    name: { type: "string", required: true },
    description: { type: "string" },
    prompt: { type: "string", required: true },
    // OR provide explicit definition
    definition: { type: "object" }
  }
}

// Usage
"Create a workflow that runs every Monday at 9am, queries our CRM for new leads from last week, and sends a summary email to sales@company.com"
→ workflow_create({
    name: "Weekly Lead Summary",
    prompt: "..." // The above description
  })
```

**Workflow Generation:**

When `prompt` is provided instead of `definition`, the tool:
1. Uses LLM to generate workflow definition from natural language
2. Validates the generated definition
3. Creates the workflow in DRAFT status
4. Returns the created workflow for review

### 6.3 workflow_update

```typescript
{
  name: "workflow_update",
  description: "Update a workflow's configuration or definition",
  parameters: {
    workflowId: { type: "string", required: true },
    name: { type: "string" },
    description: { type: "string" },
    definition: { type: "object" },
    status: { type: "string", enum: ["DRAFT", "ACTIVE", "PAUSED"] }
  }
}
```

### 6.4 workflow_execute

```typescript
{
  name: "workflow_execute",
  description: "Manually trigger a workflow execution",
  parameters: {
    workflowId: { type: "string", required: true },
    inputs: { type: "object", description: "Input variables for the workflow" }
  }
}

// Usage
"Run the sales report workflow for the West region"
→ workflow_execute({
    workflowId: "abc123",
    inputs: { region: "West" }
  })
```

### 6.5 workflow_status

```typescript
{
  name: "workflow_status",
  description: "Check the status of a workflow execution",
  parameters: {
    executionId: { type: "string", required: true }
  }
}
```

---

## 7. Triggers

### 7.1 Cron Trigger

Uses node-cron for scheduling.

```typescript
// Store cron jobs in memory on startup
async function initCronTriggers() {
  const workflows = await getActiveWorkflowsWithCronTrigger();
  for (const wf of workflows) {
    const { cronExpression, timezone } = wf.triggerConfig;
    cron.schedule(cronExpression, () => {
      executeWorkflow(wf.id, { triggeredBy: 'cron' });
    }, { timezone });
  }
}
```

### 7.2 Webhook Trigger

Each workflow with webhook trigger gets unique endpoint.

```typescript
// POST /api/workflows/webhook/:workflowId
app.post('/api/workflows/webhook/:workflowId', async (req, res) => {
  const { workflowId } = req.params;
  const workflow = await getWorkflow(workflowId);
  
  // Verify webhook secret
  const signature = req.headers['x-webhook-signature'];
  if (!verifySignature(signature, req.body, workflow.triggerConfig.webhookSecret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Execute workflow with webhook payload as input
  const execution = await executeWorkflow(workflowId, {
    triggeredBy: 'webhook',
    inputs: req.body
  });
  
  res.json({ executionId: execution.id });
});
```

### 7.3 Chat Trigger

Workflow triggered from conversation context.

```typescript
// Triggered when user message matches pattern
async function checkChatTriggers(message: string, conversationId: string) {
  const workflows = await getActiveWorkflowsWithChatTrigger();
  
  for (const wf of workflows) {
    const { triggerPhrase } = wf.triggerConfig;
    if (message.toLowerCase().includes(triggerPhrase.toLowerCase())) {
      await executeWorkflow(wf.id, {
        triggeredBy: 'chat',
        inputs: { message, conversationId }
      });
    }
  }
}
```

---

## 8. Testing Strategy

### Actual Test Counts (474 total)

| Area | Tests | Focus |
|------|-------|-------|
| Service | 41 | CRUD operations |
| Validation | 38 | Definition validation |
| Engine | 70 | Variable resolution, graph traversal, context |
| Node executors | 133 | All 5 node types |
| Triggers | 79 | Cron, webhook, chat |
| Agent tools | 47 | workflow_* tools + generator |
| UI Components | 16 | React Flow custom nodes |
| API Routes | 50 | REST endpoint integration |

### Key Test Scenarios

| Scenario | Test |
|----------|------|
| End-to-end execution | Create workflow, execute, verify output |
| Cron scheduling | Schedule fires, workflow runs |
| Webhook trigger | POST to webhook, workflow runs |
| Error handling | Node fails, execution fails gracefully |
| Agent creation | Agent creates workflow from prompt |

### Mock Strategy

```typescript
// Mock BullMQ for tests
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    close: vi.fn()
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn()
  }))
}));

// Mock LLM for agent node tests
vi.mock('../ai/llm', () => ({
  generateText: vi.fn().mockResolvedValue({
    text: 'Mocked response',
    usage: { promptTokens: 10, completionTokens: 20 }
  })
}));
```

---

## 9. Files to Create

### Core Engine

```
src/platform/workflows/
├── types.ts                 # Type definitions
├── service.ts               # CRUD operations
├── validation.ts            # Definition validation
├── engine/
│   ├── queue.ts             # BullMQ setup
│   ├── engine.ts            # Variable resolution, graph traversal
│   ├── processor.ts         # Job processor
│   └── context.ts           # Execution context management
├── nodes/
│   ├── index.ts             # Node registry
│   ├── trigger.ts           # Trigger executor
│   ├── agent.ts             # Agent executor
│   ├── tool.ts              # Tool executor
│   ├── condition.ts         # Condition executor
│   ├── communication.ts     # Communication executor
│   └── iterator.ts          # Iterator executor
├── triggers/
│   ├── index.ts             # Trigger registry
│   ├── manual.ts            # Manual trigger
│   ├── cron.ts              # Cron trigger
│   ├── webhook.ts           # Webhook trigger
│   └── chat.ts              # Chat trigger
└── tools/
    ├── index.ts             # Tool definitions
    ├── schemas.ts           # Tool schemas
    └── workflow-generator.ts # Generate workflow from prompt
```

### API Routes

```
src/platform/api/routes/
└── workflows.ts             # /api/workflows/* endpoints
```

### UI Components (Week 40)

```
src/platform/ui/workflows/
├── WorkflowDesigner.tsx     # Main canvas
├── WorkflowList.tsx         # List page
├── PropertiesPanel.tsx      # Node properties
├── ExecutionView.tsx        # Run status/logs
├── NodePalette.tsx          # Draggable nodes
└── nodes/
    ├── TriggerNode.tsx
    ├── AgentNode.tsx
    ├── ToolNode.tsx
    ├── ConditionNode.tsx
    ├── CommunicationNode.tsx
    └── IteratorNode.tsx
```

### Tests

```
src/platform/workflows/__tests__/
├── service.test.ts
├── validation.test.ts
├── engine/
│   ├── engine.test.ts
│   ├── processor.test.ts
│   └── context.test.ts
├── nodes/
│   ├── agent.test.ts
│   ├── tool.test.ts
│   ├── condition.test.ts
│   └── communication.test.ts
├── triggers/
│   ├── cron.test.ts
│   ├── webhook.test.ts
│   └── chat.test.ts
└── tools/
    ├── workflow-tools.test.ts
    └── workflow-generator.test.ts
```

---

## Phase 7 Checkpoint

| Criterion | Requirement | Status |
|-----------|-------------|--------|
| Designer | Create workflow visually with React Flow | ✅ |
| Execution | Workflow runs end-to-end via BullMQ | ✅ |
| Triggers | Cron, webhook, and chat triggers work | ✅ |
| Agent tools | Main agent can create/run workflows | ✅ |
| History | Can view past executions with logs | ✅ |
| Tests | 474 tests passing (exceeded 180 target) | ✅ |

---

## Dependencies

```json
{
  "dependencies": {
    "bullmq": "^5.0.0",
    "ioredis": "^5.3.0",
    "reactflow": "^11.0.0",
    "node-cron": "^3.0.0"
  },
  "devDependencies": {
    "@types/node-cron": "^3.0.0"
  }
}
```

---

## Notes

- **No separate workflow agent** - main agent uses workflow tools directly
- **SQL/CRM as tools** - agent node calls `execute_sql_query`, `execute_crm_query`, etc.
- **BullMQ for reliability** - Redis-backed queue handles retries, failures
- **React Flow for UI** - same as reference implementation
- **Prompt-to-workflow** - `workflow_create` with `prompt` parameter generates definition

---

## 10. Completion Summary

**Status:** ✅ COMPLETE (February 2026)

### Implemented

- [x] Week 35: Foundation & Data Model (Prisma schema, CRUD service, validation)
- [x] Week 36: Execution Engine Core (BullMQ queue, variable resolution, graph traversal)
- [x] Week 37: Node Executors (trigger, agent, tool, condition, communication, iterator)
- [x] Week 38: Agent Workflow Tools (workflow_list, workflow_create, workflow_execute, etc.)
- [x] Week 39: Triggers (manual, cron, webhook, chat)
- [x] Week 40: React Flow Designer UI (canvas, custom nodes, properties panel, execution view)

### Test Coverage

| Component | Tests |
|-----------|-------|
| Service | 41 |
| Validation | 38 |
| Engine (engine + processor + context) | 70 |
| Nodes (agent + tool + condition + communication + iterator) | 133 |
| Triggers (cron + webhook + chat) | 79 |
| Tools (workflow-tools + generator) | 47 |
| UI Components | 16 |
| API Routes | 50 |
| **Total** | **474** |

### Files Created

**Core Engine (27 files):**
```
src/platform/workflows/
├── types.ts
├── service.ts
├── validation.ts
├── index.ts
├── engine/
│   ├── queue.ts
│   ├── engine.ts
│   ├── processor.ts
│   ├── context.ts
│   └── index.ts
├── nodes/
│   ├── index.ts
│   ├── types.ts
│   ├── trigger.ts
│   ├── agent.ts
│   ├── tool.ts
│   ├── condition.ts
│   ├── communication.ts
│   └── iterator.ts
├── triggers/
│   ├── index.ts
│   ├── manual.ts
│   ├── cron.ts
│   ├── webhook.ts
│   └── chat.ts
└── tools/
    ├── index.ts
    ├── schemas.ts
    └── workflow-generator.ts
```

**UI Components (16 files):**
```
src/platform/ui/workflows/
├── WorkflowDesigner.tsx
├── PropertiesPanel.tsx
├── ExecutionView.tsx
├── index.ts
├── types.ts
├── hooks/
│   └── useWorkflowDesigner.ts
├── components/
│   ├── index.ts
│   ├── ExecutionLogEntry.tsx
│   └── FormField.tsx
└── nodes/
    ├── index.ts
    ├── TriggerNode.tsx
    ├── AgentNode.tsx
    ├── ToolNode.tsx
    ├── ConditionNode.tsx
    ├── CommunicationNode.tsx
    └── IteratorNode.tsx
```

**API Routes (1 file):**
```
src/platform/api/routes/workflows.ts
```

**Test Files (17 files):**
```
src/platform/workflows/__tests__/service.test.ts
src/platform/workflows/__tests__/validation.test.ts
src/platform/workflows/engine/__tests__/engine.test.ts
src/platform/workflows/engine/__tests__/processor.test.ts
src/platform/workflows/engine/__tests__/context.test.ts
src/platform/workflows/nodes/__tests__/agent.test.ts
src/platform/workflows/nodes/__tests__/tool.test.ts
src/platform/workflows/nodes/__tests__/condition.test.ts
src/platform/workflows/nodes/__tests__/communication.test.ts
src/platform/workflows/nodes/__tests__/iterator.test.ts
src/platform/workflows/triggers/__tests__/cron.test.ts
src/platform/workflows/triggers/__tests__/webhook.test.ts
src/platform/workflows/triggers/__tests__/chat.test.ts
src/platform/workflows/tools/__tests__/workflow-tools.test.ts
src/platform/workflows/tools/__tests__/workflow-generator.test.ts
src/platform/ui/workflows/nodes/__tests__/CustomNodes.test.ts
src/platform/api/routes/__tests__/workflows.test.ts
```

### Dependencies Added

```json
{
  "dependencies": {
    "bullmq": "^5.67.2",
    "ioredis": "^5.9.2",
    "reactflow": "^11.11.4"
  }
}
```

### Deviations from Original Plan

1. **Test count exceeded expectations:** Originally planned for ~180 tests (150 unit + 30 integration); actual implementation has 474 tests for more comprehensive coverage.

2. **node-cron not added as direct dependency:** Cron scheduling uses the existing gateway cron infrastructure rather than adding a new dependency.

3. **Additional UI components:** Added `ExecutionLogEntry`, `FormField` helper components and `useWorkflowDesigner` hook for better code organization.

### API Reference

See `docs/WORKFLOW-API.md` for complete REST API documentation.
