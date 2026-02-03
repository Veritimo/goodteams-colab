/**
 * Stream Module Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  StreamManager,
  createStreamManager,
  getStreamManager,
  resetStreamManager,
} from '../../src/visual/stream.js';
import {
  initializeCapture,
  resetCapture,
  ElectronDesktopCapturer,
  ElectronScreen,
} from '../../src/visual/capture.js';
import { VisualError, StreamFrame } from '../../src/visual/types.js';

// ============================================================================
// Mock Setup
// ============================================================================

function createMockThumbnail(width = 1920, height = 1080) {
  return {
    toJPEG: vi.fn((quality: number) => Buffer.from(`jpeg-frame-${quality}`)),
    toPNG: vi.fn(() => Buffer.from('png-frame')),
    getSize: vi.fn(() => ({ width, height })),
  };
}

function createMockCapturer(): ElectronDesktopCapturer {
  return {
    getSources: vi.fn(async () => [
      {
        id: 'screen:0:0',
        name: 'Entire Screen',
        thumbnail: createMockThumbnail(),
        display_id: '12345',
      },
    ]),
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
    ]),
    getDisplayMatching: vi.fn(() => ({
      id: 12345,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      scaleFactor: 1,
    })),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('StreamManager', () => {
  let manager: StreamManager;
  let mockCapturer: ElectronDesktopCapturer;
  let mockScreen: ElectronScreen;

  beforeEach(() => {
    vi.useFakeTimers();
    mockCapturer = createMockCapturer();
    mockScreen = createMockScreen();
    initializeCapture(mockCapturer, mockScreen);
    manager = createStreamManager();
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (manager.active) {
      await manager.stopStream();
    }
    resetCapture();
    resetStreamManager();
  });

  describe('Stream Lifecycle', () => {
    it('should start streaming', async () => {
      await manager.startStream({ fps: 10 });

      expect(manager.active).toBe(true);
      expect(manager.paused).toBe(false);
    });

    it('should stop streaming', async () => {
      await manager.startStream({ fps: 10 });
      await manager.stopStream();

      expect(manager.active).toBe(false);
    });

    it('should throw when starting already active stream', async () => {
      await manager.startStream({ fps: 10 });

      await expect(manager.startStream()).rejects.toThrow(VisualError);
      await expect(manager.startStream()).rejects.toHaveProperty(
        'code',
        'STREAM_ALREADY_ACTIVE'
      );
    });

    it('should throw when stopping inactive stream', async () => {
      await expect(manager.stopStream()).rejects.toThrow(VisualError);
      await expect(manager.stopStream()).rejects.toHaveProperty(
        'code',
        'STREAM_NOT_ACTIVE'
      );
    });

    it('should throw when capture not initialized', async () => {
      resetCapture();
      const newManager = createStreamManager();

      await expect(newManager.startStream()).rejects.toThrow(VisualError);
      await expect(newManager.startStream()).rejects.toHaveProperty(
        'code',
        'ELECTRON_NOT_AVAILABLE'
      );
    });
  });

  describe('Pause/Resume', () => {
    it('should pause stream', async () => {
      await manager.startStream({ fps: 10 });
      manager.pauseStream();

      expect(manager.active).toBe(true);
      expect(manager.paused).toBe(true);
    });

    it('should resume stream', async () => {
      await manager.startStream({ fps: 10 });
      manager.pauseStream();
      manager.resumeStream();

      expect(manager.active).toBe(true);
      expect(manager.paused).toBe(false);
    });

    it('should throw when pausing inactive stream', () => {
      expect(() => manager.pauseStream()).toThrow(VisualError);
    });

    it('should throw when resuming inactive stream', () => {
      expect(() => manager.resumeStream()).toThrow(VisualError);
    });
  });

  describe('Stream Status', () => {
    it('should return initial status', () => {
      const status = manager.getStreamStatus();

      expect(status.isStreaming).toBe(false);
      expect(status.currentFps).toBe(0);
      expect(status.frameCount).toBe(0);
      expect(status.durationMs).toBe(0);
      expect(status.bandwidthBps).toBe(0);
    });

    it('should return streaming status', async () => {
      await manager.startStream({ fps: 15 });
      const status = manager.getStreamStatus();

      expect(status.isStreaming).toBe(true);
      expect(status.targetFps).toBe(15);
    });

    it('should track stream duration', async () => {
      await manager.startStream({ fps: 10 });

      vi.advanceTimersByTime(1000);
      const status = manager.getStreamStatus();

      expect(status.durationMs).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('Frame Callbacks', () => {
    it('should call frame callback on each frame', async () => {
      const callback = vi.fn();
      manager.onFrame(callback);

      await manager.startStream({ fps: 10 });

      // Advance time to trigger frame capture
      vi.advanceTimersByTime(100); // One frame at 10fps

      // Wait for async frame capture
      await vi.runAllTimersAsync();

      expect(callback).toHaveBeenCalled();
    });

    it('should pass frame data to callback', async () => {
      let receivedFrame: StreamFrame | null = null;
      manager.onFrame((frame) => {
        receivedFrame = frame;
      });

      await manager.startStream({ fps: 10 });
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      expect(receivedFrame).not.toBeNull();
      expect(receivedFrame!.data).toBeInstanceOf(Buffer);
      expect(receivedFrame!.width).toBe(1920);
      expect(receivedFrame!.height).toBe(1080);
      expect(receivedFrame!.sequence).toBeGreaterThanOrEqual(0);
    });

    it('should unsubscribe from frame callback', async () => {
      const callback = vi.fn();
      const unsubscribe = manager.onFrame(callback);

      await manager.startStream({ fps: 10 });

      // Unsubscribe immediately
      unsubscribe();

      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should support multiple callbacks', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      manager.onFrame(callback1);
      manager.onFrame(callback2);

      await manager.startStream({ fps: 10 });
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', async () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = vi.fn();

      manager.onFrame(errorCallback);
      manager.onFrame(normalCallback);

      await manager.startStream({ fps: 10 });
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // Both callbacks should have been called despite error
      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
    });

    it('should use offFrame to remove callback', async () => {
      const callback = vi.fn();

      manager.onFrame(callback);
      manager.offFrame(callback);

      await manager.startStream({ fps: 10 });
      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Options Validation', () => {
    it('should validate FPS range', async () => {
      await expect(manager.startStream({ fps: 0 })).rejects.toThrow(VisualError);
      await expect(manager.startStream({ fps: 100 })).rejects.toThrow(VisualError);
    });

    it('should validate maxWidth range', async () => {
      await expect(manager.startStream({ maxWidth: 100 })).rejects.toThrow(VisualError);
      await expect(manager.startStream({ maxWidth: 10000 })).rejects.toThrow(VisualError);
    });

    it('should validate quality range', async () => {
      await expect(manager.startStream({ quality: 0 })).rejects.toThrow(VisualError);
      await expect(manager.startStream({ quality: 150 })).rejects.toThrow(VisualError);
    });

    it('should accept valid options', async () => {
      await expect(
        manager.startStream({ fps: 30, maxWidth: 1280, quality: 80 })
      ).resolves.not.toThrow();
    });
  });

  describe('Singleton and Factory', () => {
    it('should create new instance with factory', () => {
      const manager1 = createStreamManager();
      const manager2 = createStreamManager();

      expect(manager1).not.toBe(manager2);
    });

    it('should return same instance from singleton', () => {
      const singleton1 = getStreamManager();
      const singleton2 = getStreamManager();

      expect(singleton1).toBe(singleton2);
    });

    it('should reset singleton', () => {
      const singleton1 = getStreamManager();
      resetStreamManager();
      const singleton2 = getStreamManager();

      expect(singleton1).not.toBe(singleton2);
    });
  });
});
