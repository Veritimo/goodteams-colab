/**
 * Pattern Operations Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PatternOperations,
  MockUIABindings,
  setBindings,
  resetBindings,
  UIAError,
  type UIElement,
  type WindowInfo,
} from '../../../src/automation/uia/index.js';

describe('PatternOperations', () => {
  let mockBindings: MockUIABindings;
  let patternOps: PatternOperations;

  const sampleWindow: WindowInfo = {
    handle: 1001,
    title: 'Test App',
    className: 'TestWin',
    processId: 1234,
    bounds: { x: 0, y: 0, width: 1024, height: 768 },
  };

  const buttonElement: UIElement = {
    automationId: 'submitButton',
    name: 'Submit',
    className: 'Button',
    controlType: 'Button',
    boundingRect: { x: 100, y: 100, width: 100, height: 30 },
    isEnabled: true,
    isOffscreen: false,
  };

  const disabledButton: UIElement = {
    automationId: 'disabledButton',
    name: 'Disabled',
    className: 'Button',
    controlType: 'Button',
    boundingRect: { x: 210, y: 100, width: 100, height: 30 },
    isEnabled: false,
    isOffscreen: false,
  };

  const textBoxElement: UIElement = {
    automationId: 'nameInput',
    name: 'Name',
    className: 'TextBox',
    controlType: 'Edit',
    boundingRect: { x: 100, y: 150, width: 200, height: 30 },
    isEnabled: true,
    isOffscreen: false,
  };

  const checkboxElement: UIElement = {
    automationId: 'agreeCheckbox',
    name: 'I Agree',
    className: 'CheckBox',
    controlType: 'CheckBox',
    boundingRect: { x: 100, y: 200, width: 150, height: 20 },
    isEnabled: true,
    isOffscreen: false,
  };

  const comboBoxElement: UIElement = {
    automationId: 'countryCombo',
    name: 'Country',
    className: 'ComboBox',
    controlType: 'ComboBox',
    boundingRect: { x: 100, y: 250, width: 200, height: 30 },
    isEnabled: true,
    isOffscreen: false,
  };

  const listItemElement: UIElement = {
    automationId: 'listItem1',
    name: 'Item 1',
    className: 'ListItem',
    controlType: 'ListItem',
    boundingRect: { x: 100, y: 300, width: 200, height: 25 },
    isEnabled: true,
    isOffscreen: false,
  };

  const treeItemElement: UIElement = {
    automationId: 'treeNode1',
    name: 'Node 1',
    className: 'TreeItem',
    controlType: 'TreeItem',
    boundingRect: { x: 100, y: 350, width: 200, height: 25 },
    isEnabled: true,
    isOffscreen: false,
  };

  beforeEach(() => {
    mockBindings = new MockUIABindings();
    mockBindings.setMockWindows([sampleWindow]);
    // Set up initial states
    mockBindings.setMockToggleState('agreeCheckbox', 'Off');
    mockBindings.setMockExpandState('countryCombo', 'Collapsed');
    mockBindings.setMockExpandState('treeNode1', 'Collapsed');
    mockBindings.setMockValue('nameInput', '');
    setBindings(mockBindings);
    patternOps = new PatternOperations(mockBindings);
  });

  afterEach(() => {
    resetBindings();
  });

  // ========== supportsPattern tests ==========

  describe('supportsPattern', () => {
    it('should return true for button with Invoke pattern', async () => {
      const supports = await patternOps.supportsPattern(buttonElement, 'Invoke');
      expect(supports).toBe(true);
    });

    it('should return true for textbox with Value pattern', async () => {
      const supports = await patternOps.supportsPattern(textBoxElement, 'Value');
      expect(supports).toBe(true);
    });

    it('should return true for checkbox with Toggle pattern', async () => {
      const supports = await patternOps.supportsPattern(checkboxElement, 'Toggle');
      expect(supports).toBe(true);
    });

    it('should return false for button without Toggle pattern', async () => {
      const supports = await patternOps.supportsPattern(buttonElement, 'Toggle');
      expect(supports).toBe(false);
    });
  });

  // ========== Invoke Pattern tests ==========

  describe('invoke', () => {
    it('should invoke enabled button', async () => {
      const result = await patternOps.invoke(buttonElement);
      expect(result.success).toBe(true);
    });

    it('should fail for disabled button', async () => {
      await expect(patternOps.invoke(disabledButton)).rejects.toThrow(UIAError);
    });
  });

  describe('invokeOrThrow', () => {
    it('should invoke successfully', async () => {
      await expect(patternOps.invokeOrThrow(buttonElement)).resolves.toBeUndefined();
    });

    it('should throw for disabled element', async () => {
      await expect(patternOps.invokeOrThrow(disabledButton)).rejects.toThrow(UIAError);
    });
  });

  // ========== Value Pattern tests ==========

  describe('setValue', () => {
    it('should set value on text element', async () => {
      const result = await patternOps.setValue(textBoxElement, 'John Doe');
      expect(result.success).toBe(true);
    });

    it('should fail for disabled element', async () => {
      await expect(patternOps.setValue(disabledButton, 'test')).rejects.toThrow(UIAError);
    });
  });

  describe('setValueOrThrow', () => {
    it('should set value successfully', async () => {
      await expect(patternOps.setValueOrThrow(textBoxElement, 'Test')).resolves.toBeUndefined();
    });
  });

  describe('getValue', () => {
    it('should get value from text element', async () => {
      // Set a value first
      await patternOps.setValue(textBoxElement, 'Test Value');
      const result = await patternOps.getValue(textBoxElement);
      expect(result.success).toBe(true);
      expect(result.value).toBe('Test Value');
    });

    it('should return empty string for empty value', async () => {
      const result = await patternOps.getValue(textBoxElement);
      expect(result.success).toBe(true);
      expect(result.value).toBe('');
    });
  });

  describe('getValueOrThrow', () => {
    it('should return value', async () => {
      await patternOps.setValue(textBoxElement, 'Hello');
      const value = await patternOps.getValueOrThrow(textBoxElement);
      expect(value).toBe('Hello');
    });
  });

  // ========== Toggle Pattern tests ==========

  describe('toggle', () => {
    it('should toggle checkbox', async () => {
      const result = await patternOps.toggle(checkboxElement);
      expect(result.success).toBe(true);
    });

    it('should fail for disabled element', async () => {
      await expect(patternOps.toggle(disabledButton)).rejects.toThrow(UIAError);
    });
  });

  describe('toggleOrThrow', () => {
    it('should toggle successfully', async () => {
      await expect(patternOps.toggleOrThrow(checkboxElement)).resolves.toBeUndefined();
    });
  });

  describe('getToggleState', () => {
    it('should get toggle state', async () => {
      const result = await patternOps.getToggleState(checkboxElement);
      expect(result.success).toBe(true);
      expect(result.value).toBe('Off');
    });
  });

  describe('isToggleOn', () => {
    it('should return false when toggle is off', async () => {
      const isOn = await patternOps.isToggleOn(checkboxElement);
      expect(isOn).toBe(false);
    });

    it('should return true when toggle is on', async () => {
      mockBindings.setMockToggleState('agreeCheckbox', 'On');
      const isOn = await patternOps.isToggleOn(checkboxElement);
      expect(isOn).toBe(true);
    });
  });

  describe('setToggleOn', () => {
    it('should turn toggle on when off', async () => {
      const result = await patternOps.setToggleOn(checkboxElement);
      expect(result).toBe(true);
      const isOn = await patternOps.isToggleOn(checkboxElement);
      expect(isOn).toBe(true);
    });

    it('should do nothing when already on', async () => {
      mockBindings.setMockToggleState('agreeCheckbox', 'On');
      const result = await patternOps.setToggleOn(checkboxElement);
      expect(result).toBe(true);
      const isOn = await patternOps.isToggleOn(checkboxElement);
      expect(isOn).toBe(true);
    });
  });

  describe('setToggleOff', () => {
    it('should turn toggle off when on', async () => {
      mockBindings.setMockToggleState('agreeCheckbox', 'On');
      const result = await patternOps.setToggleOff(checkboxElement);
      expect(result).toBe(true);
      const isOn = await patternOps.isToggleOn(checkboxElement);
      expect(isOn).toBe(false);
    });

    it('should do nothing when already off', async () => {
      const result = await patternOps.setToggleOff(checkboxElement);
      expect(result).toBe(true);
      const isOn = await patternOps.isToggleOn(checkboxElement);
      expect(isOn).toBe(false);
    });
  });

  // ========== Selection Item Pattern tests ==========

  describe('select', () => {
    it('should select list item', async () => {
      const result = await patternOps.select(listItemElement);
      expect(result.success).toBe(true);
    });

    it('should fail for disabled element', async () => {
      await expect(patternOps.select(disabledButton)).rejects.toThrow(UIAError);
    });
  });

  describe('selectOrThrow', () => {
    it('should select successfully', async () => {
      await expect(patternOps.selectOrThrow(listItemElement)).resolves.toBeUndefined();
    });
  });

  // ========== Expand/Collapse Pattern tests ==========

  describe('expand', () => {
    it('should expand combo box', async () => {
      const result = await patternOps.expand(comboBoxElement);
      expect(result.success).toBe(true);
    });

    it('should fail for disabled element', async () => {
      await expect(patternOps.expand(disabledButton)).rejects.toThrow(UIAError);
    });
  });

  describe('expandOrThrow', () => {
    it('should expand successfully', async () => {
      await expect(patternOps.expandOrThrow(comboBoxElement)).resolves.toBeUndefined();
    });
  });

  describe('collapse', () => {
    it('should collapse combo box', async () => {
      const result = await patternOps.collapse(comboBoxElement);
      expect(result.success).toBe(true);
    });
  });

  describe('collapseOrThrow', () => {
    it('should collapse successfully', async () => {
      await expect(patternOps.collapseOrThrow(comboBoxElement)).resolves.toBeUndefined();
    });
  });

  describe('getExpandCollapseState', () => {
    it('should get expand/collapse state', async () => {
      const result = await patternOps.getExpandCollapseState(comboBoxElement);
      expect(result.success).toBe(true);
      expect(result.value).toBe('Collapsed');
    });
  });

  describe('isExpanded', () => {
    it('should return false when collapsed', async () => {
      const expanded = await patternOps.isExpanded(comboBoxElement);
      expect(expanded).toBe(false);
    });

    it('should return true when expanded', async () => {
      mockBindings.setMockExpandState('countryCombo', 'Expanded');
      const expanded = await patternOps.isExpanded(comboBoxElement);
      expect(expanded).toBe(true);
    });
  });

  describe('isCollapsed', () => {
    it('should return true when collapsed', async () => {
      const collapsed = await patternOps.isCollapsed(comboBoxElement);
      expect(collapsed).toBe(true);
    });

    it('should return false when expanded', async () => {
      mockBindings.setMockExpandState('countryCombo', 'Expanded');
      const collapsed = await patternOps.isCollapsed(comboBoxElement);
      expect(collapsed).toBe(false);
    });
  });

  describe('ensureExpanded', () => {
    it('should expand when collapsed', async () => {
      const result = await patternOps.ensureExpanded(comboBoxElement);
      expect(result).toBe(true);
      const expanded = await patternOps.isExpanded(comboBoxElement);
      expect(expanded).toBe(true);
    });

    it('should do nothing when already expanded', async () => {
      mockBindings.setMockExpandState('countryCombo', 'Expanded');
      const result = await patternOps.ensureExpanded(comboBoxElement);
      expect(result).toBe(true);
    });
  });

  describe('ensureCollapsed', () => {
    it('should collapse when expanded', async () => {
      mockBindings.setMockExpandState('countryCombo', 'Expanded');
      const result = await patternOps.ensureCollapsed(comboBoxElement);
      expect(result).toBe(true);
      const collapsed = await patternOps.isCollapsed(comboBoxElement);
      expect(collapsed).toBe(true);
    });

    it('should do nothing when already collapsed', async () => {
      const result = await patternOps.ensureCollapsed(comboBoxElement);
      expect(result).toBe(true);
    });
  });

  describe('toggleExpandCollapse', () => {
    it('should expand when collapsed', async () => {
      const result = await patternOps.toggleExpandCollapse(treeItemElement);
      expect(result).toBe(true);
      const expanded = await patternOps.isExpanded(treeItemElement);
      expect(expanded).toBe(true);
    });

    it('should collapse when expanded', async () => {
      mockBindings.setMockExpandState('treeNode1', 'Expanded');
      const result = await patternOps.toggleExpandCollapse(treeItemElement);
      expect(result).toBe(true);
      const collapsed = await patternOps.isCollapsed(treeItemElement);
      expect(collapsed).toBe(true);
    });
  });

  // ========== Combo Box Helpers tests ==========

  describe('openComboBox', () => {
    it('should open (expand) combo box', async () => {
      const result = await patternOps.openComboBox(comboBoxElement);
      expect(result).toBe(true);
      const expanded = await patternOps.isExpanded(comboBoxElement);
      expect(expanded).toBe(true);
    });
  });

  describe('closeComboBox', () => {
    it('should close (collapse) combo box', async () => {
      mockBindings.setMockExpandState('countryCombo', 'Expanded');
      const result = await patternOps.closeComboBox(comboBoxElement);
      expect(result).toBe(true);
      const collapsed = await patternOps.isCollapsed(comboBoxElement);
      expect(collapsed).toBe(true);
    });
  });
});
