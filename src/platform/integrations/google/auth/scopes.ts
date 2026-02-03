/**
 * Google API OAuth Scopes
 *
 * Defines all OAuth 2.0 scopes used for Google Workspace integration.
 * Scopes determine what access the application has to user data.
 *
 * @see https://developers.google.com/identity/protocols/oauth2/scopes
 * @see docs/GOOGLE-WORKSPACE-AUTH-ARCHITECTURE.md
 */

// =============================================================================
// INDIVIDUAL SCOPES
// =============================================================================

/**
 * Google API OAuth scopes for various services
 */
export const GOOGLE_SCOPES = {
  // OpenID Connect scopes
  OPENID: "openid",
  EMAIL: "email",
  PROFILE: "profile",

  // Google Drive scopes
  DRIVE_READ: "https://www.googleapis.com/auth/drive.readonly",
  DRIVE_FILE: "https://www.googleapis.com/auth/drive.file",
  DRIVE_FULL: "https://www.googleapis.com/auth/drive",
  DRIVE_APPDATA: "https://www.googleapis.com/auth/drive.appdata",
  DRIVE_METADATA_READ: "https://www.googleapis.com/auth/drive.metadata.readonly",

  // Gmail scopes
  GMAIL_READ: "https://www.googleapis.com/auth/gmail.readonly",
  GMAIL_SEND: "https://www.googleapis.com/auth/gmail.send",
  GMAIL_COMPOSE: "https://www.googleapis.com/auth/gmail.compose",
  GMAIL_MODIFY: "https://www.googleapis.com/auth/gmail.modify",
  GMAIL_LABELS: "https://www.googleapis.com/auth/gmail.labels",
  GMAIL_INSERT: "https://www.googleapis.com/auth/gmail.insert",

  // Google Calendar scopes
  CALENDAR_READ: "https://www.googleapis.com/auth/calendar.readonly",
  CALENDAR_EVENTS: "https://www.googleapis.com/auth/calendar.events",
  CALENDAR_FULL: "https://www.googleapis.com/auth/calendar",

  // Google Docs scopes
  DOCS_READ: "https://www.googleapis.com/auth/documents.readonly",
  DOCS_FULL: "https://www.googleapis.com/auth/documents",

  // Google Sheets scopes
  SHEETS_READ: "https://www.googleapis.com/auth/spreadsheets.readonly",
  SHEETS_FULL: "https://www.googleapis.com/auth/spreadsheets",

  // Google Slides scopes
  SLIDES_READ: "https://www.googleapis.com/auth/presentations.readonly",
  SLIDES_FULL: "https://www.googleapis.com/auth/presentations",

  // Admin SDK scopes (require domain-wide delegation)
  ADMIN_DIRECTORY_USER_READ: "https://www.googleapis.com/auth/admin.directory.user.readonly",
  ADMIN_DIRECTORY_USER_FULL: "https://www.googleapis.com/auth/admin.directory.user",
  ADMIN_DIRECTORY_GROUP_READ: "https://www.googleapis.com/auth/admin.directory.group.readonly",
  ADMIN_DIRECTORY_GROUP_FULL: "https://www.googleapis.com/auth/admin.directory.group",
  ADMIN_DIRECTORY_ORGUNIT_READ: "https://www.googleapis.com/auth/admin.directory.orgunit.readonly",

  // Google Meet scopes
  MEET_SPACE_READ: "https://www.googleapis.com/auth/meetings.space.readonly",
  MEET_SPACE_FULL: "https://www.googleapis.com/auth/meetings.space.created",

  // Google Chat scopes
  CHAT_MESSAGES_READ: "https://www.googleapis.com/auth/chat.messages.readonly",
  CHAT_MESSAGES_FULL: "https://www.googleapis.com/auth/chat.messages",
  CHAT_SPACES_READ: "https://www.googleapis.com/auth/chat.spaces.readonly",

  // Google Tasks scopes
  TASKS_READ: "https://www.googleapis.com/auth/tasks.readonly",
  TASKS_FULL: "https://www.googleapis.com/auth/tasks",

  // People API scopes
  CONTACTS_READ: "https://www.googleapis.com/auth/contacts.readonly",
  CONTACTS_FULL: "https://www.googleapis.com/auth/contacts",
  DIRECTORY_READ: "https://www.googleapis.com/auth/directory.readonly",
} as const;

// =============================================================================
// SCOPE GROUPS
// =============================================================================

/**
 * Basic user identity scopes (OpenID Connect)
 */
export const IDENTITY_SCOPES: readonly string[] = [
  GOOGLE_SCOPES.OPENID,
  GOOGLE_SCOPES.EMAIL,
  GOOGLE_SCOPES.PROFILE,
];

/**
 * Default scopes for user SSO login
 * Minimal scopes needed to identify the user
 */
export const DEFAULT_USER_SCOPES: readonly string[] = [...IDENTITY_SCOPES];

/**
 * Scopes for read-only Google Drive access
 */
export const DRIVE_READ_SCOPES: readonly string[] = [GOOGLE_SCOPES.DRIVE_READ];

/**
 * Scopes for read/write Drive access (app-created files only)
 */
export const DRIVE_FILE_SCOPES: readonly string[] = [GOOGLE_SCOPES.DRIVE_FILE];

/**
 * Scopes for Gmail read access
 */
export const GMAIL_READ_SCOPES: readonly string[] = [GOOGLE_SCOPES.GMAIL_READ];

/**
 * Scopes for Gmail with send capability
 */
export const GMAIL_SEND_SCOPES: readonly string[] = [
  GOOGLE_SCOPES.GMAIL_READ,
  GOOGLE_SCOPES.GMAIL_SEND,
  GOOGLE_SCOPES.GMAIL_COMPOSE,
];

