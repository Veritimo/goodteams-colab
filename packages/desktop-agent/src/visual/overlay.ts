/**
 * Visual Overlay Module
 * Handles transparent overlay windows for cursor, highlights, and click effects
 */

import {
  CursorStyle,
  HighlightOptions,
  ClickEffectOptions,
  OverlayState,
  Rectangle,
  Point,
  VisualError,
} from './types.js';

// ============================================================================
// Electron API Abstraction (for testing)
// ============================================================================

export interface ElectronBrowserWindow {
  id: number;
  show(): void;
  hide(): void;
  close(): void;
  destroy(): void;
  isVisible(): boolean;
  isDestroyed(): boolean;
  setBounds(bounds: Rectangle): void;
  getBounds(): Rectangle;
  setAlwaysOnTop(flag: boolean, level?: string): void;
  setIgnoreMouseEvents(ignore: boolean, options?: { forward: boolean }): void;
  webContents: {
    send(channel: string, ...args: unknown[]): void;
    executeJavaScript(code: string): Promise<unknown>;
  };
}

export interface BrowserWindowConstructor {
  new (options: Record<string, unknown>): ElectronBrowserWindow;
}

// ============================================================================
// Module State
// ============================================================================

let BrowserWindowClass: BrowserWindowConstructor | null = null;

/**
 * Initialize the overlay module with Electron BrowserWindow
 */
export function initializeOverlay(windowClass: BrowserWindowConstructor): void {
  BrowserWindowClass = windowClass;
}

/**
 * Reset the overlay module (for testing)
 */
export function resetOverlay(): void {
  BrowserWindowClass = null;
}

/**
 * Check if overlay module is initialized
 */
export function isOverlayInitialized(): boolean {
  return BrowserWindowClass !== null;
}

// ============================================================================
// OverlayWindow Class
// ============================================================================

export class OverlayWindow {
  private window: ElectronBrowserWindow | null = null;
  private state: OverlayState = {
    isVisible: false,
    cursor: undefined,
    highlights: [],
    isAnimating: false,
  };
  private animationFrameId: ReturnType<typeof setTimeout> | null = null;

  constructor(private bounds?: Rectangle) {}

  /**
   * Initialize the overlay window
   */
  async initialize(): Promise<void> {
    if (!BrowserWindowClass) {
      throw new VisualError(
        'Overlay module not initialized. Call initializeOverlay first.',
        'OVERLAY_NOT_INITIALIZED'
      );
    }

    if (this.window && !this.window.isDestroyed()) {
      return; // Already initialized
    }

    const windowBounds = this.bounds || { x: 0, y: 0, width: 1920, height: 1080 };

    try {
      this.window = new BrowserWindowClass({
        x: windowBounds.x,
        y: windowBounds.y,
        width: windowBounds.width,
        height: windowBounds.height,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        focusable: false,
        hasShadow: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      this.window.setIgnoreMouseEvents(true, { forward: true });
      this.window.setAlwaysOnTop(true, 'screen-saver');

      // Load the overlay HTML
      await this.loadOverlayContent();
    } catch (error) {
      throw new VisualError(
        `Failed to create overlay window: ${error instanceof Error ? error.message : String(error)}`,
        'OVERLAY_WINDOW_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Show the overlay window
   */
  show(): void {
    this.ensureWindow();
    this.window!.show();
    this.state.isVisible = true;
  }

  /**
   * Hide the overlay window
   */
  hide(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide();
      this.state.isVisible = false;
    }
  }

  /**
   * Destroy the overlay window
   */
  destroy(): void {
    this.cancelAnimation();
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
    }
    this.window = null;
    this.state = {
      isVisible: false,
      cursor: undefined,
      highlights: [],
      isAnimating: false,
    };
  }

  /**
   * Get current overlay state
   */
  getState(): OverlayState {
    return { ...this.state };
  }

  /**
   * Check if overlay is visible
   */
  get isVisible(): boolean {
    return this.state.isVisible;
  }

  // ============================================================================
  // Cursor Methods
  // ============================================================================

  /**
   * Show the AI cursor at a position
   */
  showCursor(x: number, y: number, style: CursorStyle = 'default'): void {
    this.ensureWindow();

    this.state.cursor = {
      x,
      y,
      visible: true,
      style,
    };

    this.sendUpdate('cursor', this.state.cursor);
  }

  /**
   * Hide the AI cursor
   */
  hideCursor(): void {
    if (!this.window || this.window.isDestroyed()) {
      return;
    }

    this.state.cursor = undefined;
    this.sendUpdate('cursor', null);
  }

  /**
   * Animate cursor from one position to another
   */
  async animateCursor(
    from: Point,
    to: Point,
    duration: number = 300
  ): Promise<void> {
    this.ensureWindow();

    this.state.isAnimating = true;

    const startTime = Date.now();
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    return new Promise<void>((resolve) => {
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out cubic)
        const eased = 1 - Math.pow(1 - progress, 3);

        const currentX = from.x + dx * eased;
        const currentY = from.y + dy * eased;

        this.showCursor(currentX, currentY);

        if (progress < 1) {
          this.animationFrameId = setTimeout(animate, 16); // ~60fps
        } else {
          this.state.isAnimating = false;
          this.animationFrameId = null;
          resolve();
        }
      };

      animate();
    });
  }

  // ============================================================================
  // Highlight Methods
  // ============================================================================

  /**
   * Highlight an element with a bounding box
   */
  highlightElement(
    rect: Rectangle,
    color: string = '#00ff00',
    label?: string
  ): string {
    this.ensureWindow();

    const id = `highlight-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const highlight: HighlightOptions = {
      id,
      rect,
      color,
      label,
      borderWidth: 2,
      labelPosition: 'top',
    };

    this.state.highlights.push(highlight);
    this.sendUpdate('highlights', this.state.highlights);

    return id;
  }

  /**
   * Add a highlight with full options
   */
  addHighlight(options: HighlightOptions): string {
    this.ensureWindow();

    const id = options.id || `highlight-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const highlight: HighlightOptions = {
      ...options,
      id,
      color: options.color || '#00ff00',
      borderWidth: options.borderWidth || 2,
      labelPosition: options.labelPosition || 'top',
    };

    this.state.highlights.push(highlight);
    this.sendUpdate('highlights', this.state.highlights);

    return id;
  }

  /**
   * Remove a specific highlight
   */
  removeHighlight(id: string): boolean {
    const index = this.state.highlights.findIndex((h) => h.id === id);

    if (index === -1) {
      return false;
    }

    this.state.highlights.splice(index, 1);

    if (this.window && !this.window.isDestroyed()) {
      this.sendUpdate('highlights', this.state.highlights);
    }

    return true;
  }

  /**
   * Clear all highlights
   */
  clearHighlights(): void {
    this.state.highlights = [];

    if (this.window && !this.window.isDestroyed()) {
      this.sendUpdate('highlights', []);
    }
  }

  /**
   * Get all current highlights
   */
  getHighlights(): HighlightOptions[] {
    return [...this.state.highlights];
  }

  // ============================================================================
  // Click Effect Methods
  // ============================================================================

  /**
   * Show a click effect at a position
   */
  async showClickEffect(
    x: number,
    y: number,
    options?: Partial<ClickEffectOptions>
  ): Promise<void> {
    this.ensureWindow();

    const effect: ClickEffectOptions = {
      x,
      y,
      type: options?.type || 'ripple',
      color: options?.color || '#00ff00',
      duration: options?.duration || 300,
    };

    this.sendUpdate('clickEffect', effect);

    // Wait for animation to complete
    await this.sleep(effect.duration ?? 300);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private ensureWindow(): void {
    if (!this.window || this.window.isDestroyed()) {
      throw new VisualError(
        'Overlay window not initialized. Call initialize() first.',
        'OVERLAY_WINDOW_ERROR'
      );
    }
  }

  private sendUpdate(type: string, data: unknown): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('overlay-update', { type, data });
    }
  }

