/**
 * Visual Collaboration Types
 * TypeScript interfaces for screen capture, streaming, overlays, and recording
 */

// ============================================================================
// Capture Types
// ============================================================================

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export type CaptureType = 'screen' | 'window' | 'region';
export type ImageFormat = 'png' | 'jpeg';

export interface CaptureOptions {
  /** Type of capture: screen, window, or region */
  type: CaptureType;
  /** Window handle for window capture */
  windowHandle?: number;
  /** Display ID for multi-monitor setups */
  displayId?: string;
  /** Region coordinates for region capture */
  region?: Rectangle;
  /** Output image format */
  format?: ImageFormat;
  /** JPEG quality (0-100), only used when format is 'jpeg' */
  quality?: number;
}

export interface CaptureResult {
  /** Raw image buffer */
  buffer: Buffer;
  /** Image format */
  format: ImageFormat;
  /** Captured area dimensions */
  width: number;
  height: number;
  /** Timestamp of capture */
  timestamp: number;
}

export interface DisplayInfo {
  /** Unique display identifier */
  id: string;
  /** Display name */
  name: string;
  /** Display bounds */
  bounds: Rectangle;
  /** Whether this is the primary display */
  isPrimary: boolean;
  /** Scale factor (for HiDPI displays) */
  scaleFactor: number;
}

// ============================================================================
// Streaming Types
// ============================================================================

export interface StreamOptions {
  /** Target frames per second */
  fps?: number;
  /** Maximum width (will maintain aspect ratio) */
  maxWidth?: number;
  /** JPEG quality for frame encoding (0-100) */
  quality?: number;
  /** Display ID for multi-monitor setups */
  displayId?: string;
  /** Whether to include cursor in stream */
  includeCursor?: boolean;
}

export interface StreamFrame {
  /** Frame data as JPEG buffer */
  data: Buffer;
  /** Frame width */
  width: number;
  /** Frame height */
  height: number;
  /** Frame sequence number */
  sequence: number;
  /** Frame timestamp (ms since stream start) */
  timestamp: number;
}

export interface StreamStatus {
  /** Whether stream is currently active */
  isStreaming: boolean;
  /** Current frames per second */
  currentFps: number;
  /** Target frames per second */
  targetFps: number;
  /** Total frames captured */
  frameCount: number;
  /** Stream duration in milliseconds */
  durationMs: number;
  /** Estimated bandwidth (bytes per second) */
  bandwidthBps: number;
  /** Display being streamed */
  displayId?: string;
}

export type FrameCallback = (frame: StreamFrame) => void | Promise<void>;

// ============================================================================
// Overlay Types
// ============================================================================

export interface CursorOptions {
  x: number;
  y: number;
  visible: boolean;
  /** Cursor style: default, pointer, crosshair, etc. */
  style?: CursorStyle;
  /** Cursor color for custom cursors */
  color?: string;
}

export type CursorStyle = 'default' | 'pointer' | 'crosshair' | 'move' | 'text';

export interface HighlightOptions {
  /** Bounding rectangle to highlight */
  rect: Rectangle;
  /** Border color (CSS color string) */
  color?: string;
  /** Border width in pixels */
  borderWidth?: number;
  /** Label text to show */
  label?: string;
  /** Label position relative to highlight */
  labelPosition?: 'top' | 'bottom' | 'left' | 'right';
  /** Fill color with transparency */
  fillColor?: string;
  /** Animation pulse effect */
  pulse?: boolean;
  /** Unique ID for the highlight */
  id?: string;
}

export interface ClickEffectOptions {
  x: number;
  y: number;
  /** Click effect type */
  type?: 'ripple' | 'ring' | 'dot';
  /** Effect color */
  color?: string;
  /** Duration in milliseconds */
  duration?: number;
}

export interface OverlayOptions {
  /** Cursor overlay options */
  cursor?: CursorOptions;
  /** Element highlights */
  highlights?: HighlightOptions[];
  /** Toast notification options */
  toast?: ToastOptions;
}

export interface OverlayState {
  /** Whether overlay window is visible */
  isVisible: boolean;
  /** Current cursor position */
  cursor?: CursorOptions;
  /** Active highlights */
  highlights: HighlightOptions[];
  /** Whether click effect is animating */
  isAnimating: boolean;
}

// ============================================================================
// Toast Types
// ============================================================================

