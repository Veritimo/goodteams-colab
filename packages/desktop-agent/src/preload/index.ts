/**
 * GoodTeams Desktop Agent - Preload Script
 *
 * Exposes safe APIs to the renderer process via contextBridge.
 * This is the only bridge between Node.js and the browser context.
 */

import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../main/ipc-handlers.js";

/**
 * Type definitions for the exposed API
 */
export interface GoodTeamsAPI {
  /** App information and lifecycle */
  app: {
    /** Get app version and platform info */
    getVersion: () => Promise<{
      version: string;
      name: string;
      platform: string;
      arch: string;
    }>;
    /** Get current app state */
    getState: () => Promise<{
      initialized: boolean;
      gatewayConnected: boolean;
      nodeId: string | null;
    }>;
    /** Quit the application */
    quit: () => Promise<void>;
  };

  /** Window controls */
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<boolean>;
    close: () => Promise<void>;
  };

  /** Screen capture */
  screen: {
    /** Get available screen sources for capture */
    getSources: (options?: {
      types?: ("window" | "screen")[];
      thumbnailSize?: { width: number; height: number };
    }) => Promise<
      Array<{
        id: string;
        name: string;
        displayId: string;
        thumbnail: string;
        appIcon?: string;
      }>
    >;
    /** Capture a specific source */
    capture: (options: {
      sourceId: string;
      width?: number;
      height?: number;
    }) => Promise<{
      id: string;
      name: string;
      thumbnail: string;
    }>;
    /** Get display information */
    getDisplays: () => Promise<{
      primary: {
        id: number;
        bounds: { x: number; y: number; width: number; height: number };
        workArea: { x: number; y: number; width: number; height: number };
        scaleFactor: number;
      };
      displays: Array<{
        id: number;
        bounds: { x: number; y: number; width: number; height: number };
        workArea: { x: number; y: number; width: number; height: number };
        scaleFactor: number;
        isPrimary: boolean;
      }>;
    }>;
  };

  /** Automation (stubs for future) */
  automation: {
    click: (params: {
      x: number;
      y: number;
      button?: "left" | "right" | "middle";
    }) => Promise<{ success: boolean; error?: string }>;
    type: (params: {
      text: string;
      delay?: number;
    }) => Promise<{ success: boolean; error?: string }>;
    getWindows: () => Promise<{
      success: boolean;
      error?: string;
      windows: Array<{ id: string; title: string; bounds: { x: number; y: number; width: number; height: number } }>;
    }>;
    getElements: (params: {
      windowId?: string;
      selector?: string;
    }) => Promise<{
      success: boolean;
      error?: string;
      elements: Array<{ id: string; type: string; name: string; bounds: { x: number; y: number; width: number; height: number } }>;
    }>;
  };

  /** Event listeners */
  on: {
    /** Listen for gateway status changes */
    gatewayStatusChanged: (
      callback: (status: "connected" | "disconnected" | "connecting") => void
    ) => () => void;
    /** Listen for gateway messages */
    gatewayMessage: (callback: (message: unknown) => void) => () => void;
    /** Listen for update available */
    updateAvailable: (
      callback: (info: { version: string; releaseDate?: string; releaseNotes?: string }) => void
    ) => () => void;
    /** Listen for update downloaded */
    updateDownloaded: (
      callback: (info: { version: string; releaseDate?: string; releaseNotes?: string }) => void
    ) => () => void;
  };
}

/**
 * Create an event listener that returns an unsubscribe function
 */
function createEventListener<T>(channel: string) {
  return (callback: (data: T) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: T) => {
      callback(data);
    };
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  };
}

/**
 * The API exposed to the renderer process
 */
const goodteamsAPI: GoodTeamsAPI = {
  app: {
    getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_STATE),
    quit: () => ipcRenderer.invoke(IPC_CHANNELS.APP_QUIT),
  },

  window: {
    minimize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
    maximize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
    close: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
  },

  screen: {
    getSources: (options) =>
      ipcRenderer.invoke(IPC_CHANNELS.SCREEN_GET_SOURCES, options),
    capture: (options) =>
      ipcRenderer.invoke(IPC_CHANNELS.SCREEN_CAPTURE, options),
    getDisplays: () => ipcRenderer.invoke(IPC_CHANNELS.SCREEN_GET_DISPLAYS),
  },

  automation: {
    click: (params) =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTOMATION_CLICK, params),
    type: (params) =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTOMATION_TYPE, params),
    getWindows: () => ipcRenderer.invoke(IPC_CHANNELS.AUTOMATION_GET_WINDOWS),
    getElements: (params) =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTOMATION_GET_ELEMENTS, params),
  },

  on: {
    gatewayStatusChanged: createEventListener(
      IPC_CHANNELS.GATEWAY_STATUS_CHANGED
    ),
    gatewayMessage: createEventListener(IPC_CHANNELS.GATEWAY_MESSAGE),
    updateAvailable: createEventListener(IPC_CHANNELS.UPDATE_AVAILABLE),
    updateDownloaded: createEventListener(IPC_CHANNELS.UPDATE_DOWNLOADED),
  },
};

// Expose the API to the renderer
contextBridge.exposeInMainWorld("goodteams", goodteamsAPI);

// Type declaration for global window object
declare global {
  interface Window {
    goodteams: GoodTeamsAPI;
  }
}
