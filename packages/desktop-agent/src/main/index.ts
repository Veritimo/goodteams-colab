/**
 * GoodTeams Desktop Agent - Main Process Entry
 *
 * Electron main process that:
 * - Initializes the app
 * - Creates the main window
 * - Sets up IPC handlers
 * - Manages app lifecycle
 */

import { app } from "electron";
import { AppLifecycle } from "./app.js";
import { WindowManager } from "./window.js";
import { TrayManager } from "./tray.js";
import { registerIPCHandlers } from "./ipc-handlers.js";
import { AutoUpdater } from "./updater.js";

// Globals for module access
let appLifecycle: AppLifecycle | null = null;
let windowManager: WindowManager | null = null;
let trayManager: TrayManager | null = null;
let autoUpdater: AutoUpdater | null = null;

/**
 * Main entry point for the Electron app
 */
async function main(): Promise<void> {
  // Initialize app lifecycle manager
  appLifecycle = new AppLifecycle();

  // Attempt to acquire single instance lock
  const gotLock = appLifecycle.acquireSingleInstanceLock();
  if (!gotLock) {
    // Another instance is running, quit
    app.quit();
    return;
  }

  // Wait for app to be ready
  await app.whenReady();

  // Initialize app
  await appLifecycle.initialize();

  // Create window manager
  windowManager = new WindowManager();

  // Create main window
  const mainWindow = windowManager.createMainWindow();

  // Register IPC handlers
  registerIPCHandlers(mainWindow);

  // Create tray
  trayManager = new TrayManager({
    onShowWindow: () => windowManager?.showWindow(),
    onHideWindow: () => windowManager?.hideWindow(),
    onQuit: () => app.quit(),
  });
  trayManager.create();

  // Initialize auto-updater (non-blocking)
  autoUpdater = new AutoUpdater({
    onUpdateAvailable: (info) => {
      trayManager?.setUpdateAvailable(true);
      mainWindow.webContents.send("update-available", info);
    },
    onUpdateDownloaded: (info) => {
      mainWindow.webContents.send("update-downloaded", info);
    },
    onError: (error) => {
      console.error("Auto-updater error:", error);
    },
  });
  autoUpdater.checkForUpdates();

  // Handle second instance (when user tries to open app again)
  app.on("second-instance", (_event, _commandLine, _workingDirectory) => {
    // Focus existing window
    windowManager?.showWindow();
  });

  // Handle activate (macOS dock click)
  app.on("activate", () => {
    if (!windowManager?.hasWindow()) {
      windowManager?.createMainWindow();
    } else {
      windowManager?.showWindow();
    }
  });

  // Handle all windows closed
  app.on("window-all-closed", () => {
    // On macOS, keep app running in tray
    if (process.platform !== "darwin") {
      // On other platforms, keep running in tray too
      // App will quit only when explicitly closed from tray
    }
  });

  // Handle before quit
  app.on("before-quit", async () => {
    if (appLifecycle) {
      await appLifecycle.shutdown();
    }
  });
}

// Start the app
main().catch((error) => {
  console.error("Failed to start GoodTeams Desktop Agent:", error);
  app.quit();
});

// Export for testing
export { appLifecycle, windowManager, trayManager, autoUpdater };
