/**
 * Windows UI Automation Native Bindings
 *
 * Abstract interface for UIA operations with factory to get real or mock implementations.
 * The real implementation would use edge.js, ffi-napi, or similar for Windows.
 */

import type {
  UIElement,
  WindowInfo,
  ElementSearchCriteria,
  TreeWalkOptions,
  BoundingRect,
  ToggleState,
  ExpandCollapseState,
  KeyModifier,
  ScrollDirection,
} from './types.js';

/**
 * Abstract interface for UIA native operations
 */
export interface UIABindings {
  // ========== Window Operations ==========

  /** List all top-level windows */
  listWindows(): Promise<WindowInfo[]>;

  /** Find a window by title and optional class name */
  findWindow(title: string, className?: string): Promise<WindowInfo | null>;

  /** Get window by handle */
  getWindow(handle: number): Promise<WindowInfo | null>;

  /** Focus/activate a window */
  focusWindow(handle: number): Promise<boolean>;

  /** Get window bounds */
  getWindowBounds(handle: number): Promise<BoundingRect | null>;

  /** Minimize a window */
  minimizeWindow(handle: number): Promise<boolean>;

  /** Maximize a window */
  maximizeWindow(handle: number): Promise<boolean>;

  /** Restore a window (from minimized/maximized) */
  restoreWindow(handle: number): Promise<boolean>;

  /** Close a window */
  closeWindow(handle: number): Promise<boolean>;

  // ========== Element Operations ==========

  /** Get the root automation element of a window */
  getRootElement(windowHandle: number): Promise<UIElement | null>;

  /** Find first matching element under a root */
  findElement(root: UIElement, criteria: ElementSearchCriteria): Promise<UIElement | null>;

  /** Find all matching elements under a root */
  findAllElements(root: UIElement, criteria: ElementSearchCriteria): Promise<UIElement[]>;

  /** Get element tree from a root element */
  getElementTree(root: UIElement, options?: TreeWalkOptions): Promise<UIElement>;

  /** Get element at screen coordinates */
  getElementAtPoint(x: number, y: number): Promise<UIElement | null>;

  /** Check if element is still valid */
  isElementValid(element: UIElement): Promise<boolean>;

  /** Get supported patterns for an element */
  getSupportedPatterns(element: UIElement): Promise<string[]>;

  // ========== Input Actions ==========

  /** Click at element center */
  click(element: UIElement): Promise<boolean>;

  /** Double-click at element center */
  doubleClick(element: UIElement): Promise<boolean>;

  /** Right-click at element center */
  rightClick(element: UIElement): Promise<boolean>;

  /** Click at specific coordinates */
  clickAt(x: number, y: number): Promise<boolean>;

  /** Type text (send keystrokes) */
  type(text: string): Promise<boolean>;

  /** Focus element and type text */
  typeInElement(element: UIElement, text: string): Promise<boolean>;

  /** Press a single key with optional modifiers */
  pressKey(key: string, modifiers?: KeyModifier[]): Promise<boolean>;

  /** Scroll an element */
  scroll(element: UIElement, direction: ScrollDirection, amount: number): Promise<boolean>;

  // ========== Pattern Operations ==========

  /** Invoke the Invoke pattern on an element */
  invoke(element: UIElement): Promise<boolean>;

  /** Set value using Value pattern */
  setValue(element: UIElement, value: string): Promise<boolean>;

  /** Get value using Value pattern */
  getValue(element: UIElement): Promise<string | null>;

  /** Toggle using Toggle pattern */
  toggle(element: UIElement): Promise<boolean>;

  /** Get toggle state */
  getToggleState(element: UIElement): Promise<ToggleState | null>;

  /** Select using SelectionItem pattern */
  select(element: UIElement): Promise<boolean>;

  /** Expand using ExpandCollapse pattern */
  expand(element: UIElement): Promise<boolean>;

  /** Collapse using ExpandCollapse pattern */
  collapse(element: UIElement): Promise<boolean>;

