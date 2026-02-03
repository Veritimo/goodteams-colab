/**
 * Capture Module Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initializeCapture,
  resetCapture,
  isCaptureInitialized,
  listDisplays,
  getDisplayBounds,
  getPrimaryDisplayId,
  captureScreen,
  captureWindow,
  captureRegion,
  captureToBuffer,
  captureToFile,
  listWindows,
  findWindowByName,
  ElectronDesktopCapturer,
  ElectronScreen,
} from '../../src/visual/capture.js';
import { VisualError } from '../../src/visual/types.js';

// ============================================================================
// Mock Electron APIs
// ============================================================================

function createMockThumbnail(width = 1920, height = 1080) {
  return {
    toJPEG: vi.fn((quality: number) => Buffer.from(`jpeg-${quality}`)),
    toPNG: vi.fn(() => Buffer.from('png-data')),
    getSize: vi.fn(() => ({ width, height })),
  };
}

function createMockDesktopCapturer(): ElectronDesktopCapturer {
  return {
    getSources: vi.fn(async (options) => {
      if (options.types.includes('screen')) {
        return [
          {
            id: 'screen:0:0',
            name: 'Entire Screen',
            thumbnail: createMockThumbnail(),
            display_id: '12345',
          },
          {
            id: 'screen:1:0',
            name: 'Screen 2',
            thumbnail: createMockThumbnail(2560, 1440),
            display_id: '67890',
          },
        ];
      }
      if (options.types.includes('window')) {
        return [
          {
            id: 'window:1001:0',
            name: 'Visual Studio Code',
            thumbnail: createMockThumbnail(1400, 900),
            display_id: '12345',
            appIcon: { toJPEG: vi.fn(), toPNG: vi.fn() },
          },
          {
            id: 'window:1002:0',
            name: 'Chrome',
            thumbnail: createMockThumbnail(1600, 1000),
            display_id: '12345',
          },
        ];
      }
      return [];
    }),
  };
}

function createMockScreen(): ElectronScreen {
  return {
    getPrimaryDisplay: vi.fn(() => ({
      id: 12345,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      scaleFactor: 1,
      rotation: 0,
    })),
    getAllDisplays: vi.fn(() => [
      {
        id: 12345,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        scaleFactor: 1,
        rotation: 0,
        label: 'Main Display',
      },
      {
        id: 67890,
        bounds: { x: 1920, y: 0, width: 2560, height: 1440 },
        scaleFactor: 1.5,
        rotation: 0,
        label: 'External Display',
      },
    ]),
    getDisplayMatching: vi.fn((rect) => {
      if (rect.x >= 1920) {
        return {
          id: 67890,
          bounds: { x: 1920, y: 0, width: 2560, height: 1440 },
          scaleFactor: 1.5,
        };
      }
      return {
        id: 12345,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        scaleFactor: 1,
      };
    }),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Capture Module', () => {
  let mockCapturer: ElectronDesktopCapturer;
  let mockScreen: ElectronScreen;

  beforeEach(() => {
    mockCapturer = createMockDesktopCapturer();
    mockScreen = createMockScreen();
    resetCapture();
  });

  afterEach(() => {
    resetCapture();
  });

  describe('Initialization', () => {
    it('should not be initialized by default', () => {
      expect(isCaptureInitialized()).toBe(false);
    });

    it('should initialize with Electron APIs', () => {
      initializeCapture(mockCapturer, mockScreen);
      expect(isCaptureInitialized()).toBe(true);
    });

    it('should reset initialization', () => {
      initializeCapture(mockCapturer, mockScreen);
      expect(isCaptureInitialized()).toBe(true);
      resetCapture();
      expect(isCaptureInitialized()).toBe(false);
    });
  });

  describe('Display Information', () => {
    beforeEach(() => {
      initializeCapture(mockCapturer, mockScreen);
    });

    it('should list all displays', async () => {
      const displays = await listDisplays();

      expect(displays).toHaveLength(2);
      expect(displays[0]).toEqual({
        id: '12345',
        name: 'Main Display',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        isPrimary: true,
        scaleFactor: 1,
      });
      expect(displays[1].isPrimary).toBe(false);
    });

    it('should get display bounds for primary display', async () => {
      const bounds = await getDisplayBounds();

      expect(bounds).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
    });

    it('should get display bounds for specific display', async () => {
      const bounds = await getDisplayBounds('67890');

      expect(bounds).toEqual({ x: 1920, y: 0, width: 2560, height: 1440 });
    });

    it('should throw for non-existent display', async () => {
      await expect(getDisplayBounds('99999')).rejects.toThrow(VisualError);
      await expect(getDisplayBounds('99999')).rejects.toHaveProperty(
        'code',
        'DISPLAY_NOT_FOUND'
      );
    });

    it('should get primary display ID', async () => {
      const id = await getPrimaryDisplayId();
      expect(id).toBe('12345');
    });

    it('should throw when not initialized', async () => {
      resetCapture();
      await expect(listDisplays()).rejects.toThrow(VisualError);
      await expect(listDisplays()).rejects.toHaveProperty(
        'code',
        'ELECTRON_NOT_AVAILABLE'
      );
    });
  });

  describe('Screen Capture', () => {
    beforeEach(() => {
      initializeCapture(mockCapturer, mockScreen);
    });

    it('should capture primary screen as PNG', async () => {
      const result = await captureScreen();

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.format).toBe('png');
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('should capture specific display', async () => {
      const result = await captureScreen('67890');

      expect(mockCapturer.getSources).toHaveBeenCalledWith(
        expect.objectContaining({
          types: ['screen'],
        })
      );
    });

    it('should capture as JPEG with quality', async () => {
      const result = await captureToBuffer({
        type: 'screen',
        format: 'jpeg',
        quality: 85,
      });

      expect(result.format).toBe('jpeg');
      expect(result.buffer.toString()).toContain('jpeg-85');
    });
  });

  describe('Window Capture', () => {
    beforeEach(() => {
      initializeCapture(mockCapturer, mockScreen);
    });

    it('should capture window by handle', async () => {
      const result = await captureWindow(1001);

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.width).toBe(1400);
      expect(result.height).toBe(900);
    });

    it('should throw for non-existent window', async () => {
      await expect(captureWindow(9999)).rejects.toThrow(VisualError);
      await expect(captureWindow(9999)).rejects.toHaveProperty(
        'code',
        'WINDOW_NOT_FOUND'
      );
    });
  });

  describe('Region Capture', () => {
    beforeEach(() => {
      initializeCapture(mockCapturer, mockScreen);
    });

    it('should capture a region', async () => {
      const result = await captureRegion({
        x: 100,
        y: 100,
        width: 400,
        height: 300,
      });

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.width).toBe(400);
      expect(result.height).toBe(300);
    });

    it('should throw for invalid region', async () => {
      await expect(
        captureRegion({ x: 0, y: 0, width: -100, height: 100 })
      ).rejects.toThrow(VisualError);
    });
  });

  describe('captureToBuffer', () => {
    beforeEach(() => {
      initializeCapture(mockCapturer, mockScreen);
    });

    it('should require capture type', async () => {
      await expect(
        captureToBuffer({ type: '' as any })
      ).rejects.toThrow(VisualError);
    });

    it('should validate format', async () => {
      await expect(
        captureToBuffer({ type: 'screen', format: 'gif' as any })
      ).rejects.toThrow(VisualError);
    });

    it('should validate quality range', async () => {
      await expect(
        captureToBuffer({ type: 'screen', quality: 150 })
      ).rejects.toThrow(VisualError);

      await expect(
        captureToBuffer({ type: 'screen', quality: -10 })
      ).rejects.toThrow(VisualError);
    });

    it('should require windowHandle for window capture', async () => {
      await expect(
        captureToBuffer({ type: 'window' })
      ).rejects.toThrow(VisualError);
    });

    it('should require region for region capture', async () => {
      await expect(
        captureToBuffer({ type: 'region' })
      ).rejects.toThrow(VisualError);
    });
  });

  describe('captureToFile', () => {
    beforeEach(() => {
      initializeCapture(mockCapturer, mockScreen);
    });

    it('should capture and add file path', async () => {
      const result = await captureToFile(
        { type: 'screen' },
        '/path/to/screenshot.png'
      ) as any;

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.filePath).toBe('/path/to/screenshot.png');
    });
  });

  describe('Window Listing', () => {
    beforeEach(() => {
      initializeCapture(mockCapturer, mockScreen);
    });

    it('should list all windows', async () => {
      const windows = await listWindows();

      expect(windows).toHaveLength(2);
      expect(windows[0]).toMatchObject({
        id: 'window:1001:0',
        name: 'Visual Studio Code',
        handle: 1001,
        hasIcon: true,
      });
      expect(windows[1]).toMatchObject({
        name: 'Chrome',
        hasIcon: false,
      });
    });

    it('should find window by name', async () => {
      const window = await findWindowByName('Visual Studio');

      expect(window).not.toBeNull();
      expect(window?.name).toBe('Visual Studio Code');
      expect(window?.handle).toBe(1001);
    });

    it('should return null for non-existent window name', async () => {
      const window = await findWindowByName('Nonexistent App');
      expect(window).toBeNull();
    });

    it('should be case-insensitive', async () => {
      const window = await findWindowByName('CHROME');
      expect(window).not.toBeNull();
      expect(window?.name).toBe('Chrome');
    });
  });
});
