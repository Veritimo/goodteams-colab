# Phase 3: Multi-Tenancy Implementation Plan

> Gateway-per-Tenant Architecture for GoodTeams

**Duration:** 5 weeks  
**Status:** In Progress  
**Dependencies:** Phase 2 Security Foundation ✅

---

## Overview

Phase 3 implements the gateway-per-tenant isolation model where each organization gets their own OpenClaw gateway process. This provides:

- **Process-level isolation** (OS enforces memory separation)
- **Independent scaling** (move heavy tenants to dedicated resources)
- **Simplified debugging** (isolated logs per tenant)
- **No core OpenClaw changes** (orchestration layer only)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Platform Control Plane                       │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Tenant     │  │   Gateway    │  │    Provisioner       │  │
│  │   Registry   │  │   Registry   │  │    Service           │  │
│  │   (Postgres) │  │   (Postgres) │  │                      │  │
│  └──────────────┘  └──────────────┘  │  • Spawn gateways    │  │
│                                      │  • Health monitoring  │  │
│                                      │  • Auto-restart       │  │
│                                      └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Tenant Gateway Layer                        │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Gateway A  │  │  Gateway B  │  │  Gateway C  │             │
│  │  (Acme)     │  │  (Contoso)  │  │  (Fabrikam) │             │
│  │  :18001     │  │  :18002     │  │  :18003     │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                  │
│  /tenants/acme/      /tenants/contoso/    /tenants/fabrikam/   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Streams

### Stream A: Tenant Data Layer
**Owner:** Agent A  
**Duration:** Week 1

| Task | Description |
|------|-------------|
| Prisma schema updates | Add TenantGateway, TenantConfig models |
| Tenant lifecycle | Status transitions (provisioning → active → suspended) |
| Gateway registry | Track gateway processes per tenant |
| Port allocation | Dynamic port assignment (18000-18999 range) |

### Stream B: Gateway Process Manager  
**Owner:** Agent B  
**Duration:** Weeks 1-2

| Task | Description |
|------|-------------|
| Process spawner | `child_process.spawn()` for gateway processes |
| Gateway lifecycle | Start, stop, restart, graceful shutdown |
| Health monitoring | HTTP health checks, auto-restart on failure |
| Resource limits | Memory/CPU limits per tenant |
| Process registry | Track PIDs, ports, status |

### Stream C: Tenant Routing
**Owner:** Agent C  
**Duration:** Week 2

| Task | Description |
|------|-------------|
| Request router | Route HTTP requests to correct gateway |
| Tenant identification | Extract tenant from JWT/subdomain/header |
| WebSocket proxy | Proxy WS connections to tenant gateway |
| API proxy | Forward `/api/*` to tenant gateway |

### Stream D: Configuration & Credentials
**Owner:** Agent D  
**Duration:** Week 3

| Task | Description |
|------|-------------|
| Config templates | Default openclaw.json for new tenants |
| Per-tenant config | Generate config with tenant-specific settings |
| Config API | CRUD endpoints for tenant config |
| Hot reload | Signal gateway to reload config |
| Credential isolation | Per-tenant secrets storage |

---

## Database Schema

### New Tables

```prisma
// Add to schema.prisma

model TenantGateway {
  id              String   @id @default(uuid())
  organizationId  String   @unique
  organization    Organization @relation(fields: [organizationId], references: [id])
  
  // Gateway process info
  port            Int      @unique
  pid             Int?
  status          GatewayStatus @default(PROVISIONING)
  
  // Health tracking
  lastHealthCheck DateTime?
  consecutiveFailures Int @default(0)
  
  // Resource usage
  memoryMb        Int?
  cpuPercent      Float?
  activeSessions  Int @default(0)
  
  // Paths
  configPath      String
  statePath       String
  workspacePath   String
  
  // Timestamps
  startedAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([status])
  @@index([port])
}

enum GatewayStatus {
  PROVISIONING   // Being set up
  STARTING       // Process starting
  HEALTHY        // Running and healthy
  UNHEALTHY      // Failed health checks
  STOPPING       // Graceful shutdown
  STOPPED        // Process stopped
  FAILED         // Failed to start
}

model TenantConfig {
  id              String   @id @default(uuid())
  organizationId  String   @unique
  organization    Organization @relation(fields: [organizationId], references: [id])
  
  // Model settings
  model           String   @default("anthropic/claude-sonnet-4-20250514")
  
  // Agent settings
  agentName       String   @default("Assistant")
  systemPrompt    String?
  
  // Feature flags
  features        Json     @default("{}")
  
  // Limits (based on plan)
  maxTokensPerDay     Int @default(50000)
  maxConcurrentSessions Int @default(5)
  maxMemoryMb         Int @default(256)
  
  // Timestamps
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model TenantCredential {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  
  // Credential info
  key             String   // e.g., "ANTHROPIC_API_KEY"
  encryptedValue  String   // AES-256-GCM encrypted
  
  // Metadata
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  rotatedAt       DateTime?
  
  @@unique([organizationId, key])
  @@index([organizationId])
}
```

