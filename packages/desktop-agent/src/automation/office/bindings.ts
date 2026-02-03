/**
 * Office COM Bindings
 *
 * Abstract interface for Office COM automation with factory pattern.
 * Supports real COM bindings (via edge.js on Windows) and mock bindings for testing.
 */

import {
  type ExcelWorkbook,
  type ExcelSheet,
  type ExcelRange,
  type ExcelOpenOptions,
  type ExcelSaveOptions,
  type WordDocument,
  type WordFindResult,
  type WordOpenOptions,
  type WordSaveFormat,
  type WordInsertPosition,
  type OutlookMailItem,
  type OutlookCalendarItem,
  type OutlookContact,
  type OutlookFolder,
  type OutlookEventOptions,
  type OutlookSendOptions,
  type PowerPointPresentation,
  type PowerPointSlide,
  type SlideLayout,
  type PowerPointOpenOptions,
  OfficeNotInstalledError,
  COMError,
  type OfficeApplication,
} from './types.js';

// ============================================================================
// Excel Bindings Interface
// ============================================================================

/**
 * Abstract interface for Excel COM operations
 */
export interface IExcelBindings {
  /** Check if Excel is available */
  isAvailable(): Promise<boolean>;

  /** Open an existing workbook */
  openWorkbook(path: string, options?: ExcelOpenOptions): Promise<ExcelWorkbook>;

  /** Create a new workbook */
  createWorkbook(): Promise<ExcelWorkbook>;

  /** Get the currently active workbook */
  getActiveWorkbook(): Promise<ExcelWorkbook | null>;

  /** Close a workbook */
  closeWorkbook(workbook: ExcelWorkbook, save?: boolean): Promise<void>;

  /** Save a workbook */
  saveWorkbook(workbook: ExcelWorkbook, path?: string, options?: ExcelSaveOptions): Promise<void>;

  /** List all sheets in a workbook */
  listSheets(workbook: ExcelWorkbook): Promise<ExcelSheet[]>;

  /** Get a specific sheet by name or index */
  getSheet(workbook: ExcelWorkbook, nameOrIndex: string | number): Promise<ExcelSheet>;

  /** Read a range of cells */
  readRange(sheet: ExcelSheet, address: string): Promise<ExcelRange>;

  /** Write values to a range of cells */
  writeRange(sheet: ExcelSheet, address: string, values: unknown[][]): Promise<void>;

  /** Read a single cell value */
  readCell(sheet: ExcelSheet, address: string): Promise<unknown>;

  /** Write a single cell value */
  writeCell(sheet: ExcelSheet, address: string, value: unknown): Promise<void>;

  /** Get the used range of a sheet */
  getUsedRange(sheet: ExcelSheet): Promise<ExcelRange>;

  /** Run a VBA macro */
  runMacro(workbook: ExcelWorkbook, macroName: string, args?: unknown[]): Promise<unknown>;

  /** Evaluate a formula and return result */
  evaluateFormula(sheet: ExcelSheet, formula: string): Promise<unknown>;

  /** Quit Excel application */
  quit(): Promise<void>;
}

// ============================================================================
// Word Bindings Interface
// ============================================================================

/**
 * Abstract interface for Word COM operations
 */
export interface IWordBindings {
  /** Check if Word is available */
  isAvailable(): Promise<boolean>;

  /** Open an existing document */
  openDocument(path: string, options?: WordOpenOptions): Promise<WordDocument>;

  /** Create a new document */
  createDocument(): Promise<WordDocument>;

  /** Get the currently active document */
  getActiveDocument(): Promise<WordDocument | null>;

  /** Close a document */
  closeDocument(doc: WordDocument, save?: boolean): Promise<void>;

  /** Get document content as plain text */
  getContent(doc: WordDocument): Promise<string>;

  /** Set/replace entire document content */
  setContent(doc: WordDocument, text: string): Promise<void>;

  /** Insert text at a position */
  insertText(doc: WordDocument, text: string, position?: WordInsertPosition): Promise<void>;

  /** Find text in document */
  find(doc: WordDocument, text: string): Promise<WordFindResult[]>;

  /** Find and replace text */
  replace(doc: WordDocument, findText: string, replaceText: string): Promise<number>;

