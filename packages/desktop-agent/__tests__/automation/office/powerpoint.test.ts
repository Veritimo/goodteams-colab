/**
 * PowerPoint Automation Tests
 *
 * Tests for PowerPoint COM automation using mock bindings.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setUseMockBindings,
  resetBindings,
  resetMockDataStore,
  getMockDataStore,
} from '../../../src/automation/office/bindings.js';
import {
  isPowerPointAvailable,
  openPresentation,
  createPresentation,
  getActivePresentation,
  closePresentation,
  savePresentation,
  listSlides,
  getSlideText,
  addSlide,
  deleteSlide,
  quitPowerPoint,
  getPresentationText,
  getPresentationSummary,
  createSimplePresentation,
  OfficeNotInstalledError,
} from '../../../src/automation/office/powerpoint.js';

describe('PowerPoint Automation', () => {
  beforeEach(() => {
    setUseMockBindings(true);
    resetMockDataStore();
  });

  afterEach(() => {
    resetBindings();
    resetMockDataStore();
  });

  describe('isPowerPointAvailable', () => {
    it('should return true when mock bindings are used', async () => {
      const available = await isPowerPointAvailable();
      expect(available).toBe(true);
    });
  });

  describe('createPresentation', () => {
    it('should create a new presentation', async () => {
      const pres = await createPresentation();

      expect(pres).toBeDefined();
      expect(pres.name).toMatch(/^Presentation\d+\.pptx$/);
      expect(pres.path).toBeNull();
      expect(pres.slideCount).toBe(1);
      expect(pres.isDirty).toBe(false);
    });

    it('should create multiple presentations with unique names', async () => {
      const pres1 = await createPresentation();
      const pres2 = await createPresentation();

      expect(pres1.name).not.toBe(pres2.name);
    });

    it('should set the created presentation as active', async () => {
      const pres = await createPresentation();
      const active = await getActivePresentation();

      expect(active).toBe(pres);
    });
  });

  describe('openPresentation', () => {
    it('should open an existing presentation', async () => {
      const pres = await openPresentation('C:\\Presentations\\Deck.pptx');

      expect(pres).toBeDefined();
      expect(pres.name).toBe('Deck.pptx');
      expect(pres.path).toBe('C:\\Presentations\\Deck.pptx');
    });

    it('should return the same presentation if opened twice', async () => {
      const pres1 = await openPresentation('slides.pptx');
      const pres2 = await openPresentation('slides.pptx');

      expect(pres1).toBe(pres2);
    });

    it('should set the opened presentation as active', async () => {
      const pres = await openPresentation('test.pptx');
      const active = await getActivePresentation();

      expect(active).toBe(pres);
    });
  });

  describe('getActivePresentation', () => {
    it('should return null when no presentation is open', async () => {
      const active = await getActivePresentation();
      expect(active).toBeNull();
    });

    it('should return the most recently opened presentation', async () => {
      await openPresentation('first.pptx');
      const second = await openPresentation('second.pptx');
      const active = await getActivePresentation();

      expect(active).toBe(second);
    });
  });

  describe('closePresentation', () => {
    it('should close a presentation', async () => {
      const pres = await createPresentation();
      await closePresentation(pres);

      const active = await getActivePresentation();
      expect(active).toBeNull();
    });

    it('should keep the presentation in the store (can be reopened)', async () => {
      const pres = await createPresentation();
      await closePresentation(pres);

      // Presentation stays in store (like a real file on disk)
      const store = getMockDataStore();
      expect(store.presentations.has(pres.name)).toBe(true);
    });
  });

  describe('savePresentation', () => {
    it('should save a presentation to a new path', async () => {
      const pres = await createPresentation();
      await savePresentation(pres, 'C:\\Output\\Deck.pptx');

      expect(pres.path).toBe('C:\\Output\\Deck.pptx');
      expect(pres.name).toBe('Deck.pptx');
      expect(pres.isDirty).toBe(false);
    });
  });

  describe('listSlides', () => {
    it('should list all slides in a presentation', async () => {
      const pres = await createPresentation();
      const slides = await listSlides(pres);

      expect(slides).toHaveLength(1);
      expect(slides[0].index).toBe(1); // 1-based
      expect(slides[0].layout).toBeDefined();
    });

    it('should reflect added slides', async () => {
      const pres = await createPresentation();
      await addSlide(pres);
      await addSlide(pres);

      const slides = await listSlides(pres);

      expect(slides).toHaveLength(3);
    });
  });

  describe('getSlideText', () => {
    it('should return text content from a slide', async () => {
      const pres = await createPresentation();
      const slides = await listSlides(pres);
      const text = await getSlideText(slides[0]);

      expect(typeof text).toBe('string');
    });
  });

  describe('addSlide', () => {
    it('should add a slide with default layout', async () => {
      const pres = await createPresentation();
      const slide = await addSlide(pres);

      expect(slide).toBeDefined();
      expect(slide.layout).toBe('titleAndContent');
      expect(pres.slideCount).toBe(2);
      expect(pres.isDirty).toBe(true);
    });

    it('should add a slide with specified layout', async () => {
      const pres = await createPresentation();
      const slide = await addSlide(pres, 'title');

      expect(slide.layout).toBe('title');
    });

    it('should add a blank slide', async () => {
      const pres = await createPresentation();
      const slide = await addSlide(pres, 'blank');

      expect(slide.layout).toBe('blank');
    });

    it('should increment slide count correctly', async () => {
      const pres = await createPresentation();
      expect(pres.slideCount).toBe(1);

      await addSlide(pres);
      expect(pres.slideCount).toBe(2);

      await addSlide(pres);
      expect(pres.slideCount).toBe(3);

      await addSlide(pres);
      expect(pres.slideCount).toBe(4);
    });
  });

  describe('deleteSlide', () => {
    it('should delete a slide', async () => {
      const pres = await createPresentation();
      await addSlide(pres);
      await addSlide(pres);

      expect(pres.slideCount).toBe(3);

      const slides = await listSlides(pres);
      await deleteSlide(slides[2]);

      expect(pres.slideCount).toBe(2);
      expect(pres.isDirty).toBe(true);
    });
  });

  describe('quitPowerPoint', () => {
    it('should quit PowerPoint and clear presentations', async () => {
      await createPresentation();
      await createPresentation();

      await quitPowerPoint();

      const active = await getActivePresentation();
      expect(active).toBeNull();

      const store = getMockDataStore();
      expect(store.presentations.size).toBe(0);
    });
  });

  describe('getPresentationText', () => {
    it('should get text from all slides', async () => {
      const pres = await openPresentation('test.pptx');
      await addSlide(pres);
      await addSlide(pres);
      await closePresentation(pres);

      const texts = await getPresentationText('test.pptx');

      expect(Array.isArray(texts)).toBe(true);
      expect(texts.length).toBe(3);
    });
  });

  describe('getPresentationSummary', () => {
    it('should get presentation summary', async () => {
      const pres = await openPresentation('deck.pptx');
      await addSlide(pres);
      await closePresentation(pres);

      const summary = await getPresentationSummary('deck.pptx');

      expect(summary.name).toBe('deck.pptx');
      expect(summary.slideCount).toBe(2);
      expect(summary.titles).toHaveLength(2);
    });
  });

  describe('createSimplePresentation', () => {
    it('should create a presentation with multiple slides', async () => {
      await createSimplePresentation('intro.pptx', [
        { title: 'Introduction' },
        { title: 'Overview' },
        { title: 'Conclusion' },
      ]);

      const summary = await getPresentationSummary('intro.pptx');

      expect(summary.slideCount).toBe(3);
    });
  });

  describe('error handling', () => {
    it('should handle OfficeNotInstalledError', async () => {
      setUseMockBindings(false);
      resetBindings();

      if (process.platform !== 'win32') {
        await expect(createPresentation()).rejects.toThrow(OfficeNotInstalledError);
      }
    });
  });
});
