/**
 * Calendar Operations Tests
 */

import type { Client } from "@microsoft/microsoft-graph-client";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
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
} from "../calendar.js";

// =============================================================================
// MOCK SETUP
// =============================================================================

function createMockClient(): Client {
  const mockRequest = {
    select: vi.fn().mockReturnThis(),
    top: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    orderby: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };

  return {
    api: vi.fn().mockReturnValue(mockRequest),
  } as unknown as Client;
}

// =============================================================================
// LIST EVENTS TESTS
// =============================================================================

describe("listEvents", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should list events with default options", async () => {
    const mockEvents = [
      { id: "evt1", subject: "Meeting 1" },
      { id: "evt2", subject: "Meeting 2" },
    ];

    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue({ value: mockEvents });

    const result = await listEvents(client);

    expect(client.api).toHaveBeenCalledWith("/me/events");
    expect(mockRequest.select).toHaveBeenCalled();
    expect(mockRequest.top).toHaveBeenCalledWith(10);
    expect(mockRequest.orderby).toHaveBeenCalledWith("start/dateTime");
    expect(result).toEqual(mockEvents);
  });

  it("should use calendarView when time range specified", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue({ value: [] });

    await listEvents(client, {
      startDateTime: "2024-01-01T00:00:00Z",
      endDateTime: "2024-01-31T23:59:59Z",
    });

    expect(client.api).toHaveBeenCalledWith("/me/calendarView");
    expect(mockRequest.query).toHaveBeenCalledWith({
      startDateTime: "2024-01-01T00:00:00Z",
      endDateTime: "2024-01-31T23:59:59Z",
    });
  });

  it("should list events from a specific calendar", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue({ value: [] });

    await listEvents(client, { calendarId: "cal-123" });

    expect(client.api).toHaveBeenCalledWith("/me/calendars/cal-123/events");
  });

  it("should use calendarView with specific calendar and time range", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue({ value: [] });

    await listEvents(client, {
      calendarId: "cal-123",
      startDateTime: "2024-01-01T00:00:00Z",
      endDateTime: "2024-01-31T23:59:59Z",
    });

    expect(client.api).toHaveBeenCalledWith("/me/calendars/cal-123/calendarView");
  });

  it("should apply pagination options", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue({ value: [] });

    await listEvents(client, { top: 25, skip: 50 });

    expect(mockRequest.top).toHaveBeenCalledWith(25);
    expect(mockRequest.skip).toHaveBeenCalledWith(50);
  });
});

// =============================================================================
// GET EVENT TESTS
// =============================================================================

describe("getEvent", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should get a single event with full details", async () => {
    const mockEvent = {
      id: "evt1",
      subject: "Team Meeting",
      body: { contentType: "html", content: "<p>Agenda...</p>" },
      start: { dateTime: "2024-01-15T14:00:00", timeZone: "UTC" },
      end: { dateTime: "2024-01-15T15:00:00", timeZone: "UTC" },
    };

    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue(mockEvent);

    const result = await getEvent(client, "evt1");

    expect(client.api).toHaveBeenCalledWith("/me/events/evt1");
    expect(result).toEqual(mockEvent);
  });
});

// =============================================================================
// CREATE EVENT TESTS
// =============================================================================

