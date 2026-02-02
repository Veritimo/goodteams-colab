# Google Workspace Authentication Architecture

**Multi-tenant SaaS Integration Pattern for GoodTeams**

*Author: Orion ✨*  
*Date: February 2026*

---

## Executive Summary

GoodTeams uses **Google Cloud OAuth 2.0** with optional **Domain-wide Delegation** to integrate with Google Workspace. This mirrors the Microsoft 365 pattern with Google-specific implementations:

1. **Single OAuth client** — Developer creates OAuth client in Google Cloud Console
2. **User consent** — Users authorize access via OAuth consent screen
3. **Domain-wide delegation** — Enterprise admins grant service account impersonation rights
4. **Delegated access** — Access Drive, Gmail, Calendar on behalf of users

This document details the architecture and where it fits in the GoodTeams strategy.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Customer Enterprise                              │
│                                                                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│  │     Users       │    │   Google Drive  │    │     Gmail       │     │
│  │  (Google IDs)   │    │   Docs/Sheets   │    │    Calendar     │     │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘     │
│           │                      │                      │               │
│           └──────────────────────┼──────────────────────┘               │
│                                  │                                       │
│                           Google APIs                                    │
│                                  │                                       │
└──────────────────────────────────┼───────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
          ┌─────────▼─────────┐        ┌─────────▼─────────┐
          │  Domain-wide      │        │   User OAuth      │
          │  Delegation       │        │   (Consent)       │
          │  (Service Acct)   │        │                   │
          └─────────┬─────────┘        └─────────┬─────────┘
                    │                             │
                    └──────────────┬──────────────┘
                                   │
┌──────────────────────────────────▼───────────────────────────────────────┐
│                        GoodTeams Platform                                 │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                  Google Cloud OAuth Client                           ││
│  │                                                                      ││
│  │   Client ID: <developer's OAuth client>                             ││
│  │   Project: goodteams-prod                                           ││
│  │                                                                      ││
│  │   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐          ││
│  │   │ Service Acct  │  │ Auth Code     │  │ Refresh Token │          ││
│  │   │ Impersonation │  │ Flow (User)   │  │ Flow          │          ││
│  │   └───────────────┘  └───────────────┘  └───────────────┘          ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │  Organization   │  │      User       │  │     Agent       │         │
│  │  (domain link)  │  │  (tokens)       │  │   (tools)       │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Authentication Flows

### 1. User OAuth Flow (Delegated Access)

**Purpose:** Get access to a user's Google Workspace data with their consent.

**Flow:**
```
1. User clicks "Link Google Account" in GoodTeams
2. Redirect to Google:
   https://accounts.google.com/o/oauth2/v2/auth
     ?client_id={client_id}
     &redirect_uri={callback_url}
     &response_type=code
     &scope={scopes}
     &access_type=offline
     &prompt=consent
     &state={user_id_base64}
3. User signs in and consents to permissions
4. Google redirects back with authorization code
5. GoodTeams exchanges code for access + refresh tokens
6. Tokens stored securely for the user
```

**Key parameters:**
- `access_type=offline` — Required to get refresh token
- `prompt=consent` — Force consent screen (ensures refresh token)

**Requested scopes:**
```
# Core
openid
email
profile

# Drive (≈ SharePoint/OneDrive)
https://www.googleapis.com/auth/drive.readonly
https://www.googleapis.com/auth/drive.file

# Gmail (≈ Outlook)
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.compose

# Calendar
https://www.googleapis.com/auth/calendar.readonly
https://www.googleapis.com/auth/calendar.events

# Docs/Sheets/Slides
https://www.googleapis.com/auth/documents.readonly
https://www.googleapis.com/auth/spreadsheets.readonly
https://www.googleapis.com/auth/presentations.readonly
```

**Stored data:**
```typescript
User {
  id: string;
  googleAccessToken: string;      // Encrypted
  googleRefreshToken: string;     // Encrypted
  googleTokenExpiry: Date;
  googleId: string;               // User's Google ID
  googleEmail: string;            // User's email
  googleDomain: string;           // Workspace domain (if applicable)
}
```

### 2. Domain-wide Delegation (Organization-Level)

**Purpose:** Enable background access to any user's data in a Google Workspace domain.

**This is MORE powerful than Microsoft's admin consent** — the service account can impersonate any user in the domain without their individual consent.

**Setup Flow:**
```
1. GoodTeams creates a Service Account in Google Cloud Console
2. Generate JSON key file for the service account
3. Customer's Workspace Admin:
   a. Goes to Admin Console → Security → API Controls → Domain-wide Delegation
   b. Adds the service account's Client ID
   c. Grants specific scopes (e.g., Gmail, Drive, Calendar)
4. GoodTeams stores the domain association
5. Service account can now impersonate any user in that domain
```

