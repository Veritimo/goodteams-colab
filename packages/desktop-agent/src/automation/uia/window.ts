/**
 * Window Operations for Windows UI Automation
 *
 * High-level functions for discovering and manipulating windows.
 */

import { getBindings, type UIABindings } from './bindings.js';
import { UIAError, type WindowInfo, type BoundingRect } from './types.js';

/**
 * Window operations class with dependency injection support
 */
export class WindowOperations {
  private bindings: UIABindings;

  constructor(bindings?: UIABindings) {
    this.bindings = bindings ?? getBindings();
  }

  /**
   * List all top-level windows on the desktop
   *
   * @returns Array of window information
   */
  async listWindows(): Promise<WindowInfo[]> {
    return this.bindings.listWindows();
  }

  /**
   * Find a window by title (partial match) and optional class name
   *
   * @param title - The window title to search for (partial match)
   * @param className - Optional Win32 class name for exact match
   * @returns The found window info or null
   */
  async findWindow(title: string, className?: string): Promise<WindowInfo | null> {
    if (!title) {
      throw new UIAError('Title is required to find a window', 'INVALID_ARGUMENT');
    }
    return this.bindings.findWindow(title, className);
  }

  /**
   * Find a window, throwing if not found
   *
   * @param title - The window title to search for
   * @param className - Optional Win32 class name
   * @returns The found window info
   * @throws UIAError if window not found
   */
  async findWindowOrThrow(title: string, className?: string): Promise<WindowInfo> {
    const window = await this.findWindow(title, className);
    if (!window) {
      throw new UIAError(
        `Window not found: ${title}${className ? ` (class: ${className})` : ''}`,
        'WINDOW_NOT_FOUND'
      );
    }
    return window;
  }

  /**
   * Get a window by its handle
   *
   * @param handle - The window handle (HWND)
   * @returns The window info or null
   */
  async getWindow(handle: number): Promise<WindowInfo | null> {
    if (handle <= 0) {
      throw new UIAError('Invalid window handle', 'INVALID_ARGUMENT');
    }
    return this.bindings.getWindow(handle);
  }

  /**
   * Focus/activate a window (bring to front)
   *
   * @param handle - The window handle to focus
   * @returns True if successful
   */
  async focusWindow(handle: number): Promise<boolean> {
    if (handle <= 0) {
      throw new UIAError('Invalid window handle', 'INVALID_ARGUMENT');
    }
    return this.bindings.focusWindow(handle);
  }

  /**
   * Focus a window by title
   *
   * @param title - The window title to search for
   * @returns True if successful
   */
  async focusWindowByTitle(title: string): Promise<boolean> {
    const window = await this.findWindowOrThrow(title);
    return this.focusWindow(window.handle);
  }

  /**
   * Get the position and size of a window
   *
   * @param handle - The window handle
   * @returns The window bounds or null
   */
  async getWindowBounds(handle: number): Promise<BoundingRect | null> {
    if (handle <= 0) {
      throw new UIAError('Invalid window handle', 'INVALID_ARGUMENT');
    }
    return this.bindings.getWindowBounds(handle);
  }

  /**
   * Minimize a window
   *
   * @param handle - The window handle
   * @returns True if successful
   */
  async minimizeWindow(handle: number): Promise<boolean> {
    if (handle <= 0) {
      throw new UIAError('Invalid window handle', 'INVALID_ARGUMENT');
    }
    return this.bindings.minimizeWindow(handle);
  }

  /**
   * Maximize a window
   *
   * @param handle - The window handle
   * @returns True if successful
   */
  async maximizeWindow(handle: number): Promise<boolean> {
    if (handle <= 0) {
      throw new UIAError('Invalid window handle', 'INVALID_ARGUMENT');
    }
    return this.bindings.maximizeWindow(handle);
  }

  /**
   * Restore a window from minimized or maximized state
   *
   * @param handle - The window handle
   * @returns True if successful
   */
  async restoreWindow(handle: number): Promise<boolean> {
    if (handle <= 0) {
      throw new UIAError('Invalid window handle', 'INVALID_ARGUMENT');
    }
    return this.bindings.restoreWindow(handle);
  }

  /**
   * Close a window
   *
   * @param handle - The window handle
   * @returns True if successful
   */
  async closeWindow(handle: number): Promise<boolean> {
    if (handle <= 0) {
      throw new UIAError('Invalid window handle', 'INVALID_ARGUMENT');
    }
    return this.bindings.closeWindow(handle);
  }

  /**
   * Find all windows matching a filter
   *
   * @param filter - Filter function
   * @returns Array of matching windows
   */
  async findWindows(filter: (window: WindowInfo) => boolean): Promise<WindowInfo[]> {
    const windows = await this.listWindows();
    return windows.filter(filter);
  }

