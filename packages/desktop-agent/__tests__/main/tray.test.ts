/**
 * Tests for TrayManager
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TrayManager, type ConnectionStatus } from "../../src/main/tray.js";
import { MockTray, MockMenu, MockNotification } from "../mocks/electron.js";

describe("TrayManager", () => {
  let trayManager: TrayManager;
  let onShowWindow: ReturnType<typeof vi.fn>;
  let onHideWindow: ReturnType<typeof vi.fn>;
  let onQuit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onShowWindow = vi.fn();
    onHideWindow = vi.fn();
    onQuit = vi.fn();

    trayManager = new TrayManager({
      onShowWindow,
      onHideWindow,
      onQuit,
    });
  });

  describe("create", () => {
    it("should create a tray icon", () => {
      const tray = trayManager.create();

      expect(tray).toBeInstanceOf(MockTray);
    });

    it("should return existing tray if already created", () => {
      const tray1 = trayManager.create();
      const tray2 = trayManager.create();

      expect(tray1).toBe(tray2);
    });

    it("should set tooltip", () => {
      const tray = trayManager.create();

      expect(tray.setToolTip).toHaveBeenCalledWith("GoodTeams Desktop Agent");
    });

    it("should set context menu", () => {
      trayManager.create();

      expect(MockMenu.buildFromTemplate).toHaveBeenCalled();
    });
  });

  describe("click handling", () => {
    it("should toggle window on click", () => {
      const tray = trayManager.create();

      // First click should hide (window starts visible)
      tray.emit("click");
      expect(onHideWindow).toHaveBeenCalled();

      // Second click should show
      tray.emit("click");
      expect(onShowWindow).toHaveBeenCalled();
    });

    it("should show context menu on right-click", () => {
      const tray = trayManager.create();

      tray.emit("right-click");

      expect(tray.popUpContextMenu).toHaveBeenCalled();
    });
  });

  describe("setStatus", () => {
    it("should update status to connected", () => {
      trayManager.create();

      trayManager.setStatus("connected");

      expect(trayManager.getStatus()).toBe("connected");
    });

    it("should update status to disconnected", () => {
      trayManager.create();
      trayManager.setStatus("connected");

      trayManager.setStatus("disconnected");

      expect(trayManager.getStatus()).toBe("disconnected");
    });

    it("should update status to connecting", () => {
      trayManager.create();

      trayManager.setStatus("connecting");

      expect(trayManager.getStatus()).toBe("connecting");
    });

    it("should update tray icon on status change", () => {
      const tray = trayManager.create();
      vi.clearAllMocks();

      trayManager.setStatus("connected");

      expect(tray.setImage).toHaveBeenCalled();
    });

    it("should update tooltip on status change", () => {
      const tray = trayManager.create();

      trayManager.setStatus("connected");

      expect(tray.setToolTip).toHaveBeenCalledWith(
        expect.stringContaining("Connected")
      );
    });

    it("should show notification on connect", () => {
      trayManager.create();
      trayManager.setStatus("disconnected");

      trayManager.setStatus("connected");

      expect(MockNotification.isSupported).toHaveBeenCalled();
    });

    it("should show notification on disconnect", () => {
      trayManager.create();
      trayManager.setStatus("connected");

      trayManager.setStatus("disconnected");

      expect(MockNotification.isSupported).toHaveBeenCalled();
    });
  });

  describe("setUpdateAvailable", () => {
    it("should set update available flag", () => {
      trayManager.create();

      trayManager.setUpdateAvailable(true);

      // Menu should be updated with update option
      expect(MockMenu.buildFromTemplate).toHaveBeenCalled();
    });

    it("should update tray icon when update available", () => {
      const tray = trayManager.create();
      vi.clearAllMocks();

      trayManager.setUpdateAvailable(true);

      expect(tray.setImage).toHaveBeenCalled();
    });

    it("should show notification when update available", () => {
      trayManager.create();

      trayManager.setUpdateAvailable(true);

      expect(MockNotification.isSupported).toHaveBeenCalled();
    });
  });

  describe("setWindowVisible", () => {
    it("should update menu when window visibility changes", () => {
      trayManager.create();
      vi.clearAllMocks();

      trayManager.setWindowVisible(false);

      expect(MockMenu.buildFromTemplate).toHaveBeenCalled();
    });
  });

  describe("showNotification", () => {
    it("should show notification if supported", () => {
      trayManager.create();

      trayManager.showNotification("Test Title", "Test Body");

      expect(MockNotification.isSupported).toHaveBeenCalled();
    });
  });

  describe("destroy", () => {
    it("should destroy tray", () => {
      const tray = trayManager.create();

      trayManager.destroy();

      expect(tray.destroy).toHaveBeenCalled();
      expect(trayManager.getTray()).toBe(null);
    });

    it("should be safe to call when tray does not exist", () => {
      // Should not throw
      trayManager.destroy();
    });
  });

  describe("getTray", () => {
    it("should return null when tray does not exist", () => {
      expect(trayManager.getTray()).toBe(null);
    });

    it("should return tray when it exists", () => {
      const tray = trayManager.create();

      expect(trayManager.getTray()).toBe(tray);
    });
  });
});
