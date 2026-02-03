/**
 * Microsoft Outlook Calendar Operations
 *
 * Calendar and event operations via Microsoft Graph API.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/resources/calendar
 */

import type { Client } from "@microsoft/microsoft-graph-client";
import type {
  Event,
  Calendar,
  ListEventsOptions,
  NewEvent,
  EventUpdate,
  PagedResponse,
} from "./types.js";

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

/** Default fields to select for events */
const DEFAULT_EVENT_SELECT = [
  "id",
  "subject",
  "bodyPreview",
  "start",
  "end",
  "location",
  "attendees",
  "organizer",
  "isAllDay",
  "isCancelled",
  "isOnlineMeeting",
  "onlineMeetingUrl",
  "showAs",
  "responseStatus",
  "importance",
  "recurrence",
];

/** Default number of items to return */
const DEFAULT_TOP = 10;

// =============================================================================
// EVENT OPERATIONS
// =============================================================================

/**
 * List calendar events
 *
 * @param client - Authenticated Graph client
 * @param options - Query options (time range, pagination)
 * @returns Array of events
 *
 * @example
 * ```typescript
 * // List upcoming events
 * const events = await listEvents(client, {
 *   startDateTime: new Date().toISOString(),
 *   endDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
 * });
 *
 * // List events from a specific calendar
 * const events = await listEvents(client, {
 *   calendarId: "calendar-id",
 *   top: 25,
 * });
 * ```
 */
export async function listEvents(
  client: Client,
  options: ListEventsOptions = {},
): Promise<Event[]> {
  const {
    calendarId,
    startDateTime,
    endDateTime,
    top = DEFAULT_TOP,
    skip,
    select = DEFAULT_EVENT_SELECT,
    orderBy = "start/dateTime",
  } = options;

  // Use calendarView endpoint if time range specified
  if (startDateTime && endDateTime) {
    const endpoint = calendarId ? `/me/calendars/${calendarId}/calendarView` : "/me/calendarView";

    let request = client
      .api(endpoint)
      .query({
        startDateTime,
        endDateTime,
      })
      .select(select)
      .top(top)
      .orderby(orderBy);

    if (skip !== undefined) {
      request = request.skip(skip);
    }

    const response: PagedResponse<Event> = await request.get();
    return response.value;
  }

  // Use events endpoint for general listing
  const endpoint = calendarId ? `/me/calendars/${calendarId}/events` : "/me/events";

  let request = client.api(endpoint).select(select).top(top).orderby(orderBy);

  if (skip !== undefined) {
    request = request.skip(skip);
  }

  const response: PagedResponse<Event> = await request.get();
  return response.value;
}

/**
 * Get a single event with full details
 *
 * @param client - Authenticated Graph client
 * @param eventId - Event ID
 * @returns Full event details
 *
 * @example
 * ```typescript
 * const event = await getEvent(client, "AAMkAGI2...");
 * console.log(event.subject, event.start?.dateTime);
 * ```
 */
export async function getEvent(client: Client, eventId: string): Promise<Event> {
  return client
    .api(`/me/events/${eventId}`)
    .select([...DEFAULT_EVENT_SELECT, "body", "sensitivity"])
    .get();
}

/**
 * Create a new calendar event
 *
 * @param client - Authenticated Graph client
 * @param event - Event details
 * @returns Created event
 *
 * @example
 * ```typescript
 * const event = await createEvent(client, {
 *   subject: "Team Meeting",
 *   start: {
 *     dateTime: "2024-01-15T14:00:00",
 *     timeZone: "America/Los_Angeles",
 *   },
 *   end: {
 *     dateTime: "2024-01-15T15:00:00",
 *     timeZone: "America/Los_Angeles",
 *   },
 *   location: { displayName: "Conference Room A" },
 *   attendees: [
 *     {
 *       emailAddress: { address: "colleague@example.com" },
 *       type: "required",
 *     },
 *   ],
 *   isOnlineMeeting: true,
 *   onlineMeetingProvider: "teamsForBusiness",
 * });
 * ```
 */
export async function createEvent(client: Client, event: NewEvent): Promise<Event> {
  const { calendarId, ...eventBody } = event;

  const endpoint = calendarId ? `/me/calendars/${calendarId}/events` : "/me/events";

  return client.api(endpoint).post(eventBody);
}

/**
 * Update an existing event
 *
 * @param client - Authenticated Graph client
 * @param eventId - Event ID
 * @param updates - Fields to update
 * @returns Updated event
 *
 * @example
 * ```typescript
 * const updated = await updateEvent(client, eventId, {
 *   subject: "Updated Meeting Title",
 *   location: { displayName: "New Location" },
 * });
 * ```
 */
export async function updateEvent(
  client: Client,
  eventId: string,
  updates: EventUpdate,
): Promise<Event> {
  return client.api(`/me/events/${eventId}`).patch(updates);
}

/**
 * Delete an event
 *
 * @param client - Authenticated Graph client
 * @param eventId - Event ID
 *
 * @example
 * ```typescript
 * await deleteEvent(client, eventId);
 * ```
 */
export async function deleteEvent(client: Client, eventId: string): Promise<void> {
  await client.api(`/me/events/${eventId}`).delete();
}

/**
 * Respond to an event invitation (RSVP)
 *
 * @param client - Authenticated Graph client
 * @param eventId - Event ID
 * @param response - Response type: accept, decline, or tentative
 * @param comment - Optional comment with response
 * @param sendResponse - Whether to send response to organizer (default: true)
 *
 * @example
 * ```typescript
 * await respondToEvent(client, eventId, "accept");
 * await respondToEvent(client, eventId, "decline", "I have a conflict");
 * await respondToEvent(client, eventId, "tentative", "Will confirm later");
 * ```
 */
