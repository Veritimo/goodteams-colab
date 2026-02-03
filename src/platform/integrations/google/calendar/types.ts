/**
 * Google Calendar Integration Types
 *
 * TypeScript interfaces for Calendar and Event operations.
 * Based on Google Calendar API v3.
 *
 * @see https://developers.google.com/calendar/api/v3/reference
 */

// =============================================================================
// CALENDAR TYPES
// =============================================================================

/**
 * Access role for a calendar
 */
export type CalendarAccessRole = "owner" | "writer" | "reader" | "freeBusyReader";

/**
 * Calendar resource
 */
export interface Calendar {
  /** Calendar ID (usually an email address for user calendars) */
  id: string;
  /** Title of the calendar */
  summary: string;
  /** Description of the calendar */
  description?: string;
  /** The time zone of the calendar */
  timeZone: string;
  /** Whether this is the primary calendar for the authenticated user */
  primary?: boolean;
  /** The effective access role of the authenticated user */
  accessRole: CalendarAccessRole;
  /** Background color of the calendar */
  backgroundColor?: string;
  /** Foreground color of the calendar */
  foregroundColor?: string;
  /** Whether the calendar is selected (visible in UI) */
  selected?: boolean;
  /** Whether the calendar content shows up in the calendar UI */
  hidden?: boolean;
}

/**
 * Calendar list entry (calendar metadata as seen in calendar list)
 */
export interface CalendarListEntry extends Calendar {
  /** The color ID for the calendar */
  colorId?: string;
  /** Whether the calendar has been hidden from the list */
  deleted?: boolean;
  /** Default reminders for this calendar */
  defaultReminders?: EventReminder[];
  /** Notification settings for this calendar */
  notificationSettings?: {
    notifications: Array<{
      type: "eventCreation" | "eventChange" | "eventCancellation" | "eventResponse" | "agenda";
      method: "email" | "popup";
    }>;
  };
  /** ETag for cache validation */
  etag?: string;
}

// =============================================================================
// EVENT TYPES
// =============================================================================

/**
 * Event status
 */
export type EventStatus = "confirmed" | "tentative" | "cancelled";

/**
 * Response status for attendees
 */
export type ResponseStatus = "needsAction" | "declined" | "tentative" | "accepted";

/**
 * Visibility setting for events
 */
export type EventVisibility = "default" | "public" | "private" | "confidential";

/**
 * Event transparency (affects free/busy)
 */
export type EventTransparency = "opaque" | "transparent";

/**
 * Date/time specification for events
 */
export interface EventDateTime {
  /** ISO 8601 date-time for timed events */
  dateTime?: string;
  /** Date in YYYY-MM-DD format for all-day events */
  date?: string;
  /** Time zone (Olson format, e.g., "America/Los_Angeles") */
  timeZone?: string;
}

/**
 * Event organizer information
 */
export interface EventOrganizer {
  /** Email address of the organizer */
  email: string;
  /** Display name of the organizer */
  displayName?: string;
  /** Whether this is the authenticated user */
  self?: boolean;
}

/**
 * Event creator information
 */
export interface EventCreator {
  /** Email address of the creator */
  email: string;
  /** Display name of the creator */
  displayName?: string;
  /** Whether this is the authenticated user */
  self?: boolean;
}

/**
 * Event attendee
 */
export interface Attendee {
  /** Email address of the attendee */
  email: string;
  /** Display name of the attendee */
  displayName?: string;
  /** Whether this is the authenticated user */
  self?: boolean;
  /** Whether this is a resource (room, etc.) */
  resource?: boolean;
  /** Whether the attendee is optional */
  optional?: boolean;
  /** The attendee's response status */
  responseStatus: ResponseStatus;
  /** Attendee's comment */
  comment?: string;
  /** Number of additional guests */
  additionalGuests?: number;
}

/**
 * Event reminder
 */
export interface EventReminder {
  /** Reminder method */
  method: "email" | "popup";
  /** Minutes before the event */
  minutes: number;
}

/**
 * Event reminders configuration
 */
export interface EventReminders {
  /** Whether to use default reminders from calendar settings */
  useDefault: boolean;
  /** Custom reminder overrides (if useDefault is false) */
  overrides?: EventReminder[];
}

/**
 * Conference data (Google Meet, etc.)
 */