  /** Get expand/collapse state */
  getExpandCollapseState(element: UIElement): Promise<ExpandCollapseState | null>;

  // ========== Utility ==========

  /** Check if running on Windows */
  isWindowsPlatform(): boolean;

  /** Initialize the UIA subsystem */
  initialize(): Promise<void>;

  /** Cleanup/dispose resources */
  dispose(): Promise<void>;
}

/**
 * Mock UIA Bindings for testing and non-Windows platforms
 */
export class MockUIABindings implements UIABindings {
  private windows: Map<number, WindowInfo> = new Map();
  private elements: Map<string, UIElement> = new Map();
  private rootElements: Map<number, UIElement> = new Map();
  private toggleStates: Map<string, ToggleState> = new Map();
  private expandStates: Map<string, ExpandCollapseState> = new Map();
  private values: Map<string, string> = new Map();
  private _focusedWindow: number | null = null;

  /**
   * Set up mock windows for testing
   */
  setMockWindows(windows: WindowInfo[]): void {
    this.windows.clear();
    for (const win of windows) {
      this.windows.set(win.handle, win);
    }
  }

  /**
   * Set up mock root element for a window
   */
  setMockRootElement(windowHandle: number, element: UIElement): void {
    this.rootElements.set(windowHandle, element);
    this.indexElement(element);
  }

  /**
   * Set mock toggle state for an element
   */
  setMockToggleState(automationId: string, state: ToggleState): void {
    this.toggleStates.set(automationId, state);
  }

  /**
   * Set mock expand/collapse state for an element
   */
  setMockExpandState(automationId: string, state: ExpandCollapseState): void {
    this.expandStates.set(automationId, state);
  }

  /**
   * Set mock value for an element
   */
  setMockValue(automationId: string, value: string): void {
    this.values.set(automationId, value);
  }

  private indexElement(element: UIElement): void {
    if (element.automationId) {
      this.elements.set(element.automationId, element);
    }
    if (element.children) {
      for (const child of element.children) {
        this.indexElement(child);
      }
    }
  }

  isWindowsPlatform(): boolean {
    return false; // Mock always returns false
  }

  async initialize(): Promise<void> {
    // No-op for mock
  }

  async dispose(): Promise<void> {
    this.windows.clear();
    this.elements.clear();
    this.rootElements.clear();
  }

  async listWindows(): Promise<WindowInfo[]> {
    return Array.from(this.windows.values());
  }

  async findWindow(title: string, className?: string): Promise<WindowInfo | null> {
    for (const win of this.windows.values()) {
      const titleMatch = win.title.includes(title);
      const classMatch = !className || win.className === className;
      if (titleMatch && classMatch) {
        return win;
      }
    }
    return null;
  }

  async getWindow(handle: number): Promise<WindowInfo | null> {
    return this.windows.get(handle) ?? null;
  }

  async focusWindow(handle: number): Promise<boolean> {
    if (!this.windows.has(handle)) return false;
    this._focusedWindow = handle;
    return true;
  }

  async getWindowBounds(handle: number): Promise<BoundingRect | null> {
    const win = this.windows.get(handle);
    return win?.bounds ?? null;
  }

  async minimizeWindow(handle: number): Promise<boolean> {
    const win = this.windows.get(handle);
    if (!win) return false;
    win.isMinimized = true;
    win.isMaximized = false;
    return true;
  }

  async maximizeWindow(handle: number): Promise<boolean> {
    const win = this.windows.get(handle);
    if (!win) return false;
    win.isMaximized = true;
    win.isMinimized = false;
    return true;
  }

  async restoreWindow(handle: number): Promise<boolean> {
    const win = this.windows.get(handle);
    if (!win) return false;
    win.isMinimized = false;
    win.isMaximized = false;
    return true;
  }

  async closeWindow(handle: number): Promise<boolean> {
    return this.windows.delete(handle);
  }

