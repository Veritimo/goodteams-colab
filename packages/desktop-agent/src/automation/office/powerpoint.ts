/**
 * PowerPoint Automation
 *
 * High-level API for PowerPoint automation via COM bindings.
 * Provides presentation and slide manipulation capabilities.
 */

import {
  getBindings,
  type IPowerPointBindings,
  OfficeNotInstalledError,
  COMError,
} from './bindings.js';
import type {
  PowerPointPresentation,
  PowerPointSlide,
  SlideLayout,
  PowerPointOpenOptions,
} from './types.js';

/**
 * Get PowerPoint bindings
 */
function getPowerPoint(): IPowerPointBindings {
  return getBindings().powerpoint;
}

// ============================================================================
// Availability
// ============================================================================

/**
 * Check if PowerPoint is available on this system
 */
export async function isPowerPointAvailable(): Promise<boolean> {
  try {
    return await getPowerPoint().isAvailable();
  } catch {
    return false;
  }
}

/**
 * Ensure PowerPoint is available, throw if not
 */
async function ensurePowerPointAvailable(): Promise<IPowerPointBindings> {
  const ppt = getPowerPoint();
  const available = await ppt.isAvailable();
  if (!available) {
    throw new OfficeNotInstalledError('PowerPoint');
  }
  return ppt;
}

// ============================================================================
// Presentation Operations
// ============================================================================

/**
 * Open an existing PowerPoint presentation
 *
 * @param path - Path to the presentation file
 * @param options - Open options (readOnly, etc.)
 * @returns The opened presentation
 *
 * @example
 * ```ts
 * const pres = await openPresentation('C:\\Presentations\\Deck.pptx');
 * const pres = await openPresentation('slides.pptx', { readOnly: true });
 * ```
 */
export async function openPresentation(
  path: string,
  options?: PowerPointOpenOptions
): Promise<PowerPointPresentation> {
  const ppt = await ensurePowerPointAvailable();
  return ppt.openPresentation(path, options);
}

/**
 * Create a new PowerPoint presentation
 *
 * @returns The new presentation (with one blank slide)
 *
 * @example
 * ```ts
 * const pres = await createPresentation();
 * await addSlide(pres, 'title');
 * ```
 */
export async function createPresentation(): Promise<PowerPointPresentation> {
  const ppt = await ensurePowerPointAvailable();
  return ppt.createPresentation();
}

/**
 * Get the currently active presentation in PowerPoint
 *
 * @returns The active presentation, or null if none open
 *
 * @example
 * ```ts
 * const pres = await getActivePresentation();
 * if (pres) {
 *   console.log(`Active: ${pres.name} (${pres.slideCount} slides)`);
 * }
 * ```
 */
export async function getActivePresentation(): Promise<PowerPointPresentation | null> {
  const ppt = await ensurePowerPointAvailable();
  return ppt.getActivePresentation();
}

/**
 * Close a presentation
 *
 * @param presentation - The presentation to close
 * @param save - Whether to save changes before closing (default: false)
 *
 * @example
 * ```ts
 * await closePresentation(pres); // Close without saving
 * await closePresentation(pres, true); // Save and close
 * ```
 */
export async function closePresentation(
  presentation: PowerPointPresentation,
  save?: boolean
): Promise<void> {
  const ppt = await ensurePowerPointAvailable();
  return ppt.closePresentation(presentation, save);
}

/**
 * Save a presentation
 *
 * @param presentation - The presentation to save
 * @param path - Optional new path (Save As)
 *
 * @example
 * ```ts
 * await savePresentation(pres); // Save in place
 * await savePresentation(pres, 'backup.pptx'); // Save As
 * ```
 */
export async function savePresentation(
  presentation: PowerPointPresentation,
  path?: string
): Promise<void> {
  const ppt = await ensurePowerPointAvailable();
  return ppt.savePresentation(presentation, path);
}

// ============================================================================
// Slide Operations
// ============================================================================

/**
 * List all slides in a presentation
 *
 * @param presentation - The presentation
 * @returns Array of slides
 *
 * @example
 * ```ts
 * const slides = await listSlides(pres);
 * slides.forEach((s, i) => console.log(`Slide ${i+1}: ${s.title}`));
 * ```
 */
export async function listSlides(
  presentation: PowerPointPresentation
): Promise<PowerPointSlide[]> {
  const ppt = await ensurePowerPointAvailable();
  return ppt.listSlides(presentation);
}

