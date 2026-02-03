/**
 * GoodTeams Desktop Agent - Window Management
 *
 * Handles:
 * - Main window creation
 * - Window state persistence
 * - Show/hide operations
 * - DevTools in dev mode
 */

import { BrowserWindow, screen, app } from "electron";
import path from "node:path";
import fs from "node:fs";

export interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized?: boolean;
}

export interface WindowManagerOptions {
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  devTools?: boolean;
}

const DEFAULT_OPTIONS: Required<WindowManagerOptions> = {
  defaultWidth: 1200,
  defaultHeight: 800,
  minWidth: 800,
  minHeight: 600,
  devTools: process.env.NODE_ENV === "development",
};

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private options: Required<WindowManagerOptions>;
  private windowState: WindowState;
  private statePath: string;
  private stateChangeTimer: NodeJS.Timeout | null = null;

  constructor(options: WindowManagerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.statePath = path.join(
      app.getPath("userData"),
      "window-state.json"
    );
    this.windowState = this.loadWindowState();
  }

  /**
   * Load window state from file
   */
  private loadWindowState(): WindowState {
    try {
      if (fs.existsSync(this.statePath)) {
        const data = fs.readFileSync(this.statePath, "utf-8");
        const state = JSON.parse(data) as WindowState;

        // Validate state
        if (this.isValidWindowState(state)) {
          return state;
        }
      }
    } catch (error) {
      console.error("Failed to load window state:", error);
    }

    // Return default state
    return {
      width: this.options.defaultWidth,
      height: this.options.defaultHeight,
    };
  }

  /**
   * Validate that window state is usable
   */
  private isValidWindowState(state: WindowState): boolean {
    // Check that window is visible on at least one display
    if (state.x !== undefined && state.y !== undefined) {
      const displays = screen.getAllDisplays();
      const isVisible = displays.some((display) => {
        const { x, y, width, height } = display.bounds;
        return (
          state.x! >= x &&
          state.x! < x + width &&
          state.y! >= y &&
          state.y! < y + height
        );
      });

      if (!isVisible) {
        return false;
      }
    }

    return (
      state.width >= this.options.minWidth &&
      state.height >= this.options.minHeight
    );
  }

  /**
   * Save window state to file
   */
  private saveWindowState(): void {
    try {
      const dir = path.dirname(this.statePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(
        this.statePath,
        JSON.stringify(this.windowState, null, 2)
      );
    } catch (error) {
      console.error("Failed to save window state:", error);
    }
  }

  /**
   * Track window state changes with debounce
   */
  private trackWindowState(): void {
    if (!this.mainWindow) return;

    // Clear existing timer
    if (this.stateChangeTimer) {
      clearTimeout(this.stateChangeTimer);
    }

    // Debounce save
    this.stateChangeTimer = setTimeout(() => {
      if (!this.mainWindow) return;

      const bounds = this.mainWindow.getBounds();
      const isMaximized = this.mainWindow.isMaximized();

      // Don't save bounds if maximized (we want to restore to pre-maximized size)
      if (!isMaximized) {
        this.windowState = {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          isMaximized: false,
        };
      } else {
        this.windowState.isMaximized = true;
      }

      this.saveWindowState();
    }, 500);
  }

  /**
   * Create the main application window
   */
  createMainWindow(): BrowserWindow {
    // If window exists, return it
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      return this.mainWindow;
    }

    const { x, y, width, height, isMaximized } = this.windowState;

    this.mainWindow = new BrowserWindow({
      x,
      y,
      width,
      height,
      minWidth: this.options.minWidth,
      minHeight: this.options.minHeight,
      show: false, // Don't show until ready
      backgroundColor: "#1a1a2e", // Dark background to avoid white flash
      webPreferences: {
        preload: path.join(__dirname, "..", "preload", "index.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
      // Windows-specific options
      ...(process.platform === "win32" && {
        frame: true,
        titleBarStyle: "default",
      }),
      // macOS-specific options
      ...(process.platform === "darwin" && {
        titleBarStyle: "hiddenInset",
        trafficLightPosition: { x: 10, y: 10 },
      }),
    });

    // Show window when ready to avoid white flash
    this.mainWindow.once("ready-to-show", () => {
      if (this.mainWindow) {
        if (isMaximized) {
          this.mainWindow.maximize();
        }
        this.mainWindow.show();
      }
    });

    // Track window state changes
    this.mainWindow.on("resize", () => this.trackWindowState());
    this.mainWindow.on("move", () => this.trackWindowState());
    this.mainWindow.on("maximize", () => this.trackWindowState());
    this.mainWindow.on("unmaximize", () => this.trackWindowState());

    // Handle window close
    this.mainWindow.on("close", (event) => {
      // Prevent window from being destroyed, just hide it
      event.preventDefault();
      this.hideWindow();
    });

    // Clean up reference when destroyed
    this.mainWindow.on("closed", () => {
      this.mainWindow = null;
    });

    // Load the app
    this.loadContent();

    // Open DevTools in development
    if (this.options.devTools) {
      this.mainWindow.webContents.openDevTools({ mode: "detach" });
    }

    return this.mainWindow;
  }

  /**
   * Load content into the window
   */
  private loadContent(): void {
    if (!this.mainWindow) return;

    // In development, load from dev server
    if (process.env.VITE_DEV_SERVER_URL) {
      void this.mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
      // In production, load the bundled HTML
      const indexPath = path.join(__dirname, "..", "renderer", "index.html");
      void this.mainWindow.loadFile(indexPath);
    }
  }

  /**
   * Show the main window
   */
  showWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      this.createMainWindow();
    } else {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  /**
   * Hide the main window
   */
  hideWindow(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.hide();
    }
  }

  /**
   * Toggle window visibility
   */
  toggleWindow(): void {
    if (this.mainWindow?.isVisible()) {
      this.hideWindow();
    } else {
      this.showWindow();
    }
  }

  /**
   * Check if main window exists
   */
  hasWindow(): boolean {
    return this.mainWindow !== null && !this.mainWindow.isDestroyed();
  }

  /**
   * Get the main window instance
   */
  getWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  /**
   * Destroy the main window
   */
  destroyWindow(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      // Remove close handler to allow actual destroy
      this.mainWindow.removeAllListeners("close");
      this.mainWindow.destroy();
      this.mainWindow = null;
    }
  }
}
