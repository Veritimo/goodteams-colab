/**
 * Element Operations Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ElementOperations,
  MockUIABindings,
  setBindings,
  resetBindings,
  UIAError,
  type UIElement,
  type WindowInfo,
} from '../../../src/automation/uia/index.js';

describe('ElementOperations', () => {
  let mockBindings: MockUIABindings;
  let elementOps: ElementOperations;

  const sampleWindow: WindowInfo = {
    handle: 1001,
    title: 'Test App',
    className: 'TestWin',
    processId: 1234,
    bounds: { x: 0, y: 0, width: 1024, height: 768 },
  };

  const sampleRootElement: UIElement = {
    automationId: 'root',
    name: 'Test Application',
    className: 'Window',
    controlType: 'Window',
    boundingRect: { x: 0, y: 0, width: 1024, height: 768 },
    isEnabled: true,
    isOffscreen: false,
    children: [
      {
        automationId: 'menuBar',
        name: 'Menu Bar',
        className: 'MenuBar',
        controlType: 'MenuBar',
        boundingRect: { x: 0, y: 0, width: 1024, height: 30 },
        isEnabled: true,
        isOffscreen: false,
        children: [
          {
            automationId: 'fileMenu',
            name: 'File',
            className: 'MenuItem',
            controlType: 'MenuItem',
            boundingRect: { x: 0, y: 0, width: 60, height: 30 },
            isEnabled: true,
            isOffscreen: false,
          },
          {
            automationId: 'editMenu',
            name: 'Edit',
            className: 'MenuItem',
            controlType: 'MenuItem',
            boundingRect: { x: 60, y: 0, width: 60, height: 30 },
            isEnabled: true,
            isOffscreen: false,
          },
        ],
      },
      {
        automationId: 'mainContent',
        name: 'Main Content',
        className: 'Panel',
        controlType: 'Pane',
        boundingRect: { x: 0, y: 30, width: 1024, height: 700 },
        isEnabled: true,
        isOffscreen: false,
        children: [
          {
            automationId: 'usernameInput',
            name: 'Username',
            className: 'TextBox',
            controlType: 'Edit',
            boundingRect: { x: 100, y: 100, width: 200, height: 30 },
            isEnabled: true,
            isOffscreen: false,
          },
          {
            automationId: 'passwordInput',
            name: 'Password',
            className: 'TextBox',
            controlType: 'Edit',
            boundingRect: { x: 100, y: 140, width: 200, height: 30 },
            isEnabled: true,
            isOffscreen: false,
          },
          {
            automationId: 'loginButton',
            name: 'Login',
            className: 'Button',
            controlType: 'Button',
            boundingRect: { x: 100, y: 180, width: 100, height: 30 },
            isEnabled: true,
            isOffscreen: false,
          },
          {
            automationId: 'cancelButton',
            name: 'Cancel',
            className: 'Button',
            controlType: 'Button',
            boundingRect: { x: 210, y: 180, width: 100, height: 30 },
            isEnabled: false, // Disabled button for testing
            isOffscreen: false,
          },
          {
            automationId: 'rememberCheckbox',
            name: 'Remember Me',
            className: 'CheckBox',
            controlType: 'CheckBox',
            boundingRect: { x: 100, y: 220, width: 150, height: 20 },
            isEnabled: true,
            isOffscreen: false,
          },
          {
            automationId: 'offscreenElement',
            name: 'Hidden Element',
            className: 'Panel',
            controlType: 'Pane',
            boundingRect: { x: 2000, y: 2000, width: 100, height: 100 },
            isEnabled: true,
            isOffscreen: true, // Offscreen element
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    mockBindings = new MockUIABindings();
    mockBindings.setMockWindows([sampleWindow]);
    mockBindings.setMockRootElement(1001, sampleRootElement);
    setBindings(mockBindings);
    elementOps = new ElementOperations(mockBindings);
  });

  afterEach(() => {
    resetBindings();
  });

  // ========== getRootElement tests ==========

  describe('getRootElement', () => {
    it('should get root element of a window', async () => {
      const root = await elementOps.getRootElement(1001);
      expect(root).not.toBeNull();
      expect(root?.automationId).toBe('root');
    });

    it('should return null for non-existent window', async () => {
      const root = await elementOps.getRootElement(99999);
      expect(root).toBeNull();
    });

    it('should throw for invalid handle', async () => {
      await expect(elementOps.getRootElement(0)).rejects.toThrow(UIAError);
    });
  });

  // ========== getRootElementOrThrow tests ==========

  describe('getRootElementOrThrow', () => {
    it('should return root element when found', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      expect(root.automationId).toBe('root');
    });

    it('should throw UIAError when not found', async () => {
      await expect(elementOps.getRootElementOrThrow(99999)).rejects.toThrow(UIAError);
    });
  });

  // ========== findElement tests ==========

  describe('findElement', () => {
    it('should find element by automation ID', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const element = await elementOps.findElement(root, { automationId: 'loginButton' });
      expect(element).not.toBeNull();
      expect(element?.name).toBe('Login');
    });

    it('should find element by name', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const element = await elementOps.findElement(root, { name: 'Username' });
      expect(element).not.toBeNull();
      expect(element?.automationId).toBe('usernameInput');
    });

    it('should find element by control type', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const element = await elementOps.findElement(root, { controlType: 'Button' });
      expect(element).not.toBeNull();
      expect(element?.controlType).toBe('Button');
    });

    it('should return null when element not found', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const element = await elementOps.findElement(root, { automationId: 'nonexistent' });
      expect(element).toBeNull();
    });

    it('should throw for empty criteria', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      await expect(elementOps.findElement(root, {})).rejects.toThrow(UIAError);
    });

    it('should find element with partial name match', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const element = await elementOps.findElement(root, { name: 'User', partial: true });
      expect(element).not.toBeNull();
      expect(element?.automationId).toBe('usernameInput');
    });
  });

  // ========== findElementOrThrow tests ==========

  describe('findElementOrThrow', () => {
    it('should return element when found', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const element = await elementOps.findElementOrThrow(root, { automationId: 'loginButton' });
      expect(element.name).toBe('Login');
    });

    it('should throw UIAError when not found', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      await expect(
        elementOps.findElementOrThrow(root, { automationId: 'nonexistent' })
      ).rejects.toThrow(UIAError);
    });
  });

  // ========== findAllElements tests ==========

  describe('findAllElements', () => {
    it('should find all buttons', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const elements = await elementOps.findAllElements(root, { controlType: 'Button' });
      expect(elements).toHaveLength(2);
      expect(elements.map(e => e.name)).toContain('Login');
      expect(elements.map(e => e.name)).toContain('Cancel');
    });

    it('should find all edit controls', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const elements = await elementOps.findAllElements(root, { controlType: 'Edit' });
      expect(elements).toHaveLength(2);
    });

    it('should return empty array when no matches', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const elements = await elementOps.findAllElements(root, { controlType: 'DataGrid' });
      expect(elements).toHaveLength(0);
    });
  });

  // ========== getElementTree tests ==========

  describe('getElementTree', () => {
    it('should get full element tree', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const tree = await elementOps.getElementTree(root);
      expect(tree.children).toBeDefined();
      expect(tree.children?.length).toBeGreaterThan(0);
    });

    it('should respect depth limit', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const tree = await elementOps.getElementTree(root, 1);
      // With depth 1, should have children but no grandchildren
      expect(tree.children).toBeDefined();
      const firstChild = tree.children?.[0];
      // Depth 1 means children should not have their own children populated
      expect(firstChild?.children).toBeUndefined();
    });
  });

  // ========== findByAutomationId tests ==========

  describe('findByAutomationId', () => {
    it('should find element by automation ID', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const element = await elementOps.findByAutomationId(root, 'loginButton');
      expect(element?.name).toBe('Login');
    });
  });

  // ========== findByName tests ==========

  describe('findByName', () => {
    it('should find element by exact name', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const element = await elementOps.findByName(root, 'Login');
      expect(element?.automationId).toBe('loginButton');
    });

    it('should find element by partial name', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const element = await elementOps.findByName(root, 'Log', true);
      expect(element?.automationId).toBe('loginButton');
    });
  });

  // ========== findByControlType tests ==========

  describe('findByControlType', () => {
    it('should find all elements of a control type', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const elements = await elementOps.findByControlType(root, 'MenuItem');
      expect(elements).toHaveLength(2);
    });
  });

  // ========== findAllButtons tests ==========

  describe('findAllButtons', () => {
    it('should find all button elements', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const buttons = await elementOps.findAllButtons(root);
      expect(buttons).toHaveLength(2);
    });
  });

  // ========== findAllTextInputs tests ==========

  describe('findAllTextInputs', () => {
    it('should find all edit elements', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const inputs = await elementOps.findAllTextInputs(root);
      expect(inputs).toHaveLength(2);
      expect(inputs.map(i => i.name)).toContain('Username');
      expect(inputs.map(i => i.name)).toContain('Password');
    });
  });

  // ========== findAllCheckboxes tests ==========

  describe('findAllCheckboxes', () => {
    it('should find all checkbox elements', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const checkboxes = await elementOps.findAllCheckboxes(root);
      expect(checkboxes).toHaveLength(1);
      expect(checkboxes[0].name).toBe('Remember Me');
    });
  });

  // ========== findEnabledElement tests ==========

  describe('findEnabledElement', () => {
    it('should find first enabled element', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const element = await elementOps.findEnabledElement(root, { controlType: 'Button' });
      expect(element).not.toBeNull();
      expect(element?.isEnabled).toBe(true);
      expect(element?.name).toBe('Login'); // Login is enabled, Cancel is not
    });
  });

  // ========== findVisibleElements tests ==========

  describe('findVisibleElements', () => {
    it('should exclude offscreen elements', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const elements = await elementOps.findVisibleElements(root, { controlType: 'Pane' });
      // Should not include the offscreen element
      const offscreenFound = elements.find(e => e.automationId === 'offscreenElement');
      expect(offscreenFound).toBeUndefined();
    });
  });

  // ========== getElementCenter tests ==========

  describe('getElementCenter', () => {
    it('should calculate element center', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const button = await elementOps.findByAutomationId(root, 'loginButton');
      const center = elementOps.getElementCenter(button!);
      // Button at x:100, y:180, width:100, height:30
      expect(center.x).toBe(150);
      expect(center.y).toBe(195);
    });
  });

  // ========== flattenTree tests ==========

  describe('flattenTree', () => {
    it('should return flat array of all elements', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const flat = elementOps.flattenTree(root);
      // Should include root, menu bar, menu items, main content, inputs, buttons, etc.
      expect(flat.length).toBeGreaterThan(5);
      expect(flat.some(e => e.automationId === 'root')).toBe(true);
      expect(flat.some(e => e.automationId === 'loginButton')).toBe(true);
    });
  });

  // ========== getSupportedPatterns tests ==========

  describe('getSupportedPatterns', () => {
    it('should return patterns for button', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const button = await elementOps.findByAutomationId(root, 'loginButton');
      const patterns = await elementOps.getSupportedPatterns(button!);
      expect(patterns).toContain('Invoke');
    });

    it('should return patterns for checkbox', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const checkbox = await elementOps.findByAutomationId(root, 'rememberCheckbox');
      const patterns = await elementOps.getSupportedPatterns(checkbox!);
      expect(patterns).toContain('Toggle');
    });
  });

  // ========== hasPattern tests ==========

  describe('hasPattern', () => {
    it('should return true if element has pattern', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const button = await elementOps.findByAutomationId(root, 'loginButton');
      const hasInvoke = await elementOps.hasPattern(button!, 'Invoke');
      expect(hasInvoke).toBe(true);
    });

    it('should return false if element does not have pattern', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const button = await elementOps.findByAutomationId(root, 'loginButton');
      const hasToggle = await elementOps.hasPattern(button!, 'Toggle');
      expect(hasToggle).toBe(false);
    });
  });

  // ========== isElementValid tests ==========

  describe('isElementValid', () => {
    it('should return true for valid element', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const button = await elementOps.findByAutomationId(root, 'loginButton');
      const valid = await elementOps.isElementValid(button!);
      expect(valid).toBe(true);
    });
  });

  // ========== waitForElement tests ==========

  describe('waitForElement', () => {
    it('should return immediately if element exists', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      const element = await elementOps.waitForElement(
        root,
        { automationId: 'loginButton' },
        1000,
        50
      );
      expect(element.name).toBe('Login');
    });

    it('should timeout if element does not appear', async () => {
      const root = await elementOps.getRootElementOrThrow(1001);
      await expect(
        elementOps.waitForElement(root, { automationId: 'nonexistent' }, 100, 20)
      ).rejects.toThrow(UIAError);
    });
  });

  // ========== getElementAtPoint tests ==========

  describe('getElementAtPoint', () => {
    it('should find element at coordinates', async () => {
      // Login button is at x:100, y:180, width:100, height:30
      const element = await elementOps.getElementAtPoint(150, 195);
      expect(element).not.toBeNull();
      expect(element?.automationId).toBe('loginButton');
    });
  });
});
