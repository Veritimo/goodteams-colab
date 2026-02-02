# Multi-Tenant Architecture

**Gateway-per-Tenant Process Isolation for GoodTeams SaaS**

*Author: Forge 🔨*  
*Date: February 2026*  
*Version: 1.0*

---

## Executive Summary

GoodTeams achieves multi-tenancy through **process-level isolation** — each tenant gets their own OpenClaw gateway process. This design:

1. **Preserves OpenClaw's single-tenant architecture** — No changes to core
2. **Provides strong isolation** — Process boundaries prevent data leakage
3. **Enables cost-efficient scaling** — Multiple gateway processes per VM
4. **Simplifies compliance** — Clear tenant boundaries for auditing

This document details the V1 architecture and evolution path toward stronger isolation models.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Component Specifications](#3-component-specifications)
4. [Deployment Model](#4-deployment-model)
5. [Scaling Strategy](#5-scaling-strategy)
6. [Security Model](#6-security-model)
7. [Operations](#7-operations)
8. [Evolution Path](#8-evolution-path)
9. [Integration with Strategy](#9-integration-with-strategy)

---

## 1. Overview

### The Challenge

OpenClaw is designed as a single-tenant, single-user system:
- Configuration stored in `~/.openclaw/`
- Sessions keyed by agent ID, not tenant
- No tenant isolation in memory/storage
- Gateway binds to single auth context

Modifying OpenClaw core for multi-tenancy would require:
- Deep changes to session management, config, memory, plugins
- Risk of breaking the mature, well-tested codebase
- Ongoing maintenance burden keeping multi-tenant code in sync

### The Solution: Gateway-per-Tenant

Instead of modifying OpenClaw, we **run one gateway process per tenant**:

```
┌─────────────────────────────────────────────────────────────────┐
│                      Traditional Multi-Tenant                    │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              Single Process, Shared Memory               │   │
│   │   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │   │
│   │   │Tenant A │ │Tenant B │ │Tenant C │ │Tenant D │      │   │
│   │   └─────────┘ └─────────┘ └─────────┘ └─────────┘      │   │
│   │               (isolation via code)                       │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

                              vs.

┌─────────────────────────────────────────────────────────────────┐
│                   Gateway-per-Tenant (V1)                        │
│                                                                  │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│   │   Process A  │ │   Process B  │ │   Process C  │            │
│   │   (Tenant A) │ │   (Tenant B) │ │   (Tenant C) │            │
│   │              │ │              │ │              │            │
│   │  OpenClaw    │ │  OpenClaw    │ │  OpenClaw    │            │
│   │  Gateway     │ │  Gateway     │ │  Gateway     │            │
│   └──────────────┘ └──────────────┘ └──────────────┘            │
│              (isolation via OS process boundaries)               │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Works

| Benefit | Explanation |
|---------|-------------|
| **No core changes** | OpenClaw remains single-tenant; we orchestrate multiple instances |
| **Process isolation** | OS enforces memory separation — no shared state between tenants |
| **Independent scaling** | Heavy tenants can be moved to dedicated VMs |
| **Blast radius containment** | Crash in one tenant doesn't affect others |
| **Simpler debugging** | Each tenant's logs are isolated |
| **Compliance-friendly** | Clear audit boundaries per tenant |

### Cost Efficiency

Running separate processes doesn't mean separate VMs:

```
┌─────────────────────────────────────────────────────────────────┐
│                          VM (4GB RAM)                            │
│                                                                  │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│   │ Gateway  │ │ Gateway  │ │ Gateway  │ │ Gateway  │          │
│   │:18001    │ │:18002    │ │:18003    │ │:18004    │          │
│   │Tenant A  │ │Tenant B  │ │Tenant C  │ │Tenant D  │          │
│   │~300MB    │ │~300MB    │ │~300MB    │ │~300MB    │          │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                  │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│   │ Gateway  │ │ Gateway  │ │ Gateway  │ │ Gateway  │          │
│   │:18005    │ │:18006    │ │:18007    │ │:18008    │          │
│   │Tenant E  │ │Tenant F  │ │Tenant G  │ │Tenant H  │          │
│   │~300MB    │ │~300MB    │ │~300MB    │ │~300MB    │          │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                  │
│   Total: 8 tenants × ~300MB = ~2.4GB + OS overhead             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Diagram

### System Overview

```
                                    Internet
                                        │
                                        ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                              CONTROL PLANE                                 │
│                                                                            │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────┐  │
│  │                │  │                │  │                            │  │
│  │  Tenant        │  │   Gateway      │  │     Provisioner            │  │
│  │  Registry      │◄─┤   Registry     │◄─┤     Service                │  │
│  │  (Postgres)    │  │   (Postgres)   │  │                            │  │
│  │                │  │                │  │  • Spawn gateway processes │  │
│  │  • tenant_id   │  │  • gateway_id  │  │  • Generate configs        │  │
│  │  • name        │  │  • vm_id       │  │  • Health monitoring       │  │
│  │  • plan        │  │  • port        │  │  • Auto-restart            │  │
│  │  • config      │  │  • tenant_id   │  │  • Capacity management     │  │
│  │  • status      │  │  • health      │  │                            │  │
│  │                │  │  • last_seen   │  │                            │  │
│  └────────────────┘  └────────────────┘  └────────────────────────────┘  │
│           │                   │                       │                   │
│           └───────────────────┼───────────────────────┘                   │
│                               │                                           │
│                               ▼                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                       Config Generator                              │  │
│  │                                                                     │  │
│  │   tenant record ──► openclaw.json template ──► /tenants/{id}/      │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ Provisioning Commands
                                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                           INGRESS ROUTER                                    │
│                      (Nginx / Caddy / Traefik)                             │
│                                                                            │
│   tenant-a.goodteams.ai ──► vm-1:18001                                    │
│   tenant-b.goodteams.ai ──► vm-1:18002                                    │
│   tenant-c.goodteams.ai ──► vm-2:18001                                    │
│   ...                                                                      │
│                                                                            │
│   Dynamic config reload via:                                               │
│   • Nginx: consul-template / confd                                        │
│   • Caddy: Admin API                                                      │
│   • Traefik: Labels / etcd                                                │
└────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ WebSocket / HTTP
                                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                             COMPUTE TIER                                    │
│                                                                            │
│  ┌──────────────────────────────────┐  ┌──────────────────────────────┐   │
│  │            VM-1 (4GB)            │  │            VM-2 (4GB)         │   │
│  │                                  │  │                               │   │
│  │  ┌────────────────────────────┐  │  │  ┌────────────────────────┐  │   │
│  │  │ systemd / supervisord      │  │  │  │ systemd / supervisord   │  │   │
│  │  └────────────────────────────┘  │  │  └────────────────────────┘  │   │
│  │           │                      │  │           │                  │   │
│  │  ┌────────▼────────┐             │  │  ┌────────▼────────┐        │   │
│  │  │ goodteams-      │             │  │  │ goodteams-      │        │   │
│  │  │ gateway@        │             │  │  │ gateway@        │        │   │
│  │  │ tenant-a:18001  │             │  │  │ tenant-c:18001  │        │   │
│  │  └─────────────────┘             │  │  └─────────────────┘        │   │
│  │                                  │  │                               │   │
│  │  ┌─────────────────┐             │  │  ┌─────────────────┐        │   │
│  │  │ goodteams-      │             │  │  │ goodteams-      │        │   │
│  │  │ gateway@        │             │  │  │ gateway@        │        │   │
│  │  │ tenant-b:18002  │             │  │  │ tenant-d:18002  │        │   │
│  │  └─────────────────┘             │  │  └─────────────────┘        │   │
│  │                                  │  │                               │   │
│  │  /tenants/                       │  │  /tenants/                   │   │
│  │    ├── tenant-a/                 │  │    ├── tenant-c/            │   │
│  │    │   ├── openclaw.json         │  │    │   ├── openclaw.json    │   │
│  │    │   ├── sessions/             │  │    │   ├── sessions/        │   │
│  │    │   └── state/                │  │    │   └── state/           │   │
│  │    └── tenant-b/                 │  │    └── tenant-d/            │   │
│  │        ├── openclaw.json         │  │        ├── openclaw.json    │   │
│  │        ├── sessions/             │  │        ├── sessions/        │   │
│  │        └── state/                │  │        └── state/           │   │
│  └──────────────────────────────────┘  └──────────────────────────────┘   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Request Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Request Flow Example                              │
│                                                                           │
│   User at Acme Corp connects to their GoodTeams assistant                │
│                                                                           │
│   1. Browser → https://acme.goodteams.ai/api/chat                        │
│                           │                                               │
│   2. DNS resolves to      │                                               │
│      Ingress Router       ▼                                               │
│                    ┌──────────────┐                                       │
│                    │   Ingress    │                                       │
│                    │   Router     │                                       │
│                    └──────┬───────┘                                       │
│                           │                                               │
│   3. Route lookup:        │  acme.goodteams.ai → vm-3:18005              │
│      (from config or      │                                               │
│       control plane)      ▼                                               │
│                    ┌──────────────┐                                       │
│                    │    VM-3      │                                       │
│                    │   :18005     │                                       │
│                    │              │                                       │
│                    │  ┌────────┐  │                                       │
│   4. Request to    │  │OpenClaw│  │                                       │
│      tenant's      │  │Gateway │  │                                       │
│      gateway       │  │(Acme)  │  │                                       │
│                    │  └────────┘  │                                       │
│                    │              │                                       │
│   5. Gateway       │  /tenants/   │                                       │
│      reads config  │   acme/      │                                       │
│      from tenant   │   openclaw.  │                                       │
│      directory     │   json       │                                       │
│                    └──────────────┘                                       │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Specifications

### 3.1 Tenant Registry

The source of truth for all tenant metadata.

**Schema:**

```sql
CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(63) UNIQUE NOT NULL,  -- subdomain: {slug}.goodteams.ai
    name            VARCHAR(255) NOT NULL,
    
    -- Billing & Plan
    plan            VARCHAR(50) NOT NULL DEFAULT 'starter',
    billing_email   VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    
    -- Configuration
    config          JSONB NOT NULL DEFAULT '{}',  -- Agent config, model, etc.
    feature_flags   JSONB NOT NULL DEFAULT '{}',  -- Feature toggles
    
    -- Status
    status          VARCHAR(20) NOT NULL DEFAULT 'provisioning',
                    -- provisioning, active, suspended, deleted
    
    -- Assignment
    assigned_gateway_id UUID REFERENCES gateways(id),
    
    -- Metadata
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
    CONSTRAINT valid_status CHECK (status IN ('provisioning', 'active', 'suspended', 'deleted'))
);

CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_assigned_gateway ON tenants(assigned_gateway_id);

-- Example tenant config stored in JSONB
-- {
--   "model": "anthropic/claude-sonnet-4-20250514",
--   "agent": {
--     "systemPrompt": "You are an AI assistant for Acme Corp...",
--     "tools": ["web_search", "email_send", "calendar_read"]
--   },
--   "integrations": {
--     "microsoft365": {
--       "tenantId": "...",
--       "enabled": true
--     }
--   },
--   "limits": {
--     "maxTokensPerDay": 100000,
--     "maxConcurrentSessions": 10
--   }
-- }
```

### 3.2 Gateway Registry

Tracks all gateway processes across all VMs.

**Schema:**

```sql
CREATE TABLE gateways (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Location
    vm_id           VARCHAR(100) NOT NULL,  -- VM identifier
    vm_ip           INET NOT NULL,          -- Internal IP
    port            INTEGER NOT NULL,       -- Port on VM
    
    -- Assignment
    tenant_id       UUID REFERENCES tenants(id),
    
    -- Health
    status          VARCHAR(20) NOT NULL DEFAULT 'starting',
                    -- starting, healthy, unhealthy, stopped
    health_check_url VARCHAR(255),
    last_health_check TIMESTAMPTZ,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    
    -- Resource tracking
    memory_mb       INTEGER,                -- Current memory usage
    cpu_percent     FLOAT,                  -- Current CPU usage
    active_sessions INTEGER NOT NULL DEFAULT 0,
    
    -- Metadata
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE (vm_id, port),
    CONSTRAINT valid_port CHECK (port >= 18000 AND port <= 19000),
    CONSTRAINT valid_status CHECK (status IN ('starting', 'healthy', 'unhealthy', 'stopped'))
);

CREATE INDEX idx_gateways_tenant ON gateways(tenant_id);
CREATE INDEX idx_gateways_vm ON gateways(vm_id);
CREATE INDEX idx_gateways_status ON gateways(status);
```

### 3.3 VM Registry

Tracks compute capacity across the fleet.

**Schema:**

```sql
CREATE TABLE vms (
    id              VARCHAR(100) PRIMARY KEY,  -- e.g., "vm-prod-us-east-001"
    
    -- Location
    region          VARCHAR(50) NOT NULL,
    zone            VARCHAR(50),
    provider        VARCHAR(50) NOT NULL,      -- aws, gcp, azure, hetzner
    
    -- Network
    internal_ip     INET NOT NULL,
    external_ip     INET,
    
    -- Capacity
    total_memory_mb INTEGER NOT NULL,
    total_cpu_cores INTEGER NOT NULL,
    max_gateways    INTEGER NOT NULL DEFAULT 10,  -- Max tenants per VM
    
    -- Current state
    status          VARCHAR(20) NOT NULL DEFAULT 'provisioning',
                    -- provisioning, ready, draining, terminated
    current_gateways INTEGER NOT NULL DEFAULT 0,
    available_ports INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    
    -- Metadata
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_status CHECK (status IN ('provisioning', 'ready', 'draining', 'terminated'))
);

CREATE INDEX idx_vms_region ON vms(region);
CREATE INDEX idx_vms_status ON vms(status);
```

### 3.4 Provisioner Service

Orchestrates tenant lifecycle and gateway management.

**Responsibilities:**

| Function | Description |
|----------|-------------|
| **Provision tenant** | Create tenant record, select VM, spawn gateway process |
| **Deprovision tenant** | Stop gateway process, clean up files, update records |
| **Health monitoring** | Check gateway health, restart failed processes |
| **Capacity management** | Track VM utilization, trigger new VM provisioning |
| **Config updates** | Regenerate config and signal gateway reload |
| **Migration** | Move tenant between VMs (maintenance, scaling) |

**API Endpoints:**

```typescript
// POST /api/provisioner/tenants
// Create and provision a new tenant
interface CreateTenantRequest {
  slug: string;
  name: string;
  plan: 'starter' | 'professional' | 'enterprise';
  config?: TenantConfig;
  preferredRegion?: string;
}

interface CreateTenantResponse {
  tenantId: string;
  slug: string;
  status: 'provisioning';
  estimatedReadyTime: string;
}

// POST /api/provisioner/tenants/{id}/deprovision
// Initiate tenant deprovisioning
interface DeprovisionRequest {
  reason: string;
  deleteData: boolean;
  gracePeriodHours: number;
}

// POST /api/provisioner/tenants/{id}/migrate
// Move tenant to different VM
interface MigrateRequest {
  targetVmId?: string;      // Optional: specific VM
  targetRegion?: string;    // Optional: different region
  reason: string;
}

// GET /api/provisioner/health
// Overall provisioner health and capacity
interface HealthResponse {
  totalTenants: number;
  activeTenants: number;
  totalVms: number;
  healthyVms: number;
  capacityUtilization: number;
  pendingOperations: number;
}
```

**Provisioner Workflow (New Tenant):**

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      Provision Tenant Workflow                            │
│                                                                           │
│   1. Create tenant record (status: provisioning)                         │
│                           │                                               │
│                           ▼                                               │
│   2. Select VM with available capacity                                   │
│      • Prefer same region as customer                                    │
│      • Check available ports                                             │
│      • Reserve capacity                                                  │
│                           │                                               │
│                           ▼                                               │
│   3. Generate tenant config                                              │
│      • Render openclaw.json from template                                │
│      • Write to /tenants/{slug}/openclaw.json                           │
│      • Create workspace directories                                      │
│                           │                                               │
│                           ▼                                               │
│   4. Spawn gateway process                                               │
│      • Create systemd unit file                                          │
│      • Start service                                                     │
│      • Wait for health check                                             │
│                           │                                               │
│                           ▼                                               │
│   5. Configure ingress routing                                           │
│      • Add {slug}.goodteams.ai → {vm}:{port} rule                       │
│      • Reload ingress config                                             │
│                           │                                               │
│                           ▼                                               │
│   6. Update records                                                      │
│      • tenant.status = 'active'                                          │
│      • tenant.assigned_gateway_id = gateway.id                           │
│      • gateway.tenant_id = tenant.id                                     │
│                           │                                               │
│                           ▼                                               │
│   7. Notify completion                                                   │
│      • Send webhook to admin portal                                      │
│      • Send welcome email to tenant admin                                │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.5 Config Generator

Transforms tenant records into OpenClaw configuration files.

**Template Approach:**

```typescript
// config-generator.ts

interface TenantRecord {
  id: string;
  slug: string;
  config: TenantConfig;
}

interface GeneratedConfig {
  path: string;
  content: string;
}

function generateTenantConfig(tenant: TenantRecord, gateway: Gateway): GeneratedConfig {
  const config = {
    // Base configuration
    gateway: {
      port: gateway.port,
      bind: '0.0.0.0',
      auth: {
        mode: 'token',
        token: generateTenantToken(tenant.id),
      },
    },
    
    // Model configuration
    model: tenant.config.model || 'anthropic/claude-sonnet-4-20250514',
    
    // Agent configuration
    agent: {
      name: tenant.config.agent?.name || 'Assistant',
      systemPrompt: tenant.config.agent?.systemPrompt || defaultSystemPrompt(tenant),
    },
    
    // State directory (tenant-isolated)
    stateDir: `/tenants/${tenant.slug}/state`,
    
    // Session configuration
    sessions: {
      dir: `/tenants/${tenant.slug}/sessions`,
    },
    
    // Memory configuration
    memory: {
      enabled: true,
      provider: 'sqlite-vec',
      path: `/tenants/${tenant.slug}/memory/vectors.db`,
    },
    
    // API keys (injected from secrets)
    env: {
      ANTHROPIC_API_KEY: `vault:tenants/${tenant.id}/anthropic_key`,
      OPENAI_API_KEY: `vault:tenants/${tenant.id}/openai_key`,
    },
    
    // Feature flags from tenant record
    features: tenant.config.features || {},
    
    // Rate limits based on plan
    limits: getLimitsForPlan(tenant.plan),
  };
  
  return {
    path: `/tenants/${tenant.slug}/openclaw.json`,
    content: JSON.stringify(config, null, 2),
  };
}

function getLimitsForPlan(plan: string): LimitsConfig {
  const limits = {
    starter: {
      maxTokensPerDay: 50_000,
      maxConcurrentSessions: 5,
      maxMemoryMb: 256,
    },
    professional: {
      maxTokensPerDay: 500_000,
      maxConcurrentSessions: 25,
      maxMemoryMb: 512,
    },
    enterprise: {
      maxTokensPerDay: 5_000_000,
      maxConcurrentSessions: 100,
      maxMemoryMb: 1024,
    },
  };
  return limits[plan] || limits.starter;
}
```

**Example Generated Config:**

```json
{
  "gateway": {
    "port": 18003,
    "bind": "0.0.0.0",
    "auth": {
      "mode": "token",
      "token": "gt_tenant_acme_xxxx..."
    }
  },
  "model": "anthropic/claude-sonnet-4-20250514",
  "agent": {
    "name": "Acme Assistant",
    "systemPrompt": "You are an AI assistant for Acme Corp. Help employees with..."
  },
  "stateDir": "/tenants/acme/state",
  "sessions": {
    "dir": "/tenants/acme/sessions"
  },
  "memory": {
    "enabled": true,
    "provider": "sqlite-vec",
    "path": "/tenants/acme/memory/vectors.db"
  },
  "limits": {
    "maxTokensPerDay": 500000,
    "maxConcurrentSessions": 25,
    "maxMemoryMb": 512
  }
}
```

### 3.6 Ingress Router

Routes subdomains to the correct gateway process.

**Nginx Configuration (with consul-template):**

```nginx
# /etc/nginx/conf.d/goodteams-tenants.conf
# Auto-generated by consul-template - DO NOT EDIT

{{range service "goodteams-gateway"}}
# Tenant: {{.ServiceMeta.tenant_slug}}
upstream {{.ServiceMeta.tenant_slug}}_backend {
    server {{.Address}}:{{.Port}};
}
{{end}}

server {
    listen 443 ssl http2;
    server_name ~^(?<tenant>[a-z0-9-]+)\.goodteams\.ai$;
    
    ssl_certificate /etc/ssl/goodteams/fullchain.pem;
    ssl_certificate_key /etc/ssl/goodteams/privkey.pem;
    
    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    
    # Rate limiting per tenant
    limit_req zone=tenant_limit burst=50 nodelay;
    
    location / {
        # Dynamic upstream based on subdomain
        set $backend "${tenant}_backend";
        proxy_pass http://$backend;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Tenant-Slug $tenant;
        
        # Timeouts
        proxy_connect_timeout 10s;
        proxy_send_timeout 60s;
        proxy_read_timeout 300s;  # Long for streaming responses
    }
    
    # Health check endpoint (not proxied)
    location /health {
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}

# Rate limit zone
limit_req_zone $tenant zone=tenant_limit:10m rate=100r/s;
```

**Caddy Alternative (Caddyfile):**

```caddyfile
# Dynamic tenant routing with Caddy

{
    admin localhost:2019
    auto_https disable_redirects
}

*.goodteams.ai {
    tls /etc/ssl/goodteams/fullchain.pem /etc/ssl/goodteams/privkey.pem
    
    @tenant header_regexp tenant Host ^([a-z0-9-]+)\.goodteams\.ai$
    
    handle @tenant {
        reverse_proxy {
            dynamic a {
                name {re.tenant.1}.goodteams-gateway.service.consul
                refresh 5s
            }
        }
    }
    
    handle /health {
        respond "OK" 200
    }
}
```

---

## 4. Deployment Model

### 4.1 VM Sizing

**Recommended configurations:**

| VM Size | RAM | vCPUs | Max Tenants | Use Case |
|---------|-----|-------|-------------|----------|
| Small | 4GB | 2 | 8-10 | Light usage, starter plans |
| Medium | 8GB | 4 | 15-20 | Mixed workloads |
| Large | 16GB | 8 | 30-40 | Heavy usage, professional plans |
| Dedicated | 32GB+ | 16+ | 1 | Enterprise, compliance requirements |

**Per-tenant resource baseline:**

| Resource | Idle | Light Use | Heavy Use |
|----------|------|-----------|-----------|
| Memory | ~150MB | ~300MB | ~500MB |
| CPU | <1% | 5-10% | 20-30% |
| Disk | ~100MB | ~500MB | ~2GB |

### 4.2 Process Management (systemd)

**Template unit file:**

```ini
# /etc/systemd/system/goodteams-gateway@.service

[Unit]
Description=GoodTeams Gateway for %i
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=goodteams
Group=goodteams
WorkingDirectory=/tenants/%i

# Environment
Environment=NODE_ENV=production
Environment=OPENCLAW_CONFIG=/tenants/%i/openclaw.json
Environment=OPENCLAW_STATE_DIR=/tenants/%i/state
EnvironmentFile=/tenants/%i/env

# Command
ExecStart=/usr/local/bin/openclaw gateway run \
    --config /tenants/%i/openclaw.json \
    --port %p \
    --bind 0.0.0.0

# Restart policy
Restart=always
RestartSec=5
StartLimitIntervalSec=60
StartLimitBurst=3

# Resource limits
MemoryMax=512M
CPUQuota=50%
TasksMax=256

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/tenants/%i

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=goodteams-%i

[Install]
WantedBy=multi-user.target
```

**Port override file:**

```ini
# /etc/systemd/system/goodteams-gateway@acme.service.d/port.conf

[Service]
# Override to use specific port
ExecStart=
ExecStart=/usr/local/bin/openclaw gateway run \
    --config /tenants/acme/openclaw.json \
    --port 18003 \
    --bind 0.0.0.0
```

**Management commands:**

```bash
# Start tenant gateway
systemctl start goodteams-gateway@acme

# Stop tenant gateway
systemctl stop goodteams-gateway@acme

# Restart after config change
systemctl restart goodteams-gateway@acme

# View logs
journalctl -u goodteams-gateway@acme -f

# List all tenant gateways
systemctl list-units 'goodteams-gateway@*'
```

### 4.3 Port Allocation Strategy

**Port range:** 18000-18999 (1000 ports per VM)

**Allocation algorithm:**

```typescript
async function allocatePort(vmId: string): Promise<number> {
  const vm = await db.vms.findById(vmId);
  
  // Get all used ports on this VM
  const usedPorts = await db.gateways
    .where({ vm_id: vmId })
    .select('port');
  
  // Find first available port
  for (let port = 18000; port < 19000; port++) {
    if (!usedPorts.includes(port)) {
      // Reserve the port
      await db.vms.update(vmId, {
        available_ports: vm.available_ports.filter(p => p !== port)
      });
      return port;
    }
  }
  
  throw new Error(`No available ports on VM ${vmId}`);
}
```

### 4.4 Health Checks

**Gateway health endpoint:**

```typescript
// Built into OpenClaw gateway
// GET /health

{
  "status": "healthy",
  "uptime": 86400,
  "version": "2026.2.1",
  "sessions": {
    "active": 5,
    "total": 127
  },
  "memory": {
    "used_mb": 287,
    "limit_mb": 512
  }
}
```

**Provisioner health check loop:**

```typescript
async function healthCheckLoop() {
  const gateways = await db.gateways.where({ status: 'healthy' });
  
  for (const gateway of gateways) {
    try {
      const response = await fetch(gateway.health_check_url, {
        timeout: 5000
      });
      
      if (response.ok) {
        await db.gateways.update(gateway.id, {
          last_health_check: new Date(),
          consecutive_failures: 0,
        });
      } else {
        await handleHealthCheckFailure(gateway);
      }
    } catch (error) {
      await handleHealthCheckFailure(gateway);
    }
  }
}

async function handleHealthCheckFailure(gateway: Gateway) {
  const failures = gateway.consecutive_failures + 1;
  
  await db.gateways.update(gateway.id, {
    consecutive_failures: failures,
    last_health_check: new Date(),
  });
  
  if (failures >= 3) {
    // Mark unhealthy and attempt restart
    await db.gateways.update(gateway.id, { status: 'unhealthy' });
    await restartGateway(gateway);
  }
}
```

---

## 5. Scaling Strategy

### 5.1 Horizontal Scaling

**When to add VMs:**

| Trigger | Threshold | Action |
|---------|-----------|--------|
| Capacity | >80% slots filled | Provision new VM |
| Memory pressure | Avg >75% per VM | Provision new VM |
| Response latency | p95 >2s | Investigate, possibly add VMs |
| Queue depth | Pending provisions >10 | Provision new VM |

**VM provisioning workflow:**

```typescript
async function provisionNewVm(region: string): Promise<VM> {
  // 1. Create cloud instance
  const instance = await cloudProvider.createInstance({
    region,
    size: 'medium',  // 8GB, 4 vCPU
    image: 'goodteams-vm-2026.2',
    tags: { service: 'goodteams', role: 'gateway-host' }
  });
  
  // 2. Wait for instance ready
  await cloudProvider.waitForReady(instance.id);
  
  // 3. Bootstrap (install dependencies, configure)
  await runBootstrap(instance.ip);
  
  // 4. Register in VM registry
  const vm = await db.vms.create({
    id: `vm-${region}-${instance.id}`,
    region,
    internal_ip: instance.privateIp,
    external_ip: instance.publicIp,
    total_memory_mb: 8192,
    total_cpu_cores: 4,
    max_gateways: 15,
    status: 'ready',
    available_ports: range(18000, 18999),
  });
  
  // 5. Add to ingress pool
  await ingress.addUpstream(vm);
  
  return vm;
}
```

### 5.2 Tenant Migration

**Use cases for migration:**

| Scenario | Trigger | Approach |
|----------|---------|----------|
| VM maintenance | Scheduled | Graceful drain |
| Noisy neighbor | High resource usage | Move heavy tenant |
| Regional preference | Customer request | Cross-region move |
| Upgrade to dedicated | Enterprise plan | Isolated VM |

**Migration workflow:**

```typescript
async function migrateTenant(
  tenantId: string, 
  targetVmId: string,
  options: { graceful: boolean }
): Promise<void> {
  const tenant = await db.tenants.findById(tenantId);
  const sourceGateway = await db.gateways.findById(tenant.assigned_gateway_id);
  
  // 1. Allocate resources on target VM
  const targetPort = await allocatePort(targetVmId);
  const targetVm = await db.vms.findById(targetVmId);
  
  // 2. Copy tenant data to target
  await rsync(
    `${sourceGateway.vm_ip}:/tenants/${tenant.slug}/`,
    `${targetVm.internal_ip}:/tenants/${tenant.slug}/`
  );
  
  // 3. Start new gateway on target (don't route traffic yet)
  const targetGateway = await spawnGateway(targetVmId, tenant, targetPort);
  await waitForHealthy(targetGateway);
  
  // 4. Update ingress routing (atomic swap)
  await ingress.updateRoute(
    tenant.slug,
    { ip: targetVm.internal_ip, port: targetPort }
  );
  
  // 5. Graceful shutdown of source
  if (options.graceful) {
    // Wait for active sessions to complete (with timeout)
    await drainGateway(sourceGateway, { timeoutMs: 30000 });
  }
  await stopGateway(sourceGateway);
  
  // 6. Update records
  await db.gateways.delete(sourceGateway.id);
  await db.tenants.update(tenantId, {
    assigned_gateway_id: targetGateway.id
  });
  
  // 7. Cleanup source
  await cleanupTenantData(sourceGateway.vm_id, tenant.slug);
}
```

### 5.3 Cost Projections

**Assumptions:**
- Medium VM: $50/month (8GB RAM, 4 vCPU)
- 15 tenants per VM
- Control plane: $200/month (Postgres, Redis, provisioner service)

**Scaling model:**

| Tenants | VMs Needed | VM Cost | Control Plane | Total | Per-Tenant |
|---------|------------|---------|---------------|-------|------------|
| 15 | 1 | $50 | $200 | $250 | $16.67 |
| 50 | 4 | $200 | $200 | $400 | $8.00 |
| 150 | 10 | $500 | $300 | $800 | $5.33 |
| 500 | 34 | $1,700 | $500 | $2,200 | $4.40 |
| 1,000 | 67 | $3,350 | $800 | $4,150 | $4.15 |

**Note:** Dedicated enterprise tenants use 1:1 VM:tenant ratio at ~$50-100/tenant.

---

## 6. Security Model

### 6.1 Process Isolation Guarantees

**What process isolation provides:**

| Protection | Mechanism |
|------------|-----------|
| Memory isolation | Separate address spaces; no shared memory |
| File system isolation | Tenant directories with strict permissions |
| Network isolation | Each gateway binds to unique port |
| Resource limits | cgroups via systemd limit CPU/memory |
| Credential isolation | Per-tenant secrets, not shared |

**What process isolation does NOT provide:**

| Gap | Mitigation |
|-----|------------|
| Shared kernel | Future: container/VM isolation |
| Side-channel attacks | Future: dedicated VMs for sensitive tenants |
| Shared network stack | VPC/firewall rules, no inter-tenant traffic |
| Shared disk I/O | Separate volumes for enterprise tier |

### 6.2 Workspace Isolation

**Directory structure:**

```
/tenants/
├── acme/                          # Tenant workspace
│   ├── openclaw.json              # 0640 goodteams:goodteams
│   ├── env                        # 0600 goodteams:goodteams
│   ├── state/                     # 0750 goodteams:goodteams
│   │   └── ...
│   ├── sessions/                  # 0750 goodteams:goodteams
│   │   ├── agent/
│   │   └── ...
│   ├── memory/                    # 0750 goodteams:goodteams
│   │   └── vectors.db
│   └── workspace/                 # 0750 goodteams:goodteams
│       └── ... (user files)
│
├── contoso/                       # Another tenant (isolated)
│   └── ...
```

**Permission enforcement:**

```bash
# Tenant directory setup script
setup_tenant_workspace() {
  local TENANT=$1
  local BASE="/tenants/${TENANT}"
  
  # Create directories
  mkdir -p "${BASE}"/{state,sessions,memory,workspace}
  
  # Set ownership
  chown -R goodteams:goodteams "${BASE}"
  
  # Set permissions (no world access)
  chmod 750 "${BASE}"
  chmod 640 "${BASE}/openclaw.json"
  chmod 600 "${BASE}/env"
  chmod -R 750 "${BASE}"/{state,sessions,memory,workspace}
  
  # Verify no symlinks pointing outside
  find "${BASE}" -type l | while read link; do
    target=$(readlink -f "$link")
    if [[ ! "$target" =~ ^/tenants/${TENANT} ]]; then
      rm "$link"
      echo "SECURITY: Removed symlink $link pointing to $target"
    fi
  done
}
```

### 6.3 Secrets Management

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                     Secrets Architecture                         │
│                                                                  │
│  ┌────────────────┐     ┌────────────────┐                      │
│  │   HashiCorp    │     │   Config       │                      │
│  │   Vault        │     │   Generator    │                      │
│  │                │     │                │                      │
│  │  tenants/      │────►│  Reads secrets │                      │
│  │    acme/       │     │  at provision  │                      │
│  │      anthropic │     │  time          │                      │
│  │      openai    │     │                │                      │
│  │      ms365     │     │                │                      │
│  └────────────────┘     └───────┬────────┘                      │
│                                 │                                │
│                                 ▼                                │
│                    ┌────────────────────────┐                   │
│                    │    /tenants/acme/env   │                   │
│                    │                        │                   │
│                    │  ANTHROPIC_API_KEY=... │                   │
│                    │  MS365_CLIENT_SECRET=  │                   │
│                    │                        │                   │
│                    │  Permissions: 0600     │                   │
│                    │  Owner: goodteams      │                   │
│                    └────────────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Vault policy per tenant:**

```hcl
# vault/policies/tenant-acme.hcl

path "secret/data/tenants/acme/*" {
  capabilities = ["read"]
}

path "secret/data/tenants/acme/+/rotate" {
  capabilities = ["update"]
}

# Deny access to other tenants
path "secret/data/tenants/*" {
  capabilities = ["deny"]
}
```

### 6.4 Network Security

**Firewall rules (per VM):**

```bash
# Allow ingress router to reach gateway ports
iptables -A INPUT -p tcp --dport 18000:18999 -s ingress.goodteams.ai -j ACCEPT

# Allow provisioner SSH
iptables -A INPUT -p tcp --dport 22 -s provisioner.goodteams.ai -j ACCEPT

# Allow health checks from control plane
iptables -A INPUT -p tcp --dport 18000:18999 -s controlplane.goodteams.ai -j ACCEPT

# Deny all other inbound to gateway ports
iptables -A INPUT -p tcp --dport 18000:18999 -j DROP

# Allow outbound (for API calls, etc.)
iptables -A OUTPUT -j ACCEPT
```

**No inter-tenant traffic:**

```bash
# Drop any traffic between gateway ports on same VM
# (shouldn't happen, but defense in depth)
iptables -A FORWARD -p tcp --sport 18000:18999 --dport 18000:18999 -j DROP
```

---

## 7. Operations

### 7.1 Monitoring

**Key metrics to track:**

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Gateway process count | systemd | != expected |
| Gateway memory usage | cgroups | >80% limit |
| Gateway response time | nginx logs | p95 >2s |
| Health check failures | provisioner | >=2 consecutive |
| VM capacity utilization | VM registry | >85% |
| Pending provisions | provisioner queue | >10 for >5min |

**Prometheus metrics (exposed by gateway):**

```prometheus
# Gateway process metrics
goodteams_gateway_active_sessions{tenant="acme"} 5
goodteams_gateway_total_requests{tenant="acme"} 12847
goodteams_gateway_memory_bytes{tenant="acme"} 301989888
goodteams_gateway_uptime_seconds{tenant="acme"} 86400

# Provisioner metrics
goodteams_provisioner_tenants_total 156
goodteams_provisioner_tenants_active 142
goodteams_provisioner_vms_total 12
goodteams_provisioner_vms_healthy 12
goodteams_provisioner_operations_pending 2
goodteams_provisioner_provisions_total{status="success"} 847
goodteams_provisioner_provisions_total{status="failed"} 3
```

### 7.2 Logging

**Structured logging format:**

```json
{
  "timestamp": "2026-02-01T15:30:00.000Z",
  "level": "info",
  "service": "goodteams-gateway",
  "tenant_id": "acme",
  "vm_id": "vm-us-east-001",
  "port": 18003,
  "message": "Chat request completed",
  "request_id": "req_abc123",
  "user_id": "user_xyz",
  "duration_ms": 1234,
  "tokens": {
    "input": 150,
    "output": 487
  }
}
```

**Log aggregation:**

```yaml
# Vector (log shipper) config
sources:
  journald:
    type: journald
    include_matches:
      _SYSTEMD_UNIT: "goodteams-gateway@*.service"

transforms:
  parse_tenant:
    type: remap
    inputs: ["journald"]
    source: |
      # Extract tenant from unit name
      .tenant = replace(.SYSTEMD_UNIT, r'^goodteams-gateway@(.+)\.service$', "$1")
      
sinks:
  loki:
    type: loki
    inputs: ["parse_tenant"]
    endpoint: "http://loki.goodteams.ai:3100"
    labels:
      service: "goodteams-gateway"
      tenant: "{{ tenant }}"
```

### 7.3 Backup and Recovery

**Tenant data backup:**

```bash
#!/bin/bash
# backup-tenant.sh - Daily backup per tenant

TENANT=$1
BACKUP_DIR="/backups/${TENANT}/$(date +%Y-%m-%d)"

mkdir -p "${BACKUP_DIR}"

# Backup config
cp "/tenants/${TENANT}/openclaw.json" "${BACKUP_DIR}/"

# Backup sessions (with compression)
tar -czf "${BACKUP_DIR}/sessions.tar.gz" -C "/tenants/${TENANT}" sessions/

# Backup memory/vectors
sqlite3 "/tenants/${TENANT}/memory/vectors.db" ".backup ${BACKUP_DIR}/vectors.db"

# Backup state
tar -czf "${BACKUP_DIR}/state.tar.gz" -C "/tenants/${TENANT}" state/

# Upload to S3
aws s3 sync "${BACKUP_DIR}" "s3://goodteams-backups/tenants/${TENANT}/$(date +%Y-%m-%d)/"

# Cleanup local backup (keep 7 days)
find "/backups/${TENANT}" -type d -mtime +7 -exec rm -rf {} +
```

**Recovery procedure:**

```bash
#!/bin/bash
# recover-tenant.sh - Restore tenant from backup

TENANT=$1
BACKUP_DATE=$2  # e.g., 2026-01-28
TARGET_VM=$3

# 1. Download backup
aws s3 sync "s3://goodteams-backups/tenants/${TENANT}/${BACKUP_DATE}/" "/tmp/restore-${TENANT}/"

# 2. Stop existing gateway (if any)
ssh "${TARGET_VM}" "systemctl stop goodteams-gateway@${TENANT} || true"

# 3. Create tenant directory
ssh "${TARGET_VM}" "mkdir -p /tenants/${TENANT}"

# 4. Restore files
scp "/tmp/restore-${TENANT}/openclaw.json" "${TARGET_VM}:/tenants/${TENANT}/"
scp "/tmp/restore-${TENANT}/vectors.db" "${TARGET_VM}:/tenants/${TENANT}/memory/"
ssh "${TARGET_VM}" "tar -xzf - -C /tenants/${TENANT}" < "/tmp/restore-${TENANT}/sessions.tar.gz"
ssh "${TARGET_VM}" "tar -xzf - -C /tenants/${TENANT}" < "/tmp/restore-${TENANT}/state.tar.gz"

# 5. Fix permissions
ssh "${TARGET_VM}" "chown -R goodteams:goodteams /tenants/${TENANT}"

# 6. Restart gateway
ssh "${TARGET_VM}" "systemctl start goodteams-gateway@${TENANT}"

# 7. Verify health
sleep 5
curl -f "http://${TARGET_VM}:${PORT}/health" || echo "WARNING: Health check failed"
```

---

## 8. Evolution Path

### V1: Process Isolation (Current)

**Status:** Implemented

**Characteristics:**
- Gateway process per tenant
- Multiple tenants per VM (5-10)
- systemd process management
- File system isolation via permissions
- Shared kernel, shared VM resources

**Suitable for:**
- Most SaaS customers
- Standard compliance requirements (SOC 2, GDPR)
- Cost-sensitive deployments

### V2: Container Isolation (Future)

**Target:** Q3 2026

**Changes:**
- Each tenant gateway runs in a container
- Kubernetes orchestration (EKS/GKE/AKS)
- Container-level resource limits and isolation
- Network policies for inter-pod isolation

**Architecture:**

```yaml
# Kubernetes deployment per tenant
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gateway-acme
  namespace: goodteams-tenants
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: gateway
        image: goodteams/gateway:2026.2
        resources:
          limits:
            memory: "512Mi"
            cpu: "500m"
          requests:
            memory: "256Mi"
            cpu: "250m"
        volumeMounts:
        - name: tenant-data
          mountPath: /data
        env:
        - name: OPENCLAW_CONFIG
          value: /data/openclaw.json
      volumes:
      - name: tenant-data
        persistentVolumeClaim:
          claimName: tenant-acme-pvc
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: tenant-isolation-acme
spec:
  podSelector:
    matchLabels:
      tenant: acme
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: goodteams-ingress
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: goodteams-shared  # For API calls
```

**Benefits:**
- Stronger isolation (container namespaces)
- Standardized orchestration
- Better resource management
- Rolling updates per tenant

**Trade-offs:**
- Higher infrastructure complexity
- Kubernetes operational overhead
- Slightly higher resource consumption

### V3: VM-per-Tenant Isolation (Future)

**Target:** As needed for enterprise customers

**Changes:**
- Dedicated VM per tenant
- Complete kernel isolation
- Dedicated network (VPC/VLAN)
- Customer-managed encryption keys (BYOK)

**Use cases:**
- Highest compliance requirements (FedRAMP, HIPAA)
- Financial services with strict isolation requirements
- Customers demanding dedicated infrastructure
- Data residency requirements in specific regions

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                   Enterprise Tenant (Dedicated)                   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Dedicated VPC                            │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │               Dedicated VM (32GB)                     │  │ │
│  │  │                                                       │  │ │
│  │  │   ┌─────────────────────────────────────────────┐    │  │ │
│  │  │   │          GoodTeams Gateway                   │    │  │ │
│  │  │   │          (Single Tenant)                     │    │  │ │
│  │  │   └─────────────────────────────────────────────┘    │  │ │
│  │  │                                                       │  │ │
│  │  │   ┌─────────────┐  ┌─────────────┐                   │  │ │
│  │  │   │  Encrypted  │  │  Customer   │                   │  │ │
│  │  │   │  Storage    │  │  Managed    │                   │  │ │
│  │  │   │  (BYOK)     │  │  Keys       │                   │  │ │
│  │  │   └─────────────┘  └─────────────┘                   │  │ │
│  │  │                                                       │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │                                                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### V4: True Multi-Tenant Gateway (Not Recommended)

**Status:** Not planned

This would require extensive changes to OpenClaw core:
- Tenant context in all code paths
- Shared memory with strict isolation
- Complex permission model
- Significant testing burden

**Why we don't recommend this:**
- High development cost
- Risk of tenant data leakage bugs
- Ongoing maintenance burden
- Process isolation is simpler and more proven

---

## 9. Integration with Strategy

### Phase 1: Security Foundation

The multi-tenant architecture is **foundational infrastructure** for Phase 1:

| Component | Strategy Section | Multi-Tenant Requirement |
|-----------|------------------|--------------------------|
| Auth (OIDC) | Phase 1 | Control plane auth, per-tenant tokens |
| RBAC | Phase 1 | Tenant-scoped roles |
| Audit logging | Phase 1 | Per-tenant audit trail |
| Token storage | Phase 1 | Per-tenant credential vaults |

**Implementation order:**

1. Deploy control plane (Tenant Registry, Gateway Registry, Provisioner)
2. Set up first VM with process management
3. Configure ingress routing
4. Integrate with OIDC for admin portal auth
5. Implement tenant onboarding flow

### Phase 5: Multi-Tenancy (Strategy)

Phase 5 in the strategy document ("Multi-Tenancy, Weeks 33-40") is fulfilled by this architecture:

| Strategy Task | Architecture Component |
|---------------|------------------------|
| Tenant isolation | Process isolation + workspace isolation |
| Database migration to PostgreSQL | Tenant Registry + Gateway Registry |
| Per-tenant configuration | Config Generator |
| Admin portal | Provisioner API + admin UI |

### Dependencies for Other Phases

| Phase | Dependency on Multi-Tenant Infra |
|-------|----------------------------------|
| Phase 2: Microsoft 365 | Per-tenant M365 credentials in vault |
| Phase 3: Google Workspace | Per-tenant GWS credentials in vault |
| Phase 4: Database | Per-tenant connection configs |
| Phase 6: Enterprise Features | Per-tenant compliance settings |
| Phase 7: Desktop Agent | Desktop agent connects to tenant-specific gateway |

### Infrastructure Checklist

**Pre-requisites (before Phase 1):**
- [ ] Postgres cluster for registries
- [ ] HashiCorp Vault (or equivalent) for secrets
- [ ] VM fleet (start with 2-3 VMs)
- [ ] Ingress router (Nginx/Caddy/Traefik)
- [ ] Monitoring stack (Prometheus/Grafana)
- [ ] Log aggregation (Loki/Vector)

**Phase 1 integration:**
- [ ] Provisioner service deployed
- [ ] Config generator implemented
- [ ] systemd templates deployed
- [ ] Health check loop running
- [ ] Admin portal can create tenants
- [ ] Ingress routing automated

---

## Appendix: Quick Reference

### Provisioner API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tenants` | POST | Create new tenant |
| `/api/tenants/{id}` | GET | Get tenant details |
| `/api/tenants/{id}` | PATCH | Update tenant config |
| `/api/tenants/{id}/deprovision` | POST | Deprovision tenant |
| `/api/tenants/{id}/migrate` | POST | Migrate to new VM |
| `/api/vms` | GET | List all VMs |
| `/api/vms/{id}` | GET | Get VM details |
| `/api/health` | GET | Provisioner health |

### Systemd Commands

```bash
# Start/stop/restart tenant gateway
systemctl start goodteams-gateway@{tenant}
systemctl stop goodteams-gateway@{tenant}
systemctl restart goodteams-gateway@{tenant}

# View status
systemctl status goodteams-gateway@{tenant}

# View logs
journalctl -u goodteams-gateway@{tenant} -f

# List all tenant gateways
systemctl list-units 'goodteams-gateway@*'
```

### Directory Paths

| Path | Purpose |
|------|---------|
| `/tenants/{slug}/` | Tenant workspace root |
| `/tenants/{slug}/openclaw.json` | Gateway configuration |
| `/tenants/{slug}/env` | Environment variables (secrets) |
| `/tenants/{slug}/state/` | Gateway state |
| `/tenants/{slug}/sessions/` | Chat sessions |
| `/tenants/{slug}/memory/` | Vector memory DB |
| `/etc/systemd/system/goodteams-gateway@.service` | systemd template |

### Port Allocation

| Range | Purpose |
|-------|---------|
| 18000-18999 | Tenant gateway ports |
| 2019 | Caddy admin API (if used) |
| 9090 | Prometheus metrics |

---

*This architecture document should be reviewed and updated as GoodTeams scales. Major revisions should be versioned and changes logged.*
