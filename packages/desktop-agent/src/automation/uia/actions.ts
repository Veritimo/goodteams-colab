/**
 * Input Actions for Windows UI Automation
 *
 * High-level functions for mouse clicks, keyboard input, and scrolling.
 */

import { getBindings, type UIABindings } from './bindings.js';
import {
  UIAError,
  type UIElement,
  type KeyModifier,
  type ScrollDirection,
} from './types.js';

/**
 * Input actions class with dependency injection support
 */
export class InputActions {
  private bindings: UIABindings;

  constructor(bindings?: UIABindings) {
    this.bindings = bindings ?? getBindings();
  }

  /**
   * Validate that an element is interactable
   */
  private validateElement(element: UIElement, operation: string): void {
    if (!element.isEnabled) {
      throw new UIAError(
        `Cannot ${operation}: element is disabled`,
        'ELEMENT_NOT_ENABLED',
        { automationId: element.automationId, name: element.name }
      );
    }
    if (element.isOffscreen) {
      throw new UIAError(
        `Cannot ${operation}: element is offscreen`,
        'ELEMENT_OFFSCREEN',
        { automationId: element.automationId, name: element.name }
      );
    }
  }

  /**
   * Left click at the center of an element
   *
   * @param element - The element to click
   * @returns True if successful
   */
  async click(element: UIElement): Promise<boolean> {
    this.validateElement(element, 'click');
    return this.bindings.click(element);
  }

  /**
   * Double-click at the center of an element
   *
   * @param element - The element to double-click
   * @returns True if successful
   */
  async doubleClick(element: UIElement): Promise<boolean> {
    this.validateElement(element, 'double-click');
    return this.bindings.doubleClick(element);
  }

  /**
   * Right-click (context menu) at the center of an element
   *
   * @param element - The element to right-click
   * @returns True if successful
   */
  async rightClick(element: UIElement): Promise<boolean> {
    this.validateElement(element, 'right-click');
    return this.bindings.rightClick(element);
  }

  /**
   * Click at specific screen coordinates
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   * @returns True if successful
   */
  async clickAt(x: number, y: number): Promise<boolean> {
    if (x < 0 || y < 0) {
      throw new UIAError('Coordinates must be non-negative', 'INVALID_ARGUMENT');
    }
    return this.bindings.clickAt(x, y);
  }

  /**
   * Type text using keyboard input
   *
   * @param text - The text to type
   * @returns True if successful
   */
  async type(text: string): Promise<boolean> {
    if (!text) {
      throw new UIAError('Text is required for type operation', 'INVALID_ARGUMENT');
    }
    return this.bindings.type(text);
  }

  /**
   * Focus an element and type text into it
   *
   * @param element - The element to type into
   * @param text - The text to type
   * @returns True if successful
   */
  async typeInElement(element: UIElement, text: string): Promise<boolean> {
    this.validateElement(element, 'type in');
    if (!text && text !== '') {
      throw new UIAError('Text is required for typeInElement operation', 'INVALID_ARGUMENT');
    }
    return this.bindings.typeInElement(element, text);
  }

  /**
   * Press a single key with optional modifiers
   *
   * @param key - The key to press (e.g., "Enter", "Tab", "a")
   * @param modifiers - Array of modifier keys to hold
   * @returns True if successful
   */
  async pressKey(key: string, modifiers?: KeyModifier[]): Promise<boolean> {
    if (!key) {
      throw new UIAError('Key is required for pressKey operation', 'INVALID_ARGUMENT');
    }
    return this.bindings.pressKey(key, modifiers);
  }

  /**
   * Scroll an element in a direction
   *
   * @param element - The element to scroll
   * @param direction - Scroll direction
   * @param amount - Amount to scroll (positive integer)
   * @returns True if successful
   */
  async scroll(element: UIElement, direction: ScrollDirection, amount: number): Promise<boolean> {
    if (amount <= 0) {
      throw new UIAError('Scroll amount must be positive', 'INVALID_ARGUMENT');
    }
    return this.bindings.scroll(element, direction, amount);
  }

  /**
   * Scroll an element up
   *
   * @param element - The element to scroll
   * @param amount - Amount to scroll (default: 3)
   * @returns True if successful
   */
  async scrollUp(element: UIElement, amount = 3): Promise<boolean> {
    return this.scroll(element, 'up', amount);
  }