  async getRootElement(windowHandle: number): Promise<UIElement | null> {
    return this.rootElements.get(windowHandle) ?? null;
  }

  async findElement(root: UIElement, criteria: ElementSearchCriteria): Promise<UIElement | null> {
    const results = await this.findAllElements(root, criteria);
    return results[0] ?? null;
  }

  async findAllElements(root: UIElement, criteria: ElementSearchCriteria): Promise<UIElement[]> {
    const results: UIElement[] = [];
    this.searchElement(root, criteria, results);
    return results;
  }

  private searchElement(element: UIElement, criteria: ElementSearchCriteria, results: UIElement[]): void {
    if (this.matchesCriteria(element, criteria)) {
      results.push(element);
    }
    if (element.children) {
      for (const child of element.children) {
        this.searchElement(child, criteria, results);
      }
    }
  }

  private matchesCriteria(element: UIElement, criteria: ElementSearchCriteria): boolean {
    if (criteria.automationId !== undefined) {
      if (criteria.partial) {
        if (!element.automationId.includes(criteria.automationId)) return false;
      } else {
        if (element.automationId !== criteria.automationId) return false;
      }
    }
    if (criteria.name !== undefined) {
      if (criteria.partial) {
        if (!element.name.includes(criteria.name)) return false;
      } else {
        if (element.name !== criteria.name) return false;
      }
    }
    if (criteria.controlType !== undefined && element.controlType !== criteria.controlType) {
      return false;
    }
    if (criteria.className !== undefined && element.className !== criteria.className) {
      return false;
    }
    return true;
  }

  async getElementTree(root: UIElement, options?: TreeWalkOptions): Promise<UIElement> {
    // For mock, just return the root with its children (already has tree structure)
    if (options?.maxDepth !== undefined) {
      return this.truncateTree(root, options.maxDepth);
    }
    return root;
  }

  private truncateTree(element: UIElement, depth: number): UIElement {
    if (depth <= 0) {
      const { children: _children, ...rest } = element;
      return rest;
    }
    return {
      ...element,
      children: element.children?.map(child => this.truncateTree(child, depth - 1)),
    };
  }

  async getElementAtPoint(x: number, y: number): Promise<UIElement | null> {
    // Find the smallest (most specific) element containing the point
    let bestMatch: UIElement | null = null;
    let bestArea = Infinity;

    for (const element of this.elements.values()) {
      const rect = element.boundingRect;
      if (
        x >= rect.x &&
        x <= rect.x + rect.width &&
        y >= rect.y &&
        y <= rect.y + rect.height
      ) {
        const area = rect.width * rect.height;
        if (area < bestArea) {
          bestArea = area;
          bestMatch = element;
        }
      }
    }
    return bestMatch;
  }

  async isElementValid(element: UIElement): Promise<boolean> {
    return element.automationId ? this.elements.has(element.automationId) : true;
  }

  async getSupportedPatterns(element: UIElement): Promise<string[]> {
    // Return common patterns based on control type
    const patterns: string[] = [];
    switch (element.controlType) {
      case 'Button':
        patterns.push('Invoke');
        break;
      case 'Edit':
      case 'Text':
        patterns.push('Value');
        break;
      case 'CheckBox':
        patterns.push('Toggle');
        break;
      case 'ComboBox':
      case 'TreeItem':
        patterns.push('ExpandCollapse', 'SelectionItem');
        break;
      case 'ListItem':
      case 'TabItem':
        patterns.push('SelectionItem');
        break;
    }
    return patterns;
  }

  async click(_element: UIElement): Promise<boolean> {
    return true;
  }

  async doubleClick(_element: UIElement): Promise<boolean> {
    return true;
  }

  async rightClick(_element: UIElement): Promise<boolean> {
    return true;
  }

  async clickAt(_x: number, _y: number): Promise<boolean> {
    return true;
  }

  async type(_text: string): Promise<boolean> {
    return true;
  }

