/**
 * Input Actions Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  InputActions,
  MockUIABindings,
  setBindings,
  resetBindings,
  UIAError,
  type UIElement,
  type WindowInfo,
} from '../../../src/automation/uia/index.js';

describe('InputActions', () => {
  let mockBindings: MockUIABindings;
  let actions: InputActions;

  const sampleWindow: WindowInfo = {
    handle: 1001,
    title: 'Test App',
    className: 'TestWin',
    processId: 1234,
    bounds: { x: 0, y: 0, width: 1024, height: 768 },
  };

  const enabledButton: UIElement = {
    automationId: 'okButton',
    name: 'OK',
    className: 'Button',
    controlType: 'Button',
    boundingRect: { x: 100, y: 100, width: 100, height: 30 },
    isEnabled: true,
    isOffscreen: false,
  };

  const disabledButton: UIElement = {
    automationId: 'cancelButton',
    name: 'Cancel',
    className: 'Button',
    controlType: 'Button',
    boundingRect: { x: 210, y: 100, width: 100, height: 30 },
    isEnabled: false,
    isOffscreen: false,
  };

  const offscreenElement: UIElement = {
    automationId: 'hidden',
    name: 'Hidden',
    className: 'Panel',
    controlType: 'Pane',
    boundingRect: { x: 2000, y: 2000, width: 100, height: 100 },
    isEnabled: true,
    isOffscreen: true,
  };

  const textInput: UIElement = {
    automationId: 'textField',
    name: 'Text Input',
    className: 'TextBox',
    controlType: 'Edit',
    boundingRect: { x: 100, y: 150, width: 200, height: 30 },
    isEnabled: true,
    isOffscreen: false,
  };

  const scrollablePanel: UIElement = {
    automationId: 'scrollPanel',
    name: 'Scroll Panel',
    className: 'Panel',
    controlType: 'Pane',
    boundingRect: { x: 100, y: 200, width: 300, height: 400 },
    isEnabled: true,
    isOffscreen: false,
  };

  beforeEach(() => {
    mockBindings = new MockUIABindings();
    mockBindings.setMockWindows([sampleWindow]);
    setBindings(mockBindings);
    actions = new InputActions(mockBindings);
  });

  afterEach(() => {
    resetBindings();
  });

  // ========== click tests ==========

  describe('click', () => {
    it('should click enabled element', async () => {
      const result = await actions.click(enabledButton);
      expect(result).toBe(true);
    });

    it('should throw for disabled element', async () => {
      await expect(actions.click(disabledButton)).rejects.toThrow(UIAError);
      await expect(actions.click(disabledButton)).rejects.toMatchObject({
        code: 'ELEMENT_NOT_ENABLED',
      });
    });

    it('should throw for offscreen element', async () => {
      await expect(actions.click(offscreenElement)).rejects.toThrow(UIAError);
      await expect(actions.click(offscreenElement)).rejects.toMatchObject({
        code: 'ELEMENT_OFFSCREEN',
      });
    });
  });

  // ========== doubleClick tests ==========

  describe('doubleClick', () => {
    it('should double-click enabled element', async () => {
      const result = await actions.doubleClick(enabledButton);
      expect(result).toBe(true);
    });

    it('should throw for disabled element', async () => {
      await expect(actions.doubleClick(disabledButton)).rejects.toThrow(UIAError);
    });
  });

  // ========== rightClick tests ==========

  describe('rightClick', () => {
    it('should right-click enabled element', async () => {
      const result = await actions.rightClick(enabledButton);
      expect(result).toBe(true);
    });

    it('should throw for disabled element', async () => {
      await expect(actions.rightClick(disabledButton)).rejects.toThrow(UIAError);
    });
  });

  // ========== clickAt tests ==========

  describe('clickAt', () => {
    it('should click at coordinates', async () => {
      const result = await actions.clickAt(150, 200);
      expect(result).toBe(true);
    });

    it('should throw for negative coordinates', async () => {
      await expect(actions.clickAt(-1, 100)).rejects.toThrow(UIAError);
      await expect(actions.clickAt(100, -1)).rejects.toThrow(UIAError);
    });
  });

  // ========== type tests ==========

  describe('type', () => {
    it('should type text', async () => {
      const result = await actions.type('Hello World');
      expect(result).toBe(true);
    });

    it('should throw for empty text', async () => {
      await expect(actions.type('')).rejects.toThrow(UIAError);
    });
  });

  // ========== typeInElement tests ==========

  describe('typeInElement', () => {
    it('should type in enabled element', async () => {
      const result = await actions.typeInElement(textInput, 'Hello');
      expect(result).toBe(true);
    });

    it('should allow empty string', async () => {
      const result = await actions.typeInElement(textInput, '');
      expect(result).toBe(true);
    });

    it('should throw for disabled element', async () => {
      await expect(actions.typeInElement(disabledButton, 'text')).rejects.toThrow(UIAError);
    });
  });

  // ========== pressKey tests ==========

  describe('pressKey', () => {
    it('should press a key', async () => {
      const result = await actions.pressKey('Enter');
      expect(result).toBe(true);
    });

    it('should press key with modifiers', async () => {
      const result = await actions.pressKey('a', ['ctrl']);
      expect(result).toBe(true);
    });

    it('should press key with multiple modifiers', async () => {
      const result = await actions.pressKey('s', ['ctrl', 'shift']);
      expect(result).toBe(true);
    });

    it('should throw for empty key', async () => {
      await expect(actions.pressKey('')).rejects.toThrow(UIAError);
    });
  });

  // ========== scroll tests ==========

  describe('scroll', () => {
    it('should scroll down', async () => {
      const result = await actions.scroll(scrollablePanel, 'down', 3);
      expect(result).toBe(true);
    });

    it('should scroll up', async () => {
      const result = await actions.scroll(scrollablePanel, 'up', 5);
      expect(result).toBe(true);
    });

    it('should scroll left', async () => {
      const result = await actions.scroll(scrollablePanel, 'left', 2);
      expect(result).toBe(true);
    });

    it('should scroll right', async () => {
      const result = await actions.scroll(scrollablePanel, 'right', 4);
      expect(result).toBe(true);
    });

    it('should throw for non-positive amount', async () => {
      await expect(actions.scroll(scrollablePanel, 'down', 0)).rejects.toThrow(UIAError);
      await expect(actions.scroll(scrollablePanel, 'down', -1)).rejects.toThrow(UIAError);
    });
  });

  // ========== scrollUp/Down/Left/Right tests ==========

  describe('scrollUp', () => {
    it('should scroll up with default amount', async () => {
      const result = await actions.scrollUp(scrollablePanel);
      expect(result).toBe(true);
    });

    it('should scroll up with custom amount', async () => {
      const result = await actions.scrollUp(scrollablePanel, 10);
      expect(result).toBe(true);
    });
  });

  describe('scrollDown', () => {
    it('should scroll down with default amount', async () => {
      const result = await actions.scrollDown(scrollablePanel);
      expect(result).toBe(true);
    });
  });

  describe('scrollLeft', () => {
    it('should scroll left with default amount', async () => {
      const result = await actions.scrollLeft(scrollablePanel);
      expect(result).toBe(true);
    });
  });

  describe('scrollRight', () => {
    it('should scroll right with default amount', async () => {
      const result = await actions.scrollRight(scrollablePanel);
      expect(result).toBe(true);
    });
  });

  // ========== Keyboard shortcuts tests ==========

  describe('keyboard shortcuts', () => {
    it('should press Enter', async () => {
      const result = await actions.pressEnter();
      expect(result).toBe(true);
    });

    it('should press Tab', async () => {
      const result = await actions.pressTab();
      expect(result).toBe(true);
    });

    it('should press Shift+Tab', async () => {
      const result = await actions.pressShiftTab();
      expect(result).toBe(true);
    });

    it('should press Escape', async () => {
      const result = await actions.pressEscape();
      expect(result).toBe(true);
    });

    it('should select all (Ctrl+A)', async () => {
      const result = await actions.selectAll();
      expect(result).toBe(true);
    });

    it('should copy (Ctrl+C)', async () => {
      const result = await actions.copy();
      expect(result).toBe(true);
    });

    it('should paste (Ctrl+V)', async () => {
      const result = await actions.paste();
      expect(result).toBe(true);
    });

    it('should cut (Ctrl+X)', async () => {
      const result = await actions.cut();
      expect(result).toBe(true);
    });

    it('should undo (Ctrl+Z)', async () => {
      const result = await actions.undo();
      expect(result).toBe(true);
    });

    it('should redo (Ctrl+Y)', async () => {
      const result = await actions.redo();
      expect(result).toBe(true);
    });

    it('should save (Ctrl+S)', async () => {
      const result = await actions.save();
      expect(result).toBe(true);
    });

    it('should close window (Alt+F4)', async () => {
      const result = await actions.closeWindow();
      expect(result).toBe(true);
    });

    it('should refresh (F5)', async () => {
      const result = await actions.refresh();
      expect(result).toBe(true);
    });

    it('should press Delete', async () => {
      const result = await actions.pressDelete();
      expect(result).toBe(true);
    });

    it('should press Backspace', async () => {
      const result = await actions.pressBackspace();
      expect(result).toBe(true);
    });
  });

  // ========== clearField tests ==========

  describe('clearField', () => {
    it('should clear a text field', async () => {
      const result = await actions.clearField(textInput);
      expect(result).toBe(true);
    });
  });

  // ========== fillField tests ==========

  describe('fillField', () => {
    it('should fill a text field', async () => {
      const result = await actions.fillField(textInput, 'New Value');
      expect(result).toBe(true);
    });
  });

  // ========== tripleClick tests ==========

  describe('tripleClick', () => {
    it('should triple-click an element', async () => {
      const result = await actions.tripleClick(enabledButton);
      expect(result).toBe(true);
    });

    it('should throw for disabled element', async () => {
      await expect(actions.tripleClick(disabledButton)).rejects.toThrow(UIAError);
    });
  });

  // ========== typeSlowly tests ==========

  describe('typeSlowly', () => {
    it('should type text with delay', async () => {
      const result = await actions.typeSlowly('abc', 10);
      expect(result).toBe(true);
    });
  });

  // ========== pressArrow tests ==========

  describe('pressArrow', () => {
    it('should press arrow up', async () => {
      const result = await actions.pressArrow('up');
      expect(result).toBe(true);
    });

    it('should press arrow down multiple times', async () => {
      const result = await actions.pressArrow('down', 3);
      expect(result).toBe(true);
    });

    it('should press arrow left', async () => {
      const result = await actions.pressArrow('left');
      expect(result).toBe(true);
    });

    it('should press arrow right', async () => {
      const result = await actions.pressArrow('right', 2);
      expect(result).toBe(true);
    });
  });

  // ========== Navigation keys tests ==========

  describe('navigation keys', () => {
    it('should press Home', async () => {
      const result = await actions.pressHome();
      expect(result).toBe(true);
    });

    it('should press End', async () => {
      const result = await actions.pressEnd();
      expect(result).toBe(true);
    });

    it('should go to beginning (Ctrl+Home)', async () => {
      const result = await actions.goToBeginning();
      expect(result).toBe(true);
    });

    it('should go to end (Ctrl+End)', async () => {
      const result = await actions.goToEnd();
      expect(result).toBe(true);
    });

    it('should page up', async () => {
      const result = await actions.pageUp();
      expect(result).toBe(true);
    });

    it('should page down', async () => {
      const result = await actions.pageDown();
      expect(result).toBe(true);
    });
  });
});
