/**
 * Word Automation
 *
 * High-level API for Word automation via COM bindings.
 * Provides document manipulation, text operations, and search/replace.
 */

import {
  getBindings,
  type IWordBindings,
  OfficeNotInstalledError,
  COMError,
} from './bindings.js';
import type {
  WordDocument,
  WordFindResult,
  WordOpenOptions,
  WordSaveFormat,
  WordInsertPosition,
} from './types.js';

/**
 * Get Word bindings
 */
function getWord(): IWordBindings {
  return getBindings().word;
}

// ============================================================================
// Availability
// ============================================================================

/**
 * Check if Word is available on this system
 */
export async function isWordAvailable(): Promise<boolean> {
  try {
    return await getWord().isAvailable();
  } catch {
    return false;
  }
}

/**
 * Ensure Word is available, throw if not
 */
async function ensureWordAvailable(): Promise<IWordBindings> {
  const word = getWord();
  const available = await word.isAvailable();
  if (!available) {
    throw new OfficeNotInstalledError('Word');
  }
  return word;
}

// ============================================================================
// Document Operations
// ============================================================================

/**
 * Open an existing Word document
 *
 * @param path - Path to the document file
 * @param options - Open options (readOnly, password, etc.)
 * @returns The opened document
 *
 * @example
 * ```ts
 * const doc = await openDocument('C:\\Documents\\Report.docx');
 * const doc = await openDocument('letter.docx', { readOnly: true });
 * ```
 */
export async function openDocument(
  path: string,
  options?: WordOpenOptions
): Promise<WordDocument> {
  const word = await ensureWordAvailable();
  return word.openDocument(path, options);
}

/**
 * Create a new Word document
 *
 * @returns The new empty document
 *
 * @example
 * ```ts
 * const doc = await createDocument();
 * await setContent(doc, 'Hello, World!');
 * ```
 */
export async function createDocument(): Promise<WordDocument> {
  const word = await ensureWordAvailable();
  return word.createDocument();
}

/**
 * Get the currently active document in Word
 *
 * @returns The active document, or null if no document is open
 *
 * @example
 * ```ts
 * const doc = await getActiveDocument();
 * if (doc) {
 *   console.log(`Active document: ${doc.name}`);
 * }
 * ```
 */
export async function getActiveDocument(): Promise<WordDocument | null> {
  const word = await ensureWordAvailable();
  return word.getActiveDocument();
}

/**
 * Close a document
 *
 * @param doc - The document to close
 * @param save - Whether to save changes before closing (default: false)
 *
 * @example
 * ```ts
 * await closeDocument(doc); // Close without saving
 * await closeDocument(doc, true); // Save and close
 * ```
 */
export async function closeDocument(
  doc: WordDocument,
  save?: boolean
): Promise<void> {
  const word = await ensureWordAvailable();
  return word.closeDocument(doc, save);
}

// ============================================================================
// Content Operations
// ============================================================================

/**
 * Get the full text content of a document
 *
 * @param doc - The document
 * @returns The document text
 *
 * @example
 * ```ts
 * const content = await getContent(doc);
 * console.log(`Document has ${content.length} characters`);
 * ```
 */
export async function getContent(doc: WordDocument): Promise<string> {
  const word = await ensureWordAvailable();
  return word.getContent(doc);
}

/**
 * Set/replace the entire content of a document
 *
 * @param doc - The document
 * @param text - The new text content
 *
 * @example
 * ```ts
 * await setContent(doc, 'This replaces all content in the document.');
 * ```
 */
export async function setContent(doc: WordDocument, text: string): Promise<void> {
  const word = await ensureWordAvailable();
  return word.setContent(doc, text);
}

/**
 * Insert text at a specific position in the document
 *
 * @param doc - The document
 * @param text - Text to insert
 * @param position - Where to insert (start, end, cursor, or character index)
 *
 * @example
 * ```ts
 * await insertText(doc, 'Hello '); // Insert at end (default)
 * await insertText(doc, 'Prefix: ', { at: 'start' });
 * await insertText(doc, 'MIDDLE', { at: 50 }); // At position 50
 * ```
 */
export async function insertText(
  doc: WordDocument,
  text: string,
  position?: WordInsertPosition
): Promise<void> {
  const word = await ensureWordAvailable();
  return word.insertText(doc, text, position);
}

// ============================================================================
// Search and Replace
// ============================================================================

/**
 * Find all occurrences of text in a document
 *
 * @param doc - The document to search
 * @param text - Text to find
 * @returns Array of find results with positions
 *
 * @example
 * ```ts
 * const results = await find(doc, 'important');
 * console.log(`Found ${results.length} occurrences`);
 * results.forEach(r => console.log(`Page ${r.page}: position ${r.start}`));
 * ```
 */