describe("createEvent", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should create a simple event", async () => {
    const newEvent = {
      subject: "New Meeting",
      start: { dateTime: "2024-01-15T14:00:00", timeZone: "America/Los_Angeles" },
      end: { dateTime: "2024-01-15T15:00:00", timeZone: "America/Los_Angeles" },
    };

    const createdEvent = { id: "evt-new", ...newEvent };
    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue(createdEvent);

    const result = await createEvent(client, newEvent);

    expect(client.api).toHaveBeenCalledWith("/me/events");
    expect(mockRequest.post).toHaveBeenCalledWith(newEvent);
    expect(result).toEqual(createdEvent);
  });

  it("should create event in a specific calendar", async () => {
    const newEvent = {
      subject: "Calendar Event",
      start: { dateTime: "2024-01-15T14:00:00", timeZone: "UTC" },
      end: { dateTime: "2024-01-15T15:00:00", timeZone: "UTC" },
      calendarId: "cal-123",
    };

    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue({ id: "evt-new" });

    await createEvent(client, newEvent);

    expect(client.api).toHaveBeenCalledWith("/me/calendars/cal-123/events");
    // calendarId should not be in the POST body
    expect(mockRequest.post).toHaveBeenCalledWith({
      subject: "Calendar Event",
      start: { dateTime: "2024-01-15T14:00:00", timeZone: "UTC" },
      end: { dateTime: "2024-01-15T15:00:00", timeZone: "UTC" },
    });
  });

  it("should create event with attendees", async () => {
    const newEvent = {
      subject: "Meeting with Attendees",
      start: { dateTime: "2024-01-15T14:00:00", timeZone: "UTC" },
      end: { dateTime: "2024-01-15T15:00:00", timeZone: "UTC" },
      attendees: [
        {
          emailAddress: { address: "attendee@example.com", name: "Attendee" },
          type: "required" as const,
        },
      ],
    };

    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue({ id: "evt-new" });

    await createEvent(client, newEvent);

    expect(mockRequest.post).toHaveBeenCalledWith(newEvent);
  });

  it("should create online meeting event", async () => {
    const newEvent = {
      subject: "Teams Meeting",
      start: { dateTime: "2024-01-15T14:00:00", timeZone: "UTC" },
      end: { dateTime: "2024-01-15T15:00:00", timeZone: "UTC" },
      isOnlineMeeting: true,
      onlineMeetingProvider: "teamsForBusiness" as const,
    };

    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue({
      id: "evt-new",
      onlineMeetingUrl: "https://teams.microsoft.com/meet/...",
    });

    const result = await createEvent(client, newEvent);

    expect(mockRequest.post).toHaveBeenCalledWith(newEvent);
    expect(result.onlineMeetingUrl).toBeDefined();
  });
});

// =============================================================================
// UPDATE EVENT TESTS
// =============================================================================

describe("updateEvent", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should update event fields", async () => {
    const updates = {
      subject: "Updated Title",
      location: { displayName: "New Location" },
    };

    const updatedEvent = { id: "evt1", ...updates };
    const mockRequest = (client.api as any)();
    mockRequest.patch.mockResolvedValue(updatedEvent);

    const result = await updateEvent(client, "evt1", updates);

    expect(client.api).toHaveBeenCalledWith("/me/events/evt1");
    expect(mockRequest.patch).toHaveBeenCalledWith(updates);
    expect(result.subject).toBe("Updated Title");
  });
});

// =============================================================================
// DELETE EVENT TESTS
// =============================================================================

describe("deleteEvent", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should delete an event", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.delete.mockResolvedValue(undefined);

    await deleteEvent(client, "evt1");

    expect(client.api).toHaveBeenCalledWith("/me/events/evt1");
    expect(mockRequest.delete).toHaveBeenCalled();
  });
});

// =============================================================================
// RESPOND TO EVENT TESTS
// =============================================================================

describe("respondToEvent", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should accept an event", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue(undefined);

    await respondToEvent(client, "evt1", "accept");

    expect(client.api).toHaveBeenCalledWith("/me/events/evt1/accept");
    expect(mockRequest.post).toHaveBeenCalledWith({
      comment: "",
      sendResponse: true,
    });
  });

  it("should decline an event with comment", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue(undefined);

    await respondToEvent(client, "evt1", "decline", "I have a conflict");

    expect(client.api).toHaveBeenCalledWith("/me/events/evt1/decline");
    expect(mockRequest.post).toHaveBeenCalledWith({
      comment: "I have a conflict",
      sendResponse: true,
    });
  });

  it("should tentatively accept an event", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue(undefined);

    await respondToEvent(client, "evt1", "tentative", "Will confirm later");

    expect(client.api).toHaveBeenCalledWith("/me/events/evt1/tentative");
  });

  it("should not send response when specified", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue(undefined);

    await respondToEvent(client, "evt1", "accept", undefined, false);

    expect(mockRequest.post).toHaveBeenCalledWith({
      comment: "",
      sendResponse: false,
    });
  });
});

// =============================================================================
// CANCEL EVENT TESTS
// =============================================================================