export interface ConferenceData {
  /** Type of conference */
  conferenceType?: string;
  /** Conference ID */
  conferenceId?: string;
  /** Entry points (links, phone numbers) */
  entryPoints?: Array<{
    entryPointType: "video" | "phone" | "sip" | "more";
    uri: string;
    label?: string;
    pin?: string;
    accessCode?: string;
    meetingCode?: string;
    password?: string;
    regionCode?: string;
  }>;
  /** Conference solution */
  conferenceSolution?: {
    key: { type: string };
    name: string;
    iconUri?: string;
  };
  /** Notes about the conference */
  notes?: string;
}

/**
 * Event attachment
 */
export interface EventAttachment {
  /** URL link to the attachment */
  fileUrl: string;
  /** Title of the attachment */
  title: string;
  /** MIME type */
  mimeType?: string;
  /** Icon link */
  iconLink?: string;
  /** File ID (for Google Drive attachments) */
  fileId?: string;
}

/**
 * Calendar event
 */
export interface CalendarEvent {
  /** Event ID */
  id: string;
  /** Event summary/title */
  summary: string;
  /** Event description */
  description?: string;
  /** Geographic location as free-form text */
  location?: string;
  /** Start date/time */
  start: EventDateTime;
  /** End date/time */
  end: EventDateTime;
  /** Event attendees */
  attendees?: Attendee[];
  /** Event organizer */
  organizer?: EventOrganizer;
  /** Event creator */
  creator?: EventCreator;
  /** Event status */
  status: EventStatus;
  /** Link to the event in Google Calendar */
  htmlLink: string;
  /** Creation timestamp */
  created: string;
  /** Last modification timestamp */
  updated: string;
  /** Recurrence rules (RRULE, EXRULE, RDATE, EXDATE) */
  recurrence?: string[];
  /** For recurring event instances, ID of the recurring event */
  recurringEventId?: string;
  /** Original start time (for recurring event instances) */
  originalStartTime?: EventDateTime;
  /** Event visibility */
  visibility?: EventVisibility;
  /** Event transparency (free/busy) */
  transparency?: EventTransparency;
  /** Calendar ID where event is stored */
  calendarId?: string;
  /** Whether attendees can invite others */
  guestsCanInviteOthers?: boolean;
  /** Whether attendees can modify the event */
  guestsCanModify?: boolean;
  /** Whether attendees can see other attendees */
  guestsCanSeeOtherGuests?: boolean;
  /** Event reminders */
  reminders?: EventReminders;
  /** Conference data (Google Meet) */
  conferenceData?: ConferenceData;
  /** Event attachments */
  attachments?: EventAttachment[];
  /** iCalendar UID */
  iCalUID?: string;
  /** Sequence number for updates */
  sequence?: number;
  /** Extended properties */
  extendedProperties?: {
    private?: Record<string, string>;
    shared?: Record<string, string>;
  };
  /** Event color ID */
  colorId?: string;
  /** Whether this is an all-day event */
  isAllDay?: boolean;
  /** ETag for cache validation */
  etag?: string;
}

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

/**
 * Paginated list of events
 */
export interface EventList {
  /** Array of events */
  items: CalendarEvent[];
  /** Token for fetching the next page */
  nextPageToken?: string;
  /** Sync token for incremental sync */
  nextSyncToken?: string;
  /** Summary of the calendar */
  summary?: string;
  /** Description of the calendar */
  description?: string;
  /** Time zone of the calendar */
  timeZone?: string;
  /** Access role for the calendar */
  accessRole?: CalendarAccessRole;
  /** ETag for cache validation */
  etag?: string;
}

/**
 * Paginated list of calendars
 */
export interface CalendarList {
  /** Array of calendars */
  items: CalendarListEntry[];
  /** Token for fetching the next page */
  nextPageToken?: string;
  /** Sync token for incremental sync */
  nextSyncToken?: string;
  /** ETag for cache validation */
  etag?: string;
}

/**
 * Options for listing events
 */
