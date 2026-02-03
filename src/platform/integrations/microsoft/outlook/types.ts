/**
 * Microsoft Outlook Integration Types
 *
 * TypeScript interfaces for Mail, Calendar, and Contacts operations.
 * These are simplified types for our integration layer, inspired by but not
 * directly extending @microsoft/microsoft-graph-types for flexibility.
 */

// =============================================================================
// COMMON TYPES
// =============================================================================

/**
 * Email address with optional name
 */
export interface EmailAddress {
  address?: string;
  name?: string;
}

/**
 * Physical/postal address
 */
export interface PhysicalAddress {
  street?: string;
  city?: string;
  state?: string;
  countryOrRegion?: string;
  postalCode?: string;
}

/**
 * Email/calendar body content
 */
export interface ItemBody {
  contentType?: "text" | "html";
  content?: string;
}

/**
 * Recipient with email address
 */
export interface Recipient {
  emailAddress?: EmailAddress;
}

/**
 * Date/time with timezone
 */
export interface DateTimeTimeZone {
  dateTime?: string;
  timeZone?: string;
}

/**
 * Location for events
 */
export interface Location {
  displayName?: string;
  address?: PhysicalAddress;
  coordinates?: {
    latitude?: number;
    longitude?: number;
  };
}

// =============================================================================
// MAIL TYPES
// =============================================================================

/**
 * Email message
 */
export interface Message {
  id: string;
  subject?: string;
  body?: ItemBody;
  bodyPreview?: string;
  from?: Recipient;
  toRecipients?: Recipient[];
  ccRecipients?: Recipient[];
  bccRecipients?: Recipient[];
  receivedDateTime?: string;
  sentDateTime?: string;
  hasAttachments?: boolean;
  isRead?: boolean;
  isDraft?: boolean;
  importance?: "low" | "normal" | "high";
  conversationId?: string;
  parentFolderId?: string;
  webLink?: string;
}

/**
 * Attachment with download information
 */
export interface Attachment {
  id: string;
  "@odata.type"?: string;
  name?: string;
  contentType?: string;
  size?: number;
  isInline?: boolean;
  contentId?: string;
  contentBytes?: string; // Base64 encoded content for file attachments
}

/**
 * Mail folder information
 */
export interface MailFolder {
  id: string;
  displayName?: string;
  parentFolderId?: string;
  childFolderCount?: number;
  unreadItemCount?: number;
  totalItemCount?: number;
}

/**
 * Options for listing messages
 */
export interface ListMessagesOptions {
  /** Folder ID to list from (defaults to inbox) */
  folderId?: string;
  /** Number of messages to return (default: 10, max: 999) */
  top?: number;
  /** Number of messages to skip for pagination */
  skip?: number;
  /** OData filter expression */
  filter?: string;
  /** Search query string (searches subject, body, sender) */
  search?: string;
  /** Fields to select (default: common fields) */
  select?: string[];
  /** Sort order (default: receivedDateTime desc) */
  orderBy?: string;
}

/**
 * New message for sending
 */
export interface NewMessage {
  /** Email subject */
  subject: string;
  /** Message body */
  body: {
    contentType: "text" | "html";
    content: string;
  };
  /** Recipients */
  toRecipients: EmailRecipient[];
  /** CC recipients */
  ccRecipients?: EmailRecipient[];
  /** BCC recipients */
  bccRecipients?: EmailRecipient[];
  /** Message importance */
  importance?: "low" | "normal" | "high";
  /** Attachments */
  attachments?: NewAttachment[];
  /** Save to sent items (default: true) */
  saveToSentItems?: boolean;
}

/**
 * Simplified email recipient
 */
export interface EmailRecipient {
  emailAddress: {
    address: string;
    name?: string;
  };
}

/**
 * New attachment for sending
 */
export interface NewAttachment {
  /** File name */
  name: string;
  /** Content type (MIME) */
  contentType: string;
  /** Base64 encoded content */
  contentBytes: string;
}

// =============================================================================
// CALENDAR TYPES
// =============================================================================

/**
 * Day of week for recurrence
 */
export type DayOfWeek =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

/**
 * Calendar event
 */
export interface Event {
  id: string;
  subject?: string;
  body?: ItemBody;
  bodyPreview?: string;
  start?: DateTimeTimeZone;
  end?: DateTimeTimeZone;
  location?: Location;
  attendees?: EventAttendee[];
  organizer?: Recipient;
  isAllDay?: boolean;
  isCancelled?: boolean;
  isOnlineMeeting?: boolean;
  onlineMeetingUrl?: string;
  recurrence?: EventRecurrence;
  responseStatus?: ResponseStatus;
  showAs?: "free" | "tentative" | "busy" | "oof" | "workingElsewhere" | "unknown";
  importance?: "low" | "normal" | "high";
  sensitivity?: "normal" | "personal" | "private" | "confidential";
  webLink?: string;
}

/**
 * Calendar color options
 */
export type CalendarColor =
  | "auto"
  | "lightBlue"
  | "lightGreen"
  | "lightOrange"
  | "lightGray"
  | "lightYellow"
  | "lightTeal"
  | "lightPink"
  | "lightBrown"
  | "lightRed"
  | "maxColor";

/**
 * Calendar with display information
 */
export interface Calendar {
  id: string;
  name?: string;
  color?: CalendarColor;
  canEdit?: boolean;
  canViewPrivateItems?: boolean;
  isDefaultCalendar?: boolean;
  owner?: EmailAddress;
}

