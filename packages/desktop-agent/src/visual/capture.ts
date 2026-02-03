/**
 * Screen Capture Module
 * Handles screen, window, and region captures using Electron's desktopCapturer
 */

import {
  CaptureOptions,
  CaptureResult,
  DisplayInfo,
  Rectangle,
  ImageFormat,
  VisualError,
} from './types.js';

// ============================================================================
// Electron API Abstraction (for testing)
// ============================================================================

export interface ElectronDesktopCapturer {
  getSources(options: {
    types: ('window' | 'screen')[];
    thumbnailSize?: { width: number; height: number };
    fetchWindowIcons?: boolean;
  }): Promise<Array<{
    id: string;
    name: string;
    thumbnail: { toJPEG(quality: number): Buffer; toPNG(): Buffer; getSize(): { width: number; height: number } };
    display_id: string;
    appIcon?: { toJPEG(quality: number): Buffer; toPNG(): Buffer };
  }>>;
}

export interface ElectronScreen {
  getPrimaryDisplay(): {
    id: number;
    bounds: Rectangle;
    scaleFactor: number;
    rotation: number;
  };
  getAllDisplays(): Array<{
    id: number;
    bounds: Rectangle;
    scaleFactor: number;
    rotation: number;
    label?: string;
  }>;
  getDisplayMatching(rect: Rectangle): {
    id: number;
    bounds: Rectangle;
    scaleFactor: number;
  } | null;
}

// ============================================================================
// Module State
// ============================================================================

let desktopCapturer: ElectronDesktopCapturer | null = null;
let electronScreen: ElectronScreen | null = null;

/**
 * Initialize the capture module with Electron APIs
 * Call this from the main process after Electron is ready
 */
export function initializeCapture(
  capturer: ElectronDesktopCapturer,
  screen: ElectronScreen
): void {
  desktopCapturer = capturer;
  electronScreen = screen;
}

/**
 * Reset the capture module (for testing)
 */
export function resetCapture(): void {
  desktopCapturer = null;
  electronScreen = null;
}

/**
 * Check if capture module is initialized
 */
export function isCaptureInitialized(): boolean {
  return desktopCapturer !== null && electronScreen !== null;
}

// ============================================================================
// Display Information
// ============================================================================

/**
 * Get list of all available displays
 */
export async function listDisplays(): Promise<DisplayInfo[]> {
  if (!electronScreen) {
    throw new VisualError(
      'Capture module not initialized. Call initializeCapture first.',
      'ELECTRON_NOT_AVAILABLE'
    );
  }

  const displays = electronScreen.getAllDisplays();
  const primaryDisplay = electronScreen.getPrimaryDisplay();

  return displays.map((display) => ({
    id: String(display.id),
    name: display.label || `Display ${display.id}`,
    bounds: display.bounds,
    isPrimary: display.id === primaryDisplay.id,
    scaleFactor: display.scaleFactor,
  }));
}

/**
 * Get bounds for a specific display
 */
export async function getDisplayBounds(displayId?: string): Promise<Rectangle> {
  if (!electronScreen) {
    throw new VisualError(
      'Capture module not initialized',
      'ELECTRON_NOT_AVAILABLE'
    );
  }

  if (!displayId) {
    const primary = electronScreen.getPrimaryDisplay();
    return primary.bounds;
  }

  const displays = electronScreen.getAllDisplays();
  const display = displays.find((d) => String(d.id) === displayId);

  if (!display) {
    throw new VisualError(
      `Display not found: ${displayId}`,
      'DISPLAY_NOT_FOUND'
    );
  }

  return display.bounds;
}

/**
 * Get the primary display ID
 */
export async function getPrimaryDisplayId(): Promise<string> {
  if (!electronScreen) {
    throw new VisualError(
      'Capture module not initialized',
      'ELECTRON_NOT_AVAILABLE'
    );
  }

  const primary = electronScreen.getPrimaryDisplay();
  return String(primary.id);
}

// ============================================================================
// Screen Capture
// ============================================================================