  /** Save document with optional new path/format */
  saveAs(doc: WordDocument, path: string, format?: WordSaveFormat): Promise<void>;

  /** Quit Word application */
  quit(): Promise<void>;
}

// ============================================================================
// Outlook Bindings Interface
// ============================================================================

/**
 * Abstract interface for Outlook COM operations
 */
export interface IOutlookBindings {
  /** Check if Outlook is available */
  isAvailable(): Promise<boolean>;

  /** List all mail folders */
  listFolders(): Promise<OutlookFolder[]>;

  /** List mail items in a folder */
  listMail(folderName?: string, count?: number): Promise<OutlookMailItem[]>;

  /** Get a specific mail item by entry ID */
  getMail(entryId: string): Promise<OutlookMailItem>;

  /** Send a new email */
  sendMail(options: OutlookSendOptions): Promise<void>;

  /** Reply to an email */
  replyToMail(entryId: string, body: string, replyAll?: boolean): Promise<void>;

  /** List calendar events in a date range */
  listCalendarEvents(start: Date, end: Date): Promise<OutlookCalendarItem[]>;

  /** Create a new calendar event */
  createCalendarEvent(options: OutlookEventOptions): Promise<OutlookCalendarItem>;

  /** List contacts */
  listContacts(): Promise<OutlookContact[]>;

  /** Quit Outlook application */
  quit(): Promise<void>;
}

// ============================================================================
// PowerPoint Bindings Interface
// ============================================================================

/**
 * Abstract interface for PowerPoint COM operations
 */
export interface IPowerPointBindings {
  /** Check if PowerPoint is available */
  isAvailable(): Promise<boolean>;

  /** Open an existing presentation */
  openPresentation(path: string, options?: PowerPointOpenOptions): Promise<PowerPointPresentation>;

  /** Create a new presentation */
  createPresentation(): Promise<PowerPointPresentation>;

  /** Get the currently active presentation */
  getActivePresentation(): Promise<PowerPointPresentation | null>;

  /** Close a presentation */
  closePresentation(presentation: PowerPointPresentation, save?: boolean): Promise<void>;

  /** List all slides in a presentation */
  listSlides(presentation: PowerPointPresentation): Promise<PowerPointSlide[]>;

  /** Get text content from a slide */
  getSlideText(slide: PowerPointSlide): Promise<string>;

  /** Add a new slide */
  addSlide(presentation: PowerPointPresentation, layout?: SlideLayout): Promise<PowerPointSlide>;

  /** Delete a slide */
  deleteSlide(slide: PowerPointSlide): Promise<void>;

  /** Save presentation */
  savePresentation(presentation: PowerPointPresentation, path?: string): Promise<void>;

  /** Quit PowerPoint application */
  quit(): Promise<void>;
}

// ============================================================================
// Combined Office Bindings
// ============================================================================

/**
 * Combined interface for all Office bindings
 */
export interface IOfficeBindings {
  excel: IExcelBindings;
  word: IWordBindings;
  outlook: IOutlookBindings;
  powerpoint: IPowerPointBindings;
}

// ============================================================================
// Binding Registry
// ============================================================================

/** Current bindings instance */
let currentBindings: IOfficeBindings | null = null;

/** Whether to use mock bindings */
let useMockBindings = false;

/**
 * Configure the binding factory to use mock bindings
 */
export function setUseMockBindings(useMock: boolean): void {
  useMockBindings = useMock;
  currentBindings = null; // Reset to force re-creation
}

/**
 * Check if currently using mock bindings
 */
export function isUsingMockBindings(): boolean {
  return useMockBindings;
}

/**
 * Get Office bindings instance (creates if needed)
 */
export function getBindings(): IOfficeBindings {
  if (!currentBindings) {
    if (useMockBindings) {
      currentBindings = createMockBindings();
    } else {
      currentBindings = createRealBindings();
    }
  }
  return currentBindings;
}

/**
 * Reset bindings (for testing)
 */
export function resetBindings(): void {
  currentBindings = null;
}

// ============================================================================
// Real Bindings (Windows COM via edge.js)
// ============================================================================

/**
 * Create real COM bindings for Windows
 */