---

## API Endpoints

### Tenant Gateway Management

```typescript
// Platform API routes

// GET /api/platform/tenant/gateway
// Returns current tenant's gateway status
interface GatewayStatusResponse {
  status: GatewayStatus;
  port: number;
  uptime?: number;
  health: {
    lastCheck: string;
    consecutive_failures: number;
  };
  resources?: {
    memoryMb: number;
    cpuPercent: number;
    activeSessions: number;
  };
}

// POST /api/platform/tenant/gateway/restart
// Restart tenant's gateway (admin only)
interface RestartResponse {
  success: boolean;
  message: string;
  newPid?: number;
}

// GET /api/platform/tenant/config
// Get tenant configuration
interface TenantConfigResponse {
  model: string;
  agentName: string;
  systemPrompt?: string;
  features: Record<string, boolean>;
  limits: {
    maxTokensPerDay: number;
    maxConcurrentSessions: number;
    maxMemoryMb: number;
  };
}

// PUT /api/platform/tenant/config
// Update tenant configuration (admin only)
interface UpdateConfigRequest {
  model?: string;
  agentName?: string;
  systemPrompt?: string;
  features?: Record<string, boolean>;
}

// Internal endpoints (not exposed via API)

// POST /internal/gateways/provision
// Provision gateway for new tenant
interface ProvisionRequest {
  organizationId: string;
}

// POST /internal/gateways/:id/health
// Record health check result
interface HealthCheckRequest {
  healthy: boolean;
  memoryMb?: number;
  cpuPercent?: number;
  activeSessions?: number;
}
```

---

## File Structure

```
src/platform/
├── tenant/
│   ├── index.ts                    # Barrel export
│   ├── gateway-manager.ts          # Process lifecycle management
│   ├── gateway-provisioner.ts      # New tenant gateway setup
│   ├── gateway-health.ts           # Health monitoring loop
│   ├── port-allocator.ts           # Port allocation
│   ├── config-generator.ts         # Generate openclaw.json
│   ├── config-templates.ts         # Default config templates
│   ├── credential-vault.ts         # Encrypted credential storage
│   ├── router.ts                   # Request routing to gateways
│   └── __tests__/
│       ├── gateway-manager.test.ts
│       ├── gateway-provisioner.test.ts
│       ├── gateway-health.test.ts
│       ├── port-allocator.test.ts
│       ├── config-generator.test.ts
│       ├── credential-vault.test.ts
│       └── router.test.ts
├── api/
│   └── routes/
│       └── tenant-gateway.ts       # API routes for gateway management
└── ...
```

---

## Testing Requirements

### Unit Tests (per file)
- gateway-manager.test.ts (15+ tests)
- gateway-provisioner.test.ts (12+ tests)
- gateway-health.test.ts (10+ tests)
- port-allocator.test.ts (8+ tests)
- config-generator.test.ts (10+ tests)
- credential-vault.test.ts (12+ tests)
- router.test.ts (15+ tests)

### Integration Tests
- Full provisioning flow
- Gateway restart/recovery
- Multi-tenant isolation verification
- Config hot reload

### E2E Tests
- `tenant_isolation` - Tenant A cannot access Tenant B data
- `tenant_crud` - Full tenant lifecycle
- `gateway_recovery` - Gateway restarts after crash

---

## Phase 3 Checkpoint

| Criterion | Requirement |
|-----------|-------------|
| Isolation | Tenant A cannot access Tenant B data |
| Provisioning | New tenant gets running gateway in <30s |
| Routing | Requests route to correct gateway |
| Health | Unhealthy gateways auto-restart |
| Config | Config changes apply without restart |
| Tests | All unit + integration tests pass |
| E2E | `tenant_isolation`, `tenant_crud` pass |

---

## Implementation Notes

### Port Range
- Platform control plane: 18000
- Tenant gateways: 18001-18999
- Max 999 tenants per deployment

### Process Isolation
- Each gateway runs as separate Node.js process
- Memory limits enforced via process monitoring
- Workspace isolation via separate directories

### Health Checks
- HTTP GET to gateway `/health` endpoint
- 10-second interval
- 3 consecutive failures → restart
- Exponential backoff on repeated failures

### Config Hot Reload
- Send SIGUSR1 to gateway process
- Gateway reloads config without session loss
- Fallback: full restart if reload fails
