# Phase 4: Microsoft 365 Integration

> Full M365 integration via Microsoft Graph API

**Duration:** 6 weeks  
**Status:** In Progress  
**Dependencies:** Phase 2 Security Foundation (Entra SSO) ✅, Phase 3 Multi-Tenancy ✅

---

## Overview

Phase 4 connects GoodTeams to Microsoft 365 services through the MS Graph API:

- **SharePoint & OneDrive** — File browsing, read/write, search
- **Outlook** — Email, calendar, contacts
- **Teams** — Channel messaging, webhooks, adaptive cards

The Entra SSO from Phase 2 provides the authentication foundation. Phase 4 adds the Graph client and service-specific tools.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     GoodTeams Platform                           │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   MS Graph Client                         │   │
│  │                                                           │   │
│  │  • Token management (from Entra auth)                    │   │
│  │  • Auto-refresh before expiry                            │   │
│  │  • Rate limit handling (429 + Retry-After)               │   │
│  │  • Batch request support                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│        ┌─────────────────────┼─────────────────────┐            │
│        │                     │                     │            │
│        ▼                     ▼                     ▼            │
│  ┌───────────┐        ┌───────────┐        ┌───────────┐       │
│  │ SharePoint│        │  Outlook  │        │   Teams   │       │
│  │ & OneDrive│        │           │        │           │       │
│  │           │        │ • Mail    │        │ • Channel │       │
│  │ • Sites   │        │ • Calendar│        │ • Webhooks│       │
│  │ • Files   │        │ • Contacts│        │ • Cards   │       │
│  │ • Search  │        │           │        │           │       │
│  └───────────┘        └───────────┘        └───────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    Microsoft Graph API
                    https://graph.microsoft.com/v1.0
```

---

## Implementation Streams

### Stream A: MS Graph Foundation
**Owner:** Agent A  
**Duration:** Week 1

| Task | Description |
|------|-------------|
| Graph client | Token provider using Entra tokens |
| Request builder | Fluent API for Graph calls |
| Error handling | Retry on 429/5xx, token refresh on 401 |
| Rate limiting | Track limits, back off when throttled |
| Batch requests | Combine multiple calls ($batch) |

### Stream B: SharePoint & OneDrive
**Owner:** Agent B  
**Duration:** Weeks 1-2

| Task | Description |
|------|-------------|
| List sites | Get accessible SharePoint sites |
| Browse files | Navigate folders, list files |
| Read files | Download file content |
| Write files | Upload/update files |
| Search | Search across sites/drives |
| Permissions | Sites.Selected scope handling |

### Stream C: Outlook (Mail, Calendar, Contacts)
**Owner:** Agent C  
**Duration:** Week 2

| Task | Description |
|------|-------------|
| List mail | Inbox, folders, search |
| Read mail | Get message content, attachments |
| Send mail | Compose and send |
| Calendar list | Get events |
| Calendar CRUD | Create/update/delete events |
| Contacts | List contacts |

### Stream D: Teams Channel Plugin
**Owner:** Agent D  
**Duration:** Weeks 2-3

| Task | Description |
|------|-------------|
| Channel plugin | Extension in `extensions/teams/` |
| Receive messages | Webhook subscription for incoming |
| Send messages | Post to channels/chats |
| Adaptive cards | Rich message formatting |
| Meeting transcripts | Access recordings (if available) |

---

## File Structure

```
src/platform/
├── integrations/
│   └── microsoft/
│       ├── index.ts                    # Barrel export
│       ├── graph-client.ts             # Core Graph client
│       ├── graph-batch.ts              # Batch request builder
│       ├── rate-limiter.ts             # Rate limit tracking
│       ├── sharepoint/
│       │   ├── index.ts
│       │   ├── sites.ts                # Site operations
│       │   ├── files.ts                # File CRUD
│       │   └── search.ts               # Search across sites
│       ├── outlook/
│       │   ├── index.ts
│       │   ├── mail.ts                 # Email operations
│       │   ├── calendar.ts             # Calendar operations
│       │   └── contacts.ts             # Contacts operations
│       └── __tests__/
│           ├── graph-client.test.ts
│           ├── sharepoint.test.ts
│           ├── outlook.test.ts
│           └── ...
│
extensions/
└── teams/
    ├── index.ts                        # Plugin entry
    ├── webhook.ts                      # Incoming messages
    ├── sender.ts                       # Outgoing messages
    ├── cards.ts                        # Adaptive card builder
    └── __tests__/
        └── teams.test.ts
```

---

## Graph API Scopes

### Already Configured (Phase 2 Entra)

```typescript
// From src/platform/auth/entra/client.ts
export const GRAPH_SCOPES = [
  'User.Read',
  'offline_access',
];

export const FULL_M365_SCOPES = [
  'User.Read',
  'Mail.ReadWrite',
  'Mail.Send',
  'Calendars.ReadWrite',
  'Contacts.Read',
  'Files.ReadWrite.All',
  'Sites.Read.All',
  'offline_access',
];
```

### Additional Scopes Needed

```typescript
// SharePoint granular
'Sites.Selected',              // Per-site permissions

// Teams
'ChannelMessage.Read.All',     // Read channel messages
'ChannelMessage.Send',         // Send to channels
'Chat.ReadWrite',              // Chat messages
'OnlineMeetings.Read.All',     // Meeting details
'OnlineMeetingTranscript.Read.All', // Transcripts
```

---

## API Design

### Graph Client

```typescript
// graph-client.ts
import { Client } from '@microsoft/microsoft-graph-client';

