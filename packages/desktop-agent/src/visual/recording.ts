/**
 * Session Recording Module
 * Handles recording of screen sessions with overlay annotations
 */

import {
  RecordingOptions,
  RecordingStatus,
  RecordingMetadata,
  RecordingFormat,
  StreamFrame,
  VisualError,
} from './types.js';
import { StreamManager, createStreamManager } from './stream.js';
import { OverlayWindow } from './overlay.js';

// ============================================================================
// Encoder Interface (for testing)
// ============================================================================

export interface VideoEncoder {
  initialize(options: {
    width: number;
    height: number;
    fps: number;
    quality: number;
    format: RecordingFormat;
    outputPath: string;
  }): Promise<void>;
  addFrame(frame: Buffer, timestamp: number): Promise<void>;
  pause(): void;
  resume(): void;
  finalize(): Promise<RecordingMetadata>;
  getEstimatedSize(): number;
  isReady(): boolean;
}

export interface EncoderFactory {
  createEncoder(): VideoEncoder;
}

// ============================================================================
// SessionRecorder Class
// ============================================================================

export class SessionRecorder {
  private isRecording = false;
  private isPaused = false;
  private startTime = 0;
  private pausedDuration = 0;
  private pauseStartTime = 0;
  private frameCount = 0;
  private outputPath: string | null = null;
  private options: Required<RecordingOptions> | null = null;

  private streamManager: StreamManager | null = null;
  private streamUnsubscribe: (() => void) | null = null;
  private encoder: VideoEncoder | null = null;
  private encoderFactory: EncoderFactory | null = null;
  private overlayWindow: OverlayWindow | null = null;

  private static readonly DEFAULT_OPTIONS: Omit<Required<RecordingOptions>, 'outputPath'> = {
    format: 'mp4',
    fps: 15,
    maxWidth: 1920,
    quality: 70,
    displayId: '',
    includeAudio: false,
    includeOverlay: true,
    maxDuration: 0,
  };

  constructor(encoderFactory?: EncoderFactory) {
    this.encoderFactory = encoderFactory ?? null;
  }

  /**
   * Set the encoder factory (for dependency injection)
   */
  setEncoderFactory(factory: EncoderFactory): void {
    this.encoderFactory = factory;
  }

  /**
   * Set the overlay window to include in recording
   */
  setOverlayWindow(overlay: OverlayWindow): void {
    this.overlayWindow = overlay;
  }