/**
 * Get text content from a slide
 *
 * @param slide - The slide
 * @returns All text content on the slide
 *
 * @example
 * ```ts
 * const text = await getSlideText(slide);
 * console.log(`Slide text: ${text}`);
 * ```
 */
export async function getSlideText(slide: PowerPointSlide): Promise<string> {
  const ppt = await ensurePowerPointAvailable();
  return ppt.getSlideText(slide);
}

/**
 * Add a new slide to a presentation
 *
 * @param presentation - The presentation
 * @param layout - Slide layout (default: titleAndContent)
 * @returns The new slide
 *
 * @example
 * ```ts
 * const slide = await addSlide(pres); // Default layout
 * const slide = await addSlide(pres, 'title'); // Title slide
 * const slide = await addSlide(pres, 'blank'); // Blank slide
 * ```
 */
export async function addSlide(
  presentation: PowerPointPresentation,
  layout?: SlideLayout
): Promise<PowerPointSlide> {
  const ppt = await ensurePowerPointAvailable();
  return ppt.addSlide(presentation, layout);
}

/**
 * Delete a slide from a presentation
 *
 * @param slide - The slide to delete
 *
 * @example
 * ```ts
 * const slides = await listSlides(pres);
 * await deleteSlide(slides[slides.length - 1]); // Delete last slide
 * ```
 */
export async function deleteSlide(slide: PowerPointSlide): Promise<void> {
  const ppt = await ensurePowerPointAvailable();
  return ppt.deleteSlide(slide);
}

// ============================================================================
// Application Control
// ============================================================================

/**
 * Quit PowerPoint application
 *
 * WARNING: This will close all open presentations
 *
 * @example
 * ```ts
 * await quitPowerPoint();
 * ```
 */
export async function quitPowerPoint(): Promise<void> {
  const ppt = await ensurePowerPointAvailable();
  return ppt.quit();
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get all text content from a presentation
 *
 * @param path - Path to the presentation
 * @returns Array of slide texts
 *
 * @example
 * ```ts
 * const texts = await getPresentationText('slides.pptx');
 * texts.forEach((text, i) => console.log(`Slide ${i+1}: ${text}`));
 * ```
 */
export async function getPresentationText(path: string): Promise<string[]> {
  const pres = await openPresentation(path, { readOnly: true });
  try {
    const slides = await listSlides(pres);
    const texts: string[] = [];
    for (const slide of slides) {
      texts.push(await getSlideText(slide));
    }
    return texts;
  } finally {
    await closePresentation(pres, false);
  }
}

/**
 * Get presentation summary (titles and slide count)
 *
 * @param path - Path to the presentation
 * @returns Summary object
 *
 * @example
 * ```ts
 * const summary = await getPresentationSummary('deck.pptx');
 * console.log(`${summary.slideCount} slides`);
 * summary.titles.forEach((t, i) => console.log(`${i+1}. ${t}`));
 * ```
 */
export async function getPresentationSummary(
  path: string
): Promise<{ name: string; slideCount: number; titles: string[] }> {
  const pres = await openPresentation(path, { readOnly: true });
  try {
    const slides = await listSlides(pres);
    return {
      name: pres.name,
      slideCount: pres.slideCount,
      titles: slides.map((s) => s.title || '(untitled)'),
    };
  } finally {
    await closePresentation(pres, false);
  }
}

/**
 * Create a simple presentation with title slides
 *
 * @param path - Path to save the presentation
 * @param slides - Array of { title, content } objects
 *
 * @example
 * ```ts
 * await createSimplePresentation('intro.pptx', [
 *   { title: 'Introduction', content: 'Welcome to our presentation' },
 *   { title: 'Overview', content: 'Today we will cover...' },
 *   { title: 'Conclusion', content: 'Thank you!' },
 * ]);
 * ```
 */
export async function createSimplePresentation(
  path: string,
  slides: Array<{ title: string; content?: string }>
): Promise<void> {
  const pres = await createPresentation();
  try {
    // First slide is already created, add more as needed
    for (let i = 1; i < slides.length; i++) {
      await addSlide(pres, 'titleAndContent');
    }
    // Note: Setting slide content would require additional bindings
    await savePresentation(pres, path);
  } finally {
    await closePresentation(pres, false);
  }
}

// Re-export types
export type {
  PowerPointPresentation,
  PowerPointSlide,
  SlideLayout,
  PowerPointOpenOptions,
};
export { OfficeNotInstalledError, COMError };