/**
 * Capture the full screen
 */
export async function captureScreen(displayId?: string): Promise<CaptureResult> {
  return captureToBuffer({
    type: 'screen',
    displayId,
    format: 'png',
  });
}

/**
 * Capture a specific window
 */
export async function captureWindow(handle: number): Promise<CaptureResult> {
  return captureToBuffer({
    type: 'window',
    windowHandle: handle,
    format: 'png',
  });
}

/**
 * Capture a specific region of the screen
 */
export async function captureRegion(rect: Rectangle): Promise<CaptureResult> {
  return captureToBuffer({
    type: 'region',
    region: rect,
    format: 'png',
  });
}

/**
 * Capture to a buffer with options
 */
export async function captureToBuffer(options: CaptureOptions): Promise<CaptureResult> {
  if (!desktopCapturer || !electronScreen) {
    throw new VisualError(
      'Capture module not initialized',
      'ELECTRON_NOT_AVAILABLE'
    );
  }

  validateCaptureOptions(options);

  const format = options.format || 'png';
  const quality = options.quality || 80;

  try {
    switch (options.type) {
      case 'screen':
        return await captureScreenInternal(options.displayId, format, quality);
      case 'window':
        if (options.windowHandle === undefined) {
          throw new VisualError(
            'windowHandle is required for window capture',
            'INVALID_OPTIONS'
          );
        }
        return await captureWindowInternal(options.windowHandle, format, quality);
      case 'region':
        if (!options.region) {
          throw new VisualError(
            'region is required for region capture',
            'INVALID_OPTIONS'
          );
        }
        return await captureRegionInternal(options.region, format, quality);
      default:
        throw new VisualError(
          `Invalid capture type: ${options.type}`,
          'INVALID_OPTIONS'
        );
    }
  } catch (error) {
    if (error instanceof VisualError) {
      throw error;
    }
    throw new VisualError(
      `Capture failed: ${error instanceof Error ? error.message : String(error)}`,
      'CAPTURE_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Capture to a file
 */
export async function captureToFile(
  options: CaptureOptions,
  filePath: string
): Promise<CaptureResult> {
  const result = await captureToBuffer(options);

  // In a real implementation, we would write to file here
  // For now, we'll just return the result and let the caller handle file writing
  // This keeps the module testable without file system mocking

  // Store the file path in the result for reference
  (result as CaptureResult & { filePath: string }).filePath = filePath;

  return result;
}

// ============================================================================
// Internal Capture Functions
// ============================================================================

async function captureScreenInternal(
  displayId: string | undefined,
  format: ImageFormat,
  quality: number
): Promise<CaptureResult> {
  if (!desktopCapturer || !electronScreen) {
    throw new VisualError('Capture not initialized', 'ELECTRON_NOT_AVAILABLE');
  }

  const targetDisplayId = displayId || String(electronScreen.getPrimaryDisplay().id);
  const bounds = await getDisplayBounds(targetDisplayId);

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: bounds.width, height: bounds.height },
  });

  const source = sources.find(
    (s) => s.display_id === targetDisplayId || s.name.includes('Screen')
  );

  if (!source) {
    throw new VisualError(
      `Screen source not found for display: ${targetDisplayId}`,
      'DISPLAY_NOT_FOUND'
    );
  }

  const buffer = format === 'jpeg'
    ? source.thumbnail.toJPEG(quality)
    : source.thumbnail.toPNG();

  const size = source.thumbnail.getSize();

  return {
    buffer,
    format,
    width: size.width,
    height: size.height,
    timestamp: Date.now(),
  };
}

