/**
 * Element Operations for Windows UI Automation
 *
 * High-level functions for discovering and inspecting UI elements.
 */

import { getBindings, type UIABindings } from './bindings.js';
import {
  UIAError,
  type UIElement,
  type ElementSearchCriteria,
  type TreeWalkOptions,
  type ElementProperties,
} from './types.js';

/**
 * Element operations class with dependency injection support
 */
export class ElementOperations {
  private bindings: UIABindings;

  constructor(bindings?: UIABindings) {
    this.bindings = bindings ?? getBindings();
  }

  /**
   * Get the root automation element of a window
   *
   * @param windowHandle - The window handle
   * @returns The root element or null
   */
  async getRootElement(windowHandle: number): Promise<UIElement | null> {
    if (windowHandle <= 0) {
      throw new UIAError('Invalid window handle', 'INVALID_ARGUMENT');
    }
    return this.bindings.getRootElement(windowHandle);
  }

  /**
   * Get the root element, throwing if not found
   *
   * @param windowHandle - The window handle
   * @returns The root element
   * @throws UIAError if not found
   */
  async getRootElementOrThrow(windowHandle: number): Promise<UIElement> {
    const root = await this.getRootElement(windowHandle);
    if (!root) {
      throw new UIAError(
        `Root element not found for window: ${windowHandle}`,
        'ELEMENT_NOT_FOUND'
      );
    }
    return root;
  }

  /**
   * Find the first element matching the criteria
   *
   * @param root - The root element to search from
   * @param criteria - Search criteria
   * @returns The found element or null
   */
  async findElement(root: UIElement, criteria: ElementSearchCriteria): Promise<UIElement | null> {
    if (!this.hasValidCriteria(criteria)) {
      throw new UIAError('At least one search criterion is required', 'INVALID_ARGUMENT');
    }
    return this.bindings.findElement(root, criteria);
  }

  /**
   * Find an element, throwing if not found
   *
   * @param root - The root element to search from
   * @param criteria - Search criteria
   * @returns The found element
   * @throws UIAError if not found
   */
  async findElementOrThrow(root: UIElement, criteria: ElementSearchCriteria): Promise<UIElement> {
    const element = await this.findElement(root, criteria);
    if (!element) {
      throw new UIAError(
        `Element not found: ${JSON.stringify(criteria)}`,
        'ELEMENT_NOT_FOUND'
      );
    }
    return element;
  }

  /**
   * Find all elements matching the criteria
   *
   * @param root - The root element to search from
   * @param criteria - Search criteria
   * @returns Array of matching elements
   */
  async findAllElements(root: UIElement, criteria: ElementSearchCriteria): Promise<UIElement[]> {
    if (!this.hasValidCriteria(criteria)) {
      throw new UIAError('At least one search criterion is required', 'INVALID_ARGUMENT');
    }
    return this.bindings.findAllElements(root, criteria);
  }

  /**
   * Get the UI element tree from a root element
   *
   * @param root - The root element
   * @param depth - Maximum depth to traverse (default: unlimited)
   * @returns The element tree
   */
  async getElementTree(root: UIElement, depth?: number): Promise<UIElement> {
    const options: TreeWalkOptions = {};
    if (depth !== undefined) {
      options.maxDepth = depth;
    }
    return this.bindings.getElementTree(root, options);
  }

  /**
   * Get the element tree with filtering options
   *
   * @param root - The root element
   * @param options - Tree walk options
   * @returns The filtered element tree
   */
  async getFilteredElementTree(root: UIElement, options: TreeWalkOptions): Promise<UIElement> {
    return this.bindings.getElementTree(root, options);
  }

  /**
   * Get extended properties for an element
   *
   * @param element - The element
   * @returns Extended properties including patterns and values
   */
  async getElementProperties(element: UIElement): Promise<ElementProperties> {
    const patterns = await this.bindings.getSupportedPatterns(element);

    const props: ElementProperties = {
      ...element,
      patterns: patterns as ElementProperties['patterns'],
    };

    // Get pattern-specific values
    if (patterns.includes('Value')) {
      props.value = (await this.bindings.getValue(element)) ?? undefined;
    }

    if (patterns.includes('Toggle')) {
      props.toggleState = (await this.bindings.getToggleState(element)) ?? undefined;
    }

    if (patterns.includes('ExpandCollapse')) {
      props.expandCollapseState = (await this.bindings.getExpandCollapseState(element)) ?? undefined;
    }

    return props;
  }

  /**
   * Get the element at screen coordinates
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   * @returns The element at the point or null
   */
  async getElementAtPoint(x: number, y: number): Promise<UIElement | null> {
    return this.bindings.getElementAtPoint(x, y);
  }

  /**
   * Check if an element is still valid
   *
   * @param element - The element to check
   * @returns True if the element reference is still valid
   */
  async isElementValid(element: UIElement): Promise<boolean> {
    return this.bindings.isElementValid(element);
  }

