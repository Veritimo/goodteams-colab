/**
 * Screen Streaming Module
 * Handles continuous screen capture and frame encoding for real-time streaming
 */

import {
  StreamOptions,
  StreamFrame,
  StreamStatus,
  FrameCallback,
  VisualError,
  ImageFormat,
} from './types.js';
import {
  captureToBuffer,
  isCaptureInitialized,
  getPrimaryDisplayId,
} from './capture.js';

// ============================================================================
// StreamManager Class
// ============================================================================

export class StreamManager {
  private isStreaming = false;
  private isPaused = false;
  private frameCount = 0;
  private startTime = 0;
  private lastFrameTime = 0;
  private frameInterval: ReturnType<typeof setInterval> | null = null;
  private frameCallbacks: Set<FrameCallback> = new Set();
  private options: Required<StreamOptions>;
  private recentFrameSizes: number[] = [];
  private displayId: string | undefined;

  private static readonly DEFAULT_OPTIONS: Required<StreamOptions> = {
    fps: 15,
    maxWidth: 1920,
    quality: 70,
    displayId: '',
    includeCursor: true,
  };

  constructor() {
    this.options = { ...StreamManager.DEFAULT_OPTIONS };
  }

  /**
   * Start streaming screen content
   */
  async startStream(options?: StreamOptions): Promise<void> {
    if (this.isStreaming) {
      throw new VisualError(
        'Stream is already active',
        'STREAM_ALREADY_ACTIVE'
      );
    }

    if (!isCaptureInitialized()) {
      throw new VisualError(
        'Capture module not initialized',
        'ELECTRON_NOT_AVAILABLE'
      );
    }

    // Merge options with defaults
    this.options = {
      ...StreamManager.DEFAULT_OPTIONS,
      ...options,
    };

    // Validate options
    this.validateOptions();

    // Get display ID
    this.displayId = this.options.displayId || await getPrimaryDisplayId();

    // Reset state
    this.frameCount = 0;
    this.startTime = Date.now();
    this.lastFrameTime = 0;
    this.recentFrameSizes = [];
    this.isStreaming = true;
    this.isPaused = false;

    // Start frame capture loop
    const frameIntervalMs = 1000 / this.options.fps;
    this.frameInterval = setInterval(() => {
      this.captureFrame().catch((error) => {
        console.error('Frame capture error:', error);
        this.emitError(error);
      });
    }, frameIntervalMs);
  }

  /**
   * Stop streaming
   */
  async stopStream(): Promise<void> {
    if (!this.isStreaming) {
      throw new VisualError(
        'No active stream to stop',
        'STREAM_NOT_ACTIVE'
      );
    }

    if (this.frameInterval) {
      clearInterval(this.frameInterval);
      this.frameInterval = null;
    }

    this.isStreaming = false;
    this.isPaused = false;
  }

  /**
   * Pause streaming (keeps state, stops frame capture)
   */
  pauseStream(): void {
    if (!this.isStreaming) {
      throw new VisualError(
        'No active stream to pause',
        'STREAM_NOT_ACTIVE'
      );
    }

    this.isPaused = true;
  }

  /**
   * Resume paused stream
   */
  resumeStream(): void {
    if (!this.isStreaming) {
      throw new VisualError(
        'No active stream to resume',
        'STREAM_NOT_ACTIVE'
      );
    }

    this.isPaused = false;
  }

  /**
   * Get current stream status
   */
  getStreamStatus(): StreamStatus {
    const now = Date.now();
    const durationMs = this.isStreaming ? now - this.startTime : 0;

    // Calculate current FPS from recent frames
    const currentFps = this.calculateCurrentFps();

    // Calculate bandwidth from recent frame sizes
    const bandwidthBps = this.calculateBandwidth();

    return {
      isStreaming: this.isStreaming,
      currentFps,
      targetFps: this.options.fps,
      frameCount: this.frameCount,
      durationMs,
      bandwidthBps,
      displayId: this.displayId,
    };
  }

