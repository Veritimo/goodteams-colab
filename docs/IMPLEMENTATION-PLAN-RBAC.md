# RBAC & Staff Onboarding — Implementation Plan

> Phased implementation with checkpoints, testing criteria, and implementation log

**Version:** 1.0  
**Status:** Planning  
**Created:** February 2026  
**Spec Reference:** [RBAC-STAFF-ONBOARDING.md](./RBAC-STAFF-ONBOARDING.md)

---

## Table of Contents

1. [Architecture Decision](#1-architecture-decision)
2. [Prerequisites](#2-prerequisites)
3. [Phase Overview](#3-phase-overview)
4. [Phase 1: Database & Core Models](#phase-1-database--core-models)
5. [Phase 2: Role Enforcement](#phase-2-role-enforcement)
6. [Phase 3: Invitation System](#phase-3-invitation-system)
7. [Phase 4: Admin Functions](#phase-4-admin-functions)
8. [Phase 5: Audit & Polish](#phase-5-audit--polish)
9. [Testing Strategy](#testing-strategy)
10. [Implementation Log](#implementation-log)

---

## 1. Architecture Decision

### Recommendation: Upgrade goodteams-ai

| Approach | Pros | Cons |
|----------|------|------|
| **Upgrade goodteams-ai** ✅ | Already has org/invitation/role patterns, Wasp/Prisma stack mature | May need refactoring of existing code |
| Build new platform | Clean slate | Duplicates 70% of existing work |
| Hybrid extraction | Could be leaner | Complex integration, unclear boundaries |

**Decision:** Complete and upgrade `goodteams-ai` as the Platform Layer. The existing codebase has:
- ✅ Organization model with `externalTenantId`
- ✅ User roles (`ADMIN`, `USER`, `BILLING`, `SUPER_ADMIN`)
- ✅ Invitation system with Entra directory search
- ✅ Authorized models management
- ⚠️ Partial: Permission system (needs explicit permissions)
- ❌ Missing: Admin continuity enforcement
- ❌ Missing: Skill/tool management RBAC
- ❌ Missing: Complete audit logging

### Codebase Mapping

| Component | Location | Status |
|-----------|----------|--------|
| Organization model | `platform/app/src/organization/` | Exists, needs extension |
| User roles | `engine/app/core/auth.py` + Prisma | Exists |
| Invitation system | `platform/app/src/invitation/` | Exists, complete |
| Entra directory search | `platform/app/src/entra/` | Exists |
| Authorized models | `platform/app/src/organization/operations.ts` | Exists |
| Explicit permissions | `engine/app/core/auth.py` | Partial |
| Skill management | — | Not started |
| Audit logging | `platform/app/src/organization/operations.ts` | Partial (Logs model) |

---

## 2. Prerequisites

### Before Starting

- [ ] **P0**: Verify goodteams-ai runs locally (platform + engine)
- [ ] **P0**: Ensure Prisma schema is current (`npx prisma db push`)
- [ ] **P0**: Confirm Entra app registration exists with required scopes
- [ ] **P1**: Review existing test coverage
- [ ] **P1**: Set up local test Microsoft tenant (or use existing dev tenant)

### Environment Requirements

```bash
# Platform (Wasp)
cd platform/app
wasp start

# Engine (Python)  
cd engine
uvicorn app.main:app --reload

# Database
# PostgreSQL running with connection in .env
```

---

## 3. Phase Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        IMPLEMENTATION PHASES                         │
│                                                                      │
│  Phase 1          Phase 2          Phase 3          Phase 4         │
│  ════════         ════════         ════════         ════════        │
│  Database &       Role             Invitation       Admin           │
│  Core Models      Enforcement      System           Functions       │
│                                                                      │
│  Week 1-2         Week 2-3         Week 3-4         Week 4-5        │
│                                                                      │
│  ┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐    │
│  │ Schema  │      │ Middleware│    │ Entra   │      │ Models  │    │
│  │ Updates │─────►│ & Guards │────►│ Invite  │─────►│ Skills  │    │
│  │         │      │          │      │ Flow    │      │ Users   │    │
│  └─────────┘      └─────────┘      └─────────┘      └─────────┘    │
│       │                │                │                │          │
│       ▼                ▼                ▼                ▼          │
│  Checkpoint 1     Checkpoint 2     Checkpoint 3     Checkpoint 4   │
│                                                                      │
│                                              Phase 5                 │
│                                              ════════               │
│                                              Audit &                │
│                                              Polish                 │
│                                              Week 5-6               │
│                                              ┌─────────┐            │
│                                              │ Logging │            │
│                                              │ Edge    │            │
│                                              │ Cases   │            │
│                                              └─────────┘            │
│                                                   │                  │
│                                                   ▼                  │
│                                              Checkpoint 5           │
│                                              (Release Ready)        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Database & Core Models

**Duration:** Week 1-2  
**Goal:** Schema foundation for RBAC

### Tasks

#### 1.1 Prisma Schema Updates

```prisma
// Add to schema.prisma

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
    skillId         String   // ClawHub identifier
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

// Update User model
model User {
    // ... existing fields ...
    permissions     UserPermission[]
}

// Update Organization model  
model Organization {
    // ... existing fields ...
    skills          OrganizationSkill[]
}
```

- [ ] **1.1.1** Add `UserPermission` model
- [ ] **1.1.2** Add `OrganizationSkill` model
- [ ] **1.1.3** Update `AuditLog` model (if not complete)
- [ ] **1.1.4** Run `npx prisma migrate dev --name rbac_foundation`
- [ ] **1.1.5** Regenerate Prisma client

#### 1.2 Permission Constants

```typescript
// platform/app/src/auth/permissions.ts

export const PERMISSIONS = {
  // User Management
  MANAGE_USERS: 'MANAGE_USERS',
  
  // AI & Models
  MANAGE_MODELS: 'MANAGE_MODELS',
  USE_AI_AGENTS: 'USE_AI_AGENTS',
  
  // Skills & Tools
  MANAGE_SKILLS: 'MANAGE_SKILLS',
  USE_SKILLS: 'USE_SKILLS',
  
  // Integrations
  MANAGE_INTEGRATIONS: 'MANAGE_INTEGRATIONS',
  MANAGE_SHAREPOINT: 'MANAGE_SHAREPOINT',
  
  // Data Operations
  CRM_CREATE: 'CRM_CREATE',
  CRM_UPDATE: 'CRM_UPDATE',
  CRM_DELETE: 'CRM_DELETE',
  SQL_EXECUTE: 'SQL_EXECUTE',
  SQL_TRAINING: 'SQL_TRAINING',
  
  // Workflows
  MANAGE_WORKFLOWS: 'MANAGE_WORKFLOWS',
  MANAGE_AGENTS: 'MANAGE_AGENTS',
  
  // Admin
  MANAGE_GUARDRAILS: 'MANAGE_GUARDRAILS',
  VIEW_AUDIT_LOGS: 'VIEW_AUDIT_LOGS',
  MANAGE_BILLING: 'MANAGE_BILLING',
} as const;

export const ADMIN_IMPLICIT_PERMISSIONS = [
  PERMISSIONS.MANAGE_USERS,
  PERMISSIONS.MANAGE_MODELS,
  PERMISSIONS.MANAGE_SKILLS,
  PERMISSIONS.MANAGE_INTEGRATIONS,
  PERMISSIONS.MANAGE_GUARDRAILS,
  PERMISSIONS.VIEW_AUDIT_LOGS,
  PERMISSIONS.USE_AI_AGENTS,
  PERMISSIONS.USE_SKILLS,
];

export const USER_IMPLICIT_PERMISSIONS = [
  PERMISSIONS.USE_AI_AGENTS,
  PERMISSIONS.USE_SKILLS,
];
```

- [ ] **1.2.1** Create permissions constants file
- [ ] **1.2.2** Mirror in Python engine (`engine/app/core/permissions.py`)

#### 1.3 Verify Existing Models

- [ ] **1.3.1** Confirm `OrganizationInvitation` model exists and is complete
- [ ] **1.3.2** Confirm `Organization.externalTenantId` exists
- [ ] **1.3.3** Confirm `User.role` enum includes all required roles
- [ ] **1.3.4** Confirm `User.externalId` exists (Entra Object ID)

### Checkpoint 1 Criteria

| Criterion | Test |
|-----------|------|
| Schema migrates cleanly | `npx prisma migrate dev` succeeds |
| Models accessible | Can create/query UserPermission, OrganizationSkill |
| No regressions | Existing tests pass |
| Constants defined | TypeScript and Python permission constants match |

### Tests for Phase 1

```typescript
// platform/app/src/auth/permissions.test.ts
describe('Permissions', () => {
  it('should have matching TS and Python permission constants', async () => {
    // Compare exports
  });
  
  it('should create UserPermission', async () => {
    const user = await createTestUser();
    const perm = await prisma.userPermission.create({
      data: { userId: user.id, name: 'CRM_CREATE' }
    });
    expect(perm.name).toBe('CRM_CREATE');
  });
});
```

---

## Phase 2: Role Enforcement

**Duration:** Week 2-3  
**Goal:** Middleware and guards for role-based access

### Tasks

#### 2.1 Permission Check Functions

```typescript
// platform/app/src/auth/checkPermission.ts

export async function checkPermission(
  userId: string, 
  permission: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { permissions: true }
  });
  
  if (!user) return false;
  
  // Super Admin has everything
  if (user.role === 'SUPER_ADMIN') return true;
  
  // Admin implicit permissions
  if (user.role === 'ADMIN' && ADMIN_IMPLICIT_PERMISSIONS.includes(permission)) {
    return true;
  }
  
  // User implicit permissions
  if (['ADMIN', 'USER'].includes(user.role) && USER_IMPLICIT_PERMISSIONS.includes(permission)) {
    return true;
  }
  
  // Billing role
  if (user.role === 'BILLING' && permission === 'MANAGE_BILLING') {
    return true;
  }
  
  // Explicit permissions
  return user.permissions.some(p => p.name === permission);
}

export async function requirePermission(permission: string, context: any) {
  const hasPermission = await checkPermission(context.user.id, permission);
  if (!hasPermission) {
    throw new HttpError(403, `Permission denied: ${permission}`);
  }
}
```

- [ ] **2.1.1** Implement `checkPermission()` in TypeScript
- [ ] **2.1.2** Implement `requirePermission()` middleware
- [ ] **2.1.3** Port to Python engine (`engine/app/core/auth.py`)

#### 2.2 Admin Continuity Guard

```typescript
// platform/app/src/auth/adminGuard.ts

export async function validateAdminChange(
  targetUserId: string, 
  newRole: string | null,  // null = removal
  organizationId: string
): Promise<void> {
  const targetUser = await prisma.user.findUnique({ 
    where: { id: targetUserId } 
  });
  
  if (!targetUser) throw new HttpError(404, 'User not found');
  
  // If current role is ADMIN and we're demoting/removing
  if (targetUser.role === 'ADMIN' && newRole !== 'ADMIN') {
    const adminCount = await prisma.user.count({
      where: { 
        organizationId, 
        role: 'ADMIN' 
      }
    });
    
    if (adminCount <= 1) {
      throw new HttpError(400, 
        'Cannot remove the last administrator. Assign another admin first.'
      );
    }
  }
}
```

- [ ] **2.2.1** Implement admin continuity guard
- [ ] **2.2.2** Add self-removal prevention (can't remove yourself)
- [ ] **2.2.3** Integrate into user update/removal operations

#### 2.3 Apply Guards to Existing Operations

- [ ] **2.3.1** Audit all operations in `organization/operations.ts`
- [ ] **2.3.2** Add `requirePermission()` where missing
- [ ] **2.3.3** Audit Python engine endpoints
- [ ] **2.3.4** Add permission checks to engine

### Checkpoint 2 Criteria

| Criterion | Test |
|-----------|------|
| Permission checks work | Unit tests for checkPermission pass |
| Admin guard prevents last-admin removal | Test case throws expected error |
| Unauthorized access blocked | Non-admin can't access admin endpoints |
| Self-removal blocked | Admin can't remove themselves |

### Tests for Phase 2

```typescript
describe('Role Enforcement', () => {
  describe('checkPermission', () => {
    it('grants ADMIN implicit permissions', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      expect(await checkPermission(admin.id, 'MANAGE_MODELS')).toBe(true);
    });
    
    it('denies USER admin permissions', async () => {
      const user = await createTestUser({ role: 'USER' });
      expect(await checkPermission(user.id, 'MANAGE_MODELS')).toBe(false);
    });
    
    it('grants explicit permissions', async () => {
      const user = await createTestUser({ role: 'USER' });
      await prisma.userPermission.create({
        data: { userId: user.id, name: 'CRM_CREATE' }
      });
      expect(await checkPermission(user.id, 'CRM_CREATE')).toBe(true);
    });
  });
  
  describe('Admin Continuity', () => {
    it('prevents removing last admin', async () => {
      const org = await createTestOrg();
      const admin = await createTestUser({ role: 'ADMIN', organizationId: org.id });
      
      await expect(
        validateAdminChange(admin.id, 'USER', org.id)
      ).rejects.toThrow('Cannot remove the last administrator');
    });
    
    it('allows demotion when other admins exist', async () => {
      const org = await createTestOrg();
      const admin1 = await createTestUser({ role: 'ADMIN', organizationId: org.id });
      const admin2 = await createTestUser({ role: 'ADMIN', organizationId: org.id });
      
      await expect(
        validateAdminChange(admin1.id, 'USER', org.id)
      ).resolves.not.toThrow();
    });
  });
});
```

---

## Phase 3: Invitation System

**Duration:** Week 3-4  
**Goal:** Complete and harden invitation workflow

### Tasks

#### 3.1 Review Existing Implementation

- [ ] **3.1.1** Audit `invitation/operations.ts` against spec
- [ ] **3.1.2** Verify Entra directory search works
- [ ] **3.1.3** Test email sending flow
- [ ] **3.1.4** Verify invitation acceptance flow

#### 3.2 Add Missing Features

```typescript
// Resend invitation
export const resendInvitation = async (
  { id }: { id: string },
  context: any
) => {
  await requirePermission('MANAGE_USERS', context);
  
  const invitation = await prisma.organizationInvitation.findFirst({
    where: { 
      id, 
      organizationId: context.user.organizationId,
      status: 'PENDING' 
    },
    include: { organization: true }
  });
  
  if (!invitation) throw new HttpError(404, 'Invitation not found');
  
  // Reset expiry
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  
  await prisma.organizationInvitation.update({
    where: { id },
    data: { expiresAt: newExpiresAt }
  });
  
  // Resend email
  await emailSender.send({
    to: invitation.email,
    ...getInvitationEmailContent({
      token: invitation.token,
      role: invitation.role,
      inviterName: context.user.username || context.user.email,
      organizationName: invitation.organization.name
    })
  });
};
```

- [ ] **3.2.1** Add `resendInvitation` operation (if missing)
- [ ] **3.2.2** Add invitation expiry cron job (mark expired)
- [ ] **3.2.3** Add invitation UI status indicators

#### 3.3 Harden Security

- [ ] **3.3.1** Rate limit invitation creation (prevent spam)
- [ ] **3.3.2** Validate email domain matches Entra tenant (optional)
- [ ] **3.3.3** Add audit log entry for all invitation actions

### Checkpoint 3 Criteria

| Criterion | Test |
|-----------|------|
| Full invitation lifecycle | Create → Email → Accept works end-to-end |
| Entra search returns users | Query returns matching directory users |
| Expiry works | Expired invitations can't be accepted |
| Resend works | Resend updates expiry and sends email |
| Revoke works | Admin can cancel pending invitation |

### Tests for Phase 3

```typescript
describe('Invitation System', () => {
  it('creates invitation with Entra metadata', async () => {
    const admin = await createTestAdmin();
    const result = await createInvitation({
      email: 'new@company.com',
      role: 'USER',
      externalId: 'entra-object-id-123',
      entraDisplayName: 'New User'
    }, { user: admin });
    
    expect(result.status).toBe('PENDING');
    expect(result.externalId).toBe('entra-object-id-123');
  });
  
  it('prevents duplicate invitations', async () => {
    const admin = await createTestAdmin();
    await createInvitation({ email: 'dup@company.com', role: 'USER' }, { user: admin });
    
    await expect(
      createInvitation({ email: 'dup@company.com', role: 'USER' }, { user: admin })
    ).rejects.toThrow('Invitation already pending');
  });
  
  it('accepts invitation and links user', async () => {
    const invitation = await createTestInvitation();
    const newUser = await createTestUser({ email: invitation.email });
    
    await acceptInvitation({ token: invitation.token }, { user: newUser });
    
    const updated = await prisma.user.findUnique({ where: { id: newUser.id }});
    expect(updated.organizationId).toBe(invitation.organizationId);
    expect(updated.role).toBe(invitation.role);
  });
});
```

---

## Phase 4: Admin Functions

**Duration:** Week 4-5  
**Goal:** Model management, skill management, user management UI

### Tasks

#### 4.1 Model Management (Already Exists - Verify)

- [ ] **4.1.1** Verify `updateAuthorizedModels` has permission check
- [ ] **4.1.2** Verify `updateOrganizationModelDefaults` has permission check
- [ ] **4.1.3** Add audit logging for model changes

#### 4.2 Skill Management (New)

```typescript
// platform/app/src/organization/skills.ts

export const getOrganizationSkills = async (_args: void, context: any) => {
  if (!context.user?.organizationId) throw new HttpError(401);
  
  return prisma.organizationSkill.findMany({
    where: { organizationId: context.user.organizationId },
    orderBy: { name: 'asc' }
  });
};

export const installSkill = async (
  { skillId, name, version }: InstallSkillInput,
  context: any
) => {
  await requirePermission('MANAGE_SKILLS', context);
  
  // Check if already installed
  const existing = await prisma.organizationSkill.findUnique({
    where: {
      organizationId_skillId: {
        organizationId: context.user.organizationId,
        skillId
      }
    }
  });
  
  if (existing) throw new HttpError(400, 'Skill already installed');
  
  const skill = await prisma.organizationSkill.create({
    data: {
      skillId,
      name,
      version,
      organizationId: context.user.organizationId,
      installedBy: context.user.id
    }
  });
  
  await logAuditEvent(context, 'skill.installed', 'skill', skill.id, { skillId, name });
  
  return skill;
};

export const configureSkill = async (
  { id, config, allowedRoles, isEnabled }: ConfigureSkillInput,
  context: any
) => {
  await requirePermission('MANAGE_SKILLS', context);
  
  const skill = await prisma.organizationSkill.findFirst({
    where: { id, organizationId: context.user.organizationId }
  });
  
  if (!skill) throw new HttpError(404, 'Skill not found');
  
  const updated = await prisma.organizationSkill.update({
    where: { id },
    data: {
      config: config ?? skill.config,
      allowedRoles: allowedRoles ?? skill.allowedRoles,
      isEnabled: isEnabled ?? skill.isEnabled
    }
  });
  
  await logAuditEvent(context, 'skill.configured', 'skill', id, { config, allowedRoles, isEnabled });
  
  return updated;
};

export const removeSkill = async ({ id }: { id: string }, context: any) => {
  await requirePermission('MANAGE_SKILLS', context);
  
  const skill = await prisma.organizationSkill.findFirst({
    where: { id, organizationId: context.user.organizationId }
  });
  
  if (!skill) throw new HttpError(404, 'Skill not found');
  
  await prisma.organizationSkill.delete({ where: { id } });
  
  await logAuditEvent(context, 'skill.removed', 'skill', id, { skillId: skill.skillId });
};
```

- [ ] **4.2.1** Create `skills.ts` operations file
- [ ] **4.2.2** Register operations in Wasp
- [ ] **4.2.3** Create Skill Management UI page
- [ ] **4.2.4** Integrate with ClawHub API (skill search/install)

#### 4.3 User Management (Enhance Existing)

- [ ] **4.3.1** Add role change operation with admin guard
- [ ] **4.3.2** Add permission grant/revoke operations
- [ ] **4.3.3** Add user removal with admin guard
- [ ] **4.3.4** Create User Management UI (list, edit role, remove)

#### 4.4 Register Wasp Operations

```wasp
// Add to main.wasp

action installSkill {
  fn: import { installSkill } from "@src/organization/skills",
  entities: [OrganizationSkill]
}

action configureSkill {
  fn: import { configureSkill } from "@src/organization/skills",
  entities: [OrganizationSkill]
}

action removeSkill {
  fn: import { removeSkill } from "@src/organization/skills",
  entities: [OrganizationSkill]
}

query getOrganizationSkills {
  fn: import { getOrganizationSkills } from "@src/organization/skills",
  entities: [OrganizationSkill]
}
```

- [ ] **4.4.1** Add skill operations to main.wasp
- [ ] **4.4.2** Add user management operations to main.wasp

### Checkpoint 4 Criteria

| Criterion | Test |
|-----------|------|
| Model management works | Admin can enable/disable models |
| Skill installation works | Admin can install from ClawHub |
| Skill configuration works | Admin can enable/disable, set allowed roles |
| User role change works | Admin can promote/demote (with guard) |
| Permission grant works | Admin can grant explicit permissions |

### Tests for Phase 4

```typescript
describe('Admin Functions', () => {
  describe('Skill Management', () => {
    it('installs skill', async () => {
      const admin = await createTestAdmin();
      const skill = await installSkill({
        skillId: 'weather',
        name: 'Weather',
        version: '1.0.0'
      }, { user: admin });
      
      expect(skill.skillId).toBe('weather');
      expect(skill.isEnabled).toBe(true);
    });
    
    it('prevents non-admin from installing', async () => {
      const user = await createTestUser({ role: 'USER' });
      
      await expect(
        installSkill({ skillId: 'weather', name: 'Weather', version: '1.0.0' }, { user })
      ).rejects.toThrow('Permission denied');
    });
  });
  
  describe('User Management', () => {
    it('changes user role', async () => {
      const org = await createTestOrg();
      const admin1 = await createTestAdmin({ organizationId: org.id });
      const admin2 = await createTestAdmin({ organizationId: org.id });
      const user = await createTestUser({ role: 'USER', organizationId: org.id });
      
      await updateUserRole({ userId: user.id, role: 'ADMIN' }, { user: admin1 });
      
      const updated = await prisma.user.findUnique({ where: { id: user.id }});
      expect(updated.role).toBe('ADMIN');
    });
  });
});
```

---

## Phase 5: Audit & Polish

**Duration:** Week 5-6  
**Goal:** Complete audit logging, edge cases, documentation

### Tasks

#### 5.1 Audit Logging

```typescript
// platform/app/src/audit/logger.ts

export async function logAuditEvent(
  context: any,
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
      ipAddress: context.clientIp,
      userAgent: context.userAgent
    }
  });
}

// Actions to log:
// - user.role.changed
// - user.permission.granted
// - user.permission.revoked
// - user.removed
// - invitation.created
// - invitation.accepted
// - invitation.revoked
// - model.authorized
// - model.unauthorized
// - model.defaults.changed
// - skill.installed
// - skill.configured
// - skill.removed
// - guardrails.updated
```

- [ ] **5.1.1** Create audit logging utility
- [ ] **5.1.2** Add logging to all admin operations
- [ ] **5.1.3** Create Audit Log viewer UI

#### 5.2 Edge Cases

- [ ] **5.2.1** Handle organization deletion (what happens to users?)
- [ ] **5.2.2** Handle user leaving organization voluntarily
- [ ] **5.2.3** Handle expired invitation cleanup (cron)
- [ ] **5.2.4** Handle Entra token refresh failures gracefully

#### 5.3 UI Polish

- [ ] **5.3.1** Add loading states to all admin actions
- [ ] **5.3.2** Add confirmation dialogs for destructive actions
- [ ] **5.3.3** Add success/error toasts
- [ ] **5.3.4** Mobile responsive check

#### 5.4 Documentation

- [ ] **5.4.1** Update API documentation
- [ ] **5.4.2** Write admin user guide
- [ ] **5.4.3** Add inline help text to UI

### Checkpoint 5 Criteria (Release Ready)

| Criterion | Test |
|-----------|------|
| All admin actions logged | Audit log populated for each action type |
| Audit log viewable | Admin can view filtered audit logs |
| No orphaned data | User removal cleans up related records |
| Error handling complete | All edge cases show helpful messages |
| Documentation complete | API docs and user guide exist |

---

## Testing Strategy

### Test Pyramid

```
                    ┌───────────┐
                   │   E2E     │  ← 10%: Critical user journeys
                  │  (Cypress)  │
                 └─────────────┘
                ┌───────────────────┐
               │    Integration     │  ← 30%: API + DB
              │    (Vitest + DB)    │
             └─────────────────────┘
            ┌───────────────────────────┐
           │           Unit             │  ← 60%: Functions, guards
          │         (Vitest)            │
         └─────────────────────────────┘
```

### Test Categories

| Category | Tool | What to Test |
|----------|------|--------------|
| Unit | Vitest | Permission checks, guards, utilities |
| Integration | Vitest + Prisma | Operations with real DB |
| E2E | Cypress | Full user journeys (invite → accept → use) |

### Key E2E Scenarios

1. **First Admin Flow**: Create org via Entra → becomes admin → can access admin pages
2. **Invite User Flow**: Admin invites → email received → user accepts → can access org
3. **Role Change Flow**: Admin promotes user → user gains admin capabilities
4. **Last Admin Guard**: Admin tries to demote self → blocked with error

### Test Database

```bash
# Use separate test database
DATABASE_URL="postgresql://localhost:5432/goodteams_test"

# Reset before each test suite
npx prisma migrate reset --force
```

---

## Implementation Log

> Track progress, decisions, and blockers here

### Format

```markdown
### YYYY-MM-DD — Phase X.X: Task Name

**Status:** ✅ Complete | 🔄 In Progress | ❌ Blocked | ⏸️ Paused

**What was done:**
- Bullet points of work completed

**Decisions made:**
- Any architectural or design decisions

**Blockers:**
- Issues preventing progress

**Next steps:**
- What comes next

**Commit:** `abc123` (if applicable)
```

---

### 2026-02-02 — Planning Complete

**Status:** ✅ Complete

**What was done:**
- Created RBAC-STAFF-ONBOARDING.md spec
- Created this implementation plan
- Analyzed existing goodteams-ai codebase
- Identified existing vs missing components

**Decisions made:**
- Upgrade goodteams-ai as platform layer (not build new)
- Use existing invitation system as foundation
- Add explicit permissions on top of role-based implicit permissions

**Next steps:**
- Verify prerequisites (local dev environment)
- Begin Phase 1: Database & Core Models

---

*[Add new entries above this line]*

---

## Appendix: Quick Reference

### File Locations

| Component | Path |
|-----------|------|
| Prisma Schema | `platform/app/prisma/schema.prisma` |
| Wasp Config | `platform/app/main.wasp` |
| Auth (TS) | `platform/app/src/auth/` |
| Auth (Python) | `engine/app/core/auth.py` |
| Organization Ops | `platform/app/src/organization/operations.ts` |
| Invitation Ops | `platform/app/src/invitation/operations.ts` |
| Entra Integration | `platform/app/src/entra/` |

### Commands

```bash
# Platform
cd platform/app
wasp start              # Run dev server
wasp db migrate-dev     # Run migrations
wasp test               # Run tests

# Engine
cd engine
uvicorn app.main:app --reload
pytest                  # Run tests

# Database
npx prisma studio       # Visual DB browser
npx prisma migrate dev  # Create migration
npx prisma db push      # Push schema (no migration)
```
