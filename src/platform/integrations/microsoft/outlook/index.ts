/**
 * Microsoft Outlook Integration
 *
 * Mail, Calendar, and Contacts operations via Microsoft Graph API.
 *
 * @example
 * ```typescript
 * import { mail, calendar, contacts } from './outlook';
 *
 * // List recent emails
 * const messages = await mail.listMessages(client, { top: 10 });
 *
 * // Get upcoming events
 * const events = await calendar.listEvents(client, {
 *   startDateTime: new Date().toISOString(),
 *   endDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
 * });
 *
 * // Search contacts
 * const contacts = await contacts.searchContacts(client, 'John');
 * ```
 */

// =============================================================================
// MAIL EXPORTS
// =============================================================================

export {
  listMessages,
  getMessage,
  getAttachments,
  downloadAttachment,
  sendMail,
  replyToMessage,
  forwardMessage,
  deleteMessage,
  moveMessage,
  markAsRead,
  listFolders,
  getFolder,
  createFolder,
} from "./mail.js";

// =============================================================================
// CALENDAR EXPORTS
// =============================================================================

export {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  respondToEvent,
  cancelEvent,
  listCalendars,
  getCalendar,
  createCalendar,
  deleteCalendar,
  findMeetingTimes,
  getSchedule,
} from "./calendar.js";

export type { MeetingTimeSuggestion, ScheduleInformation } from "./calendar.js";

// =============================================================================
// CONTACTS EXPORTS
// =============================================================================

export {
  listContacts,
  getContact,
  searchContacts,
  findContactByEmail,
  createContact,
  updateContact,
  deleteContact,
  listContactFolders,
  createContactFolder,
  deleteContactFolder,
  getContactPhoto,
  updateContactPhoto,
} from "./contacts.js";

export type { ContactFolder } from "./contacts.js";

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type {
  // Mail types
  Message,
  Attachment,
  MailFolder,
  ListMessagesOptions,
  NewMessage,
  EmailRecipient,
  NewAttachment,
  // Calendar types
  Event,
  Calendar,
  CalendarColor,
  DayOfWeek,
  ListEventsOptions,
  NewEvent,
  EventUpdate,
  EventAttendee,
  ResponseStatus,
  EventRecurrence,
  RecurrencePattern,
  RecurrenceRange,
  // Contact types
  Contact,
  ListContactsOptions,
  NewContact,
  ContactUpdate,
  // Common types
  PagedResponse,
  GraphError,
  EmailAddress,
  PhysicalAddress,
  ItemBody,
  Recipient,
  DateTimeTimeZone,
  Location,
} from "./types.js";

// =============================================================================
// NAMESPACED EXPORTS
// =============================================================================

import * as calendar from "./calendar.js";
import * as contacts from "./contacts.js";
import * as mail from "./mail.js";

export { mail, calendar, contacts };
