import { extractDirectives } from './directives.js';
import { PresentationError } from './errors.js';
import { extractFrontmatter } from './frontmatter.js';
import { createMarkdownRenderer } from './markdown.js';
import { splitSlides } from './slide-splitter.js';

/** The theme of the slides when the frontmatter does not say, and the frame they use. */
export const DEFAULT_SLIDE_THEME = 'dark';
export const DEFAULT_RATIO = 'fixed';
/** The paper is always light. */
export const PRINT_THEME = 'light';

/**
 * @typedef {'light' | 'dark'} SlideTheme
 * @typedef {'fixed' | 'auto'} Ratio
 * @typedef {{ title: string, description: string }} SlideSummary
 * @typedef {{
 *   index: number,
 *   html: string,
 *   notes: { public: string, presenter: string },
 *   meta: SlideSummary,
 * }} Slide
 * @typedef {{ title: string, description: string, author: string, theme: SlideTheme, ratio: Ratio }} PresentationMeta
 * @typedef {{ meta: PresentationMeta, slides: Slide[] }} Presentation
 */

/**
 * A frontmatter value as the text it stands for (a title written as a YAML number is still a
 * title); a list or a mapping is not text.
 * @param {unknown} value
 * @param {string} fallback
 */
function textOf(value, fallback) {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

/**
 * @param {import('./frontmatter.js').RawMeta} meta
 * @returns {PresentationMeta}
 */
function normalizeMeta(meta) {
  return {
    title: textOf(meta.title, ''),
    description: textOf(meta.description, ''),
    author: textOf(meta.author, ''),
    theme: meta.theme === 'light' ? 'light' : DEFAULT_SLIDE_THEME,
    ratio: meta.ratio === 'auto' ? 'auto' : DEFAULT_RATIO,
  };
}

/**
 * Turns the text of `slides.md` into a presentation: plain data (HTML strings and numbers) that
 * can be sent to another window. The HTML is not sanitized here; see `createMarkdownRenderer`.
 * @param {string} source
 * @returns {Presentation}
 * @throws {PresentationError} `invalid-frontmatter` or `no-slides`
 */
export function parsePresentation(source) {
  const { meta, body } = extractFrontmatter(source);
  const renderer = createMarkdownRenderer();

  const slides = splitSlides(body).map((slideSource, index) => {
    const { content, notes } = extractDirectives(slideSource);
    const rendered = renderer.render(content);
    return {
      index,
      html: rendered.html,
      notes: {
        public: renderer.render(notes.public).html,
        presenter: renderer.render(notes.presenter).html,
      },
      meta: { title: rendered.title, description: rendered.description },
    };
  });

  if (slides.length === 0) throw new PresentationError('no-slides');
  return { meta: normalizeMeta(meta), slides };
}
