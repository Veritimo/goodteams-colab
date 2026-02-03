/**
 * Windows UI Automation Types
 *
 * TypeScript interfaces for interacting with the Windows UI Automation API.
 * These types mirror the native UIA structures but in a TypeScript-friendly format.
 */

/**
 * Bounding rectangle in screen coordinates
 */
export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Represents a UI Automation element
 */
export interface UIElement {
  /** The automation ID of the element (unique within a window) */
  automationId: string;
  /** The visible name/text of the element */
  name: string;
  /** The Win32 class name */
  className: string;
  /** The UIA control type (e.g., "Button", "Edit", "List") */
  controlType: string;
  /** The element's bounding rectangle in screen coordinates */
  boundingRect: BoundingRect;
  /** Whether the element is enabled for interaction */
  isEnabled: boolean;
  /** Whether the element is outside the visible area */
  isOffscreen: boolean;
  /** Runtime ID for uniquely identifying the element (opaque handle) */
  runtimeId?: number[];
  /** Child elements (populated when traversing the tree) */
  children?: UIElement[];
  /** Native handle reference (for internal use) */
  nativeHandle?: unknown;
}

/**
 * Information about a top-level window
 */
export interface WindowInfo {
  /** The native window handle (HWND) */
  handle: number;
  /** The window title text */
  title: string;
  /** The Win32 class name */
  className: string;
  /** The process ID that owns this window */
  processId: number;
  /** The window's position and size */
  bounds: BoundingRect;
  /** Whether the window is minimized */
  isMinimized?: boolean;
  /** Whether the window is maximized */
  isMaximized?: boolean;
  /** Whether the window is visible */
  isVisible?: boolean;
}

/**
 * Criteria for finding UI elements
 */
export interface ElementSearchCriteria {
  /** Match by automation ID */
  automationId?: string;
  /** Match by element name (visible text) */
  name?: string;
  /** Match by control type */
  controlType?: string;
  /** Match by class name */
  className?: string;
  /** Use partial/contains matching instead of exact */
  partial?: boolean;
}

/**
 * Options for element tree traversal
 */
export interface TreeWalkOptions {
  /** Maximum depth to traverse (default: unlimited) */
  maxDepth?: number;
  /** Include offscreen elements */
  includeOffscreen?: boolean;
  /** Include disabled elements */
  includeDisabled?: boolean;
  /** Control types to include (filter) */
  controlTypes?: string[];
}

/**
 * UIA Control Pattern types
 */
export type UIAPatternType =
  | 'Invoke'
  | 'Selection'
  | 'Value'
  | 'RangeValue'
  | 'Scroll'
  | 'ExpandCollapse'
  | 'Grid'
  | 'GridItem'
  | 'MultipleView'
  | 'Window'
  | 'SelectionItem'
  | 'Dock'
  | 'Table'
  | 'TableItem'
  | 'Text'
  | 'Toggle'
  | 'Transform'
  | 'ScrollItem'
  | 'LegacyIAccessible';

/**
 * Toggle state values
 */
export type ToggleState = 'On' | 'Off' | 'Indeterminate';

/**
 * Expand/Collapse state values
 */
export type ExpandCollapseState = 'Collapsed' | 'Expanded' | 'LeafNode' | 'PartiallyExpanded';

/**
 * Scroll direction
 */
export type ScrollDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Keyboard modifier keys
 */
export type KeyModifier = 'ctrl' | 'alt' | 'shift' | 'win';

/**
 * Mouse button types
 */
export type MouseButton = 'left' | 'right' | 'middle';

/**
 * Result of a pattern operation
 */
export interface PatternResult<T = void> {
  success: boolean;
  value?: T;
  error?: string;
}

/**
 * Extended element properties
 */
export interface ElementProperties extends UIElement {
  /** Supported UIA patterns */
  patterns: UIAPatternType[];
  /** Current value (for Value pattern elements) */
  value?: string;
  /** Is read-only (for Value pattern elements) */
  isReadOnly?: boolean;
  /** Toggle state (for Toggle pattern elements) */
  toggleState?: ToggleState;
  /** Expand/collapse state (for ExpandCollapse pattern elements) */
  expandCollapseState?: ExpandCollapseState;
  /** Selection state (for SelectionItem pattern elements) */
  isSelected?: boolean;
  /** Help text / tooltip */
  helpText?: string;
  /** Keyboard shortcut */
  acceleratorKey?: string;
  /** Access key (underlined character) */
  accessKey?: string;
}

/**
 * Error types for UIA operations
 */
export class UIAError extends Error {
  constructor(
    message: string,
    public code: UIAErrorCode,
    public details?: unknown
  ) {
    super(message);
    this.name = 'UIAError';
  }
}

export type UIAErrorCode =
  | 'NOT_WINDOWS'
  | 'ELEMENT_NOT_FOUND'
  | 'ELEMENT_NOT_ENABLED'
  | 'ELEMENT_OFFSCREEN'
  | 'PATTERN_NOT_SUPPORTED'
  | 'WINDOW_NOT_FOUND'
  | 'OPERATION_FAILED'
  | 'TIMEOUT'
  | 'INVALID_ARGUMENT'
  | 'BINDING_ERROR';
