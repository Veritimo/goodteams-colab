/**
 * Excel Automation
 *
 * High-level API for Excel automation via COM bindings.
 * Provides workbook, worksheet, and cell manipulation capabilities.
 */

import {
  getBindings,
  type IExcelBindings,
  OfficeNotInstalledError,
  COMError,
} from './bindings.js';
import type {
  ExcelWorkbook,
  ExcelSheet,
  ExcelRange,
  ExcelOpenOptions,
  ExcelSaveOptions,
} from './types.js';

/**
 * Get Excel bindings
 */
function getExcel(): IExcelBindings {
  return getBindings().excel;
}

// ============================================================================
// Availability
// ============================================================================

/**
 * Check if Excel is available on this system
 */
export async function isExcelAvailable(): Promise<boolean> {
  try {
    return await getExcel().isAvailable();
  } catch {
    return false;
  }
}

/**
 * Ensure Excel is available, throw if not
 */
async function ensureExcelAvailable(): Promise<IExcelBindings> {
  const excel = getExcel();
  const available = await excel.isAvailable();
  if (!available) {
    throw new OfficeNotInstalledError('Excel');
  }
  return excel;
}

// ============================================================================
// Workbook Operations
// ============================================================================

/**
 * Open an existing Excel workbook
 *
 * @param path - Path to the workbook file
 * @param options - Open options (readOnly, password, etc.)
 * @returns The opened workbook
 *
 * @example
 * ```ts
 * const workbook = await openWorkbook('C:\\Reports\\Sales.xlsx');
 * const workbook = await openWorkbook('report.xlsx', { readOnly: true });
 * ```
 */
export async function openWorkbook(
  path: string,
  options?: ExcelOpenOptions
): Promise<ExcelWorkbook> {
  const excel = await ensureExcelAvailable();
  return excel.openWorkbook(path, options);
}

/**
 * Create a new Excel workbook
 *
 * @returns The new workbook (with one empty sheet)
 *
 * @example
 * ```ts
 * const workbook = await createWorkbook();
 * // workbook has one sheet named "Sheet1"
 * ```
 */
export async function createWorkbook(): Promise<ExcelWorkbook> {
  const excel = await ensureExcelAvailable();
  return excel.createWorkbook();
}

/**
 * Get the currently active workbook in Excel
 *
 * @returns The active workbook, or null if no workbook is open
 *
 * @example
 * ```ts
 * const workbook = await getActiveWorkbook();
 * if (workbook) {
 *   console.log(`Active workbook: ${workbook.name}`);
 * }
 * ```
 */
export async function getActiveWorkbook(): Promise<ExcelWorkbook | null> {
  const excel = await ensureExcelAvailable();
  return excel.getActiveWorkbook();
}

/**
 * Close a workbook
 *
 * @param workbook - The workbook to close
 * @param save - Whether to save changes before closing (default: false)
 *
 * @example
 * ```ts
 * await closeWorkbook(workbook); // Close without saving
 * await closeWorkbook(workbook, true); // Save and close
 * ```
 */
export async function closeWorkbook(
  workbook: ExcelWorkbook,
  save?: boolean
): Promise<void> {
  const excel = await ensureExcelAvailable();
  return excel.closeWorkbook(workbook, save);
}

/**
 * Save a workbook
 *
 * @param workbook - The workbook to save
 * @param path - Optional new path (Save As)
 * @param options - Save options (format, password, etc.)
 *
 * @example
 * ```ts
 * await saveWorkbook(workbook); // Save in place
 * await saveWorkbook(workbook, 'backup.xlsx'); // Save As
 * await saveWorkbook(workbook, 'report.pdf', { format: 'pdf' });
 * ```
 */
export async function saveWorkbook(
  workbook: ExcelWorkbook,
  path?: string,
  options?: ExcelSaveOptions
): Promise<void> {
  const excel = await ensureExcelAvailable();
  return excel.saveWorkbook(workbook, path, options);
}

// ============================================================================
// Sheet Operations
// ============================================================================

/**
 * List all worksheets in a workbook
 *
 * @param workbook - The workbook
 * @returns Array of sheets
 *
 * @example
 * ```ts
 * const sheets = await listSheets(workbook);
 * sheets.forEach(s => console.log(s.name));
 * ```
 */
export async function listSheets(workbook: ExcelWorkbook): Promise<ExcelSheet[]> {
  const excel = await ensureExcelAvailable();
  return excel.listSheets(workbook);
}

/**
 * Get a specific worksheet by name or index
 *
 * @param workbook - The workbook
 * @param nameOrIndex - Sheet name or zero-based index
 * @returns The worksheet
 * @throws COMError if sheet not found
 *
 * @example
 * ```ts
 * const sheet = await getSheet(workbook, 'Sales'); // By name
 * const sheet = await getSheet(workbook, 0); // First sheet
 * ```
 */
export async function getSheet(
  workbook: ExcelWorkbook,
  nameOrIndex: string | number
): Promise<ExcelSheet> {
  const excel = await ensureExcelAvailable();
  return excel.getSheet(workbook, nameOrIndex);
}

/**
 * Get the used range of a worksheet (cells containing data)
 *
 * @param sheet - The worksheet
 * @returns The used range with values
 *
 * @example
 * ```ts
 * const range = await getUsedRange(sheet);
 * console.log(`Data in ${range.address}`);
 * console.log(`${range.rowCount} rows x ${range.columnCount} columns`);
 * ```
 */
export async function getUsedRange(sheet: ExcelSheet): Promise<ExcelRange> {
  const excel = await ensureExcelAvailable();
  return excel.getUsedRange(sheet);
}

// ============================================================================
// Range Operations
// ============================================================================

