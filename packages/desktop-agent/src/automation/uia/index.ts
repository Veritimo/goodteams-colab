/**
 * Windows UI Automation Module
 *
 * Provides a TypeScript interface to the Windows UI Automation API.
 * This module enables:
 * - Window discovery and management
 * - UI element tree traversal and inspection
 * - Mouse and keyboard input automation
 * - Control pattern operations (Invoke, Value, Toggle, etc.)
 */

// Types
export * from './types.js';

// Bindings
export {
  type UIABindings,
  MockUIABindings,
  StubUIABindings,
  getBindings,
  getMockBindings,
  resetBindings,
  setBindings,
} from './bindings.js';

// Window Operations
export {
  WindowOperations,
  listWindows,
  findWindow,
  findWindowOrThrow,
  getWindow,
  focusWindow,
  focusWindowByTitle,
  getWindowBounds,
  minimizeWindow,
  maximizeWindow,
  restoreWindow,
  closeWindow,
  findWindows,
  findWindowsByProcess,
  findWindowsByClass,
  waitForWindow,
  waitForWindowClose,
  windowExists,
  isMinimized,
  isMaximized,
} from './window.js';

// Element Operations
export {
  ElementOperations,
  getRootElement,
  getRootElementOrThrow,
  findElement,
  findElementOrThrow,
  findAllElements,
  getElementTree,
  getFilteredElementTree,
  getElementProperties,
  getElementAtPoint,
  isElementValid,
  getSupportedPatterns,
  waitForElement,
  waitForEnabled,
  waitForElementGone,
  findByAutomationId,
  findByName,
  findByControlType,
  findAllButtons,
  findAllTextInputs,
  findAllCheckboxes,
  findEnabledElement,
  findVisibleElements,
  getElementCenter,
  hasPattern,
  flattenTree,
  findElementsWithPattern,
} from './element.js';

// Input Actions
export {
  InputActions,
  click,
  doubleClick,
  rightClick,
  clickAt,
  type,
  typeInElement,
  pressKey,
  scroll,
  scrollUp,
  scrollDown,
  scrollLeft,
  scrollRight,
  pressEnter,
  pressTab,
  pressShiftTab,
  pressEscape,
  selectAll,
  copy,
  paste,
  cut,
  undo,
  redo,
  save,
  closeWindow as closeWindowShortcut,
  refresh,
  pressDelete,
  pressBackspace,
  clearField,
  fillField,
  tripleClick,
  typeSlowly,
  pressArrow,
  pressHome,
  pressEnd,
  goToBeginning,
  goToEnd,
  pageUp,
  pageDown,
} from './actions.js';

// Pattern Operations
export {
  PatternOperations,
  supportsPattern,
  ensurePatternSupported,
  invoke,
  invokeOrThrow,
  setValue,
  setValueOrThrow,
  getValue,
  getValueOrThrow,
  toggle,
  toggleOrThrow,
  getToggleState,
  isToggleOn,
  setToggleOn,
  setToggleOff,
  select,
  selectOrThrow,
  expand,
  expandOrThrow,
  collapse,
  collapseOrThrow,
  getExpandCollapseState,
  isExpanded,
  isCollapsed,
  ensureExpanded,
  ensureCollapsed,
  toggleExpandCollapse,
  openComboBox,
  closeComboBox,
} from './patterns.js';