  private cancelAnimation(): void {
    if (this.animationFrameId) {
      clearTimeout(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.state.isAnimating = false;
  }

  private async loadOverlayContent(): Promise<void> {
    if (!this.window || this.window.isDestroyed()) {
      return;
    }

    // In a real implementation, this would load an HTML file
    // For testing, we just execute some setup JavaScript
    await this.window.webContents.executeJavaScript(`
      window.overlayState = {
        cursor: null,
        highlights: [],
        clickEffect: null
      };
      true;
    `);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new overlay window
 */
export function createOverlayWindow(bounds?: Rectangle): OverlayWindow {
  return new OverlayWindow(bounds);
}

// ============================================================================
// Singleton Instance
// ============================================================================

let defaultOverlay: OverlayWindow | null = null;

/**
 * Get the default overlay window
 */
export function getOverlayWindow(): OverlayWindow {
  if (!defaultOverlay) {
    defaultOverlay = new OverlayWindow();
  }
  return defaultOverlay;
}

/**
 * Reset the default overlay window (for testing)
 */
export function resetOverlayWindow(): void {
  if (defaultOverlay) {
    defaultOverlay.destroy();
    defaultOverlay = null;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Show AI cursor at position
 */
export function showCursor(x: number, y: number, style?: CursorStyle): void {
  getOverlayWindow().showCursor(x, y, style);
}

/**
 * Hide AI cursor
 */
export function hideCursor(): void {
  getOverlayWindow().hideCursor();
}

/**
 * Animate cursor movement
 */
export function animateCursor(from: Point, to: Point, duration?: number): Promise<void> {
  return getOverlayWindow().animateCursor(from, to, duration);
}

/**
 * Highlight an element
 */
export function highlightElement(rect: Rectangle, color?: string, label?: string): string {
  return getOverlayWindow().highlightElement(rect, color, label);
}

/**
 * Clear all highlights
 */
export function clearHighlights(): void {
  getOverlayWindow().clearHighlights();
}

/**
 * Show click effect
 */
export function showClickEffect(x: number, y: number, options?: Partial<ClickEffectOptions>): Promise<void> {
  return getOverlayWindow().showClickEffect(x, y, options);
}
