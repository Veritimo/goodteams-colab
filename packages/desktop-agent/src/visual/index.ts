/**
 * Visual Collaboration Module
 * Barrel exports for screen capture, streaming, overlays, toasts, and recording
 */

// ============================================================================
// Types
// ============================================================================

export * from './types.js';

// ============================================================================
// Capture Module
// ============================================================================

export {
  // Initialization
  initializeCapture,
  resetCapture,
  isCaptureInitialized,

  // Display information
  listDisplays,
  getDisplayBounds,
  getPrimaryDisplayId,

  // Capture functions
  captureScreen,
  captureWindow,
  captureRegion,
  captureToBuffer,
  captureToFile,

  // Window utilities
  listWindows,
  findWindowByName,

  // Types
  type ElectronDesktopCapturer,
  type ElectronScreen,
} from './capture.js';

// ============================================================================
// Stream Module
// ============================================================================

export {
  // StreamManager class
  StreamManager,

  // Factory and singleton
  createStreamManager,
  getStreamManager,
  resetStreamManager,

  // Convenience functions
  startStream,
  stopStream,
  getStreamStatus,
  onFrame,
} from './stream.js';

// ============================================================================
// Overlay Module
// ============================================================================

export {
  // Initialization
  initializeOverlay,
  resetOverlay,
  isOverlayInitialized,

  // OverlayWindow class
  OverlayWindow,

  // Factory and singleton
  createOverlayWindow,
  getOverlayWindow,
  resetOverlayWindow,

  // Convenience functions
  showCursor,
  hideCursor,
  animateCursor,
  highlightElement,
  clearHighlights,
  showClickEffect,

  // Types
  type ElectronBrowserWindow,
  type BrowserWindowConstructor,
} from './overlay.js';

// ============================================================================
// Toast Module
// ============================================================================

export {
  // ToastManager class
  ToastManager,

  // Factory and singleton
  createToastManager,
  getToastManager,
  resetToastManager,

  // Convenience functions
  showToast,
  showActionToast,
  showProgressToast,
  updateProgress,
  dismissToast,
  dismissAll,

  // Types
  type ToastRenderer,
} from './toast.js';

// ============================================================================
// Recording Module
// ============================================================================

export {
  // SessionRecorder class
  SessionRecorder,

  // Factory and singleton
  createSessionRecorder,
  getSessionRecorder,
  resetSessionRecorder,

  // Convenience functions
  startRecording,
  stopRecording,
  pauseRecording,
  resumeRecording,
  getRecordingStatus,

  // Types
  type VideoEncoder,
  type EncoderFactory,
} from './recording.js';