**Impersonation code:**
```typescript
import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  keyFile: 'service-account.json',
  scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  clientOptions: {
    subject: 'user@customer-domain.com'  // Impersonate this user
  }
});

const gmail = google.gmail({ version: 'v1', auth });
const messages = await gmail.users.messages.list({ userId: 'me' });
```

**Stored data:**
```typescript
Organization {
  id: string;
  googleWorkspaceDomain: string;          // e.g., "acme.com"
  googleDelegationEnabled: boolean;
  googleServiceAccountId: string;         // Client ID for delegation
  // Note: Service account key stored in secure vault, not DB
}
```

### 3. Token Refresh Flow

**Purpose:** Keep access tokens valid without re-prompting the user.

```typescript
import { OAuth2Client } from 'google-auth-library';

const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
oauth2Client.setCredentials({
  refresh_token: user.googleRefreshToken
});

// Automatically refreshes when needed
const { credentials } = await oauth2Client.refreshAccessToken();
await updateUserTokens(user.id, credentials);
```

**Important:** Google refresh tokens can expire if:
- User revokes access
- Token unused for 6 months
- User changes password (in some cases)
- App is in "Testing" mode (tokens expire after 7 days)

---

## OAuth Client Configuration

### Google Cloud Console Setup

**Project Setup:**
```
1. Create project in Google Cloud Console
2. Enable APIs:
   - Google Drive API
   - Gmail API
   - Google Calendar API
   - Google Docs API
   - Google Sheets API
   - Google Slides API
   - Admin SDK API (for directory access)
```

**OAuth Consent Screen:**
```
App name: GoodTeams
User support email: support@goodteams.ai
App logo: (upload)
App domain: goodteams.ai
Authorized domains: goodteams.ai
Developer contact: dev@goodteams.ai

Scopes: (add all required scopes)

User type: External (for multi-tenant)
Publishing status: In Production (required for refresh tokens > 7 days)
```

**OAuth Client ID:**
```
Application type: Web application
Name: GoodTeams Web Client
Authorized JavaScript origins:
  - https://app.goodteams.ai
Authorized redirect URIs:
  - https://app.goodteams.ai/api/auth/google/callback
```

**Service Account (for Domain-wide Delegation):**
```
1. Create service account in IAM & Admin
2. Grant no roles (delegation doesn't need GCP roles)
3. Create JSON key and download securely
4. Note the Client ID (for customer admin setup)
```

---

## Comparison: Google vs Microsoft Auth

| Aspect | Microsoft 365 | Google Workspace |
|--------|---------------|------------------|
| **Admin grant mechanism** | Admin Consent URL | Domain-wide Delegation in Admin Console |
| **Admin grant scope** | App can access tenant | Service account can impersonate ANY user |
| **Background job access** | Client credentials flow | Service account impersonation |
| **Credential type** | Client secret (string) | JSON key file (more complex) |
| **Token refresh** | Standard OAuth | Same, but can expire in Testing mode |
| **App verification** | Microsoft Publisher Verification | Google OAuth App Verification |
| **Enterprise distribution** | AppSource | Workspace Marketplace |
| **Consent granularity** | Per-app | Per-user or domain-wide |

### Key Architectural Difference

**Microsoft:** Admin consent grants the *app* access to the tenant. Users still authenticate individually, but don't need to re-consent to permissions.

**Google:** Domain-wide delegation grants a *service account* the ability to impersonate users. No user authentication needed at all for background operations.

---

## Security Considerations

### Service Account Key Security
- **Never store in database** — Use secure vault (HashiCorp Vault, GCP Secret Manager)
- **Rotate regularly** — Generate new keys periodically
- **Limit scope** — Only grant necessary scopes in Admin Console
- **Audit access** — Monitor impersonation usage

### OAuth Token Storage
- Encrypt tokens at rest (AES-256)
- Use secure session storage
- Implement token revocation on user disconnect
- Handle refresh token expiration gracefully

### Scope Minimization
- Request only needed scopes
- Use `.readonly` variants when write not needed
- Consider incremental authorization for sensitive scopes

### Domain Verification
- Verify user's email domain matches organization
- Prevent cross-organization access
- Audit all API calls with user context

---

## Integration Points

### Google Drive API

```typescript
import { google } from 'googleapis';

const drive = google.drive({ version: 'v3', auth });

// List files
const files = await drive.files.list({
  pageSize: 100,
  fields: 'files(id, name, mimeType, modifiedTime)',
  q: "mimeType != 'application/vnd.google-apps.folder'"
});

// Download file content
const content = await drive.files.get({
  fileId: fileId,
  alt: 'media'
});
```