function createRealBindings(): IOfficeBindings {
  // Check if we're on Windows
  if (process.platform !== 'win32') {
    return createUnavailableBindings('Office COM automation is only available on Windows');
  }

  // Try to load edge.js for COM interop
  // In real implementation, this would use edge.js or similar
  // For now, return unavailable bindings with proper error
  return createUnavailableBindings('edge.js not configured - run on Windows with Office installed');
}

/**
 * Create bindings that always report Office as unavailable
 */
function createUnavailableBindings(reason: string): IOfficeBindings {
  const makeUnavailable = <T extends object>(app: OfficeApplication): T => {
    const throwError = () => {
      throw new OfficeNotInstalledError(app);
    };

    return new Proxy({} as T, {
      get(_, prop) {
        if (prop === 'isAvailable') {
          return async () => false;
        }
        return throwError;
      },
    }) as T;
  };

  console.warn(`Office bindings unavailable: ${reason}`);

  return {
    excel: makeUnavailable<IExcelBindings>('Excel'),
    word: makeUnavailable<IWordBindings>('Word'),
    outlook: makeUnavailable<IOutlookBindings>('Outlook'),
    powerpoint: makeUnavailable<IPowerPointBindings>('PowerPoint'),
  };
}

// ============================================================================
// Mock Bindings (for testing)
// ============================================================================

/** Mock data store for testing */
export interface MockDataStore {
  workbooks: Map<string, ExcelWorkbook>;
  documents: Map<string, WordDocument>;
  presentations: Map<string, PowerPointPresentation>;
  mailItems: Map<string, OutlookMailItem>;
  calendarItems: Map<string, OutlookCalendarItem>;
  contacts: Map<string, OutlookContact>;
  folders: OutlookFolder[];
  activeWorkbook: ExcelWorkbook | null;
  activeDocument: WordDocument | null;
  activePresentation: PowerPointPresentation | null;
}

/** Global mock data store */
let mockDataStore: MockDataStore | null = null;

/**
 * Get or create the mock data store
 */
export function getMockDataStore(): MockDataStore {
  if (!mockDataStore) {
    mockDataStore = {
      workbooks: new Map(),
      documents: new Map(),
      presentations: new Map(),
      mailItems: new Map(),
      calendarItems: new Map(),
      contacts: new Map(),
      folders: [
        {
          name: 'Inbox',
          path: 'Inbox',
          itemCount: 0,
          unreadCount: 0,
          type: 'inbox',
          subfolders: [],
        },
        {
          name: 'Sent Items',
          path: 'Sent Items',
          itemCount: 0,
          unreadCount: 0,
          type: 'sent',
          subfolders: [],
        },
        {
          name: 'Drafts',
          path: 'Drafts',
          itemCount: 0,
          unreadCount: 0,
          type: 'drafts',
          subfolders: [],
        },
      ],
      activeWorkbook: null,
      activeDocument: null,
      activePresentation: null,
    };
  }
  return mockDataStore;
}

/**
 * Reset mock data store (for testing)
 */
export function resetMockDataStore(): void {
  mockDataStore = null;
}

/**
 * Create mock bindings for testing
 */
function createMockBindings(): IOfficeBindings {
  return {
    excel: createMockExcelBindings(),
    word: createMockWordBindings(),
    outlook: createMockOutlookBindings(),
    powerpoint: createMockPowerPointBindings(),
  };
}

