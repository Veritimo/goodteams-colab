/**
 * Office COM Automation
 *
 * This module provides automation capabilities for Microsoft Office applications
 * via COM bindings on Windows. It supports Excel, Word, Outlook, and PowerPoint.
 *
 * @example
 * ```ts
 * import { excel, word, outlook, powerpoint } from '@goodteams/desktop-agent/office';
 *
 * // Excel operations
 * const workbook = await excel.openWorkbook('report.xlsx');
 * const sheet = await excel.getSheet(workbook, 0);
 * const data = await excel.readRange(sheet, 'A1:D10');
 *
 * // Word operations
 * const doc = await word.createDocument();
 * await word.setContent(doc, 'Hello, World!');
 * await word.saveAs(doc, 'letter.docx');
 *
 * // Outlook operations
 * await outlook.sendMail('alice@example.com', 'Hello', 'How are you?');
 * const events = await outlook.getTodaysEvents();
 *
 * // PowerPoint operations
 * const pres = await powerpoint.openPresentation('slides.pptx');
 * const slides = await powerpoint.listSlides(pres);
 * ```
 *
 * @module
 */

// Types
export * from './types.js';

// Bindings (for advanced usage and testing)
export {
  type IExcelBindings,
  type IWordBindings,
  type IOutlookBindings,
  type IPowerPointBindings,
  type IOfficeBindings,
  getBindings,
  setUseMockBindings,
  isUsingMockBindings,
  resetBindings,
  getMockDataStore,
  resetMockDataStore,
  type MockDataStore,
} from './bindings.js';

// Excel automation
import * as excel from './excel.js';
export { excel };
export {
  isExcelAvailable,
  openWorkbook,
  createWorkbook,
  getActiveWorkbook,
  closeWorkbook,
  saveWorkbook,
  listSheets,
  getSheet,
  readRange,
  writeRange,
  readCell,
  writeCell,
  getUsedRange,
  runMacro,
  evaluateFormula,
  quitExcel,
  readWorkbookData,
  writeWorkbookData,
} from './excel.js';

// Word automation
import * as word from './word.js';
export { word };
export {
  isWordAvailable,
  openDocument,
  createDocument,
  getActiveDocument,
  closeDocument,
  getContent,
  setContent,
  insertText,
  find,
  replace,
  saveAs,
  quitWord,
  readDocumentText,
  createDocumentWithContent,
  convertToPdf,
  batchReplace,
} from './word.js';

// Outlook automation
import * as outlook from './outlook.js';
export { outlook };
export {
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
} from './outlook.js';

// PowerPoint automation
import * as powerpoint from './powerpoint.js';
export { powerpoint };
export {
  isPowerPointAvailable,
  openPresentation,
  createPresentation,
  getActivePresentation,
  closePresentation,
  savePresentation,
  listSlides,
  getSlideText,
  addSlide,
  deleteSlide,
  quitPowerPoint,
  getPresentationText,
  getPresentationSummary,
  createSimplePresentation,
} from './powerpoint.js';