  /**
   * Get supported patterns for an element
   *
   * @param element - The element
   * @returns Array of supported pattern names
   */
  async getSupportedPatterns(element: UIElement): Promise<string[]> {
    return this.bindings.getSupportedPatterns(element);
  }

  /**
   * Wait for an element to appear
   *
   * @param root - The root element to search from
   * @param criteria - Search criteria
   * @param timeout - Timeout in milliseconds (default: 10000)
   * @param pollInterval - Poll interval in milliseconds (default: 100)
   * @returns The found element
   * @throws UIAError on timeout
   */
  async waitForElement(
    root: UIElement,
    criteria: ElementSearchCriteria,
    timeout = 10000,
    pollInterval = 100
  ): Promise<UIElement> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const element = await this.findElement(root, criteria);
      if (element) {
        return element;
      }
      await this.sleep(pollInterval);
    }

    throw new UIAError(
      `Timeout waiting for element: ${JSON.stringify(criteria)}`,
      'TIMEOUT'
    );
  }

  /**
   * Wait for an element to be enabled
   *
   * @param element - The element to wait for
   * @param timeout - Timeout in milliseconds (default: 10000)
   * @param pollInterval - Poll interval in milliseconds (default: 100)
   * @returns The enabled element
   * @throws UIAError on timeout
   */
  async waitForEnabled(
    element: UIElement,
    timeout = 10000,
    pollInterval = 100
  ): Promise<UIElement> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (element.isEnabled) {
        return element;
      }
      await this.sleep(pollInterval);
    }

    throw new UIAError(
      `Timeout waiting for element to be enabled: ${element.automationId || element.name}`,
      'TIMEOUT'
    );
  }

  /**
   * Wait for an element to disappear
   *
   * @param root - The root element to search from
   * @param criteria - Search criteria for the element
   * @param timeout - Timeout in milliseconds (default: 10000)
   * @param pollInterval - Poll interval in milliseconds (default: 100)
   * @returns True when element is gone
   * @throws UIAError on timeout
   */
  async waitForElementGone(
    root: UIElement,
    criteria: ElementSearchCriteria,
    timeout = 10000,
    pollInterval = 100
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const element = await this.findElement(root, criteria);
      if (!element) {
        return true;
      }
      await this.sleep(pollInterval);
    }

    throw new UIAError(
      `Timeout waiting for element to disappear: ${JSON.stringify(criteria)}`,
      'TIMEOUT'
    );
  }

  /**
   * Find element by automation ID
   *
   * @param root - The root element
   * @param automationId - The automation ID
   * @returns The found element or null
   */
  async findByAutomationId(root: UIElement, automationId: string): Promise<UIElement | null> {
    return this.findElement(root, { automationId });
  }

  /**
   * Find element by name
   *
   * @param root - The root element
   * @param name - The element name
   * @param partial - Use partial matching (default: false)
   * @returns The found element or null
   */
  async findByName(root: UIElement, name: string, partial = false): Promise<UIElement | null> {
    return this.findElement(root, { name, partial });
  }

  /**
   * Find elements by control type
   *
   * @param root - The root element
   * @param controlType - The control type (e.g., "Button", "Edit")
   * @returns Array of matching elements
   */
  async findByControlType(root: UIElement, controlType: string): Promise<UIElement[]> {
    return this.findAllElements(root, { controlType });
  }

  /**
   * Find all buttons in the element tree
   *
   * @param root - The root element
   * @returns Array of button elements
   */
  async findAllButtons(root: UIElement): Promise<UIElement[]> {
    return this.findByControlType(root, 'Button');
  }

  /**
   * Find all text inputs (edit controls) in the element tree
   *
   * @param root - The root element
   * @returns Array of edit elements
   */
  async findAllTextInputs(root: UIElement): Promise<UIElement[]> {
    return this.findByControlType(root, 'Edit');
  }

  /**
   * Find all checkboxes in the element tree
   *
   * @param root - The root element
   * @returns Array of checkbox elements
   */
  async findAllCheckboxes(root: UIElement): Promise<UIElement[]> {
    return this.findByControlType(root, 'CheckBox');
  }

  /**
   * Find the first enabled element matching criteria
   *
   * @param root - The root element
   * @param criteria - Search criteria
   * @returns The first enabled element or null
   */
  async findEnabledElement(root: UIElement, criteria: ElementSearchCriteria): Promise<UIElement | null> {
    const elements = await this.findAllElements(root, criteria);
    return elements.find(el => el.isEnabled) ?? null;
  }

  /**
   * Find all visible (not offscreen) elements matching criteria
   *
   * @param root - The root element
   * @param criteria - Search criteria
   * @returns Array of visible elements
   */
  async findVisibleElements(root: UIElement, criteria: ElementSearchCriteria): Promise<UIElement[]> {
    const elements = await this.findAllElements(root, criteria);
    return elements.filter(el => !el.isOffscreen);
  }

  /**
   * Get the center point of an element's bounding rect
   *
   * @param element - The element
   * @returns The center point { x, y }
   */
  getElementCenter(element: UIElement): { x: number; y: number } {
    return {
      x: element.boundingRect.x + element.boundingRect.width / 2,
      y: element.boundingRect.y + element.boundingRect.height / 2,
    };
  }

  /**
   * Check if an element has a specific pattern
   *
   * @param element - The element
   * @param pattern - The pattern name
   * @returns True if the pattern is supported
   */
  async hasPattern(element: UIElement, pattern: string): Promise<boolean> {
    const patterns = await this.getSupportedPatterns(element);
    return patterns.includes(pattern);
  }

  /**
   * Get a flat list of all elements in the tree
   *
   * @param root - The root element
   * @returns Flat array of all elements
   */
  flattenTree(root: UIElement): UIElement[] {
    const result: UIElement[] = [root];
    if (root.children) {
      for (const child of root.children) {
        result.push(...this.flattenTree(child));
      }
    }
    return result;
  }

  /**
   * Find elements with a specific pattern
   *
   * @param root - The root element
   * @param pattern - The pattern name
   * @returns Array of elements supporting the pattern
   */
  async findElementsWithPattern(root: UIElement, pattern: string): Promise<UIElement[]> {
    const tree = await this.getElementTree(root);
    const allElements = this.flattenTree(tree);
    const results: UIElement[] = [];

    for (const element of allElements) {
      if (await this.hasPattern(element, pattern)) {
        results.push(element);
      }
    }

    return results;
  }

  private hasValidCriteria(criteria: ElementSearchCriteria): boolean {
    return !!(
      criteria.automationId ||
      criteria.name ||
      criteria.controlType ||
      criteria.className
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Default instance using global bindings
const defaultElementOps = new ElementOperations();

// Export convenience functions
export const getRootElement = (windowHandle: number) => defaultElementOps.getRootElement(windowHandle);
export const getRootElementOrThrow = (windowHandle: number) => defaultElementOps.getRootElementOrThrow(windowHandle);
export const findElement = (root: UIElement, criteria: ElementSearchCriteria) =>
  defaultElementOps.findElement(root, criteria);
export const findElementOrThrow = (root: UIElement, criteria: ElementSearchCriteria) =>
  defaultElementOps.findElementOrThrow(root, criteria);
export const findAllElements = (root: UIElement, criteria: ElementSearchCriteria) =>
  defaultElementOps.findAllElements(root, criteria);
export const getElementTree = (root: UIElement, depth?: number) =>
  defaultElementOps.getElementTree(root, depth);
export const getFilteredElementTree = (root: UIElement, options: TreeWalkOptions) =>
  defaultElementOps.getFilteredElementTree(root, options);
export const getElementProperties = (element: UIElement) =>
  defaultElementOps.getElementProperties(element);
export const getElementAtPoint = (x: number, y: number) =>
  defaultElementOps.getElementAtPoint(x, y);
export const isElementValid = (element: UIElement) =>
  defaultElementOps.isElementValid(element);
export const getSupportedPatterns = (element: UIElement) =>
  defaultElementOps.getSupportedPatterns(element);
export const waitForElement = (
  root: UIElement,
  criteria: ElementSearchCriteria,
  timeout?: number,
  pollInterval?: number
) => defaultElementOps.waitForElement(root, criteria, timeout, pollInterval);
export const waitForEnabled = (element: UIElement, timeout?: number, pollInterval?: number) =>
  defaultElementOps.waitForEnabled(element, timeout, pollInterval);
export const waitForElementGone = (
  root: UIElement,
  criteria: ElementSearchCriteria,
  timeout?: number,
  pollInterval?: number
) => defaultElementOps.waitForElementGone(root, criteria, timeout, pollInterval);
export const findByAutomationId = (root: UIElement, automationId: string) =>
  defaultElementOps.findByAutomationId(root, automationId);
export const findByName = (root: UIElement, name: string, partial?: boolean) =>
  defaultElementOps.findByName(root, name, partial);
export const findByControlType = (root: UIElement, controlType: string) =>
  defaultElementOps.findByControlType(root, controlType);
export const findAllButtons = (root: UIElement) => defaultElementOps.findAllButtons(root);
export const findAllTextInputs = (root: UIElement) => defaultElementOps.findAllTextInputs(root);
export const findAllCheckboxes = (root: UIElement) => defaultElementOps.findAllCheckboxes(root);
export const findEnabledElement = (root: UIElement, criteria: ElementSearchCriteria) =>
  defaultElementOps.findEnabledElement(root, criteria);
export const findVisibleElements = (root: UIElement, criteria: ElementSearchCriteria) =>
  defaultElementOps.findVisibleElements(root, criteria);
export const getElementCenter = (element: UIElement) => defaultElementOps.getElementCenter(element);
export const hasPattern = (element: UIElement, pattern: string) =>
  defaultElementOps.hasPattern(element, pattern);
export const flattenTree = (root: UIElement) => defaultElementOps.flattenTree(root);
export const findElementsWithPattern = (root: UIElement, pattern: string) =>
  defaultElementOps.findElementsWithPattern(root, pattern);
