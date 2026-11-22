// The presenter window: the same app opened with `?view=presenter`. The main window is the source of
// truth. This window asks it for the state (REQUEST_STATE), receives the presentation and the
// current slide (STATE, SYNC), shows the current slide, the next one, the notes and two timers, and
// drives the main window with COMMANDs. The timers are local to this window. Nothing is stored.
import { Commands, MessageType } from '../../core/messages.js';
import { formatDuration } from '../../core/text.js';
import * as timers from '../../core/timers.js';
import { createChannel } from '../channel.js';
import { showSlide } from './slide-content.js';
import { setSlideHtml } from './slide-html.js';
import * as UI from './ui.js';

const { el, icon, t } = UI;

/** @param {HTMLElement} rootEl */
export function mountPresenter(rootEl) {
  const channel = createChannel();
  /** @type {import('../../core/parser.js').Presentation | null} */
  let presentation = null;
  /** @type {Readonly<Record<string, string>>} */
  let assets = {};
  let currentIndex = 0;
  let timerState = timers.createTimers(Date.now());

  document.title = t('presenter.title');

  /* ---- the bar: timers and counter ---- */
  const totalValue = el(
    'span',
    { class: 'sl-presenter__time cv-num', 'data-testid': 'timer-total' },
    '00:00',
  );
  const slideValue = el(
    'span',
    { class: 'sl-presenter__time cv-num', 'data-testid': 'timer-slide' },
    '00:00',
  );
  const counter = el('span', { class: 'sl-presenter__counter cv-num', 'data-testid': 'counter' });
  const playButton = UI.IconButton({
    icon: 'play',
    label: t('presenter.start'),
    onclick: () => {
      timerState =
        timerState.runningSince === null
          ? timers.play(timerState, Date.now())
          : timers.pause(timerState, Date.now());
      paintTimers();
    },
  });
  const resetButton = UI.IconButton({
    icon: 'arrow-counter-clockwise',
    label: t('presenter.reset'),
    onclick: () => {
      timerState = timers.resetTotal(timerState, Date.now());
      paintTimers();
    },
  });

  function paintTimers() {
    const now = Date.now();
    const reading = timers.readout(timerState, now);
    totalValue.textContent = formatDuration(reading.total);
    slideValue.textContent = formatDuration(reading.slide);
    const label = reading.running ? t('presenter.pause') : t('presenter.start');
    playButton.button.setAttribute('aria-label', label);
    const tip = playButton.querySelector('.cv-tooltip');
    if (tip) tip.textContent = label;
    const glyph = playButton.button.querySelector('i');
    glyph?.classList.toggle('ph-play', !reading.running);
    glyph?.classList.toggle('ph-pause', reading.running);
    root.dataset.running = String(reading.running);
  }

  /* ---- the slide, the next one and the notes ---- */
  const content = el('div', {
    class: 'sl-slide__content cv-prose',
    tabindex: 0,
    role: 'region',
    'aria-label': t('presenter.current'),
    'data-testid': 'slide',
  });
  const slidePane = el(
    'section',
    { class: 'sl-presenter__current' },
    el('div', { class: 'sl-slide' }, content),
  );
  const nextNumber = el('span', { class: 'sl-presenter__next-number cv-num' });
  const nextTitle = el('p', { class: 'sl-presenter__next-title' });
  const nextDescription = el('p', { class: 'sl-meta' });
  const notesPresenter = el('div', { class: 'cv-prose', 'data-testid': 'notes-presenter' });
  const notesPublic = el('div', { class: 'cv-prose', 'data-testid': 'notes-public' });
  const side = el(
    'aside',
    { class: 'sl-presenter__side' },
    el(
      'section',
      { class: 'sl-card', 'aria-labelledby': 'presenter-next-title' },
      el('h2', { class: 'cv-overline', id: 'presenter-next-title' }, t('presenter.next')),
      nextNumber,
      nextTitle,
      nextDescription,
    ),
    el(
      'section',
      { class: 'sl-card sl-presenter__notes', 'aria-labelledby': 'presenter-notes-title' },
      el(
        'h2',
        { class: 'cv-overline', id: 'presenter-notes-title' },
        t('presenter.notesPresenter'),
      ),
      notesPresenter,
      el('h2', { class: 'cv-overline sl-presenter__notes-public' }, t('presenter.notesPublic')),
      notesPublic,
    ),
    el(
      'div',
      { class: 'sl-row sl-gap-3' },
      UI.Button({
        icon: 'caret-left',
        children: t('presenter.previousSlide'),
        onclick: () => channel.post(Commands.previous),
      }),
      UI.Button({
        variant: 'primary',
        icon: 'caret-right',
        children: t('presenter.nextSlide'),
        onclick: () => channel.post(Commands.next),
      }),
    ),
  );

  /* ---- waiting for the main window ---- */
  const waiting = el(
    'div',
    { class: 'sl-presenter__waiting', role: 'status', 'data-testid': 'waiting' },
    icon('presentation-chart', { className: 'sl-dropzone__icon' }),
    el('p', null, t('presenter.waiting')),
    UI.Button({ icon: 'arrow-clockwise', children: t('presenter.ask'), onclick: () => ask() }),
  );

  const grid = el('div', { class: 'sl-presenter__grid' }, slidePane, side);
  grid.hidden = true;
  const root = el(
    'div',
    { class: 'sl-presenter', 'data-running': 'false' },
    el(
      'header',
      { class: 'sl-presenter__bar' },
      el('h1', { class: 'sl-presenter__heading' }, t('presenter.heading')),
      el(
        'div',
        { class: 'sl-presenter__timer' },
        el('span', { class: 'cv-overline' }, t('presenter.total')),
        totalValue,
        playButton,
        resetButton,
      ),
      el(
        'div',
        { class: 'sl-presenter__timer' },
        el('span', { class: 'cv-overline' }, t('presenter.slideTimer')),
        slideValue,
      ),
      counter,
    ),
    el('main', { class: 'sl-presenter__main', id: 'shell-main' }, waiting, grid),
  );
  rootEl.replaceChildren(root);
  UI.initCovenant(root);

  /* ---- drawing ---- */
  function draw() {
    if (!presentation) return;
    const slides = presentation.slides;
    const slide = slides[currentIndex];
    if (!slide) return;
    const upcoming = slides[currentIndex + 1];
    const theme = presentation.meta.theme;

    waiting.hidden = true;
    grid.hidden = false;
    slidePane.dataset.theme = theme;
    counter.textContent = t('nav.counter', { current: currentIndex + 1, total: slides.length });
    document.title = presentation.meta.title
      ? t('presenter.titleWith', { title: presentation.meta.title })
      : t('presenter.title');

    void showSlide(content, slide.html, assets, theme);
    paintNotes(notesPresenter, slide.notes.presenter, t('presenter.noPresenterNotes'));
    paintNotes(notesPublic, slide.notes.public, t('presenter.noPublicNotes'));

    if (upcoming) {
      nextNumber.textContent = String(currentIndex + 2);
      nextTitle.textContent =
        upcoming.meta.title || t('slide.untitled', { number: currentIndex + 2 });
      nextDescription.textContent = upcoming.meta.description;
    } else {
      nextNumber.textContent = '';
      nextTitle.textContent = t('presenter.end');
      nextDescription.textContent = '';
    }
  }

  /**
   * @param {HTMLElement} target
   * @param {string} html
   * @param {string} empty
   */
  function paintNotes(target, html, empty) {
    if (html) {
      setSlideHtml(target, html, assets);
    } else {
      target.replaceChildren(el('p', { class: 'sl-meta' }, empty));
    }
  }

  /* ---- the channel ---- */
  channel.onMessage((message) => {
    if (message.type === MessageType.STATE) {
      presentation = message.presentation;
      assets = message.assets;
      currentIndex = message.currentIndex;
      timerState = timers.resetSlide(timerState, Date.now());
      draw();
    } else if (message.type === MessageType.SYNC && presentation) {
      const index = Math.min(message.currentIndex, presentation.slides.length - 1);
      if (index !== currentIndex) {
        currentIndex = index;
        timerState = timers.resetSlide(timerState, Date.now());
        draw();
      }
    }
  });

  function ask() {
    channel.post({ type: MessageType.REQUEST_STATE });
  }

  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const target = /** @type {HTMLElement | null} */ (event.target);
    if (target?.closest('input, textarea, select')) return;
    if (target?.closest('button, a[href]') && (event.key === ' ' || event.key === 'Enter')) return;
    if (
      event.key === 'ArrowRight' ||
      event.key === 'ArrowDown' ||
      event.key === ' ' ||
      event.key === 'PageDown'
    ) {
      event.preventDefault();
      channel.post(Commands.next);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault();
      channel.post(Commands.previous);
    } else if (event.key === 'Home' && presentation) {
      event.preventDefault();
      channel.post(Commands.goto(0));
    } else if (event.key === 'End' && presentation) {
      event.preventDefault();
      channel.post(Commands.goto(presentation.slides.length - 1));
    }
  });

  paintTimers();
  setInterval(paintTimers, 250);
  // The main window may already have a presentation open: ask for it.
  ask();
}
