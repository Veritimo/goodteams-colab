/**
 * Outlook Automation Tests
 *
 * Tests for Outlook COM automation using mock bindings.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setUseMockBindings,
  resetBindings,
  resetMockDataStore,
  getMockDataStore,
} from '../../../src/automation/office/bindings.js';
import {
  isOutlookAvailable,
  listFolders,
  findFolder,
  listMail,
  getMail,
  sendMail,
  sendMailWithOptions,
  replyToMail,
  listCalendarEvents,
  getTodaysEvents,
  getUpcomingEvents,
  createCalendarEvent,
  scheduleMeeting,
  listContacts,
  findContacts,
  getUnreadCount,
  getUnreadMail,
  getMailSince,
  OfficeNotInstalledError,
} from '../../../src/automation/office/outlook.js';
import type { OutlookContact } from '../../../src/automation/office/types.js';

describe('Outlook Automation', () => {
  beforeEach(() => {
    setUseMockBindings(true);
    resetMockDataStore();
  });

  afterEach(() => {
    resetBindings();
    resetMockDataStore();
  });

  describe('isOutlookAvailable', () => {
    it('should return true when mock bindings are used', async () => {
      const available = await isOutlookAvailable();
      expect(available).toBe(true);
    });
  });

  describe('listFolders', () => {
    it('should list default mail folders', async () => {
      const folders = await listFolders();

      expect(folders).toBeDefined();
      expect(folders.length).toBeGreaterThan(0);

      const folderNames = folders.map((f) => f.name);
      expect(folderNames).toContain('Inbox');
      expect(folderNames).toContain('Sent Items');
      expect(folderNames).toContain('Drafts');
    });

    it('should include folder metadata', async () => {
      const folders = await listFolders();
      const inbox = folders.find((f) => f.name === 'Inbox');

      expect(inbox).toBeDefined();
      expect(inbox!.type).toBe('inbox');
      expect(typeof inbox!.itemCount).toBe('number');
      expect(typeof inbox!.unreadCount).toBe('number');
    });
  });

  describe('findFolder', () => {
    it('should find folder by name (case insensitive)', async () => {
      const folder = await findFolder('inbox');

      expect(folder).toBeDefined();
      expect(folder!.name).toBe('Inbox');
    });

    it('should return undefined for non-existent folder', async () => {
      const folder = await findFolder('NonExistent');
      expect(folder).toBeUndefined();
    });
  });

  describe('sendMail', () => {
    it('should send a simple email', async () => {
      await sendMail('alice@example.com', 'Hello', 'How are you?');

      const mail = await listMail();
      expect(mail.length).toBeGreaterThan(0);
    });

    it('should send email to multiple recipients', async () => {
      await sendMail(['alice@example.com', 'bob@example.com'], 'Group Hello', 'Hi everyone!');

      const mail = await listMail();
      const sent = mail.find((m) => m.subject === 'Group Hello');

      expect(sent).toBeDefined();
      expect(sent!.to).toContain('alice@example.com');
      expect(sent!.to).toContain('bob@example.com');
    });

    it('should detect HTML content', async () => {
      await sendMail('alice@example.com', 'HTML Test', '<h1>Hello</h1>');

      const mail = await listMail();
      const sent = mail.find((m) => m.subject === 'HTML Test');

      expect(sent!.isHtml).toBe(true);
    });
  });

  describe('sendMailWithOptions', () => {
    it('should send email with CC and BCC', async () => {
      await sendMailWithOptions({
        to: 'alice@example.com',
        cc: 'manager@example.com',
        bcc: 'archive@example.com',
        subject: 'Full Options',
        body: 'Test email',
      });

      const mail = await listMail();
      const sent = mail.find((m) => m.subject === 'Full Options');

      expect(sent).toBeDefined();
      expect(sent!.cc).toContain('manager@example.com');
    });

    it('should set importance', async () => {
      await sendMailWithOptions({
        to: 'boss@example.com',
        subject: 'Urgent',
        body: 'Please respond ASAP',
        importance: 'high',
      });

      const mail = await listMail();
      const sent = mail.find((m) => m.subject === 'Urgent');

      expect(sent!.importance).toBe('high');
    });
  });

  describe('getMail / replyToMail', () => {
    it('should get a specific mail item', async () => {
      await sendMail('test@example.com', 'Test Subject', 'Test Body');

      const mail = await listMail();
      const entryId = mail[0].entryId;

      const item = await getMail(entryId);

      expect(item.entryId).toBe(entryId);
      expect(item.subject).toBe('Test Subject');
    });

    it('should reply to an email', async () => {
      await sendMail('alice@example.com', 'Original', 'Original message');

      const mail = await listMail();
      const original = mail[0];

      await replyToMail(original.entryId, 'Thanks for your message!');

      const allMail = await listMail();
      const reply = allMail.find((m) => m.subject.startsWith('RE:'));

      expect(reply).toBeDefined();
      expect(reply!.subject).toBe('RE: Original');
    });

    it('should throw for non-existent mail', async () => {
      await expect(getMail('nonexistent-id')).rejects.toThrow();
    });
  });

  describe('listCalendarEvents', () => {
    it('should list events in date range', async () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');

      const events = await listCalendarEvents(start, end);

      expect(Array.isArray(events)).toBe(true);
    });

    it('should filter events by date range', async () => {
      await createCalendarEvent({
        subject: 'January Meeting',
        start: new Date('2024-01-15T10:00:00'),
        end: new Date('2024-01-15T11:00:00'),
      });

      await createCalendarEvent({
        subject: 'February Meeting',
        start: new Date('2024-02-15T10:00:00'),
        end: new Date('2024-02-15T11:00:00'),
      });

      const januaryEvents = await listCalendarEvents(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(januaryEvents.some((e) => e.subject === 'January Meeting')).toBe(true);
      expect(januaryEvents.some((e) => e.subject === 'February Meeting')).toBe(false);
    });
  });

  describe('createCalendarEvent', () => {
    it('should create a calendar event', async () => {
      const event = await createCalendarEvent({
        subject: 'Team Meeting',
        start: new Date('2024-01-15T10:00:00'),
        end: new Date('2024-01-15T11:00:00'),
        location: 'Conference Room A',
      });

      expect(event).toBeDefined();
      expect(event.subject).toBe('Team Meeting');
      expect(event.location).toBe('Conference Room A');
      expect(event.entryId).toBeDefined();
    });

    it('should set default values', async () => {
      const event = await createCalendarEvent({
        subject: 'Quick Chat',
        start: new Date('2024-01-15T10:00:00'),
        end: new Date('2024-01-15T10:30:00'),
      });

      expect(event.busyStatus).toBe('busy');
      expect(event.reminderMinutes).toBe(15);
      expect(event.isAllDay).toBe(false);
    });

    it('should include attendees', async () => {
      const event = await createCalendarEvent({
        subject: 'Project Review',
        start: new Date('2024-01-15T14:00:00'),
        end: new Date('2024-01-15T15:00:00'),
        requiredAttendees: ['alice@example.com', 'bob@example.com'],
        optionalAttendees: ['charlie@example.com'],
      });

      expect(event.requiredAttendees).toContain('alice@example.com');
      expect(event.optionalAttendees).toContain('charlie@example.com');
    });
  });

  describe('getTodaysEvents', () => {
    it('should return events for today', async () => {
      const today = new Date();
      today.setHours(14, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(15, 0, 0, 0);

      await createCalendarEvent({
        subject: 'Today Meeting',
        start: today,
        end: todayEnd,
      });

      const events = await getTodaysEvents();

      expect(events.some((e) => e.subject === 'Today Meeting')).toBe(true);
    });
  });

  describe('getUpcomingEvents', () => {
    it('should return events for next N days', async () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 5);
      nextWeek.setHours(10, 0, 0, 0);
      const nextWeekEnd = new Date(nextWeek);
      nextWeekEnd.setHours(11, 0, 0, 0);

      await createCalendarEvent({
        subject: 'Next Week Meeting',
        start: nextWeek,
        end: nextWeekEnd,
      });

      const events = await getUpcomingEvents(7);

      expect(events.some((e) => e.subject === 'Next Week Meeting')).toBe(true);
    });
  });

  describe('scheduleMeeting', () => {
    it('should schedule a meeting with simple params', async () => {
      const start = new Date('2024-01-15T14:00:00');

      const event = await scheduleMeeting(
        '1:1 with Alice',
        start,
        30,
        ['alice@example.com'],
        'Room 101'
      );

      expect(event.subject).toBe('1:1 with Alice');
      expect(event.requiredAttendees).toContain('alice@example.com');
      expect(event.location).toBe('Room 101');

      // Check duration (30 minutes)
      const duration = event.end.getTime() - event.start.getTime();
      expect(duration).toBe(30 * 60 * 1000);
    });
  });

  describe('listContacts / findContacts', () => {
    it('should list all contacts', async () => {
      const contacts = await listContacts();
      expect(Array.isArray(contacts)).toBe(true);
    });

    it('should find contacts by name or email', async () => {
      // Add a mock contact
      const store = getMockDataStore();
      const contact: OutlookContact = {
        entryId: 'contact-1',
        fullName: 'Alice Smith',
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@example.com',
        emails: ['alice@example.com'],
        phones: { mobile: '555-1234' },
        company: 'Acme Corp',
      };
      store.contacts.set(contact.entryId, contact);

      const byName = await findContacts('alice');
      expect(byName.length).toBeGreaterThan(0);
      expect(byName[0].fullName).toBe('Alice Smith');

      const byEmail = await findContacts('@example.com');
      expect(byEmail.length).toBeGreaterThan(0);

      const byCompany = await findContacts('Acme');
      expect(byCompany.length).toBeGreaterThan(0);
    });
  });

  describe('getUnreadCount / getUnreadMail', () => {
    it('should get unread count', async () => {
      const count = await getUnreadCount();
      expect(typeof count).toBe('number');
    });

    it('should get unread mail', async () => {
      // Send some mail with different read states
      await sendMail('test@example.com', 'Read', 'Body');
      await sendMail('test@example.com', 'Unread', 'Body');

      // Mark one as unread
      const mail = await listMail();
      mail[1].isRead = false;

      const unread = await getUnreadMail();
      expect(Array.isArray(unread)).toBe(true);
    });
  });

  describe('getMailSince', () => {
    it('should get mail received since a date', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await sendMail('test@example.com', 'Recent', 'Body');

      const recentMail = await getMailSince(yesterday);
      expect(recentMail.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle OfficeNotInstalledError', async () => {
      setUseMockBindings(false);
      resetBindings();

      if (process.platform !== 'win32') {
        await expect(listFolders()).rejects.toThrow(OfficeNotInstalledError);
      }
    });
  });
});