### Gmail API

```typescript
const gmail = google.gmail({ version: 'v1', auth });

// List messages
const messages = await gmail.users.messages.list({
  userId: 'me',
  maxResults: 50,
  q: 'is:unread'
});

// Send email
await gmail.users.messages.send({
  userId: 'me',
  requestBody: {
    raw: base64EncodedEmail
  }
});
```

### Calendar API

```typescript
const calendar = google.calendar({ version: 'v3', auth });

// List events
const events = await calendar.events.list({
  calendarId: 'primary',
  timeMin: new Date().toISOString(),
  maxResults: 50,
  singleEvents: true,
  orderBy: 'startTime'
});

// Create event
await calendar.events.insert({
  calendarId: 'primary',
  requestBody: {
    summary: 'Meeting',
    start: { dateTime: '2026-02-15T10:00:00-08:00' },
    end: { dateTime: '2026-02-15T11:00:00-08:00' }
  }
});
```

---

## Strategy Integration

### Phase 1: Security Foundation (Weeks 5-10)

**Shared infrastructure with Microsoft:**
- Token encryption vault (supports both providers)
- OAuth callback handling framework
- User credential storage schema

### Phase 3: Google Workspace Integration (Weeks 19-24)

**Dependencies:**
- Phase 1 auth infrastructure must be complete

**Implementation order:**

| Task | Effort | Priority |
|------|--------|----------|
| OAuth consent screen & client setup | 0.5 weeks | P0 |
| User authorization code flow | 1 week | P0 |
| Token refresh service | 0.5 weeks | P0 |
| Service account + domain-wide delegation | 1 week | P0 |
| Google Drive connector plugin | 2 weeks | P0 |
| Gmail tools (read, send, search) | 1.5 weeks | P0 |
| Google Calendar tools | 1 week | P0 |
| Google Docs/Sheets/Slides read access | 1 week | P1 |
| Google Chat channel enhancement | 1 week | P1 |

**Permissions to request:**

| Scope | Purpose | Sensitivity |
|-------|---------|-------------|
| `openid email profile` | User identity | Low |
| `drive.readonly` | Read files | Medium |
| `drive.file` | Read/write app-created files | Medium |
| `gmail.readonly` | Read email | High |
| `gmail.send` | Send email | High |
| `calendar.readonly` | Read calendar | Medium |
| `calendar.events` | Create/edit events | Medium |

---

## Environment Variables

```bash
# Google OAuth Client
GOOGLE_CLIENT_ID=<oauth-client-id>
GOOGLE_CLIENT_SECRET=<oauth-client-secret>
GOOGLE_REDIRECT_URI=https://app.goodteams.ai/api/auth/google/callback

# Service Account (for domain-wide delegation)
GOOGLE_SERVICE_ACCOUNT_PATH=/secure/path/to/service-account.json
# Or as base64-encoded JSON:
GOOGLE_SERVICE_ACCOUNT_JSON=<base64-encoded-json>

# Encryption (shared with Microsoft)
TOKEN_ENCRYPTION_KEY=<32-byte-key>
```

---

## Workspace Marketplace (Optional)

For enterprise distribution, consider listing on Google Workspace Marketplace:

**Benefits:**
- Trusted distribution channel
- Simplified admin installation
- Automatic domain-wide delegation setup
- Visibility to Workspace admins

**Requirements:**
- OAuth app verification
- Security assessment
- Privacy policy
- Terms of service
- Support documentation

---

## Appendix: Scope Reference

### Drive Scopes
| Scope | Access Level |
|-------|--------------|
| `drive.readonly` | Read all files |
| `drive.file` | Read/write files created by app |
| `drive.appdata` | App-specific hidden folder |
| `drive` | Full access (avoid if possible) |

### Gmail Scopes
| Scope | Access Level |
|-------|--------------|
| `gmail.readonly` | Read all email |
| `gmail.send` | Send email |
| `gmail.compose` | Create drafts |
| `gmail.modify` | Read, send, delete, modify |

### Calendar Scopes
| Scope | Access Level |
|-------|--------------|
| `calendar.readonly` | Read calendars and events |
| `calendar.events` | Read and write events |
| `calendar` | Full calendar access |

### Admin Scopes (require domain-wide delegation)
| Scope | Access Level |
|-------|--------------|
| `admin.directory.user.readonly` | Read user directory |
| `admin.directory.group.readonly` | Read groups |

---

*This document should be integrated into the main GOODTEAMS-STRATEGY.md as Appendix F, complementing Appendix E (Microsoft 365 Auth Architecture).*
