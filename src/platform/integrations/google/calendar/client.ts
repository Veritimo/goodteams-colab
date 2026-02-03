/**
 * Google Calendar Client
 *
 * Calendar and event operations via Google Calendar API v3.
 *
 * @see https://developers.google.com/calendar/api/v3/reference
 */

import type {
  Calendar,
  CalendarListEntry,
  CalendarList,
  CalendarEvent,
  EventList,
  ListEventsOptions,
  CreateEventOptions,
  UpdateEventOptions,
  EventDateTime,
  FreeBusyResponse,
  CalendarClientOptions,
  GoogleAuthClient,
  GoogleServiceAccount,
} from "./types.js";

// =============================================================================
// CONSTANTS
// =============================================================================

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";
const DEFAULT_CALENDAR_ID = "primary";
const DEFAULT_MAX_RESULTS = 250;

// =============================================================================
// CLIENT CLASS
// =============================================================================

/**
 * Google Calendar API client
 *
 * @example
 * ```typescript
 * const client = new GoogleCalendarClient({
 *   auth: oauth2Client,
 * });
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
 *   attendees: ['alice@example.com', 'bob@example.com'],
 * });
 * ```
 */
export class GoogleCalendarClient {
  private auth: GoogleAuthClient | GoogleServiceAccount;
  private userEmail?: string;
  private defaultTimeZone: string;
  private baseUrl: string;