  /**
   * Find windows by process ID
   *
   * @param processId - The process ID
   * @returns Array of windows belonging to the process
   */
  async findWindowsByProcess(processId: number): Promise<WindowInfo[]> {
    return this.findWindows(w => w.processId === processId);
  }

  /**
   * Find windows by class name
   *
   * @param className - The Win32 class name
   * @returns Array of windows with the given class
   */
  async findWindowsByClass(className: string): Promise<WindowInfo[]> {
    return this.findWindows(w => w.className === className);
  }

  /**
   * Wait for a window to appear
   *
   * @param title - The window title to wait for
   * @param timeout - Timeout in milliseconds (default: 10000)
   * @param pollInterval - Poll interval in milliseconds (default: 100)
   * @returns The found window
   * @throws UIAError on timeout
   */
  async waitForWindow(
    title: string,
    timeout = 10000,
    pollInterval = 100
  ): Promise<WindowInfo> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const window = await this.findWindow(title);
      if (window) {
        return window;
      }
      await this.sleep(pollInterval);
    }

    throw new UIAError(
      `Timeout waiting for window: ${title}`,
      'TIMEOUT'
    );
  }

  /**
   * Wait for a window to close
   *
   * @param handle - The window handle
   * @param timeout - Timeout in milliseconds (default: 10000)
   * @param pollInterval - Poll interval in milliseconds (default: 100)
   * @returns True when window is closed
   * @throws UIAError on timeout
   */
  async waitForWindowClose(
    handle: number,
    timeout = 10000,
    pollInterval = 100
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const window = await this.getWindow(handle);
      if (!window) {
        return true;
      }
      await this.sleep(pollInterval);
    }

    throw new UIAError(
      `Timeout waiting for window to close: ${handle}`,
      'TIMEOUT'
    );
  }

  /**
   * Check if a window exists
   *
   * @param handle - The window handle
   * @returns True if window exists
   */
  async windowExists(handle: number): Promise<boolean> {
    const window = await this.getWindow(handle);
    return window !== null;
  }

  /**
   * Check if a window is minimized
   *
   * @param handle - The window handle
   * @returns True if minimized
   */
  async isMinimized(handle: number): Promise<boolean> {
    const window = await this.getWindow(handle);
    return window?.isMinimized ?? false;
  }

  /**
   * Check if a window is maximized
   *
   * @param handle - The window handle
   * @returns True if maximized
   */
  async isMaximized(handle: number): Promise<boolean> {
    const window = await this.getWindow(handle);
    return window?.isMaximized ?? false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Default instance using global bindings
const defaultWindowOps = new WindowOperations();

// Export convenience functions
export const listWindows = () => defaultWindowOps.listWindows();
export const findWindow = (title: string, className?: string) => defaultWindowOps.findWindow(title, className);
export const findWindowOrThrow = (title: string, className?: string) => defaultWindowOps.findWindowOrThrow(title, className);
export const getWindow = (handle: number) => defaultWindowOps.getWindow(handle);
export const focusWindow = (handle: number) => defaultWindowOps.focusWindow(handle);
export const focusWindowByTitle = (title: string) => defaultWindowOps.focusWindowByTitle(title);
export const getWindowBounds = (handle: number) => defaultWindowOps.getWindowBounds(handle);
export const minimizeWindow = (handle: number) => defaultWindowOps.minimizeWindow(handle);
export const maximizeWindow = (handle: number) => defaultWindowOps.maximizeWindow(handle);
export const restoreWindow = (handle: number) => defaultWindowOps.restoreWindow(handle);
export const closeWindow = (handle: number) => defaultWindowOps.closeWindow(handle);
export const findWindows = (filter: (window: WindowInfo) => boolean) => defaultWindowOps.findWindows(filter);
export const findWindowsByProcess = (processId: number) => defaultWindowOps.findWindowsByProcess(processId);
export const findWindowsByClass = (className: string) => defaultWindowOps.findWindowsByClass(className);
export const waitForWindow = (title: string, timeout?: number, pollInterval?: number) =>
  defaultWindowOps.waitForWindow(title, timeout, pollInterval);
export const waitForWindowClose = (handle: number, timeout?: number, pollInterval?: number) =>
  defaultWindowOps.waitForWindowClose(handle, timeout, pollInterval);
export const windowExists = (handle: number) => defaultWindowOps.windowExists(handle);
export const isMinimized = (handle: number) => defaultWindowOps.isMinimized(handle);
export const isMaximized = (handle: number) => defaultWindowOps.isMaximized(handle);
