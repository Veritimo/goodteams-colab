/**
 * Word Automation Tests
 *
 * Tests for Word COM automation using mock bindings.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setUseMockBindings,
  resetBindings,
  resetMockDataStore,
  getMockDataStore,
} from '../../../src/automation/office/bindings.js';
import {
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
  OfficeNotInstalledError,
} from '../../../src/automation/office/word.js';

describe('Word Automation', () => {
  beforeEach(() => {
    setUseMockBindings(true);
    resetMockDataStore();
  });

  afterEach(() => {
    resetBindings();
    resetMockDataStore();
  });

  describe('isWordAvailable', () => {
    it('should return true when mock bindings are used', async () => {
      const available = await isWordAvailable();
      expect(available).toBe(true);
    });
  });

  describe('createDocument', () => {
    it('should create a new document', async () => {
      const doc = await createDocument();

      expect(doc).toBeDefined();
      expect(doc.name).toMatch(/^Document\d+\.docx$/);
      expect(doc.path).toBeNull();
      expect(doc.content).toBe('');
      expect(doc.wordCount).toBe(0);
      expect(doc.pageCount).toBe(1);
      expect(doc.isDirty).toBe(false);
    });

    it('should create multiple documents with unique names', async () => {
      const doc1 = await createDocument();
      const doc2 = await createDocument();

      expect(doc1.name).not.toBe(doc2.name);
    });

    it('should set the created document as active', async () => {
      const doc = await createDocument();
      const active = await getActiveDocument();

      expect(active).toBe(doc);
    });
  });

  describe('openDocument', () => {
    it('should open an existing document', async () => {
      const doc = await openDocument('C:\\Documents\\Report.docx');

      expect(doc).toBeDefined();
      expect(doc.name).toBe('Report.docx');
      expect(doc.path).toBe('C:\\Documents\\Report.docx');
    });

    it('should return the same document if opened twice', async () => {
      const doc1 = await openDocument('test.docx');
      const doc2 = await openDocument('test.docx');

      expect(doc1).toBe(doc2);
    });
  });

  describe('getActiveDocument', () => {
    it('should return null when no document is open', async () => {
      const active = await getActiveDocument();
      expect(active).toBeNull();
    });

    it('should return the most recently opened document', async () => {
      await openDocument('first.docx');
      const second = await openDocument('second.docx');
      const active = await getActiveDocument();

      expect(active).toBe(second);
    });
  });

  describe('closeDocument', () => {
    it('should close a document', async () => {
      const doc = await createDocument();
      await closeDocument(doc);

      const active = await getActiveDocument();
      expect(active).toBeNull();
    });

    it('should keep the document in the store (can be reopened)', async () => {
      const doc = await createDocument();
      await closeDocument(doc);

      // Document stays in store (like a real file on disk)
      const store = getMockDataStore();
      expect(store.documents.has(doc.name)).toBe(true);
    });
  });

  describe('getContent / setContent', () => {
    it('should get and set document content', async () => {
      const doc = await createDocument();

      expect(await getContent(doc)).toBe('');

      await setContent(doc, 'Hello, World!');

      expect(await getContent(doc)).toBe('Hello, World!');
      expect(doc.wordCount).toBe(2);
      expect(doc.isDirty).toBe(true);
    });

    it('should update word count correctly', async () => {
      const doc = await createDocument();
      await setContent(doc, 'One two three four five');

      expect(doc.wordCount).toBe(5);
    });
  });

  describe('insertText', () => {
    it('should insert text at end by default', async () => {
      const doc = await createDocument();
      await setContent(doc, 'Hello');
      await insertText(doc, ' World');

      expect(doc.content).toBe('Hello World');
    });

    it('should insert text at start', async () => {
      const doc = await createDocument();
      await setContent(doc, 'World');
      await insertText(doc, 'Hello ', { at: 'start' });

      expect(doc.content).toBe('Hello World');
    });

    it('should insert text at specific position', async () => {
      const doc = await createDocument();
      await setContent(doc, 'Hello World');
      await insertText(doc, ' Beautiful', { at: 5 });

      expect(doc.content).toBe('Hello Beautiful World');
    });

    it('should update word count after insert', async () => {
      const doc = await createDocument();
      await setContent(doc, 'Hello');
      await insertText(doc, ' World');

      expect(doc.wordCount).toBe(2);
    });
  });

  describe('find', () => {
    it('should find all occurrences of text', async () => {
      const doc = await createDocument();
      await setContent(doc, 'The quick brown fox jumps over the lazy dog. The fox is quick.');

      const results = await find(doc, 'fox');

      expect(results).toHaveLength(2);
      expect(results[0].text).toBe('fox');
      expect(results[0].start).toBe(16);
      expect(results[1].start).toBe(49);
    });

    it('should return empty array when not found', async () => {
      const doc = await createDocument();
      await setContent(doc, 'Hello World');

      const results = await find(doc, 'xyz');

      expect(results).toHaveLength(0);
    });

    it('should find overlapping matches', async () => {
      const doc = await createDocument();
      await setContent(doc, 'aaaa');

      const results = await find(doc, 'aa');

      expect(results).toHaveLength(3); // positions 0, 1, 2
    });
  });

  describe('replace', () => {
    it('should replace all occurrences', async () => {
      const doc = await createDocument();
      await setContent(doc, 'Hello World, Hello Universe');

      const count = await replace(doc, 'Hello', 'Hi');

      expect(count).toBe(2);
      expect(doc.content).toBe('Hi World, Hi Universe');
    });

    it('should return 0 when nothing replaced', async () => {
      const doc = await createDocument();
      await setContent(doc, 'Hello World');

      const count = await replace(doc, 'xyz', 'abc');

      expect(count).toBe(0);
      expect(doc.content).toBe('Hello World');
    });

    it('should handle special regex characters', async () => {
      const doc = await createDocument();
      await setContent(doc, 'Price: $100.00');

      const count = await replace(doc, '$100.00', '$200.00');

      expect(count).toBe(1);
      expect(doc.content).toBe('Price: $200.00');
    });
  });

  describe('saveAs', () => {
    it('should save document to a new path', async () => {
      const doc = await createDocument();
      await setContent(doc, 'Content');
      await saveAs(doc, 'C:\\Output\\Report.docx');

      expect(doc.path).toBe('C:\\Output\\Report.docx');
      expect(doc.name).toBe('Report.docx');
      expect(doc.isDirty).toBe(false);
    });
  });

  describe('quitWord', () => {
    it('should quit Word and clear documents', async () => {
      await createDocument();
      await createDocument();

      await quitWord();

      const active = await getActiveDocument();
      expect(active).toBeNull();

      const store = getMockDataStore();
      expect(store.documents.size).toBe(0);
    });
  });

  describe('readDocumentText', () => {
    it('should read text from a document file', async () => {
      // Pre-populate the mock store
      const doc = await openDocument('test.docx');
      await setContent(doc, 'Test content');
      await closeDocument(doc);

      const text = await readDocumentText('test.docx');

      expect(text).toBe('Test content');
    });
  });

  describe('createDocumentWithContent', () => {
    it('should create a document with content and save it', async () => {
      await createDocumentWithContent('letter.docx', 'Dear Sir/Madam,\n\nThank you.');

      // Verify by opening and reading
      const doc = await openDocument('letter.docx');
      expect(doc.content).toBe('Dear Sir/Madam,\n\nThank you.');
    });
  });

  describe('convertToPdf', () => {
    it('should convert a document to PDF', async () => {
      // Pre-populate the mock store
      const doc = await openDocument('report.docx');
      await setContent(doc, 'Report content');
      await closeDocument(doc);

      // Should not throw
      await convertToPdf('report.docx', 'report.pdf');
    });
  });

  describe('batchReplace', () => {
    it('should perform multiple replacements', async () => {
      const doc = await openDocument('template.docx');
      await setContent(doc, 'Hello {{name}}, your order {{order}} is ready.');
      await closeDocument(doc);

      const count = await batchReplace('template.docx', [
        ['{{name}}', 'Alice'],
        ['{{order}}', '#12345'],
      ]);

      expect(count).toBe(2);

      // Verify the changes
      const result = await openDocument('template.docx');
      expect(result.content).toBe('Hello Alice, your order #12345 is ready.');
    });

    it('should save to a different output path', async () => {
      const doc = await openDocument('template.docx');
      await setContent(doc, 'Hello {{name}}');
      await closeDocument(doc);

      await batchReplace('template.docx', [['{{name}}', 'Bob']], 'filled.docx');

      const result = await openDocument('filled.docx');
      expect(result.content).toBe('Hello Bob');
    });
  });

  describe('error handling', () => {
    it('should handle OfficeNotInstalledError', async () => {
      setUseMockBindings(false);
      resetBindings();

      if (process.platform !== 'win32') {
        await expect(createDocument()).rejects.toThrow(OfficeNotInstalledError);
      }
    });
  });
});