function createMockExcelBindings(): IExcelBindings {
  const store = getMockDataStore();
  let workbookCounter = 0;

  return {
    async isAvailable() {
      return true;
    },

    async openWorkbook(path, _options) {
      const existing = store.workbooks.get(path);
      if (existing) {
        store.activeWorkbook = existing;
        return existing;
      }

      const name = path.split(/[\\/]/).pop() || 'Workbook.xlsx';
      const workbook: ExcelWorkbook = {
        name,
        path,
        sheets: [{ name: 'Sheet1', index: 0, usedRange: 'A1', visible: true }],
        isDirty: false,
      };
      store.workbooks.set(path, workbook);
      store.activeWorkbook = workbook;
      return workbook;
    },

    async createWorkbook() {
      workbookCounter++;
      const name = `Book${workbookCounter}.xlsx`;
      const workbook: ExcelWorkbook = {
        name,
        path: null,
        sheets: [{ name: 'Sheet1', index: 0, usedRange: 'A1', visible: true }],
        isDirty: false,
      };
      store.workbooks.set(name, workbook);
      store.activeWorkbook = workbook;
      return workbook;
    },

    async getActiveWorkbook() {
      return store.activeWorkbook;
    },

    async closeWorkbook(workbook, _save) {
      // Don't delete from store - just deactivate (allows re-opening)
      if (store.activeWorkbook === workbook) {
        store.activeWorkbook = null;
      }
    },

    async saveWorkbook(workbook, path, _options) {
      if (path) {
        // Remove old key and add with new path
        const oldKey = workbook.path || workbook.name;
        store.workbooks.delete(oldKey);
        workbook.path = path;
        workbook.name = path.split(/[\\/]/).pop() || workbook.name;
        store.workbooks.set(path, workbook);
      }
      workbook.isDirty = false;
    },

    async listSheets(workbook) {
      return workbook.sheets;
    },

    async getSheet(workbook, nameOrIndex) {
      const sheet =
        typeof nameOrIndex === 'number'
          ? workbook.sheets[nameOrIndex]
          : workbook.sheets.find((s) => s.name === nameOrIndex);

      if (!sheet) {
        throw new COMError(`Sheet not found: ${nameOrIndex}`, -1, 'Excel');
      }
      return sheet;
    },

    async readRange(sheet, address) {
      // Parse address to determine dimensions
      const match = address.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/i);
      let rowCount = 1;
      let colCount = 1;

      if (match) {
        const startCol = colLetterToIndex(match[1]);
        const startRow = parseInt(match[2], 10);
        const endCol = colLetterToIndex(match[3]);
        const endRow = parseInt(match[4], 10);
        rowCount = endRow - startRow + 1;
        colCount = endCol - startCol + 1;
      }

      // Return empty values for mock
      const values: unknown[][] = Array(rowCount)
        .fill(null)
        .map(() => Array(colCount).fill(null));

      return {
        address,
        values,
        rowCount,
        columnCount: colCount,
        sheet,
      };
    },

    async writeRange(sheet, address, values) {
      // Update used range
      const match = address.match(/([A-Z]+)(\d+)/i);
      if (match) {
        const endRow = parseInt(match[2], 10) + values.length - 1;
        const endCol = colIndexToLetter(colLetterToIndex(match[1]) + (values[0]?.length || 1) - 1);
        sheet.usedRange = `A1:${endCol}${endRow}`;
      }
    },

    async readCell(sheet, address) {
      void sheet;
      void address;
      return null;
    },

    async writeCell(sheet, address, value) {
      void sheet;
      void address;
      void value;
    },

    async getUsedRange(sheet) {
      return {
        address: sheet.usedRange,
        values: [[]],
        rowCount: 1,
        columnCount: 1,
        sheet,
      };
    },

    async runMacro(_workbook, macroName, args) {
      // Mock macro execution
      return { executed: macroName, args: args || [] };
    },

    async evaluateFormula(_sheet, formula) {
      // Simple mock evaluation
      if (formula.startsWith('=SUM(')) {
        return 0;
      }
      if (formula.startsWith('=AVERAGE(')) {
        return 0;
      }
      if (formula.startsWith('=')) {
        return formula.slice(1);
      }
      return formula;
    },

    async quit() {
      store.activeWorkbook = null;
      store.workbooks.clear();
    },
  };
}

