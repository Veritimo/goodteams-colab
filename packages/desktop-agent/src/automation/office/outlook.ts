/**
 * Outlook Automation
 *
 * High-level API for Outlook automation via COM bindings.
 * Provides email, calendar, and contact operations.
 */

import {
  getBindings,
  type IOutlookBindings,
  OfficeNotInstalledError,
  COMError,
} from './bindings.js';
import type {
  OutlookMailItem,
  OutlookCalendarItem,
  OutlookContact,
  OutlookFolder,
  OutlookEventOptions,
  OutlookSendOptions,
} from './types.js';

/**
 * Get Outlook bindings
 */
function getOutlook(): IOutlookBindings {
  return getBindings().outlook;
}

// ============================================================================
// Availability
// ============================================================================

/**
 * Check if Outlook is available on this system
 */
export async function isOutlookAvailable(): Promise<boolean> {
  try {
    return await getOutlook().isAvailable();
  } catch {
    return false;
  }
}

/**
 * Ensure Outlook is available, throw if not
 */
async function ensureOutlookAvailable(): Promise<IOutlookBindings> {
  const outlook = getOutlook();
  const available = await outlook.isAvailable();
  if (!available) {
    throw new OfficeNotInstalledError('Outlook');
  }
  return outlook;
}

// ============================================================================
// Folder Operations
// ============================================================================

/**
 * List all mail folders
 *
 * @returns Array of mail folders with subfolders
 *
 * @example
 * ```ts
 * const folders = await listFolders();
 * folders.forEach(f => {
 *   console.log(`${f.name}: ${f.itemCount} items (${f.unreadCount} unread)`);
 * });
 * ```
 */
export async function listFolders(): Promise<OutlookFolder[]> {
  const outlook = await ensureOutlookAvailable();
  return outlook.listFolders();
}

/**
 * Find a folder by name
 *
 * @param name - Folder name to find
 * @returns The folder or undefined if not found
 */
export async function findFolder(name: string): Promise<OutlookFolder | undefined> {
  const folders = await listFolders();

  const search = (list: OutlookFolder[]): OutlookFolder | undefined => {
    for (const folder of list) {
      if (folder.name.toLowerCase() === name.toLowerCase()) {
        return folder;
      }
      const found = search(folder.subfolders);
      if (found) return found;
    }
    return undefined;
  };

  return search(folders);
}

// ============================================================================
// Mail Operations
// ============================================================================

/**
 * List mail items from a folder
 *
 * @param folderName - Folder name (default: "Inbox")
 * @param count - Maximum number of items to return (default: 50)
 * @returns Array of mail items
 *
 * @example
 * ```ts
 * const emails = await listMail(); // Latest 50 from Inbox
 * const sent = await listMail('Sent Items', 20);
 * ```
 */
export async function listMail(
  folderName?: string,
  count?: number
): Promise<OutlookMailItem[]> {
  const outlook = await ensureOutlookAvailable();
  return outlook.listMail(folderName, count);
}

/**
 * Get a specific mail item by entry ID
 *
 * @param entryId - The unique entry ID of the mail
 * @returns The mail item
 *
 * @example
 * ```ts
 * const mail = await getMail('000000004A...');
 * console.log(`Subject: ${mail.subject}`);
 * console.log(`From: ${mail.from}`);
 * ```
 */
export async function getMail(entryId: string): Promise<OutlookMailItem> {
  const outlook = await ensureOutlookAvailable();
  return outlook.getMail(entryId);
}

/**
 * Send a new email
 *
 * @param to - Recipient(s)
 * @param subject - Email subject
 * @param body - Email body
 * @param attachments - Optional file paths to attach
 *
 * @example
 * ```ts
 * await sendMail('alice@example.com', 'Hello', 'How are you?');
 *
 * await sendMail(
 *   ['alice@example.com', 'bob@example.com'],
 *   'Report',
 *   '<h1>Quarterly Report</h1>',
 *   ['C:\\Reports\\Q4.pdf']
 * );
 * ```
 */
export async function sendMail(
  to: string | string[],
  subject: string,
  body: string,
  attachments?: string[]
): Promise<void> {
  const outlook = await ensureOutlookAvailable();
  return outlook.sendMail({
    to,
    subject,
    body,
    isHtml: body.includes('<'),
    attachments,
  });
}

/**
 * Send an email with full options
 *
 * @param options - Full send options including CC, BCC, importance
 *
 * @example
 * ```ts
 * await sendMailWithOptions({
 *   to: 'alice@example.com',
 *   cc: 'manager@example.com',
 *   subject: 'Urgent: Action Required',
 *   body: 'Please review ASAP.',
 *   importance: 'high',
 * });
 * ```
 */
export async function sendMailWithOptions(options: OutlookSendOptions): Promise<void> {
  const outlook = await ensureOutlookAvailable();
  return outlook.sendMail(options);
}

/**
 * Reply to an email
 *
 * @param entryId - Entry ID of the email to reply to
 * @param body - Reply body
 * @param replyAll - Whether to reply to all recipients (default: false)
 *
 * @example
 * ```ts
 * await replyToMail(mail.entryId, 'Thanks for your message!');
 * await replyToMail(mail.entryId, 'Noted.', true); // Reply all
 * ```
 */
