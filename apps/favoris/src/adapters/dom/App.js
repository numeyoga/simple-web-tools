// Main shell (the AppShell of the Covenant skill): skip link, sidebar (brand, workspace, the
// groups of the board), sticky top bar (page title, new link, preferences) and the main region
// (the toolbar and the board). Below 1024 px the sidebar is an off-canvas drawer.
// The tab that does not hold the write lock is read-only: a banner says so, the controls that
// change data are disabled and the shortcuts that change data do nothing.
import { registerServiceWorker } from '@simple-web-tools/pwa/update';
import { findApp } from '@simple-web-tools/suite';
import { createAppBrand, createAppSwitcher } from '@simple-web-tools/suite/dom';
import { allowsSingleKeyShortcut } from '../../core/preferences.js';
import { runLegacyImport } from '../legacy-import.js';
import { applyTheme, getSingleKeyShortcuts, getTheme, watchPreferences } from '../preferences.js';
import { StorageError, createAppStore } from '../store.js';
import { activeWorkspace, activeWorkspaceId, listWorkspaces } from '../workspaces.js';
import { createBoardView } from './BoardView.js';
import { createGroupNav } from './GroupNav.js';
import { openPreferences } from './Preferences.js';
import * as UI from './ui.js';
import { openWorkspaceManager } from './WorkspacesView.js';

const { el, icon, t } = UI;

/** Id of this app in the suite registry (brand, switcher, icon). */
const APP_ID = 'favoris';

/**
 * The page that replaces the app when the browser storage cannot be used: nothing is read or
 * written until the cause is fixed.
 * @param {HTMLElement} rootEl
 * @param {'blocked' | 'unavailable'} code
 */