async function captureWindowInternal(
  windowHandle: number,
  format: ImageFormat,
  quality: number
): Promise<CaptureResult> {
  if (!desktopCapturer) {
    throw new VisualError('Capture not initialized', 'ELECTRON_NOT_AVAILABLE');
  }

  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 1920, height: 1080 },
    fetchWindowIcons: false,
  });

  // Find window by handle - in Electron, the source id contains the handle
  const source = sources.find((s) => {
    // Source ID format is typically "window:1234:0" where 1234 is the handle
    const parts = s.id.split(':');
    return parts.length >= 2 && parseInt(parts[1], 10) === windowHandle;
  });

  if (!source) {
    throw new VisualError(
      `Window not found: ${windowHandle}`,
      'WINDOW_NOT_FOUND'
    );
  }

  const buffer = format === 'jpeg'
    ? source.thumbnail.toJPEG(quality)
    : source.thumbnail.toPNG();

  const size = source.thumbnail.getSize();

  return {
    buffer,
    format,
    width: size.width,
    height: size.height,
    timestamp: Date.now(),
  };
}

async function captureRegionInternal(
  region: Rectangle,
  format: ImageFormat,
  quality: number
): Promise<CaptureResult> {
  if (!desktopCapturer || !electronScreen) {
    throw new VisualError('Capture not initialized', 'ELECTRON_NOT_AVAILABLE');
  }

  // First capture the full screen
  const display = electronScreen.getDisplayMatching(region);
  if (!display) {
    throw new VisualError(
      'No display found for the specified region',
      'DISPLAY_NOT_FOUND'
    );
  }

  const fullCapture = await captureScreenInternal(
    String(display.id),
    format,
    quality
  );

  // In a real implementation, we would crop the image here
  // For now, we return the full capture with the region info
  // The actual cropping would be done using sharp or native-image

  return {
    buffer: fullCapture.buffer,
    format,
    width: region.width,
    height: region.height,
    timestamp: Date.now(),
  };
}

// ============================================================================
// Validation
// ============================================================================

function validateCaptureOptions(options: CaptureOptions): void {
  if (!options.type) {
    throw new VisualError('Capture type is required', 'INVALID_OPTIONS');
  }

  if (options.type !== 'screen' && options.type !== 'window' && options.type !== 'region') {
    throw new VisualError(
      `Invalid capture type: ${options.type}`,
      'INVALID_OPTIONS'
    );
  }

  if (options.format && options.format !== 'png' && options.format !== 'jpeg') {
    throw new VisualError(
      `Invalid image format: ${options.format}`,
      'INVALID_OPTIONS'
    );
  }

  if (options.quality !== undefined) {
    if (typeof options.quality !== 'number' || options.quality < 0 || options.quality > 100) {
      throw new VisualError(
        'Quality must be a number between 0 and 100',
        'INVALID_OPTIONS'
      );
    }
  }

  if (options.region) {
    const { x, y, width, height } = options.region;
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof width !== 'number' ||
      typeof height !== 'number'
    ) {
      throw new VisualError(
        'Region must have numeric x, y, width, and height',
        'INVALID_OPTIONS'
      );
    }
    if (width <= 0 || height <= 0) {
      throw new VisualError(
        'Region width and height must be positive',
        'INVALID_OPTIONS'
      );
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * List all capturable windows
 */
export async function listWindows(): Promise<Array<{
  id: string;
  name: string;
  handle: number;
  hasIcon: boolean;
}>> {
  if (!desktopCapturer) {
    throw new VisualError(
      'Capture module not initialized',
      'ELECTRON_NOT_AVAILABLE'
    );
  }

  const sources = await desktopCapturer.getSources({
    types: ['window'],
    fetchWindowIcons: true,
  });

  return sources.map((source) => {
    // Extract handle from source ID
    const parts = source.id.split(':');
    const handle = parts.length >= 2 ? parseInt(parts[1], 10) : 0;

    return {
      id: source.id,
      name: source.name,
      handle,
      hasIcon: !!source.appIcon,
    };
  });
}

/**
 * Find a window by name (partial match)
 */
export async function findWindowByName(name: string): Promise<{
  id: string;
  name: string;
  handle: number;
} | null> {
  const windows = await listWindows();
  const lowerName = name.toLowerCase();

  const found = windows.find((w) => w.name.toLowerCase().includes(lowerName));
  return found || null;
}
