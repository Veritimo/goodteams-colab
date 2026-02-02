# Role-Based Access Control & Staff Onboarding

> Organization Management, Team Member Lifecycle, and Permission System

**Version:** 1.0  
**Status:** Living Document  
**Last Updated:** February 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Organization Lifecycle](#2-organization-lifecycle)
3. [Role Definitions](#3-role-definitions)
4. [Staff Onboarding Flow](#4-staff-onboarding-flow)
5. [Permission System](#5-permission-system)
6. [Admin Functions](#6-admin-functions)
7. [API Specification](#7-api-specification)
8. [Database Schema](#8-database-schema)
9. [Security Considerations](#9-security-considerations)
10. [Implementation Roadmap](#10-implementation-roadmap)

---

## 1. Overview

GoodTeams implements a hierarchical Role-Based Access Control (RBAC) system tied to Microsoft Entra ID authentication. Access to the platform is gated by successful Entra integration — organizations cannot function meaningfully without enterprise identity verification.

### Core Principles

1. **Identity-First**: Organization legitimacy is proven through successful Entra admin consent
2. **Least Privilege**: Users receive minimum permissions needed for their role
3. **Admin Continuity**: At least one ADMIN must always exist per organization
4. **Audit Trail**: All permission changes are logged with actor, target, and timestamp
5. **Entra Integration**: Team member lookup and invitation uses corporate directory

### Trust Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    PLATFORM LEVEL                            │
│  Super Admin (GoodTeams Staff) - Cross-org access           │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                  ORGANIZATION LEVEL                          │
│  ┌──────────┐                                               │
│  │  ADMIN   │ ← Creator on Entra onboarding                 │
│  └────┬─────┘                                               │
│       │ can invite/manage                                   │
│       ▼                                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │  ADMIN   │    │   USER   │    │ BILLING  │              │
│  └──────────┘    └──────────┘    └──────────┘              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Organization Lifecycle

### 2.1 Organization Creation

An organization is created when a user successfully completes Microsoft Entra admin consent. This proves:
- User has admin rights in their Microsoft tenant
- Organization identity is verified through enterprise IdP
- Tenant ID is captured for future SSO and directory access

```typescript
// Organization creation triggered by successful Entra admin consent
async function createOrganization(entraAdminConsentResult: EntraConsentResult): Promise<Organization> {
    const organization = await db.organization.create({
        data: {
            name: entraAdminConsentResult.tenantName,
            externalTenantId: entraAdminConsentResult.tenantId,
            primaryAuthProvider: "MICROSOFT_ENTRA",
            authorizedModels: DEFAULT_AUTHORIZED_MODELS,
            defaultModelId: "gemini-2.5-flash",
        }
    });

    // Creator becomes first ADMIN
    await db.user.update({
        where: { id: currentUser.id },
        data: {
            organizationId: organization.id,
            role: "ADMIN",
            externalId: entraAdminConsentResult.userId,
        }
    });

    return organization;
}
```

### 2.2 Organization States

| State | Description | Capabilities |
|-------|-------------|--------------|
| **PENDING** | Created but Entra not connected | View-only, cannot invite users |
| **ACTIVE** | Entra connected, fully operational | All features enabled |
| **SUSPENDED** | Billing issue or policy violation | Read-only access |
| **ARCHIVED** | Soft-deleted, data retained | No access |

### 2.3 Entra Connection Requirement

Without successful Entra admin consent, the organization is in PENDING state with severely limited functionality:

```yaml
pending_organization_capabilities:
  allowed:
    - view_dashboard
    - view_documentation
    - initiate_entra_connection
  blocked:
    - invite_users
    - use_ai_agents
    - access_integrations
    - manage_settings
```

**Rationale**: This ensures organizations are verified corporate entities before they can leverage enterprise features. It prevents abuse and establishes trust from day one.

---

## 3. Role Definitions

### 3.1 Core Roles

| Role | Description | Count Constraint |
|------|-------------|------------------|
| **SUPER_ADMIN** | GoodTeams platform staff | N/A (platform level) |
| **ADMIN** | Organization administrator | ≥1 per organization |
| **USER** | Standard team member | Unlimited |
| **BILLING** | Billing & subscription access | Optional |
| **VIEWER** | Read-only access | Optional |

### 3.2 Role Capabilities Matrix

| Capability | SUPER_ADMIN | ADMIN | USER | BILLING | VIEWER |
|------------|:-----------:|:-----:|:----:|:-------:|:------:|
| **Organization Management** |
| View organization settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit organization settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete organization | ✅ | ✅* | ❌ | ❌ | ❌ |
| **User Management** |
| View team members | ✅ | ✅ | ✅ | ❌ | ✅ |
| Invite users | ✅ | ✅ | ❌ | ❌ | ❌ |
| Remove users | ✅ | ✅ | ❌ | ❌ | ❌ |
| Change user roles | ✅ | ✅ | ❌ | ❌ | ❌ |
| **AI & Model Management** |
| Use AI agents | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage authorized models | ✅ | ✅ | ❌ | ❌ | ❌ |
| Set model defaults | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Skills & Tools** |
| Use skills | ✅ | ✅ | ✅ | ❌ | ❌ |
| Install skills | ✅ | ✅ | ❌ | ❌ | ❌ |
| Configure skills | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create custom skills | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Integrations** |
| View integrations | ✅ | ✅ | ✅ | ❌ | ✅ |
| Manage integrations | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Billing** |
| View billing | ✅ | ✅ | ❌ | ✅ | ❌ |
| Manage billing | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Audit & Compliance** |
| View audit logs | ✅ | ✅ | ❌ | ❌ | ❌ |
| Export audit logs | ✅ | ✅ | ❌ | ❌ | ❌ |

*Organization deletion requires additional confirmation and may require GoodTeams support for Enterprise plans.

### 3.3 Admin Continuity Rule

**Critical Constraint**: An organization must always have at least one ADMIN.

```typescript
async function removeUserRole(targetUserId: string, actorId: string): Promise<void> {
    const targetUser = await db.user.findUnique({ where: { id: targetUserId } });
    
    if (targetUser.role === "ADMIN") {
        const adminCount = await db.user.count({
            where: {
                organizationId: targetUser.organizationId,
                role: "ADMIN"
            }
        });
        
        if (adminCount <= 1) {
            throw new Error("Cannot remove the last ADMIN. Assign another ADMIN first.");
        }
    }
    
    // Proceed with removal/demotion
}
```

### 3.4 Role Transitions

```
┌──────────────────────────────────────────────────────────┐
│                  ROLE STATE MACHINE                       │
│                                                          │
│   INVITED ──────► USER ◄──────► ADMIN                   │
│      │              │              │                     │
│      │              ▼              │                     │
│      │          BILLING ◄─────────┘                     │
│      │              │                                    │
│      │              ▼                                    │
│      └─────────► VIEWER                                 │
│                     │                                    │
│                     ▼                                    │
│                  REMOVED                                 │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Staff Onboarding Flow

### 4.1 Invitation Process

Admins invite team members by searching the organization's Entra directory:

```
┌─────────────────────────────────────────────────────────────┐
│                    INVITATION FLOW                           │
│                                                             │
│  ┌─────────┐    ┌─────────────┐    ┌──────────────┐        │
│  │  ADMIN  │───►│ Search Entra│───►│ Select User  │        │
│  └─────────┘    │  Directory  │    │ + Set Role   │        │
│                 └─────────────┘    └──────┬───────┘        │
│                                          │                  │
│                                          ▼                  │
│                               ┌──────────────────┐         │
│                               │ Create Invitation │         │
│                               │   (PENDING)       │         │
│                               └────────┬─────────┘         │
│                                        │                    │
│                          ┌─────────────┴─────────────┐     │
│                          ▼                           ▼     │
│                   ┌────────────┐              ┌──────────┐ │
│                   │ Send Email │              │ Store in │ │
│                   │ w/ Link    │              │ Database │ │
│                   └─────┬──────┘              └──────────┘ │
│                         │                                   │
│                         ▼                                   │
│                   ┌────────────┐                           │
│                   │ User Clicks│                           │
│                   │ Accept     │                           │
│                   └─────┬──────┘                           │
│                         │                                   │
│                         ▼                                   │
│                   ┌────────────┐                           │
│                   │ SSO Login  │                           │
│                   │ via Entra  │                           │
│                   └─────┬──────┘                           │
│                         │                                   │
│                         ▼                                   │
│                   ┌────────────┐                           │
│                   │ Link User  │                           │
│                   │ to Org     │                           │
│                   └─────┬──────┘                           │
│                         │                                   │
│                         ▼                                   │
│                   ┌────────────┐                           │
│                   │  ACCEPTED  │                           │
│                   │  (Active)  │                           │
│                   └────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Entra Directory Search

The invitation modal searches the organization's Microsoft Entra directory:

```typescript
// POST /api/organization/entra/search
async function searchEntraUsers(query: string, context: AuthContext): Promise<EntraUser[]> {
    // Requires valid user token with User.Read.All or User.ReadBasic.All
    const token = await getValidMicrosoftToken(context.user.id);
    
    const response = await fetch(
        `https://graph.microsoft.com/v1.0/users?$filter=startswith(displayName,'${query}') or startswith(mail,'${query}')&$top=10`,
        {
            headers: { 'Authorization': `Bearer ${token}` }
        }
    );
    
    const data = await response.json();
    return data.value.map((u: any) => ({
        id: u.id,
        displayName: u.displayName,
        mail: u.mail,
        userPrincipalName: u.userPrincipalName
    }));
}
```

### 4.3 Invitation States

| State | Description | Actions Available |
|-------|-------------|-------------------|
| **PENDING** | Awaiting user acceptance | Revoke, Resend |
| **ACCEPTED** | User joined organization | N/A (complete) |
| **EXPIRED** | Past 7-day validity window | Delete, Resend |
| **REVOKED** | Admin cancelled invitation | Delete, Resend |

### 4.4 Invitation Data Model

```typescript
interface OrganizationInvitation {
    id: string;
    email: string;
    role: UserRole;
    organizationId: string;
    issuerId: string;           // Admin who created invitation
    token: string;              // UUID for accept link
    expiresAt: Date;            // 7 days from creation
    status: InvitationStatus;   // PENDING | ACCEPTED | EXPIRED | REVOKED
    
    // Entra metadata (captured at invite time)
    externalId?: string;        // Entra Object ID
    entraUsername?: string;     // UPN
    entraDisplayName?: string;  // Display name
    
    createdAt: Date;
    updatedAt: Date;
}
```

---

## 5. Permission System

### 5.1 Permission Types

Permissions are divided into two categories:

**Implicit Permissions**: Granted automatically based on role
```typescript
const ADMIN_IMPLICIT_PERMISSIONS = [
    'MANAGE_USERS',
    'MANAGE_MODELS',
    'MANAGE_SKILLS',
    'MANAGE_INTEGRATIONS',
    'VIEW_AUDIT_LOGS',
    'MANAGE_GUARDRAILS',
];

const USER_IMPLICIT_PERMISSIONS = [
    'USE_AI_AGENTS',
    'USE_SKILLS',
    'VIEW_TEAM_MEMBERS',
];
```

**Explicit Permissions**: Granular capabilities assigned per-user
```typescript
const ASSIGNABLE_PERMISSIONS = [
    'CRM_CREATE',
    'CRM_UPDATE', 
    'CRM_DELETE',
    'SQL_EXECUTE',
    'SQL_TRAINING',
    'MANAGE_SHAREPOINT',
    'MANAGE_WORKFLOWS',
    'MANAGE_AGENTS',
];
```

### 5.2 Permission Check Flow

```typescript
async function checkPermission(userId: string, permission: string): Promise<boolean> {
    const user = await db.user.findUnique({
        where: { id: userId },
        include: { permissions: true }
    });
    
    if (!user) return false;
    
    // 1. Super Admin has everything
    if (user.role === 'SUPER_ADMIN') return true;
    
    // 2. Check implicit permissions by role
    if (user.role === 'ADMIN' && ADMIN_IMPLICIT_PERMISSIONS.includes(permission)) {
        return true;
    }
    
    if (user.role === 'BILLING' && permission === 'MANAGE_BILLING') {
        return true;
    }
    
    // 3. Check explicit permissions
    return user.permissions.some(p => p.name === permission);
}
```

### 5.3 Feature Gating

Features are gated by permission checks at both API and UI levels:

```typescript
// API middleware
function requirePermission(permission: string) {
    return async (context: AuthContext) => {
        const hasPermission = await checkPermission(context.user.id, permission);
        if (!hasPermission) {
            throw new HttpError(403, `Permission denied: ${permission}`);
        }
    };
}

// Usage
export const updateAuthorizedModels = async (args, context) => {
    await requirePermission('MANAGE_MODELS')(context);
    // ... implementation
};
```

---

## 6. Admin Functions

### 6.1 Model Management

ADMINs control which AI models are available to the organization:

```typescript
interface AuthorizedModel {
    id: string;           // e.g., "gpt-4o"
    provider: string;     // e.g., "openai"
    isEnabled: boolean;
    maxTokensOverride?: number;
    rateLimitOverride?: number;
}

// GET /api/organization/models
async function getAuthorizedModels(context: AuthContext): Promise<AuthorizedModel[]>;

// PUT /api/organization/models
async function updateAuthorizedModels(
    models: AuthorizedModel[],
    context: AuthContext
): Promise<AuthorizedModel[]>;
```

**Capabilities**:
- Enable/disable specific models for the organization
- Set per-model token limits
- Configure default model for new conversations
- Set default agentic (autonomous) model

### 6.2 Skills & Tools Management

ADMINs control which skills are available:

```typescript
interface OrganizationSkill {
    id: string;
    skillId: string;      // ClawHub skill identifier
    name: string;
    isEnabled: boolean;
    config: Record<string, any>;  // Skill-specific configuration
    allowedRoles: UserRole[];     // Which roles can use this skill
}

// GET /api/organization/skills
async function getOrganizationSkills(context: AuthContext): Promise<OrganizationSkill[]>;

// POST /api/organization/skills
async function installSkill(skillId: string, context: AuthContext): Promise<OrganizationSkill>;

// PUT /api/organization/skills/:id
async function configureSkill(
    id: string,
    config: SkillConfig,
    context: AuthContext
): Promise<OrganizationSkill>;

// DELETE /api/organization/skills/:id
async function removeSkill(id: string, context: AuthContext): Promise<void>;
```

**Capabilities**:
- Install skills from ClawHub marketplace
- Enable/disable skills
- Configure skill parameters
- Restrict skills to specific roles

### 6.3 User Management

ADMINs manage team membership:

```typescript
// GET /api/organization/members
async function getOrganizationMembers(context: AuthContext): Promise<OrgMember[]>;

// POST /api/organization/invitations
async function createInvitation(
    email: string,
    role: UserRole,
    entraData?: EntraUserData,
    context: AuthContext
): Promise<OrganizationInvitation>;

// PUT /api/organization/members/:id/role
async function updateMemberRole(
    memberId: string,
    newRole: UserRole,
    context: AuthContext
): Promise<OrgMember>;

// DELETE /api/organization/members/:id
async function removeMember(memberId: string, context: AuthContext): Promise<void>;
```

**Constraints**:
- Cannot demote/remove the last ADMIN
- Cannot remove yourself (prevents lockout)
- Role changes are logged in audit trail

### 6.4 Guardrails Configuration

ADMINs configure AI behavior guardrails (see SECURITY-ARCHITECTURE.md §3-4):

```typescript
// PUT /api/organization/guardrails
async function updateGuardrails(
    guardrails: GuardrailConfig,
    context: AuthContext
): Promise<GuardrailConfig>;
```

---

## 7. API Specification

### 7.1 Organization Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/organization` | USER+ | Get current organization |
| PUT | `/api/organization` | ADMIN | Update organization settings |
| POST | `/api/organization/entra/consent` | ADMIN | Initiate Entra admin consent |

### 7.2 Member Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/organization/members` | USER+ | List organization members |
| GET | `/api/organization/members/:id` | USER+ | Get member details |
| PUT | `/api/organization/members/:id/role` | ADMIN | Change member role |
| PUT | `/api/organization/members/:id/permissions` | ADMIN | Update member permissions |
| DELETE | `/api/organization/members/:id` | ADMIN | Remove member |

### 7.3 Invitation Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/organization/invitations` | ADMIN | List pending invitations |
| POST | `/api/organization/invitations` | ADMIN | Create invitation |
| DELETE | `/api/organization/invitations/:id` | ADMIN | Revoke invitation |
| POST | `/api/organization/invitations/:id/resend` | ADMIN | Resend invitation email |
| POST | `/api/invitations/accept` | Public | Accept invitation (with token) |

### 7.4 Entra Directory Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/organization/entra/users` | ADMIN | Search Entra directory |
| GET | `/api/organization/entra/groups` | ADMIN | List Entra groups |

### 7.5 Model Management Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/organization/models` | ADMIN | List authorized models |
| PUT | `/api/organization/models` | ADMIN | Update authorized models |
| PUT | `/api/organization/models/defaults` | ADMIN | Set default models |

### 7.6 Skill Management Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/organization/skills` | USER+ | List available skills |
| POST | `/api/organization/skills` | ADMIN | Install skill |
| PUT | `/api/organization/skills/:id` | ADMIN | Configure skill |
| DELETE | `/api/organization/skills/:id` | ADMIN | Remove skill |

---

## 8. Database Schema

### 8.1 Core Tables

```prisma
model Organization {
    id                    String   @id @default(uuid())
    name                  String
    externalTenantId      String?  @unique  // Microsoft Entra Tenant ID
    primaryAuthProvider   AuthProvider @default(EMAIL_ONLY)
    status                OrgStatus @default(PENDING)
    
    // Model configuration
    authorizedModels      Json     @default("[]")
    defaultModelId        String?
    defaultAgenticModelId String?
    
    // Relations
    users                 User[]
    invitations          OrganizationInvitation[]
    skills               OrganizationSkill[]
    
    createdAt            DateTime @default(now())
    updatedAt            DateTime @updatedAt
}

model User {
    id              String   @id @default(uuid())
    email           String   @unique
    username        String?
    role            UserRole @default(USER)
    
    // Entra integration
    externalId      String?  // Entra Object ID
    
    // Organization
    organizationId  String?
    organization    Organization? @relation(fields: [organizationId], references: [id])
    
    // Explicit permissions
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
    updatedAt       DateTime @updatedAt
    
    @@unique([email, organizationId])
}

model UserPermission {
    id        String   @id @default(uuid())
    name      String
    userId    String
    user      User     @relation(fields: [userId], references: [id])
    
    grantedAt DateTime @default(now())
    grantedBy String?  // Admin who granted
    
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

// Enums
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

enum AuthProvider {
    EMAIL_ONLY
    MICROSOFT_ENTRA
    GOOGLE_WORKSPACE
}
```

### 8.2 Audit Log Schema

```prisma
model AuditLog {
    id              String   @id @default(uuid())
    organizationId  String
    actorId         String   // User who performed action
    actorRole       UserRole
    action          String   // e.g., "user.role.changed"
    targetType      String   // e.g., "user", "skill", "model"
    targetId        String?
    details         Json     // Action-specific data
    ipAddress       String?
    userAgent       String?
    
    createdAt       DateTime @default(now())
    
    @@index([organizationId, createdAt])
    @@index([actorId])
    @@index([action])
}
```

---

## 9. Security Considerations

### 9.1 Authorization Checks

Every protected endpoint must verify:
1. User is authenticated
2. User belongs to the organization (for org-scoped resources)
3. User has required role or permission

```typescript
// Middleware pattern
const requireOrgAdmin = async (context: AuthContext) => {
    if (!context.user) throw new HttpError(401);
    if (!context.user.organizationId) throw new HttpError(403, "Not in an organization");
    if (!["ADMIN", "SUPER_ADMIN"].includes(context.user.role)) {
        throw new HttpError(403, "Admin access required");
    }
};
```

### 9.2 Invitation Security

- Tokens are UUIDv4 (cryptographically random)
- Invitations expire after 7 days
- One invitation per email per organization
- Invitation links use HTTPS only
- Accepting requires SSO login (verifies identity)

### 9.3 Admin Protection

```typescript
// Prevent last-admin scenarios
async function validateAdminRemoval(userId: string, orgId: string): Promise<void> {
    const user = await db.user.findUnique({ where: { id: userId } });
    
    if (user?.role === "ADMIN") {
        const adminCount = await db.user.count({
            where: { organizationId: orgId, role: "ADMIN" }
        });
        
        if (adminCount <= 1) {
            throw new Error("Cannot remove the last administrator");
        }
    }
}
```

### 9.4 Audit Requirements

All of the following must be logged:
- User role changes
- Permission grants/revocations
- Invitation creation/acceptance/revocation
- Model authorization changes
- Skill installation/removal/configuration
- Organization settings changes

---

## 10. Implementation Roadmap

### Phase 1: Core RBAC (Week 1-2)
- [ ] User role field and enum
- [ ] Role-based middleware
- [ ] Permission check functions
- [ ] Basic API authorization

### Phase 2: Organization Lifecycle (Week 2-3)
- [ ] Organization creation on Entra consent
- [ ] Organization status management
- [ ] PENDING state restrictions

### Phase 3: Invitation System (Week 3-4)
- [ ] Invitation model and CRUD
- [ ] Entra directory search integration
- [ ] Email sending with invitation links
- [ ] Invitation acceptance flow

### Phase 4: Admin Functions (Week 4-5)
- [ ] Model management UI and API
- [ ] Skill management UI and API
- [ ] User management UI and API
- [ ] Admin continuity enforcement

### Phase 5: Audit & Polish (Week 5-6)
- [ ] Audit logging for all admin actions
- [ ] Permission assignment UI
- [ ] Invitation management UI
- [ ] Error handling and edge cases

---

## Appendix: Related Documents

- [Security Architecture](./SECURITY-ARCHITECTURE.md) — Guardrails, HITL, threat model
- [Microsoft 365 Auth Architecture](./MICROSOFT-365-AUTH-ARCHITECTURE.md) — Entra integration details
- [Multi-Tenant Architecture](./MULTI-TENANT-ARCHITECTURE.md) — Tenant isolation

---

*This document is maintained by the GoodTeams Engineering Team.*
