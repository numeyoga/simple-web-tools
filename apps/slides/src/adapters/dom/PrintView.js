// The print document: one A4 page per slide, the slide in the upper half and its public notes in
// the lower half, always in the light theme and without a page background. It is built from the
// presentation when the person prints (the button, or Ctrl+P, which the app takes over so that the
// diagrams are drawn before the print dialog opens) and kept until the presentation changes.
//
// The element is in the page all the time but out of sight: `visibility: hidden` and out of the
// flow on screen (it has a real layout, which Mermaid needs to measure its labels), shown by the
// print stylesheet (styles/print.css), which hides everything else.
import { PRINT_THEME } from '../../core/parser.js';
import { showSlide } from './slide-content.js';
import { setSlideHtml } from './slide-html.js';
import * as UI from './ui.js';

const { el, t } = UI;

/** @typedef {import('../../core/store.js').State} State */

/** @param {{ getState: () => State }} store */
export function createPrintView(store) {
  const root = el('div', { class: 'sl-print', 'data-testid': 'print' });
  root.setAttribute('aria-hidden', 'true');
  /** @type {HTMLElement & { inert: boolean }} */ (root).inert = true;
  document.body.append(root);

  /** @type {import('../../core/parser.js').Presentation | null} */
  let builtFor = null;
  /** @type {Promise<void> | null} */
  let building = null;

  /** Builds the pages and draws their diagrams; resolves once the document is ready to print. */
  function build() {
    const { presentation, assets } = store.getState();
    if (!presentation) {
      // Nothing is open any more: Ctrl+P on the home screen must not print the previous talk.
      root.replaceChildren();
      builtFor = null;
      building = null;
      return Promise.resolve();
    }
    if (builtFor === presentation && building) return building;
    builtFor = presentation;

    const total = presentation.slides.length;
    const pages = presentation.slides.map((slide, index) => {
      const content = el('div', { class: 'sl-slide__content cv-prose' });
      const notes = el('div', {
        class: `sl-print__notes cv-prose${slide.notes.public ? '' : ' sl-print__notes--empty'}`,
      });
      if (slide.notes.public) setSlideHtml(notes, slide.notes.public, assets);
      return {
        slide,
        content,
        page: el(
          'section',
          { class: 'sl-print__page', 'data-theme': PRINT_THEME },
          el(
            'div',
            { class: 'sl-print__slide' },
            el(
              'div',
              { class: 'sl-print__index cv-num' },
              t('nav.counter', { current: index + 1, total }),
            ),
            content,
          ),
          notes,
        ),
      };
    });
    root.replaceChildren(...pages.map(({ page }) => page));

    building = (async () => {
      for (const { slide, content } of pages) {
        await showSlide(content, slide.html, assets, PRINT_THEME);
      }
    })();
    return building;
  }

  // Ctrl+P from the browser menu cannot wait for the diagrams: whatever is built by then is printed.
  window.addEventListener('beforeprint', () => {
    void build();
  });

  return {
    /** Builds the document, waits for the diagrams, and opens the print dialog. */
    async print() {
      await build();
      window.print();
    },
    build,
    destroy() {
      root.remove();
    },
  };
}
