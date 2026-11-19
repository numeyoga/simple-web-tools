// Shell principal : sidebar (logo, widget pointage, nav, raccourcis) + main qui swap les vues.
import { createStore } from '../store.js';
import { WORKSPACES } from '../workspaces.js';
import { createPointageWidget } from './PointageWidget.js';
import { createProjets } from './Projets.js';
import { ouvrirQuickAdd } from './QuickAdd.js';
import { createRapport } from './Rapport.js';
import { createTimeline } from './Timeline.js';
import { createTodos } from './Todos.js';
import * as UI from './ui.js';
import { ouvrirGestionEspaces } from './Workspaces.js';

const { el, icon } = UI;

const SECTIONS = [
  { id: 'timeline', icon: 'timer', label: 'Timeline', factory: createTimeline },
  { id: 'todos', icon: 'list-checks', label: 'Todos', factory: createTodos },
  { id: 'projets', icon: 'folder-open', label: 'Projets', factory: createProjets },
  { id: 'rapport', icon: 'chart-bar', label: 'Rapport', factory: createRapport },
];

export function start(rootEl) {
  const store = createStore();
  const toasts = UI.ToastHost();

  let currentSection = 'timeline';
  let currentView = null;
  let navButtons = {};

  /* ---------------- shell ---------------- */

  const widget = createPointageWidget(store, {
    onOuvrirQuickAdd: () => openQuickAdd(),
  });

  function workspaceChip() {
    const ws = WORKSPACES.getActive();
    const list = WORKSPACES.getList();
    const btn = el(
      'button',
      {
        onclick: () => ouvrirGestionEspaces({ store, toasts }),
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
      const actif = currentSection === s.id;
      btn.classList.toggle('est-actif', actif);
    }
  }

  /* Sidebar : 100vh fixe, en flex-column. Logo + workspaceChip sont figés en haut,
       widget + nav scrollent au besoin dans un conteneur interne (min-height:0 obligatoire
       pour que le scroll ait lieu dans la sidebar plutôt que de pousser la page), et le
       bloc Raccourcis reste collé en bas. Garantit qu'aucun débordement ne déclenche
       de scroll de page, même sur écrans courts. */
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

    // Sélecteur d'espace (figé en haut)
    el('div', { style: { flexShrink: 0 } }, workspaceChip()),

    // Zone scrollable : widget pointage + nav
    middleScroll,

    // Footer raccourcis (figé en bas)
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

  /* ---------------- vues ---------------- */
  function goto(sectionId) {
    if (sectionId === currentSection && currentView) return;
    if (currentView && currentView.destroy) currentView.destroy();
    currentSection = sectionId;
    paintNav();

    const def = SECTIONS.find((s) => s.id === sectionId);
    const factory = def.factory;
    currentView = factory(store, {
      onOuvrirQuickAdd: () => openQuickAdd(),
      onDemarrerSurProjet: (projetId, description = '') =>
        openQuickAdd({ projetPrefill: projetId, descriptionPrefill: description }),
      onDemarrerSurTodo: (projetId, description = '') =>
        openQuickAdd({ projetPrefill: projetId, descriptionPrefill: description }),
    });
    main.replaceChildren(currentView.el);
  }

  function mountInitial() {
    goto(currentSection);
  }

  /* ---------------- QuickAdd ---------------- */
  function openQuickAdd(opts = {}) {
    ouvrirQuickAdd(store, {
      ...opts,
      onDemarre: (projetId) => {
        const p = store.state.projets.find((x) => x.id === projetId);
        toasts.push({ variant: 'success', title: 'Chrono démarré', body: p?.nom });
      },
    });
  }

  /* ---------------- Raccourcis clavier ---------------- */
  // Les raccourcis globaux ne doivent jamais voler une touche à un contrôle
  // qui en a l'usage : saisie de texte, modale ouverte (focus piégé dans le
  // dialogue, « S » ne doit pas arrêter les chronos en arrière-plan),
  // combinaisons avec Alt/Ctrl/Meta (raccourcis du navigateur ou de l'OS),
  // répétition automatique d'une touche maintenue, et — pour Espace —
  // boutons/liens/role="button", que la touche active nativement.
  function doitIgnorerRaccourci(e) {
    const t = e.target;
    if (t && t.isContentEditable) return true;
    if (t && t.matches && t.matches('input, textarea, select')) return true;
    if (document.querySelector('[role="dialog"][aria-modal="true"]')) return true;
    if (e.altKey || e.ctrlKey || e.metaKey) return true;
    if (e.repeat) return true;
    const estEspace = e.key === ' ' || e.code === 'Space';
    if (estEspace && t && t.closest && t.closest('button, a[href], [role="button"]')) return true;
    return false;
  }

  window.addEventListener('keydown', (e) => {
    if (doitIgnorerRaccourci(e)) return;
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      const actives = store.sessionsActives();
      if (actives.length === 0) {
        openQuickAdd();
      } else if (actives.some((s) => s.statut === 'en_cours')) {
        store.actions.pauserTout();
        toasts.push({
          variant: 'info',
          title: actives.length > 1 ? 'Chronos en pause' : 'Chrono en pause',
        });
      } else {
        store.actions.reprendreTout();
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
    if (e.key.toLowerCase() === 's' && store.sessionsActives().length) {
      e.preventDefault();
      const n = store.sessionsActives().length;
      store.actions.arreterTout();
      toasts.push({ variant: 'info', title: n > 1 ? 'Chronos arrêtés' : 'Chrono arrêté' });
    }
  });

  /* ---------------- chargement initial ---------------- */
  // Affiche un loader pendant le chargement initial
  const loader = el(
    'div',
    { style: { padding: 40, color: 'var(--cv-fg-muted)', font: '400 13px var(--cv-font-sans)' } },
    'Chargement…',
  );
  main.appendChild(loader);

  store
    .init()
    .then(() => {
      mountInitial();
    })
    .catch((err) => {
      console.error('[App] init failed', err);
      loader.textContent = 'Erreur de chargement : ' + err.message;
    });
}
