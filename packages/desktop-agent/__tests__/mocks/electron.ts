/**
 * Mock Electron APIs for testing
 *
 * Since tests run in Node.js (not Electron), we need to mock all Electron modules.
 */

import { vi } from "vitest";
import { EventEmitter } from "node:events";

// Mock BrowserWindow
export class MockBrowserWindow extends EventEmitter {
  private _isVisible = true;
  private _isMinimized = false;
  private _isMaximized = false;
  private _isDestroyed = false;
  private _bounds = { x: 0, y: 0, width: 800, height: 600 };

  webContents = {
    send: vi.fn(),
    openDevTools: vi.fn(),
    on: vi.fn(),
  };

  constructor(_options?: unknown) {
    super();
  }

  loadFile = vi.fn().mockResolvedValue(undefined);
  loadURL = vi.fn().mockResolvedValue(undefined);
  show = vi.fn(() => {
    this._isVisible = true;
  });
  hide = vi.fn(() => {
    this._isVisible = false;
  });
  close = vi.fn();
  destroy = vi.fn(() => {
    this._isDestroyed = true;
  });
  focus = vi.fn();
  minimize = vi.fn(() => {
    this._isMinimized = true;
  });
  restore = vi.fn(() => {
    this._isMinimized = false;
  });
  maximize = vi.fn(() => {
    this._isMaximized = true;
  });
  unmaximize = vi.fn(() => {
    this._isMaximized = false;
  });
  isVisible = vi.fn(() => this._isVisible);
  isMinimized = vi.fn(() => this._isMinimized);
  isMaximized = vi.fn(() => this._isMaximized);
  isDestroyed = vi.fn(() => this._isDestroyed);
  getBounds = vi.fn(() => this._bounds);
  setBounds = vi.fn((bounds: typeof this._bounds) => {
    this._bounds = bounds;
  });
}

// Mock Tray
export class MockTray extends EventEmitter {
  private _toolTip = "";
  private _image: unknown = null;
  private _contextMenu: unknown = null;
  private _isDestroyed = false;

  constructor(_icon?: unknown) {
    super();
    this._image = _icon;
  }

  setToolTip = vi.fn((tip: string) => {
    this._toolTip = tip;
  });
  getToolTip = vi.fn(() => this._toolTip);
  setImage = vi.fn((image: unknown) => {
    this._image = image;
  });
  setContextMenu = vi.fn((menu: unknown) => {
    this._contextMenu = menu;
  });
  popUpContextMenu = vi.fn();
  destroy = vi.fn(() => {
    this._isDestroyed = true;
  });
  isDestroyed = vi.fn(() => this._isDestroyed);
}

// Mock Menu
export class MockMenu {
  items: unknown[] = [];

  static buildFromTemplate = vi.fn((template: unknown[]) => {
    const menu = new MockMenu();
    menu.items = template;
    return menu;
  });
}

// Mock nativeImage
export const mockNativeImage = {
  createFromPath: vi.fn(() => ({
    isEmpty: vi.fn(() => false),
    toDataURL: vi.fn(() => "data:image/png;base64,..."),
  })),
  createFromBuffer: vi.fn(() => ({
    isEmpty: vi.fn(() => false),
    toDataURL: vi.fn(() => "data:image/png;base64,..."),
  })),
};

// Mock screen
export const mockScreen = {
  getAllDisplays: vi.fn(() => [
    {
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      scaleFactor: 1,
    },
  ]),
  getPrimaryDisplay: vi.fn(() => ({
    id: 1,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    scaleFactor: 1,
  })),
};

// Mock desktopCapturer
export const mockDesktopCapturer = {
  getSources: vi.fn().mockResolvedValue([
    {
      id: "screen:1:0",
      name: "Screen 1",
      display_id: "1",
      thumbnail: { toDataURL: () => "data:image/png;base64,..." },
      appIcon: null,
    },
    {
      id: "window:123",
      name: "Test Window",
      display_id: "",
      thumbnail: { toDataURL: () => "data:image/png;base64,..." },
      appIcon: { toDataURL: () => "data:image/png;base64,..." },
    },
  ]),
};

// Mock Notification
export class MockNotification {
  static isSupported = vi.fn(() => true);
  show = vi.fn();
  constructor(_options?: unknown) {}
}

// Mock ipcMain
export const mockIpcMain = {
  handle: vi.fn(),
  removeHandler: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
};

// Mock ipcRenderer
export const mockIpcRenderer = {
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  send: vi.fn(),
};

// Mock contextBridge
export const mockContextBridge = {
  exposeInMainWorld: vi.fn(),
};

// Mock app
export const mockApp = {
  getVersion: vi.fn(() => "0.1.0"),
  getName: vi.fn(() => "GoodTeams Desktop Agent"),
  getPath: vi.fn((name: string) => `/mock/path/${name}`),
  isPackaged: false,
  quit: vi.fn(),
  relaunch: vi.fn(),
  requestSingleInstanceLock: vi.fn(() => true),
  setAsDefaultProtocolClient: vi.fn(),
  whenReady: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
};

// Create the mock electron module
export const mockElectron = {
  app: mockApp,
  BrowserWindow: MockBrowserWindow,
  Tray: MockTray,
  Menu: MockMenu,
  nativeImage: mockNativeImage,
  screen: mockScreen,
  desktopCapturer: mockDesktopCapturer,
  Notification: MockNotification,
  ipcMain: mockIpcMain,
  ipcRenderer: mockIpcRenderer,
  contextBridge: mockContextBridge,
};

export function resetAllMocks(): void {
  vi.clearAllMocks();
  mockApp.requestSingleInstanceLock.mockReturnValue(true);
  mockApp.isPackaged = false;
}