export async function find(
  doc: WordDocument,
  text: string
): Promise<WordFindResult[]> {
  const word = await ensureWordAvailable();
  return word.find(doc, text);
}

/**
 * Find and replace text in a document
 *
 * @param doc - The document
 * @param findText - Text to find
 * @param replaceText - Text to replace with
 * @returns Number of replacements made
 *
 * @example
 * ```ts
 * const count = await replace(doc, 'old', 'new');
 * console.log(`Replaced ${count} occurrences`);
 * ```
 */
export async function replace(
  doc: WordDocument,
  findText: string,
  replaceText: string
): Promise<number> {
  const word = await ensureWordAvailable();
  return word.replace(doc, findText, replaceText);
}

// ============================================================================
// Save Operations
// ============================================================================

/**
 * Save a document with optional new path and format
 *
 * @param doc - The document to save
 * @param path - Path to save to
 * @param format - File format (docx, pdf, rtf, txt, html)
 *
 * @example
 * ```ts
 * await saveAs(doc, 'report.docx'); // Save as Word document
 * await saveAs(doc, 'report.pdf', 'pdf'); // Export as PDF
 * await saveAs(doc, 'report.txt', 'txt'); // Export as plain text
 * ```
 */
export async function saveAs(
  doc: WordDocument,
  path: string,
  format?: WordSaveFormat
): Promise<void> {
  const word = await ensureWordAvailable();
  return word.saveAs(doc, path, format);
}

// ============================================================================
// Application Control
// ============================================================================

/**
 * Quit Word application
 *
 * WARNING: This will close all open documents
 *
 * @example
 * ```ts
 * await quitWord();
 * ```
 */
export async function quitWord(): Promise<void> {
  const word = await ensureWordAvailable();
  return word.quit();
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Read the text content of a document file
 *
 * @param path - Path to the document
 * @returns The document text content
 *
 * @example
 * ```ts
 * const text = await readDocumentText('letter.docx');
 * console.log(text);
 * ```
 */
export async function readDocumentText(path: string): Promise<string> {
  const doc = await openDocument(path, { readOnly: true });
  try {
    return await getContent(doc);
  } finally {
    await closeDocument(doc, false);
  }
}

/**
 * Create a document with the given content and save it
 *
 * @param path - Path to save the document
 * @param content - Text content
 * @param format - Optional format (default: docx)
 *
 * @example
 * ```ts
 * await createDocumentWithContent('letter.docx', 'Dear Sir/Madam,\n\n...');
 * await createDocumentWithContent('readme.txt', 'Instructions', 'txt');
 * ```
 */
export async function createDocumentWithContent(
  path: string,
  content: string,
  format?: WordSaveFormat
): Promise<void> {
  const doc = await createDocument();
  try {
    await setContent(doc, content);
    await saveAs(doc, path, format);
  } finally {
    await closeDocument(doc, false);
  }
}

/**
 * Convert a document to PDF
 *
 * @param inputPath - Path to the source document
 * @param outputPath - Path for the PDF output
 *
 * @example
 * ```ts
 * await convertToPdf('report.docx', 'report.pdf');
 * ```
 */
export async function convertToPdf(
  inputPath: string,
  outputPath: string
): Promise<void> {
  const doc = await openDocument(inputPath, { readOnly: true });
  try {
    await saveAs(doc, outputPath, 'pdf');
  } finally {
    await closeDocument(doc, false);
  }
}

/**
 * Perform find and replace across a document file
 *
 * @param path - Path to the document
 * @param replacements - Array of [find, replace] pairs
 * @param outputPath - Optional output path (saves in place if not specified)
 * @returns Total number of replacements made
 *
 * @example
 * ```ts
 * const count = await batchReplace('template.docx', [
 *   ['{{name}}', 'John Doe'],
 *   ['{{date}}', '2024-01-15'],
 *   ['{{company}}', 'Acme Corp'],
 * ], 'filled.docx');
 * ```
 */
export async function batchReplace(
  path: string,
  replacements: [string, string][],
  outputPath?: string
): Promise<number> {
  const doc = await openDocument(path);
  try {
    let totalCount = 0;
    for (const [findText, replaceText] of replacements) {
      totalCount += await replace(doc, findText, replaceText);
    }
    await saveAs(doc, outputPath || path);
    return totalCount;
  } finally {
    await closeDocument(doc, false);
  }
}

// Re-export types
export type {
  WordDocument,
  WordFindResult,
  WordOpenOptions,
  WordSaveFormat,
  WordInsertPosition,
};
export { OfficeNotInstalledError, COMError };
