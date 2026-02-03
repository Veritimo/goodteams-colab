/**
 * Office COM Automation Types
 *
 * TypeScript interfaces for Office COM automation layer.
 * These types provide a type-safe abstraction over COM objects.
 */

// ============================================================================
// Excel Types
// ============================================================================

/**
 * Represents an Excel workbook
 */
export interface ExcelWorkbook {
  /** Workbook name (e.g., "Book1.xlsx") */
  name: string;
  /** Full file path, null if not saved */
  path: string | null;
  /** List of worksheets in the workbook */
  sheets: ExcelSheet[];
  /** Whether the workbook has unsaved changes */
  isDirty: boolean;
  /** Internal COM handle (opaque) */
  _handle?: unknown;
}

/**
 * Represents an Excel worksheet
 */
export interface ExcelSheet {
  /** Sheet name (tab name) */
  name: string;
  /** Zero-based index in the workbook */
  index: number;
  /** Address of the used range (e.g., "A1:D10") */
  usedRange: string;
  /** Whether the sheet is visible */
  visible: boolean;
  /** Reference to parent workbook */
  workbook?: ExcelWorkbook;
  /** Internal COM handle (opaque) */
  _handle?: unknown;
}

/**
 * Represents a range of Excel cells
 */
export interface ExcelRange {
  /** Range address (e.g., "A1:C10" or "Sheet1!A1:C10") */
  address: string;
  /** 2D array of cell values (row-major order) */
  values: unknown[][];
  /** 2D array of formulas (if requested) */
  formulas?: string[][];
  /** Number of rows in the range */
  rowCount: number;
  /** Number of columns in the range */
  columnCount: number;
  /** Reference to parent sheet */
  sheet?: ExcelSheet;
}

/**
 * Options for opening an Excel workbook
 */
export interface ExcelOpenOptions {
  /** Open as read-only */
  readOnly?: boolean;
  /** Password if protected */
  password?: string;
  /** Update links on open */
  updateLinks?: boolean;
}

/**
 * Options for saving an Excel workbook
 */
export interface ExcelSaveOptions {
  /** File format (xlsx, xls, csv, pdf) */
  format?: 'xlsx' | 'xls' | 'xlsm' | 'csv' | 'pdf';
  /** Password to protect */
  password?: string;
}

// ============================================================================
// Word Types
// ============================================================================

/**
 * Represents a Word document
 */
export interface WordDocument {
  /** Document name (e.g., "Document1.docx") */
  name: string;
  /** Full file path, null if not saved */
  path: string | null;
  /** Full document text content */
  content: string;
  /** Word count */
  wordCount: number;
  /** Page count */
  pageCount: number;
  /** Whether the document has unsaved changes */
  isDirty: boolean;
  /** Internal COM handle (opaque) */
  _handle?: unknown;
}

/**
 * Represents a search/find result in Word
 */
export interface WordFindResult {
  /** The found text */
  text: string;
  /** Start position in document */
  start: number;
  /** End position in document */
  end: number;
  /** Page number where found */
  page: number;
}

/**
 * Options for Word document operations
 */
export interface WordOpenOptions {
  /** Open as read-only */
  readOnly?: boolean;
  /** Password if protected */
  password?: string;
}

/**
 * Insert position for Word operations
 */
export interface WordInsertPosition {
  /** Insert at start, end, or specific position */
  at: 'start' | 'end' | 'cursor' | number;
}

/**
 * Save format options for Word
 */
export type WordSaveFormat = 'docx' | 'doc' | 'pdf' | 'rtf' | 'txt' | 'html';

// ============================================================================
// Outlook Types
// ============================================================================

/**
 * Represents an Outlook mail item
 */
export interface OutlookMailItem {
  /** Unique entry ID */
  entryId: string;
  /** Email subject */
  subject: string;
  /** Sender email/name */
  from: string;
  /** Recipients (To field) */
  to: string[];
  /** CC recipients */
  cc: string[];
  /** BCC recipients (only for sent items) */
  bcc: string[];
  /** Email body (HTML or plain text) */
  body: string;
  /** Whether body is HTML */
  isHtml: boolean;
  /** Date/time received */
  received: Date;
  /** Date/time sent */
  sent?: Date;
  /** Whether the email is read */
  isRead: boolean;
  /** Importance level */
  importance: 'low' | 'normal' | 'high';
  /** Attachment names */
  attachments: string[];
  /** Conversation ID */
  conversationId?: string;
}

/**
 * Represents an Outlook calendar event
 */
export interface OutlookCalendarItem {
  /** Unique entry ID */
  entryId: string;
  /** Event subject/title */
  subject: string;
  /** Event start time */
  start: Date;
  /** Event end time */
  end: Date;
  /** Event location */
  location: string;
  /** Event body/description */
  body: string;
  /** Whether it's an all-day event */
  isAllDay: boolean;
  /** Whether this is a recurring event */
  isRecurring: boolean;
  /** Organizer email */
  organizer: string;
  /** Required attendees */
  requiredAttendees: string[];
  /** Optional attendees */
  optionalAttendees: string[];
  /** Busy status */
  busyStatus: 'free' | 'tentative' | 'busy' | 'outOfOffice';
  /** Reminder minutes before */
  reminderMinutes?: number;
}

