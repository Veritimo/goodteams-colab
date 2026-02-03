/**
 * Google Calendar Client Tests
 *
 * Comprehensive tests for the GoogleCalendarClient class.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  GoogleAuthClient,
  Calendar,
  CalendarEvent,
  EventList,
  FreeBusyResponse,
} from "../types.js";
import { GoogleCalendarClient } from "../client.js";

// =============================================================================
// MOCK SETUP
// =============================================================================

function createMockAuth(): GoogleAuthClient {
  return {
    getAccessToken: vi.fn().mockResolvedValue({ token: "mock-access-token" }),
    setCredentials: vi.fn(),
  };
}

function createMockClient(auth?: GoogleAuthClient): GoogleCalendarClient {
  return new GoogleCalendarClient({
    auth: auth ?? createMockAuth(),
    defaultTimeZone: "America/Los_Angeles",
  });
}

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockFetchResponse(data: unknown, status = 200): void {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  });
}

function mockFetchError(message: string, status = 400): void {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ error: { message } }),
  });
}

// =============================================================================
// CALENDAR TESTS
// =============================================================================

describe("GoogleCalendarClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("constructor", () => {
    it("should create client with auth", () => {
      const auth = createMockAuth();
      const client = new GoogleCalendarClient({ auth });
      expect(client).toBeInstanceOf(GoogleCalendarClient);
    });

    it("should use custom base URL", async () => {
      const auth = createMockAuth();
      const client = new GoogleCalendarClient({
        auth,
        baseUrl: "https://custom.api.com/v3",
      });

      mockFetchResponse({ items: [] });
      await client.listCalendars();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://custom.api.com/v3"),
        expect.any(Object),
      );
    });

    it("should use custom default time zone", async () => {
      const auth = createMockAuth();
      const client = new GoogleCalendarClient({
        auth,
        defaultTimeZone: "Europe/London",
      });

      mockFetchResponse({ id: "evt1" });
      await client.createEvent({
        summary: "Test",
        start: new Date("2024-01-15T10:00:00Z"),
        end: new Date("2024-01-15T11:00:00Z"),
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.start.timeZone).toBe("Europe/London");
    });
  });

  // ===========================================================================
  // LIST CALENDARS TESTS
  // ===========================================================================

  describe("listCalendars", () => {
    let client: GoogleCalendarClient;

    beforeEach(() => {
      client = createMockClient();
    });

    it("should list user calendars", async () => {
      const mockCalendars = {
        items: [
          {
            id: "primary",
            summary: "Primary Calendar",
            timeZone: "UTC",
            accessRole: "owner",
            primary: true,
          },
          { id: "work@example.com", summary: "Work", timeZone: "UTC", accessRole: "owner" },
        ],
      };

      mockFetchResponse(mockCalendars);

      const result = await client.listCalendars();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/users/me/calendarList"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer mock-access-token",
          }),
        }),
      );
      expect(result).toHaveLength(2);
      expect(result[0].primary).toBe(true);
    });

    it("should return empty array when no calendars", async () => {
      mockFetchResponse({ items: [] });

      const result = await client.listCalendars();

      expect(result).toEqual([]);
    });

    it("should handle missing items array", async () => {
      mockFetchResponse({});

      const result = await client.listCalendars();

      expect(result).toEqual([]);
    });

    it("should map calendar list entry fields correctly", async () => {
      mockFetchResponse({
        items: [
          {
            id: "cal1",
            summary: "Test Calendar",
            description: "Description",
            timeZone: "America/New_York",
            accessRole: "writer",
            backgroundColor: "#0000ff",
            foregroundColor: "#ffffff",
            selected: true,
            hidden: false,
          },
        ],
      });

      const [calendar] = await client.listCalendars();

      expect(calendar.id).toBe("cal1");
      expect(calendar.summary).toBe("Test Calendar");
      expect(calendar.description).toBe("Description");
      expect(calendar.timeZone).toBe("America/New_York");
      expect(calendar.accessRole).toBe("writer");
      expect(calendar.backgroundColor).toBe("#0000ff");
    });
  });

  // ===========================================================================
  // GET CALENDAR TESTS
  // ===========================================================================

  describe("getCalendar", () => {
    let client: GoogleCalendarClient;

    beforeEach(() => {
      client = createMockClient();
    });

    it("should get a specific calendar", async () => {
      const mockCalendar = {
        id: "primary",
        summary: "My Calendar",
        timeZone: "UTC",
        accessRole: "owner",
        primary: true,
      };

      mockFetchResponse(mockCalendar);

      const result = await client.getCalendar("primary");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/users/me/calendarList/primary"),
        expect.any(Object),
      );
      expect(result.id).toBe("primary");
      expect(result.primary).toBe(true);
    });

    it("should URL-encode calendar ID", async () => {
      mockFetchResponse({
        id: "test@example.com",
        summary: "Test",
        timeZone: "UTC",
        accessRole: "reader",
      });

      await client.getCalendar("test@example.com");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("test%40example.com"),
        expect.any(Object),
      );
    });

    it("should throw on API error", async () => {
      mockFetchError("Calendar not found", 404);

      await expect(client.getCalendar("nonexistent")).rejects.toThrow("Calendar not found");
    });
  });

  // ===========================================================================
  // LIST EVENTS TESTS
  // ===========================================================================

  describe("listEvents", () => {
    let client: GoogleCalendarClient;

    beforeEach(() => {
      client = createMockClient();
    });

    it("should list events with default options", async () => {
      const mockEvents: EventList = {
        items: [
          {
            id: "evt1",
            summary: "Meeting 1",
            status: "confirmed",
            start: {},
            end: {},
            htmlLink: "",
            created: "",
            updated: "",
          },
          {
            id: "evt2",
            summary: "Meeting 2",
            status: "confirmed",
            start: {},
            end: {},
            htmlLink: "",
            created: "",
            updated: "",
          },
        ],
      };

      mockFetchResponse(mockEvents);

      const result = await client.listEvents();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/calendars/primary/events"),
        expect.any(Object),
      );
      expect(result.items).toHaveLength(2);
    });

    it("should list events from a specific calendar", async () => {
      mockFetchResponse({ items: [] });

      await client.listEvents({ calendarId: "work@example.com" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/calendars/work%40example.com/events"),
        expect.any(Object),
      );
    });

    it("should apply time range filters", async () => {
      mockFetchResponse({ items: [] });

      const timeMin = new Date("2024-01-01T00:00:00Z");
      const timeMax = new Date("2024-01-31T23:59:59Z");

      await client.listEvents({ timeMin, timeMax });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("timeMin=2024-01-01T00%3A00%3A00.000Z");
      expect(url).toContain("timeMax=2024-01-31T23%3A59%3A59.000Z");
    });

    it("should apply maxResults option", async () => {
      mockFetchResponse({ items: [] });

      await client.listEvents({ maxResults: 50 });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("maxResults=50");
    });

    it("should apply singleEvents option", async () => {
      mockFetchResponse({ items: [] });

      await client.listEvents({ singleEvents: true });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("singleEvents=true");
    });

    it("should apply orderBy option", async () => {
      mockFetchResponse({ items: [] });

      await client.listEvents({ orderBy: "startTime" });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("orderBy=startTime");
    });

    it("should apply search query", async () => {
      mockFetchResponse({ items: [] });

      await client.listEvents({ q: "team meeting" });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("q=team+meeting");
    });

    it("should handle pagination token", async () => {
      mockFetchResponse({ items: [], nextPageToken: "token123" });

      const result = await client.listEvents();

      expect(result.nextPageToken).toBe("token123");
    });

    it("should pass pageToken for next page", async () => {
      mockFetchResponse({ items: [] });

      await client.listEvents({ pageToken: "nextPage123" });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("pageToken=nextPage123");
    });

    it("should include sync token for incremental sync", async () => {
      mockFetchResponse({ items: [], nextSyncToken: "sync456" });

      const result = await client.listEvents({ syncToken: "prevSync" });

      expect(result.nextSyncToken).toBe("sync456");
    });

    it("should include calendar metadata in response", async () => {
      mockFetchResponse({
        items: [],
        summary: "My Calendar",
        description: "Test",
        timeZone: "UTC",
        accessRole: "owner",
      });

      const result = await client.listEvents();

      expect(result.summary).toBe("My Calendar");
      expect(result.timeZone).toBe("UTC");
    });
  });

  // ===========================================================================
  // GET EVENT TESTS
  // ===========================================================================

  describe("getEvent", () => {
    let client: GoogleCalendarClient;

    beforeEach(() => {
      client = createMockClient();
    });

    it("should get a single event", async () => {
      const mockEvent: CalendarEvent = {
        id: "evt1",
        summary: "Team Meeting",
        description: "Weekly sync",
        start: { dateTime: "2024-01-15T10:00:00Z" },
        end: { dateTime: "2024-01-15T11:00:00Z" },
        status: "confirmed",
        htmlLink: "https://calendar.google.com/event/evt1",
        created: "2024-01-10T00:00:00Z",
        updated: "2024-01-10T00:00:00Z",
      };

      mockFetchResponse(mockEvent);

      const result = await client.getEvent("primary", "evt1");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/calendars/primary/events/evt1"),
        expect.any(Object),
      );
      expect(result.id).toBe("evt1");
      expect(result.summary).toBe("Team Meeting");
    });

    it("should URL-encode event ID", async () => {
      mockFetchResponse({
        id: "evt/123",
        summary: "Test",
        status: "confirmed",
        start: {},
        end: {},
        htmlLink: "",
        created: "",
        updated: "",
      });

      await client.getEvent("primary", "evt/123");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("evt%2F123"),
        expect.any(Object),
      );
    });
  });

  // ===========================================================================
  // CREATE EVENT TESTS
  // ===========================================================================

  describe("createEvent", () => {
    let client: GoogleCalendarClient;

    beforeEach(() => {
      client = createMockClient();
    });

    it("should create a timed event", async () => {
      const mockEvent: CalendarEvent = {
        id: "new-evt",
        summary: "New Meeting",
        status: "confirmed",
        start: { dateTime: "2024-01-15T10:00:00Z" },
        end: { dateTime: "2024-01-15T11:00:00Z" },
        htmlLink: "",
        created: "",
        updated: "",
      };

      mockFetchResponse(mockEvent);

      const result = await client.createEvent({
        summary: "New Meeting",
        start: new Date("2024-01-15T10:00:00Z"),
        end: new Date("2024-01-15T11:00:00Z"),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/calendars/primary/events"),
        expect.objectContaining({
          method: "POST",
        }),
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.summary).toBe("New Meeting");
      expect(body.start.dateTime).toBeDefined();
      expect(result.id).toBe("new-evt");
    });

    it("should create an all-day event", async () => {
      mockFetchResponse({
        id: "allday",
        summary: "Holiday",
        status: "confirmed",
        start: { date: "2024-01-01" },
        end: { date: "2024-01-02" },
        htmlLink: "",
        created: "",
        updated: "",
      });

      await client.createEvent({
        summary: "Holiday",
        start: { date: "2024-01-01" },
        end: { date: "2024-01-02" },
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.start.date).toBe("2024-01-01");
      expect(body.end.date).toBe("2024-01-02");
      expect(body.start.dateTime).toBeUndefined();
    });

    it("should create event in a specific calendar", async () => {
      mockFetchResponse({
        id: "evt",
        summary: "Test",
        status: "confirmed",
        start: {},
        end: {},
        htmlLink: "",
        created: "",
        updated: "",
      });

      await client.createEvent({
        calendarId: "work@example.com",
        summary: "Work Meeting",
        start: new Date("2024-01-15T10:00:00Z"),
        end: new Date("2024-01-15T11:00:00Z"),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/calendars/work%40example.com/events"),
        expect.any(Object),
      );
    });

    it("should create event with description and location", async () => {
      mockFetchResponse({
        id: "evt",
        summary: "Test",
        status: "confirmed",
        start: {},
        end: {},
        htmlLink: "",
        created: "",
        updated: "",
      });

      await client.createEvent({
        summary: "Office Meeting",
        description: "Discuss Q1 goals",
        location: "Conference Room A",
        start: new Date("2024-01-15T10:00:00Z"),
        end: new Date("2024-01-15T11:00:00Z"),
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.description).toBe("Discuss Q1 goals");
      expect(body.location).toBe("Conference Room A");
    });

    it("should create event with attendees", async () => {
      mockFetchResponse({
        id: "evt",
        summary: "Test",
        status: "confirmed",
        start: {},
        end: {},
        htmlLink: "",
        created: "",
        updated: "",
      });

      await client.createEvent({
        summary: "Team Meeting",
        start: new Date("2024-01-15T10:00:00Z"),
        end: new Date("2024-01-15T11:00:00Z"),
        attendees: ["alice@example.com", "bob@example.com"],
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.attendees).toEqual([
        { email: "alice@example.com" },
        { email: "bob@example.com" },
      ]);
    });

    it("should create event with custom reminders", async () => {
      mockFetchResponse({
        id: "evt",
        summary: "Test",
        status: "confirmed",
        start: {},
        end: {},
        htmlLink: "",
        created: "",
        updated: "",
      });

      await client.createEvent({
        summary: "Important Meeting",
        start: new Date("2024-01-15T10:00:00Z"),
        end: new Date("2024-01-15T11:00:00Z"),
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 60 },
            { method: "popup", minutes: 10 },
          ],
        },
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.reminders.useDefault).toBe(false);
      expect(body.reminders.overrides).toHaveLength(2);
    });

    it("should create recurring event", async () => {
      mockFetchResponse({
        id: "evt",
        summary: "Test",
        status: "confirmed",
        start: {},
        end: {},
        htmlLink: "",
        created: "",
        updated: "",
        recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO"],
      });

      await client.createEvent({
        summary: "Weekly Standup",
        start: new Date("2024-01-15T09:00:00Z"),
        end: new Date("2024-01-15T09:15:00Z"),
        recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO"],
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.recurrence).toEqual(["RRULE:FREQ=WEEKLY;BYDAY=MO"]);
    });

    it("should create event with visibility setting", async () => {
      mockFetchResponse({
        id: "evt",
        summary: "Test",
        status: "confirmed",
        start: {},
        end: {},
        htmlLink: "",
        created: "",
        updated: "",
      });

      await client.createEvent({
        summary: "Private Meeting",
        start: new Date("2024-01-15T10:00:00Z"),
        end: new Date("2024-01-15T11:00:00Z"),
        visibility: "private",
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.visibility).toBe("private");
    });

    it("should create event with transparency setting", async () => {
      mockFetchResponse({
        id: "evt",
        summary: "Test",
        status: "confirmed",
        start: {},
        end: {},
        htmlLink: "",
        created: "",
        updated: "",
      });

      await client.createEvent({
        summary: "Available Block",
        start: new Date("2024-01-15T10:00:00Z"),
        end: new Date("2024-01-15T11:00:00Z"),
        transparency: "transparent",
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.transparency).toBe("transparent");
    });

    it("should use custom time zone", async () => {
      mockFetchResponse({
        id: "evt",
        summary: "Test",
        status: "confirmed",
        start: {},
        end: {},
        htmlLink: "",
        created: "",
        updated: "",
      });

      await client.createEvent({
        summary: "NY Meeting",
        start: new Date("2024-01-15T10:00:00Z"),
        end: new Date("2024-01-15T11:00:00Z"),
        timeZone: "America/New_York",
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.start.timeZone).toBe("America/New_York");
      expect(body.end.timeZone).toBe("America/New_York");
    });

    it("should request Google Meet conference", async () => {
      mockFetchResponse({
        id: "evt",
        summary: "Test",
        status: "confirmed",
        start: {},
        end: {},
        htmlLink: "",
        created: "",
        updated: "",
        conferenceData: {
          entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/abc-def-ghi" }],
        },
      });

      await client.createEvent({
        summary: "Video Call",
        start: new Date("2024-01-15T10:00:00Z"),
        end: new Date("2024-01-15T11:00:00Z"),
        conferenceDataVersion: 1,
      });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("conferenceDataVersion=1");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.conferenceData.createRequest).toBeDefined();
    });

    it("should set guest permissions", async () => {
      mockFetchResponse({
        id: "evt",
        summary: "Test",
        status: "confirmed",
        start: {},
        end: {},
        htmlLink: "",
        created: "",
        updated: "",
      });

      await client.createEvent({
        summary: "Team Meeting",
        start: new Date("2024-01-15T10:00:00Z"),
        end: new Date("2024-01-15T11:00:00Z"),
        guestsCanInviteOthers: false,
        guestsCanModify: false,
        guestsCanSeeOtherGuests: true,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.guestsCanInviteOthers).toBe(false);
      expect(body.guestsCanModify).toBe(false);
      expect(body.guestsCanSeeOtherGuests).toBe(true);
    });
  });

  // ===========================================================================
  // UPDATE EVENT TESTS
  // ===========================================================================

  describe("updateEvent", () => {
    let client: GoogleCalendarClient;

    beforeEach(() => {
      client = createMockClient();
    });

    it("should update event summary", async () => {
      mockFetchResponse({
        id: "evt1",
        summary: "Updated Title",
        status: "confirmed",
        start: {},
        end: {},
        htmlLink: "",
        created: "",
        updated: "",
      });

      const result = await client.updateEvent("primary", "evt1", {
        summary: "Updated Title",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/calendars/primary/events/evt1"),
        expect.objectContaining({
          method: "PATCH",
        }),
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.summary).toBe("Updated Title");
      expect(result.summary).toBe("Updated Title");
    });

    it("should update event location", async () => {
      mockFetchResponse({
        id: "evt1",
        summary: "Test",
        status: "confirmed",
        start: {},
        end: {},
        htmlLink: "",
        created: "",
        updated: "",
        location: "New Room",
      });

      await client.updateEvent("primary", "evt1", {
        location: "New Room",
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.location).toBe("New Room");
    });

    it("should update event times", async () => {
      mockFetchResponse({
        id: "evt1",
        summary: "Test",
        status: "confirmed",
        start: {},
        end: {},
        htmlLink: "",
        created: "",
        updated: "",
      });

      await client.updateEvent("primary", "evt1", {
        start: new Date("2024-01-16T10:00:00Z"),
        end: new Date("2024-01-16T11:00:00Z"),
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.start.dateTime).toContain("2024-01-16");
      expect(body.end.dateTime).toContain("2024-01-16");
    });

    it("should update attendees", async () => {
      mockFetchResponse({
        id: "evt1",
        summary: "Test",
        status: "confirmed",
        start: {},
        end: {},
        htmlLink: "",
        created: "",
        updated: "",
      });

      await client.updateEvent("primary", "evt1", {
        attendees: ["new@example.com"],
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.attendees).toEqual([{ email: "new@example.com" }]);
    });

    it("should update recurrence", async () => {
      mockFetchResponse({
        id: "evt1",
        summary: "Test",
        status: "confirmed",
        start: {},
        end: {},
        htmlLink: "",
        created: "",
        updated: "",
      });

      await client.updateEvent("primary", "evt1", {
        recurrence: ["RRULE:FREQ=DAILY"],
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.recurrence).toEqual(["RRULE:FREQ=DAILY"]);
    });

    it("should only include provided fields", async () => {
      mockFetchResponse({
        id: "evt1",
        summary: "Test",
        status: "confirmed",
        start: {},
        end: {},
        htmlLink: "",
        created: "",
        updated: "",
      });

      await client.updateEvent("primary", "evt1", {
        summary: "Only Summary",
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(Object.keys(body)).toEqual(["summary"]);
    });
  });

  // ===========================================================================
  // DELETE EVENT TESTS
  // ===========================================================================

  describe("deleteEvent", () => {
    let client: GoogleCalendarClient;

    beforeEach(() => {
      client = createMockClient();
    });

    it("should delete an event", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => undefined,
      });

      await client.deleteEvent("primary", "evt1");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/calendars/primary/events/evt1"),
        expect.objectContaining({
          method: "DELETE",
        }),
      );
    });

    it("should handle delete from specific calendar", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => undefined,
      });

      await client.deleteEvent("work@example.com", "evt1");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/calendars/work%40example.com/events/evt1"),
        expect.any(Object),
      );
    });
  });

  // ===========================================================================
  // FREE/BUSY TESTS
  // ===========================================================================

  describe("getFreeBusy", () => {
    let client: GoogleCalendarClient;

    beforeEach(() => {
      client = createMockClient();
    });

    it("should get free/busy information", async () => {
      const mockResponse: FreeBusyResponse = {
        timeMin: "2024-01-15T00:00:00Z",
        timeMax: "2024-01-16T00:00:00Z",
        calendars: {
          "alice@example.com": {
            busy: [{ start: "2024-01-15T10:00:00Z", end: "2024-01-15T11:00:00Z" }],
          },
          "bob@example.com": {
            busy: [],
          },
        },
      };

      mockFetchResponse(mockResponse);

      const result = await client.getFreeBusy({
        timeMin: new Date("2024-01-15T00:00:00Z"),
        timeMax: new Date("2024-01-16T00:00:00Z"),
        calendars: ["alice@example.com", "bob@example.com"],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/freeBusy"),
        expect.objectContaining({
          method: "POST",
        }),
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.items).toEqual([{ id: "alice@example.com" }, { id: "bob@example.com" }]);

      expect(result.calendars["alice@example.com"].busy).toHaveLength(1);
      expect(result.calendars["bob@example.com"].busy).toHaveLength(0);
    });

    it("should use custom time zone", async () => {
      mockFetchResponse({ timeMin: "", timeMax: "", calendars: {} });

      await client.getFreeBusy({
        timeMin: new Date("2024-01-15T00:00:00Z"),
        timeMax: new Date("2024-01-16T00:00:00Z"),
        calendars: ["test@example.com"],
        timeZone: "Europe/London",
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.timeZone).toBe("Europe/London");
    });
  });

  // ===========================================================================
  // ADVANCED OPERATIONS TESTS
  // ===========================================================================

  describe("moveEvent", () => {
    let client: GoogleCalendarClient;

    beforeEach(() => {
      client = createMockClient();
    });

    it("should move event to different calendar", async () => {
      mockFetchResponse({
        id: "evt1",
        summary: "Test",
        status: "confirmed",
        start: {},
        end: {},
        htmlLink: "",
        created: "",
        updated: "",
      });

      await client.moveEvent("primary", "evt1", "work@example.com");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/calendars/primary/events/evt1/move"),
        expect.objectContaining({
          method: "POST",
        }),
      );

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("destination=work%40example.com");
    });
  });

  describe("getEventInstances", () => {
    let client: GoogleCalendarClient;

    beforeEach(() => {
      client = createMockClient();
    });

    it("should get instances of recurring event", async () => {
      mockFetchResponse({
        items: [
          {
            id: "evt1_20240115",
            summary: "Weekly",
            status: "confirmed",
            start: {},
            end: {},
            htmlLink: "",
            created: "",
            updated: "",
          },
          {
            id: "evt1_20240122",
            summary: "Weekly",
            status: "confirmed",
            start: {},
            end: {},
            htmlLink: "",
            created: "",
            updated: "",
          },
        ],
      });

      const result = await client.getEventInstances("primary", "evt1");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/calendars/primary/events/evt1/instances"),
        expect.any(Object),
      );
      expect(result.items).toHaveLength(2);
    });

    it("should apply time range to instances", async () => {
      mockFetchResponse({ items: [] });

      await client.getEventInstances("primary", "evt1", {
        timeMin: new Date("2024-01-01T00:00:00Z"),
        timeMax: new Date("2024-01-31T23:59:59Z"),
      });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("timeMin=");
      expect(url).toContain("timeMax=");
    });
  });

  describe("quickAdd", () => {
    let client: GoogleCalendarClient;

    beforeEach(() => {
      client = createMockClient();
    });

    it("should create event from text", async () => {
      mockFetchResponse({
        id: "quick-evt",
        summary: "Lunch with Alice",
        status: "confirmed",
        start: { dateTime: "2024-01-16T12:00:00Z" },
        end: { dateTime: "2024-01-16T13:00:00Z" },
        htmlLink: "",
        created: "",
        updated: "",
      });

      const result = await client.quickAdd("primary", "Lunch with Alice tomorrow at noon");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/calendars/primary/events/quickAdd"),
        expect.objectContaining({
          method: "POST",
        }),
      );

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("text=Lunch+with+Alice+tomorrow+at+noon");
      expect(result.id).toBe("quick-evt");
    });
  });

  describe("importEvent", () => {
    let client: GoogleCalendarClient;

    beforeEach(() => {
      client = createMockClient();
    });

    it("should import event with iCalUID", async () => {
      mockFetchResponse({
        id: "imported",
        summary: "Imported Event",
        status: "confirmed",
        start: {},
        end: {},
        htmlLink: "",
        created: "",
        updated: "",
        iCalUID: "unique-uid@example.com",
      });

      await client.importEvent("primary", {
        iCalUID: "unique-uid@example.com",
        summary: "Imported Event",
        start: new Date("2024-01-15T10:00:00Z"),
        end: new Date("2024-01-15T11:00:00Z"),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/calendars/primary/events/import"),
        expect.objectContaining({
          method: "POST",
        }),
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.iCalUID).toBe("unique-uid@example.com");
    });
  });

  describe("watch", () => {
    let client: GoogleCalendarClient;

    beforeEach(() => {
      client = createMockClient();
    });

    it("should set up watch channel", async () => {
      mockFetchResponse({
        kind: "api#channel",
        id: "channel-123",
        resourceId: "resource-456",
        resourceUri: "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        expiration: "1705363200000",
      });

      const result = await client.watch("primary", "channel-123", "https://example.com/webhook");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/calendars/primary/events/watch"),
        expect.objectContaining({
          method: "POST",
        }),
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.id).toBe("channel-123");
      expect(body.type).toBe("web_hook");
      expect(body.address).toBe("https://example.com/webhook");

      expect(result.resourceId).toBe("resource-456");
    });

    it("should include optional token and expiration", async () => {
      mockFetchResponse({
        kind: "api#channel",
        id: "ch",
        resourceId: "res",
        resourceUri: "",
        expiration: "",
      });

      await client.watch("primary", "channel-123", "https://example.com/webhook", {
        token: "secret-token",
        expiration: 1705363200000,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.token).toBe("secret-token");
      expect(body.expiration).toBe(1705363200000);
    });
  });

  describe("stopWatch", () => {
    let client: GoogleCalendarClient;

    beforeEach(() => {
      client = createMockClient();
    });

    it("should stop watch channel", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => undefined,
      });

      await client.stopWatch("channel-123", "resource-456");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/channels/stop"),
        expect.objectContaining({
          method: "POST",
        }),
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.id).toBe("channel-123");
      expect(body.resourceId).toBe("resource-456");
    });
  });

  // ===========================================================================
  // ERROR HANDLING TESTS
  // ===========================================================================

  describe("error handling", () => {
    let client: GoogleCalendarClient;

    beforeEach(() => {
      client = createMockClient();
    });

    it("should throw on authentication failure", async () => {
      const auth = createMockAuth();
      (auth.getAccessToken as any).mockResolvedValue({ token: null });
      client = new GoogleCalendarClient({ auth });

      await expect(client.listCalendars()).rejects.toThrow("Failed to obtain access token");
    });

    it("should throw on API error response", async () => {
      mockFetchError("Not Found", 404);

      await expect(client.getEvent("primary", "nonexistent")).rejects.toThrow("Not Found");
    });

    it("should handle malformed error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      await expect(client.listCalendars()).rejects.toThrow("HTTP 500");
    });

    it("should throw on rate limit error", async () => {
      mockFetchError("Rate Limit Exceeded", 429);

      await expect(client.listEvents()).rejects.toThrow("Rate Limit Exceeded");
    });

    it("should throw on quota exceeded", async () => {
      mockFetchError("Quota exceeded for the day", 403);

      await expect(
        client.createEvent({
          summary: "Test",
          start: new Date(),
          end: new Date(),
        }),
      ).rejects.toThrow("Quota exceeded");
    });
  });
});
