# GoodTeams Platform API Reference

Complete API documentation for the GoodTeams Enterprise AI Platform.

**Base URL:** `/api/platform`  
**API Version:** v1 (2026.1.30)

---

## Table of Contents

- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)
- [Endpoints](#endpoints)
  - [Health](#health)
  - [Auth](#auth)
  - [Organization](#organization)
  - [Users](#users)
  - [Permissions](#permissions)
  - [Invitations](#invitations)
  - [Workflows](#workflows)
  - [Executions](#executions)
  - [Connectors](#connectors)
  - [Tenant Gateway](#tenant-gateway)
  - [Audit Logs](#audit-logs)

---

## Authentication

The GoodTeams API uses Bearer token authentication via the `Authorization` header.

### Production Authentication (Microsoft Entra SSO)

```http
Authorization: Bearer <JWT_TOKEN>
```

JWT tokens are obtained through the Microsoft Entra SSO flow. See [Microsoft 365 Auth Architecture](./MICROSOFT-365-AUTH-ARCHITECTURE.md) for details.

### Development/Testing Authentication (Stub Auth)

For development and testing, the API accepts stub tokens with the format:

```
stub:<base64-encoded-json>
```

The JSON payload should contain:

```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "name": "User Name",
  "orgId": "organization-uuid",
  "role": "admin",
  "permissions": ["CRM_READ", "SQL_EXECUTE"]
}
```

**Roles:** `owner`, `admin`, `member`, `viewer`

**Example:**

```bash
# Create a stub token
TOKEN=$(echo '{"id":"123","email":"admin@test.com","name":"Admin","orgId":"org-1","role":"admin"}' | base64)
curl -H "Authorization: Bearer stub:$TOKEN" http://localhost:3000/api/platform/users/me
```

---

## Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `BAD_REQUEST` | 400 | Invalid request parameters or body |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `METHOD_NOT_ALLOWED` | 405 | HTTP method not supported |
| `CONFLICT` | 409 | Resource already exists or conflict |
| `UNPROCESSABLE_ENTITY` | 422 | Validation failed |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

---

## Rate Limits

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| Health Check | Unlimited | - |
| Authentication | 10 req | 1 minute |
| Read Operations | 100 req | 1 minute |
| Write Operations | 30 req | 1 minute |
| Workflow Executions | 10 req | 1 minute |

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706900000
```

---

## Endpoints

### Health

#### GET /health

Check API health status.

**Authentication:** Not required

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-02-02T12:00:00.000Z",
  "version": "2026.1.30",
  "uptime": 3600,
  "checks": {
    "database": "ok"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `ok`, `degraded`, or `unhealthy` |
| `timestamp` | string | ISO 8601 timestamp |
| `version` | string | API version |
| `uptime` | number | Seconds since server start |
| `checks` | object | Component health status |

---

### Auth

#### GET /auth/status

Get current authentication status.

**Authentication:** Optional

**Response (unauthenticated):**

```json
{
  "authenticated": false,
  "user": null,
  "entraConfigured": true
}
```

**Response (authenticated):**

```json
{
  "authenticated": true,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "role": "admin",
    "organizationId": "org-uuid"
  },
  "entraConfigured": true
}
```

---

#### GET /auth/entra/consent

Initiate Microsoft Entra admin consent flow for organization.

**Authentication:** Required (Admin)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `returnUrl` | string | URL to redirect after consent |

**Response:** HTTP 302 redirect to Microsoft

---

#### GET /auth/entra/login

Initiate user SSO login.

**Authentication:** Optional

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `returnUrl` | string | URL to redirect after login |
| `login_hint` | string | Pre-fill user email |
| `org` | string | Organization ID |

**Response:** HTTP 302 redirect to Microsoft

---

#### POST /auth/logout

Log out current user.

**Authentication:** Optional

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `federated` | boolean | Also logout from Microsoft |

**Response:**

```json
{
  "success": true,
  "redirectUrl": "https://login.microsoftonline.com/..."  // If federated=true
}
```

---

### Organization

#### GET /org

Get current organization details.

**Authentication:** Required

**Response:**

```json
{
  "id": "org-uuid",
  "name": "Acme Corporation",
  "status": "ACTIVE",
  "externalTenantId": "entra-tenant-id",
  "authorizedModels": ["anthropic/claude-sonnet-4-20250514", "openai/gpt-4o"],
  "defaultModelId": "anthropic/claude-sonnet-4-20250514",
  "memberCount": 25,
  "createdAt": "2026-01-15T10:00:00.000Z",
  "updatedAt": "2026-02-01T15:30:00.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `PENDING`, `ACTIVE`, `SUSPENDED`, `ARCHIVED` |
| `externalTenantId` | string | Microsoft Entra tenant ID |
| `authorizedModels` | array | AI models the org can use |

---

#### PUT /org

Update organization settings.

**Authentication:** Required (Admin)

**Request Body:**

```json
{
  "name": "Acme Corp Updated",
  "defaultModelId": "openai/gpt-4o",
  "authorizedModels": ["anthropic/claude-sonnet-4-20250514", "openai/gpt-4o"]
}
```

**Response:** Same as GET /org

---

#### GET /org/members

List organization members.

**Authentication:** Required

**Response:**

```json
{
  "members": [
    {
      "id": "user-uuid",
      "email": "user@example.com",
      "username": "John Doe",
      "role": "ADMIN",
      "externalId": "entra-object-id",
      "createdAt": "2026-01-15T10:00:00.000Z"
    }
  ],
  "total": 25
}
```

---

### Users

#### GET /users

List organization users.

**Authentication:** Required

**Response:**

```json
{
  "users": [
    {
      "id": "user-uuid",
      "email": "user@example.com",
      "username": "John Doe",
      "role": "USER",
      "externalId": "entra-object-id",
      "createdAt": "2026-01-15T10:00:00.000Z",
      "updatedAt": "2026-02-01T15:30:00.000Z"
    }
  ],
  "total": 25
}
```

---

#### GET /users/me

Get current user profile.

**Authentication:** Required

**Response:**

```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "username": "John Doe",
  "role": "ADMIN",
  "externalId": "entra-object-id",
  "permissions": ["CRM_READ", "SQL_EXECUTE"],
  "organization": {
    "id": "org-uuid",
    "name": "Acme Corporation",
    "status": "ACTIVE"
  },
  "createdAt": "2026-01-15T10:00:00.000Z",
  "updatedAt": "2026-02-01T15:30:00.000Z"
}
```

---

#### GET /users/:id

Get specific user.

**Authentication:** Required

**Response:**

```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "username": "John Doe",
  "role": "USER",
  "externalId": "entra-object-id",
  "permissions": ["CRM_READ"],
  "createdAt": "2026-01-15T10:00:00.000Z",
  "updatedAt": "2026-02-01T15:30:00.000Z"
}
```

---

#### PUT /users/:id/role

Change user role.

**Authentication:** Required (Admin)

**Request Body:**

```json
{
  "role": "ADMIN"
}
```

| Role | Description |
|------|-------------|
| `SUPER_ADMIN` | Platform-wide administrator |
| `ADMIN` | Organization administrator |
| `USER` | Regular user |
| `BILLING` | Billing-only access |
| `VIEWER` | Read-only access |

**Response:** Updated user object

**Errors:**

- `CONFLICT` (409): Cannot demote the last admin

---

#### DELETE /users/:id

Remove user from organization.

**Authentication:** Required (Admin)

**Response:**

```json
{
  "success": true,
  "message": "User removed from organization"
}
```

**Errors:**

- `CONFLICT` (409): Cannot remove the last admin

---

### Permissions

#### GET /permissions

List all available permission types.

**Authentication:** Required

**Response:**

```json
{
  "permissions": [
    {
      "name": "CRM_READ",
      "description": "Read access to CRM data",
      "category": "connectors"
    },
    {
      "name": "CRM_WRITE",
      "description": "Write access to CRM data",
      "category": "connectors"
    },
    {
      "name": "SQL_EXECUTE",
      "description": "Execute SQL queries",
      "category": "connectors"
    },
    {
      "name": "WORKFLOW_CREATE",
      "description": "Create workflows",
      "category": "workflows"
    }
  ]
}
```

---

#### GET /users/:id/permissions

Get user's permissions.

**Authentication:** Required

**Response:**

```json
{
  "userId": "user-uuid",
  "role": "USER",
  "implicitPermissions": ["DASHBOARD_VIEW", "CHAT_USE"],
  "explicitPermissions": ["CRM_READ", "SQL_EXECUTE"],
  "allPermissions": ["DASHBOARD_VIEW", "CHAT_USE", "CRM_READ", "SQL_EXECUTE"]
}
```

---

#### POST /users/:id/permissions

Grant permission to user.

**Authentication:** Required (Admin)

**Request Body:**

```json
{
  "permission": "CRM_READ"
}
```

**Response:**

```json
{
  "success": true,
  "permission": {
    "id": "perm-uuid",
    "name": "CRM_READ",
    "userId": "user-uuid",
    "grantedAt": "2026-02-02T12:00:00.000Z",
    "grantedBy": "admin-uuid"
  }
}
```

---

#### DELETE /users/:id/permissions/:name

Revoke permission from user.

**Authentication:** Required (Admin)

**Response:**

```json
{
  "success": true,
  "message": "Permission CRM_READ revoked from user"
}
```

---

### Invitations

#### GET /invitations

List pending invitations.

**Authentication:** Required (Admin)

**Response:**

```json
{
  "invitations": [
    {
      "id": "inv-uuid",
      "email": "newuser@example.com",
      "role": "USER",
      "status": "PENDING",
      "invitedBy": {
        "id": "admin-uuid",
        "email": "admin@example.com",
        "name": "Admin User"
      },
      "externalId": "entra-object-id",
      "entraUsername": "newuser@company.onmicrosoft.com",
      "entraDisplayName": "New User",
      "createdAt": "2026-02-01T10:00:00.000Z",
      "expiresAt": "2026-02-08T10:00:00.000Z"
    }
  ],
  "total": 5
}
```

| Status | Description |
|--------|-------------|
| `PENDING` | Awaiting acceptance |
| `ACCEPTED` | User joined |
| `EXPIRED` | Past expiration date |
| `REVOKED` | Cancelled by admin |

---

#### POST /invitations

Create invitation.

**Authentication:** Required (Admin)

**Request Body:**

```json
{
  "email": "newuser@example.com",
  "role": "USER",
  "externalId": "entra-object-id",
  "entraUsername": "newuser@company.onmicrosoft.com",
  "entraDisplayName": "New User"
}
```

**Response:**

```json
{
  "id": "inv-uuid",
  "email": "newuser@example.com",
  "role": "USER",
  "status": "PENDING",
  "token": "invite-token-xyz",
  "createdAt": "2026-02-02T12:00:00.000Z",
  "expiresAt": "2026-02-09T12:00:00.000Z"
}
```

---

#### POST /invitations/:token/accept

Accept invitation.

**Authentication:** Not required (uses token)

**Request Body:**

```json
{
  "email": "newuser@example.com"
}
```

**Response:**

```json
{
  "success": true,
  "user": {
    "id": "new-user-uuid",
    "email": "newuser@example.com",
    "role": "USER",
    "organizationId": "org-uuid"
  }
}
```

---

#### DELETE /invitations/:id

Revoke invitation.

**Authentication:** Required (Admin)

**Response:**

```json
{
  "success": true,
  "message": "Invitation revoked"
}
```

---

#### POST /invitations/:id/resend

Resend invitation email.

**Authentication:** Required (Admin)

**Response:**

```json
{
  "success": true,
  "message": "Invitation email resent"
}
```

---

### Workflows

#### GET /workflows

List workflows.

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status |
| `triggerType` | string | Filter by trigger type |
| `search` | string | Search by name |
| `limit` | number | Results per page (default: 20) |
| `offset` | number | Pagination offset |

**Response:**

```json
{
  "workflows": [
    {
      "id": "wf-uuid",
      "organizationId": "org-uuid",
      "name": "Customer Onboarding",
      "description": "Automated onboarding flow",
      "definition": {
        "nodes": [...],
        "edges": [...],
        "globalConfig": {}
      },
      "status": "ACTIVE",
      "triggerType": "WEBHOOK",
      "triggerConfig": {
        "webhookPath": "customer-signup"
      },
      "createdBy": "user-uuid",
      "createdAt": "2026-01-20T10:00:00.000Z",
      "updatedAt": "2026-02-01T15:30:00.000Z"
    }
  ],
  "total": 12,
  "limit": 20,
  "offset": 0
}
```

| Status | Description |
|--------|-------------|
| `DRAFT` | Not yet activated |
| `ACTIVE` | Running and accepting triggers |
| `PAUSED` | Temporarily disabled |
| `ARCHIVED` | Soft-deleted |

| Trigger Type | Description |
|--------------|-------------|
| `MANUAL` | API or UI triggered |
| `CRON` | Scheduled execution |
| `WEBHOOK` | HTTP webhook trigger |
| `CHAT` | Conversation triggered |
| `EMAIL` | Email triggered |

---

#### POST /workflows

Create workflow.

**Authentication:** Required

**Request Body:**

```json
{
  "name": "My Workflow",
  "description": "Workflow description",
  "definition": {
    "nodes": [
      {
        "id": "start",
        "type": "START",
        "config": {},
        "position": { "x": 0, "y": 100 }
      },
      {
        "id": "aiTask",
        "type": "AI_TASK",
        "config": {
          "prompt": "Process: {{inputs.data}}",
          "model": "anthropic/claude-sonnet-4-20250514"
        },
        "position": { "x": 200, "y": 100 }
      },
      {
        "id": "end",
        "type": "END",
        "config": {},
        "position": { "x": 400, "y": 100 }
      }
    ],
    "edges": [
      { "source": "start", "target": "aiTask" },
      { "source": "aiTask", "target": "end" }
    ]
  },
  "triggerType": "MANUAL"
}
```

**Node Types:**

| Type | Description |
|------|-------------|
| `START` | Workflow entry point |
| `END` | Workflow exit point |
| `AI_TASK` | AI/LLM processing |
| `HTTP` | HTTP request |
| `SQL` | Database query |
| `EMAIL` | Send email |
| `CONDITION` | Conditional branching |
| `LOG` | Log message |
| `DELAY` | Wait/delay |
| `HUMAN_INPUT` | Wait for user input |

**Response:** Created workflow object (status 201)

---

#### GET /workflows/:id

Get workflow details.

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `includeExecutions` | boolean | Include recent executions |
| `executionLimit` | number | Max executions to include |

**Response:** Workflow object

---

#### PUT /workflows/:id

Update workflow.

**Authentication:** Required

**Request Body:**

```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "status": "ACTIVE",
  "definition": {...},
  "triggerType": "CRON",
  "triggerConfig": {
    "cronExpression": "0 9 * * 1"
  }
}
```

**Response:** Updated workflow object

---

#### DELETE /workflows/:id

Archive workflow (soft delete).

**Authentication:** Required

**Response:** Archived workflow object (status: ARCHIVED)

---

#### POST /workflows/:id/execute

Execute workflow.

**Authentication:** Required

**Request Body:**

```json
{
  "inputs": {
    "customerId": "cust-123",
    "action": "onboard"
  }
}
```

**Response:**

```json
{
  "id": "exec-uuid",
  "workflowId": "wf-uuid",
  "status": "PENDING",
  "context": {
    "inputs": {...}
  },
  "logs": [],
  "triggeredBy": "user-uuid",
  "startedAt": "2026-02-02T12:00:00.000Z",
  "finishedAt": null,
  "error": null
}
```

Status: 201 Created

---

#### GET /workflows/:id/executions

List workflow executions.

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status |
| `limit` | number | Results per page |
| `offset` | number | Pagination offset |

**Response:**

```json
{
  "executions": [...],
  "total": 45,
  "limit": 20,
  "offset": 0
}
```

---

### Executions

#### GET /executions/:id

Get execution details.

**Authentication:** Required

**Response:**

```json
{
  "id": "exec-uuid",
  "workflowId": "wf-uuid",
  "status": "COMPLETED",
  "context": {
    "inputs": { "customerId": "cust-123" },
    "nodeOutputs": {
      "aiTask": { "result": "..." }
    },
    "globalVariables": {}
  },
  "logs": [
    {
      "timestamp": "2026-02-02T12:00:00.000Z",
      "nodeId": "start",
      "message": "Workflow started",
      "level": "info"
    },
    {
      "timestamp": "2026-02-02T12:00:01.000Z",
      "nodeId": "aiTask",
      "message": "AI task completed",
      "level": "info",
      "data": { "tokensUsed": 150 }
    }
  ],
  "triggeredBy": "user-uuid",
  "startedAt": "2026-02-02T12:00:00.000Z",
  "finishedAt": "2026-02-02T12:00:05.000Z",
  "error": null,
  "workflow": {
    "id": "wf-uuid",
    "name": "Customer Onboarding"
  }
}
```

| Status | Description |
|--------|-------------|
| `PENDING` | Queued for execution |
| `RUNNING` | Currently executing |
| `COMPLETED` | Finished successfully |
| `FAILED` | Finished with error |
| `WAITING_FOR_INPUT` | Paused waiting for user |

---

### Webhooks

#### POST /webhooks/:webhookPath

Trigger workflow via webhook.

**Authentication:** Not required (uses webhook path)

**Request Body:** Any JSON payload (passed as `inputs.webhook.payload`)

**Response:**

```json
{
  "success": true,
  "executionId": "exec-uuid",
  "workflowId": "wf-uuid",
  "status": "PENDING"
}
```

Status: 202 Accepted

---

### Connectors

#### GET /connectors

List connectors.

**Authentication:** Required

**Response:**

```json
{
  "connectors": [
    {
      "id": "conn-uuid",
      "organizationId": "org-uuid",
      "type": "SQL_SERVER",
      "name": "Production Database",
      "description": "Main SQL Server instance",
      "config": {
        "host": "sql.example.com",
        "port": 1433,
        "database": "production"
      },
      "status": "CONNECTED",
      "lastHealthCheck": "2026-02-02T11:55:00.000Z",
      "healthMessage": "Connection healthy",
      "isReadOnly": true,
      "createdAt": "2026-01-15T10:00:00.000Z",
      "updatedAt": "2026-02-01T15:30:00.000Z",
      "schemaHints": [
        {
          "id": "hint-uuid",
          "tableName": "customers",
          "columnName": "email",
          "description": "Customer email address"
        }
      ]
    }
  ],
  "total": 3
}
```

| Type | Description |
|------|-------------|
| `SQL_SERVER` | Microsoft SQL Server |
| `POSTGRESQL` | PostgreSQL |
| `MYSQL` | MySQL |
| `DATAVERSE` | Microsoft Dataverse |
| `SALESFORCE` | Salesforce |

| Status | Description |
|--------|-------------|
| `PENDING` | Awaiting first connection |
| `CONNECTED` | Active and healthy |
| `ERROR` | Connection failed |
| `DISABLED` | Manually disabled |

---

#### POST /connectors

Create connector.

**Authentication:** Required (Admin)

**Request Body:**

```json
{
  "type": "SQL_SERVER",
  "name": "Production Database",
  "description": "Main SQL Server instance",
  "config": {
    "host": "sql.example.com",
    "port": 1433,
    "database": "production",
    "encrypt": true
  },
  "credentials": {
    "username": "app_user",
    "password": "secure_password"
  },
  "isReadOnly": true
}
```

**Response:** Created connector object (status 201)

---

#### GET /connectors/:id

Get connector details.

**Authentication:** Required

**Response:** Connector object with schema hints

---

#### PUT /connectors/:id

Update connector.

**Authentication:** Required (Admin)

**Request Body:**

```json
{
  "name": "Updated Name",
  "config": {...},
  "credentials": {...},
  "isReadOnly": false
}
```

**Response:** Updated connector object

---

#### DELETE /connectors/:id

Delete connector.

**Authentication:** Required (Admin)

**Response:**

```json
{
  "success": true,
  "message": "Connector deleted"
}
```

---

#### POST /connectors/:id/test

Test connector connection.

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "latencyMs": 45,
  "version": "Microsoft SQL Server 2019",
  "message": "Connection successful"
}
```

---

#### POST /connectors/:id/refresh-schema

Refresh schema cache.

**Authentication:** Required (Admin)

**Response:**

```json
{
  "success": true,
  "tables": 42,
  "cachedAt": "2026-02-02T12:00:00.000Z",
  "expiresAt": "2026-02-09T12:00:00.000Z"
}
```

---

### Tenant Gateway

#### GET /tenant/gateway

Get gateway status.

**Authentication:** Required

**Response:**

```json
{
  "status": "HEALTHY",
  "port": 8001,
  "pid": 12345,
  "uptime": 86400,
  "health": {
    "lastCheck": "2026-02-02T11:59:00.000Z",
    "consecutiveFailures": 0
  },
  "resources": {
    "memoryMb": 128,
    "cpuPercent": 2.5,
    "activeSessions": 3
  }
}
```

| Status | Description |
|--------|-------------|
| `PROVISIONING` | Being set up |
| `STARTING` | Process starting |
| `HEALTHY` | Running and healthy |
| `UNHEALTHY` | Running but failing checks |
| `STOPPING` | Gracefully stopping |
| `STOPPED` | Gracefully stopped |
| `FAILED` | Unexpected failure |

---

#### POST /tenant/gateway/restart

Restart gateway.

**Authentication:** Required (Admin)

**Response:**

```json
{
  "success": true,
  "message": "Gateway restart initiated",
  "newPid": 12346
}
```

---

#### GET /tenant/config

Get tenant configuration.

**Authentication:** Required

**Response:**

```json
{
  "model": "anthropic/claude-sonnet-4-20250514",
  "agentName": "Acme Assistant",
  "systemPrompt": "You are a helpful assistant...",
  "features": {
    "codeExecution": true,
    "webBrowsing": true
  },
  "limits": {
    "maxTokensPerDay": 100000,
    "maxConcurrentSessions": 10,
    "maxMemoryMb": 512
  }
}
```

---

#### PUT /tenant/config

Update tenant configuration.

**Authentication:** Required (Admin)

**Request Body:**

```json
{
  "model": "openai/gpt-4o",
  "agentName": "New Name",
  "systemPrompt": "Updated prompt...",
  "features": {
    "codeExecution": false
  }
}
```

**Response:** Updated config object

---

#### POST /tenant/provision

Provision new tenant.

**Authentication:** Required (Admin)

**Request Body:**

```json
{
  "organizationId": "org-uuid"
}
```

**Response:**

```json
{
  "success": true,
  "gateway": {
    "port": 8002,
    "status": "PROVISIONING"
  }
}
```

---

#### DELETE /tenant/:orgId

Deprovision tenant.

**Authentication:** Required (Admin)

**Response:**

```json
{
  "success": true,
  "message": "Tenant deprovisioned"
}
```

---

### Audit Logs

#### GET /audit

Query audit logs.

**Authentication:** Required (Admin)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `actorId` | string | Filter by actor |
| `actorRole` | string | Filter by actor role |
| `action` | string | Filter by single action |
| `actions` | string | Filter by multiple actions (comma-separated) |
| `targetType` | string | Filter by target type |
| `targetId` | string | Filter by target ID |
| `startDate` | string | ISO 8601 start date |
| `endDate` | string | ISO 8601 end date |
| `riskLevels` | string | Filter by risk (low,medium,high,critical) |
| `ipAddress` | string | Filter by IP |
| `limit` | number | Results per page (max: 1000) |
| `offset` | number | Pagination offset |

**Response:**

```json
{
  "entries": [
    {
      "id": "log-uuid",
      "organizationId": "org-uuid",
      "actorId": "user-uuid",
      "actorRole": "ADMIN",
      "action": "user.role.changed",
      "targetType": "user",
      "targetId": "target-uuid",
      "details": {
        "oldRole": "USER",
        "newRole": "ADMIN"
      },
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2026-02-02T10:30:00.000Z"
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

---

#### GET /audit/stats

Get audit statistics.

**Authentication:** Required (Admin)

**Response:**

```json
{
  "totalEvents": 1500,
  "last24h": 45,
  "last7d": 280,
  "last30d": 1200,
  "byAction": {
    "user.login.sso": 500,
    "workflow.executed": 300,
    "user.role.changed": 25
  },
  "byRisk": {
    "low": 1200,
    "medium": 250,
    "high": 45,
    "critical": 5
  }
}
```

---

#### GET /audit/export

Export audit logs.

**Authentication:** Required (Admin)

**Query Parameters:**

Same as GET /audit, plus:

| Parameter | Type | Description |
|-----------|------|-------------|
| `format` | string | `json`, `csv`, or `xlsx` |

**Response:** File download with appropriate Content-Type

---

#### GET /audit/:id

Get single audit entry.

**Authentication:** Required (Admin)

**Response:** Single audit log entry

---

## Appendix

### Workflow Definition Schema

```typescript
interface WorkflowDefinition {
  nodes: Array<{
    id: string;
    type: NodeType;
    config: Record<string, unknown>;
    position: { x: number; y: number };
  }>;
  edges: Array<{
    source: string;
    target: string;
    condition?: string;
  }>;
  globalConfig?: {
    timeout?: number;
    retryPolicy?: {
      maxRetries: number;
      backoffMs: number;
    };
  };
}
```

### Template Syntax

Workflows support Liquid-style templates:

- `{{inputs.fieldName}}` - Access input values
- `{{nodes.nodeId.output}}` - Access node outputs
- `{{env.ENV_VAR}}` - Access environment variables
- `{{secrets.SECRET_NAME}}` - Access secrets
- `{{now | date: '%Y-%m-%d'}}` - Date formatting

### Permissions Reference

| Permission | Description |
|------------|-------------|
| `DASHBOARD_VIEW` | View dashboard |
| `CHAT_USE` | Use AI chat |
| `WORKFLOW_VIEW` | View workflows |
| `WORKFLOW_CREATE` | Create workflows |
| `WORKFLOW_EXECUTE` | Execute workflows |
| `CONNECTOR_VIEW` | View connectors |
| `CONNECTOR_MANAGE` | Manage connectors |
| `CRM_READ` | Read CRM data |
| `CRM_WRITE` | Write CRM data |
| `SQL_EXECUTE` | Execute SQL queries |
| `USER_MANAGE` | Manage users |
| `AUDIT_VIEW` | View audit logs |

---

*Last updated: 2026-02-02*
