/**
 * Excel Automation Tests
 *
 * Tests for Excel COM automation using mock bindings.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setUseMockBindings,
  resetBindings,
  resetMockDataStore,
  getMockDataStore,
} from '../../../src/automation/office/bindings.js';
import {
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
  OfficeNotInstalledError,
} from '../../../src/automation/office/excel.js';

describe('Excel Automation', () => {
  beforeEach(() => {
    setUseMockBindings(true);
    resetMockDataStore();
  });

  afterEach(() => {
    resetBindings();
    resetMockDataStore();
  });

  describe('isExcelAvailable', () => {
    it('should return true when mock bindings are used', async () => {
      const available = await isExcelAvailable();
      expect(available).toBe(true);
    });
  });

  describe('createWorkbook', () => {
    it('should create a new workbook', async () => {
      const workbook = await createWorkbook();

      expect(workbook).toBeDefined();
      expect(workbook.name).toMatch(/^Book\d+\.xlsx$/);
      expect(workbook.path).toBeNull();
      expect(workbook.isDirty).toBe(false);
      expect(workbook.sheets).toHaveLength(1);
      expect(workbook.sheets[0].name).toBe('Sheet1');
    });

    it('should create multiple workbooks with unique names', async () => {
      const wb1 = await createWorkbook();
      const wb2 = await createWorkbook();
      const wb3 = await createWorkbook();

      expect(wb1.name).not.toBe(wb2.name);
      expect(wb2.name).not.toBe(wb3.name);
    });

    it('should set the created workbook as active', async () => {
      const workbook = await createWorkbook();
      const active = await getActiveWorkbook();

      expect(active).toBe(workbook);
    });
  });

  describe('openWorkbook', () => {
    it('should open an existing workbook', async () => {
      const workbook = await openWorkbook('C:\\Reports\\Sales.xlsx');

      expect(workbook).toBeDefined();
      expect(workbook.name).toBe('Sales.xlsx');
      expect(workbook.path).toBe('C:\\Reports\\Sales.xlsx');
    });

    it('should return the same workbook if opened twice', async () => {
      const wb1 = await openWorkbook('test.xlsx');
      const wb2 = await openWorkbook('test.xlsx');

      expect(wb1).toBe(wb2);
    });

    it('should set the opened workbook as active', async () => {
      const workbook = await openWorkbook('test.xlsx');
      const active = await getActiveWorkbook();

      expect(active).toBe(workbook);
    });
  });

  describe('getActiveWorkbook', () => {
    it('should return null when no workbook is open', async () => {
      const active = await getActiveWorkbook();
      expect(active).toBeNull();
    });

    it('should return the most recently opened workbook', async () => {
      await openWorkbook('first.xlsx');
      const second = await openWorkbook('second.xlsx');
      const active = await getActiveWorkbook();

      expect(active).toBe(second);
    });
  });

  describe('closeWorkbook', () => {
    it('should close a workbook', async () => {
      const workbook = await createWorkbook();
      await closeWorkbook(workbook);

      const active = await getActiveWorkbook();
      expect(active).toBeNull();
    });

    it('should keep the workbook in the store (can be reopened)', async () => {
      const workbook = await createWorkbook();
      await closeWorkbook(workbook);

      // Workbook stays in store (like a real file on disk)
      const store = getMockDataStore();
      expect(store.workbooks.has(workbook.name)).toBe(true);
    });
  });

  describe('saveWorkbook', () => {
    it('should save a workbook to a new path', async () => {
      const workbook = await createWorkbook();
      await saveWorkbook(workbook, 'C:\\Output\\Report.xlsx');

      expect(workbook.path).toBe('C:\\Output\\Report.xlsx');
      expect(workbook.name).toBe('Report.xlsx');
      expect(workbook.isDirty).toBe(false);
    });

    it('should save in place when no path specified', async () => {
      const workbook = await openWorkbook('existing.xlsx');
      await saveWorkbook(workbook);

      expect(workbook.isDirty).toBe(false);
    });
  });

  describe('listSheets', () => {
    it('should list all sheets in a workbook', async () => {
      const workbook = await createWorkbook();
      const sheets = await listSheets(workbook);

      expect(sheets).toHaveLength(1);
      expect(sheets[0].name).toBe('Sheet1');
      expect(sheets[0].index).toBe(0);
    });

    it('should return sheets with visibility info', async () => {
      const workbook = await createWorkbook();
      const sheets = await listSheets(workbook);

      expect(sheets[0].visible).toBe(true);
    });
  });

  describe('getSheet', () => {
    it('should get sheet by name', async () => {
      const workbook = await createWorkbook();
      const sheet = await getSheet(workbook, 'Sheet1');

      expect(sheet).toBeDefined();
      expect(sheet.name).toBe('Sheet1');
    });

    it('should get sheet by index', async () => {
      const workbook = await createWorkbook();
      const sheet = await getSheet(workbook, 0);

      expect(sheet).toBeDefined();
      expect(sheet.index).toBe(0);
    });

    it('should throw when sheet not found', async () => {
      const workbook = await createWorkbook();

      await expect(getSheet(workbook, 'NonExistent')).rejects.toThrow();
    });
  });

  describe('readRange', () => {
    it('should read a range of cells', async () => {
      const workbook = await createWorkbook();
      const sheet = await getSheet(workbook, 0);
      const range = await readRange(sheet, 'A1:C3');

      expect(range).toBeDefined();
      expect(range.address).toBe('A1:C3');
      expect(range.rowCount).toBe(3);
      expect(range.columnCount).toBe(3);
      expect(range.values).toHaveLength(3);
      expect(range.values[0]).toHaveLength(3);
    });

    it('should read a single cell as range', async () => {
      const workbook = await createWorkbook();
      const sheet = await getSheet(workbook, 0);
      const range = await readRange(sheet, 'A1');

      expect(range.address).toBe('A1');
      expect(range.rowCount).toBe(1);
      expect(range.columnCount).toBe(1);
    });
  });

  describe('writeRange', () => {
    it('should write values to a range', async () => {
      const workbook = await createWorkbook();
      const sheet = await getSheet(workbook, 0);

      const data = [
        ['Name', 'Age', 'City'],
        ['Alice', 30, 'NYC'],
        ['Bob', 25, 'LA'],
      ];

      await writeRange(sheet, 'A1', data);

      // Verify used range was updated
      expect(sheet.usedRange).toBe('A1:C3');
    });

    it('should handle empty data', async () => {
      const workbook = await createWorkbook();
      const sheet = await getSheet(workbook, 0);

      await writeRange(sheet, 'A1', []);
      // Should not throw
    });
  });

  describe('readCell', () => {
    it('should read a single cell value', async () => {
      const workbook = await createWorkbook();
      const sheet = await getSheet(workbook, 0);
      const value = await readCell(sheet, 'A1');

      // Mock returns null for empty cells
      expect(value).toBeNull();
    });
  });

  describe('writeCell', () => {
    it('should write a value to a cell', async () => {
      const workbook = await createWorkbook();
      const sheet = await getSheet(workbook, 0);

      // Should not throw
      await writeCell(sheet, 'A1', 'Hello');
      await writeCell(sheet, 'B1', 42);
      await writeCell(sheet, 'C1', true);
    });
  });

  describe('getUsedRange', () => {
    it('should return the used range of a sheet', async () => {
      const workbook = await createWorkbook();
      const sheet = await getSheet(workbook, 0);
      const range = await getUsedRange(sheet);

      expect(range).toBeDefined();
      expect(range.address).toBe('A1');
    });

    it('should reflect changes after writing', async () => {
      const workbook = await createWorkbook();
      const sheet = await getSheet(workbook, 0);

      await writeRange(sheet, 'A1', [
        [1, 2, 3],
        [4, 5, 6],
      ]);

      const range = await getUsedRange(sheet);
      expect(range.address).toBe('A1:C2');
    });
  });

  describe('runMacro', () => {
    it('should execute a macro and return result', async () => {
      const workbook = await createWorkbook();
      const result = await runMacro(workbook, 'MyMacro');

      expect(result).toBeDefined();
      expect(result).toEqual({ executed: 'MyMacro', args: [] });
    });

    it('should pass arguments to macro', async () => {
      const workbook = await createWorkbook();
      const result = await runMacro(workbook, 'Calculate', [10, 20]);

      expect(result).toEqual({ executed: 'Calculate', args: [10, 20] });
    });
  });

  describe('evaluateFormula', () => {
    it('should evaluate SUM formula', async () => {
      const workbook = await createWorkbook();
      const sheet = await getSheet(workbook, 0);
      const result = await evaluateFormula(sheet, '=SUM(A1:A10)');

      expect(result).toBe(0); // Mock returns 0 for SUM
    });

    it('should evaluate AVERAGE formula', async () => {
      const workbook = await createWorkbook();
      const sheet = await getSheet(workbook, 0);
      const result = await evaluateFormula(sheet, '=AVERAGE(B1:B100)');

      expect(result).toBe(0); // Mock returns 0 for AVERAGE
    });

    it('should handle string formulas', async () => {
      const workbook = await createWorkbook();
      const sheet = await getSheet(workbook, 0);
      const result = await evaluateFormula(sheet, '=Hello');

      expect(result).toBe('Hello');
    });
  });

  describe('quitExcel', () => {
    it('should quit Excel and clear workbooks', async () => {
      await createWorkbook();
      await createWorkbook();

      await quitExcel();

      const active = await getActiveWorkbook();
      expect(active).toBeNull();

      const store = getMockDataStore();
      expect(store.workbooks.size).toBe(0);
    });
  });

  describe('readWorkbookData', () => {
    it('should read all data from a workbook', async () => {
      const data = await readWorkbookData('test.xlsx');

      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('writeWorkbookData', () => {
    it('should create a workbook with data', async () => {
      const data = [
        ['Name', 'Score'],
        ['Alice', 95],
        ['Bob', 87],
      ];

      // Should not throw
      await writeWorkbookData('output.xlsx', data);
    });
  });

  describe('error handling', () => {
    it('should handle OfficeNotInstalledError', async () => {
      // Reset to use real bindings (which will fail on non-Windows)
      setUseMockBindings(false);
      resetBindings();

      // On non-Windows, this should throw OfficeNotInstalledError
      if (process.platform !== 'win32') {
        await expect(createWorkbook()).rejects.toThrow(OfficeNotInstalledError);
      }
    });
  });
});