function showStorageError(rootEl, code) {
  const message =
    code === 'blocked'
      ? { title: t('shell.storageBlocked.title'), body: t('shell.storageBlocked.body') }
      : { title: t('shell.storageUnavailable.title'), body: t('shell.storageUnavailable.body') };
  // The shell is replaced by a framed message: a top bar with the brand, then the message as the
  // one h1 of the page.
  rootEl.replaceChildren(
    el(
      'div',
      { class: 'cv-shell__main' },
      el(
        'header',
        { class: 'cv-topbar' },
        el(
          'span',
          { class: 'fv-brand' },
          icon(findApp(APP_ID).icon, { weight: 'bold', className: 'swt-brand__icon' }),
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
          { role: 'alert', class: 'fv-error-screen' },
          icon('warning', { className: 'fv-warning-text fv-icon-xl' }),
          el('h1', { class: 'cv-h1' }, message.title),
          el('p', null, message.body),
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

/**
 * The first start after the previous version of Favoris: imports its data (see
 * adapters/legacy-import.js). Resolves to what was imported, or `null`.
 * @returns {Promise<import('../legacy-import.js').LegacyImportResult | null>}
 */
async function importPreviousVersion() {
  /** @type {Storage} */
  let storage;
  try {
    storage = window.localStorage;
  } catch {
    return null; // No storage: there is nothing of the previous version to read.
  }
  return runLegacyImport({
    storage,
    defaultLabel: t('workspaces.defaultLabel'),
    now: Date.now(),
  });
}

/** @param {HTMLElement} rootEl */
export async function start(rootEl) {
  /** @type {import('../legacy-import.js').LegacyImportResult | null} */
  let imported = null;
  try {
    imported = await importPreviousVersion();
  } catch (error) {
    console.error('[App] import of the previous version failed', error);
    /** @type {'blocked' | 'unavailable'} */
    const code = error instanceof StorageError ? error.code : 'unavailable';
    showStorageError(rootEl, code);
    return;
  }

  // The import may have kept the theme of the previous version: theme-init.js ran before it.
  if (imported) applyTheme(getTheme());

  const store = createAppStore({ workspaceId: activeWorkspaceId() });
  const toasts = UI.ToastHost();
  /** @type {(import('./types.js').View & { focusSearch: () => void, openNewLink: () => void, scrollToGroup: (id: string | null) => void }) | null} */
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
        class: 'cv-btn fv-workspace',
      },
      icon('database'),
      el(
        'span',
        { class: 'fv-grow fv-stack' },
        el('span', { class: 'fv-meta' }, t('shell.workspace')),
        el('span', { class: 'fv-ellipsis fv-strong' }, workspace.label),
      ),
      count > 1 ? UI.Tag(`${count}`, { mono: true }) : null,
      icon('caret-up-down'),
    );
  }

  // The groups: choosing one closes the drawer of the narrow layout and moves to its card.
  const groupNav = createGroupNav(store, {
    onChoose(groupId) {
      closeNav();
      currentView?.scrollToGroup(groupId);
    },
  });

  // The sidebar is navigation only: brand, workspace, the groups, then the app switcher (pinned to
  // the bottom). The skill's own script opens and closes it below 1024 px.
  const sidebar = el(
    'nav',
    { id: 'shell-nav', 'aria-label': t('shell.navLabel'), class: 'cv-sidebar' },
    createAppBrand(APP_ID),
    el('div', { class: 'fv-sidebar-workspace' }, workspaceChip()),
    el('div', { class: 'swt-sidebar__body' }, groupNav.el),
    createAppSwitcher(APP_ID, { label: t('shell.apps') }),
  );

  // The page title is the one h1 of the page: the name of the workspace the board shows.
  const pageTitle = el('h1', { class: 'cv-topbar__title' }, activeWorkspace().label);
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
  // The text is hidden on a narrow screen: the label names the button then (and repeats the text).
  const newLinkButton = UI.Button({
    variant: 'primary',
    icon: 'plus',
    children: el('span', { class: 'fv-btn-label' }, t('board.addLink')),
    mutates: true,
    onclick: () => currentView?.openNewLink(),
  });
  newLinkButton.setAttribute('aria-label', t('board.addLink'));
  const topbar = el(
    'header',
    { class: 'cv-topbar' },
    menuButton,
    pageTitle,
    el('span', { class: 'cv-topbar__spacer' }),
    newLinkButton,
    UI.IconButton({
      icon: 'gear',
      label: t('shell.preferences'),
      onclick: () => openPreferences(),
    }),
  );

  const main = el('main', { class: 'cv-shell__content fv-main', id: 'shell-main', tabindex: -1 });

  const shell = el(
    'div',
    { class: 'cv-shell' },
    el('a', { class: 'cv-skip-link', href: '#shell-main' }, t('shell.skipLink')),
    sidebar,
    el('div', { class: 'cv-shell__scrim' }),
    el('div', { class: 'cv-shell__main' }, topbar, main),
  );

  rootEl.appendChild(shell);
  // Menus are wired to their buttons once both are in the document.
  UI.initCovenant(shell);

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
    banner.classList.add('fv-center');
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
  // `N` (new link) and `/` (search) are single-key shortcuts: on by default, and the user can turn
  // them off in the preferences (WCAG 2.1.4). They never steal a key from a control that uses it:
  // a text field, an open dialog (a native <dialog>: the page behind is inert) or the open
  // drawer, a combination with Ctrl, Alt or Meta, Shift on a letter, and the auto-repeat of a
  // held key. Ctrl+K (Cmd+K) also goes to the search: it has a modifier, so it is always on.
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
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
      if (document.querySelector('dialog[open]')) return;
      e.preventDefault();
      closeNav();
      currentView?.focusSearch();
      return;
    }
    if (!mayRunShortcut(e)) return;
    if (e.key.toLowerCase() === 'n') {
      if (store.getState().readOnly) return;
      e.preventDefault();
      currentView?.openNewLink();
      return;
    }
    if (e.key === '/') {
      e.preventDefault();
      currentView?.focusSearch();
    }
  });

  /* ---------------- initial load ---------------- */
  const loader = el('p', { class: 'fv-meta fv-loading', role: 'status' }, t('shell.loading'));
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
  void registerServiceWorker({
    enabled: import.meta.env.PROD,
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

  /** Tells what the import of the previous version did, once. */
  function announceImport() {
    if (!imported) return;
    const { workspaces, links, skipped, unreadable } = imported;
    toasts.push({
      variant: 'success',
      title: t('legacy.title'),
      body: t('legacy.body', { count: workspaces, links }),
    });
    const left = skipped.groups + skipped.links + skipped.unsafeUrls;
    if (left > 0 || unreadable > 0) {
      toasts.push({
        variant: 'warning',
        title: t('legacy.skippedTitle'),
        body: [
          left > 0 ? t('legacy.skipped', { count: left, unsafe: skipped.unsafeUrls }) : null,
          unreadable > 0 ? t('legacy.unreadable', { count: unreadable }) : null,
        ]
          .filter(Boolean)
          .join(' '),
        timeout: 0,
      });
    }
  }

  store
    .init()
    .then(() => {
      wasReadOnly = store.getState().readOnly;
      currentView = createBoardView(store, { toasts });
      main.replaceChildren(currentView.el);
      currentView.mounted?.();
      paintReadOnly();
      announceImport();
    })
    .catch((error) => {
      console.error('[App] init failed', error);
      if (error instanceof StorageError) showStorageError(rootEl, error.code);
      else loader.textContent = t('shell.loadError', { message: error.message });
    });
}
