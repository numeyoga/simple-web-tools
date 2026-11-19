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
    const btn = el(
      'button',
      {
        onclick: () => openWorkspaceManager({ store, toasts }),
        title: 'Gérer les espaces de sauvegarde',
        class: 'ch-chip ch-flex-c ch-g8',
        style: { padding: '6px 10px' },
      },
      icon('database', { weight: 'fill', size: 14, style: { color: 'var(--cv-accent-500)' } }),
      el(
        'div',
        { class: 'ch-souple' },
        el(
          'div',
          {
            style: {
              font: '600 9px/1 var(--cv-font-sans)',
              color: 'var(--cv-fg-subtle)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 2,
            },
          },
          'Espace de sauvegarde',
        ),
        el(
          'div',
          {
            class: 'ch-ellipse',
            style: {
              font: '500 12px/1.2 var(--cv-font-sans)',
              color: 'var(--cv-fg)',
            },
          },
          ws.label,
        ),
      ),
      list.length > 1
        ? el(
            'span',
            {
              class: 'ch-mono-xs',
              style: {
                padding: '2px 6px',
                background: 'var(--cv-neutral-100)',
                borderRadius: 4,
                flexShrink: 0,
              },
            },
            `${list.length}`,
          )
        : null,
      icon('caret-up-down', { size: 12, style: { color: 'var(--cv-fg-subtle)', flexShrink: 0 } }),
    );
    return btn;
  }

  const navList = el(
    'div',
    { class: 'ch-pile ch-g2', style: { marginTop: 4 } },
    el(
      'div',
      {
        style: {
          padding: '4px 10px 2px',
          font: '600 10px/1 var(--cv-font-sans)',
          color: 'var(--cv-fg-subtle)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        },
      },
      'Espace',
    ),
    ...SECTIONS.map((s) => {
      const btn = el(
        'button',
        {
          onclick: () => goto(s.id),
          class: 'ch-nav-btn',
        },
        icon(s.icon, { size: 16 }),
        s.label,
      );
      navButtons[s.id] = btn;
      return btn;
    }),
  );

  function paintNav() {
    for (const s of SECTIONS) {
      const btn = navButtons[s.id];
      if (!btn) continue;
      const isOn = currentSection === s.id;
      btn.classList.toggle('est-actif', isOn);
    }
  }

  /* Sidebar: fixed 100vh, in a flex column. Logo + workspaceChip are pinned at the top,
       widget + nav scroll if needed inside an inner container (min-height:0 is required
       so that the scroll happens in the sidebar rather than pushing the page), and the
       Shortcuts block stays glued to the bottom. Guarantees that no overflow triggers a
       page scroll, even on short screens. */
  const middleScroll = el(
    'div',
    {
      class: 'ch-pile ch-g14',
      style: {
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        margin: '0 -4px',
        padding: '0 4px',
      },
    },
    widget.el,
    navList,
  );

  const sidebar = el(
    'nav',
    {
      'aria-label': 'Navigation',
      class: 'ch-pile ch-g14',
      style: {
        width: 264,
        flexShrink: 0,
        background: 'var(--cv-surface)',
        borderRight: '1px solid var(--cv-border)',
        padding: '14px 12px',
        position: 'sticky',
        top: 0,
        height: '100vh',
        boxSizing: 'border-box',
      },
    },
    // Logo
    el(
      'div',
      { class: 'ch-flex-c ch-g10', style: { padding: '2px 8px 4px', flexShrink: 0 } },
      el(
        'div',
        {
          class: 'ch-flex-c',
          style: {
            width: 28,
            height: 28,
            borderRadius: 7,
            background: 'var(--cv-fg)',
            color: 'var(--cv-fg-inverse)',
            justifyContent: 'center',
          },
        },
        icon('timer', { weight: 'fill', size: 16 }),
      ),
      el(
        'div',
        {
          style: {
            font: '600 15px/1 var(--cv-font-sans)',
            color: 'var(--cv-fg)',
            letterSpacing: '-0.01em',
          },
        },
        'Chrono',
      ),
    ),

    // Workspace selector (pinned at the top)
    el('div', { style: { flexShrink: 0 } }, workspaceChip()),

    // Scrollable area: attendance widget + nav
    middleScroll,

    // Shortcuts footer (pinned at the bottom)
    el(
      'div',
      {
        style: {
          flexShrink: 0,
          padding: 10,
          border: '1px solid var(--cv-border)',
          borderRadius: 8,
          background: 'var(--cv-neutral-50)',
        },
      },
      el(
        'div',
        {
          class: 'ch-surtitre',
          style: { marginBottom: 6 },
        },
        'Raccourcis',
      ),
      el(
        'div',
        { class: 'ch-legende ch-pile ch-g4' },
        el(
          'div',
          { class: 'ch-flex ch-entre' },
          el('span', null, 'Démarrer / pause'),
          UI.Kbd('Espace'),
        ),
        el('div', { class: 'ch-flex ch-entre' }, el('span', null, 'Nouveau chrono'), UI.Kbd('N')),
        el('div', { class: 'ch-flex ch-entre' }, el('span', null, 'Tout arrêter'), UI.Kbd('S')),
      ),
    ),
  );

  const main = el('main', {
    class: 'ch-souple ch-pile ch-g20',
    style: {
      padding: '24px 32px',
      width: '100%',
      boxSizing: 'border-box',
    },
  });

  rootEl.appendChild(
    el(
      'div',
      { class: 'ch-flex', style: { minHeight: '100vh', background: 'var(--cv-bg)' } },
      sidebar,
      main,
    ),
  );

  paintNav();

  /* ---------------- read-only tab (another tab holds the write lock) ---------------- */
  /** @type {HTMLElement | null} */
  let readOnlyBanner = null;

  function buildReadOnlyBanner() {
    return el(
      'div',
      {
        role: 'status',
        'data-testid': 'read-only-banner',
        class: 'ch-flex-c ch-g12',
        style: {
          padding: '10px 14px',
          background: 'var(--cv-warning-50)',
          border: '1px solid var(--cv-warning-500)',
          borderRadius: 8,
          color: 'var(--cv-warning-700)',
          font: '500 13px/1.4 var(--cv-font-sans)',
        },
      },
      icon('warning', { weight: 'fill', size: 16 }),
      el(
        'span',
        { class: 'ch-souple' },
        'Chrono est ouvert dans un autre onglet. Cet onglet est en lecture seule.',
      ),
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
    for (const control of /** @type {NodeListOf<HTMLButtonElement>} */ (
      document.querySelectorAll('button[data-mutates]')
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
  // that uses it: text input, open modal (focus trapped in the
  // dialog, "S" must not stop the timers in the background),
  // combinations with Alt/Ctrl/Meta (browser or OS shortcuts),
  // auto-repeat of a held key, and, for Space,
  // buttons/links/role="button", which the key activates natively.
  /** @param {KeyboardEvent} e */
  function shouldIgnoreShortcut(e) {
    const t = /** @type {HTMLElement | null} */ (e.target);
    if (t && t.isContentEditable) return true;
    if (t && t.matches && t.matches('input, textarea, select')) return true;
    if (document.querySelector('[role="dialog"][aria-modal="true"]')) return true;
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
          class: 'ch-pile ch-g12',
          style: {
            maxWidth: 560,
            margin: '15vh auto 0',
            padding: '0 24px',
            background: 'var(--cv-bg)',
            color: 'var(--cv-fg)',
          },
        },
        icon('warning', { weight: 'fill', size: 28, style: { color: 'var(--cv-warning-600)' } }),
        el('h1', { style: { font: '600 20px/1.3 var(--cv-font-sans)', margin: 0 } }, message.title),
        el('p', { style: { font: '400 14px/1.5 var(--cv-font-sans)', margin: 0 } }, message.body),
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
  const loader = el(
    'div',
    { style: { padding: 40, color: 'var(--cv-fg-muted)', font: '400 13px var(--cv-font-sans)' } },
    'Chargement…',
  );
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