/**
 * Read a range of cells
 *
 * @param sheet - The worksheet
 * @param address - Range address (e.g., "A1:C10", "B2")
 * @returns The range with values
 *
 * @example
 * ```ts
 * const range = await readRange(sheet, 'A1:D10');
 * range.values.forEach(row => console.log(row.join(', ')));
 * ```
 */
export async function readRange(
  sheet: ExcelSheet,
  address: string
): Promise<ExcelRange> {
  const excel = await ensureExcelAvailable();
  return excel.readRange(sheet, address);
}

/**
 * Write values to a range of cells
 *
 * @param sheet - The worksheet
 * @param address - Starting address (e.g., "A1")
 * @param values - 2D array of values (row-major)
 *
 * @example
 * ```ts
 * // Write a 2x3 table starting at A1
 * await writeRange(sheet, 'A1', [
 *   ['Name', 'Age', 'City'],
 *   ['Alice', 30, 'NYC'],
 * ]);
 * ```
 */
export async function writeRange(
  sheet: ExcelSheet,
  address: string,
  values: unknown[][]
): Promise<void> {
  const excel = await ensureExcelAvailable();
  return excel.writeRange(sheet, address, values);
}

/**
 * Read a single cell value
 *
 * @param sheet - The worksheet
 * @param address - Cell address (e.g., "A1", "B5")
 * @returns The cell value
 *
 * @example
 * ```ts
 * const value = await readCell(sheet, 'A1');
 * console.log(`Cell A1 contains: ${value}`);
 * ```
 */
export async function readCell(
  sheet: ExcelSheet,
  address: string
): Promise<unknown> {
  const excel = await ensureExcelAvailable();
  return excel.readCell(sheet, address);
}

/**
 * Write a value to a single cell
 *
 * @param sheet - The worksheet
 * @param address - Cell address (e.g., "A1")
 * @param value - The value to write
 *
 * @example
 * ```ts
 * await writeCell(sheet, 'A1', 'Hello');
 * await writeCell(sheet, 'B1', 42);
 * await writeCell(sheet, 'C1', new Date());
 * ```
 */
export async function writeCell(
  sheet: ExcelSheet,
  address: string,
  value: unknown
): Promise<void> {
  const excel = await ensureExcelAvailable();
  return excel.writeCell(sheet, address, value);
}

// ============================================================================
// Formulas and Macros
// ============================================================================

/**
 * Run a VBA macro in the workbook
 *
 * @param workbook - The workbook containing the macro
 * @param macroName - Name of the macro to run
 * @param args - Optional arguments to pass to the macro
 * @returns The macro's return value (if any)
 *
 * @example
 * ```ts
 * await runMacro(workbook, 'UpdateTotals');
 * const result = await runMacro(workbook, 'Calculate', [10, 20]);
 * ```
 */
export async function runMacro(
  workbook: ExcelWorkbook,
  macroName: string,
  args?: unknown[]
): Promise<unknown> {
  const excel = await ensureExcelAvailable();
  return excel.runMacro(workbook, macroName, args);
}

/**
 * Evaluate a formula and return the result
 *
 * @param sheet - The worksheet context
 * @param formula - Formula to evaluate (include the = sign)
 * @returns The formula result
 *
 * @example
 * ```ts
 * const sum = await evaluateFormula(sheet, '=SUM(A1:A10)');
 * const avg = await evaluateFormula(sheet, '=AVERAGE(B1:B100)');
 * const today = await evaluateFormula(sheet, '=TODAY()');
 * ```
 */
export async function evaluateFormula(
  sheet: ExcelSheet,
  formula: string
): Promise<unknown> {
  const excel = await ensureExcelAvailable();
  return excel.evaluateFormula(sheet, formula);
}

// ============================================================================
// Application Control
// ============================================================================

/**
 * Quit Excel application
 *
 * WARNING: This will close all open workbooks
 *
 * @example
 * ```ts
 * await quitExcel();
 * ```
 */
export async function quitExcel(): Promise<void> {
  const excel = await ensureExcelAvailable();
  return excel.quit();
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Read all data from a workbook's first sheet
 *
 * @param path - Path to the workbook
 * @returns 2D array of all values
 *
 * @example
 * ```ts
 * const data = await readWorkbookData('report.xlsx');
 * const headers = data[0];
 * const rows = data.slice(1);
 * ```
 */
export async function readWorkbookData(path: string): Promise<unknown[][]> {
  const workbook = await openWorkbook(path, { readOnly: true });
  try {
    const sheets = await listSheets(workbook);
    if (sheets.length === 0) {
      return [];
    }
    const range = await getUsedRange(sheets[0]);
    return range.values;
  } finally {
    await closeWorkbook(workbook, false);
  }
}

/**
 * Write data to a new workbook
 *
 * @param path - Path to save the workbook
 * @param data - 2D array of values
 * @param sheetName - Optional sheet name (default: "Sheet1")
 *
 * @example
 * ```ts
 * await writeWorkbookData('output.xlsx', [
 *   ['Name', 'Score'],
 *   ['Alice', 95],
 *   ['Bob', 87],
 * ]);
 * ```
 */
export async function writeWorkbookData(
  path: string,
  data: unknown[][],
  sheetName?: string
): Promise<void> {
  const workbook = await createWorkbook();
  try {
    const sheets = await listSheets(workbook);
    const sheet = sheets[0];

    // Rename sheet if specified
    if (sheetName && sheet.name !== sheetName) {
      // Note: Sheet rename would need additional binding support
    }

    await writeRange(sheet, 'A1', data);
    await saveWorkbook(workbook, path);
  } finally {
    await closeWorkbook(workbook, false);
  }
}

// Re-export types
export type { ExcelWorkbook, ExcelSheet, ExcelRange, ExcelOpenOptions, ExcelSaveOptions };
export { OfficeNotInstalledError, COMError };
