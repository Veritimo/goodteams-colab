/**
 * GoodTeams Desktop Agent - Auto-Updater
 *
 * Handles:
 * - Checking for updates
 * - Downloading updates
 * - Installing updates
 * - Notifying user
 */

import { app } from "electron";

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
}

export interface DownloadProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export interface AutoUpdaterOptions {
  /** Called when an update is available */
  onUpdateAvailable?: (info: UpdateInfo) => void;
  /** Called when update is downloaded and ready to install */
  onUpdateDownloaded?: (info: UpdateInfo) => void;
  /** Called during download with progress */
  onDownloadProgress?: (progress: DownloadProgress) => void;
  /** Called on error */
  onError?: (error: Error) => void;
  /** Called when no update is available */
  onUpdateNotAvailable?: () => void;
  /** Whether to auto-download updates (default: true) */
  autoDownload?: boolean;
  /** Whether to auto-install on quit (default: true) */
  autoInstallOnQuit?: boolean;
  /** Update feed URL (optional, uses default if not provided) */
  feedUrl?: string;
}

export class AutoUpdater {
  private options: AutoUpdaterOptions;
  private updateAvailable = false;
  private updateDownloaded = false;
  private updateInfo: UpdateInfo | null = null;
  private checking = false;

  constructor(options: AutoUpdaterOptions = {}) {
    this.options = {
      autoDownload: true,
      autoInstallOnQuit: true,
      ...options,
    };

    this.setupAutoUpdater();
  }

  /**
   * Setup the auto-updater
   * Note: In development, auto-updater is disabled
   */
  private setupAutoUpdater(): void {
    // Skip in development
    if (!app.isPackaged) {
      console.log("Auto-updater disabled in development");
      return;
    }

    try {
      // Dynamically import electron-updater to avoid errors in dev
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { autoUpdater } = require("electron-updater");

      // Configure auto-updater
      autoUpdater.autoDownload = this.options.autoDownload ?? true;
      autoUpdater.autoInstallOnAppQuit =
        this.options.autoInstallOnQuit ?? true;

      // Set feed URL if provided
      if (this.options.feedUrl) {
        autoUpdater.setFeedURL(this.options.feedUrl);
      }

      // Event handlers
      autoUpdater.on("checking-for-update", () => {
        this.checking = true;
      });

      autoUpdater.on("update-available", (info: UpdateInfo) => {
        this.checking = false;
        this.updateAvailable = true;
        this.updateInfo = info;
        this.options.onUpdateAvailable?.(info);
      });

      autoUpdater.on("update-not-available", () => {
        this.checking = false;
        this.updateAvailable = false;
        this.options.onUpdateNotAvailable?.();
      });

      autoUpdater.on("download-progress", (progress: DownloadProgress) => {
        this.options.onDownloadProgress?.(progress);
      });

      autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
        this.updateDownloaded = true;
        this.updateInfo = info;
        this.options.onUpdateDownloaded?.(info);
      });

      autoUpdater.on("error", (error: Error) => {
        this.checking = false;
        this.options.onError?.(error);
      });
    } catch (error) {
      console.log("Auto-updater not available:", error);
    }
  }

  /**
   * Check for updates
   */
  async checkForUpdates(): Promise<UpdateInfo | null> {
    // Skip in development
    if (!app.isPackaged) {
      return null;
    }

    if (this.checking) {
      return this.updateInfo;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { autoUpdater } = require("electron-updater");
      const result = await autoUpdater.checkForUpdates();
      return result?.updateInfo ?? null;
    } catch (error) {
      console.error("Failed to check for updates:", error);
      this.options.onError?.(
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  /**
   * Download update (if auto-download is disabled)
   */
  async downloadUpdate(): Promise<void> {
    if (!app.isPackaged || !this.updateAvailable) {
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { autoUpdater } = require("electron-updater");
      await autoUpdater.downloadUpdate();
    } catch (error) {
      console.error("Failed to download update:", error);
      this.options.onError?.(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Install update and restart
   */
  quitAndInstall(): void {
    if (!app.isPackaged || !this.updateDownloaded) {
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { autoUpdater } = require("electron-updater");
      autoUpdater.quitAndInstall();
    } catch (error) {
      console.error("Failed to install update:", error);
      this.options.onError?.(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get current update status
   */
  getStatus(): {
    updateAvailable: boolean;
    updateDownloaded: boolean;
    updateInfo: UpdateInfo | null;
    checking: boolean;
  } {
    return {
      updateAvailable: this.updateAvailable,
      updateDownloaded: this.updateDownloaded,
      updateInfo: this.updateInfo,
      checking: this.checking,
    };
  }

  /**
   * Check if update is available
   */
  isUpdateAvailable(): boolean {
    return this.updateAvailable;
  }

  /**
   * Check if update is downloaded and ready to install
   */
  isUpdateDownloaded(): boolean {
    return this.updateDownloaded;
  }
}
