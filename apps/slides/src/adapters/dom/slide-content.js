// Puts a slide on screen: sanitized HTML first, then the diagrams it holds (the Mermaid chunk is
// fetched only when there is one). Used by the main window, the presenter window and the print view.
import { renderDiagrams } from './diagrams.js';
import { setSlideHtml } from './slide-html.js';

/**
 * @param {HTMLElement} target the element that holds the slide
 * @param {string} html the rendered Markdown of the slide, not trusted
 * @param {Readonly<Record<string, string>>} assets image path to object URL
 * @param {'light' | 'dark'} theme the theme of the slides, for the diagrams
 * @returns {Promise<void>} resolves once the diagrams are drawn
 */
export async function showSlide(target, html, assets, theme) {
  setSlideHtml(target, html, assets);
  target.scrollTop = 0;
  await renderDiagrams(target, theme);
}
