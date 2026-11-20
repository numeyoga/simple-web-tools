// Main shell (the AppShell of the Covenant skill): skip link, sidebar (brand, workspace, the four
// sections), sticky top bar (page title, presence and timers summary, preferences) and the main
// region that swaps the views. Below 1024 px the sidebar is an off-canvas drawer.
import { StorageError } from '../idb.js';
import { createStore } from '../store.js';
import { allowsSingleKeyShortcut } from '../../core/preferences.js';
import {
  getSingleKeyShortcuts,
  migrateLegacyPreferences,
  watchPreferences,
} from '../preferences.js';
import { WORKSPACES } from '../workspaces.js';
import { createTopbarStatus } from './AttendanceWidget.js';
import { openPreferences } from './Preferences.js';
import { createProjectsView } from './ProjectsView.js';
import { openQuickAddModal } from './QuickAdd.js';
import { createReportView } from './ReportView.js';
import { createTimelineView } from './TimelineView.js';
import { createTodosView } from './TodosView.js';
import * as UI from './ui.js';
import { openWorkspaceManager } from './WorkspacesView.js';

const { el, icon } = UI;

/** @type {{ id: string, icon: string, label: string, factory: import('./types.js').ViewFactory }[]} */
const SECTIONS = [
  { id: 'timeline', icon: 'timer', label: 'Timeline', factory: createTimelineView },
  { id: 'todos', icon: 'list-checks', label: 'Todos', factory: createTodosView },
  { id: 'projects', icon: 'folder-open', label: 'Projets', factory: createProjectsView },
  { id: 'report', icon: 'chart-bar', label: 'Rapport', factory: createReportView },
];