/**
 * Represents an Outlook contact
 */
export interface OutlookContact {
  /** Unique entry ID */
  entryId: string;
  /** Full name */
  fullName: string;
  /** First name */
  firstName: string;
  /** Last name */
  lastName: string;
  /** Primary email */
  email: string;
  /** Additional emails */
  emails: string[];
  /** Phone numbers */
  phones: {
    business?: string;
    home?: string;
    mobile?: string;
  };
  /** Company name */
  company?: string;
  /** Job title */
  jobTitle?: string;
}

/**
 * Represents an Outlook mail folder
 */
export interface OutlookFolder {
  /** Folder name */
  name: string;
  /** Full folder path */
  path: string;
  /** Number of items in folder */
  itemCount: number;
  /** Number of unread items */
  unreadCount: number;
  /** Folder type */
  type: 'inbox' | 'sent' | 'drafts' | 'deleted' | 'junk' | 'outbox' | 'custom';
  /** Child folders */
  subfolders: OutlookFolder[];
}

/**
 * Options for creating a calendar event
 */
export interface OutlookEventOptions {
  /** Event subject */
  subject: string;
  /** Start time */
  start: Date;
  /** End time */
  end: Date;
  /** Location (optional) */
  location?: string;
  /** Description/body (optional) */
  body?: string;
  /** Is all-day event */
  isAllDay?: boolean;
  /** Required attendees */
  requiredAttendees?: string[];
  /** Optional attendees */
  optionalAttendees?: string[];
  /** Reminder minutes before (default: 15) */
  reminderMinutes?: number;
  /** Busy status */
  busyStatus?: 'free' | 'tentative' | 'busy' | 'outOfOffice';
}

/**
 * Options for sending email
 */
export interface OutlookSendOptions {
  /** Recipients (To) */
  to: string | string[];
  /** Subject */
  subject: string;
  /** Body content */
  body: string;
  /** Is body HTML? */
  isHtml?: boolean;
  /** CC recipients */
  cc?: string | string[];
  /** BCC recipients */
  bcc?: string | string[];
  /** File paths to attach */
  attachments?: string[];
  /** Importance */
  importance?: 'low' | 'normal' | 'high';
}

// ============================================================================
// PowerPoint Types
// ============================================================================

/**
 * Represents a PowerPoint presentation
 */
export interface PowerPointPresentation {
  /** Presentation name */
  name: string;
  /** Full file path, null if not saved */
  path: string | null;
  /** Number of slides */
  slideCount: number;
  /** Whether the presentation has unsaved changes */
  isDirty: boolean;
  /** Internal COM handle (opaque) */
  _handle?: unknown;
}

/**
 * Represents a PowerPoint slide
 */
export interface PowerPointSlide {
  /** One-based slide index */
  index: number;
  /** Slide layout name */
  layout: string;
  /** Slide title (if present) */
  title?: string;
  /** All text content on the slide */
  textContent: string;
  /** Notes text */
  notes?: string;
  /** Reference to parent presentation */
  presentation?: PowerPointPresentation;
  /** Internal COM handle (opaque) */
  _handle?: unknown;
}

/**
 * Slide layout options
 */
export type SlideLayout =
  | 'title'
  | 'titleAndContent'
  | 'sectionHeader'
  | 'twoContent'
  | 'comparison'
  | 'titleOnly'
  | 'blank'
  | 'contentWithCaption'
  | 'pictureWithCaption';

/**
 * Options for opening a presentation
 */
export interface PowerPointOpenOptions {
  /** Open as read-only */
  readOnly?: boolean;
  /** Open with window visible */
  withWindow?: boolean;
}

// ============================================================================
// Common Types
// ============================================================================

/**
 * Error thrown when Office is not installed
 */
export class OfficeNotInstalledError extends Error {
  readonly application: 'Excel' | 'Word' | 'Outlook' | 'PowerPoint';

  constructor(application: 'Excel' | 'Word' | 'Outlook' | 'PowerPoint') {
    super(`${application} is not installed or not available on this system`);
    this.name = 'OfficeNotInstalledError';
    this.application = application;
  }
}

/**
 * Error thrown for COM automation failures
 */
export class COMError extends Error {
  readonly code: number;
  readonly source: string;

  constructor(message: string, code: number, source: string) {
    super(message);
    this.name = 'COMError';
    this.code = code;
    this.source = source;
  }
}

/**
 * Result of a COM operation
 */
export type COMResult<T> =
  | { success: true; value: T }
  | { success: false; error: COMError | OfficeNotInstalledError };

/**
 * Office application types
 */
export type OfficeApplication = 'Excel' | 'Word' | 'Outlook' | 'PowerPoint';
