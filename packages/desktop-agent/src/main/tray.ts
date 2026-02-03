/**
 * GoodTeams Desktop Agent - System Tray
 *
 * Handles:
 * - Tray icon with status indicator
 * - Context menu
 * - Notifications
 * - Status updates (connected/disconnected)
 */

import { Tray, Menu, nativeImage, app, Notification } from "electron";
import path from "node:path";

export type ConnectionStatus = "connected" | "disconnected" | "connecting";

export interface TrayManagerOptions {
  onShowWindow: () => void;
  onHideWindow: () => void;
  onQuit: () => void;
  onSettings?: () => void;
}

export class TrayManager {
  private tray: Tray | null = null;
  private options: TrayManagerOptions;
  private status: ConnectionStatus = "disconnected";
  private updateAvailable = false;
  private windowVisible = true;

  constructor(options: TrayManagerOptions) {
    this.options = options;
  }

  /**
   * Create the system tray
   */
  create(): Tray {
    if (this.tray) {
      return this.tray;
    }

    const icon = this.getIcon();
    this.tray = new Tray(icon);

    this.tray.setToolTip("GoodTeams Desktop Agent");
    this.updateMenu();

    // Handle tray click (toggle window)
    this.tray.on("click", () => {
      if (this.windowVisible) {
        this.options.onHideWindow();
        this.windowVisible = false;
      } else {
        this.options.onShowWindow();
        this.windowVisible = true;
      }
      this.updateMenu();
    });

    // Handle right-click on macOS (show menu)
    this.tray.on("right-click", () => {
      this.tray?.popUpContextMenu();
    });

    return this.tray;
  }

  /**
   * Get the appropriate tray icon based on status
   */
  private getIcon(): Electron.NativeImage {
    // Use template images for macOS menu bar
    const iconName =
      process.platform === "darwin"
        ? this.getTemplateIconName()
        : this.getColorIconName();

    const iconPath = path.join(__dirname, "..", "..", "assets", iconName);

    // Try to load icon, fallback to empty image
    try {
      const icon = nativeImage.createFromPath(iconPath);
      if (icon.isEmpty()) {
        return this.createFallbackIcon();
      }
      return icon;
    } catch {
      return this.createFallbackIcon();
    }
  }

  /**
   * Get template icon name for macOS
   */
  private getTemplateIconName(): string {
    if (this.updateAvailable) {
      return "tray-update-Template.png";
    }

    switch (this.status) {
      case "connected":
        return "tray-connected-Template.png";
      case "connecting":
        return "tray-connecting-Template.png";
      case "disconnected":
      default:
        return "tray-disconnected-Template.png";
    }
  }

  /**
   * Get color icon name for Windows/Linux
   */
  private getColorIconName(): string {
    if (this.updateAvailable) {
      return "tray-update.png";
    }

    switch (this.status) {
      case "connected":
        return "tray-connected.png";
      case "connecting":
        return "tray-connecting.png";
      case "disconnected":
      default:
        return "tray-disconnected.png";
    }
  }

  /**
   * Create a fallback icon if assets don't exist
   */
  private createFallbackIcon(): Electron.NativeImage {
    // Create a simple 16x16 colored icon
    const size = process.platform === "darwin" ? 16 : 32;
    const color =
      this.status === "connected"
        ? "#00ff00"
        : this.status === "connecting"
          ? "#ffff00"
          : "#ff0000";

    // Create a simple colored square
    const canvas = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 3}" fill="${color}"/>
      </svg>
    `;

    return nativeImage.createFromBuffer(Buffer.from(canvas));
  }

  /**
   * Update the context menu
   */
  private updateMenu(): void {
    if (!this.tray) return;

    const statusText = this.getStatusText();
    const toggleText = this.windowVisible ? "Hide Window" : "Show Window";

    const menuItems: Electron.MenuItemConstructorOptions[] = [
      {
        label: `GoodTeams Agent`,
        enabled: false,
      },
      {
        type: "separator",
      },
      {
        label: statusText,
        enabled: false,
      },
      {
        type: "separator",
      },
      {
        label: toggleText,
        click: () => {
          if (this.windowVisible) {
            this.options.onHideWindow();
            this.windowVisible = false;
          } else {
            this.options.onShowWindow();
            this.windowVisible = true;
          }
          this.updateMenu();
        },
      },
    ];

    // Add settings option if provided
    if (this.options.onSettings) {
      menuItems.push({
        label: "Settings...",
        click: () => this.options.onSettings?.(),
      });
    }

    // Add update option if available
    if (this.updateAvailable) {
      menuItems.push({
        type: "separator",
      });
      menuItems.push({
        label: "Update Available - Restart to Install",
        click: () => {
          app.relaunch();
          app.quit();
        },
      });
    }

    menuItems.push(
      {
        type: "separator",
      },
      {
        label: "Quit",
        click: () => this.options.onQuit(),
      }
    );

    const menu = Menu.buildFromTemplate(menuItems);
    this.tray.setContextMenu(menu);
  }

  /**
   * Get human-readable status text
   */
  private getStatusText(): string {
    switch (this.status) {
      case "connected":
        return "● Connected";
      case "connecting":
        return "◐ Connecting...";
      case "disconnected":
      default:
        return "○ Disconnected";
    }
  }

  /**
   * Update connection status
   */
  setStatus(status: ConnectionStatus): void {
    const wasConnected = this.status === "connected";
    this.status = status;

    // Update icon
    if (this.tray) {
      this.tray.setImage(this.getIcon());
      this.tray.setToolTip(`GoodTeams Agent - ${this.getStatusText()}`);
    }

    // Update menu
    this.updateMenu();

    // Show notification on connect/disconnect
    if (status === "connected" && !wasConnected) {
      this.showNotification("Connected", "GoodTeams Agent is now connected");
    } else if (status === "disconnected" && wasConnected) {
      this.showNotification(
        "Disconnected",
        "GoodTeams Agent lost connection"
      );
    }
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Set update available flag
   */
  setUpdateAvailable(available: boolean): void {
    this.updateAvailable = available;

    // Update icon and menu
    if (this.tray) {
      this.tray.setImage(this.getIcon());
    }
    this.updateMenu();

    // Show notification
    if (available) {
      this.showNotification(
        "Update Available",
        "A new version of GoodTeams Agent is available"
      );
    }
  }

  /**
   * Show a notification
   */
  showNotification(title: string, body: string): void {
    if (Notification.isSupported()) {
      new Notification({
        title,
        body,
        icon: this.getIcon(),
      }).show();
    }
  }

  /**
   * Update window visibility state
   */
  setWindowVisible(visible: boolean): void {
    this.windowVisible = visible;
    this.updateMenu();
  }

  /**
   * Destroy the tray
   */
  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  /**
   * Get the tray instance
   */
  getTray(): Tray | null {
    return this.tray;
  }
}