/** @param {HTMLElement} rootEl */
export function start(rootEl) {
  const store = createStore();
  const toasts = UI.ToastHost();

  let currentSection = 'timeline';
  /** @type {import('./types.js').View | null} */
  let currentView = null;
  /** @type {Record<string, HTMLElement>} */
  const navButtons = {};

  migrateLegacyPreferences();
  watchPreferences();

  /* ---------------- shell ---------------- */

  const topbarStatus = createTopbarStatus(store, { onOpenQuickAdd: () => openQuickAdd() });

  function workspaceChip() {
    const ws = WORKSPACES.getActive();
    const list = WORKSPACES.getList();
    return el(
      'button',
      {
        type: 'button',
        onclick: () => {
          // Below 1024 px the drawer closes first, so the dialog gives the focus back to the menu button.
          closeNav({ focusToggle: true });
          openWorkspaceManager({ store, toasts });
        },
        class: 'cv-btn ch-workspace',
      },
      icon('database'),
      el(
        'span',
        { class: 'ch-grow ch-stack' },
        el('span', { class: 'ch-meta' }, 'Espace de sauvegarde'),
        el('span', { class: 'ch-ellipsis ch-strong' }, ws.label),
      ),
      list.length > 1 ? UI.Tag(`${list.length}`, { mono: true }) : null,
      icon('caret-up-down'),
    );
  }

  const navList = el(
    'ul',
    null,
    ...SECTIONS.map((s) => {
      const btn = el(
        'button',
        {
          type: 'button',
          onclick: () => goto(s.id),
          class: 'cv-nav-item ch-nav-btn',
        },
        icon(s.icon),
        s.label,
      );
      navButtons[s.id] = btn;
      return el('li', null, btn);
    }),
  );

  function paintNav() {
    for (const s of SECTIONS) {
      const btn = navButtons[s.id];
      if (!btn) continue;
      if (currentSection === s.id) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    }
  }

  // The sidebar is navigation only: brand, workspace, then the four sections. Its order is the
  // same on every view. The skill's own script opens and closes it below 1024 px.
  const sidebar = el(
    'nav',
    { id: 'shell-nav', 'aria-label': 'Navigation principale', class: 'cv-sidebar' },
    el(
      'div',
      { class: 'cv-sidebar__brand' },
      icon('timer', { weight: 'bold', className: 'ch-brand-icon' }),
      'Chrono',
    ),
    el('div', { class: 'ch-sidebar-workspace' }, workspaceChip()),
    navList,
  );

  // The page title is the one h1 of the page (decision G); `goto` writes it.
  const pageTitle = el('h1', { class: 'cv-topbar__title' });
  const menuButton = el(
    'button',
    {
      type: 'button',
      class: 'cv-btn cv-btn--ghost cv-btn--icon cv-shell__menu',
      'data-cv-nav-toggle': '',
      'aria-controls': 'shell-nav',
      'aria-expanded': 'false',
      'aria-label': 'Menu',
    },
    icon('list'),
  );
  const topbar = el(
    'header',
    { class: 'cv-topbar' },
    menuButton,
    pageTitle,
    el('span', { class: 'cv-topbar__spacer' }),
    topbarStatus.el,
    UI.IconButton({ icon: 'gear', label: 'Préférences', onclick: () => openPreferences() }),
  );

  const main = el('main', {
    class: 'cv-shell__content',
    id: 'shell-main',
    tabindex: -1,
  });

  const shell = el(
    'div',
    { class: 'cv-shell' },
    el('a', { class: 'cv-skip-link', href: '#shell-main' }, 'Aller au contenu'),
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

  paintNav();

  /* ---------------- read-only tab (another tab holds the write lock) ---------------- */
  /** @type {HTMLElement | null} */
  let readOnlyBanner = null;

  function buildReadOnlyBanner() {
    const banner = UI.Alert({
      status: 'warning',
      title: 'Chrono est ouvert dans un autre onglet.',
      text: 'Cet onglet est en lecture seule.',
      live: true,
    });
    banner.dataset.testid = 'read-only-banner';
    banner.classList.add('ch-center');
    banner.append(
      UI.Button({
        size: 'sm',
        children: 'Reprendre l’édition',
        onclick: async () => {
          if (!(await store.retryWriteLock())) {
            toasts.push({
              variant: 'warning',
              title: 'Un autre onglet écrit encore',
              body: 'Ferme-le puis réessaie.',
            });
          }
        },
      }),
    );
    return banner;
  }

  // Shows or hides the banner, and disables the controls that change data.
  function paintReadOnly() {
    const readOnly = store.state.readOnly;
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

  /* ---------------- views ---------------- */
  /** @param {string} sectionId */
  function goto(sectionId) {
    // Picking a section in the drawer closes it; the focus goes to the content, since the
    // drawer's own button is hidden again.
    if (shell.hasAttribute('data-nav-open')) {
      closeNav();
      main.focus({ preventScroll: true });
    }
    if (sectionId === currentSection && currentView) return;
    if (currentView && currentView.destroy) currentView.destroy();
    currentSection = sectionId;
    paintNav();

    const def = SECTIONS.find((s) => s.id === sectionId) ?? SECTIONS[0];
    if (!def) return;
    pageTitle.textContent = def.label;
    topbarStatus.el.dataset.view = def.id;
    const factory = def.factory;
    currentView = factory(store, {
      onOpenQuickAdd: () => openQuickAdd(),
      onStartOnProject: (projectId, description = '') =>
        openQuickAdd({ projectPrefill: projectId, descriptionPrefill: description }),
      onStartOnTodo: (projectId, description = '') =>
        openQuickAdd({ projectPrefill: projectId, descriptionPrefill: description }),
    });
    main.replaceChildren(currentView.el);
    paintReadOnly();
  }

  function mountInitial() {
    goto(currentSection);
  }

  /* ---------------- QuickAdd ---------------- */
  /** @param {import('./types.js').QuickAddOptions} [opts] */
  function openQuickAdd(opts = {}) {
    openQuickAddModal(store, {
      ...opts,
      onStart: (projectId) => {
        const p = store.state.projects.find((x) => x.id === projectId);
        toasts.push({ variant: 'success', title: 'Chrono démarré', body: p?.name });
      },
    });
  }

  /* ---------------- Keyboard shortcuts ---------------- */
  // Single-key shortcuts (Space, N, S) are on by default and the user can turn them off in the
  // preferences (decision H, WCAG 2.1.4). They never steal a key from a control that uses it:
  // a text field, an open dialog (a native <dialog>: the page behind is inert, "S" must not stop
  // the timers in the background) or the open drawer, a combination with Shift, Alt, Ctrl or Meta
  // (browser or OS shortcuts), the auto-repeat of a held key and, for Space, a button or a link,
  // which the key activates natively.
  /** @param {KeyboardEvent} e */
  function mayRunShortcut(e) {
    const t = /** @type {HTMLElement | null} */ (e.target);
    const inTextField =
      !!t &&
      (t.isContentEditable ||
        !!t.closest?.(
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
      onActivatable: !!t?.closest?.('button, a[href], [role="button"]'),
    });
  }

  window.addEventListener('keydown', (e) => {
    // Every shortcut starts, changes or stops a timer: none of them works in a read-only tab.
    if (store.state.readOnly) return;
    if (!mayRunShortcut(e)) return;
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      const actives = store.activeSessions();
      if (actives.length === 0) {
        openQuickAdd();
      } else if (actives.some((s) => s.status === 'running')) {
        store.actions.pauseAll();
        toasts.push({
          variant: 'info',
          title: actives.length > 1 ? 'Chronos en pause' : 'Chrono en pause',
        });
      } else {
        store.actions.resumeAll();
        toasts.push({
          variant: 'success',
          title: actives.length > 1 ? 'Chronos repris' : 'Chrono repris',
        });
      }
    }
    if (e.key.toLowerCase() === 'n') {
      e.preventDefault();
      openQuickAdd();
    }
    if (e.key.toLowerCase() === 's' && store.activeSessions().length) {
      e.preventDefault();
      const n = store.activeSessions().length;
      store.actions.stopAll();
      toasts.push({ variant: 'info', title: n > 1 ? 'Chronos arrêtés' : 'Chrono arrêté' });
    }
  });

  /* ---------------- storage that cannot be used ---------------- */
  // The app is replaced by a message: nothing is read or written until the cause is fixed.
  const STORAGE_ERRORS = {
    blocked: {
      title: 'Chrono est bloqué par un autre onglet',
      body: 'Une autre fenêtre ou un autre onglet garde ouverte une ancienne version de Chrono et empêche la mise à jour de la base de données. Ferme tous les autres onglets Chrono, puis recharge cette page.',
    },
    unavailable: {
      title: 'Chrono ne peut pas utiliser le stockage du navigateur',
      body: 'Chrono enregistre tes données dans IndexedDB, qui est indisponible ici (navigation privée, stockage bloqué ou navigateur trop ancien). Rien n’a été lu ni écrit. Autorise le stockage pour ce site ou ouvre Chrono dans une fenêtre de navigation normale, puis recharge la page.',
    },
  };

  /** @param {'blocked' | 'unavailable'} code */
  function showStorageError(code) {
    const message = STORAGE_ERRORS[code];
    // The shell is replaced by a framed message: a top bar with the brand, then the message as
    // the one h1 of the page. Nothing is read or written until the cause is fixed.
    rootEl.replaceChildren(
      el(
        'div',
        { class: 'cv-shell__main' },
        el(
          'header',
          { class: 'cv-topbar' },
          el(
            'span',
            { class: 'ch-brand' },
            icon('timer', { weight: 'bold', className: 'ch-brand-icon' }),
            'Chrono',
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
            { role: 'alert', class: 'ch-error-screen' },
            icon('warning', { className: 'ch-warning-text ch-icon-xl' }),
            el('h1', { class: 'cv-h1 ch-page-title' }, message.title),
            el('p', { class: 'ch-message' }, message.body),
            el(
              'div',
              null,
              UI.Button({
                variant: 'primary',
                icon: 'arrow-clockwise',
                children: 'Recharger la page',
                onclick: () => location.reload(),
              }),
            ),
          ),
        ),
      ),
    );
  }

  /* ---------------- initial load ---------------- */
  // Shows a loader during the initial load
  const loader = el('p', { class: 'ch-meta ch-loading', role: 'status' }, 'Chargement…');
  main.appendChild(loader);

  store.onRefused(() => {
    toasts.push({
      variant: 'warning',
      title: 'Lecture seule',
      body: 'Chrono est ouvert dans un autre onglet. Cet onglet est en lecture seule.',
    });
  });
  // The banner and the disabled controls follow the role of the tab, and the controls that a
  // view builds again on every refresh are disabled as they appear.
  let wasReadOnly = false;
  store.onState((state) => {
    paintReadOnly();
    if (wasReadOnly && !state.readOnly) {
      toasts.push({
        variant: 'success',
        title: 'Édition rétablie',
        body: 'Cet onglet peut de nouveau modifier les données.',
      });
    }
    wasReadOnly = state.readOnly;
  });
  new MutationObserver(() => {
    if (store.state.readOnly) paintReadOnly();
  }).observe(document.body, { childList: true, subtree: true });

  store
    .init()
    .then(() => {
      mountInitial();
    })
    .catch((err) => {
      console.error('[App] init failed', err);
      if (err instanceof StorageError) showStorageError(err.code);
      else loader.textContent = 'Erreur de chargement : ' + err.message;
    });
}
