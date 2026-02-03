/**
 * Toast Notification Module
 * Handles action notifications and progress indicators for AI actions
 */

import {
  Toast,
  ToastOptions,
  ToastType,
  ToastPosition,
  ActionToastOptions,
  ProgressToastOptions,
} from './types.js';

// ============================================================================
// Toast Renderer Interface (for testing)
// ============================================================================

export interface ToastRenderer {
  show(toast: Toast): void;
  hide(id: string): void;
  update(id: string, updates: Partial<ToastOptions>): void;
  clear(): void;
}

// ============================================================================
// ToastManager Class
// ============================================================================

export class ToastManager {
  private toasts: Map<string, Toast> = new Map();
  private queue: Toast[] = [];
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private renderer: ToastRenderer | null = null;
  private maxVisible: number = 3;
  private defaultPosition: ToastPosition = 'bottom-right';
  private defaultDuration: number = 3000;

  constructor(options?: {
    maxVisible?: number;
    defaultPosition?: ToastPosition;
    defaultDuration?: number;
    renderer?: ToastRenderer;
  }) {
    if (options) {
      this.maxVisible = options.maxVisible ?? this.maxVisible;
      this.defaultPosition = options.defaultPosition ?? this.defaultPosition;
      this.defaultDuration = options.defaultDuration ?? this.defaultDuration;
      this.renderer = options.renderer ?? null;
    }
  }

  /**
   * Set the toast renderer
   */
  setRenderer(renderer: ToastRenderer): void {
    this.renderer = renderer;
  }

  /**
   * Show a toast notification
   */
  showToast(message: string, options?: Partial<ToastOptions>): string {
    const id = options?.id || this.generateId();

    const fullOptions: Required<ToastOptions> = {
      id,
      message,
      type: options?.type ?? 'info',
      duration: options?.duration ?? this.defaultDuration,
      position: options?.position ?? this.defaultPosition,
      icon: options?.icon ?? this.getDefaultIcon(options?.type ?? 'info'),
      progress: options?.progress ?? 0,
      dismissible: options?.dismissible ?? true,
    };

    const now = Date.now();
    const toast: Toast = {
      id,
      options: fullOptions,
      createdAt: now,
      expiresAt: fullOptions.duration > 0 ? now + fullOptions.duration : 0,
      state: 'showing',
    };

    // Check if we need to queue
    if (this.toasts.size >= this.maxVisible) {
      this.queue.push(toast);
      return id;
    }

    this.displayToast(toast);
    return id;
  }

  /**
   * Show an action toast (e.g., "Clicking on [Save button]")
   */
  showActionToast(options: ActionToastOptions): string {
    const { action, target, details } = options;

    let message = `${action} ${target}`;
    if (details) {
      message += ` - ${details}`;
    }

    return this.showToast(message, {
      type: 'action',
      icon: this.getActionIcon(action),
      duration: 2000, // Shorter duration for action toasts
    });
  }

  /**
   * Show a progress toast
   */
  showProgressToast(options: ProgressToastOptions): string {
    const { message, progress, indeterminate } = options;

    return this.showToast(message, {
      type: 'progress',
      progress: indeterminate ? -1 : progress,
      duration: 0, // Persistent until manually dismissed
      dismissible: false,
    });
  }

  /**
   * Update an existing toast
   */
  updateToast(id: string, updates: Partial<ToastOptions>): boolean {
    const toast = this.toasts.get(id);
    if (!toast) {
      return false;
    }

    // Update options
    Object.assign(toast.options, updates);

    // Update expiration if duration changed
    if (updates.duration !== undefined) {
      if (updates.duration > 0) {
        toast.expiresAt = Date.now() + updates.duration;
        this.resetTimer(id, updates.duration);
      } else {
        toast.expiresAt = 0;
        this.clearTimer(id);
      }
    }

    // Notify renderer
    this.renderer?.update(id, updates);

    return true;
  }

  /**
   * Update progress on a progress toast
   */
  updateProgress(id: string, progress: number, message?: string): boolean {
    const updates: Partial<ToastOptions> = { progress };
    if (message !== undefined) {
      updates.message = message;
    }
    return this.updateToast(id, updates);
  }

  /**
   * Dismiss a specific toast
   */
  dismissToast(id: string): boolean {
    const toast = this.toasts.get(id);
    if (!toast) {
      // Check queue
      const queueIndex = this.queue.findIndex((t) => t.id === id);
      if (queueIndex !== -1) {
        this.queue.splice(queueIndex, 1);
        return true;
      }
      return false;
    }

    this.hideToast(id);
    return true;
  }

