# Microsoft 365 Authentication Architecture

**Multi-tenant SaaS Integration Pattern for GoodTeams**

*Author: Orion ✨*  
*Date: February 2026*  
*Reference: goodteams-ai implementation (`platform/app/src/entra/`)*

---

## Executive Summary

GoodTeams uses a **multi-tenant Entra ID (Azure AD) application** to integrate with Microsoft 365. This is the canonical SaaS pattern that enables:

1. **Single app registration** — Developer registers once in their Entra tenant
2. **Customer consent** — Enterprise customers authorize access via admin consent
3. **Delegated access** — Access MS Graph, Dynamics, SharePoint on behalf of users
4. **User SSO** — Users authenticate with their existing Microsoft credentials

This document details the architecture and where it fits in the GoodTeams strategy.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Customer Enterprise                              │
│                                                                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│  │     Users       │    │   SharePoint    │    │    Dynamics     │     │
│  │  (Entra IDs)    │    │    OneDrive     │    │    Dataverse    │     │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘     │
│           │                      │                      │               │
│           └──────────────────────┼──────────────────────┘               │
│                                  │                                       │
│                          Microsoft Graph API                             │
│                                  │                                       │
└──────────────────────────────────┼───────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
          ┌─────────▼─────────┐        ┌─────────▼─────────┐
          │   Admin Consent   │        │   User Auth       │
          │   (Org-level)     │        │   (User-level)    │
          └─────────┬─────────┘        └─────────┬─────────┘
                    │                             │
                    └──────────────┬──────────────┘
                                   │
┌──────────────────────────────────▼───────────────────────────────────────┐
│                        GoodTeams Platform                                 │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                    Multi-tenant Entra App                            ││
│  │                                                                      ││
│  │   App ID: <developer's app registration>                            ││
│  │   Tenant: "common" (multi-tenant)                                   ││
│  │                                                                      ││
│  │   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐          ││
│  │   │ Client Creds  │  │ Auth Code     │  │ On-Behalf-Of  │          ││
│  │   │ Flow (App)    │  │ Flow (User)   │  │ Flow (Mixed)  │          ││
│  │   └───────────────┘  └───────────────┘  └───────────────┘          ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │  Organization   │  │      User       │  │     Agent       │         │
│  │  (tenant link)  │  │  (tokens)       │  │   (tools)       │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Authentication Flows

### 1. Admin Consent Flow (Organization-Level)

**Purpose:** Link a customer's Microsoft 365 tenant to their GoodTeams organization.

**Flow:**
```
1. Org admin clicks "Connect Microsoft 365" in GoodTeams
2. Redirect to Microsoft:
   https://login.microsoftonline.com/{tenant}/adminconsent
     ?client_id={app_id}
     &redirect_uri={callback_url}
     &state={org_id_base64}
3. Admin reviews and approves requested permissions
4. Microsoft redirects back with admin_consent=True
5. GoodTeams stores externalTenantId for the organization
6. App can now access that tenant's resources via client credentials
```

**What this enables:**
- Directory queries (user search)
- Tenant-wide operations
- Background jobs without user context

**Stored data:**
```typescript
Organization {
  id: string;
  externalTenantId: string;  // Customer's Entra tenant ID
  resourceConnections: [{
    type: 'ENTRA',
    status: 'connected',
    config: { ... }
  }]
}
```

### 2. User Authorization Code Flow (User-Level)

**Purpose:** Get delegated access to a user's Microsoft 365 data.

**Flow:**
```
1. User clicks "Link Microsoft Account" in GoodTeams
2. Redirect to Microsoft:
   https://login.microsoftonline.com/common/oauth2/v2.0/authorize
     ?client_id={app_id}
     &response_type=code
     &redirect_uri={callback_url}
     &scope={permissions}
     &state={user_id_base64}
3. User signs in and consents to permissions
4. Microsoft redirects back with authorization code
5. GoodTeams exchanges code for access + refresh tokens
6. Tokens stored securely for the user
```

**Requested permissions (delegated):**
```
User.Read                          # Basic profile
Sites.Read.All                     # SharePoint sites
Sites.FullControl.All              # SharePoint write (optional)
Files.Read.All                     # OneDrive files
Calendars.Read                     # Calendar access
OnlineMeetings.Read                # Teams meetings
OnlineMeetingTranscript.Read.All   # Meeting transcripts
Mail.ReadWrite                     # Email access
Mail.Send                          # Send email on behalf
```

**Stored data:**
```typescript
User {
  id: string;
  msAccessToken: string;      // Encrypted
  msRefreshToken: string;     // Encrypted
  msTokenExpiry: Date;
  microsoftId: string;        // User's Microsoft object ID
  msUserTenantId: string;     // Tenant the user belongs to
}
```

### 3. Token Refresh Flow

**Purpose:** Keep access tokens valid without re-prompting the user.

```typescript
// Automatic refresh when token expires
if (user.msTokenExpiry < new Date()) {
  const tokens = await refreshMicrosoftToken(user.msRefreshToken);
  await updateUserTokens(user.id, tokens);
}
```

---

## App Registration Configuration

### Developer-Side (GoodTeams Entra Tenant)

