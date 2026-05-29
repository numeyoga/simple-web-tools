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

    function workspaceChip() {
      const ws = window.WORKSPACES.getActive();
      const list = window.WORKSPACES.getList();
      const btn = el('button', {
        onclick: () => window.ouvrirGestionEspaces({ store, toasts }),
        title: 'Gérer les espaces de sauvegarde',
        style: {
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px', borderRadius: 8,
          border: '1px solid var(--cv-border)',
          background: 'var(--cv-surface)', cursor: 'pointer',
          font: 'inherit', color: 'var(--cv-fg)', textAlign: 'left',
          transition: 'background 120ms, border-color 120ms',
        },
        onmouseenter: e => { e.currentTarget.style.background = 'var(--cv-surface-2)'; e.currentTarget.style.borderColor = 'var(--cv-border-strong)'; },
        onmouseleave: e => { e.currentTarget.style.background = 'var(--cv-surface)'; e.currentTarget.style.borderColor = 'var(--cv-border)'; },
      },
        icon('database', { weight: 'fill', size: 14, style: { color: 'var(--cv-accent-500)' } }),
        el('div', { style: { minWidth: 0, flex: 1 } },
          el('div', {
            style: {
              font: '600 9px/1 var(--cv-font-sans)', color: 'var(--cv-fg-subtle)',
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2,
            },
          }, 'Espace de sauvegarde'),
          el('div', {
            style: {
              font: '500 12px/1.2 var(--cv-font-sans)', color: 'var(--cv-fg)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            },
          }, ws.label),
        ),
        list.length > 1
          ? el('span', {
              style: {
                font: '500 10px/1 var(--cv-font-mono)', color: 'var(--cv-fg-subtle)',
                padding: '2px 6px', background: 'var(--cv-neutral-100)', borderRadius: 4, flexShrink: 0,
              },
            }, `${list.length}`)
          : null,
        icon('caret-up-down', { size: 12, style: { color: 'var(--cv-fg-subtle)', flexShrink: 0 } }),
      );
      return btn;
    }

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

    /* Sidebar : 100vh fixe, en flex-column. Logo + workspaceChip sont figés en haut,
       widget + nav scrollent au besoin dans un conteneur interne (min-height:0 obligatoire
       pour que le scroll ait lieu dans la sidebar plutôt que de pousser la page), et le
       bloc Raccourcis reste collé en bas. Garantit qu'aucun débordement ne déclenche
       de scroll de page, même sur écrans courts. */
    const middleScroll = el('div', {
      style: {
        flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
        display: 'flex', flexDirection: 'column', gap: 14,
        margin: '0 -4px', padding: '0 4px',
      },
    }, widget.el, navList);

    const sidebar = el('nav', {
      'aria-label': 'Navigation',
      style: {
        width: 264, flexShrink: 0,
        background: 'var(--cv-surface)', borderRight: '1px solid var(--cv-border)',
        padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 14,
        position: 'sticky', top: 0, height: '100vh', boxSizing: 'border-box',
      },
    },
      // Logo
      el('div', { style: { display: 'flex', alignItems: 'center', gap: 10, padding: '2px 8px 4px', flexShrink: 0 } },
        el('div', {
          style: {
            width: 28, height: 28, borderRadius: 7,
            background: 'var(--cv-fg)', color: 'var(--cv-fg-inverse)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          },
        }, icon('timer', { weight: 'fill', size: 16 })),
        el('div', { style: { font: '600 15px/1 var(--cv-font-sans)', color: 'var(--cv-fg)', letterSpacing: '-0.01em' } }, 'Chrono'),
      ),

      // Sélecteur d'espace (figé en haut)
      el('div', { style: { flexShrink: 0 } }, workspaceChip()),

      // Zone scrollable : widget pointage + nav
      middleScroll,

      // Footer raccourcis (figé en bas)
      el('div', {
        style: { flexShrink: 0, padding: 10, border: '1px solid var(--cv-border)', borderRadius: 8, background: 'var(--cv-neutral-50)' },
      },
        el('div', {
          style: { font: '500 11px/1 var(--cv-font-sans)', color: 'var(--cv-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
        }, 'Raccourcis'),
        el('div', { style: { display: 'flex', flexDirection: 'column', gap: 4, font: '400 11px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg-muted)' } },
          el('div', { style: { display: 'flex', justifyContent: 'space-between' } },
            el('span', null, 'Démarrer / pause'), UI.Kbd('Espace')),
          el('div', { style: { display: 'flex', justifyContent: 'space-between' } },
            el('span', null, 'Nouveau chrono'), UI.Kbd('N')),
          el('div', { style: { display: 'flex', justifyContent: 'space-between' } },
            el('span', null, 'Tout arrêter'), UI.Kbd('S')),
        ),
      ),
    );

    const main = el('main', {
      style: {
        flex: 1, minWidth: 0, padding: '24px 32px',
        display: 'flex', flexDirection: 'column', gap: 20,
        width: '100%', boxSizing: 'border-box',
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
        const actives = store.sessionsActives();
        if (actives.length === 0) {
          openQuickAdd();
        } else if (actives.some(s => s.statut === 'en_cours')) {
          store.actions.pauserTout();
          toasts.push({ variant: 'info', title: actives.length > 1 ? 'Chronos en pause' : 'Chrono en pause' });
        } else {
          store.actions.reprendreTout();
          toasts.push({ variant: 'success', title: actives.length > 1 ? 'Chronos repris' : 'Chrono repris' });
        }
      }
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        openQuickAdd();
      }
      if (e.key.toLowerCase() === 's' && !e.metaKey && !e.ctrlKey && store.sessionsActives().length) {
        e.preventDefault();
        const n = store.sessionsActives().length;
        store.actions.arreterTout();
        toasts.push({ variant: 'info', title: n > 1 ? 'Chronos arrêtés' : 'Chrono arrêté' });
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