  /**
   * Start recording the screen
   */
  async startRecording(options: RecordingOptions): Promise<void> {
    if (this.isRecording) {
      throw new VisualError(
        'Recording is already active',
        'RECORDING_ALREADY_ACTIVE'
      );
    }

    // Merge with defaults
    this.options = {
      ...SessionRecorder.DEFAULT_OPTIONS,
      ...options,
    };

    // Validate options
    this.validateOptions();

    this.outputPath = this.getOutputPath(options.outputPath);

    try {
      // Initialize encoder if factory provided
      if (this.encoderFactory) {
        this.encoder = this.encoderFactory.createEncoder();
        await this.encoder.initialize({
          width: this.options.maxWidth,
          height: Math.round(this.options.maxWidth * 9 / 16), // Assume 16:9
          fps: this.options.fps,
          quality: this.options.quality,
          format: this.options.format,
          outputPath: this.outputPath,
        });
      }

      // Create and start stream manager
      this.streamManager = createStreamManager();

      // Subscribe to frames
      this.streamUnsubscribe = this.streamManager.onFrame(async (frame) => {
        await this.handleFrame(frame);
      });

      // Start streaming
      await this.streamManager.startStream({
        fps: this.options.fps,
        maxWidth: this.options.maxWidth,
        quality: this.options.quality,
        displayId: this.options.displayId || undefined,
      });

      // Update state
      this.isRecording = true;
      this.isPaused = false;
      this.startTime = Date.now();
      this.pausedDuration = 0;
      this.frameCount = 0;

      // Set max duration timer if specified
      if (this.options.maxDuration > 0) {
        setTimeout(() => {
          if (this.isRecording) {
            this.stopRecording().catch(console.error);
          }
        }, this.options.maxDuration * 1000);
      }
    } catch (error) {
      await this.cleanup();
      throw new VisualError(
        `Failed to start recording: ${error instanceof Error ? error.message : String(error)}`,
        'RECORDING_ENCODING_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Stop recording and save the file
   */
  async stopRecording(): Promise<RecordingMetadata> {
    if (!this.isRecording) {
      throw new VisualError(
        'No active recording to stop',
        'RECORDING_NOT_ACTIVE'
      );
    }

    try {
      // Stop stream
      if (this.streamManager?.active) {
        await this.streamManager.stopStream();
      }

      // Finalize encoder
      let metadata: RecordingMetadata;

      if (this.encoder) {
        metadata = await this.encoder.finalize();
      } else {
        // Create metadata manually if no encoder
        const endTime = Date.now();
        const durationMs = endTime - this.startTime - this.pausedDuration;

        metadata = {
          startTime: this.startTime,
          endTime,
          durationMs,
          frameCount: this.frameCount,
          format: this.options?.format || 'mp4',
          width: this.options?.maxWidth || 1920,
          height: Math.round((this.options?.maxWidth || 1920) * 9 / 16),
          fps: this.options?.fps || 15,
          sizeBytes: 0,
          options: this.options as RecordingOptions,
        };
      }

      await this.cleanup();

      return metadata;
    } catch (error) {
      await this.cleanup();
      throw new VisualError(
        `Failed to stop recording: ${error instanceof Error ? error.message : String(error)}`,
        'RECORDING_ENCODING_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Pause recording (frames are not captured while paused)
   */
  pauseRecording(): void {
    if (!this.isRecording) {
      throw new VisualError(
        'No active recording to pause',
        'RECORDING_NOT_ACTIVE'
      );
    }

    if (this.isPaused) {
      return; // Already paused
    }

    this.isPaused = true;
    this.pauseStartTime = Date.now();

    // Pause stream
    this.streamManager?.pauseStream();

    // Pause encoder
    this.encoder?.pause();
  }

  /**
   * Resume a paused recording
   */
  resumeRecording(): void {
    if (!this.isRecording) {
      throw new VisualError(
        'No active recording to resume',
        'RECORDING_NOT_ACTIVE'
      );
    }

    if (!this.isPaused) {
      return; // Not paused
    }

    // Track paused duration
    this.pausedDuration += Date.now() - this.pauseStartTime;

    this.isPaused = false;
    this.pauseStartTime = 0;

    // Resume stream
    this.streamManager?.resumeStream();

    // Resume encoder
    this.encoder?.resume();
  }

  /**
   * Get current recording status
   */
  getStatus(): RecordingStatus {
    const now = Date.now();
    let durationMs = 0;

    if (this.isRecording) {
      durationMs = now - this.startTime - this.pausedDuration;
      if (this.isPaused) {
        durationMs -= now - this.pauseStartTime;
      }
    }

    return {
      isRecording: this.isRecording,
      isPaused: this.isPaused,
      durationMs,
      frameCount: this.frameCount,
      outputPath: this.outputPath || undefined,
      estimatedSizeBytes: this.encoder?.getEstimatedSize() || 0,
    };
  }

  /**
   * Check if recording is active
   */
  get active(): boolean {
    return this.isRecording;
  }

  /**
   * Check if recording is paused
   */
  get paused(): boolean {
    return this.isPaused;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async handleFrame(frame: StreamFrame): Promise<void> {
    if (!this.isRecording || this.isPaused) {
      return;
    }

    try {
      // Optionally composite overlay
      let frameData = frame.data;

      if (this.options?.includeOverlay && this.overlayWindow) {
        frameData = await this.compositeOverlay(frame.data);
      }

      // Add frame to encoder
      if (this.encoder) {
        await this.encoder.addFrame(frameData, frame.timestamp);
      }

      this.frameCount++;
    } catch (error) {
      console.error('Failed to process frame:', error);
      throw new VisualError(
        `Frame encoding failed: ${error instanceof Error ? error.message : String(error)}`,
        'RECORDING_ENCODING_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  private async compositeOverlay(frameData: Buffer): Promise<Buffer> {
    // In a real implementation, this would composite the overlay onto the frame
    // using sharp or native-image
    // For now, we just return the frame as-is
    return frameData;
  }

  private validateOptions(): void {
    if (!this.options) {
      throw new VisualError('Options not set', 'INVALID_OPTIONS');
    }

    const { fps, maxWidth, quality, format } = this.options;

    if (fps < 1 || fps > 60) {
      throw new VisualError(
        'FPS must be between 1 and 60',
        'INVALID_OPTIONS'
      );
    }

    if (maxWidth < 320 || maxWidth > 4096) {
      throw new VisualError(
        'maxWidth must be between 320 and 4096',
        'INVALID_OPTIONS'
      );
    }

    if (quality < 1 || quality > 100) {
      throw new VisualError(
        'quality must be between 1 and 100',
        'INVALID_OPTIONS'
      );
    }

    if (format !== 'mp4' && format !== 'webm') {
      throw new VisualError(
        `Invalid format: ${format}. Must be 'mp4' or 'webm'`,
        'INVALID_OPTIONS'
      );
    }
  }

  private getOutputPath(basePath: string): string {
    const format = this.options?.format || 'mp4';

    // Add extension if not present
    if (!basePath.endsWith(`.${format}`)) {
      return `${basePath}.${format}`;
    }

    return basePath;
  }

  private async cleanup(): Promise<void> {
    // Unsubscribe from stream
    if (this.streamUnsubscribe) {
      this.streamUnsubscribe();
      this.streamUnsubscribe = null;
    }

    // Stop stream manager
    if (this.streamManager?.active) {
      try {
        await this.streamManager.stopStream();
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.streamManager = null;

    // Reset encoder
    this.encoder = null;

    // Reset state
    this.isRecording = false;
    this.isPaused = false;
    this.options = null;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new SessionRecorder instance
 */
export function createSessionRecorder(encoderFactory?: EncoderFactory): SessionRecorder {
  return new SessionRecorder(encoderFactory);
}

// ============================================================================
// Singleton Instance
// ============================================================================

let defaultRecorder: SessionRecorder | null = null;

/**
 * Get the default SessionRecorder instance
 */
export function getSessionRecorder(): SessionRecorder {
  if (!defaultRecorder) {
    defaultRecorder = new SessionRecorder();
  }
  return defaultRecorder;
}

/**
 * Reset the default SessionRecorder (for testing)
 */
export async function resetSessionRecorder(): Promise<void> {
  if (defaultRecorder?.active) {
    try {
      await defaultRecorder.stopRecording();
    } catch {
      // Ignore errors during cleanup
    }
  }
  defaultRecorder = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Start recording
 */
export async function startRecording(options: RecordingOptions): Promise<void> {
  return getSessionRecorder().startRecording(options);
}

/**
 * Stop recording
 */
export async function stopRecording(): Promise<RecordingMetadata> {
  return getSessionRecorder().stopRecording();
}

/**
 * Pause recording
 */
export function pauseRecording(): void {
  getSessionRecorder().pauseRecording();
}

/**
 * Resume recording
 */
export function resumeRecording(): void {
  getSessionRecorder().resumeRecording();
}

/**
 * Get recording status
 */
export function getRecordingStatus(): RecordingStatus {
  return getSessionRecorder().getStatus();
}
