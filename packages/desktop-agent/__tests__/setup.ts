/**
 * Test setup file
 *
 * Configures mocks and global setup for all tests
 */

import { vi, beforeEach, afterEach } from "vitest";
import { mockElectron, resetAllMocks } from "./mocks/electron.js";
import { MockWebSocket } from "./mocks/websocket.js";

// Mock the electron module
vi.mock("electron", () => mockElectron);

// Mock electron-updater
vi.mock("electron-updater", () => ({
  autoUpdater: {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    setFeedURL: vi.fn(),
    checkForUpdates: vi.fn().mockResolvedValue(null),
    downloadUpdate: vi.fn().mockResolvedValue(undefined),
    quitAndInstall: vi.fn(),
    on: vi.fn(),
  },
}));

// Mock fs for window state persistence
vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => "{}"),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => "{}"),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

// Make WebSocket available globally (Node.js doesn't have it by default)
(global as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket;

// Reset mocks before each test
beforeEach(() => {
  resetAllMocks();
});

// Clean up after each test
afterEach(() => {
  vi.clearAllTimers();
});
