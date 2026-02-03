/**
 * Window Operations Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  WindowOperations,
  MockUIABindings,
  setBindings,
  resetBindings,
  UIAError,
  type WindowInfo,
} from '../../../src/automation/uia/index.js';

describe('WindowOperations', () => {
  let mockBindings: MockUIABindings;
  let windowOps: WindowOperations;

  const sampleWindows: WindowInfo[] = [
    {
      handle: 1001,
      title: 'Notepad - Untitled',
      className: 'Notepad',
      processId: 1234,
      bounds: { x: 100, y: 100, width: 800, height: 600 },
      isMinimized: false,
      isMaximized: false,
      isVisible: true,
    },
    {
      handle: 1002,
      title: 'Microsoft Excel - Book1',
      className: 'XLMAIN',
      processId: 5678,
      bounds: { x: 200, y: 150, width: 1200, height: 800 },
      isMinimized: false,
      isMaximized: true,
      isVisible: true,
    },
    {
      handle: 1003,
      title: 'Calculator',
      className: 'CalcFrame',
      processId: 9999,
      bounds: { x: 300, y: 200, width: 320, height: 480 },
      isMinimized: true,
      isMaximized: false,
      isVisible: false,
    },
  ];

  beforeEach(() => {
    mockBindings = new MockUIABindings();
    mockBindings.setMockWindows(sampleWindows);
    setBindings(mockBindings);
    windowOps = new WindowOperations(mockBindings);
  });

  afterEach(() => {
    resetBindings();
  });

  // ========== listWindows tests ==========

  describe('listWindows', () => {
    it('should list all windows', async () => {
      const windows = await windowOps.listWindows();
      expect(windows).toHaveLength(3);
      expect(windows.map(w => w.title)).toContain('Notepad - Untitled');
      expect(windows.map(w => w.title)).toContain('Microsoft Excel - Book1');
      expect(windows.map(w => w.title)).toContain('Calculator');
    });

    it('should return empty array when no windows', async () => {
      mockBindings.setMockWindows([]);
      const windows = await windowOps.listWindows();
      expect(windows).toHaveLength(0);
    });
  });

  // ========== findWindow tests ==========

  describe('findWindow', () => {
    it('should find window by exact title', async () => {
      const window = await windowOps.findWindow('Notepad - Untitled');
      expect(window).not.toBeNull();
      expect(window?.handle).toBe(1001);
    });

    it('should find window by partial title', async () => {
      const window = await windowOps.findWindow('Excel');
      expect(window).not.toBeNull();
      expect(window?.handle).toBe(1002);
    });

    it('should return null for non-existent window', async () => {
      const window = await windowOps.findWindow('NonExistent');
      expect(window).toBeNull();
    });

    it('should find window by title and class name', async () => {
      const window = await windowOps.findWindow('Notepad', 'Notepad');
      expect(window).not.toBeNull();
      expect(window?.className).toBe('Notepad');
    });

    it('should throw error for empty title', async () => {
      await expect(windowOps.findWindow('')).rejects.toThrow(UIAError);
    });
  });

  // ========== findWindowOrThrow tests ==========

  describe('findWindowOrThrow', () => {
    it('should return window when found', async () => {
      const window = await windowOps.findWindowOrThrow('Calculator');
      expect(window.handle).toBe(1003);
    });

    it('should throw UIAError when window not found', async () => {
      await expect(windowOps.findWindowOrThrow('NotFound')).rejects.toThrow(UIAError);
      await expect(windowOps.findWindowOrThrow('NotFound')).rejects.toMatchObject({
        code: 'WINDOW_NOT_FOUND',
      });
    });
  });

  // ========== getWindow tests ==========

  describe('getWindow', () => {
    it('should get window by handle', async () => {
      const window = await windowOps.getWindow(1001);
      expect(window).not.toBeNull();
      expect(window?.title).toBe('Notepad - Untitled');
    });

    it('should return null for non-existent handle', async () => {
      const window = await windowOps.getWindow(99999);
      expect(window).toBeNull();
    });

    it('should throw error for invalid handle', async () => {
      await expect(windowOps.getWindow(0)).rejects.toThrow(UIAError);
      await expect(windowOps.getWindow(-1)).rejects.toThrow(UIAError);
    });
  });

  // ========== focusWindow tests ==========

  describe('focusWindow', () => {
    it('should focus existing window', async () => {
      const result = await windowOps.focusWindow(1001);
      expect(result).toBe(true);
    });

    it('should return false for non-existent window', async () => {
      const result = await windowOps.focusWindow(99999);
      expect(result).toBe(false);
    });

    it('should throw error for invalid handle', async () => {
      await expect(windowOps.focusWindow(0)).rejects.toThrow(UIAError);
    });
  });

  // ========== focusWindowByTitle tests ==========

  describe('focusWindowByTitle', () => {
    it('should focus window by title', async () => {
      const result = await windowOps.focusWindowByTitle('Calculator');
      expect(result).toBe(true);
    });

    it('should throw when window not found', async () => {
      await expect(windowOps.focusWindowByTitle('NotFound')).rejects.toThrow(UIAError);
    });
  });

  // ========== getWindowBounds tests ==========

  describe('getWindowBounds', () => {
    it('should get window bounds', async () => {
      const bounds = await windowOps.getWindowBounds(1001);
      expect(bounds).toEqual({ x: 100, y: 100, width: 800, height: 600 });
    });

    it('should return null for non-existent window', async () => {
      const bounds = await windowOps.getWindowBounds(99999);
      expect(bounds).toBeNull();
    });
  });

  // ========== minimizeWindow tests ==========

  describe('minimizeWindow', () => {
    it('should minimize window', async () => {
      const result = await windowOps.minimizeWindow(1001);
      expect(result).toBe(true);
      const window = await windowOps.getWindow(1001);
      expect(window?.isMinimized).toBe(true);
    });

    it('should return false for non-existent window', async () => {
      const result = await windowOps.minimizeWindow(99999);
      expect(result).toBe(false);
    });
  });

  // ========== maximizeWindow tests ==========

  describe('maximizeWindow', () => {
    it('should maximize window', async () => {
      const result = await windowOps.maximizeWindow(1001);
      expect(result).toBe(true);
      const window = await windowOps.getWindow(1001);
      expect(window?.isMaximized).toBe(true);
      expect(window?.isMinimized).toBe(false);
    });
  });

  // ========== restoreWindow tests ==========

  describe('restoreWindow', () => {
    it('should restore minimized window', async () => {
      await windowOps.minimizeWindow(1001);
      const result = await windowOps.restoreWindow(1001);
      expect(result).toBe(true);
      const window = await windowOps.getWindow(1001);
      expect(window?.isMinimized).toBe(false);
      expect(window?.isMaximized).toBe(false);
    });

    it('should restore maximized window', async () => {
      await windowOps.maximizeWindow(1001);
      const result = await windowOps.restoreWindow(1001);
      expect(result).toBe(true);
      const window = await windowOps.getWindow(1001);
      expect(window?.isMaximized).toBe(false);
    });
  });

  // ========== closeWindow tests ==========

  describe('closeWindow', () => {
    it('should close window', async () => {
      const result = await windowOps.closeWindow(1001);
      expect(result).toBe(true);
      const window = await windowOps.getWindow(1001);
      expect(window).toBeNull();
    });
  });

  // ========== findWindows (filter) tests ==========

  describe('findWindows', () => {
    it('should find windows by custom filter', async () => {
      const windows = await windowOps.findWindows(w => w.isMaximized === true);
      expect(windows).toHaveLength(1);
      expect(windows[0].title).toBe('Microsoft Excel - Book1');
    });

    it('should return empty array when no matches', async () => {
      const windows = await windowOps.findWindows(w => w.processId === 0);
      expect(windows).toHaveLength(0);
    });
  });

  // ========== findWindowsByProcess tests ==========

  describe('findWindowsByProcess', () => {
    it('should find windows by process ID', async () => {
      const windows = await windowOps.findWindowsByProcess(5678);
      expect(windows).toHaveLength(1);
      expect(windows[0].title).toBe('Microsoft Excel - Book1');
    });
  });

  // ========== findWindowsByClass tests ==========

  describe('findWindowsByClass', () => {
    it('should find windows by class name', async () => {
      const windows = await windowOps.findWindowsByClass('Notepad');
      expect(windows).toHaveLength(1);
      expect(windows[0].handle).toBe(1001);
    });
  });

  // ========== windowExists tests ==========

  describe('windowExists', () => {
    it('should return true for existing window', async () => {
      const exists = await windowOps.windowExists(1001);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent window', async () => {
      const exists = await windowOps.windowExists(99999);
      expect(exists).toBe(false);
    });
  });

  // ========== isMinimized tests ==========

  describe('isMinimized', () => {
    it('should return true for minimized window', async () => {
      const minimized = await windowOps.isMinimized(1003);
      expect(minimized).toBe(true);
    });

    it('should return false for non-minimized window', async () => {
      const minimized = await windowOps.isMinimized(1001);
      expect(minimized).toBe(false);
    });
  });

  // ========== isMaximized tests ==========

  describe('isMaximized', () => {
    it('should return true for maximized window', async () => {
      const maximized = await windowOps.isMaximized(1002);
      expect(maximized).toBe(true);
    });

    it('should return false for non-maximized window', async () => {
      const maximized = await windowOps.isMaximized(1001);
      expect(maximized).toBe(false);
    });
  });

  // ========== waitForWindow tests ==========

  describe('waitForWindow', () => {
    it('should return immediately if window exists', async () => {
      const window = await windowOps.waitForWindow('Notepad', 1000, 50);
      expect(window.handle).toBe(1001);
    });

    it('should timeout if window does not appear', async () => {
      await expect(
        windowOps.waitForWindow('NonExistent', 100, 20)
      ).rejects.toThrow(UIAError);
    });
  });

  // ========== waitForWindowClose tests ==========

  describe('waitForWindowClose', () => {
    it('should return immediately if window does not exist', async () => {
      const result = await windowOps.waitForWindowClose(99999, 100, 20);
      expect(result).toBe(true);
    });

    it('should timeout if window does not close', async () => {
      await expect(
        windowOps.waitForWindowClose(1001, 100, 20)
      ).rejects.toThrow(UIAError);
    });
  });
});