  /**
   * Scroll an element down
   *
   * @param element - The element to scroll
   * @param amount - Amount to scroll (default: 3)
   * @returns True if successful
   */
  async scrollDown(element: UIElement, amount = 3): Promise<boolean> {
    return this.scroll(element, 'down', amount);
  }

  /**
   * Scroll an element left
   *
   * @param element - The element to scroll
   * @param amount - Amount to scroll (default: 3)
   * @returns True if successful
   */
  async scrollLeft(element: UIElement, amount = 3): Promise<boolean> {
    return this.scroll(element, 'left', amount);
  }

  /**
   * Scroll an element right
   *
   * @param element - The element to scroll
   * @param amount - Amount to scroll (default: 3)
   * @returns True if successful
   */
  async scrollRight(element: UIElement, amount = 3): Promise<boolean> {
    return this.scroll(element, 'right', amount);
  }

  // ========== Keyboard Shortcuts ==========

  /**
   * Press Enter key
   */
  async pressEnter(): Promise<boolean> {
    return this.pressKey('Enter');
  }

  /**
   * Press Tab key
   */
  async pressTab(): Promise<boolean> {
    return this.pressKey('Tab');
  }

  /**
   * Press Shift+Tab (reverse tab)
   */
  async pressShiftTab(): Promise<boolean> {
    return this.pressKey('Tab', ['shift']);
  }

  /**
   * Press Escape key
   */
  async pressEscape(): Promise<boolean> {
    return this.pressKey('Escape');
  }

  /**
   * Press Ctrl+A (select all)
   */
  async selectAll(): Promise<boolean> {
    return this.pressKey('a', ['ctrl']);
  }

  /**
   * Press Ctrl+C (copy)
   */
  async copy(): Promise<boolean> {
    return this.pressKey('c', ['ctrl']);
  }

  /**
   * Press Ctrl+V (paste)
   */
  async paste(): Promise<boolean> {
    return this.pressKey('v', ['ctrl']);
  }

  /**
   * Press Ctrl+X (cut)
   */
  async cut(): Promise<boolean> {
    return this.pressKey('x', ['ctrl']);
  }

  /**
   * Press Ctrl+Z (undo)
   */
  async undo(): Promise<boolean> {
    return this.pressKey('z', ['ctrl']);
  }

  /**
   * Press Ctrl+Y (redo)
   */
  async redo(): Promise<boolean> {
    return this.pressKey('y', ['ctrl']);
  }

  /**
   * Press Ctrl+S (save)
   */
  async save(): Promise<boolean> {
    return this.pressKey('s', ['ctrl']);
  }

  /**
   * Press Alt+F4 (close window)
   */
  async closeWindow(): Promise<boolean> {
    return this.pressKey('F4', ['alt']);
  }

  /**
   * Press F5 (refresh)
   */
  async refresh(): Promise<boolean> {
    return this.pressKey('F5');
  }

  /**
   * Press Delete key
   */
  async pressDelete(): Promise<boolean> {
    return this.pressKey('Delete');
  }

  /**
   * Press Backspace key
   */
  async pressBackspace(): Promise<boolean> {
    return this.pressKey('Backspace');
  }

  // ========== Complex Actions ==========

  /**
   * Clear a text field (select all and delete)
   *
   * @param element - The element to clear
   * @returns True if successful
   */
  async clearField(element: UIElement): Promise<boolean> {
    await this.click(element);
    await this.selectAll();
    return this.pressDelete();
  }

  /**
   * Clear a text field and type new text
   *
   * @param element - The element to fill
   * @param text - The text to type
   * @returns True if successful
   */
  async fillField(element: UIElement, text: string): Promise<boolean> {
    await this.clearField(element);
    return this.type(text);
  }

  /**
   * Click and hold (for drag operations - start)
   *
   * @param element - The element to click on
   * @returns True if successful
   */
  async clickAndHold(element: UIElement): Promise<boolean> {
    this.validateElement(element, 'click and hold');
    // This would need native implementation for true click-hold
    // For now, just do a click
    return this.click(element);
  }

  /**
   * Triple-click to select a line/paragraph
   *
   * @param element - The element to triple-click
   * @returns True if successful
   */
  async tripleClick(element: UIElement): Promise<boolean> {
    this.validateElement(element, 'triple-click');
    // Simulate triple-click with three rapid clicks
    await this.click(element);
    await this.click(element);
    return this.click(element);
  }