  async typeInElement(element: UIElement, text: string): Promise<boolean> {
    if (!element.isEnabled) return false;
    // Store typed value for testing
    if (element.automationId) {
      this.values.set(element.automationId, text);
    }
    return true;
  }

  async pressKey(_key: string, _modifiers?: KeyModifier[]): Promise<boolean> {
    return true;
  }

  async scroll(_element: UIElement, _direction: ScrollDirection, _amount: number): Promise<boolean> {
    return true;
  }

  async invoke(element: UIElement): Promise<boolean> {
    return element.isEnabled;
  }

  async setValue(element: UIElement, value: string): Promise<boolean> {
    if (!element.isEnabled) return false;
    if (element.automationId) {
      this.values.set(element.automationId, value);
    }
    return true;
  }

  async getValue(element: UIElement): Promise<string | null> {
    return element.automationId ? (this.values.get(element.automationId) ?? null) : null;
  }

  async toggle(element: UIElement): Promise<boolean> {
    if (!element.isEnabled) return false;
    if (element.automationId) {
      const current = this.toggleStates.get(element.automationId) ?? 'Off';
      this.toggleStates.set(element.automationId, current === 'On' ? 'Off' : 'On');
    }
    return true;
  }

  async getToggleState(element: UIElement): Promise<ToggleState | null> {
    return element.automationId ? (this.toggleStates.get(element.automationId) ?? null) : null;
  }

  async select(element: UIElement): Promise<boolean> {
    return element.isEnabled;
  }

  async expand(element: UIElement): Promise<boolean> {
    if (!element.isEnabled) return false;
    if (element.automationId) {
      this.expandStates.set(element.automationId, 'Expanded');
    }
    return true;
  }

  async collapse(element: UIElement): Promise<boolean> {
    if (!element.isEnabled) return false;
    if (element.automationId) {
      this.expandStates.set(element.automationId, 'Collapsed');
    }
    return true;
  }

  async getExpandCollapseState(element: UIElement): Promise<ExpandCollapseState | null> {
    return element.automationId ? (this.expandStates.get(element.automationId) ?? null) : null;
  }
}

/**
 * Stub implementation for non-Windows platforms
 * Throws errors for all operations indicating platform is not supported
 */
export class StubUIABindings implements UIABindings {
  private throwNotSupported(operation: string): never {
    throw new Error(`UI Automation is not supported on this platform: ${operation}`);
  }

  isWindowsPlatform(): boolean {
    return false;
  }

  async initialize(): Promise<void> {
    // No-op
  }

  async dispose(): Promise<void> {
    // No-op
  }

  async listWindows(): Promise<WindowInfo[]> {
    this.throwNotSupported('listWindows');
  }

  async findWindow(_title: string, _className?: string): Promise<WindowInfo | null> {
    this.throwNotSupported('findWindow');
  }

  async getWindow(_handle: number): Promise<WindowInfo | null> {
    this.throwNotSupported('getWindow');
  }

  async focusWindow(_handle: number): Promise<boolean> {
    this.throwNotSupported('focusWindow');
  }

  async getWindowBounds(_handle: number): Promise<BoundingRect | null> {
    this.throwNotSupported('getWindowBounds');
  }

  async minimizeWindow(_handle: number): Promise<boolean> {
    this.throwNotSupported('minimizeWindow');
  }

  async maximizeWindow(_handle: number): Promise<boolean> {
    this.throwNotSupported('maximizeWindow');
  }

  async restoreWindow(_handle: number): Promise<boolean> {
    this.throwNotSupported('restoreWindow');
  }

  async closeWindow(_handle: number): Promise<boolean> {
    this.throwNotSupported('closeWindow');
  }

  async getRootElement(_windowHandle: number): Promise<UIElement | null> {
    this.throwNotSupported('getRootElement');
  }

  async findElement(_root: UIElement, _criteria: ElementSearchCriteria): Promise<UIElement | null> {
    this.throwNotSupported('findElement');
  }