function createMockWordBindings(): IWordBindings {
  const store = getMockDataStore();
  let docCounter = 0;

  return {
    async isAvailable() {
      return true;
    },

    async openDocument(path, _options) {
      const existing = store.documents.get(path);
      if (existing) {
        store.activeDocument = existing;
        return existing;
      }

      const name = path.split(/[\\/]/).pop() || 'Document.docx';
      const doc: WordDocument = {
        name,
        path,
        content: '',
        wordCount: 0,
        pageCount: 1,
        isDirty: false,
      };
      store.documents.set(path, doc);
      store.activeDocument = doc;
      return doc;
    },

    async createDocument() {
      docCounter++;
      const name = `Document${docCounter}.docx`;
      const doc: WordDocument = {
        name,
        path: null,
        content: '',
        wordCount: 0,
        pageCount: 1,
        isDirty: false,
      };
      store.documents.set(name, doc);
      store.activeDocument = doc;
      return doc;
    },

    async getActiveDocument() {
      return store.activeDocument;
    },

    async closeDocument(doc, _save) {
      // Don't delete from store - just deactivate (allows re-opening)
      if (store.activeDocument === doc) {
        store.activeDocument = null;
      }
    },

    async getContent(doc) {
      return doc.content;
    },

    async setContent(doc, text) {
      doc.content = text;
      doc.wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
      doc.isDirty = true;
    },

    async insertText(doc, text, position) {
      if (!position || position.at === 'end') {
        doc.content += text;
      } else if (position.at === 'start') {
        doc.content = text + doc.content;
      } else if (position.at === 'cursor' || typeof position.at === 'number') {
        const pos = typeof position.at === 'number' ? position.at : doc.content.length;
        doc.content = doc.content.slice(0, pos) + text + doc.content.slice(pos);
      }
      doc.wordCount = doc.content.split(/\s+/).filter((w) => w.length > 0).length;
      doc.isDirty = true;
    },

    async find(doc, text) {
      const results: WordFindResult[] = [];
      let index = 0;
      let pos: number;

      while ((pos = doc.content.indexOf(text, index)) !== -1) {
        results.push({
          text,
          start: pos,
          end: pos + text.length,
          page: 1,
        });
        index = pos + 1;
      }

      return results;
    },

    async replace(doc, findText, replaceText) {
      const regex = new RegExp(escapeRegex(findText), 'g');
      const matches = doc.content.match(regex) || [];
      doc.content = doc.content.replace(regex, replaceText);
      doc.wordCount = doc.content.split(/\s+/).filter((w) => w.length > 0).length;
      if (matches.length > 0) {
        doc.isDirty = true;
      }
      return matches.length;
    },

    async saveAs(doc, path, _format) {
      // Remove old key and add with new path
      const oldKey = doc.path || doc.name;
      store.documents.delete(oldKey);
      doc.path = path;
      doc.name = path.split(/[\\/]/).pop() || doc.name;
      store.documents.set(path, doc);
      doc.isDirty = false;
    },

    async quit() {
      store.activeDocument = null;
      store.documents.clear();
    },
  };
}

function createMockOutlookBindings(): IOutlookBindings {
  const store = getMockDataStore();
  let mailCounter = 0;
  let eventCounter = 0;

  return {
    async isAvailable() {
      return true;
    },

    async listFolders() {
      return store.folders;
    },

    async listMail(_folderName, count = 50) {
      const items = Array.from(store.mailItems.values());
      return items.slice(0, count);
    },

    async getMail(entryId) {
      const mail = store.mailItems.get(entryId);
      if (!mail) {
        throw new COMError(`Mail item not found: ${entryId}`, -1, 'Outlook');
      }
      return mail;
    },

    async sendMail(options) {
      mailCounter++;
      const entryId = `mail-${mailCounter}`;
      const to = Array.isArray(options.to) ? options.to : [options.to];
      const cc = options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : [];
      const bcc = options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : [];

      const mail: OutlookMailItem = {
        entryId,
        subject: options.subject,
        from: 'user@example.com',
        to,
        cc,
        bcc,
        body: options.body,
        isHtml: options.isHtml || false,
        received: new Date(),
        sent: new Date(),
        isRead: true,
        importance: options.importance || 'normal',
        attachments: options.attachments || [],
      };

      store.mailItems.set(entryId, mail);
    },

    async replyToMail(entryId, body, _replyAll) {
      const original = store.mailItems.get(entryId);
      if (!original) {
        throw new COMError(`Mail item not found: ${entryId}`, -1, 'Outlook');
      }

      mailCounter++;
      const newEntryId = `mail-${mailCounter}`;
      const reply: OutlookMailItem = {
        entryId: newEntryId,
        subject: `RE: ${original.subject}`,
        from: 'user@example.com',
        to: [original.from],
        cc: [],
        bcc: [],
        body,
        isHtml: false,
        received: new Date(),
        sent: new Date(),
        isRead: true,
        importance: 'normal',
        attachments: [],
        conversationId: original.conversationId,
      };

      store.mailItems.set(newEntryId, reply);
    },

    async listCalendarEvents(start, end) {
      return Array.from(store.calendarItems.values()).filter(
        (event) => event.start >= start && event.end <= end
      );
    },

    async createCalendarEvent(options) {
      eventCounter++;
      const entryId = `event-${eventCounter}`;

      const event: OutlookCalendarItem = {
        entryId,
        subject: options.subject,
        start: options.start,
        end: options.end,
        location: options.location || '',
        body: options.body || '',
        isAllDay: options.isAllDay || false,
        isRecurring: false,
        organizer: 'user@example.com',
        requiredAttendees: options.requiredAttendees || [],
        optionalAttendees: options.optionalAttendees || [],
        busyStatus: options.busyStatus || 'busy',
        reminderMinutes: options.reminderMinutes ?? 15,
      };

      store.calendarItems.set(entryId, event);
      return event;
    },

    async listContacts() {
      return Array.from(store.contacts.values());
    },

    async quit() {
      // Outlook doesn't typically quit via automation
    },
  };
}