/**
 * Scopes for Calendar read access
 */
export const CALENDAR_READ_SCOPES: readonly string[] = [GOOGLE_SCOPES.CALENDAR_READ];

/**
 * Scopes for Calendar with event management
 */
export const CALENDAR_WRITE_SCOPES: readonly string[] = [GOOGLE_SCOPES.CALENDAR_EVENTS];

/**
 * Scopes for read-only access to Google Docs suite
 */
export const DOCS_READ_SCOPES: readonly string[] = [
  GOOGLE_SCOPES.DOCS_READ,
  GOOGLE_SCOPES.SHEETS_READ,
  GOOGLE_SCOPES.SLIDES_READ,
];

/**
 * Scopes for Admin SDK directory access (domain-wide delegation required)
 */
export const ADMIN_DIRECTORY_SCOPES: readonly string[] = [
  GOOGLE_SCOPES.ADMIN_DIRECTORY_USER_READ,
  GOOGLE_SCOPES.ADMIN_DIRECTORY_GROUP_READ,
];

/**
 * Full Google Workspace integration scopes
 * Used for comprehensive org-level access with domain-wide delegation
 */
export const FULL_WORKSPACE_SCOPES: readonly string[] = [
  ...IDENTITY_SCOPES,
  GOOGLE_SCOPES.DRIVE_READ,
  GOOGLE_SCOPES.GMAIL_READ,
  GOOGLE_SCOPES.GMAIL_SEND,
  GOOGLE_SCOPES.CALENDAR_READ,
  GOOGLE_SCOPES.CALENDAR_EVENTS,
  GOOGLE_SCOPES.DOCS_READ,
  GOOGLE_SCOPES.SHEETS_READ,
  GOOGLE_SCOPES.SLIDES_READ,
];

/**
 * Standard user-consent scopes for GoodTeams
 * Balanced set of permissions for typical user operations
 */
export const GOODTEAMS_USER_SCOPES: readonly string[] = [
  ...IDENTITY_SCOPES,
  GOOGLE_SCOPES.DRIVE_READ,
  GOOGLE_SCOPES.DRIVE_FILE,
  GOOGLE_SCOPES.GMAIL_READ,
  GOOGLE_SCOPES.GMAIL_SEND,
  GOOGLE_SCOPES.CALENDAR_READ,
  GOOGLE_SCOPES.CALENDAR_EVENTS,
];

// =============================================================================
// SCOPE UTILITIES
// =============================================================================

/**
 * Check if a scope requires domain-wide delegation
 */
export function requiresDomainWideDelegation(scope: string): boolean {
  return scope.includes("admin.directory");
}

/**
 * Check if a scope is a sensitive scope (may require verification)
 */
export function isSensitiveScope(scope: string): boolean {
  const sensitivePatterns = [
    "gmail.modify",
    "gmail.compose",
    "gmail.send",
    "drive/",
    "calendar/",
    "admin.directory",
  ];

  return sensitivePatterns.some(
    (pattern) => scope.includes(pattern) || scope === GOOGLE_SCOPES.DRIVE_FULL,
  );
}

/**
 * Get display name for a scope (for UI purposes)
 */
export function getScopeDisplayName(scope: string): string {
  const scopeNames: Record<string, string> = {
    [GOOGLE_SCOPES.OPENID]: "OpenID (Sign In)",
    [GOOGLE_SCOPES.EMAIL]: "Email Address",
    [GOOGLE_SCOPES.PROFILE]: "Profile Information",
    [GOOGLE_SCOPES.DRIVE_READ]: "Read Google Drive Files",
    [GOOGLE_SCOPES.DRIVE_FILE]: "Manage App Files in Drive",
    [GOOGLE_SCOPES.DRIVE_FULL]: "Full Google Drive Access",
    [GOOGLE_SCOPES.GMAIL_READ]: "Read Gmail Messages",
    [GOOGLE_SCOPES.GMAIL_SEND]: "Send Gmail Messages",
    [GOOGLE_SCOPES.GMAIL_COMPOSE]: "Compose Gmail Drafts",
    [GOOGLE_SCOPES.GMAIL_MODIFY]: "Full Gmail Access",
    [GOOGLE_SCOPES.CALENDAR_READ]: "Read Calendar Events",
    [GOOGLE_SCOPES.CALENDAR_EVENTS]: "Manage Calendar Events",
    [GOOGLE_SCOPES.CALENDAR_FULL]: "Full Calendar Access",
    [GOOGLE_SCOPES.DOCS_READ]: "Read Google Docs",
    [GOOGLE_SCOPES.SHEETS_READ]: "Read Google Sheets",
    [GOOGLE_SCOPES.SLIDES_READ]: "Read Google Slides",
    [GOOGLE_SCOPES.ADMIN_DIRECTORY_USER_READ]: "Read User Directory",
    [GOOGLE_SCOPES.ADMIN_DIRECTORY_GROUP_READ]: "Read Group Directory",
  };

  return scopeNames[scope] || scope;
}

/**
 * Validate that all scopes are valid Google API scopes
 */
export function validateScopes(scopes: string[]): { valid: boolean; invalid: string[] } {
  const validScopeValues = new Set<string>(Object.values(GOOGLE_SCOPES));
  const invalid = scopes.filter((scope) => !validScopeValues.has(scope));

  return {
    valid: invalid.length === 0,
    invalid,
  };
}

/**
 * Merge scope arrays, removing duplicates
 */
export function mergeScopes(...scopeArrays: (string[] | readonly string[])[]): string[] {
  const merged = new Set<string>();
  for (const scopes of scopeArrays) {
    for (const scope of scopes) {
      merged.add(scope);
    }
  }
  return Array.from(merged);
}
