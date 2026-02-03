/**
 * UIA Control Patterns for Windows UI Automation
 *
 * High-level functions for working with UI Automation patterns:
 * - InvokePattern: Click/activate buttons
 * - ValuePattern: Get/set text values
 * - TogglePattern: Checkboxes, toggle buttons
 * - SelectionItemPattern: List/tree items
 * - ExpandCollapsePattern: Combo boxes, tree nodes
 */

import { getBindings, type UIABindings } from './bindings.js';
import {
  UIAError,
  type UIElement,
  type ToggleState,
  type ExpandCollapseState,
  type PatternResult,
} from './types.js';

/**
 * Pattern operations class with dependency injection support
 */
export class PatternOperations {
  private bindings: UIABindings;

  constructor(bindings?: UIABindings) {
    this.bindings = bindings ?? getBindings();
  }

  /**
   * Validate that an element is enabled
   */
  private validateEnabled(element: UIElement, operation: string): void {
    if (!element.isEnabled) {
      throw new UIAError(
        `Cannot ${operation}: element is disabled`,
        'ELEMENT_NOT_ENABLED',
        { automationId: element.automationId, name: element.name }
      );
    }
  }

  /**
   * Check if an element supports a specific pattern
   *
   * @param element - The element to check
   * @param pattern - The pattern name
   * @returns True if the pattern is supported
   */
  async supportsPattern(element: UIElement, pattern: string): Promise<boolean> {
    const patterns = await this.bindings.getSupportedPatterns(element);
    return patterns.includes(pattern);
  }

  /**
   * Ensure an element supports a pattern, throw if not.
   * This can be used for stricter validation before pattern operations.
   *
   * @param element - The element to check
   * @param pattern - The pattern name to verify
   * @throws UIAError if pattern is not supported
   */
  async ensurePatternSupported(element: UIElement, pattern: string): Promise<void> {
    const supported = await this.supportsPattern(element, pattern);
    if (!supported) {
      throw new UIAError(
        `Pattern '${pattern}' is not supported by this element`,
        'PATTERN_NOT_SUPPORTED',
        { automationId: element.automationId, controlType: element.controlType }
      );
    }
  }

  // ========== Invoke Pattern ==========