  constructor(options: CalendarClientOptions) {
    this.auth = options.auth;
    this.userEmail = options.userEmail;
    this.defaultTimeZone = options.defaultTimeZone ?? "UTC";
    this.baseUrl = options.baseUrl ?? CALENDAR_API_BASE;
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Get authorization header
   */
  private async getAuthHeader(): Promise<string> {
    const { token } = await this.auth.getAccessToken();
    if (!token) {
      throw new Error("Failed to obtain access token");
    }
    return `Bearer ${token}`;
  }

  /**
   * Make an authenticated API request
   */
  private async request<T>(
    method: string,
    path: string,
    options: {
      params?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
    } = {},
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    // Add query parameters
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      Authorization: await this.getAuthHeader(),
      "Content-Type": "application/json",
    };

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const message = error.error?.message || `HTTP ${response.status}`;
      throw new Error(`Google Calendar API error: ${message}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  /**
   * Convert Date or date string to EventDateTime
   */
  private toEventDateTime(value: Date | { date: string }, timeZone?: string): EventDateTime {
    if (value instanceof Date) {
      return {
        dateTime: value.toISOString(),
        timeZone: timeZone ?? this.defaultTimeZone,
      };
    }
    // All-day event
    return { date: value.date };
  }

  /**
   * Encode calendar ID for URL
   */
  private encodeCalendarId(calendarId: string): string {
    return encodeURIComponent(calendarId);
  }

  // ===========================================================================
  // CALENDAR OPERATIONS
  // ===========================================================================

  /**
   * List calendars available to the user
   *
   * @returns Array of calendars
   *
   * @example
   * ```typescript
   * const calendars = await client.listCalendars();
   * const primary = calendars.find(c => c.primary);
   * ```
   */
  async listCalendars(): Promise<Calendar[]> {
    const response = await this.request<CalendarList>("GET", "/users/me/calendarList", {
      params: {
        maxResults: DEFAULT_MAX_RESULTS,
      },
    });

    return (response.items || []).map((entry) => this.calendarListEntryToCalendar(entry));
  }

  /**
   * Get a specific calendar
   *
   * @param calendarId - Calendar ID (or 'primary' for the user's primary calendar)
   * @returns Calendar details
   *
   * @example
   * ```typescript
   * const calendar = await client.getCalendar('primary');
   * console.log(calendar.timeZone);
   * ```
   */
  async getCalendar(calendarId: string): Promise<Calendar> {
    const entry = await this.request<CalendarListEntry>(
      "GET",
      `/users/me/calendarList/${this.encodeCalendarId(calendarId)}`,
    );

    return this.calendarListEntryToCalendar(entry);
  }

  /**
   * Convert CalendarListEntry to Calendar
   */
  private calendarListEntryToCalendar(entry: CalendarListEntry): Calendar {
    return {
      id: entry.id,
      summary: entry.summary,
      description: entry.description,
      timeZone: entry.timeZone,
      primary: entry.primary,
      accessRole: entry.accessRole,
      backgroundColor: entry.backgroundColor,
      foregroundColor: entry.foregroundColor,
      selected: entry.selected,
      hidden: entry.hidden,
    };
  }

  // ===========================================================================
  // EVENT OPERATIONS
  // ===========================================================================

  /**
   * List events from a calendar
   *
   * @param options - Query options
   * @returns Paginated list of events
   *
   * @example
   * ```typescript
   * // List upcoming events
   * const events = await client.listEvents({
   *   timeMin: new Date(),
   *   maxResults: 10,
   *   singleEvents: true,
   *   orderBy: 'startTime',
   * });
   *
   * // List events from a specific calendar
   * const workEvents = await client.listEvents({
   *   calendarId: 'work@example.com',
   *   timeMin: new Date(),
   *   timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
   * });
   * ```
   */
  async listEvents(options: ListEventsOptions = {}): Promise<EventList> {
    const calendarId = options.calendarId ?? DEFAULT_CALENDAR_ID;

    const params: Record<string, string | number | boolean | undefined> = {
      maxResults: options.maxResults ?? DEFAULT_MAX_RESULTS,
      singleEvents: options.singleEvents,
      orderBy: options.orderBy,
      pageToken: options.pageToken,
      q: options.q,
      showDeleted: options.showDeleted,
      showHiddenInvitations: options.showHiddenInvitations,
      syncToken: options.syncToken,
      timeZone: options.timeZone,
    };

    // Convert Date objects to ISO strings
    if (options.timeMin) {
      params.timeMin = options.timeMin.toISOString();
    }
    if (options.timeMax) {
      params.timeMax = options.timeMax.toISOString();
    }
    if (options.updatedMin) {
      params.updatedMin = options.updatedMin.toISOString();
    }

    const response = await this.request<EventList>(
      "GET",
      `/calendars/${this.encodeCalendarId(calendarId)}/events`,
      { params },
    );

    return {
      items: response.items || [],
      nextPageToken: response.nextPageToken,
      nextSyncToken: response.nextSyncToken,
      summary: response.summary,
      description: response.description,
      timeZone: response.timeZone,
      accessRole: response.accessRole,
    };
  }

  /**
   * Get a single event
   *
   * @param calendarId - Calendar ID
   * @param eventId - Event ID
   * @returns Event details
   *
   * @example
   * ```typescript
   * const event = await client.getEvent('primary', 'abc123');
   * console.log(event.summary, event.start);
   * ```
   */
  async getEvent(calendarId: string, eventId: string): Promise<CalendarEvent> {
    return this.request<CalendarEvent>(
      "GET",
      `/calendars/${this.encodeCalendarId(calendarId)}/events/${encodeURIComponent(eventId)}`,
    );
  }

  /**
   * Create a new event
   *
   * @param options - Event details
   * @returns Created event
   *
   * @example
   * ```typescript
   * // Timed event
   * const event = await client.createEvent({
   *   summary: 'Team Meeting',
   *   description: 'Weekly sync',
   *   location: 'Conference Room A',
   *   start: new Date('2024-01-15T10:00:00'),
   *   end: new Date('2024-01-15T11:00:00'),
   *   attendees: ['alice@example.com', 'bob@example.com'],
   * });
   *
   * // All-day event
   * const allDay = await client.createEvent({
   *   summary: 'Company Holiday',
   *   start: { date: '2024-01-01' },
   *   end: { date: '2024-01-02' },
   * });
   *
   * // Recurring event
   * const recurring = await client.createEvent({
   *   summary: 'Daily Standup',
   *   start: new Date('2024-01-15T09:00:00'),
   *   end: new Date('2024-01-15T09:15:00'),
   *   recurrence: ['RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR'],
   * });
   * ```
   */
  async createEvent(options: CreateEventOptions): Promise<CalendarEvent> {
    const calendarId = options.calendarId ?? DEFAULT_CALENDAR_ID;
    const timeZone = options.timeZone ?? this.defaultTimeZone;

    const body: Record<string, unknown> = {
      summary: options.summary,
      description: options.description,
      location: options.location,
      start: this.toEventDateTime(options.start, timeZone),
      end: this.toEventDateTime(options.end, timeZone),
      recurrence: options.recurrence,
      visibility: options.visibility,
      transparency: options.transparency,
      extendedProperties: options.extendedProperties,
      colorId: options.colorId,
      guestsCanInviteOthers: options.guestsCanInviteOthers,
      guestsCanModify: options.guestsCanModify,
      guestsCanSeeOtherGuests: options.guestsCanSeeOtherGuests,
    };

    // Convert attendee emails to attendee objects
    if (options.attendees && options.attendees.length > 0) {
      body.attendees = options.attendees.map((email) => ({ email }));
    }

    // Add reminders
    if (options.reminders) {
      body.reminders = options.reminders;
    }

    // Request params
    const params: Record<string, string | number | boolean | undefined> = {
      sendUpdates: options.sendUpdates ?? "none",
    };

    // Add conference data version if creating Google Meet
    if (options.conferenceDataVersion !== undefined) {
      params.conferenceDataVersion = options.conferenceDataVersion;
      if (options.conferenceDataVersion === 1) {
        body.conferenceData = {
          createRequest: {
            requestId: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        };
      }
    }

    return this.request<CalendarEvent>(
      "POST",
      `/calendars/${this.encodeCalendarId(calendarId)}/events`,
      { params, body },
    );
  }

  /**
   * Update an existing event
   *
   * @param calendarId - Calendar ID
   * @param eventId - Event ID
   * @param updates - Fields to update
   * @returns Updated event
   *
   * @example
   * ```typescript
   * const updated = await client.updateEvent('primary', 'abc123', {
   *   summary: 'Updated Meeting Title',
   *   location: 'New Location',
   * });
   * ```
   */
  async updateEvent(
    calendarId: string,
    eventId: string,
    updates: UpdateEventOptions,
  ): Promise<CalendarEvent> {
    const timeZone = updates.timeZone ?? this.defaultTimeZone;

    const body: Record<string, unknown> = {};

    // Only include provided fields
    if (updates.summary !== undefined) body.summary = updates.summary;
    if (updates.description !== undefined) body.description = updates.description;
    if (updates.location !== undefined) body.location = updates.location;
    if (updates.start !== undefined) body.start = this.toEventDateTime(updates.start, timeZone);
    if (updates.end !== undefined) body.end = this.toEventDateTime(updates.end, timeZone);
    if (updates.recurrence !== undefined) body.recurrence = updates.recurrence;
    if (updates.visibility !== undefined) body.visibility = updates.visibility;
    if (updates.transparency !== undefined) body.transparency = updates.transparency;
    if (updates.reminders !== undefined) body.reminders = updates.reminders;
    if (updates.extendedProperties !== undefined)
      body.extendedProperties = updates.extendedProperties;
    if (updates.colorId !== undefined) body.colorId = updates.colorId;
    if (updates.guestsCanInviteOthers !== undefined)
      body.guestsCanInviteOthers = updates.guestsCanInviteOthers;
    if (updates.guestsCanModify !== undefined) body.guestsCanModify = updates.guestsCanModify;
    if (updates.guestsCanSeeOtherGuests !== undefined)
      body.guestsCanSeeOtherGuests = updates.guestsCanSeeOtherGuests;

    // Convert attendee emails to attendee objects
    if (updates.attendees !== undefined) {
      body.attendees = updates.attendees.map((email) => ({ email }));
    }

    const params: Record<string, string | number | boolean | undefined> = {
      sendUpdates: updates.sendUpdates ?? "none",
    };

    return this.request<CalendarEvent>(
      "PATCH",
      `/calendars/${this.encodeCalendarId(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { params, body },
    );
  }

  /**
   * Delete an event
   *
   * @param calendarId - Calendar ID
   * @param eventId - Event ID
   *
   * @example
   * ```typescript
   * await client.deleteEvent('primary', 'abc123');
   * ```
   */
  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/calendars/${this.encodeCalendarId(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        params: {
          sendUpdates: "none",
        },
      },
    );
  }

  // ===========================================================================
  // FREE/BUSY OPERATIONS
  // ===========================================================================

  /**
   * Get free/busy information for calendars
   *
   * @param options - Query options
   * @returns Free/busy information
   *
   * @example
   * ```typescript
   * const freeBusy = await client.getFreeBusy({
   *   timeMin: new Date(),
   *   timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
   *   calendars: ['alice@example.com', 'bob@example.com'],
   * });
   *
   * for (const [calendarId, info] of Object.entries(freeBusy.calendars)) {
   *   console.log(`${calendarId} has ${info.busy.length} busy periods`);
   * }
   * ```
   */
  async getFreeBusy(options: {
    timeMin: Date;
    timeMax: Date;
    calendars: string[];
    timeZone?: string;
  }): Promise<FreeBusyResponse> {
    const body = {
      timeMin: options.timeMin.toISOString(),
      timeMax: options.timeMax.toISOString(),
      timeZone: options.timeZone ?? this.defaultTimeZone,
      items: options.calendars.map((id) => ({ id })),
    };

    const response = await this.request<{
      kind: string;
      timeMin: string;
      timeMax: string;
      calendars: Record<string, { busy: Array<{ start: string; end: string }> }>;
    }>("POST", "/freeBusy", { body });

    return {
      timeMin: response.timeMin,
      timeMax: response.timeMax,
      calendars: response.calendars,
    };
  }

  // ===========================================================================
  // ADVANCED OPERATIONS
  // ===========================================================================

  /**
   * Move an event to a different calendar
   *
   * @param sourceCalendarId - Source calendar ID
   * @param eventId - Event ID
   * @param destinationCalendarId - Destination calendar ID
   * @returns Moved event
   *
   * @example
   * ```typescript
   * const moved = await client.moveEvent('primary', 'abc123', 'work@example.com');
   * ```
   */
  async moveEvent(
    sourceCalendarId: string,
    eventId: string,
    destinationCalendarId: string,
  ): Promise<CalendarEvent> {
    return this.request<CalendarEvent>(
      "POST",
      `/calendars/${this.encodeCalendarId(sourceCalendarId)}/events/${encodeURIComponent(eventId)}/move`,
      {
        params: {
          destination: destinationCalendarId,
          sendUpdates: "none",
        },
      },
    );
  }

  /**
   * Get instances of a recurring event
   *
   * @param calendarId - Calendar ID
   * @param eventId - Recurring event ID
   * @param options - Query options
   * @returns List of event instances
   *
   * @example
   * ```typescript
   * const instances = await client.getEventInstances('primary', 'recurring-id', {
   *   timeMin: new Date(),
   *   timeMax: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
   * });
   * ```
   */
  async getEventInstances(
    calendarId: string,
    eventId: string,
    options: {
      timeMin?: Date;
      timeMax?: Date;
      maxResults?: number;
      pageToken?: string;
    } = {},
  ): Promise<EventList> {
    const params: Record<string, string | number | boolean | undefined> = {
      maxResults: options.maxResults ?? DEFAULT_MAX_RESULTS,
      pageToken: options.pageToken,
    };

    if (options.timeMin) {
      params.timeMin = options.timeMin.toISOString();
    }
    if (options.timeMax) {
      params.timeMax = options.timeMax.toISOString();
    }

    const response = await this.request<EventList>(
      "GET",
      `/calendars/${this.encodeCalendarId(calendarId)}/events/${encodeURIComponent(eventId)}/instances`,
      { params },
    );

    return {
      items: response.items || [],
      nextPageToken: response.nextPageToken,
    };
  }

  /**
   * Quick add an event from text
   *
   * @param calendarId - Calendar ID
   * @param text - Text describing the event (e.g., "Meeting with John tomorrow at 3pm")
   * @returns Created event
   *
   * @example
   * ```typescript
   * const event = await client.quickAdd('primary', 'Lunch with Alice tomorrow at noon');
   * ```
   */
  async quickAdd(calendarId: string, text: string): Promise<CalendarEvent> {
    return this.request<CalendarEvent>(
      "POST",
      `/calendars/${this.encodeCalendarId(calendarId)}/events/quickAdd`,
      {
        params: {
          text,
          sendUpdates: "none",
        },
      },
    );
  }

  /**
   * Import an event (preserves iCalendar UID)
   *
   * @param calendarId - Calendar ID
   * @param event - Event to import
   * @returns Imported event
   */
  async importEvent(
    calendarId: string,
    event: CreateEventOptions & { iCalUID: string },
  ): Promise<CalendarEvent> {
    const timeZone = event.timeZone ?? this.defaultTimeZone;

    const body: Record<string, unknown> = {
      iCalUID: event.iCalUID,
      summary: event.summary,
      description: event.description,
      location: event.location,
      start: this.toEventDateTime(event.start, timeZone),
      end: this.toEventDateTime(event.end, timeZone),
      recurrence: event.recurrence,
    };

    if (event.attendees && event.attendees.length > 0) {
      body.attendees = event.attendees.map((email) => ({ email }));
    }

    return this.request<CalendarEvent>(
      "POST",
      `/calendars/${this.encodeCalendarId(calendarId)}/events/import`,
      { body },
    );
  }

  /**
   * Watch for changes to a calendar (push notifications)
   *
   * @param calendarId - Calendar ID to watch
   * @param channelId - Unique channel ID for this watch
   * @param address - HTTPS URL to receive notifications
   * @param options - Watch options
   * @returns Watch channel information
   */
  async watch(
    calendarId: string,
    channelId: string,
    address: string,
    options: {
      token?: string;
      expiration?: number;
    } = {},
  ): Promise<{
    kind: string;
    id: string;
    resourceId: string;
    resourceUri: string;
    expiration: string;
  }> {
    const body: Record<string, unknown> = {
      id: channelId,
      type: "web_hook",
      address,
    };

    if (options.token) {
      body.token = options.token;
    }

    if (options.expiration) {
      body.expiration = options.expiration;
    }

    return this.request("POST", `/calendars/${this.encodeCalendarId(calendarId)}/events/watch`, {
      body,
    });
  }

  /**
   * Stop watching a calendar
   *
   * @param channelId - Channel ID from watch response
   * @param resourceId - Resource ID from watch response
   */
  async stopWatch(channelId: string, resourceId: string): Promise<void> {
    await this.request("POST", "/channels/stop", {
      body: {
        id: channelId,
        resourceId,
      },
    });
  }
}
