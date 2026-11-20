// Main shell: sidebar (logo, attendance widget, nav, shortcuts) + main area that swaps the views.
import { StorageError } from '../idb.js';
import { createStore } from '../store.js';
import { WORKSPACES } from '../workspaces.js';
import { createAttendanceWidget } from './AttendanceWidget.js';
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

  /* ---------------- shell ---------------- */

  const widget = createAttendanceWidget(store, {
    onOpenQuickAdd: () => openQuickAdd(),
  });

  function workspaceChip() {
    const ws = WORKSPACES.getActive();
    const list = WORKSPACES.getList();
    return el(
      'button',
      {
        type: 'button',
        onclick: () => openWorkspaceManager({ store, toasts }),
        class: 'cv-btn ch-workspace',
      },
      icon('database'),
      el(
        'span',
        { class: 'ch-grow ch-stack' },
        el('span', { class: 'cv-overline' }, 'Espace de sauvegarde'),
        el('span', { class: 'ch-ellipsis ch-strong' }, ws.label),
      ),
      list.length > 1 ? UI.Tag(`${list.length}`, { mono: true }) : null,
      icon('caret-up-down'),
    );
  }

  const navList = el(
    'div',
    null,
    el('div', { class: 'cv-overline cv-sidebar__group' }, 'Espace'),
    el(
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
    ),
  );

  function paintNav() {
    for (const s of SECTIONS) {
      const btn = navButtons[s.id];
      if (!btn) continue;
      if (currentSection === s.id) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    }
  }

  /* Sidebar: fixed 100vh, in a flex column. Brand + workspaceChip are pinned at the top,
       widget + nav scroll if needed inside an inner container (min-height:0 is required
       so that the scroll happens in the sidebar rather than pushing the page), and the
       Shortcuts block stays glued to the bottom. Guarantees that no overflow triggers a
       page scroll, even on short screens. */
  const middleScroll = el('div', { class: 'ch-sidebar-scroll' }, widget.el, navList);

  const sidebar = el(
    'nav',
    { 'aria-label': 'Navigation', class: 'cv-sidebar ch-sidebar' },
    // Brand
    el('div', { class: 'ch-brand ch-shrink-0' }, icon('timer', { weight: 'bold' }), 'Chrono'),

    // Workspace selector (pinned at the top)
    el('div', { class: 'ch-shrink-0' }, workspaceChip()),

    // Scrollable area: attendance widget + nav
    middleScroll,

    // Shortcuts footer (pinned at the bottom)
    el(
      'div',
      { class: 'ch-shortcuts' },
      el('div', { class: 'cv-overline' }, 'Raccourcis'),
      el(
        'div',
        { class: 'ch-meta ch-stack ch-gap-2 ch-mt-3' },
        el(
          'div',
          { class: 'ch-row ch-between ch-center' },
          el('span', null, 'Démarrer / pause'),
          UI.Kbd('Espace'),
        ),
        el(
          'div',
          { class: 'ch-row ch-between ch-center' },
          el('span', null, 'Nouveau chrono'),
          UI.Kbd('N'),
        ),
        el(
          'div',
          { class: 'ch-row ch-between ch-center' },
          el('span', null, 'Tout arrêter'),
          UI.Kbd('S'),
        ),
      ),
    ),
  );

  const main = el('main', { class: 'ch-main' });

  rootEl.appendChild(el('div', { class: 'ch-app' }, sidebar, main));

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
    if (sectionId === currentSection && currentView) return;
    if (currentView && currentView.destroy) currentView.destroy();
    currentSection = sectionId;
    paintNav();

    const def = SECTIONS.find((s) => s.id === sectionId) ?? SECTIONS[0];
    if (!def) return;
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
  // Global shortcuts must never steal a key from a control
  // that uses it: text input, open modal (a native <dialog>: the page behind is inert, "S"
  // must not stop the timers in the background),
  // combinations with Alt/Ctrl/Meta (browser or OS shortcuts),
  // auto-repeat of a held key, and, for Space,
  // buttons/links/role="button", which the key activates natively.
  /** @param {KeyboardEvent} e */
  function shouldIgnoreShortcut(e) {
    const t = /** @type {HTMLElement | null} */ (e.target);
    if (t && t.isContentEditable) return true;
    if (t && t.matches && t.matches('input, textarea, select')) return true;
    if (document.querySelector('dialog[open]')) return true;
    if (e.altKey || e.ctrlKey || e.metaKey) return true;
    if (e.repeat) return true;
    const isSpaceKey = e.key === ' ' || e.code === 'Space';
    if (isSpaceKey && t && t.closest && t.closest('button, a[href], [role="button"]')) return true;
    return false;
  }

  window.addEventListener('keydown', (e) => {
    // Every shortcut starts, changes or stops a timer: none of them works in a read-only tab.
    if (store.state.readOnly) return;
    if (shouldIgnoreShortcut(e)) return;
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
    rootEl.replaceChildren(
      el(
        'main',
        {
          role: 'alert',
          'data-testid': 'storage-error',
          'data-code': code,
          class: 'ch-error-screen',
        },
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
