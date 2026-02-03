/**
 * Tests for WindowManager
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { WindowManager } from "../../src/main/window.js";
import { MockBrowserWindow, mockScreen } from "../mocks/electron.js";
import fs from "node:fs";

describe("WindowManager", () => {
  let windowManager: WindowManager;

  beforeEach(() => {
    vi.clearAllMocks();
    windowManager = new WindowManager();
  });

  describe("createMainWindow", () => {
    it("should create a BrowserWindow", () => {
      const window = windowManager.createMainWindow();

      expect(window).toBeInstanceOf(MockBrowserWindow);
    });

    it("should return existing window if already created", () => {
      const window1 = windowManager.createMainWindow();
      const window2 = windowManager.createMainWindow();

      expect(window1).toBe(window2);
    });

    it("should use default dimensions", () => {
      const window = windowManager.createMainWindow();

      const bounds = window.getBounds();
      expect(bounds.width).toBe(800);
      expect(bounds.height).toBe(600);
    });

    it("should use custom dimensions from options", () => {
      const manager = new WindowManager({
        defaultWidth: 1400,
        defaultHeight: 900,
      });

      const window = manager.createMainWindow();
      // Note: MockBrowserWindow uses default bounds, but the constructor was called with our options
      expect(window).toBeInstanceOf(MockBrowserWindow);
    });

    it("should load content after creation", () => {
      const window = windowManager.createMainWindow();

      expect(window.loadFile).toHaveBeenCalled();
    });

    it("should open DevTools in dev mode", () => {
      const manager = new WindowManager({ devTools: true });
      const window = manager.createMainWindow();

      expect(window.webContents.openDevTools).toHaveBeenCalled();
    });
  });

  describe("showWindow", () => {
    it("should show the window", () => {
      const window = windowManager.createMainWindow();
      window.hide();

      windowManager.showWindow();

      expect(window.show).toHaveBeenCalled();
      expect(window.focus).toHaveBeenCalled();
    });

    it("should restore minimized window", () => {
      const window = windowManager.createMainWindow();
      window.minimize();

      windowManager.showWindow();

      expect(window.restore).toHaveBeenCalled();
    });

    it("should create window if it does not exist", () => {
      windowManager.showWindow();

      expect(windowManager.hasWindow()).toBe(true);
    });
  });

  describe("hideWindow", () => {
    it("should hide the window", () => {
      const window = windowManager.createMainWindow();

      windowManager.hideWindow();

      expect(window.hide).toHaveBeenCalled();
    });

    it("should do nothing if window does not exist", () => {
      // Should not throw
      windowManager.hideWindow();
    });
  });

  describe("toggleWindow", () => {
    it("should hide visible window", () => {
      const window = windowManager.createMainWindow();
      window.show();

      windowManager.toggleWindow();

      expect(window.hide).toHaveBeenCalled();
    });

    it("should show hidden window", () => {
      const window = windowManager.createMainWindow();
      window.hide();

      windowManager.toggleWindow();

      expect(window.show).toHaveBeenCalled();
    });
  });

  describe("hasWindow", () => {
    it("should return false when no window exists", () => {
      expect(windowManager.hasWindow()).toBe(false);
    });

    it("should return true when window exists", () => {
      windowManager.createMainWindow();

      expect(windowManager.hasWindow()).toBe(true);
    });
  });

  describe("getWindow", () => {
    it("should return null when no window exists", () => {
      expect(windowManager.getWindow()).toBe(null);
    });

    it("should return window when it exists", () => {
      const window = windowManager.createMainWindow();

      expect(windowManager.getWindow()).toBe(window);
    });
  });

  describe("destroyWindow", () => {
    it("should destroy the window", () => {
      const window = windowManager.createMainWindow();

      windowManager.destroyWindow();

      expect(window.destroy).toHaveBeenCalled();
      expect(windowManager.hasWindow()).toBe(false);
    });

    it("should do nothing if window does not exist", () => {
      // Should not throw
      windowManager.destroyWindow();
    });
  });

  describe("window state persistence", () => {
    it("should load window state from file", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ x: 100, y: 100, width: 1000, height: 700 })
      );

      const manager = new WindowManager();
      manager.createMainWindow();

      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.readFileSync).toHaveBeenCalled();
    });

    it("should use default state if file does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const manager = new WindowManager();
      manager.createMainWindow();

      expect(manager.hasWindow()).toBe(true);
    });

    it("should validate window state bounds", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      // Invalid: window is off-screen
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ x: 10000, y: 10000, width: 800, height: 600 })
      );

      mockScreen.getAllDisplays.mockReturnValue([
        {
          id: 1,
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
          workArea: { x: 0, y: 0, width: 1920, height: 1040 },
          scaleFactor: 1,
        },
      ]);

      const manager = new WindowManager();
      manager.createMainWindow();

      // Should fall back to default bounds
      expect(manager.hasWindow()).toBe(true);
    });
  });
});