export async function replyToMail(
  entryId: string,
  body: string,
  replyAll?: boolean
): Promise<void> {
  const outlook = await ensureOutlookAvailable();
  return outlook.replyToMail(entryId, body, replyAll);
}

// ============================================================================
// Calendar Operations
// ============================================================================

/**
 * List calendar events in a date range
 *
 * @param start - Start of date range
 * @param end - End of date range
 * @returns Array of calendar events
 *
 * @example
 * ```ts
 * const today = new Date();
 * const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
 * const events = await listCalendarEvents(today, nextWeek);
 * ```
 */
export async function listCalendarEvents(
  start: Date,
  end: Date
): Promise<OutlookCalendarItem[]> {
  const outlook = await ensureOutlookAvailable();
  return outlook.listCalendarEvents(start, end);
}

/**
 * Get today's calendar events
 *
 * @returns Array of today's events
 *
 * @example
 * ```ts
 * const events = await getTodaysEvents();
 * events.forEach(e => console.log(`${e.start.toLocaleTimeString()}: ${e.subject}`));
 * ```
 */
export async function getTodaysEvents(): Promise<OutlookCalendarItem[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  return listCalendarEvents(today, tomorrow);
}

/**
 * Get upcoming events for the next N days
 *
 * @param days - Number of days to look ahead (default: 7)
 * @returns Array of upcoming events
 *
 * @example
 * ```ts
 * const events = await getUpcomingEvents(14); // Next 2 weeks
 * ```
 */
export async function getUpcomingEvents(days: number = 7): Promise<OutlookCalendarItem[]> {
  const start = new Date();
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  return listCalendarEvents(start, end);
}

/**
 * Create a new calendar event
 *
 * @param options - Event details
 * @returns The created event
 *
 * @example
 * ```ts
 * const event = await createCalendarEvent({
 *   subject: 'Team Meeting',
 *   start: new Date('2024-01-15T10:00:00'),
 *   end: new Date('2024-01-15T11:00:00'),
 *   location: 'Conference Room A',
 *   requiredAttendees: ['alice@example.com', 'bob@example.com'],
 * });
 * ```
 */
export async function createCalendarEvent(
  options: OutlookEventOptions
): Promise<OutlookCalendarItem> {
  const outlook = await ensureOutlookAvailable();
  return outlook.createCalendarEvent(options);
}

/**
 * Schedule a meeting with simple parameters
 *
 * @param subject - Meeting subject
 * @param start - Start time
 * @param durationMinutes - Duration in minutes
 * @param attendees - List of attendee emails
 * @param location - Optional location
 *
 * @example
 * ```ts
 * await scheduleMeeting(
 *   '1:1 with Alice',
 *   new Date('2024-01-15T14:00:00'),
 *   30,
 *   ['alice@example.com']
 * );
 * ```
 */
export async function scheduleMeeting(
  subject: string,
  start: Date,
  durationMinutes: number,
  attendees: string[],
  location?: string
): Promise<OutlookCalendarItem> {
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return createCalendarEvent({
    subject,
    start,
    end,
    location,
    requiredAttendees: attendees,
  });
}

// ============================================================================
// Contact Operations
// ============================================================================

/**
 * List all contacts
 *
 * @returns Array of contacts
 *
 * @example
 * ```ts
 * const contacts = await listContacts();
 * contacts.forEach(c => console.log(`${c.fullName}: ${c.email}`));
 * ```
 */
export async function listContacts(): Promise<OutlookContact[]> {
  const outlook = await ensureOutlookAvailable();
  return outlook.listContacts();
}

/**
 * Find a contact by name or email
 *
 * @param query - Name or email to search for
 * @returns Matching contacts
 *
 * @example
 * ```ts
 * const results = await findContacts('alice');
 * const results = await findContacts('@example.com');
 * ```
 */
export async function findContacts(query: string): Promise<OutlookContact[]> {
  const contacts = await listContacts();
  const lowerQuery = query.toLowerCase();

  return contacts.filter(
    (c) =>
      c.fullName.toLowerCase().includes(lowerQuery) ||
      c.email.toLowerCase().includes(lowerQuery) ||
      c.company?.toLowerCase().includes(lowerQuery)
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get unread mail count
 *
 * @param folderName - Folder to check (default: "Inbox")
 * @returns Number of unread messages
 *
 * @example
 * ```ts
 * const unread = await getUnreadCount();
 * console.log(`You have ${unread} unread messages`);
 * ```
 */
export async function getUnreadCount(folderName: string = 'Inbox'): Promise<number> {
  const folder = await findFolder(folderName);
  return folder?.unreadCount ?? 0;
}

/**
 * Get unread emails from inbox
 *
 * @param count - Maximum number to return
 * @returns Array of unread mail items
 */
export async function getUnreadMail(count: number = 50): Promise<OutlookMailItem[]> {
  const mail = await listMail('Inbox', count);
  return mail.filter((m) => !m.isRead);
}

/**
 * Check for new mail since a given date
 *
 * @param since - Date to check from
 * @returns Array of new mail items
 */
export async function getMailSince(since: Date): Promise<OutlookMailItem[]> {
  const mail = await listMail('Inbox', 100);
  return mail.filter((m) => m.received > since);
}

// Re-export types
export type {
  OutlookMailItem,
  OutlookCalendarItem,
  OutlookContact,
  OutlookFolder,
  OutlookEventOptions,
  OutlookSendOptions,
};
export { OfficeNotInstalledError, COMError };
