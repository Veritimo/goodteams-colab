/**
 * Toast Module Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ToastManager,
  createToastManager,
  getToastManager,
  resetToastManager,
  ToastRenderer,
} from '../../src/visual/toast.js';
import { Toast, ToastOptions } from '../../src/visual/types.js';

// ============================================================================
// Mock Toast Renderer
// ============================================================================

function createMockRenderer(): ToastRenderer {
  return {
    show: vi.fn(),
    hide: vi.fn(),
    update: vi.fn(),
    clear: vi.fn(),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('ToastManager', () => {
  let manager: ToastManager;
  let mockRenderer: ToastRenderer;

  beforeEach(() => {
    vi.useFakeTimers();
    mockRenderer = createMockRenderer();
    manager = createToastManager({ renderer: mockRenderer });
  });

  afterEach(() => {
    vi.useRealTimers();
    manager.dismissAll();
    resetToastManager();
  });

  describe('showToast', () => {
    it('should show a basic toast', () => {
      const id = manager.showToast('Hello World');

      expect(id).toBeDefined();
      expect(id).toMatch(/^toast-/);
      expect(mockRenderer.show).toHaveBeenCalled();
    });

    it('should show toast with custom options', () => {
      const id = manager.showToast('Custom Toast', {
        type: 'success',
        duration: 5000,
        position: 'top-center',
        icon: '🎉',
      });

      const toast = manager.getToast(id);
      expect(toast).toBeDefined();
      expect(toast?.options.type).toBe('success');
      expect(toast?.options.duration).toBe(5000);
      expect(toast?.options.position).toBe('top-center');
      expect(toast?.options.icon).toBe('🎉');
    });

    it('should use default values for missing options', () => {
      const id = manager.showToast('Default Toast');

      const toast = manager.getToast(id);
      expect(toast?.options.type).toBe('info');
      expect(toast?.options.position).toBe('bottom-right');
      expect(toast?.options.dismissible).toBe(true);
    });

    it('should accept custom toast ID', () => {
      const id = manager.showToast('Custom ID Toast', { id: 'my-custom-id' });

      expect(id).toBe('my-custom-id');
      expect(manager.hasToast('my-custom-id')).toBe(true);
    });

    it('should set expiration time', () => {
      const now = Date.now();
      const id = manager.showToast('Expiring Toast', { duration: 3000 });

      const toast = manager.getToast(id);
      expect(toast?.createdAt).toBe(now);
      expect(toast?.expiresAt).toBe(now + 3000);
    });

    it('should not set expiration for persistent toast', () => {
      const id = manager.showToast('Persistent Toast', { duration: 0 });

      const toast = manager.getToast(id);
      expect(toast?.expiresAt).toBe(0);
    });
  });

  describe('showActionToast', () => {
    it('should show action toast with action and target', () => {
      const id = manager.showActionToast({
        action: 'Clicking',
        target: 'Save button',
      });

      const toast = manager.getToast(id);
      expect(toast?.options.message).toBe('Clicking Save button');
      expect(toast?.options.type).toBe('action');
    });

    it('should include details when provided', () => {
      const id = manager.showActionToast({
        action: 'Typing',
        target: 'Search field',
        details: 'Hello World',
      });

      const toast = manager.getToast(id);
      expect(toast?.options.message).toBe('Typing Search field - Hello World');
    });

    it('should use action-specific icon', () => {
      const clickId = manager.showActionToast({ action: 'Clicking', target: 'button' });
      const typeId = manager.showActionToast({ action: 'Typing', target: 'field' });
      const scrollId = manager.showActionToast({ action: 'Scrolling', target: 'page' });

      expect(manager.getToast(clickId)?.options.icon).toBe('👆');
      expect(manager.getToast(typeId)?.options.icon).toBe('⌨️');
      expect(manager.getToast(scrollId)?.options.icon).toBe('📜');
    });
  });

  describe('showProgressToast', () => {
    it('should show progress toast', () => {
      const id = manager.showProgressToast({
        message: 'Processing...',
        progress: 50,
      });

      const toast = manager.getToast(id);
      expect(toast?.options.type).toBe('progress');
      expect(toast?.options.progress).toBe(50);
      expect(toast?.options.duration).toBe(0); // Persistent
      expect(toast?.options.dismissible).toBe(false);
    });

    it('should handle indeterminate progress', () => {
      const id = manager.showProgressToast({
        message: 'Loading...',
        progress: 0,
        indeterminate: true,
      });

      const toast = manager.getToast(id);
      expect(toast?.options.progress).toBe(-1);
    });
  });

  describe('updateToast', () => {
    it('should update toast options', () => {
      const id = manager.showToast('Original Message');

      const result = manager.updateToast(id, { message: 'Updated Message' });

      expect(result).toBe(true);
      expect(manager.getToast(id)?.options.message).toBe('Updated Message');
      expect(mockRenderer.update).toHaveBeenCalledWith(id, { message: 'Updated Message' });
    });

    it('should return false for non-existent toast', () => {
      const result = manager.updateToast('non-existent', { message: 'Test' });
      expect(result).toBe(false);
    });

    it('should reset timer when duration updated', () => {
      const id = manager.showToast('Toast', { duration: 1000 });

      // Advance time partially
      vi.advanceTimersByTime(500);

      // Update duration
      manager.updateToast(id, { duration: 2000 });

      // Advance past original duration
      vi.advanceTimersByTime(1500);

      // Toast should still exist (new timer)
      expect(manager.hasToast(id)).toBe(true);

      // Advance to expire new duration
      vi.advanceTimersByTime(1000);

      expect(manager.hasToast(id)).toBe(false);
    });
  });

  describe('updateProgress', () => {
    it('should update progress value', () => {
      const id = manager.showProgressToast({ message: 'Loading', progress: 0 });

      manager.updateProgress(id, 75);

      expect(manager.getToast(id)?.options.progress).toBe(75);
    });

    it('should update progress and message', () => {
      const id = manager.showProgressToast({ message: 'Step 1', progress: 0 });

      manager.updateProgress(id, 50, 'Step 2');

      const toast = manager.getToast(id);
      expect(toast?.options.progress).toBe(50);
      expect(toast?.options.message).toBe('Step 2');
    });
  });

  describe('dismissToast', () => {
    it('should dismiss visible toast', () => {
      const id = manager.showToast('To Be Dismissed');

      const result = manager.dismissToast(id);

      expect(result).toBe(true);
      expect(manager.hasToast(id)).toBe(false);
      expect(mockRenderer.hide).toHaveBeenCalledWith(id);
    });

    it('should return false for non-existent toast', () => {
      const result = manager.dismissToast('non-existent');
      expect(result).toBe(false);
    });

    it('should dismiss queued toast', () => {
      // Fill up visible toasts
      const smallManager = createToastManager({ maxVisible: 1, renderer: mockRenderer });
      smallManager.showToast('Visible Toast', { duration: 10000 });
      const queuedId = smallManager.showToast('Queued Toast');

      // Queued toast should not be visible
      expect(smallManager.getQueueLength()).toBe(1);

      // Dismiss queued toast
      const result = smallManager.dismissToast(queuedId);

      expect(result).toBe(true);
      expect(smallManager.getQueueLength()).toBe(0);
    });
  });

  describe('dismissAll', () => {
    it('should dismiss all visible toasts', () => {
      manager.showToast('Toast 1');
      manager.showToast('Toast 2');
      manager.showToast('Toast 3');

      expect(manager.getActiveToasts()).toHaveLength(3);

      manager.dismissAll();

      expect(manager.getActiveToasts()).toHaveLength(0);
      expect(mockRenderer.clear).toHaveBeenCalled();
    });

    it('should clear queued toasts', () => {
      const smallManager = createToastManager({ maxVisible: 1, renderer: mockRenderer });
      smallManager.showToast('Visible');
      smallManager.showToast('Queued 1');
      smallManager.showToast('Queued 2');

      expect(smallManager.getQueueLength()).toBe(2);

      smallManager.dismissAll();

      expect(smallManager.getQueueLength()).toBe(0);
    });
  });

  describe('Auto-dismiss', () => {
    it('should auto-dismiss after duration', () => {
      const id = manager.showToast('Auto Dismiss', { duration: 3000 });

      expect(manager.hasToast(id)).toBe(true);

      vi.advanceTimersByTime(3000);

      expect(manager.hasToast(id)).toBe(false);
      expect(mockRenderer.hide).toHaveBeenCalledWith(id);
    });

    it('should not auto-dismiss persistent toast', () => {
      const id = manager.showToast('Persistent', { duration: 0 });

      vi.advanceTimersByTime(60000); // 1 minute

      expect(manager.hasToast(id)).toBe(true);
    });
  });

  describe('Queue Management', () => {
    it('should queue toasts when max visible reached', () => {
      const smallManager = createToastManager({ maxVisible: 2, renderer: mockRenderer });

      smallManager.showToast('Toast 1', { duration: 10000 });
      smallManager.showToast('Toast 2', { duration: 10000 });
      smallManager.showToast('Toast 3', { duration: 10000 });

      expect(smallManager.getActiveToasts()).toHaveLength(2);
      expect(smallManager.getQueueLength()).toBe(1);
    });

    it('should show queued toast when space available', () => {
      const smallManager = createToastManager({ maxVisible: 1, renderer: mockRenderer });

      smallManager.showToast('Toast 1', { duration: 1000 });
      const queuedId = smallManager.showToast('Toast 2', { duration: 5000 });

      expect(smallManager.getActiveToasts()).toHaveLength(1);
      expect(smallManager.getQueueLength()).toBe(1);

      // Advance time to dismiss first toast
      vi.advanceTimersByTime(1000);

      // Queued toast should now be visible
      expect(smallManager.getActiveToasts()).toHaveLength(1);
      expect(smallManager.getQueueLength()).toBe(0);
      expect(smallManager.getToast(queuedId)?.state).toBe('visible');
    });
  });

  describe('getActiveToasts', () => {
    it('should return all active toasts', () => {
      manager.showToast('Toast 1');
      manager.showToast('Toast 2');

      const toasts = manager.getActiveToasts();

      expect(toasts).toHaveLength(2);
      expect(toasts[0].options.message).toBe('Toast 1');
      expect(toasts[1].options.message).toBe('Toast 2');
    });

    it('should return empty array when no toasts', () => {
      expect(manager.getActiveToasts()).toHaveLength(0);
    });
  });

  describe('Singleton and Factory', () => {
    it('should create new instance with factory', () => {
      const manager1 = createToastManager();
      const manager2 = createToastManager();

      expect(manager1).not.toBe(manager2);
    });

    it('should return same instance from singleton', () => {
      const singleton1 = getToastManager();
      const singleton2 = getToastManager();

      expect(singleton1).toBe(singleton2);
    });

    it('should reset singleton', () => {
      const singleton1 = getToastManager();
      resetToastManager();
      const singleton2 = getToastManager();

      expect(singleton1).not.toBe(singleton2);
    });
  });
});