function createMockPowerPointBindings(): IPowerPointBindings {
  const store = getMockDataStore();
  let presentationCounter = 0;

  return {
    async isAvailable() {
      return true;
    },

    async openPresentation(path, _options) {
      const existing = store.presentations.get(path);
      if (existing) {
        store.activePresentation = existing;
        return existing;
      }

      const name = path.split(/[\\/]/).pop() || 'Presentation.pptx';
      const presentation: PowerPointPresentation = {
        name,
        path,
        slideCount: 1,
        isDirty: false,
      };
      store.presentations.set(path, presentation);
      store.activePresentation = presentation;
      return presentation;
    },

    async createPresentation() {
      presentationCounter++;
      const name = `Presentation${presentationCounter}.pptx`;
      const presentation: PowerPointPresentation = {
        name,
        path: null,
        slideCount: 1,
        isDirty: false,
      };
      store.presentations.set(name, presentation);
      store.activePresentation = presentation;
      return presentation;
    },

    async getActivePresentation() {
      return store.activePresentation;
    },

    async closePresentation(presentation, _save) {
      // Don't delete from store - just deactivate (allows re-opening)
      if (store.activePresentation === presentation) {
        store.activePresentation = null;
      }
    },

    async listSlides(presentation) {
      const slides: PowerPointSlide[] = [];
      for (let i = 0; i < presentation.slideCount; i++) {
        slides.push({
          index: i + 1,
          layout: 'titleAndContent',
          title: i === 0 ? 'Title Slide' : `Slide ${i + 1}`,
          textContent: '',
          presentation,
        });
      }
      return slides;
    },

    async getSlideText(slide) {
      return slide.textContent;
    },

    async addSlide(presentation, layout) {
      presentation.slideCount++;
      presentation.isDirty = true;

      return {
        index: presentation.slideCount,
        layout: layout || 'titleAndContent',
        textContent: '',
        presentation,
      };
    },

    async deleteSlide(slide) {
      if (slide.presentation) {
        slide.presentation.slideCount--;
        slide.presentation.isDirty = true;
      }
    },

    async savePresentation(presentation, path) {
      if (path) {
        // Remove old key and add with new path
        const oldKey = presentation.path || presentation.name;
        store.presentations.delete(oldKey);
        presentation.path = path;
        presentation.name = path.split(/[\\/]/).pop() || presentation.name;
        store.presentations.set(path, presentation);
      }
      presentation.isDirty = false;
    },

    async quit() {
      store.activePresentation = null;
      store.presentations.clear();
    },
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert column letter to zero-based index (A=0, B=1, etc.)
 */
function colLetterToIndex(letter: string): number {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Convert zero-based index to column letter
 */
function colIndexToLetter(index: number): string {
  let letter = '';
  index++; // Convert to 1-based
  while (index > 0) {
    const remainder = (index - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    index = Math.floor((index - 1) / 26);
  }
  return letter;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Re-export error types for convenience
export { OfficeNotInstalledError, COMError };
