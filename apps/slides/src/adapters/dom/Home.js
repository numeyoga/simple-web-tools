// The home screen, shown while no presentation is open (the AppShell of the Covenant skill): skip
// link, sidebar (brand, app switcher), top bar (page title, preferences) and the main region with the
// ways to open a presentation: choose a folder, drop one, or load the bundled example. Below 1024 px
// the sidebar is an off-canvas drawer, which the skill's own script opens and closes.
import { createAppBrand, createAppSwitcher } from '@simple-web-tools/suite/dom';
import { MAIN_FILE } from '../../core/folder.js';
import { openPreferences, shortcutsList } from './Preferences.js';
import * as UI from './ui.js';

const { el, icon, t, tNodes } = UI;

/** Id of this app in the suite registry (brand, switcher, icon). */
export const APP_ID = 'slides';

/** @typedef {import('../../core/store.js').State} State */

/**
 * The sentence for a failed load, in the language of the interface.
 * @param {import('../../core/store.js').LoadFailure} error
 * @returns {{ title: string, text: string }}
 */
export function describeFailure({ code, detail }) {
  switch (code) {
    case 'no-main-file':
      return { title: t('error.noMainFile.title'), text: t('error.noMainFile.text') };
    case 'no-slides':
      return { title: t('error.noSlides.title'), text: t('error.noSlides.text') };
    case 'invalid-frontmatter':
      return {
        title: t('error.frontmatter.title'),
        text: detail ? t('error.frontmatter.textDetail', { detail }) : t('error.frontmatter.text'),
      };
    case 'source-too-large':
      return { title: t('error.tooLarge.title'), text: t('error.tooLarge.text') };
    default:
      return { title: t('error.unreadable.title'), text: t('error.unreadable.text') };
  }
}

/**
 * @param {object} actions
 * @param {(files: FileList) => void} actions.onFolder files of the `<input webkitdirectory>`
 * @param {(dataTransfer: DataTransfer) => void} actions.onDrop a drop on the page
 * @param {() => void} actions.onExample
 * @returns {{ el: HTMLElement, update: (state: State, busy: boolean) => void }}
 */