export interface ListEventsOptions {
  /** Calendar ID (default: 'primary') */
  calendarId?: string;
  /** Lower bound for event start time */
  timeMin?: Date;
  /** Upper bound for event start time */
  timeMax?: Date;
  /** Maximum number of events to return */
  maxResults?: number;
  /** Token for pagination */
  pageToken?: string;
  /** Whether to expand recurring events into instances */
  singleEvents?: boolean;
  /** Sort order */
  orderBy?: "startTime" | "updated";
  /** Search query (free text search) */
  q?: string;
  /** Filter by updated time */
  updatedMin?: Date;
  /** Whether to show deleted events */
  showDeleted?: boolean;
  /** Whether to show hidden invitations */
  showHiddenInvitations?: boolean;
  /** Sync token for incremental sync */
  syncToken?: string;
  /** Time zone for response (defaults to calendar time zone) */
  timeZone?: string;
}

/**
 * Input for creating/updating events
 */
export interface EventInput {
  /** Event summary/title */
  summary: string;
  /** Event description */
  description?: string;
  /** Geographic location */
  location?: string;
  /** Start date/time (Date for timed events, {date: string} for all-day) */
  start: Date | { date: string };
  /** End date/time (Date for timed events, {date: string} for all-day) */
  end: Date | { date: string };
  /** Attendee email addresses */
  attendees?: string[];
  /** Event reminders */
  reminders?: EventReminders;
  /** Recurrence rules (RRULE strings) */
  recurrence?: string[];
  /** Event visibility */
  visibility?: EventVisibility;
  /** Event transparency */
  transparency?: EventTransparency;
  /** Time zone for the event */
  timeZone?: string;
  /** Whether to send notifications to attendees */
  sendUpdates?: "all" | "externalOnly" | "none";
  /** Whether to create a Google Meet conference */
  conferenceDataVersion?: 0 | 1;
  /** Extended properties */
  extendedProperties?: {
    private?: Record<string, string>;
    shared?: Record<string, string>;
  };
  /** Event color ID */
  colorId?: string;
  /** Whether attendees can invite others */
  guestsCanInviteOthers?: boolean;
  /** Whether attendees can modify the event */
  guestsCanModify?: boolean;
  /** Whether attendees can see other attendees */
  guestsCanSeeOtherGuests?: boolean;
}

/**
 * Options for creating events
 */
export interface CreateEventOptions extends EventInput {
  /** Calendar ID (default: 'primary') */
  calendarId?: string;
}

/**
 * Options for updating events
 */
export type UpdateEventOptions = Partial<EventInput>;

// =============================================================================
// FREE/BUSY TYPES
// =============================================================================

/**
 * Time period for free/busy queries
 */
export interface TimePeriod {
  /** Start of the period */
  start: string;
  /** End of the period */
  end: string;
}

/**
 * Free/busy information for a single calendar
 */
export interface FreeBusyCalendar {
  /** Busy periods */
  busy: TimePeriod[];
  /** Errors for this calendar */
  errors?: Array<{
    domain: string;
    reason: string;
  }>;
}

/**
 * Free/busy query response
 */
export interface FreeBusyResponse {
  /** Start of the query time range */
  timeMin: string;
  /** End of the query time range */
  timeMax: string;
  /** Free/busy information keyed by calendar ID */
  calendars: Record<string, FreeBusyCalendar>;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Google Calendar API error
 */
export interface CalendarApiError {
  /** Error code */
  code: number;
  /** Error message */
  message: string;
  /** Error details */
  errors?: Array<{
    domain: string;
    reason: string;
    message: string;
    locationType?: string;
    location?: string;
  }>;
  /** HTTP status */
  status?: string;
}

// =============================================================================
// AUTH TYPES (for client options)
// =============================================================================

/**
 * Google OAuth2 client interface
 */
export interface GoogleAuthClient {
  /** Get access token */
  getAccessToken(): Promise<{ token: string | null | undefined }>;
  /** Set credentials */
  setCredentials(credentials: {
    access_token?: string;
    refresh_token?: string;
    expiry_date?: number;
  }): void;
}

/**
 * Google service account interface (for domain-wide delegation)
 */
export interface GoogleServiceAccount {
  /** Authorize with optional subject impersonation */
  authorize(): Promise<void>;
  /** Get access token */
  getAccessToken(): Promise<{ token: string | null | undefined }>;
}

/**
 * Calendar client options
 */
export interface CalendarClientOptions {
  /** OAuth2 client or service account */
  auth: GoogleAuthClient | GoogleServiceAccount;
  /** User email for impersonation (with service account) */
  userEmail?: string;
  /** Default time zone */
  defaultTimeZone?: string;
  /** API base URL (for testing) */
  baseUrl?: string;
}