describe("cancelEvent", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should cancel an event", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue(undefined);

    await cancelEvent(client, "evt1", "Meeting postponed");

    expect(client.api).toHaveBeenCalledWith("/me/events/evt1/cancel");
    expect(mockRequest.post).toHaveBeenCalledWith({ comment: "Meeting postponed" });
  });

  it("should cancel without comment", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue(undefined);

    await cancelEvent(client, "evt1");

    expect(mockRequest.post).toHaveBeenCalledWith({ comment: "" });
  });
});

// =============================================================================
// CALENDAR TESTS
// =============================================================================

describe("listCalendars", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should list user calendars", async () => {
    const mockCalendars = [
      { id: "cal1", name: "Calendar", isDefaultCalendar: true },
      { id: "cal2", name: "Work", isDefaultCalendar: false },
    ];

    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue({ value: mockCalendars });

    const result = await listCalendars(client);

    expect(client.api).toHaveBeenCalledWith("/me/calendars");
    expect(result).toEqual(mockCalendars);
  });
});

describe("getCalendar", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should get a specific calendar", async () => {
    const mockCalendar = { id: "cal1", name: "Calendar", canEdit: true };
    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue(mockCalendar);

    const result = await getCalendar(client, "cal1");

    expect(client.api).toHaveBeenCalledWith("/me/calendars/cal1");
    expect(result).toEqual(mockCalendar);
  });
});

describe("createCalendar", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should create a calendar", async () => {
    const mockCalendar = { id: "cal-new", name: "Project Calendar" };
    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue(mockCalendar);

    const result = await createCalendar(client, "Project Calendar");

    expect(client.api).toHaveBeenCalledWith("/me/calendars");
    expect(mockRequest.post).toHaveBeenCalledWith({ name: "Project Calendar" });
    expect(result).toEqual(mockCalendar);
  });

  it("should create a calendar with color", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue({ id: "cal-new" });

    await createCalendar(client, "Team Calendar", "lightBlue");

    expect(mockRequest.post).toHaveBeenCalledWith({
      name: "Team Calendar",
      color: "lightBlue",
    });
  });
});

describe("deleteCalendar", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should delete a calendar", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.delete.mockResolvedValue(undefined);

    await deleteCalendar(client, "cal1");

    expect(client.api).toHaveBeenCalledWith("/me/calendars/cal1");
    expect(mockRequest.delete).toHaveBeenCalled();
  });
});

// =============================================================================
// SCHEDULING TESTS
// =============================================================================

describe("findMeetingTimes", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should find available meeting times", async () => {
    const mockSuggestions = [
      {
        confidence: 100,
        organizerAvailability: "free",
        meetingTimeSlot: {
          start: { dateTime: "2024-01-15T14:00:00", timeZone: "UTC" },
          end: { dateTime: "2024-01-15T14:30:00", timeZone: "UTC" },
        },
      },
    ];

    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue({ meetingTimeSuggestions: mockSuggestions });

    const result = await findMeetingTimes(
      client,
      ["user@example.com"],
      {
        startDateTime: "2024-01-15T09:00:00",
        endDateTime: "2024-01-15T17:00:00",
        timeZone: "UTC",
      },
      30,
    );

    expect(client.api).toHaveBeenCalledWith("/me/findMeetingTimes");
    expect(result).toEqual(mockSuggestions);
  });
});

describe("getSchedule", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should get free/busy schedule", async () => {
    const mockSchedules = [
      {
        scheduleId: "user@example.com",
        availabilityView: "0022000",
        scheduleItems: [
          {
            status: "busy",
            start: { dateTime: "2024-01-15T10:00:00", timeZone: "UTC" },
            end: { dateTime: "2024-01-15T11:00:00", timeZone: "UTC" },
          },
        ],
      },
    ];

    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue({ value: mockSchedules });

    const result = await getSchedule(
      client,
      ["user@example.com"],
      "2024-01-15T09:00:00",
      "2024-01-15T17:00:00",
      "UTC",
    );

    expect(client.api).toHaveBeenCalledWith("/me/calendar/getSchedule");
    expect(result).toEqual(mockSchedules);
  });
});