/**
 * Event attendee
 */
export interface EventAttendee {
  emailAddress?: EmailAddress;
  type?: "required" | "optional" | "resource";
  status?: ResponseStatus;
}

/**
 * Response status for events
 */
export interface ResponseStatus {
  response?:
    | "none"
    | "organizer"
    | "tentativelyAccepted"
    | "accepted"
    | "declined"
    | "notResponded";
  time?: string;
}

/**
 * Event recurrence pattern
 */
export interface EventRecurrence {
  pattern?: RecurrencePattern;
  range?: RecurrenceRange;
}

/**
 * Recurrence pattern details
 */
export interface RecurrencePattern {
  type?:
    | "daily"
    | "weekly"
    | "absoluteMonthly"
    | "relativeMonthly"
    | "absoluteYearly"
    | "relativeYearly";
  interval?: number;
  daysOfWeek?: DayOfWeek[];
  dayOfMonth?: number;
  month?: number;
  firstDayOfWeek?: DayOfWeek;
}

/**
 * Recurrence range
 */
export interface RecurrenceRange {
  type?: "endDate" | "noEnd" | "numbered";
  startDate?: string;
  endDate?: string;
  numberOfOccurrences?: number;
}

/**
 * Options for listing events
 */
export interface ListEventsOptions {
  /** Calendar ID (defaults to primary calendar) */
  calendarId?: string;
  /** Start of time range (ISO 8601) */
  startDateTime?: string;
  /** End of time range (ISO 8601) */
  endDateTime?: string;
  /** Number of events to return (default: 10, max: 999) */
  top?: number;
  /** Number of events to skip for pagination */
  skip?: number;
  /** Fields to select */
  select?: string[];
  /** Sort order (default: start/dateTime) */
  orderBy?: string;
}

/**
 * New event for creation
 */
export interface NewEvent {
  /** Event subject/title */
  subject: string;
  /** Event body/description */
  body?: {
    contentType: "text" | "html";
    content: string;
  };
  /** Start time */
  start: {
    dateTime: string;
    timeZone: string;
  };
  /** End time */
  end: {
    dateTime: string;
    timeZone: string;
  };
  /** Location */
  location?: {
    displayName: string;
    address?: PhysicalAddress;
  };
  /** Attendees */
  attendees?: EventAttendee[];
  /** All-day event */
  isAllDay?: boolean;
  /** Create online meeting link */
  isOnlineMeeting?: boolean;
  /** Online meeting provider */
  onlineMeetingProvider?: "teamsForBusiness" | "skypeForBusiness" | "skypeForConsumer";
  /** Show as status */
  showAs?: "free" | "tentative" | "busy" | "oof" | "workingElsewhere";
  /** Recurrence pattern */
  recurrence?: EventRecurrence;
  /** Calendar ID to create in */
  calendarId?: string;
}

/**
 * Event update payload
 */
export type EventUpdate = Partial<Omit<NewEvent, "calendarId">>;

// =============================================================================
// CONTACTS TYPES
// =============================================================================

/**
 * Contact information
 */
export interface Contact {
  id: string;
  displayName?: string;
  givenName?: string;
  surname?: string;
  middleName?: string;
  nickName?: string;
  emailAddresses?: EmailAddress[];
  businessPhones?: string[];
  homePhones?: string[];
  mobilePhone?: string;
  businessAddress?: PhysicalAddress;
  homeAddress?: PhysicalAddress;
  companyName?: string;
  department?: string;
  jobTitle?: string;
  birthday?: string;
  personalNotes?: string;
}

/**
 * Options for listing contacts
 */
export interface ListContactsOptions {
  /** Contact folder ID */
  folderId?: string;
  /** Number of contacts to return (default: 10, max: 999) */
  top?: number;
  /** Number of contacts to skip for pagination */
  skip?: number;
  /** Fields to select */
  select?: string[];
  /** Sort order (default: displayName) */
  orderBy?: string;
  /** Filter expression */
  filter?: string;
}

/**
 * New contact for creation
 */
export interface NewContact {
  /** Display name */
  displayName?: string;
  /** First name */
  givenName: string;
  /** Last name */
  surname?: string;
  /** Middle name */
  middleName?: string;
  /** Nickname */
  nickName?: string;
  /** Email addresses */
  emailAddresses?: EmailAddress[];
  /** Business phone numbers */
  businessPhones?: string[];
  /** Home phone numbers */
  homePhones?: string[];
  /** Mobile phone */
  mobilePhone?: string;
  /** Business address */
  businessAddress?: PhysicalAddress;
  /** Home address */
  homeAddress?: PhysicalAddress;
  /** Company name */
  companyName?: string;
  /** Department */
  department?: string;
  /** Job title */
  jobTitle?: string;
  /** Birthday (YYYY-MM-DD) */
  birthday?: string;
  /** Personal notes */
  personalNotes?: string;
}

/**
 * Contact update payload
 */
export type ContactUpdate = Partial<NewContact>;

// =============================================================================
// COMMON API TYPES
// =============================================================================

/**
 * Paginated response wrapper
 */
export interface PagedResponse<T> {
  value: T[];
  "@odata.nextLink"?: string;
  "@odata.count"?: number;
}

/**
 * Error response from Graph API
 */
export interface GraphError {
  code: string;
  message: string;
  innerError?: {
    code?: string;
    date?: string;
    "request-id"?: string;
    "client-request-id"?: string;
  };
}
