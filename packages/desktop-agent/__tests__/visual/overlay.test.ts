/**
 * Overlay Module Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initializeOverlay,
  resetOverlay,
  isOverlayInitialized,
  OverlayWindow,
  createOverlayWindow,
  getOverlayWindow,
  resetOverlayWindow,
  BrowserWindowConstructor,
  ElectronBrowserWindow,
} from '../../src/visual/overlay.js';
import { VisualError, Rectangle } from '../../src/visual/types.js';

// ============================================================================
// Mock Electron BrowserWindow
// ============================================================================

function createMockBrowserWindow(): ElectronBrowserWindow {
  return {
    id: 1,
    show: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
    destroy: vi.fn(),
    isVisible: vi.fn(() => true),
    isDestroyed: vi.fn(() => false),
    setBounds: vi.fn(),
    getBounds: vi.fn(() => ({ x: 0, y: 0, width: 1920, height: 1080 })),
    setAlwaysOnTop: vi.fn(),
    setIgnoreMouseEvents: vi.fn(),
    webContents: {
      send: vi.fn(),
      executeJavaScript: vi.fn(async () => true),
    },
  };
}

function createMockBrowserWindowClass(): BrowserWindowConstructor {
  return vi.fn(() => createMockBrowserWindow()) as unknown as BrowserWindowConstructor;
}

// ============================================================================
// Tests
// ============================================================================

describe('Overlay Module', () => {
  let MockBrowserWindow: BrowserWindowConstructor;

  beforeEach(() => {
    MockBrowserWindow = createMockBrowserWindowClass();
    resetOverlay();
  });

  afterEach(() => {
    resetOverlay();
    resetOverlayWindow();
  });

  describe('Initialization', () => {
    it('should not be initialized by default', () => {
      expect(isOverlayInitialized()).toBe(false);
    });

    it('should initialize with BrowserWindow class', () => {
      initializeOverlay(MockBrowserWindow);
      expect(isOverlayInitialized()).toBe(true);
    });

    it('should reset initialization', () => {
      initializeOverlay(MockBrowserWindow);
      expect(isOverlayInitialized()).toBe(true);
      resetOverlay();
      expect(isOverlayInitialized()).toBe(false);
    });
  });

  describe('OverlayWindow', () => {
    beforeEach(() => {
      initializeOverlay(MockBrowserWindow);
    });

    it('should create overlay window', async () => {
      const overlay = createOverlayWindow();
      await overlay.initialize();

      expect(MockBrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          frame: false,
          transparent: true,
          alwaysOnTop: true,
        })
      );
    });

    it('should create with custom bounds', async () => {
      const bounds: Rectangle = { x: 100, y: 100, width: 800, height: 600 };
      const overlay = createOverlayWindow(bounds);
      await overlay.initialize();

      expect(MockBrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          x: 100,
          y: 100,
          width: 800,
          height: 600,
        })
      );
    });

    it('should throw when not initialized', async () => {
      resetOverlay();
      const overlay = createOverlayWindow();

      await expect(overlay.initialize()).rejects.toThrow(VisualError);
      await expect(overlay.initialize()).rejects.toHaveProperty(
        'code',
        'OVERLAY_NOT_INITIALIZED'
      );
    });

    it('should show overlay window', async () => {
      const overlay = createOverlayWindow();
      await overlay.initialize();

      overlay.show();

      expect(overlay.isVisible).toBe(true);
    });

    it('should hide overlay window', async () => {
      const overlay = createOverlayWindow();
      await overlay.initialize();
      overlay.show();

      overlay.hide();

      expect(overlay.isVisible).toBe(false);
    });

    it('should destroy overlay window', async () => {
      const overlay = createOverlayWindow();
      await overlay.initialize();
      overlay.show();

      overlay.destroy();

      const state = overlay.getState();
      expect(state.isVisible).toBe(false);
    });
  });

  describe('Cursor Methods', () => {
    let overlay: OverlayWindow;

    beforeEach(async () => {
      initializeOverlay(MockBrowserWindow);
      overlay = createOverlayWindow();
      await overlay.initialize();
    });

    it('should show cursor at position', () => {
      overlay.showCursor(100, 200);

      const state = overlay.getState();
      expect(state.cursor).toEqual({
        x: 100,
        y: 200,
        visible: true,
        style: 'default',
      });
    });

    it('should show cursor with style', () => {
      overlay.showCursor(100, 200, 'pointer');

      const state = overlay.getState();
      expect(state.cursor?.style).toBe('pointer');
    });

    it('should hide cursor', () => {
      overlay.showCursor(100, 200);
      overlay.hideCursor();

      const state = overlay.getState();
      expect(state.cursor).toBeUndefined();
    });

    it('should animate cursor', async () => {
      vi.useFakeTimers();

      const promise = overlay.animateCursor(
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        100
      );

      const state = overlay.getState();
      expect(state.isAnimating).toBe(true);

      // Advance time to complete animation
      await vi.advanceTimersByTimeAsync(150);
      await promise;

      const finalState = overlay.getState();
      expect(finalState.isAnimating).toBe(false);
      expect(finalState.cursor?.x).toBe(100);
      expect(finalState.cursor?.y).toBe(100);

      vi.useRealTimers();
    });

    it('should throw when showing cursor without initialization', async () => {
      const uninitializedOverlay = createOverlayWindow();

      expect(() => uninitializedOverlay.showCursor(100, 200)).toThrow(VisualError);
    });
  });

  describe('Highlight Methods', () => {
    let overlay: OverlayWindow;

    beforeEach(async () => {
      initializeOverlay(MockBrowserWindow);
      overlay = createOverlayWindow();
      await overlay.initialize();
    });

    it('should add highlight', () => {
      const id = overlay.highlightElement(
        { x: 100, y: 100, width: 200, height: 50 },
        '#ff0000',
        'Test Element'
      );

      expect(id).toBeDefined();
      expect(id).toMatch(/^highlight-/);

      const highlights = overlay.getHighlights();
      expect(highlights).toHaveLength(1);
      expect(highlights[0]).toMatchObject({
        rect: { x: 100, y: 100, width: 200, height: 50 },
        color: '#ff0000',
        label: 'Test Element',
      });
    });

    it('should add highlight with options', () => {
      const id = overlay.addHighlight({
        rect: { x: 50, y: 50, width: 100, height: 100 },
        color: '#00ff00',
        borderWidth: 3,
        pulse: true,
      });

      const highlights = overlay.getHighlights();
      expect(highlights[0]).toMatchObject({
        id,
        color: '#00ff00',
        borderWidth: 3,
        pulse: true,
      });
    });

    it('should remove highlight by id', () => {
      const id = overlay.highlightElement({ x: 0, y: 0, width: 100, height: 100 });

      const removed = overlay.removeHighlight(id);
      expect(removed).toBe(true);

      const highlights = overlay.getHighlights();
      expect(highlights).toHaveLength(0);
    });

    it('should return false when removing non-existent highlight', () => {
      const removed = overlay.removeHighlight('non-existent-id');
      expect(removed).toBe(false);
    });

    it('should clear all highlights', () => {
      overlay.highlightElement({ x: 0, y: 0, width: 100, height: 100 });
      overlay.highlightElement({ x: 200, y: 0, width: 100, height: 100 });
      overlay.highlightElement({ x: 400, y: 0, width: 100, height: 100 });

      expect(overlay.getHighlights()).toHaveLength(3);

      overlay.clearHighlights();

      expect(overlay.getHighlights()).toHaveLength(0);
    });

    it('should support multiple highlights', () => {
      overlay.highlightElement({ x: 0, y: 0, width: 100, height: 100 });
      overlay.highlightElement({ x: 200, y: 0, width: 100, height: 100 });

      const highlights = overlay.getHighlights();
      expect(highlights).toHaveLength(2);
    });
  });

  describe('Click Effect', () => {
    let overlay: OverlayWindow;

    beforeEach(async () => {
      initializeOverlay(MockBrowserWindow);
      overlay = createOverlayWindow();
      await overlay.initialize();
    });

    it('should show click effect', async () => {
      vi.useFakeTimers();

      const promise = overlay.showClickEffect(150, 250);

      // Advance time to complete effect
      await vi.advanceTimersByTimeAsync(400);
      await promise;

      vi.useRealTimers();
    });

    it('should show click effect with options', async () => {
      vi.useFakeTimers();

      const promise = overlay.showClickEffect(150, 250, {
        type: 'ring',
        color: '#ff00ff',
        duration: 500,
      });

      await vi.advanceTimersByTimeAsync(600);
      await promise;

      vi.useRealTimers();
    });
  });

  describe('State Management', () => {
    let overlay: OverlayWindow;

    beforeEach(async () => {
      initializeOverlay(MockBrowserWindow);
      overlay = createOverlayWindow();
      await overlay.initialize();
    });

    it('should return complete state', () => {
      overlay.show();
      overlay.showCursor(100, 100);
      overlay.highlightElement({ x: 0, y: 0, width: 50, height: 50 });

      const state = overlay.getState();

      expect(state.isVisible).toBe(true);
      expect(state.cursor).toBeDefined();
      expect(state.highlights).toHaveLength(1);
      expect(state.isAnimating).toBe(false);
    });

    it('should return state copy (immutable)', () => {
      const state1 = overlay.getState();
      state1.isVisible = false; // Mutate the copy

      const state2 = overlay.getState();
      expect(state2.isVisible).toBe(overlay.isVisible); // Original unchanged
    });
  });

  describe('Singleton and Factory', () => {
    beforeEach(() => {
      initializeOverlay(MockBrowserWindow);
    });

    it('should create new instance with factory', () => {
      const overlay1 = createOverlayWindow();
      const overlay2 = createOverlayWindow();

      expect(overlay1).not.toBe(overlay2);
    });

    it('should return same instance from singleton', () => {
      const singleton1 = getOverlayWindow();
      const singleton2 = getOverlayWindow();

      expect(singleton1).toBe(singleton2);
    });

    it('should reset singleton', () => {
      const singleton1 = getOverlayWindow();
      resetOverlayWindow();
      const singleton2 = getOverlayWindow();

      expect(singleton1).not.toBe(singleton2);
    });
  });
});