  /**
   * Type text with delay between characters (for visibility)
   *
   * @param text - The text to type
   * @param delayMs - Delay between characters in milliseconds (default: 50)
   * @returns True if successful
   */
  async typeSlowly(text: string, delayMs = 50): Promise<boolean> {
    for (const char of text) {
      await this.type(char);
      await this.sleep(delayMs);
    }
    return true;
  }

  /**
   * Press arrow keys for navigation
   *
   * @param direction - 'up', 'down', 'left', 'right'
   * @param count - Number of times to press (default: 1)
   * @returns True if successful
   */
  async pressArrow(direction: 'up' | 'down' | 'left' | 'right', count = 1): Promise<boolean> {
    const keyMap = {
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
    };
    const key = keyMap[direction];

    for (let i = 0; i < count; i++) {
      await this.pressKey(key);
    }
    return true;
  }

  /**
   * Press Home key
   */
  async pressHome(): Promise<boolean> {
    return this.pressKey('Home');
  }

  /**
   * Press End key
   */
  async pressEnd(): Promise<boolean> {
    return this.pressKey('End');
  }

  /**
   * Press Ctrl+Home (go to beginning)
   */
  async goToBeginning(): Promise<boolean> {
    return this.pressKey('Home', ['ctrl']);
  }

  /**
   * Press Ctrl+End (go to end)
   */
  async goToEnd(): Promise<boolean> {
    return this.pressKey('End', ['ctrl']);
  }

  /**
   * Press Page Up
   */
  async pageUp(): Promise<boolean> {
    return this.pressKey('PageUp');
  }

  /**
   * Press Page Down
   */
  async pageDown(): Promise<boolean> {
    return this.pressKey('PageDown');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Default instance using global bindings
const defaultActions = new InputActions();

// Export convenience functions
export const click = (element: UIElement) => defaultActions.click(element);
export const doubleClick = (element: UIElement) => defaultActions.doubleClick(element);
export const rightClick = (element: UIElement) => defaultActions.rightClick(element);
export const clickAt = (x: number, y: number) => defaultActions.clickAt(x, y);
export const type = (text: string) => defaultActions.type(text);
export const typeInElement = (element: UIElement, text: string) => defaultActions.typeInElement(element, text);
export const pressKey = (key: string, modifiers?: KeyModifier[]) => defaultActions.pressKey(key, modifiers);
export const scroll = (element: UIElement, direction: ScrollDirection, amount: number) =>
  defaultActions.scroll(element, direction, amount);
export const scrollUp = (element: UIElement, amount?: number) => defaultActions.scrollUp(element, amount);
export const scrollDown = (element: UIElement, amount?: number) => defaultActions.scrollDown(element, amount);
export const scrollLeft = (element: UIElement, amount?: number) => defaultActions.scrollLeft(element, amount);
export const scrollRight = (element: UIElement, amount?: number) => defaultActions.scrollRight(element, amount);
export const pressEnter = () => defaultActions.pressEnter();
export const pressTab = () => defaultActions.pressTab();
export const pressShiftTab = () => defaultActions.pressShiftTab();
export const pressEscape = () => defaultActions.pressEscape();
export const selectAll = () => defaultActions.selectAll();
export const copy = () => defaultActions.copy();
export const paste = () => defaultActions.paste();
export const cut = () => defaultActions.cut();
export const undo = () => defaultActions.undo();
export const redo = () => defaultActions.redo();
export const save = () => defaultActions.save();
export const closeWindow = () => defaultActions.closeWindow();
export const refresh = () => defaultActions.refresh();
export const pressDelete = () => defaultActions.pressDelete();
export const pressBackspace = () => defaultActions.pressBackspace();
export const clearField = (element: UIElement) => defaultActions.clearField(element);
export const fillField = (element: UIElement, text: string) => defaultActions.fillField(element, text);
export const tripleClick = (element: UIElement) => defaultActions.tripleClick(element);
export const typeSlowly = (text: string, delayMs?: number) => defaultActions.typeSlowly(text, delayMs);
export const pressArrow = (direction: 'up' | 'down' | 'left' | 'right', count?: number) =>
  defaultActions.pressArrow(direction, count);
export const pressHome = () => defaultActions.pressHome();
export const pressEnd = () => defaultActions.pressEnd();
export const goToBeginning = () => defaultActions.goToBeginning();
export const goToEnd = () => defaultActions.goToEnd();
export const pageUp = () => defaultActions.pageUp();
export const pageDown = () => defaultActions.pageDown();
