/**
 * Google Calendar Integration
 *
 * Calendar and event operations via Google Calendar API v3.
 *
 * @example
 * ```typescript
 * import { GoogleCalendarClient } from './calendar';
 *
 * const client = new GoogleCalendarClient({ auth: oauth2Client });
 *
 * // List upcoming events
 * const events = await client.listEvents({
 *   timeMin: new Date(),
 *   singleEvents: true,
 *   orderBy: 'startTime',
 * });
 *
 * // Create an event
 * const event = await client.createEvent({
 *   summary: 'Team Meeting',
 *   start: new Date('2024-01-15T10:00:00'),
 *   end: new Date('2024-01-15T11:00:00'),
 * });
 * ```
 */

// =============================================================================
// CLIENT EXPORT
// =============================================================================

export { GoogleCalendarClient } from "./client.js";

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type {
  // Calendar types
  Calendar,
  CalendarAccessRole,
  CalendarListEntry,
  CalendarList,
  // Event types
  CalendarEvent,
  EventStatus,
  EventDateTime,
  EventOrganizer,
  EventCreator,
  Attendee,
  ResponseStatus,
  EventReminder,
  EventReminders,
  EventVisibility,
  EventTransparency,
  ConferenceData,
  EventAttachment,
  // List types
  EventList,
  ListEventsOptions,
  // Input types
  EventInput,
  CreateEventOptions,
  UpdateEventOptions,
  // Free/busy types
  TimePeriod,
  FreeBusyCalendar,
  FreeBusyResponse,
  // Auth types
  GoogleAuthClient,
  GoogleServiceAccount,
  CalendarClientOptions,
  // Error types
  CalendarApiError,
} from "./types.js";