**App Registration Settings:**
```
Name: GoodTeams Enterprise
Application (client) ID: <guid>
Supported account types: Accounts in any organizational directory (Multi-tenant)
Redirect URIs:
  - https://app.goodteams.ai/api/auth/entra/callback (admin consent)
  - https://app.goodteams.ai/api/auth/entra/user-callback (user auth)
```

**API Permissions:**
| Permission | Type | Admin Consent |
|------------|------|---------------|
| User.Read | Delegated | No |
| Sites.Read.All | Delegated | Yes |
| Files.Read.All | Delegated | Yes |
| Calendars.Read | Delegated | Yes |
| Mail.ReadWrite | Delegated | Yes |
| Mail.Send | Delegated | Yes |
| Directory.Read.All | Application | Yes |

**Certificates & Secrets:**
- Client secret for auth code exchange
- Consider certificate-based auth for production

---

## Integration Points

### MS Graph API Access

```typescript
// Using user's delegated token
const graphClient = Client.init({
  authProvider: (done) => {
    done(null, user.msAccessToken);
  }
});

// SharePoint files
const files = await graphClient.api('/sites/{site-id}/drive/items').get();

// User's calendar
const events = await graphClient.api('/me/calendar/events').get();

// Send email
await graphClient.api('/me/sendMail').post({ message: {...} });
```

### Dynamics / Dataverse Access

Dataverse uses the same Entra tokens but different API endpoint:

```typescript
// Dataverse API (same tenant, different scope)
const dataverseUrl = `https://${org}.crm.dynamics.com/api/data/v9.2`;

// Or via TDS endpoint for SQL-like access
const tdsEndpoint = `${org}.crm.dynamics.com:5558`;
```

---

## Security Considerations

### Token Storage
- Encrypt tokens at rest (AES-256)
- Use secure session storage
- Never log tokens

### Scope Minimization
- Request only needed permissions
- Use incremental consent when possible
- Prefer delegated over application permissions

### Tenant Isolation
- Validate tenant ID matches organization
- Don't allow cross-tenant access
- Audit all MS Graph calls

### Refresh Token Handling
- Rotate refresh tokens when refreshed
- Implement token revocation on user disconnect
- Monitor for compromised tokens

---

## Alternative: M365 MCP Server

The **Microsoft 365 MCP Server** provides Microsoft 365 access via Model Context Protocol. 

### Comparison

| Aspect | Native MSAL/Graph | M365 MCP Server |
|--------|-------------------|-----------------|
| **Control** | Full | Limited to MCP tools |
| **Auth flows** | All OAuth flows | Depends on MCP server |
| **Custom scopes** | Yes | Fixed by MCP server |
| **Error handling** | Full control | MCP abstraction |
| **Enterprise compliance** | Full audit trail | Depends on implementation |
| **Dynamics/Dataverse** | Yes | May not support |
| **Setup complexity** | Higher | Lower |
| **Maintenance** | Internal | External dependency |

### Recommendation

**Use native MSAL/Graph for production SaaS:**
- Full control over auth flows
- Custom permission scoping per tenant
- Complete audit trail
- Supports all MS services (Graph, Dynamics, SharePoint)

**Consider MCP for:**
- Rapid prototyping
- Simple deployments
- Non-enterprise use cases
- Fallback/alternative path

---

## Strategy Integration

### Phase 1: Security Foundation (Weeks 5-10)

**Update to include:**
- OIDC via Entra ID (MSAL) for user SSO
- Multi-tenant app registration pattern
- Token storage infrastructure (encrypted vault)
- Admin consent flow implementation

### Phase 2: Microsoft 365 Integration (Weeks 11-18)

**Dependencies:**
- Phase 1 auth infrastructure must be complete
- App registration configured in developer tenant

**Implementation order:**
1. User auth flow (MSAL + authorization code)
2. Token refresh service
3. MS Graph connector plugin
4. SharePoint/OneDrive tools
5. Outlook email/calendar tools
6. Teams integration

### Phase 4: Database & CRM (Weeks 25-32)

**Dynamics/Dataverse integration:**
- Reuse Entra tokens from Phase 2
- Add Dataverse-specific scopes
- TDS endpoint for SQL-like queries
- CRM entity tools

---

## Environment Variables

```bash
# Entra App Registration
ENTRA_CLIENT_ID=<application-id>
ENTRA_CLIENT_SECRET=<client-secret>
ENTRA_TENANT_ID=<developer-tenant-id>  # For app-only flows

# Encryption
TOKEN_ENCRYPTION_KEY=<32-byte-key>

# Redirect URIs
ENTRA_REDIRECT_URI=https://app.goodteams.ai/api/auth/entra/callback
ENTRA_USER_REDIRECT_URI=https://app.goodteams.ai/api/auth/entra/user-callback
```

---

## Appendix: goodteams-ai Reference Files

| File | Purpose |
|------|---------|
| `platform/app/src/entra/api.ts` | Admin consent callback |
| `platform/app/src/entra/user_auth.ts` | User authorization flow |
| `platform/app/src/entra/operations.ts` | Entra user search |
| `engine/app/services/microsoft_graph.py` | Graph API client |

---

*This document should be integrated into the main GOODTEAMS-STRATEGY.md as an appendix or as expanded detail in Phases 1 and 2.*