  /**
   * Invoke an element (like clicking a button)
   *
   * @param element - The element to invoke
   * @returns Result of the operation
   */
  async invoke(element: UIElement): Promise<PatternResult> {
    this.validateEnabled(element, 'invoke');

    try {
      const success = await this.bindings.invoke(element);
      return { success };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Invoke an element and throw on failure
   *
   * @param element - The element to invoke
   */
  async invokeOrThrow(element: UIElement): Promise<void> {
    const result = await this.invoke(element);
    if (!result.success) {
      throw new UIAError(
        `Failed to invoke element: ${result.error}`,
        'OPERATION_FAILED'
      );
    }
  }

  // ========== Value Pattern ==========

  /**
   * Set the value of a text element
   *
   * @param element - The element to set value on
   * @param value - The value to set
   * @returns Result of the operation
   */
  async setValue(element: UIElement, value: string): Promise<PatternResult> {
    this.validateEnabled(element, 'set value');

    try {
      const success = await this.bindings.setValue(element, value);
      return { success };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Set the value of a text element, throwing on failure
   *
   * @param element - The element to set value on
   * @param value - The value to set
   */
  async setValueOrThrow(element: UIElement, value: string): Promise<void> {
    const result = await this.setValue(element, value);
    if (!result.success) {
      throw new UIAError(
        `Failed to set value: ${result.error}`,
        'OPERATION_FAILED'
      );
    }
  }

  /**
   * Get the value of a text element
   *
   * @param element - The element to get value from
   * @returns Result with the value
   */
  async getValue(element: UIElement): Promise<PatternResult<string>> {
    try {
      const value = await this.bindings.getValue(element);
      return { success: true, value: value ?? '' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get the value of a text element, throwing on failure
   *
   * @param element - The element to get value from
   * @returns The value
   */
  async getValueOrThrow(element: UIElement): Promise<string> {
    const result = await this.getValue(element);
    if (!result.success) {
      throw new UIAError(
        `Failed to get value: ${result.error}`,
        'OPERATION_FAILED'
      );
    }
    return result.value ?? '';
  }

  // ========== Toggle Pattern ==========

  /**
   * Toggle a checkbox or toggle button
   *
   * @param element - The element to toggle
   * @returns Result of the operation
   */
  async toggle(element: UIElement): Promise<PatternResult> {
    this.validateEnabled(element, 'toggle');

    try {
      const success = await this.bindings.toggle(element);
      return { success };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Toggle an element, throwing on failure
   *
   * @param element - The element to toggle
   */
  async toggleOrThrow(element: UIElement): Promise<void> {
    const result = await this.toggle(element);
    if (!result.success) {
      throw new UIAError(
        `Failed to toggle element: ${result.error}`,
        'OPERATION_FAILED'
      );
    }
  }

  /**
   * Get the current toggle state
   *
   * @param element - The element to check
   * @returns Result with the toggle state
   */
  async getToggleState(element: UIElement): Promise<PatternResult<ToggleState>> {
    try {
      const state = await this.bindings.getToggleState(element);
      return { success: true, value: state ?? 'Off' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if a toggle element is currently "On"
   *
   * @param element - The element to check
   * @returns True if the toggle state is "On"
   */
  async isToggleOn(element: UIElement): Promise<boolean> {
    const result = await this.getToggleState(element);
    return result.success && result.value === 'On';
  }

  /**
   * Set toggle state to "On" (checks current state first)
   *
   * @param element - The element to set
   * @returns True if successful
   */
  async setToggleOn(element: UIElement): Promise<boolean> {
    const currentState = await this.getToggleState(element);
    if (currentState.success && currentState.value === 'On') {
      return true; // Already on
    }
    const result = await this.toggle(element);
    return result.success;
  }

  /**
   * Set toggle state to "Off" (checks current state first)
   *
   * @param element - The element to set
   * @returns True if successful
   */
  async setToggleOff(element: UIElement): Promise<boolean> {
    const currentState = await this.getToggleState(element);
    if (currentState.success && currentState.value === 'Off') {
      return true; // Already off
    }
    const result = await this.toggle(element);
    return result.success;
  }

  // ========== Selection Item Pattern ==========

  /**
   * Select an item (in a list, tree, combo box, etc.)
   *
   * @param element - The element to select
   * @returns Result of the operation
   */
  async select(element: UIElement): Promise<PatternResult> {
    this.validateEnabled(element, 'select');

    try {
      const success = await this.bindings.select(element);
      return { success };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Select an item, throwing on failure
   *
   * @param element - The element to select
   */
  async selectOrThrow(element: UIElement): Promise<void> {
    const result = await this.select(element);
    if (!result.success) {
      throw new UIAError(
        `Failed to select element: ${result.error}`,
        'OPERATION_FAILED'
      );
    }
  }

  // ========== Expand/Collapse Pattern ==========

  /**
   * Expand an element (combo box, tree node, etc.)
   *
   * @param element - The element to expand
   * @returns Result of the operation
   */
  async expand(element: UIElement): Promise<PatternResult> {
    this.validateEnabled(element, 'expand');

    try {
      const success = await this.bindings.expand(element);
      return { success };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Expand an element, throwing on failure
   *
   * @param element - The element to expand
   */
  async expandOrThrow(element: UIElement): Promise<void> {
    const result = await this.expand(element);
    if (!result.success) {
      throw new UIAError(
        `Failed to expand element: ${result.error}`,
        'OPERATION_FAILED'
      );
    }
  }

  /**
   * Collapse an element (combo box, tree node, etc.)
   *
   * @param element - The element to collapse
   * @returns Result of the operation
   */
  async collapse(element: UIElement): Promise<PatternResult> {
    this.validateEnabled(element, 'collapse');

    try {
      const success = await this.bindings.collapse(element);
      return { success };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Collapse an element, throwing on failure
   *
   * @param element - The element to collapse
   */
  async collapseOrThrow(element: UIElement): Promise<void> {
    const result = await this.collapse(element);
    if (!result.success) {
      throw new UIAError(
        `Failed to collapse element: ${result.error}`,
        'OPERATION_FAILED'
      );
    }
  }

  /**
   * Get the current expand/collapse state
   *
   * @param element - The element to check
   * @returns Result with the state
   */
  async getExpandCollapseState(element: UIElement): Promise<PatternResult<ExpandCollapseState>> {
    try {
      const state = await this.bindings.getExpandCollapseState(element);
      return { success: true, value: state ?? 'Collapsed' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if an element is expanded
   *
   * @param element - The element to check
   * @returns True if expanded
   */
  async isExpanded(element: UIElement): Promise<boolean> {
    const result = await this.getExpandCollapseState(element);
    return result.success && result.value === 'Expanded';
  }

  /**
   * Check if an element is collapsed
   *
   * @param element - The element to check
   * @returns True if collapsed
   */
  async isCollapsed(element: UIElement): Promise<boolean> {
    const result = await this.getExpandCollapseState(element);
    return result.success && result.value === 'Collapsed';
  }

  /**
   * Ensure an element is expanded
   *
   * @param element - The element to expand if needed
   * @returns True if successful
   */
  async ensureExpanded(element: UIElement): Promise<boolean> {
    if (await this.isExpanded(element)) {
      return true;
    }
    const result = await this.expand(element);
    return result.success;
  }

  /**
   * Ensure an element is collapsed
   *
   * @param element - The element to collapse if needed
   * @returns True if successful
   */
  async ensureCollapsed(element: UIElement): Promise<boolean> {
    if (await this.isCollapsed(element)) {
      return true;
    }
    const result = await this.collapse(element);
    return result.success;
  }

  /**
   * Toggle expand/collapse state
   *
   * @param element - The element to toggle
   * @returns True if successful
   */
  async toggleExpandCollapse(element: UIElement): Promise<boolean> {
    if (await this.isExpanded(element)) {
      const result = await this.collapse(element);
      return result.success;
    } else {
      const result = await this.expand(element);
      return result.success;
    }
  }

  // ========== Combo Box Helpers ==========

  /**
   * Open a combo box (expand it)
   *
   * @param element - The combo box element
   * @returns True if successful
   */
  async openComboBox(element: UIElement): Promise<boolean> {
    return this.ensureExpanded(element);
  }

  /**
   * Close a combo box (collapse it)
   *
   * @param element - The combo box element
   * @returns True if successful
   */
  async closeComboBox(element: UIElement): Promise<boolean> {
    return this.ensureCollapsed(element);
  }
}

// Default instance using global bindings
const defaultPatternOps = new PatternOperations();

// Export convenience functions
export const supportsPattern = (element: UIElement, pattern: string) =>
  defaultPatternOps.supportsPattern(element, pattern);
export const ensurePatternSupported = (element: UIElement, pattern: string) =>
  defaultPatternOps.ensurePatternSupported(element, pattern);
export const invoke = (element: UIElement) => defaultPatternOps.invoke(element);
export const invokeOrThrow = (element: UIElement) => defaultPatternOps.invokeOrThrow(element);
export const setValue = (element: UIElement, value: string) => defaultPatternOps.setValue(element, value);
export const setValueOrThrow = (element: UIElement, value: string) =>
  defaultPatternOps.setValueOrThrow(element, value);
export const getValue = (element: UIElement) => defaultPatternOps.getValue(element);
export const getValueOrThrow = (element: UIElement) => defaultPatternOps.getValueOrThrow(element);
export const toggle = (element: UIElement) => defaultPatternOps.toggle(element);
export const toggleOrThrow = (element: UIElement) => defaultPatternOps.toggleOrThrow(element);
export const getToggleState = (element: UIElement) => defaultPatternOps.getToggleState(element);
export const isToggleOn = (element: UIElement) => defaultPatternOps.isToggleOn(element);
export const setToggleOn = (element: UIElement) => defaultPatternOps.setToggleOn(element);
export const setToggleOff = (element: UIElement) => defaultPatternOps.setToggleOff(element);
export const select = (element: UIElement) => defaultPatternOps.select(element);
export const selectOrThrow = (element: UIElement) => defaultPatternOps.selectOrThrow(element);
export const expand = (element: UIElement) => defaultPatternOps.expand(element);
export const expandOrThrow = (element: UIElement) => defaultPatternOps.expandOrThrow(element);
export const collapse = (element: UIElement) => defaultPatternOps.collapse(element);
export const collapseOrThrow = (element: UIElement) => defaultPatternOps.collapseOrThrow(element);
export const getExpandCollapseState = (element: UIElement) =>
  defaultPatternOps.getExpandCollapseState(element);
export const isExpanded = (element: UIElement) => defaultPatternOps.isExpanded(element);
export const isCollapsed = (element: UIElement) => defaultPatternOps.isCollapsed(element);
export const ensureExpanded = (element: UIElement) => defaultPatternOps.ensureExpanded(element);
export const ensureCollapsed = (element: UIElement) => defaultPatternOps.ensureCollapsed(element);
export const toggleExpandCollapse = (element: UIElement) =>
  defaultPatternOps.toggleExpandCollapse(element);
export const openComboBox = (element: UIElement) => defaultPatternOps.openComboBox(element);
export const closeComboBox = (element: UIElement) => defaultPatternOps.closeComboBox(element);