  /**
   * Dismiss all toasts
   */
  dismissAll(): void {
    // Clear timers
    for (const [id] of this.timers) {
      this.clearTimer(id);
    }

    // Hide all visible toasts
    for (const [id] of this.toasts) {
      this.renderer?.hide(id);
    }

    // Clear state
    this.toasts.clear();
    this.queue = [];
    this.renderer?.clear();
  }

  /**
   * Get all active toasts
   */
  getActiveToasts(): Toast[] {
    return Array.from(this.toasts.values());
  }

  /**
   * Get a specific toast by ID
   */
  getToast(id: string): Toast | undefined {
    return this.toasts.get(id);
  }

  /**
   * Get queued toast count
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Check if a toast exists
   */
  hasToast(id: string): boolean {
    return this.toasts.has(id) || this.queue.some((t) => t.id === id);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private displayToast(toast: Toast): void {
    this.toasts.set(toast.id, toast);
    toast.state = 'visible';

    // Notify renderer
    this.renderer?.show(toast);

    // Set auto-dismiss timer if duration > 0
    if (toast.options.duration > 0) {
      this.setTimer(toast.id, toast.options.duration);
    }
  }

  private hideToast(id: string): void {
    const toast = this.toasts.get(id);
    if (!toast) {
      return;
    }

    toast.state = 'hiding';
    this.clearTimer(id);

    // Notify renderer
    this.renderer?.hide(id);

    // Remove from active toasts
    this.toasts.delete(id);

    // Show next queued toast
    this.processQueue();
  }

  private processQueue(): void {
    if (this.queue.length === 0 || this.toasts.size >= this.maxVisible) {
      return;
    }

    const next = this.queue.shift();
    if (next) {
      this.displayToast(next);
    }
  }

  private setTimer(id: string, duration: number): void {
    this.clearTimer(id);

    const timer = setTimeout(() => {
      this.hideToast(id);
    }, duration);

    this.timers.set(id, timer);
  }

  private resetTimer(id: string, duration: number): void {
    this.setTimer(id, duration);
  }

  private clearTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  private generateId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private getDefaultIcon(type: ToastType): string {
    switch (type) {
      case 'info':
        return 'ℹ️';
      case 'action':
        return '🤖';
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'progress':
        return '⏳';
      default:
        return 'ℹ️';
    }
  }

  private getActionIcon(action: string): string {
    const lowerAction = action.toLowerCase();

    if (lowerAction.includes('click')) return '👆';
    if (lowerAction.includes('type') || lowerAction.includes('typing')) return '⌨️';
    if (lowerAction.includes('scroll')) return '📜';
    if (lowerAction.includes('drag')) return '✋';
    if (lowerAction.includes('select')) return '☑️';
    if (lowerAction.includes('wait')) return '⏳';
    if (lowerAction.includes('read')) return '👀';
    if (lowerAction.includes('open')) return '📂';
    if (lowerAction.includes('close')) return '❎';
    if (lowerAction.includes('save')) return '💾';

    return '🤖';
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new ToastManager instance
 */
export function createToastManager(options?: {
  maxVisible?: number;
  defaultPosition?: ToastPosition;
  defaultDuration?: number;
  renderer?: ToastRenderer;
}): ToastManager {
  return new ToastManager(options);
}

// ============================================================================
// Singleton Instance
// ============================================================================

let defaultToastManager: ToastManager | null = null;

/**
 * Get the default ToastManager instance
 */
export function getToastManager(): ToastManager {
  if (!defaultToastManager) {
    defaultToastManager = new ToastManager();
  }
  return defaultToastManager;
}

/**
 * Reset the default ToastManager (for testing)
 */
export function resetToastManager(): void {
  if (defaultToastManager) {
    defaultToastManager.dismissAll();
  }
  defaultToastManager = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Show a toast notification
 */
export function showToast(message: string, options?: Partial<ToastOptions>): string {
  return getToastManager().showToast(message, options);
}

/**
 * Show an action toast
 */
export function showActionToast(action: string, target: string, details?: string): string {
  return getToastManager().showActionToast({ action, target, details });
}

/**
 * Show a progress toast
 */
export function showProgressToast(message: string, progress: number): string {
  return getToastManager().showProgressToast({ message, progress });
}

/**
 * Update toast progress
 */
export function updateProgress(id: string, progress: number, message?: string): boolean {
  return getToastManager().updateProgress(id, progress, message);
}

/**
 * Dismiss a toast
 */
export function dismissToast(id: string): boolean {
  return getToastManager().dismissToast(id);
}

/**
 * Dismiss all toasts
 */
export function dismissAll(): void {
  getToastManager().dismissAll();
}
