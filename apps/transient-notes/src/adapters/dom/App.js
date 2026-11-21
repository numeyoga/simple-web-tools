// Main shell (the AppShell of the Covenant skill): skip link, sidebar (brand, workspace, the
// selection of notes: all notes and the four PARA categories), sticky top bar (page title, new
// note, preferences) and the main region. Below 1024 px the sidebar is an off-canvas drawer.
// The tab that does not hold the write lock is read-only: a banner says so, the controls that
// change data are disabled and the shortcuts do nothing.
import { PARA_CATEGORIES } from '../../core/model.js';
import { allowsSingleKeyShortcut } from '../../core/preferences.js';
import { selectNoteCounts } from '../../core/selectors.js';
import { createNoteCommand } from '../commands.js';
import { categoryLabel } from '../labels.js';
import { getSingleKeyShortcuts, watchPreferences } from '../preferences.js';
import { registerServiceWorker } from '../pwa.js';
import { StorageError, createAppStore } from '../store.js';
import { activeWorkspace, activeWorkspaceId, listWorkspaces } from '../workspaces.js';
import { openPreferences } from './Preferences.js';
import { createNotesView, selectionTitle } from './NotesView.js';
import * as UI from './ui.js';
import { openWorkspaceManager } from './WorkspacesView.js';

const { el, icon, t } = UI;

/** Phosphor icon of each PARA category. @type {Record<import('../../types.d.ts').ParaCategory, { icon: string }>} */
const CATEGORY_ICONS = {
  projects: { icon: 'target' },
  areas: { icon: 'house-line' },
  resources: { icon: 'books' },
  archives: { icon: 'archive' },
};

