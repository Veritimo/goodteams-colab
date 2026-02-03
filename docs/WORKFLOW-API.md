# Workflow API Documentation

> REST API for Visual Workflow Engine

**Version:** 1.0  
**Base URL:** `/api/platform/workflows`  
**Authentication:** Required (Bearer token or session cookie)

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Workflow Endpoints](#2-workflow-endpoints)
3. [Execution Endpoints](#3-execution-endpoints)
4. [Webhook Endpoints](#4-webhook-endpoints)
5. [Request/Response Formats](#5-requestresponse-formats)
6. [Error Codes](#6-error-codes)
7. [Webhook Setup Guide](#7-webhook-setup-guide)

---

## 1. Authentication

All API requests require authentication. Include one of:

### Bearer Token
```http
Authorization: Bearer <access_token>
```

### Session Cookie
```http
Cookie: session=<session_id>
```

### Organization Context
Most endpoints require organization context. Include:
```http
X-Organization-Id: <org_id>
```

---

## 2. Workflow Endpoints

### List Workflows

Retrieve all workflows for the current organization.

```http
GET /api/platform/workflows
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | - | Filter by status: `DRAFT`, `ACTIVE`, `PAUSED`, `ARCHIVED` |
| `limit` | number | 20 | Maximum results (1-100) |
| `offset` | number | 0 | Pagination offset |

**Response:**
```json
{
  "workflows": [
    {
      "id": "wf_abc123",
      "name": "Weekly Sales Report",
      "description": "Generates and emails sales summary every Monday",
      "status": "ACTIVE",
      "triggerType": "CRON",
      "createdBy": "user_xyz",
      "createdAt": "2026-02-01T10:00:00Z",
      "updatedAt": "2026-02-01T12:30:00Z"
    }
  ],
  "total": 15,
  "limit": 20,
  "offset": 0
}
```

---

### Create Workflow

Create a new workflow.

```http
POST /api/platform/workflows
```

**Request Body:**
```json
{
  "name": "Customer Onboarding",
  "description": "Automated customer welcome sequence",
  "definition": {
    "nodes": [
      {
        "id": "trigger-1",
        "type": "trigger",
        "position": { "x": 100, "y": 100 },
        "data": {
          "label": "Webhook Trigger",
          "config": {
            "triggerType": "webhook"
          }
        }
      },
      {
        "id": "agent-1",
        "type": "agent",
        "position": { "x": 100, "y": 250 },
        "data": {
          "label": "Generate Welcome Email",
          "config": {
            "prompt": "Write a personalized welcome email for {{inputs.customerName}} at {{inputs.company}}",
            "model": "anthropic/claude-3-sonnet"
          }
        }
      },
      {
        "id": "comm-1",
        "type": "communication",
        "position": { "x": 100, "y": 400 },
        "data": {
          "label": "Send Email",
          "config": {
            "method": "email",
            "to": "{{inputs.email}}",
            "subject": "Welcome to GoodTeams!",
            "body": "{{nodes.agent-1.text}}"
          }
        }
      }
    ],
    "edges": [
      { "id": "e1", "source": "trigger-1", "target": "agent-1" },
      { "id": "e2", "source": "agent-1", "target": "comm-1" }
    ],
    "globalConfig": {
      "maxExecutionTime": 300000,
      "retryOnError": true
    }
  },
  "triggerType": "WEBHOOK"
}
```

**Response:** `201 Created`
```json
{
  "id": "wf_def456",
  "name": "Customer Onboarding",
  "description": "Automated customer welcome sequence",
  "status": "DRAFT",
  "triggerType": "WEBHOOK",
  "triggerConfig": {
    "webhookPath": "/api/platform/workflows/webhook/wf_def456",
    "webhookSecret": "whsec_xyz789"
  },
  "definition": { ... },
  "createdBy": "user_xyz",
  "createdAt": "2026-02-02T15:00:00Z",
  "updatedAt": "2026-02-02T15:00:00Z"
}
```

---

### Get Workflow

Retrieve a specific workflow with its definition.

```http
GET /api/platform/workflows/:id
```

**Response:**
```json
{
  "id": "wf_abc123",
  "name": "Weekly Sales Report",
  "description": "Generates and emails sales summary every Monday",
  "status": "ACTIVE",
  "triggerType": "CRON",
  "triggerConfig": {
    "cronExpression": "0 9 * * MON",
    "timezone": "America/New_York"
  },
  "definition": {
    "nodes": [...],
    "edges": [...],
    "globalConfig": {...}
  },
  "createdBy": "user_xyz",
  "createdAt": "2026-02-01T10:00:00Z",
  "updatedAt": "2026-02-01T12:30:00Z"
}
```

---

### Update Workflow

Update workflow properties or definition.

```http
PUT /api/platform/workflows/:id
```

**Request Body:**
```json
{
  "name": "Weekly Sales Report v2",
  "description": "Updated description",
  "status": "ACTIVE",
  "definition": {
    "nodes": [...],
    "edges": [...]
  },
  "triggerConfig": {
    "cronExpression": "0 8 * * MON",
    "timezone": "America/Los_Angeles"
  }
}
```

**Notes:**
- Partial updates supported (only include fields to change)
- Changing status to `ACTIVE` validates the workflow definition
- Cannot update `ARCHIVED` workflows

**Response:** `200 OK`
```json
{
  "id": "wf_abc123",
  "name": "Weekly Sales Report v2",
  "status": "ACTIVE",
  ...
}
```

---

### Delete (Archive) Workflow

Archive a workflow. Does not delete execution history.

```http
DELETE /api/platform/workflows/:id
```

**Response:** `204 No Content`

---

### Execute Workflow

Manually trigger a workflow execution.

```http
POST /api/platform/workflows/:id/execute
```

**Request Body:**
```json
{
  "inputs": {
    "region": "West",
    "startDate": "2026-01-01",
    "endDate": "2026-01-31"
  }
}
```

**Response:** `202 Accepted`
```json
{
  "executionId": "exec_ghi789",
  "workflowId": "wf_abc123",
  "status": "PENDING",
  "startedAt": "2026-02-02T16:00:00Z"
}
```

---

### List Workflow Executions

Get execution history for a workflow.

```http
GET /api/platform/workflows/:id/executions
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | - | Filter: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `WAITING_FOR_INPUT` |
| `limit` | number | 20 | Maximum results (1-100) |
| `offset` | number | 0 | Pagination offset |

**Response:**
```json
{
  "executions": [
    {
      "id": "exec_ghi789",
      "workflowId": "wf_abc123",
      "status": "COMPLETED",
      "triggeredBy": "user_xyz",
      "startedAt": "2026-02-02T16:00:00Z",
      "finishedAt": "2026-02-02T16:00:45Z"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

---

## 3. Execution Endpoints

### Get Execution Details

Get detailed information about a specific execution.

```http
GET /api/platform/executions/:id
```

**Response:**
```json
{
  "id": "exec_ghi789",
  "workflowId": "wf_abc123",
  "workflowName": "Weekly Sales Report",
  "status": "COMPLETED",
  "triggeredBy": "user_xyz",
  "startedAt": "2026-02-02T16:00:00Z",
  "finishedAt": "2026-02-02T16:00:45Z",
  "context": {
    "inputs": {
      "region": "West"
    },
    "nodeOutputs": {
      "agent-1": {
        "text": "Sales report for West region...",
        "usage": { "promptTokens": 150, "completionTokens": 500 }
      },
      "tool-1": {
        "data": { "totalSales": 125000, "deals": 45 }
      }
    }
  },
  "logs": [
    {
      "timestamp": "2026-02-02T16:00:01Z",
      "nodeId": "trigger-1",
      "level": "info",
      "message": "Workflow started via manual trigger"
    },
    {
      "timestamp": "2026-02-02T16:00:05Z",
      "nodeId": "agent-1",
      "level": "info",
      "message": "Agent node completed"
    },
    {
      "timestamp": "2026-02-02T16:00:45Z",
      "nodeId": "comm-1",
      "level": "info",
      "message": "Email sent successfully"
    }
  ],
  "error": null
}
```

---

## 4. Webhook Endpoints

### Webhook Trigger

Trigger a workflow via its unique webhook URL.

```http
POST /api/platform/workflows/webhook/:workflowId
```

**Headers:**
```http
Content-Type: application/json
X-Webhook-Signature: sha256=<signature>
```

**Request Body:** (passed as workflow inputs)
```json
{
  "event": "customer.created",
  "data": {
    "customerId": "cust_123",
    "customerName": "Acme Corp",
    "email": "contact@acme.com"
  }
}
```

**Response:** `200 OK`
```json
{
  "executionId": "exec_jkl012",
  "status": "PENDING"
}
```

**Signature Verification:**
The signature is computed as:
```
HMAC-SHA256(webhook_secret, request_body)
```

Include as hex-encoded string prefixed with `sha256=`.

---

## 5. Request/Response Formats

### Workflow Definition

```typescript
interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  globalConfig?: {
    maxExecutionTime?: number;      // milliseconds, default 300000 (5 min)
    retryOnError?: boolean;         // default false
    notifyOnComplete?: boolean;     // default false
  };
}

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'agent' | 'tool' | 'condition' | 'communication' | 'iterator';
  position: { x: number; y: number };
  data: {
    label?: string;
    config: NodeConfig;  // Type-specific configuration
  };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;  // For conditions: 'true' | 'false'
}
```

### Node Configurations

**Trigger Node:**
```json
{
  "triggerType": "webhook",
  "webhookPath": "/api/platform/workflows/webhook/wf_xxx",
  "webhookSecret": "whsec_xxx"
}
```

**Agent Node:**
```json
{
  "prompt": "Analyze this data: {{inputs.data}}",
  "systemPrompt": "You are a data analyst.",
  "model": "anthropic/claude-3-sonnet",
  "temperature": 0.7,
  "tools": ["execute_sql_query"],
  "maxTokens": 1000
}
```

**Tool Node:**
```json
{
  "toolName": "execute_sql_query",
  "connectionId": "conn_abc",
  "query": "SELECT * FROM sales WHERE region = '{{inputs.region}}'"
}
```

**Condition Node:**
```json
{
  "expression": "{{nodes.tool-1.data.totalSales}} > 100000"
}
```

**Communication Node:**
```json
{
  "method": "email",
  "to": "{{inputs.recipientEmail}}",
  "subject": "Report: {{inputs.reportTitle}}",
  "body": "{{nodes.agent-1.text}}"
}
```

**Iterator Node:**
```json
{
  "collection": "{{nodes.tool-1.data.rows}}",
  "itemVariable": "row"
}
```

---

## 6. Error Codes

### HTTP Status Codes

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 201 | Created |
| 202 | Accepted (async operation started) |
| 204 | No Content (successful deletion) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid/missing auth) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (e.g., duplicate name) |
| 422 | Unprocessable Entity (invalid definition) |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |

### Error Response Format

```json
{
  "error": {
    "code": "WORKFLOW_VALIDATION_ERROR",
    "message": "Invalid workflow definition",
    "details": {
      "issues": [
        {
          "path": "nodes[1].data.config.prompt",
          "message": "Required field missing"
        }
      ]
    }
  }
}
```

### Error Codes Reference

| Code | Description |
|------|-------------|
| `WORKFLOW_NOT_FOUND` | Workflow ID does not exist |
| `WORKFLOW_VALIDATION_ERROR` | Definition failed validation |
| `WORKFLOW_NOT_ACTIVE` | Cannot execute non-active workflow |
| `WORKFLOW_ALREADY_EXISTS` | Workflow with same name exists |
| `WORKFLOW_ACCESS_DENIED` | User lacks permission |
| `EXECUTION_NOT_FOUND` | Execution ID does not exist |
| `INVALID_WEBHOOK_SIGNATURE` | Webhook signature verification failed |
| `TRIGGER_CONFIG_INVALID` | Invalid trigger configuration |
| `NODE_EXECUTION_ERROR` | Error during node execution |

---

## 7. Webhook Setup Guide

### Step 1: Create a Webhook-Triggered Workflow

```bash
curl -X POST https://api.goodteams.ai/api/platform/workflows \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Customer Webhook Handler",
    "triggerType": "WEBHOOK",
    "definition": {
      "nodes": [
        {
          "id": "trigger-1",
          "type": "trigger",
          "position": {"x": 100, "y": 100},
          "data": {"config": {"triggerType": "webhook"}}
        }
      ],
      "edges": []
    }
  }'
```

Response includes `triggerConfig.webhookPath` and `triggerConfig.webhookSecret`.

### Step 2: Activate the Workflow

```bash
curl -X PUT https://api.goodteams.ai/api/platform/workflows/wf_xxx \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "ACTIVE"}'
```

### Step 3: Configure Your External Service

Add the webhook URL to your service (e.g., Stripe, GitHub, Salesforce):

**Webhook URL:**
```
https://api.goodteams.ai/api/platform/workflows/webhook/wf_xxx
```

**Signing Secret:** Use the `webhookSecret` from Step 1

### Step 4: Implement Signature Verification (sender side)

```javascript
const crypto = require('crypto');

function signPayload(payload, secret) {
  const signature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return `sha256=${signature}`;
}

// Add to request headers
headers['X-Webhook-Signature'] = signPayload(payload, webhookSecret);
```

### Step 5: Test the Webhook

```bash
# Generate signature
SECRET="whsec_xxx"
PAYLOAD='{"event":"test","data":{"id":"123"}}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

# Send test request
curl -X POST https://api.goodteams.ai/api/platform/workflows/webhook/wf_xxx \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: sha256=$SIGNATURE" \
  -d "$PAYLOAD"
```

### Webhook Best Practices

1. **Always verify signatures** - Never skip signature verification in production
2. **Use HTTPS** - All webhook URLs must use HTTPS
3. **Handle retries** - Implement idempotency for duplicate deliveries
4. **Set timeouts** - Configure reasonable timeout (30s recommended)
5. **Log everything** - Log webhook receipts for debugging
6. **Rotate secrets** - Periodically rotate webhook secrets

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| Workflow CRUD | 100 requests/minute |
| Execute Workflow | 30 requests/minute |
| Webhook Triggers | 60 requests/minute per workflow |
| List/Get | 200 requests/minute |

Rate limit headers included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706889600
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import { GoodTeamsClient } from '@goodteams/sdk';

const client = new GoodTeamsClient({ apiKey: 'gt_xxx' });

// Create workflow
const workflow = await client.workflows.create({
  name: 'My Workflow',
  definition: { nodes: [...], edges: [...] }
});

// Execute workflow
const execution = await client.workflows.execute(workflow.id, {
  inputs: { region: 'West' }
});

// Check status
const status = await client.executions.get(execution.executionId);
console.log(status.status); // 'COMPLETED'
```

### Python

```python
from goodteams import GoodTeamsClient

client = GoodTeamsClient(api_key='gt_xxx')

# Create workflow
workflow = client.workflows.create(
    name='My Workflow',
    definition={'nodes': [...], 'edges': [...]}
)

# Execute workflow
execution = client.workflows.execute(
    workflow_id=workflow.id,
    inputs={'region': 'West'}
)

# Check status
status = client.executions.get(execution.execution_id)
print(status.status)  # 'COMPLETED'
```

---

## Changelog

### v1.0 (February 2026)
- Initial release
- Workflow CRUD operations
- Execution management
- Webhook triggers
- Cron scheduling
- All node types (trigger, agent, tool, condition, communication, iterator)
