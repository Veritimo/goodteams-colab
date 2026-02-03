/**
 * Recording Module Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SessionRecorder,
  createSessionRecorder,
  getSessionRecorder,
  resetSessionRecorder,
  VideoEncoder,
  EncoderFactory,
} from '../../src/visual/recording.js';
import {
  initializeCapture,
  resetCapture,
  ElectronDesktopCapturer,
  ElectronScreen,
} from '../../src/visual/capture.js';
import { VisualError, RecordingMetadata } from '../../src/visual/types.js';

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

function createMockEncoder(): VideoEncoder {
  let frameCount = 0;
  let isPaused = false;
  let startTime = 0;

  return {
    initialize: vi.fn(async () => {
      startTime = Date.now();
    }),
    addFrame: vi.fn(async () => {
      if (!isPaused) {
        frameCount++;
      }
    }),
    pause: vi.fn(() => {
      isPaused = true;
    }),
    resume: vi.fn(() => {
      isPaused = false;
    }),
    finalize: vi.fn(async (): Promise<RecordingMetadata> => ({
      startTime,
      endTime: Date.now(),
      durationMs: Date.now() - startTime,
      frameCount,
      format: 'mp4',
      width: 1920,
      height: 1080,
      fps: 15,
      sizeBytes: frameCount * 10000,
      options: {
        outputPath: '/tmp/recording',
        format: 'mp4',
        fps: 15,
        maxWidth: 1920,
        quality: 70,
        includeAudio: false,
        includeOverlay: true,
        maxDuration: 0,
      },
    })),
    getEstimatedSize: vi.fn(() => frameCount * 10000),
    isReady: vi.fn(() => true),
  };
}

function createMockEncoderFactory(): EncoderFactory {
  return {
    createEncoder: vi.fn(() => createMockEncoder()),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('SessionRecorder', () => {
  let recorder: SessionRecorder;
  let mockCapturer: ElectronDesktopCapturer;
  let mockScreen: ElectronScreen;
  let mockEncoderFactory: EncoderFactory;

  beforeEach(() => {
    vi.useFakeTimers();
    mockCapturer = createMockCapturer();
    mockScreen = createMockScreen();
    mockEncoderFactory = createMockEncoderFactory();
    initializeCapture(mockCapturer, mockScreen);
    recorder = createSessionRecorder(mockEncoderFactory);
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (recorder.active) {
      await recorder.stopRecording().catch(() => {});
    }
    resetCapture();
    await resetSessionRecorder();
  });

  describe('Recording Lifecycle', () => {
    it('should start recording', async () => {
      await recorder.startRecording({ outputPath: '/tmp/test' });

      expect(recorder.active).toBe(true);
      expect(recorder.paused).toBe(false);
    });

    it('should stop recording and return metadata', async () => {
      await recorder.startRecording({ outputPath: '/tmp/test' });

      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      const metadata = await recorder.stopRecording();

      expect(recorder.active).toBe(false);
      expect(metadata).toBeDefined();
      expect(metadata.format).toBe('mp4');
    });

    it('should throw when starting already active recording', async () => {
      await recorder.startRecording({ outputPath: '/tmp/test1' });

      await expect(
        recorder.startRecording({ outputPath: '/tmp/test2' })
      ).rejects.toThrow(VisualError);
      await expect(
        recorder.startRecording({ outputPath: '/tmp/test2' })
      ).rejects.toHaveProperty('code', 'RECORDING_ALREADY_ACTIVE');
    });

    it('should throw when stopping inactive recording', async () => {
      await expect(recorder.stopRecording()).rejects.toThrow(VisualError);
      await expect(recorder.stopRecording()).rejects.toHaveProperty(
        'code',
        'RECORDING_NOT_ACTIVE'
      );
    });
  });

  describe('Pause/Resume', () => {
    it('should pause recording', async () => {
      await recorder.startRecording({ outputPath: '/tmp/test' });

      recorder.pauseRecording();

      expect(recorder.active).toBe(true);
      expect(recorder.paused).toBe(true);
    });

    it('should resume recording', async () => {
      await recorder.startRecording({ outputPath: '/tmp/test' });
      recorder.pauseRecording();

      recorder.resumeRecording();

      expect(recorder.active).toBe(true);
      expect(recorder.paused).toBe(false);
    });

    it('should throw when pausing inactive recording', () => {
      expect(() => recorder.pauseRecording()).toThrow(VisualError);
    });

    it('should throw when resuming inactive recording', () => {
      expect(() => recorder.resumeRecording()).toThrow(VisualError);
    });

    it('should track paused duration', async () => {
      await recorder.startRecording({ outputPath: '/tmp/test' });

      vi.advanceTimersByTime(1000);
      recorder.pauseRecording();

      vi.advanceTimersByTime(500); // Paused for 500ms
      recorder.resumeRecording();

      vi.advanceTimersByTime(1000);

      const status = recorder.getStatus();
      // Total time: 2500ms, but paused for 500ms = 2000ms duration
      expect(status.durationMs).toBe(2000);
    });
  });

  describe('Recording Status', () => {
    it('should return initial status', () => {
      const status = recorder.getStatus();

      expect(status.isRecording).toBe(false);
      expect(status.isPaused).toBe(false);
      expect(status.durationMs).toBe(0);
      expect(status.frameCount).toBe(0);
    });

    it('should return recording status', async () => {
      await recorder.startRecording({ outputPath: '/tmp/test' });

      const status = recorder.getStatus();

      expect(status.isRecording).toBe(true);
      expect(status.outputPath).toBe('/tmp/test.mp4');
    });

    it('should track duration', async () => {
      await recorder.startRecording({ outputPath: '/tmp/test' });

      vi.advanceTimersByTime(2000);

      const status = recorder.getStatus();
      expect(status.durationMs).toBeGreaterThanOrEqual(2000);
    });

    it('should track paused status in duration', async () => {
      await recorder.startRecording({ outputPath: '/tmp/test' });

      vi.advanceTimersByTime(1000);
      recorder.pauseRecording();
      vi.advanceTimersByTime(1000); // This shouldn't count

      const status = recorder.getStatus();
      expect(status.durationMs).toBe(1000); // Only count non-paused time
    });
  });

  describe('Recording Options', () => {
    it('should use default options', async () => {
      await recorder.startRecording({ outputPath: '/tmp/test' });

      const status = recorder.getStatus();
      expect(status.outputPath).toContain('.mp4'); // Default format
    });

    it('should accept custom format', async () => {
      await recorder.startRecording({
        outputPath: '/tmp/test',
        format: 'webm',
      });

      const status = recorder.getStatus();
      expect(status.outputPath).toBe('/tmp/test.webm');
    });

    it('should not duplicate extension', async () => {
      await recorder.startRecording({
        outputPath: '/tmp/test.mp4',
        format: 'mp4',
      });

      const status = recorder.getStatus();
      expect(status.outputPath).toBe('/tmp/test.mp4');
    });

    it('should validate FPS', async () => {
      await expect(
        recorder.startRecording({ outputPath: '/tmp/test', fps: 0 })
      ).rejects.toThrow(VisualError);

      await expect(
        recorder.startRecording({ outputPath: '/tmp/test', fps: 100 })
      ).rejects.toThrow(VisualError);
    });

    it('should validate quality', async () => {
      await expect(
        recorder.startRecording({ outputPath: '/tmp/test', quality: 0 })
      ).rejects.toThrow(VisualError);

      await expect(
        recorder.startRecording({ outputPath: '/tmp/test', quality: 150 })
      ).rejects.toThrow(VisualError);
    });

    it('should validate format', async () => {
      await expect(
        recorder.startRecording({ outputPath: '/tmp/test', format: 'avi' as any })
      ).rejects.toThrow(VisualError);
    });
  });

  describe('Max Duration', () => {
    it('should auto-stop after max duration', async () => {
      await recorder.startRecording({
        outputPath: '/tmp/test',
        maxDuration: 2, // 2 seconds
      });

      expect(recorder.active).toBe(true);

      // Advance past max duration
      vi.advanceTimersByTime(3000);
      await vi.runAllTimersAsync();

      expect(recorder.active).toBe(false);
    });

    it('should not auto-stop when maxDuration is 0', async () => {
      await recorder.startRecording({
        outputPath: '/tmp/test',
        maxDuration: 0,
      });

      vi.advanceTimersByTime(60000); // 1 minute

      expect(recorder.active).toBe(true);
    });
  });

  describe('Encoder Integration', () => {
    it('should initialize encoder', async () => {
      const encoder = createMockEncoder();
      const factory: EncoderFactory = {
        createEncoder: vi.fn(() => encoder),
      };

      const recorderWithEncoder = createSessionRecorder(factory);
      await recorderWithEncoder.startRecording({ outputPath: '/tmp/test' });

      expect(factory.createEncoder).toHaveBeenCalled();
      expect(encoder.initialize).toHaveBeenCalled();

      await recorderWithEncoder.stopRecording();
    });

    it('should finalize encoder on stop', async () => {
      const encoder = createMockEncoder();
      const factory: EncoderFactory = {
        createEncoder: vi.fn(() => encoder),
      };

      const recorderWithEncoder = createSessionRecorder(factory);
      await recorderWithEncoder.startRecording({ outputPath: '/tmp/test' });
      await recorderWithEncoder.stopRecording();

      expect(encoder.finalize).toHaveBeenCalled();
    });

    it('should pause/resume encoder', async () => {
      const encoder = createMockEncoder();
      const factory: EncoderFactory = {
        createEncoder: vi.fn(() => encoder),
      };

      const recorderWithEncoder = createSessionRecorder(factory);
      await recorderWithEncoder.startRecording({ outputPath: '/tmp/test' });

      recorderWithEncoder.pauseRecording();
      expect(encoder.pause).toHaveBeenCalled();

      recorderWithEncoder.resumeRecording();
      expect(encoder.resume).toHaveBeenCalled();

      await recorderWithEncoder.stopRecording();
    });
  });

  describe('Singleton and Factory', () => {
    it('should create new instance with factory', () => {
      const recorder1 = createSessionRecorder();
      const recorder2 = createSessionRecorder();

      expect(recorder1).not.toBe(recorder2);
    });

    it('should return same instance from singleton', () => {
      const singleton1 = getSessionRecorder();
      const singleton2 = getSessionRecorder();

      expect(singleton1).toBe(singleton2);
    });

    it('should reset singleton', async () => {
      const singleton1 = getSessionRecorder();
      await resetSessionRecorder();
      const singleton2 = getSessionRecorder();

      expect(singleton1).not.toBe(singleton2);
    });
  });
});
