// The presentation screen: the current slide in a frame (16:9, or fitted to the window) and a
// control bar with the slider, the counter, "go to", and the buttons for the overview, the
// presenter window, print, the frame, full screen, the preferences and closing the presentation.
// The slide is themed by its own frontmatter (`data-theme` on the stage, on Covenant's tokens); the
// control bar follows the theme of the app.
import { openOverview } from './Overview.js';
import { showSlide } from './slide-content.js';
import * as UI from './ui.js';

const { el, t } = UI;

/** @typedef {import('../../core/store.js').State} State */
/** @typedef {import('../../core/store.js').Command} Command */

/**
 * @param {object} actions
 * @param {(command: Command) => void} actions.dispatch
 * @param {() => State} actions.getState
 * @param {() => void} actions.onPresenter
 * @param {() => void} actions.onPrint
 * @param {() => void} actions.onFullscreen
 * @param {() => void} actions.onPreferences
 * @param {() => void} actions.onClose
 * @returns {{ el: HTMLElement, update: (state: State) => void, destroy: () => void }}
 */
export function createPresentationView(actions) {
  const { dispatch, getState } = actions;

  /* ---- the stage ---- */
  const content = el('div', {
    class: 'sl-slide__content cv-prose',
    tabindex: 0,
    role: 'region',
    'data-testid': 'slide',
  });
  const slide = el('section', { class: 'sl-slide' }, content);
  const stage = el('main', { class: 'sl-stage', id: 'slide-main' }, slide);

  /* ---- the control bar ---- */
  const previous = UI.IconButton({
    icon: 'caret-left',
    label: t('nav.previous'),
    onclick: () => dispatch({ type: 'previous' }),
  });
  const next = UI.IconButton({
    icon: 'caret-right',
    label: t('nav.next'),
    onclick: () => dispatch({ type: 'next' }),
  });
  const slider = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'range',
      class: 'sl-nav__slider',
      min: 0,
      step: 1,
      value: 0,
      'aria-label': t('nav.position'),
      oninput: (/** @type {Event} */ event) =>
        dispatch({
          type: 'navigate',
          index: Number(/** @type {HTMLInputElement} */ (event.target).value),
        }),
    })
  );
  const counter = el('span', {
    class: 'sl-nav__counter cv-num',
    'aria-live': 'polite',
    'data-testid': 'counter',
  });
  const goTo = UI.Input({
    ariaLabel: t('nav.goTo'),
    type: 'number',
    mono: true,
    className: 'sl-nav__goto',
  });
  goTo.input.min = '1';
  goTo.input.addEventListener('change', () => {
    const number = Number(goTo.input.value);
    if (Number.isFinite(number)) dispatch({ type: 'navigate', index: number - 1 });
    goTo.input.value = String(getState().currentIndex + 1);
  });

  const overviewButton = UI.IconButton({
    icon: 'squares-four',
    label: t('nav.overview'),
    onclick: () => dispatch({ type: 'open_overview' }),
  });
  const presenterButton = UI.IconButton({
    icon: 'presentation-chart',
    label: t('nav.presenter'),
    onclick: () => actions.onPresenter(),
  });
  const printButton = UI.IconButton({
    icon: 'printer',
    label: t('nav.print'),
    onclick: () => actions.onPrint(),
  });
  const ratioButton = UI.IconButton({
    icon: 'frame-corners',
    label: t('nav.fit'),
    onclick: () => dispatch({ type: 'toggle_ratio' }),
  });
  const fullscreenButton = UI.IconButton({
    icon: 'arrows-out',
    label: t('nav.fullscreen'),
    onclick: () => actions.onFullscreen(),
  });
  const preferencesButton = UI.IconButton({
    icon: 'gear',
    label: t('shell.preferences'),
    onclick: () => actions.onPreferences(),
  });
  const closeButton = UI.IconButton({
    icon: 'x',
    label: t('nav.close'),
    onclick: () => actions.onClose(),
  });
  for (const [button, keys] of /** @type {const} */ ([
    [overviewButton, 'o'],
    [presenterButton, 's'],
    [ratioButton, 'r'],
    [fullscreenButton, 'f'],
  ])) {
    button.button.setAttribute('aria-keyshortcuts', keys);
  }

  const nav = el(
    'nav',
    { class: 'sl-nav', 'aria-label': t('nav.label') },
    el(
      'div',
      { class: 'sl-nav__group sl-nav__group--position' },
      previous,
      slider,
      counter,
      goTo,
      next,
    ),
    el(
      'div',
      { class: 'sl-nav__group' },
      overviewButton,
      presenterButton,
      printButton,
      ratioButton,
      fullscreenButton,
      preferencesButton,
      closeButton,
    ),
  );

  const root = el('div', { class: 'sl-present' }, stage, nav);
  UI.initCovenant(root);

  /* ---- state to page ---- */
  /** @type {import('../../core/parser.js').Presentation | null} */
  let drawnPresentation = null;
  let drawnIndex = -1;
  /** @type {import('./types.js').ModalHandle | null} */
  let overview = null;

  function paintFullscreen() {
    const on = document.fullscreenElement !== null;
    fullscreenButton.button.setAttribute('aria-pressed', String(on));
  }
  document.addEventListener('fullscreenchange', paintFullscreen);
  paintFullscreen();

  return {
    el: root,
    update(state) {
      const presentation = state.presentation;
      if (!presentation) return;
      const total = presentation.slides.length;
      const index = state.currentIndex;
      stage.dataset.theme = presentation.meta.theme;
      stage.dataset.ratio = state.ratio;
      ratioButton.button.setAttribute('aria-pressed', String(state.ratio === 'auto'));

      slider.max = String(total - 1);
      slider.value = String(index);
      slider.setAttribute('aria-valuetext', t('nav.counter', { current: index + 1, total }));
      counter.textContent = t('nav.counter', { current: index + 1, total });
      goTo.input.max = String(total);
      if (document.activeElement !== goTo.input) goTo.input.value = String(index + 1);
      previous.button.disabled = index === 0;
      next.button.disabled = index === total - 1;

      content.setAttribute(
        'aria-label',
        t('stage.slideLabel', {
          current: index + 1,
          total,
          title: presentation.slides[index]?.meta.title ?? '',
        }),
      );
      if (drawnPresentation !== presentation || drawnIndex !== index) {
        drawnPresentation = presentation;
        drawnIndex = index;
        const current = presentation.slides[index];
        if (current) {
          void showSlide(content, current.html, state.assets, presentation.meta.theme);
        }
      }

      if (state.mode === 'overview' && !overview) {
        overview = openOverview({
          state,
          onPick: (picked) => dispatch({ type: 'navigate', index: picked }),
          onClose: () => {
            overview = null;
            dispatch({ type: 'close_overview' });
          },
        });
      } else if (state.mode === 'presentation' && overview) {
        const closing = overview;
        overview = null;
        closing.close();
      }
    },
    destroy() {
      document.removeEventListener('fullscreenchange', paintFullscreen);
      overview?.close();
    },
  };
}