export interface GraphClientOptions {
  organizationId: string;
  userId?: string;  // For user-delegated permissions
}

export async function createGraphClient(options: GraphClientOptions): Promise<Client>;

export async function graphRequest<T>(
  client: Client,
  path: string,
  options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    headers?: Record<string, string>;
  }
): Promise<T>;
```

### SharePoint Tools

```typescript
// sharepoint/sites.ts
export async function listSites(client: Client): Promise<Site[]>;
export async function getSite(client: Client, siteId: string): Promise<Site>;
export async function listDrives(client: Client, siteId: string): Promise<Drive[]>;

// sharepoint/files.ts
export async function listFiles(client: Client, driveId: string, path?: string): Promise<DriveItem[]>;
export async function getFile(client: Client, driveId: string, itemId: string): Promise<DriveItem>;
export async function downloadFile(client: Client, driveId: string, itemId: string): Promise<Buffer>;
export async function uploadFile(client: Client, driveId: string, path: string, content: Buffer): Promise<DriveItem>;
export async function deleteFile(client: Client, driveId: string, itemId: string): Promise<void>;

// sharepoint/search.ts
export async function searchFiles(client: Client, query: string): Promise<SearchResult[]>;
```

### Outlook Tools

```typescript
// outlook/mail.ts
export async function listMessages(client: Client, options?: ListOptions): Promise<Message[]>;
export async function getMessage(client: Client, messageId: string): Promise<Message>;
export async function sendMail(client: Client, message: NewMessage): Promise<void>;
export async function replyToMessage(client: Client, messageId: string, reply: ReplyMessage): Promise<void>;

// outlook/calendar.ts
export async function listEvents(client: Client, options?: CalendarOptions): Promise<Event[]>;
export async function getEvent(client: Client, eventId: string): Promise<Event>;
export async function createEvent(client: Client, event: NewEvent): Promise<Event>;
export async function updateEvent(client: Client, eventId: string, updates: Partial<Event>): Promise<Event>;
export async function deleteEvent(client: Client, eventId: string): Promise<void>;

// outlook/contacts.ts
export async function listContacts(client: Client): Promise<Contact[]>;
export async function getContact(client: Client, contactId: string): Promise<Contact>;
```

---

## Agent Tools

These will be registered as tools the AI agent can call:

### SharePoint Tools
- `sharepoint_list_sites` — List accessible SharePoint sites
- `sharepoint_list_files` — List files in a folder
- `sharepoint_read_file` — Read file content
- `sharepoint_write_file` — Upload/update file
- `sharepoint_search` — Search across all sites

### Outlook Tools
- `outlook_list_mail` — List inbox messages
- `outlook_read_mail` — Read specific email
- `outlook_send_mail` — Send email
- `outlook_list_calendar` — List calendar events
- `outlook_create_event` — Create calendar event
- `outlook_list_contacts` — List contacts

### Teams Tools
- `teams_send_message` — Send message to channel/chat
- `teams_list_channels` — List team channels
- `teams_read_messages` — Read channel messages

---

## Testing Requirements

### Unit Tests (per file)
- `graph-client.test.ts` (15+ tests)
- `rate-limiter.test.ts` (10+ tests)
- `sharepoint/sites.test.ts` (10+ tests)
- `sharepoint/files.test.ts` (15+ tests)
- `sharepoint/search.test.ts` (8+ tests)
- `outlook/mail.test.ts` (15+ tests)
- `outlook/calendar.test.ts` (12+ tests)
- `outlook/contacts.test.ts` (8+ tests)
- `teams/webhook.test.ts` (10+ tests)
- `teams/sender.test.ts` (10+ tests)
- `teams/cards.test.ts` (8+ tests)

### Integration Tests
- Token refresh flow
- Rate limit handling
- Batch request execution

### E2E Scenarios
- `sharepoint_crud` — Read/write SharePoint file
- `outlook_send` — Send email via Outlook
- `teams_message` — Bidirectional Teams message

---

## Phase 4 Checkpoint

| Criterion | Requirement |
|-----------|-------------|
| Graph Client | Token management, rate limiting work |
| SharePoint | List sites, read/write files |
| Outlook | Send email, CRUD calendar |
| Teams | Bidirectional messaging |
| Tests | All unit + integration pass |
| E2E | `sharepoint_crud`, `outlook_send`, `teams_message` pass |

---

## Dependencies

### npm packages to add

```bash
pnpm add @microsoft/microsoft-graph-client @microsoft/microsoft-graph-types
```

### Existing dependencies (from Phase 2)
- `@azure/msal-node` — Token acquisition

---

## Notes

### Rate Limiting
MS Graph has aggressive rate limits. We must:
1. Track `Retry-After` headers
2. Implement exponential backoff
3. Use batch requests where possible
4. Cache site/drive metadata

### Sites.Selected
For security, prefer `Sites.Selected` over `Sites.Read.All`:
- Admin grants access to specific SharePoint sites
- Use admin consent to configure which sites

### Teams Webhooks
Incoming webhooks require:
1. Azure Bot registration (or Webhook connector)
2. Subscription management for change notifications
3. Handling subscription renewals (max 72hr for most resources)