export function createHome({ onFolder, onDrop, onExample }) {
  const input = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'file',
      class: 'sl-folder-input',
      hidden: true,
      'data-testid': 'folder-input',
      onchange: (/** @type {Event} */ event) => {
        const { files } = /** @type {HTMLInputElement} */ (event.target);
        if (files && files.length > 0) onFolder(files);
        // The same folder can be chosen again once it has changed.
        input.value = '';
      },
    })
  );
  input.setAttribute('webkitdirectory', '');
  input.setAttribute('directory', '');

  const chooseButton = UI.Button({
    variant: 'primary',
    icon: 'folder-open',
    children: t('home.choose'),
    onclick: () => input.click(),
  });
  const exampleButton = UI.Button({
    icon: 'presentation-chart',
    children: t('home.example'),
    onclick: () => onExample(),
  });
  const status = el('p', { class: 'sl-meta sl-status', role: 'status' });
  const errorSlot = el('div', { class: 'sl-error-slot' });

  const dropZone = el(
    'section',
    { class: 'sl-dropzone', 'aria-labelledby': 'home-open-title', 'data-testid': 'dropzone' },
    icon('folder-open', { className: 'sl-dropzone__icon' }),
    el('h2', { class: 'cv-h3', id: 'home-open-title' }, t('home.openTitle')),
    el(
      'p',
      { class: 'sl-dropzone__text' },
      tNodes('home.openText', { file: el('code', null, MAIN_FILE) }),
    ),
    el('div', { class: 'sl-row sl-gap-3 sl-wrap sl-center-x' }, chooseButton, exampleButton),
    input,
    status,
  );

  // A drop anywhere on the page opens the folder. Dragging a folder over the zone shows where it goes.
  let depth = 0;
  /** @param {DragEvent} event */
  const hasFiles = (event) => Array.from(event.dataTransfer?.types ?? []).includes('Files');
  const main = el('main', { class: 'cv-shell__content sl-main', id: 'shell-main', tabindex: -1 });
  main.addEventListener('dragenter', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth += 1;
    dropZone.classList.add('sl-dropzone--over');
  });
  main.addEventListener('dragover', (event) => {
    if (hasFiles(event)) event.preventDefault();
  });
  main.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (depth === 0) dropZone.classList.remove('sl-dropzone--over');
  });
  main.addEventListener('drop', (event) => {
    if (!hasFiles(event) || !event.dataTransfer) return;
    event.preventDefault();
    depth = 0;
    dropZone.classList.remove('sl-dropzone--over');
    onDrop(event.dataTransfer);
  });

  const howTo = el(
    'section',
    { class: 'sl-card cv-prose', 'aria-labelledby': 'home-format-title' },
    el('h2', { class: 'cv-h3', id: 'home-format-title' }, t('home.formatTitle')),
    el('p', null, tNodes('home.formatIntro', { file: el('code', null, MAIN_FILE) })),
    el(
      'ul',
      null,
      el('li', null, tNodes('home.formatSeparator', { separator: el('code', null, '---') })),
      el(
        'li',
        null,
        tNodes('home.formatFrontmatter', {
          keys: el('code', null, 'title, description, author, theme, ratio'),
        }),
      ),
      el(
        'li',
        null,
        tNodes('home.formatNotes', {
          presenter: el('code', null, ':::notes-presenter'),
          public: el('code', null, ':::notes-public'),
        }),
      ),
      el('li', null, tNodes('home.formatImages', { folder: el('code', null, 'assets/') })),
      el('li', null, tNodes('home.formatDiagrams', { language: el('code', null, 'mermaid') })),
    ),
    el('p', { class: 'sl-meta' }, t('home.formatPrivacy')),
  );

  const shortcuts = el(
    'section',
    { class: 'sl-card sl-stack sl-gap-3', 'aria-labelledby': 'home-keys-title' },
    el('h2', { class: 'cv-h3', id: 'home-keys-title' }, t('home.shortcutsTitle')),
    shortcutsList(),
  );

  main.append(errorSlot, dropZone, el('div', { class: 'sl-home-grid' }, howTo, shortcuts));

  const menuButton = el(
    'button',
    {
      type: 'button',
      class: 'cv-btn cv-btn--ghost cv-btn--icon cv-shell__menu',
      'data-cv-nav-toggle': '',
      'aria-controls': 'shell-nav',
      'aria-expanded': 'false',
      'aria-label': t('shell.menu'),
    },
    icon('list'),
  );

  const sidebar = el(
    'nav',
    { id: 'shell-nav', 'aria-label': t('shell.navLabel'), class: 'cv-sidebar' },
    createAppBrand(APP_ID),
    createAppSwitcher(APP_ID, { label: t('shell.apps') }),
  );

  const shell = el(
    'div',
    { class: 'cv-shell' },
    el('a', { class: 'cv-skip-link', href: '#shell-main' }, t('shell.skipLink')),
    sidebar,
    el('div', { class: 'cv-shell__scrim' }),
    el(
      'div',
      { class: 'cv-shell__main' },
      el(
        'header',
        { class: 'cv-topbar' },
        menuButton,
        el('h1', { class: 'cv-topbar__title' }, t('home.title')),
        el('span', { class: 'cv-topbar__spacer' }),
        UI.IconButton({
          icon: 'gear',
          label: t('shell.preferences'),
          onclick: () => openPreferences(),
        }),
      ),
      main,
    ),
  );

  return {
    el: shell,
    update(state, busy) {
      chooseButton.disabled = busy;
      exampleButton.disabled = busy;
      status.textContent = busy ? t('home.reading') : '';
      if (state.error) {
        const { title, text } = describeFailure(state.error);
        errorSlot.replaceChildren(UI.Alert({ status: 'danger', title, text, live: true }));
      } else {
        errorSlot.replaceChildren();
      }
    },
  };
}
