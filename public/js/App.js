// js/App.js — shell principal : sidebar (logo, widget pointage, nav, raccourcis) + main qui swap les vues.
(function () {
  const { el, icon } = window.UI;

  const SECTIONS = [
    { id: 'timeline', icon: 'timer',       label: 'Timeline', factory: 'createTimeline' },
    { id: 'todos',    icon: 'list-checks', label: 'Todos',    factory: 'createTodos' },
    { id: 'projets',  icon: 'folder-open', label: 'Projets',  factory: 'createProjets' },
    { id: 'rapport',  icon: 'chart-bar',   label: 'Rapport',  factory: 'createRapport' },
  ];

  function start(rootEl) {
    const store = createStore();
    const toasts = UI.ToastHost();

    let currentSection = 'timeline';
    let currentView = null;
    let navButtons = {};

    /* ---------------- shell ---------------- */

    const widget = createPointageWidget(store, {
      onOuvrirQuickAdd: () => openQuickAdd(),
    });

    const navList = el('div', { style: { display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 } },
      el('div', {
        style: {
          padding: '4px 10px 2px', font: '600 10px/1 var(--cv-font-sans)', color: 'var(--cv-fg-subtle)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        },
      }, 'Espace'),
      ...SECTIONS.map(s => {
        const btn = el('button', {
          onclick: () => goto(s.id),
          style: {
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '7px 10px', borderRadius: 6, border: 'none',
            background: 'transparent', color: 'var(--cv-fg-muted)',
            font: '400 13px/1 var(--cv-font-sans)', cursor: 'pointer', textAlign: 'left',
            transition: 'background 120ms',
          },
          onmouseenter: e => { if (currentSection !== s.id) e.currentTarget.style.background = 'var(--cv-surface-2)'; },
          onmouseleave: e => { if (currentSection !== s.id) e.currentTarget.style.background = 'transparent'; },
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
        btn.style.background = actif ? 'var(--cv-surface-2)' : 'transparent';
        btn.style.color = actif ? 'var(--cv-fg)' : 'var(--cv-fg-muted)';
        btn.style.fontWeight = actif ? 500 : 400;
      }
    }

    const sidebar = el('nav', {
      'aria-label': 'Navigation',
      style: {
        width: 264, flexShrink: 0,
        background: 'var(--cv-surface)', borderRight: '1px solid var(--cv-border)',
        padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 14,
        position: 'sticky', top: 0, height: '100vh',
      },
    },
      // Logo
      el('div', { style: { display: 'flex', alignItems: 'center', gap: 10, padding: '2px 8px 4px' } },
        el('div', {
          style: {
            width: 28, height: 28, borderRadius: 7,
            background: 'var(--cv-fg)', color: 'var(--cv-fg-inverse)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          },
        }, icon('timer', { weight: 'fill', size: 16 })),
        el('div', { style: { font: '600 15px/1 var(--cv-font-sans)', color: 'var(--cv-fg)', letterSpacing: '-0.01em' } }, 'Chrono'),
        el('div', { style: { marginLeft: 'auto', font: '500 10px/1 var(--cv-font-mono)', color: 'var(--cv-fg-subtle)' } }, 'local'),
      ),

      widget.el,
      navList,

      // Footer raccourcis
      el('div', {
        style: { marginTop: 'auto', padding: 10, border: '1px solid var(--cv-border)', borderRadius: 8, background: 'var(--cv-neutral-50)' },
      },
        el('div', {
          style: { font: '500 11px/1 var(--cv-font-sans)', color: 'var(--cv-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
        }, 'Raccourcis'),
        el('div', { style: { display: 'flex', flexDirection: 'column', gap: 4, font: '400 11px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg-muted)' } },
          el('div', { style: { display: 'flex', justifyContent: 'space-between' } },
            el('span', null, 'Démarrer / pause'), UI.Kbd('Espace')),
          el('div', { style: { display: 'flex', justifyContent: 'space-between' } },
            el('span', null, 'Nouveau chrono'), UI.Kbd('N')),
        ),
      ),
    );

    const main = el('main', {
      style: {
        flex: 1, minWidth: 0, padding: '24px 32px',
        display: 'flex', flexDirection: 'column', gap: 20,
        maxWidth: 1280, width: '100%', boxSizing: 'border-box',
      },
    });

    rootEl.appendChild(el('div', { style: { display: 'flex', minHeight: '100vh', background: 'var(--cv-bg)' } },
      sidebar, main,
    ));

    paintNav();

    /* ---------------- vues ---------------- */
    function goto(sectionId) {
      if (sectionId === currentSection && currentView) return;
      if (currentView && currentView.destroy) currentView.destroy();
      currentSection = sectionId;
      paintNav();

      const def = SECTIONS.find(s => s.id === sectionId);
      const factory = window[def.factory];
      currentView = factory(store, {
        onOuvrirQuickAdd: () => openQuickAdd(),
        onDemarrerSurProjet: (projetId, description = '') => openQuickAdd({ projetPrefill: projetId, descriptionPrefill: description }),
        onDemarrerSurTodo:   (projetId, description = '') => openQuickAdd({ projetPrefill: projetId, descriptionPrefill: description }),
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
          const p = store.state.projets.find(x => x.id === projetId);
          toasts.push({ variant: 'success', title: 'Chrono démarré', body: p?.nom });
        },
      });
    }

    /* ---------------- Raccourcis clavier ---------------- */
    window.addEventListener('keydown', e => {
      if (e.target.matches && e.target.matches('input, textarea, select')) return;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (store.state.activeId) {
          const s = store.state.sessions.find(x => x.id === store.state.activeId);
          if (s?.statut === 'en_cours') {
            store.actions.pauserActive();
            toasts.push({ variant: 'info', title: 'Chrono en pause' });
          } else if (s?.statut === 'en_pause') {
            store.actions.reprendreActive();
            toasts.push({ variant: 'success', title: 'Chrono repris' });
          }
        } else {
          openQuickAdd();
        }
      }
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        openQuickAdd();
      }
    });

    /* ---------------- chargement initial ---------------- */
    // Affiche un loader pendant le chargement initial
    const loader = el('div', { style: { padding: 40, color: 'var(--cv-fg-muted)', font: '400 13px var(--cv-font-sans)' } }, 'Chargement…');
    main.appendChild(loader);

    store.init().then(() => {
      mountInitial();
    }).catch(err => {
      console.error('[App] init failed', err);
      loader.textContent = 'Erreur de chargement : ' + err.message;
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('root');
    start(root);
  });
})();
