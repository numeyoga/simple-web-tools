// The overview: a modal with one card per slide (number, title, first sentence). A click goes to
// the slide and closes it. It is a native `<dialog>` built by the shared Modal, so the page behind
// is inert, Escape closes it and focus returns to the button that opened it.
import * as UI from './ui.js';

const { el, t } = UI;

/** @typedef {import('../../core/store.js').State} State */

/**
 * @param {object} options
 * @param {State} options.state
 * @param {(index: number) => void} options.onPick called with the chosen slide, the modal then closes
 * @param {() => void} options.onClose called whenever the modal closes, by any way
 * @returns {import('./types.js').ModalHandle}
 */
export function openOverview({ state, onPick, onClose }) {
  const presentation = /** @type {import('../../core/parser.js').Presentation} */ (
    state.presentation
  );
  // The cards close the modal that holds them: it exists once the cards are built.
  const closer = { close: () => {} };
  const items = presentation.slides.map((slide, index) => {
    const current = index === state.currentIndex;
    return el(
      'li',
      null,
      el(
        'button',
        {
          type: 'button',
          class: 'sl-overview__item',
          'aria-current': current ? 'true' : null,
          'data-index': String(index),
          onclick: () => {
            onPick(index);
            closer.close();
          },
        },
        el('span', { class: 'sl-overview__number cv-num' }, String(index + 1)),
        el(
          'span',
          { class: 'sl-overview__title' },
          slide.meta.title || t('slide.untitled', { number: index + 1 }),
        ),
        slide.meta.description
          ? el('span', { class: 'sl-overview__description' }, slide.meta.description)
          : null,
      ),
    );
  });

  const modal = UI.Modal({
    title: t('overview.title'),
    body: el('ol', { class: 'sl-overview__grid', 'aria-label': t('overview.list') }, items),
    footer: UI.Button({ children: t('common.close'), onclick: () => modal.close() }),
    onclose: onClose,
  });
  closer.close = modal.close;
  modal.root.classList.add('sl-overview');
  modal.root.dataset.overview = '';
  modal.root.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
  return modal;
}
