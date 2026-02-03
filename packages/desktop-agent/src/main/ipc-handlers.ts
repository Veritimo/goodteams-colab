/**
 * GoodTeams Desktop Agent - IPC Handlers
 *
 * Handles Inter-Process Communication between main and renderer:
 * - Gateway connection management
 * - Automation commands
 * - Screen capture
 * - System information
 */

import { ipcMain, BrowserWindow, desktopCapturer, screen } from "electron";

/**
 * IPC Channel constants for type-safe communication
 */
export const IPC_CHANNELS = {
  // App lifecycle
  APP_GET_VERSION: "app:get-version",
  APP_GET_STATE: "app:get-state",
  APP_QUIT: "app:quit",

  // Gateway connection
  GATEWAY_CONNECT: "gateway:connect",
  GATEWAY_DISCONNECT: "gateway:disconnect",
  GATEWAY_GET_STATUS: "gateway:get-status",
  GATEWAY_SEND: "gateway:send",

  // Window management
  WINDOW_MINIMIZE: "window:minimize",
  WINDOW_MAXIMIZE: "window:maximize",
  WINDOW_CLOSE: "window:close",

  // Screen capture
  SCREEN_GET_SOURCES: "screen:get-sources",
  SCREEN_CAPTURE: "screen:capture",
  SCREEN_GET_DISPLAYS: "screen:get-displays",

  // Automation (stubs for future)
  AUTOMATION_CLICK: "automation:click",
  AUTOMATION_TYPE: "automation:type",
  AUTOMATION_GET_WINDOWS: "automation:get-windows",
  AUTOMATION_GET_ELEMENTS: "automation:get-elements",

  // Events (main -> renderer)
  GATEWAY_STATUS_CHANGED: "gateway:status-changed",
  GATEWAY_MESSAGE: "gateway:message",
  UPDATE_AVAILABLE: "update-available",
  UPDATE_DOWNLOADED: "update-downloaded",
} as const;

export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

/**
 * Register all IPC handlers
 */
export function registerIPCHandlers(mainWindow: BrowserWindow): void {
  // App lifecycle handlers
  registerAppHandlers();

  // Window management handlers
  registerWindowHandlers(mainWindow);

  // Screen capture handlers
  registerScreenHandlers();

  // Automation handlers (stubs)
  registerAutomationHandlers();
}

/**
 * Register app-related IPC handlers
 */
function registerAppHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => {
    const { app } = require("electron");
    return {
      version: app.getVersion(),
      name: app.getName(),
      platform: process.platform,
      arch: process.arch,
    };
  });

  ipcMain.handle(IPC_CHANNELS.APP_GET_STATE, () => {
    // Return current app state
    // This will be populated by the app lifecycle manager
    return {
      initialized: true,
      gatewayConnected: false,
      nodeId: null,
    };
  });

  ipcMain.handle(IPC_CHANNELS.APP_QUIT, () => {
    const { app } = require("electron");
    app.quit();
  });
}

/**
 * Register window management IPC handlers
 */
function registerWindowHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    mainWindow.minimize();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    return mainWindow.isMaximized();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, () => {
    mainWindow.hide();
  });
}

/**
 * Register screen capture IPC handlers
 */
function registerScreenHandlers(): void {
  // Get available screen sources
  ipcMain.handle(
    IPC_CHANNELS.SCREEN_GET_SOURCES,
    async (
      _event,
      options: { types?: ("window" | "screen")[]; thumbnailSize?: { width: number; height: number } }
    ) => {
      const sources = await desktopCapturer.getSources({
        types: options.types ?? ["window", "screen"],
        thumbnailSize: options.thumbnailSize ?? { width: 150, height: 150 },
      });

      return sources.map((source) => ({
        id: source.id,
        name: source.name,
        displayId: source.display_id,
        thumbnail: source.thumbnail.toDataURL(),
        appIcon: source.appIcon?.toDataURL(),
      }));
    }
  );

  // Capture a specific source
  ipcMain.handle(
    IPC_CHANNELS.SCREEN_CAPTURE,
    async (_event, options: { sourceId: string; width?: number; height?: number }) => {
      const sources = await desktopCapturer.getSources({
        types: ["window", "screen"],
        thumbnailSize: {
          width: options.width ?? 1920,
          height: options.height ?? 1080,
        },
      });

      const source = sources.find((s) => s.id === options.sourceId);
      if (!source) {
        throw new Error(`Source not found: ${options.sourceId}`);
      }

      return {
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
      };
    }
  );

  // Get display information
  ipcMain.handle(IPC_CHANNELS.SCREEN_GET_DISPLAYS, () => {
    const displays = screen.getAllDisplays();
    const primary = screen.getPrimaryDisplay();

    return {
      primary: {
        id: primary.id,
        bounds: primary.bounds,
        workArea: primary.workArea,
        scaleFactor: primary.scaleFactor,
      },
      displays: displays.map((display) => ({
        id: display.id,
        bounds: display.bounds,
        workArea: display.workArea,
        scaleFactor: display.scaleFactor,
        isPrimary: display.id === primary.id,
      })),
    };
  });
}

/**
 * Register automation IPC handlers (stubs for future implementation)
 */
function registerAutomationHandlers(): void {
  // Click automation (stub)
  ipcMain.handle(
    IPC_CHANNELS.AUTOMATION_CLICK,
    async (_event, params: { x: number; y: number; button?: "left" | "right" | "middle" }) => {
      // TODO: Implement using UI Automation API
      console.log("Automation click:", params);
      return { success: false, error: "Not implemented" };
    }
  );

  // Type automation (stub)
  ipcMain.handle(
    IPC_CHANNELS.AUTOMATION_TYPE,
    async (_event, params: { text: string; delay?: number }) => {
      // TODO: Implement using UI Automation API
      console.log("Automation type:", params);
      return { success: false, error: "Not implemented" };
    }
  );

  // Get windows (stub)
  ipcMain.handle(IPC_CHANNELS.AUTOMATION_GET_WINDOWS, async () => {
    // TODO: Implement using UI Automation API
    return { success: false, error: "Not implemented", windows: [] };
  });

  // Get elements (stub)
  ipcMain.handle(
    IPC_CHANNELS.AUTOMATION_GET_ELEMENTS,
    async (_event, params: { windowId?: string; selector?: string }) => {
      // TODO: Implement using UI Automation API
      console.log("Get elements:", params);
      return { success: false, error: "Not implemented", elements: [] };
    }
  );
}

/**
 * Unregister all IPC handlers (for cleanup)
 */
export function unregisterIPCHandlers(): void {
  Object.values(IPC_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