  /**
   * Register a frame callback
   */
  onFrame(callback: FrameCallback): () => void {
    this.frameCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.frameCallbacks.delete(callback);
    };
  }

  /**
   * Remove a frame callback
   */
  offFrame(callback: FrameCallback): void {
    this.frameCallbacks.delete(callback);
  }

  /**
   * Check if stream is active
   */
  get active(): boolean {
    return this.isStreaming;
  }

  /**
   * Check if stream is paused
   */
  get paused(): boolean {
    return this.isPaused;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async captureFrame(): Promise<void> {
    if (!this.isStreaming || this.isPaused) {
      return;
    }

    const frameStartTime = Date.now();

    try {
      const result = await captureToBuffer({
        type: 'screen',
        displayId: this.displayId,
        format: 'jpeg' as ImageFormat,
        quality: this.options.quality,
      });

      // Scale down if needed (would use sharp in real implementation)
      const scaledBuffer = this.scaleIfNeeded(result.buffer, result.width);

      const frame: StreamFrame = {
        data: scaledBuffer,
        width: result.width,
        height: result.height,
        sequence: this.frameCount++,
        timestamp: frameStartTime - this.startTime,
      };

      // Track frame size for bandwidth calculation
      this.recentFrameSizes.push(scaledBuffer.length);
      if (this.recentFrameSizes.length > 30) {
        this.recentFrameSizes.shift();
      }

      this.lastFrameTime = frameStartTime;

      // Notify all callbacks
      await this.notifyCallbacks(frame);
    } catch (error) {
      throw new VisualError(
        `Frame capture failed: ${error instanceof Error ? error.message : String(error)}`,
        'STREAM_ENCODING_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  private async notifyCallbacks(frame: StreamFrame): Promise<void> {
    const promises = Array.from(this.frameCallbacks).map((callback) => {
      try {
        return Promise.resolve(callback(frame));
      } catch (error) {
        console.error('Frame callback error:', error);
        return Promise.resolve();
      }
    });

    await Promise.all(promises);
  }

  private scaleIfNeeded(buffer: Buffer, currentWidth: number): Buffer {
    // In a real implementation, this would use sharp or native-image to resize
    // For now, we just return the buffer as-is
    if (currentWidth > this.options.maxWidth) {
      // Would scale here
      return buffer;
    }
    return buffer;
  }

  private calculateCurrentFps(): number {
    if (!this.isStreaming || this.frameCount < 2) {
      return 0;
    }

    const duration = (Date.now() - this.startTime) / 1000;
    if (duration < 1) {
      return 0;
    }

    return Math.round((this.frameCount / duration) * 10) / 10;
  }

  private calculateBandwidth(): number {
    if (this.recentFrameSizes.length === 0) {
      return 0;
    }

    const totalBytes = this.recentFrameSizes.reduce((a, b) => a + b, 0);
    const avgFrameSize = totalBytes / this.recentFrameSizes.length;

    return Math.round(avgFrameSize * this.options.fps);
  }

  private validateOptions(): void {
    const { fps, maxWidth, quality } = this.options;

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
  }

  private emitError(error: Error): void {
    // In a full implementation, this would emit to an event emitter
    console.error('Stream error:', error);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new StreamManager instance
 */
export function createStreamManager(): StreamManager {
  return new StreamManager();
}

// ============================================================================
// Singleton Instance
// ============================================================================

let defaultStreamManager: StreamManager | null = null;

/**
 * Get the default StreamManager instance
 */
export function getStreamManager(): StreamManager {
  if (!defaultStreamManager) {
    defaultStreamManager = new StreamManager();
  }
  return defaultStreamManager;
}

/**
 * Reset the default StreamManager (for testing)
 */
export function resetStreamManager(): void {
  if (defaultStreamManager?.active) {
    defaultStreamManager.stopStream().catch(() => {});
  }
  defaultStreamManager = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Start streaming with the default manager
 */
export async function startStream(options?: StreamOptions): Promise<void> {
  return getStreamManager().startStream(options);
}

/**
 * Stop streaming with the default manager
 */
export async function stopStream(): Promise<void> {
  return getStreamManager().stopStream();
}

/**
 * Get stream status from the default manager
 */
export function getStreamStatus(): StreamStatus {
  return getStreamManager().getStreamStatus();
}

/**
 * Register a frame callback on the default manager
 */
export function onFrame(callback: FrameCallback): () => void {
  return getStreamManager().onFrame(callback);
}