export async function respondToEvent(
  client: Client,
  eventId: string,
  response: "accept" | "decline" | "tentative",
  comment?: string,
  sendResponse = true,
): Promise<void> {
  await client.api(`/me/events/${eventId}/${response}`).post({
    comment: comment || "",
    sendResponse,
  });
}

/**
 * Cancel an event (as organizer)
 *
 * @param client - Authenticated Graph client
 * @param eventId - Event ID
 * @param comment - Optional cancellation message
 *
 * @example
 * ```typescript
 * await cancelEvent(client, eventId, "Meeting postponed to next week");
 * ```
 */
export async function cancelEvent(
  client: Client,
  eventId: string,
  comment?: string,
): Promise<void> {
  await client.api(`/me/events/${eventId}/cancel`).post({
    comment: comment || "",
  });
}

// =============================================================================
// CALENDAR OPERATIONS
// =============================================================================

/**
 * List user's calendars
 *
 * @param client - Authenticated Graph client
 * @returns Array of calendars
 *
 * @example
 * ```typescript
 * const calendars = await listCalendars(client);
 * const defaultCal = calendars.find(c => c.isDefaultCalendar);
 * ```
 */
export async function listCalendars(client: Client): Promise<Calendar[]> {
  const response: PagedResponse<Calendar> = await client
    .api("/me/calendars")
    .select(["id", "name", "color", "canEdit", "canViewPrivateItems", "isDefaultCalendar", "owner"])
    .get();

  return response.value;
}

/**
 * Get a specific calendar
 *
 * @param client - Authenticated Graph client
 * @param calendarId - Calendar ID
 * @returns Calendar details
 */
export async function getCalendar(client: Client, calendarId: string): Promise<Calendar> {
  return client
    .api(`/me/calendars/${calendarId}`)
    .select(["id", "name", "color", "canEdit", "canViewPrivateItems", "isDefaultCalendar", "owner"])
    .get();
}

/**
 * Create a new calendar
 *
 * @param client - Authenticated Graph client
 * @param name - Calendar name
 * @param color - Optional calendar color
 * @returns Created calendar
 *
 * @example
 * ```typescript
 * const calendar = await createCalendar(client, "Project Calendar", "lightBlue");
 * ```
 */
export async function createCalendar(
  client: Client,
  name: string,
  color?: string,
): Promise<Calendar> {
  const body: Record<string, string> = { name };
  if (color) {
    body.color = color;
  }

  return client.api("/me/calendars").post(body);
}

/**
 * Delete a calendar
 *
 * @param client - Authenticated Graph client
 * @param calendarId - Calendar ID
 */
export async function deleteCalendar(client: Client, calendarId: string): Promise<void> {
  await client.api(`/me/calendars/${calendarId}`).delete();
}

// =============================================================================
// SCHEDULING UTILITIES
// =============================================================================

/**
 * Find available meeting times
 *
 * @param client - Authenticated Graph client
 * @param attendees - Email addresses of attendees
 * @param timeConstraint - Time window to search
 * @param duration - Meeting duration in minutes
 * @returns Available time slots
 *
 * @example
 * ```typescript
 * const slots = await findMeetingTimes(
 *   client,
 *   ["person1@example.com", "person2@example.com"],
 *   {
 *     startDateTime: "2024-01-15T09:00:00",
 *     endDateTime: "2024-01-15T17:00:00",
 *     timeZone: "America/Los_Angeles",
 *   },
 *   30
 * );
 * ```
 */
export async function findMeetingTimes(
  client: Client,
  attendees: string[],
  timeConstraint: {
    startDateTime: string;
    endDateTime: string;
    timeZone: string;
  },
  duration: number,
): Promise<MeetingTimeSuggestion[]> {
  const response = await client.api("/me/findMeetingTimes").post({
    attendees: attendees.map((email) => ({
      emailAddress: { address: email },
      type: "required",
    })),
    timeConstraint: {
      activityDomain: "work",
      timeSlots: [
        {
          start: {
            dateTime: timeConstraint.startDateTime,
            timeZone: timeConstraint.timeZone,
          },
          end: {
            dateTime: timeConstraint.endDateTime,
            timeZone: timeConstraint.timeZone,
          },
        },
      ],
    },
    meetingDuration: `PT${duration}M`,
  });

  return response.meetingTimeSuggestions || [];
}

/**
 * Meeting time suggestion from findMeetingTimes
 */
export interface MeetingTimeSuggestion {
  confidence: number;
  organizerAvailability: string;
  meetingTimeSlot: {
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
  };
  attendeeAvailability?: Array<{
    attendee: { emailAddress: { address: string; name?: string } };
    availability: string;
  }>;
}

/**
 * Get free/busy schedule for attendees
 *
 * @param client - Authenticated Graph client
 * @param schedules - Email addresses to check
 * @param startTime - Start of time range
 * @param endTime - End of time range
 * @param timeZone - Time zone
 * @returns Schedule information for each attendee
 */
export async function getSchedule(
  client: Client,
  schedules: string[],
  startTime: string,
  endTime: string,
  timeZone: string,
): Promise<ScheduleInformation[]> {
  const response = await client.api("/me/calendar/getSchedule").post({
    schedules,
    startTime: { dateTime: startTime, timeZone },
    endTime: { dateTime: endTime, timeZone },
  });

  return response.value || [];
}

/**
 * Schedule information from getSchedule
 */
export interface ScheduleInformation {
  scheduleId: string;
  availabilityView: string;
  scheduleItems?: Array<{
    status: "free" | "tentative" | "busy" | "oof" | "workingElsewhere" | "unknown";
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    subject?: string;
    location?: string;
    isPrivate?: boolean;
  }>;
}
