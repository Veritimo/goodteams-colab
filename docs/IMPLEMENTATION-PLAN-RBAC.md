# RBAC & Staff Onboarding — Implementation Plan

> Building the Platform Layer into GoodTeams-Colab (OpenClaw Fork)

**Version:** 2.0  
**Status:** Planning  
**Created:** February 2026  
**Spec Reference:** [RBAC-STAFF-ONBOARDING.md](./RBAC-STAFF-ONBOARDING.md)  
**Strategy Reference:** [GOODTEAMS-STRATEGY.md](./GOODTEAMS-STRATEGY.md) — Phase 1 (Security Foundation)

---

## Table of Contents

1. [Context](#1-context)
2. [Current State](#2-current-state)
3. [Target State](#3-target-state)
4. [Foundation Work](#4-foundation-work)
5. [Implementation Phases](#5-implementation-phases)
6. [Testing Strategy](#6-testing-strategy)
7. [Implementation Log](#7-implementation-log)

---

## 1. Context

### What We're Doing

Transforming **goodteams-colab** (an OpenClaw fork) from a single-user CLI/daemon into an enterprise SaaS platform with multi-tenancy, RBAC, and staff onboarding.

**NOT** wrapping OpenClaw with a separate platform — building the platform layer INTO the codebase.

### Strategy Alignment

Per [GOODTEAMS-STRATEGY.md](./GOODTEAMS-STRATEGY.md), this falls under:
- **Phase 1: Security Foundation** (Weeks 5-10) — SSO, RBAC, audit
- **Phase 5: Multi-Tenancy** (Weeks 33-40) — SaaS architecture

RBAC is foundational for everything else. We build it as part of Phase 1.

### Reference Implementation

[goodteams-ai](file:///Users/dawie/Repos/goodteams_ai) has working patterns for:
- Organization model with Entra integration
- Invitation system with directory search
- Role-based operations
- Authorized models management

We reference these patterns but implement fresh in goodteams-colab's TypeScript/Node.js stack.

---

## 2. Current State

### What OpenClaw Has

| Component | Status | Notes |
|-----------|--------|-------|
| Gateway server | ✅ | WebSocket + HTTP, session management |
| Agent framework | ✅ | Multi-agent, tools, sessions |
| Plugin system | ✅ | Extensible architecture |
| Channel system | ✅ | Telegram, Discord, Slack, Teams, etc. |
| Config system | ✅ | YAML-based, per-agent |
| Auth (gateway) | ⚠️ | Token/password/Tailscale — single-user |
| Memory/storage | ⚠️ | File-based markdown, no DB |

### What OpenClaw Doesn't Have

| Component | Status | Required For |
|-----------|--------|--------------|
| Database layer | ❌ | All multi-tenant features |
| User management | ❌ | RBAC, staff onboarding |
| Organization model | ❌ | Multi-tenancy |
| Web platform/API | ❌ | Admin UI, dashboards |
| Entra integration | ❌ | SSO, directory lookup |
| Audit logging (structured) | ❌ | Compliance |

### Key Files to Understand

```
goodteams-colab/
├── src/
│   ├── gateway/           # ← Core server, add platform routes here
│   │   ├── server.impl.ts # Main gateway orchestration
│   │   └── auth.ts        # Current single-user auth
│   ├── config/            # ← YAML config system
│   ├── agents/            # ← Agent framework
│   └── infra/             # ← Infrastructure utilities
├── package.json           # Node.js project
└── docs/                  # ← Our specs live here
```

---

## 3. Target State

After RBAC implementation:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    GoodTeams Platform Layer                          │
│                   (NEW — built into codebase)                        │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                      Database (PostgreSQL)                       ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           ││
│  │  │   Org    │ │   User   │ │ Invite   │ │  Audit   │           ││
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘           ││
│  └─────────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                      Platform API                                ││
│  │  /api/org  /api/users  /api/invitations  /api/auth             ││
│  └─────────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                      Entra Integration                           ││
│  │  Admin Consent │ User SSO │ Directory Search │ Token Refresh    ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ orchestrates (per-tenant config)
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    OpenClaw Gateway (existing)                       │
│  Sessions │ Agents │ Channels │ Tools │ Plugins                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Foundation Work

Before RBAC, we need infrastructure. This is **Phase 0.5** work.

### 4.1 Database Layer

**Choice:** PostgreSQL + Prisma ORM (TypeScript-native, great DX)

```bash
# Add dependencies
pnpm add prisma @prisma/client
pnpm add -D prisma

# Initialize
npx prisma init
```

**Location:** `src/platform/db/`

```
src/platform/
├── db/
│   ├── schema.prisma      # Database schema
│   ├── client.ts          # Prisma client singleton
│   └── migrations/        # Migration history
```

**Initial Schema:**

```prisma
// src/platform/db/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Organization {
  id                    String   @id @default(uuid())
  name                  String
  externalTenantId      String?  @unique  // Entra Tenant ID
  status                OrgStatus @default(PENDING)
  
  // Model configuration
  authorizedModels      Json     @default("[]")
  defaultModelId        String?
  
  // Relations
  users                 User[]
  invitations           OrganizationInvitation[]
  skills                OrganizationSkill[]
  auditLogs             AuditLog[]
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

model User {
  id              String   @id @default(uuid())
  email           String   @unique
  username        String?
  role            UserRole @default(USER)
  
  // Entra
  externalId      String?  // Entra Object ID
  
  // Organization
  organizationId  String?
  organization    Organization? @relation(fields: [organizationId], references: [id])
  
  // Permissions
  permissions     UserPermission[]
  
  // Invitations issued
  issuedInvitations OrganizationInvitation[] @relation("InvitationIssuer")
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model OrganizationInvitation {
  id              String   @id @default(uuid())
  email           String
  role            UserRole
  token           String   @unique
  status          InvitationStatus @default(PENDING)
  expiresAt       DateTime
  
  // Entra metadata
  externalId      String?
  entraUsername   String?
  entraDisplayName String?
  
  // Relations
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  issuerId        String
  issuer          User @relation("InvitationIssuer", fields: [issuerId], references: [id])
  
  createdAt       DateTime @default(now())
  
  @@unique([email, organizationId])
}

model UserPermission {
  id        String   @id @default(uuid())
  name      String
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  grantedAt DateTime @default(now())
  grantedBy String?
  
  @@unique([userId, name])
}

model OrganizationSkill {
  id              String   @id @default(uuid())
  skillId         String
  name            String
  version         String
  isEnabled       Boolean  @default(true)
  config          Json     @default("{}")
  allowedRoles    Json     @default("[\"ADMIN\", \"USER\"]")
  
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  
  installedAt     DateTime @default(now())
  installedBy     String
  updatedAt       DateTime @updatedAt
  
  @@unique([organizationId, skillId])
}

model AuditLog {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  actorId         String
  actorRole       UserRole
  action          String
  targetType      String
  targetId        String?
  details         Json
  ipAddress       String?
  userAgent       String?
  
  createdAt       DateTime @default(now())
  
  @@index([organizationId, createdAt])
  @@index([actorId])
  @@index([action])
}

enum UserRole {
  SUPER_ADMIN
  ADMIN
  USER
  BILLING
  VIEWER
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  EXPIRED
  REVOKED
}

enum OrgStatus {
  PENDING
  ACTIVE
  SUSPENDED
  ARCHIVED
}
```

**Tasks:**
- [ ] **F1.1** Add Prisma dependencies
- [ ] **F1.2** Create schema.prisma with core models
- [ ] **F1.3** Set up DATABASE_URL in env
- [ ] **F1.4** Run initial migration
- [ ] **F1.5** Create Prisma client singleton

### 4.2 Platform API Layer

**Location:** `src/platform/api/`

Extend the existing gateway HTTP server with platform routes:

```typescript
// src/platform/api/index.ts

import { Router } from 'express';  // or use existing gateway HTTP framework
import { orgRoutes } from './routes/org';
import { userRoutes } from './routes/users';
import { invitationRoutes } from './routes/invitations';
import { authRoutes } from './routes/auth';

export function registerPlatformRoutes(app: Express) {
  const platformRouter = Router();
  
  platformRouter.use('/org', orgRoutes);
  platformRouter.use('/users', userRoutes);
  platformRouter.use('/invitations', invitationRoutes);
  platformRouter.use('/auth', authRoutes);
  
  app.use('/api/platform', platformRouter);
}
```

**Tasks:**
- [ ] **F2.1** Create `src/platform/` directory structure
- [ ] **F2.2** Set up platform router
- [ ] **F2.3** Integrate with gateway HTTP server
- [ ] **F2.4** Add request context middleware (user, org)

### 4.3 Entra Integration

**Location:** `src/platform/auth/entra/`

Reference: [MICROSOFT-365-AUTH-ARCHITECTURE.md](./MICROSOFT-365-AUTH-ARCHITECTURE.md)

```typescript
// src/platform/auth/entra/client.ts

import { ConfidentialClientApplication } from '@azure/msal-node';

const msalConfig = {
  auth: {
    clientId: process.env.ENTRA_CLIENT_ID!,
    clientSecret: process.env.ENTRA_CLIENT_SECRET!,
    authority: 'https://login.microsoftonline.com/common',
  }
};

export const msalClient = new ConfidentialClientApplication(msalConfig);

// Admin consent URL generator
export function getAdminConsentUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.ENTRA_CLIENT_ID!,
    redirect_uri: redirectUri,
    state,
    scope: 'https://graph.microsoft.com/.default',
    response_type: 'code',
    prompt: 'admin_consent'
  });
  return `https://login.microsoftonline.com/common/adminconsent?${params}`;
}

// Directory search (requires User.Read.All or User.ReadBasic.All)
export async function searchEntraDirectory(
  accessToken: string, 
  query: string
): Promise<EntraUser[]> {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users?$filter=startswith(displayName,'${query}') or startswith(mail,'${query}')&$top=10`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await response.json();
  return data.value;
}
```

**Tasks:**
- [ ] **F3.1** Add @azure/msal-node dependency
- [ ] **F3.2** Create Entra client module
- [ ] **F3.3** Implement admin consent flow
- [ ] **F3.4** Implement user auth code flow
- [ ] **F3.5** Implement token storage and refresh
- [ ] **F3.6** Implement directory search

### 4.4 Foundation Checkpoint

Before proceeding to RBAC phases:

| Criterion | Test |
|-----------|------|
| Database connects | `npx prisma db push` succeeds |
| Models work | Can CRUD Organization, User via Prisma |
| Platform routes load | GET `/api/platform/health` returns 200 |
| Entra client works | Can generate admin consent URL |

---

## 5. Implementation Phases

### Phase 1: Core RBAC (Week 1-2)

**Goal:** Role enforcement, permission checks, admin continuity

#### 1.1 Permission System

```typescript
// src/platform/auth/permissions.ts

export const PERMISSIONS = {
  MANAGE_USERS: 'MANAGE_USERS',
  MANAGE_MODELS: 'MANAGE_MODELS',
  MANAGE_SKILLS: 'MANAGE_SKILLS',
  MANAGE_INTEGRATIONS: 'MANAGE_INTEGRATIONS',
  MANAGE_GUARDRAILS: 'MANAGE_GUARDRAILS',
  VIEW_AUDIT_LOGS: 'VIEW_AUDIT_LOGS',
  USE_AI_AGENTS: 'USE_AI_AGENTS',
  USE_SKILLS: 'USE_SKILLS',
  MANAGE_BILLING: 'MANAGE_BILLING',
  // Granular data permissions
  CRM_CREATE: 'CRM_CREATE',
  CRM_UPDATE: 'CRM_UPDATE',
  CRM_DELETE: 'CRM_DELETE',
  SQL_EXECUTE: 'SQL_EXECUTE',
} as const;

export const ADMIN_IMPLICIT = [
  'MANAGE_USERS', 'MANAGE_MODELS', 'MANAGE_SKILLS',
  'MANAGE_INTEGRATIONS', 'MANAGE_GUARDRAILS', 'VIEW_AUDIT_LOGS',
  'USE_AI_AGENTS', 'USE_SKILLS'
];

export const USER_IMPLICIT = ['USE_AI_AGENTS', 'USE_SKILLS'];
```

```typescript
// src/platform/auth/checkPermission.ts

import { prisma } from '../db/client';
import { ADMIN_IMPLICIT, USER_IMPLICIT } from './permissions';

export async function checkPermission(
  userId: string,
  permission: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { permissions: true }
  });
  
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  if (user.role === 'ADMIN' && ADMIN_IMPLICIT.includes(permission)) return true;
  if (['ADMIN', 'USER'].includes(user.role) && USER_IMPLICIT.includes(permission)) return true;
  if (user.role === 'BILLING' && permission === 'MANAGE_BILLING') return true;
  
  return user.permissions.some(p => p.name === permission);
}

export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.context?.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const allowed = await checkPermission(user.id, permission);
    if (!allowed) return res.status(403).json({ error: `Permission denied: ${permission}` });
    
    next();
  };
}
```

**Tasks:**
- [ ] **1.1.1** Create permission constants
- [ ] **1.1.2** Implement checkPermission function
- [ ] **1.1.3** Create requirePermission middleware
- [ ] **1.1.4** Write tests

#### 1.2 Admin Continuity Guard

```typescript
// src/platform/auth/adminGuard.ts

export async function validateAdminChange(
  targetUserId: string,
  newRole: string | null,
  organizationId: string
): Promise<void> {
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw new Error('User not found');
  
  // Demoting or removing an admin?
  if (target.role === 'ADMIN' && newRole !== 'ADMIN') {
    const adminCount = await prisma.user.count({
      where: { organizationId, role: 'ADMIN' }
    });
    
    if (adminCount <= 1) {
      throw new Error('Cannot remove the last administrator. Assign another admin first.');
    }
  }
}
```

**Tasks:**
- [ ] **1.2.1** Implement admin continuity guard
- [ ] **1.2.2** Add self-removal prevention
- [ ] **1.2.3** Integrate into user update/removal routes
- [ ] **1.2.4** Write tests

#### Checkpoint 1

| Criterion | Test |
|-----------|------|
| Permission check works | Admin has implicit perms, User doesn't |
| Explicit perms work | Granted permission returns true |
| Admin guard works | Last admin removal blocked |
| Middleware works | Unauthorized requests return 403 |

---

### Phase 2: Organization Lifecycle (Week 2-3)

**Goal:** Org creation via Entra, status management

#### 2.1 Entra Admin Consent Flow

```typescript
// src/platform/api/routes/auth.ts

router.get('/entra/consent', async (req, res) => {
  const state = crypto.randomUUID();
  // Store state -> user mapping for callback
  await storeConsentState(state, req.context.user.id);
  
  const url = getAdminConsentUrl(
    `${process.env.APP_URL}/api/platform/auth/entra/callback`,
    state
  );
  res.redirect(url);
});

router.get('/entra/callback', async (req, res) => {
  const { tenant, admin_consent, state } = req.query;
  
  if (admin_consent !== 'True') {
    return res.status(400).json({ error: 'Admin consent required' });
  }
  
  const userId = await getConsentState(state);
  if (!userId) return res.status(400).json({ error: 'Invalid state' });
  
  // Create or update organization
  const org = await prisma.organization.create({
    data: {
      name: `Org-${tenant}`, // Will be updated with tenant details
      externalTenantId: tenant,
      status: 'ACTIVE',
    }
  });
  
  // Link user as first admin
  await prisma.user.update({
    where: { id: userId },
    data: { organizationId: org.id, role: 'ADMIN' }
  });
  
  res.redirect('/dashboard?setup=complete');
});
```

**Tasks:**
- [ ] **2.1.1** Implement consent initiation route
- [ ] **2.1.2** Implement consent callback route
- [ ] **2.1.3** Create organization on consent
- [ ] **2.1.4** Promote user to admin
- [ ] **2.1.5** Write integration tests

#### 2.2 Organization Operations

```typescript
// src/platform/api/routes/org.ts

router.get('/', requireAuth, async (req, res) => {
  const org = await prisma.organization.findUnique({
    where: { id: req.context.user.organizationId },
    include: { users: { select: { id: true, email: true, role: true } } }
  });
  res.json(org);
});

router.put('/', requireAuth, requirePermission('MANAGE_USERS'), async (req, res) => {
  const { name } = req.body;
  const org = await prisma.organization.update({
    where: { id: req.context.user.organizationId },
    data: { name }
  });
  res.json(org);
});
```

**Tasks:**
- [ ] **2.2.1** GET org details
- [ ] **2.2.2** UPDATE org settings
- [ ] **2.2.3** Org status transitions (PENDING → ACTIVE)
- [ ] **2.2.4** Write tests

#### Checkpoint 2

| Criterion | Test |
|-----------|------|
| Consent flow works | Redirect → Microsoft → Callback creates org |
| Creator becomes admin | User role is ADMIN after consent |
| Org CRUD works | Can read/update organization |
| PENDING state enforced | Orgs without Entra can't invite |

---

### Phase 3: Invitation System (Week 3-4)

**Goal:** Entra-integrated invitations, full lifecycle

#### 3.1 Directory Search

```typescript
// src/platform/api/routes/entra.ts

router.get('/users', requireAuth, requirePermission('MANAGE_USERS'), async (req, res) => {
  const { query } = req.query;
  if (!query || query.length < 3) {
    return res.json([]);
  }
  
  const token = await getValidMicrosoftToken(req.context.user.id);
  const users = await searchEntraDirectory(token, query);
  res.json(users);
});
```

#### 3.2 Invitation CRUD

```typescript
// src/platform/api/routes/invitations.ts

router.post('/', requireAuth, requirePermission('MANAGE_USERS'), async (req, res) => {
  const { email, role, externalId, entraUsername, entraDisplayName } = req.body;
  const org = await prisma.organization.findUnique({
    where: { id: req.context.user.organizationId }
  });
  
  // Require Entra connection
  if (!org.externalTenantId) {
    return res.status(400).json({ 
      error: 'Connect Microsoft Entra before inviting users' 
    });
  }
  
  // Check for existing user or invitation
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    return res.status(400).json({ error: 'User already exists' });
  }
  
  const pendingInvite = await prisma.organizationInvitation.findFirst({
    where: { email, organizationId: org.id, status: 'PENDING' }
  });
  if (pendingInvite) {
    return res.status(400).json({ error: 'Invitation already pending' });
  }
  
  const invitation = await prisma.organizationInvitation.create({
    data: {
      email,
      role,
      organizationId: org.id,
      issuerId: req.context.user.id,
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      externalId,
      entraUsername,
      entraDisplayName
    }
  });
  
  // Send email
  await sendInvitationEmail(invitation, org.name, req.context.user.email);
  
  // Audit log
  await logAudit(req.context, 'invitation.created', 'invitation', invitation.id, { email, role });
  
  res.json(invitation);
});

router.post('/:token/accept', requireAuth, async (req, res) => {
  const invitation = await prisma.organizationInvitation.findUnique({
    where: { token: req.params.token }
  });
  
  if (!invitation) return res.status(404).json({ error: 'Invalid token' });
  if (invitation.status !== 'PENDING') return res.status(400).json({ error: 'Invitation not pending' });
  if (invitation.expiresAt < new Date()) {
    await prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { status: 'EXPIRED' }
    });
    return res.status(400).json({ error: 'Invitation expired' });
  }
  
  // Link user to org
  await prisma.user.update({
    where: { id: req.context.user.id },
    data: {
      organizationId: invitation.organizationId,
      role: invitation.role,
      externalId: invitation.externalId
    }
  });
  
  await prisma.organizationInvitation.update({
    where: { id: invitation.id },
    data: { status: 'ACCEPTED' }
  });
  
  res.json({ success: true });
});
```

**Tasks:**
- [ ] **3.1** Entra directory search endpoint
- [ ] **3.2** Create invitation endpoint
- [ ] **3.3** List pending invitations
- [ ] **3.4** Accept invitation endpoint
- [ ] **3.5** Revoke invitation endpoint
- [ ] **3.6** Resend invitation endpoint
- [ ] **3.7** Email sending (use existing email infra or add)
- [ ] **3.8** Write tests

#### Checkpoint 3

| Criterion | Test |
|-----------|------|
| Directory search works | Returns Entra users matching query |
| Create invitation works | Creates pending invitation, sends email |
| Accept works | User linked to org with correct role |
| Expiry works | Expired invitations rejected |
| Revoke works | Admin can cancel invitation |

---

### Phase 4: Admin Functions (Week 4-5)

**Goal:** Model management, skill management, user management

#### 4.1 Model Management

```typescript
// src/platform/api/routes/org.ts

router.get('/models', requireAuth, requirePermission('MANAGE_MODELS'), async (req, res) => {
  const org = await prisma.organization.findUnique({
    where: { id: req.context.user.organizationId }
  });
  res.json(org.authorizedModels);
});

router.put('/models', requireAuth, requirePermission('MANAGE_MODELS'), async (req, res) => {
  const { models } = req.body;
  
  const org = await prisma.organization.update({
    where: { id: req.context.user.organizationId },
    data: { authorizedModels: models }
  });
  
  await logAudit(req.context, 'models.updated', 'organization', org.id, { models });
  
  res.json(org.authorizedModels);
});
```

#### 4.2 Skill Management

```typescript
// src/platform/api/routes/skills.ts

router.get('/', requireAuth, async (req, res) => {
  const skills = await prisma.organizationSkill.findMany({
    where: { organizationId: req.context.user.organizationId }
  });
  res.json(skills);
});

router.post('/', requireAuth, requirePermission('MANAGE_SKILLS'), async (req, res) => {
  const { skillId, name, version } = req.body;
  
  const skill = await prisma.organizationSkill.create({
    data: {
      skillId,
      name,
      version,
      organizationId: req.context.user.organizationId,
      installedBy: req.context.user.id
    }
  });
  
  await logAudit(req.context, 'skill.installed', 'skill', skill.id, { skillId, name });
  
  res.json(skill);
});

router.put('/:id', requireAuth, requirePermission('MANAGE_SKILLS'), async (req, res) => {
  const { config, allowedRoles, isEnabled } = req.body;
  
  const skill = await prisma.organizationSkill.update({
    where: { id: req.params.id },
    data: { config, allowedRoles, isEnabled }
  });
  
  await logAudit(req.context, 'skill.configured', 'skill', skill.id, { config, allowedRoles, isEnabled });
  
  res.json(skill);
});

router.delete('/:id', requireAuth, requirePermission('MANAGE_SKILLS'), async (req, res) => {
  await prisma.organizationSkill.delete({ where: { id: req.params.id } });
  await logAudit(req.context, 'skill.removed', 'skill', req.params.id, {});
  res.json({ success: true });
});
```

#### 4.3 User Management

```typescript
// src/platform/api/routes/users.ts

router.get('/', requireAuth, async (req, res) => {
  const users = await prisma.user.findMany({
    where: { organizationId: req.context.user.organizationId },
    select: { id: true, email: true, username: true, role: true, createdAt: true }
  });
  res.json(users);
});

router.put('/:id/role', requireAuth, requirePermission('MANAGE_USERS'), async (req, res) => {
  const { role } = req.body;
  
  // Admin continuity check
  await validateAdminChange(req.params.id, role, req.context.user.organizationId);
  
  // Can't change own role
  if (req.params.id === req.context.user.id) {
    return res.status(400).json({ error: "Cannot change your own role" });
  }
  
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role }
  });
  
  await logAudit(req.context, 'user.role.changed', 'user', user.id, { newRole: role });
  
  res.json(user);
});

router.delete('/:id', requireAuth, requirePermission('MANAGE_USERS'), async (req, res) => {
  // Admin continuity check
  await validateAdminChange(req.params.id, null, req.context.user.organizationId);
  
  // Can't remove self
  if (req.params.id === req.context.user.id) {
    return res.status(400).json({ error: "Cannot remove yourself" });
  }
  
  await prisma.user.update({
    where: { id: req.params.id },
    data: { organizationId: null, role: 'USER' }  // Unlink, don't delete
  });
  
  await logAudit(req.context, 'user.removed', 'user', req.params.id, {});
  
  res.json({ success: true });
});
```

**Tasks:**
- [ ] **4.1** Model CRUD endpoints
- [ ] **4.2** Skill CRUD endpoints
- [ ] **4.3** User management endpoints
- [ ] **4.4** Permission grant/revoke endpoints
- [ ] **4.5** Write tests

#### Checkpoint 4

| Criterion | Test |
|-----------|------|
| Model management works | Admin can enable/disable models |
| Skill management works | Admin can install/configure/remove skills |
| User role change works | Admin can promote/demote (with guards) |
| User removal works | Admin can remove (with guards) |

---

### Phase 5: Audit & Polish (Week 5-6)

**Goal:** Complete audit logging, edge cases, hardening

#### 5.1 Audit Logging

```typescript
// src/platform/audit/logger.ts

export async function logAudit(
  context: RequestContext,
  action: string,
  targetType: string,
  targetId: string | null,
  details: Record<string, any>
) {
  await prisma.auditLog.create({
    data: {
      organizationId: context.user.organizationId,
      actorId: context.user.id,
      actorRole: context.user.role,
      action,
      targetType,
      targetId,
      details,
      ipAddress: context.ip,
      userAgent: context.userAgent
    }
  });
}

// Actions to log:
// invitation.created, invitation.accepted, invitation.revoked
// user.role.changed, user.permission.granted, user.permission.revoked, user.removed
// models.updated, skill.installed, skill.configured, skill.removed
// org.settings.updated
```

#### 5.2 Edge Cases

- [ ] **5.2.1** Invitation expiry cron job
- [ ] **5.2.2** Token refresh error handling
- [ ] **5.2.3** Org deletion cascade rules
- [ ] **5.2.4** User leaving org voluntarily

#### Checkpoint 5 (Release Ready)

| Criterion | Test |
|-----------|------|
| All actions logged | Audit log populated for each action type |
| Audit log queryable | Can filter by action, actor, date range |
| Error handling complete | Edge cases return helpful messages |
| No data leaks | User removal cleans up properly |

---

## 6. Testing Strategy

### Test Structure

```
src/platform/
├── __tests__/
│   ├── unit/
│   │   ├── permissions.test.ts
│   │   ├── adminGuard.test.ts
│   │   └── ...
│   ├── integration/
│   │   ├── invitations.test.ts
│   │   ├── org.test.ts
│   │   └── ...
│   └── e2e/
│       ├── onboarding.test.ts
│       └── ...
```

### Test Database

```bash
# Use separate test database
DATABASE_URL="postgresql://localhost:5432/goodteams_test"

# Reset before suites
npx prisma migrate reset --force
```

### Key E2E Scenarios

1. **First Admin**: Create org via Entra → becomes admin → access admin pages
2. **Invite User**: Admin invites → email → accept → user in org
3. **Role Change**: Admin promotes → user gains capabilities
4. **Last Admin Guard**: Try to demote last admin → blocked

---

## 7. Implementation Log

> Track progress, decisions, blockers

### Format

```markdown
### YYYY-MM-DD — Phase X.X: Task Name

**Status:** ✅ Complete | 🔄 In Progress | ❌ Blocked | ⏸️ Paused

**Work completed:**
- Bullet points

**Decisions:**
- Any choices made

**Blockers:**
- Issues

**Next:**
- What's next

**Commit:** `abc123`
```

---

### 2026-02-02 — Planning v2

**Status:** ✅ Complete

**Work completed:**
- Rewrote implementation plan for building INTO goodteams-colab
- Mapped existing OpenClaw structure
- Defined foundation work (DB, API, Entra)
- Aligned with GOODTEAMS-STRATEGY.md phases

**Decisions:**
- Use Prisma for TypeScript-native ORM
- Build platform layer as `src/platform/`
- Extend existing gateway HTTP server with platform routes

**Next:**
- Start Foundation F1: Database layer

---

*[Add new entries above this line]*

---

## Quick Reference

### New Directory Structure

```
src/platform/
├── db/
│   ├── schema.prisma
│   ├── client.ts
│   └── migrations/
├── api/
│   ├── index.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── permissions.ts
│   └── routes/
│       ├── org.ts
│       ├── users.ts
│       ├── invitations.ts
│       ├── skills.ts
│       └── auth.ts
├── auth/
│   ├── permissions.ts
│   ├── checkPermission.ts
│   ├── adminGuard.ts
│   └── entra/
│       ├── client.ts
│       ├── consent.ts
│       └── tokens.ts
├── audit/
│   └── logger.ts
└── __tests__/
```

### Commands

```bash
# Database
npx prisma migrate dev --name <name>  # Create migration
npx prisma db push                     # Push schema (dev)
npx prisma studio                      # Visual browser

# Tests
pnpm test                              # All tests
pnpm test:unit                         # Unit only
pnpm test:integration                  # Integration only

# Dev
pnpm dev                               # Start gateway with platform
```

### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/goodteams"

# Entra
ENTRA_CLIENT_ID="..."
ENTRA_CLIENT_SECRET="..."
ENTRA_TENANT_ID="common"  # Multi-tenant

# App
APP_URL="https://app.goodteams.ai"
```
