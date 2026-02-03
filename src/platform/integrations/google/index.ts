/**
 * Google Workspace Integration
 *
 * Integration modules for Google Workspace services:
 * - Auth (OAuth 2.0, service accounts, token storage)
 * - Drive (files, folders, shared drives)
 * - Gmail (email, threads, labels)
 * - Calendar (events, scheduling)
 *
 * @example
 * ```typescript
 * import { auth, calendar, drive, gmail } from './google';
 *
 * // Create OAuth client
 * const authClient = new auth.GoogleAuthClient({
 *   clientId: process.env.GOOGLE_CLIENT_ID,
 *   clientSecret: process.env.GOOGLE_CLIENT_SECRET,
 * });
 *
 * // Calendar operations
 * const calendarClient = new calendar.GoogleCalendarClient({ auth: authClient });
 * const events = await calendarClient.listEvents({
 *   timeMin: new Date(),
 *   singleEvents: true,
 * });
 *
 * // Drive operations
 * const driveClient = new drive.GoogleDriveClient({ auth: authClient });
 * const files = await driveClient.listFiles();
 *
 * // Gmail operations
 * const gmailClient = new gmail.GmailClient({ auth: authClient });
 * const messages = await gmailClient.listMessages({ query: 'is:unread' });
 * ```
 */

// =============================================================================
// NAMESPACED EXPORTS (avoid type conflicts between modules)
// =============================================================================

import * as auth from "./auth/index.js";
import * as calendar from "./calendar/index.js";
import * as drive from "./drive/index.js";
import * as gmail from "./gmail/index.js";

export { auth, drive, gmail, calendar };