  async findAllElements(_root: UIElement, _criteria: ElementSearchCriteria): Promise<UIElement[]> {
    this.throwNotSupported('findAllElements');
  }

  async getElementTree(_root: UIElement, _options?: TreeWalkOptions): Promise<UIElement> {
    this.throwNotSupported('getElementTree');
  }

  async getElementAtPoint(_x: number, _y: number): Promise<UIElement | null> {
    this.throwNotSupported('getElementAtPoint');
  }

  async isElementValid(_element: UIElement): Promise<boolean> {
    this.throwNotSupported('isElementValid');
  }

  async getSupportedPatterns(_element: UIElement): Promise<string[]> {
    this.throwNotSupported('getSupportedPatterns');
  }

  async click(_element: UIElement): Promise<boolean> {
    this.throwNotSupported('click');
  }

  async doubleClick(_element: UIElement): Promise<boolean> {
    this.throwNotSupported('doubleClick');
  }

  async rightClick(_element: UIElement): Promise<boolean> {
    this.throwNotSupported('rightClick');
  }

  async clickAt(_x: number, _y: number): Promise<boolean> {
    this.throwNotSupported('clickAt');
  }

  async type(_text: string): Promise<boolean> {
    this.throwNotSupported('type');
  }

  async typeInElement(_element: UIElement, _text: string): Promise<boolean> {
    this.throwNotSupported('typeInElement');
  }

  async pressKey(_key: string, _modifiers?: KeyModifier[]): Promise<boolean> {
    this.throwNotSupported('pressKey');
  }

  async scroll(_element: UIElement, _direction: ScrollDirection, _amount: number): Promise<boolean> {
    this.throwNotSupported('scroll');
  }

  async invoke(_element: UIElement): Promise<boolean> {
    this.throwNotSupported('invoke');
  }

  async setValue(_element: UIElement, _value: string): Promise<boolean> {
    this.throwNotSupported('setValue');
  }

  async getValue(_element: UIElement): Promise<string | null> {
    this.throwNotSupported('getValue');
  }

  async toggle(_element: UIElement): Promise<boolean> {
    this.throwNotSupported('toggle');
  }

  async getToggleState(_element: UIElement): Promise<ToggleState | null> {
    this.throwNotSupported('getToggleState');
  }

  async select(_element: UIElement): Promise<boolean> {
    this.throwNotSupported('select');
  }

  async expand(_element: UIElement): Promise<boolean> {
    this.throwNotSupported('expand');
  }

  async collapse(_element: UIElement): Promise<boolean> {
    this.throwNotSupported('collapse');
  }

  async getExpandCollapseState(_element: UIElement): Promise<ExpandCollapseState | null> {
    this.throwNotSupported('getExpandCollapseState');
  }
}

// Singleton instances
let bindingsInstance: UIABindings | null = null;
let mockBindingsInstance: MockUIABindings | null = null;

/**
 * Get the appropriate UIA bindings for the current platform
 */
export function getBindings(): UIABindings {
  if (bindingsInstance) return bindingsInstance;

  const isWindows = process.platform === 'win32';

  if (isWindows) {
    // TODO: Return real Windows UIA bindings when implemented
    // For now, return stub
    bindingsInstance = new StubUIABindings();
  } else {
    // Non-Windows platform - return stub that throws
    bindingsInstance = new StubUIABindings();
  }

  return bindingsInstance;
}

/**
 * Get mock bindings for testing
 */
export function getMockBindings(): MockUIABindings {
  if (!mockBindingsInstance) {
    mockBindingsInstance = new MockUIABindings();
  }
  return mockBindingsInstance;
}

/**
 * Reset bindings (for testing)
 */
export function resetBindings(): void {
  bindingsInstance = null;
  mockBindingsInstance = null;
}

/**
 * Set custom bindings (for dependency injection in tests)
 */
export function setBindings(bindings: UIABindings): void {
  bindingsInstance = bindings;
}