export type ToastType = 'info' | 'action' | 'success' | 'error' | 'progress';
export type ToastPosition = 
  | 'top-left' | 'top-center' | 'top-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export interface ToastOptions {
  /** Toast message */
  message: string;
  /** Toast type for styling */
  type?: ToastType;
  /** Duration in milliseconds (0 for persistent) */
  duration?: number;
  /** Toast position on screen */
  position?: ToastPosition;
  /** Icon name or emoji */
  icon?: string;
  /** Progress value (0-100) for progress toasts */
  progress?: number;
  /** Whether toast is dismissible by user */
  dismissible?: boolean;
  /** Unique toast ID */
  id?: string;
}

export interface Toast {
  /** Unique toast ID */
  id: string;
  /** Toast options */
  options: Required<ToastOptions>;
  /** Toast creation timestamp */
  createdAt: number;
  /** When toast will auto-dismiss (0 if persistent) */
  expiresAt: number;
  /** Current toast state */
  state: 'showing' | 'visible' | 'hiding' | 'hidden';
}

export interface ActionToastOptions {
  /** The action being performed (e.g., 'Clicking', 'Typing') */
  action: string;
  /** Target element or location (e.g., 'Save button', '[x: 100, y: 200]') */
  target: string;
  /** Additional details */
  details?: string;
}

export interface ProgressToastOptions {
  /** Progress message */
  message: string;
  /** Progress percentage (0-100) */
  progress: number;
  /** Whether progress is indeterminate */
  indeterminate?: boolean;
}

// ============================================================================
// Recording Types
// ============================================================================

export type RecordingFormat = 'mp4' | 'webm';

export interface RecordingOptions {
  /** Output file path (without extension) */
  outputPath: string;
  /** Video format */
  format?: RecordingFormat;
  /** Target frames per second */
  fps?: number;
  /** Maximum width (maintains aspect ratio) */
  maxWidth?: number;
  /** Video quality (0-100) */
  quality?: number;
  /** Display to record */
  displayId?: string;
  /** Whether to record audio */
  includeAudio?: boolean;
  /** Whether to include overlay annotations */
  includeOverlay?: boolean;
  /** Maximum recording duration in seconds (0 for unlimited) */
  maxDuration?: number;
}

export interface RecordingStatus {
  /** Whether recording is active */
  isRecording: boolean;
  /** Whether recording is paused */
  isPaused: boolean;
  /** Recording duration in milliseconds */
  durationMs: number;
  /** Frames recorded */
  frameCount: number;
  /** Output file path */
  outputPath?: string;
  /** Estimated file size in bytes */
  estimatedSizeBytes: number;
}

export interface RecordingMetadata {
  /** Recording start time */
  startTime: number;
  /** Recording end time */
  endTime: number;
  /** Total duration in milliseconds */
  durationMs: number;
  /** Total frames */
  frameCount: number;
  /** Output format */
  format: RecordingFormat;
  /** Video dimensions */
  width: number;
  height: number;
  /** Frames per second */
  fps: number;
  /** File size in bytes */
  sizeBytes: number;
  /** Recording options used */
  options: RecordingOptions;
}

// ============================================================================
// Event Types
// ============================================================================

export type VisualEventType = 
  | 'capture:complete'
  | 'stream:start'
  | 'stream:frame'
  | 'stream:stop'
  | 'stream:error'
  | 'overlay:show'
  | 'overlay:hide'
  | 'overlay:cursor'
  | 'overlay:highlight'
  | 'overlay:click'
  | 'toast:show'
  | 'toast:hide'
  | 'recording:start'
  | 'recording:pause'
  | 'recording:resume'
  | 'recording:stop'
  | 'recording:error';

export interface VisualEvent {
  type: VisualEventType;
  timestamp: number;
  data?: unknown;
}

export type VisualEventHandler = (event: VisualEvent) => void | Promise<void>;

// ============================================================================
// Error Types
// ============================================================================

export class VisualError extends Error {
  constructor(
    message: string,
    public code: VisualErrorCode,
    public cause?: Error
  ) {
    super(message);
    this.name = 'VisualError';
  }
}

export type VisualErrorCode =
  | 'CAPTURE_FAILED'
  | 'CAPTURE_PERMISSION_DENIED'
  | 'DISPLAY_NOT_FOUND'
  | 'WINDOW_NOT_FOUND'
  | 'STREAM_ALREADY_ACTIVE'
  | 'STREAM_NOT_ACTIVE'
  | 'STREAM_ENCODING_ERROR'
  | 'OVERLAY_WINDOW_ERROR'
  | 'OVERLAY_NOT_INITIALIZED'
  | 'RECORDING_ALREADY_ACTIVE'
  | 'RECORDING_NOT_ACTIVE'
  | 'RECORDING_ENCODING_ERROR'
  | 'RECORDING_WRITE_ERROR'
  | 'INVALID_OPTIONS'
  | 'ELECTRON_NOT_AVAILABLE';