/** @param {HTMLElement} rootEl */
export function start(rootEl) {
  const store = createAppStore({ workspaceId: activeWorkspaceId() });
  const toasts = UI.ToastHost();
  /** @type {import('./types.js').View | null} */
  let currentView = null;

  watchPreferences();

  /* ---------------- shell ---------------- */

  function workspaceChip() {
    const workspace = activeWorkspace();
    const count = listWorkspaces().length;
    return el(
      'button',
      {
        type: 'button',
        onclick: () => {
          // Below 1024 px the drawer closes first, so the dialog gives the focus back to the menu button.
          closeNav({ focusToggle: true });
          openWorkspaceManager({ store, toasts });
        },
        class: 'cv-btn tn-workspace',
      },
      icon('database'),
      el(
        'span',
        { class: 'tn-grow tn-stack' },
        el('span', { class: 'tn-meta' }, t('shell.workspace')),
        el('span', { class: 'tn-ellipsis tn-strong' }, workspace.label),
      ),
      count > 1 ? UI.Tag(`${count}`, { mono: true }) : null,
      icon('caret-up-down'),
    );
  }

  /** @type {Map<string, HTMLElement>} */
  const navButtons = new Map();
  /** @type {Map<string, HTMLElement>} */
  const navCounts = new Map();

  /**
   * @param {{ id: string, icon: string, label: string, selection: import('../../types.d.ts').Selection }} item
   */
  function navItem({ id, icon: iconName, label, selection }) {
    const count = el('span', { class: 'tn-nav-count cv-num' });
    const button = el(
      'button',
      {
        type: 'button',
        class: 'cv-nav-item tn-nav-btn',
        onclick: () => {
          store.dispatch({ type: 'select', selection });
          if (shell.hasAttribute('data-nav-open')) {
            closeNav();
            main.focus({ preventScroll: true });
          }
        },
      },
      icon(iconName),
      el('span', { class: 'tn-grow tn-ellipsis' }, label),
      count,
    );
    navButtons.set(id, button);
    navCounts.set(id, count);
    return el('li', null, button);
  }

  const navList = el(
    'ul',
    null,
    navItem({ id: 'all', icon: 'notebook', label: t('nav.allNotes'), selection: { kind: 'all' } }),
    ...PARA_CATEGORIES.map((category) =>
      navItem({
        id: category,
        icon: CATEGORY_ICONS[category].icon,
        label: categoryLabel(category),
        selection: { kind: 'category', category },
      }),
    ),
  );

  // The sidebar is navigation only: brand, workspace, then the selections. The skill's own
  // script opens and closes it below 1024 px.
  const sidebar = el(
    'nav',
    { id: 'shell-nav', 'aria-label': t('shell.navLabel'), class: 'cv-sidebar' },
    el(
      'div',
      { class: 'cv-sidebar__brand' },
      icon('note-pencil', { weight: 'bold', className: 'tn-brand-icon' }),
      t('app.name'),
    ),
    el('div', { class: 'tn-sidebar-workspace' }, workspaceChip()),
    navList,
  );

  // The page title is the one h1 of the page: the name of what the list shows.
  const pageTitle = el('h1', { class: 'cv-topbar__title' });
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
  const topbar = el(
    'header',
    { class: 'cv-topbar' },
    menuButton,
    pageTitle,
    el('span', { class: 'cv-topbar__spacer' }),
    UI.Button({
      variant: 'primary',
      icon: 'plus',
      children: t('notes.new'),
      mutates: true,
      onclick: () => newNote(),
    }),
    UI.IconButton({
      icon: 'gear',
      label: t('shell.preferences'),
      onclick: () => openPreferences(),
    }),
  );

  const main = el('main', { class: 'cv-shell__content', id: 'shell-main', tabindex: -1 });

  const shell = el(
    'div',
    { class: 'cv-shell' },
    el('a', { class: 'cv-skip-link', href: '#shell-main' }, t('shell.skipLink')),
    sidebar,
    el('div', { class: 'cv-shell__scrim' }),
    el('div', { class: 'cv-shell__main' }, topbar, main),
  );

  rootEl.appendChild(shell);

  /** Closes the drawer of the narrow layout; `focusToggle` gives the focus back to its button. */
  /** @param {{ focusToggle?: boolean }} [opts] */
  function closeNav({ focusToggle = false } = {}) {
    if (!shell.hasAttribute('data-nav-open')) return;
    shell.removeAttribute('data-nav-open');
    menuButton.setAttribute('aria-expanded', 'false');
    if (focusToggle) menuButton.focus();
  }
  // From 1024 px the sidebar is fixed: a drawer left open must not keep its state.
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => {
    if (e.matches) closeNav();
  });

  /** Creates a note where the selection points, or in a category (quick create). @param {import('../../types.d.ts').ParaCategory} [category] */
  function newNote(category) {
    store.dispatch(createNoteCommand(store.getState(), category));
  }

  /* ---------------- what the state shows ---------------- */

  function paintSelection() {
    const state = store.getState();
    pageTitle.textContent = selectionTitle(state);
    const counts = selectNoteCounts(state);
    const current =
      state.selection.kind === 'all'
        ? 'all'
        : state.selection.kind === 'category'
          ? state.selection.category
          : (state.folders.find(
              (f) => f.id === /** @type {{ folderId: string }} */ (state.selection).folderId,
            )?.category ?? 'all');
    for (const [key, button] of navButtons) {
      if (key === current) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    for (const [key, count] of navCounts) {
      const n = key === 'all' ? counts.all : counts.byCategory[/** @type {never} */ (key)];
      count.textContent = String(n);
    }
  }

  /* ---------------- read-only tab (another tab holds the write lock) ---------------- */
  /** @type {HTMLElement | null} */
  let readOnlyBanner = null;

  function buildReadOnlyBanner() {
    const banner = UI.Alert({
      status: 'warning',
      title: t('shell.readOnly.title'),
      text: t('shell.readOnly.text'),
      live: true,
    });
    banner.dataset.testid = 'read-only-banner';
    banner.classList.add('tn-center');
    banner.append(
      UI.Button({
        size: 'sm',
        children: t('shell.readOnly.resume'),
        onclick: async () => {
          if (!(await store.retryWriteLock())) {
            toasts.push({
              variant: 'warning',
              title: t('shell.readOnly.stillWriting'),
              body: t('shell.readOnly.closeIt'),
            });
          }
        },
      }),
    );
    return banner;
  }

  // Shows or hides the banner, and disables the controls that change data.
  function paintReadOnly() {
    const readOnly = store.getState().readOnly;
    document.body.toggleAttribute('data-read-only', readOnly);
    if (readOnly && !readOnlyBanner) readOnlyBanner = buildReadOnlyBanner();
    if (readOnly && readOnlyBanner && readOnlyBanner.parentElement !== main) {
      main.prepend(readOnlyBanner);
    }
    if (!readOnly && readOnlyBanner) {
      readOnlyBanner.remove();
      readOnlyBanner = null;
    }
    // A control that is disabled for another reason is left alone: only the ones disabled here
    // carry the marker, and only those are enabled again.
    for (const control of /** @type {NodeListOf<HTMLButtonElement | HTMLInputElement>} */ (
      document.querySelectorAll('button[data-mutates], input[data-mutates], select[data-mutates]')
    )) {
      if (readOnly && !control.disabled) {
        control.disabled = true;
        control.dataset.readOnlyDisabled = '';
      } else if (!readOnly && 'readOnlyDisabled' in control.dataset) {
        control.disabled = false;
        delete control.dataset.readOnlyDisabled;
      }
    }
  }

  /* ---------------- keyboard shortcuts ---------------- */
  // Single-key shortcuts (`N`, and `1` to `4` for a new note in a category) are on by default and
  // the user can turn them off in the preferences (WCAG 2.1.4). They never steal a key from a
  // control that uses it: a text field, an open dialog (a native <dialog>: the page behind is
  // inert) or the open drawer, a combination with Ctrl, Alt or Meta, Shift on a letter, and the
  // auto-repeat of a held key.
  /** @param {KeyboardEvent} e */
  function mayRunShortcut(e) {
    const target = /** @type {HTMLElement | null} */ (e.target);
    const inTextField =
      !!target &&
      (target.isContentEditable ||
        !!target.closest?.(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]',
        ));
    return allowsSingleKeyShortcut({
      enabled: getSingleKeyShortcuts(),
      key: e.key,
      ctrl: e.ctrlKey,
      alt: e.altKey,
      meta: e.metaKey,
      shift: e.shiftKey,
      repeat: e.repeat,
      inTextField,
      dialogOpen: !!document.querySelector('dialog[open]') || shell.hasAttribute('data-nav-open'),
    });
  }

  window.addEventListener('keydown', (e) => {
    if (store.getState().readOnly || !mayRunShortcut(e)) return;
    if (e.key.toLowerCase() === 'n') {
      e.preventDefault();
      newNote();
      return;
    }
    const category = PARA_CATEGORIES[Number(e.key) - 1];
    if (category && /^[1-4]$/.test(e.key)) {
      e.preventDefault();
      newNote(category);
    }
  });

  /* ---------------- storage that cannot be used ---------------- */
  // The app is replaced by a message: nothing is read or written until the cause is fixed.
  const STORAGE_ERRORS = {
    blocked: {
      title: t('shell.storageBlocked.title'),
      body: t('shell.storageBlocked.body'),
    },
    unavailable: {
      title: t('shell.storageUnavailable.title'),
      body: t('shell.storageUnavailable.body'),
    },
  };

  /** @param {'blocked' | 'unavailable'} code */
  function showStorageError(code) {
    const message = STORAGE_ERRORS[code];
    // The shell is replaced by a framed message: a top bar with the brand, then the message as
    // the one h1 of the page.
    rootEl.replaceChildren(
      el(
        'div',
        { class: 'cv-shell__main' },
        el(
          'header',
          { class: 'cv-topbar' },
          el(
            'span',
            { class: 'tn-brand' },
            icon('note-pencil', { weight: 'bold', className: 'tn-brand-icon' }),
            t('app.name'),
          ),
        ),
        el(
          'main',
          {
            class: 'cv-shell__content',
            id: 'shell-main',
            'data-testid': 'storage-error',
            'data-code': code,
          },
          el(
            'div',
            { role: 'alert', class: 'tn-error-screen' },
            icon('warning', { className: 'tn-warning-text tn-icon-xl' }),
            el('h1', { class: 'cv-h1 tn-page-title' }, message.title),
            el('p', { class: 'tn-message' }, message.body),
            el(
              'div',
              null,
              UI.Button({
                variant: 'primary',
                icon: 'arrow-clockwise',
                children: t('shell.reload'),
                onclick: () => location.reload(),
              }),
            ),
          ),
        ),
      ),
    );
  }

  /* ---------------- initial load ---------------- */
  const loader = el('p', { class: 'tn-meta tn-loading', role: 'status' }, t('shell.loading'));
  main.appendChild(loader);

  store.onRefused(() => {
    toasts.push({
      variant: 'warning',
      title: t('shell.readOnly.toastTitle'),
      body: t('shell.readOnly.toastBody'),
    });
  });
  store.onWriteError(() => {
    toasts.push({
      variant: 'danger',
      title: t('shell.writeFailed.title'),
      body: t('shell.writeFailed.body'),
    });
  });
  // The banner and the disabled controls follow the role of the tab, and the controls that a
  // view builds again on every refresh are disabled as they appear.
  let wasReadOnly = false;
  store.subscribe(({ state }) => {
    paintSelection();
    paintReadOnly();
    if (wasReadOnly && !state.readOnly) {
      toasts.push({
        variant: 'success',
        title: t('shell.readOnly.restored'),
        body: t('shell.readOnly.restoredBody'),
      });
    }
    wasReadOnly = state.readOnly;
  });
  new MutationObserver(() => {
    if (store.getState().readOnly) paintReadOnly();
  }).observe(document.body, { childList: true, subtree: true });

  // A new version waits in the background: the toast stays until the person reloads or dismisses it.
  registerServiceWorker({
    onUpdateReady(applyUpdate) {
      toasts.push({
        variant: 'info',
        title: t('pwa.updateTitle'),
        body: t('pwa.updateBody'),
        timeout: 0,
        action: {
          label: t('pwa.reload'),
          onclick: (button) => {
            button.disabled = true;
            button.textContent = t('pwa.reloading');
            applyUpdate();
          },
        },
      });
    },
  });

  store
    .init()
    .then(() => {
      wasReadOnly = store.getState().readOnly;
      currentView = createNotesView(store);
      main.replaceChildren(currentView.el);
      paintSelection();
      paintReadOnly();
    })
    .catch((error) => {
      console.error('[App] init failed', error);
      if (error instanceof StorageError) showStorageError(error.code);
      else loader.textContent = t('shell.loadError', { message: error.message });
    });
}
