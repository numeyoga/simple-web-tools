// js/Todos.js — liste de tâches : ajout, filtre par projet, groupes par échéance.
(function () {
  const { el, icon } = window.UI;

  function createTodos(store, opts) {
    let filtreProjet = 'all';
    let draftEcheance = 'today';
    let draftProjet = null;
    let lastProjetsRef = null;

    const host = el('div', { style: { display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 920 } });
    const headerSlot  = el('div', null);
    const formSlot    = el('div', null);
    const filtresSlot = el('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } });
    const listSlot    = el('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } });
    host.append(headerSlot, formSlot, filtresSlot, listSlot);

    // Refs vers les inputs du form (préservées entre rendus de la liste)
    let inputTitre, selectProjet, selectEcheance;

    function ensureDraftProjet() {
      const projets = store.state.projets;
      if (!projets.find(p => p.id === draftProjet) && projets.length > 0) {
        draftProjet = (projets.find(p => !p.archive) || projets[0]).id;
      }
    }

    function renderHeader() {
      const { todos } = store.state;
      const open = todos.filter(t => !t.fait).length;
      const done = todos.filter(t => t.fait).length;
      headerSlot.replaceChildren(
        el('div', { style: { font: '600 20px/1.2 var(--cv-font-sans)', color: 'var(--cv-fg)', letterSpacing: '-0.01em' } }, 'Todos'),
        el('div', { style: { font: '400 12px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg-muted)', marginTop: 4 } },
          `${open} en cours · ${done} terminées`),
      );
    }

    function renderForm() {
      ensureDraftProjet();
      const projets = store.state.projets;

      const inputW = UI.Input({
        value: '', placeholder: "Qu'est-ce qu'il faut faire ?", icon: 'plus',
        onkeydown: e => { if (e.key === 'Enter') submit(); },
        style: { flex: 1 },
      });
      inputTitre = inputW.input;

      const selectPW = UI.Select({
        value: draftProjet, onchange: v => draftProjet = v,
        options: projets.filter(p => !p.archive).map(p => ({ value: p.id, label: p.nom })),
        style: { width: 220 },
      });
      selectProjet = selectPW.input;

      const selectEW = UI.Select({
        value: draftEcheance, onchange: v => draftEcheance = v,
        options: [
          { value: 'today',    label: "Aujourd'hui" },
          { value: 'tomorrow', label: 'Demain' },
          { value: 'fri',      label: 'Cette semaine' },
          { value: 'none',     label: 'Sans échéance' },
        ],
        style: { width: 150 },
      });
      selectEcheance = selectEW.input;

      formSlot.replaceChildren(
        el('div', {
          style: {
            display: 'flex', gap: 8, alignItems: 'flex-end',
            background: 'var(--cv-surface)', border: '1px solid var(--cv-border)',
            borderRadius: 10, padding: 12, boxShadow: 'var(--cv-shadow-sm)',
          },
        },
          inputW, selectPW, selectEW,
          UI.Button({ variant: 'primary', icon: 'arrow-right', children: 'Ajouter', onclick: submit }),
        ),
      );
    }

    function submit() {
      const titre = (inputTitre?.value || '').trim();
      const proj  = selectProjet?.value || draftProjet;
      const ech   = selectEcheance?.value || draftEcheance;
      if (!titre || !proj) return;
      store.actions.ajouterTodo(titre, proj, ech === 'none' ? null : ech);
      inputTitre.value = '';
      inputTitre.focus();
    }

    function chip(label, actif, onclick, couleur) {
      return el('button', {
        onclick,
        style: {
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', height: 26, borderRadius: 9999,
          border: actif ? '1px solid var(--cv-fg)' : '1px solid var(--cv-border-strong)',
          background: actif ? 'var(--cv-fg)' : 'var(--cv-surface)',
          color: actif ? 'var(--cv-fg-inverse)' : 'var(--cv-fg)',
          font: '500 12px/1 var(--cv-font-sans)',
          cursor: 'pointer', transition: 'all 120ms',
        },
      },
        couleur ? el('span', { style: { width: 6, height: 6, borderRadius: 2, background: couleur } }) : null,
        label,
      );
    }

    function renderFiltres() {
      const projets = store.state.projets;
      filtresSlot.replaceChildren(
        chip('Tous', filtreProjet === 'all', () => { filtreProjet = 'all'; renderFiltres(); renderList(); }),
        ...projets.filter(p => !p.archive).map(p =>
          chip(p.nom, filtreProjet === p.id, () => { filtreProjet = p.id; renderFiltres(); renderList(); }, p.couleur)
        ),
      );
    }

    function echeanceBadge(echeance) {
      const map = {
        overdue:  { label: 'en retard',   variant: 'danger' },
        today:    { label: "aujourd'hui", variant: 'accent' },
        tomorrow: { label: 'demain',      variant: 'neutral' },
        fri:      { label: 'vendredi',    variant: 'neutral' },
        mon:      { label: 'lundi',       variant: 'neutral' },
      };
      const m = map[echeance] || { label: echeance, variant: 'neutral' };
      return UI.Badge({ variant: m.variant, children: m.label });
    }

    function todoRow(t, faded) {
      const proj = store.state.projets.find(p => p.id === t.projetId);
      const row = el('div', {
        style: {
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 14px', height: 44,
          borderBottom: '1px solid var(--cv-border)',
          background: 'var(--cv-surface)',
          opacity: faded ? 0.6 : 1,
          transition: 'background 120ms',
        },
        onmouseenter: e => e.currentTarget.style.background = 'var(--cv-surface-2)',
        onmouseleave: e => e.currentTarget.style.background = 'var(--cv-surface)',
      },
        el('button', {
          onclick: () => store.actions.toggleTodo(t.id),
          'aria-label': t.fait ? 'Rouvrir' : 'Terminer',
          style: {
            width: 18, height: 18, borderRadius: 4,
            border: `1.5px solid ${t.fait ? 'var(--cv-success-500)' : 'var(--cv-border-strong)'}`,
            background: t.fait ? 'var(--cv-success-500)' : 'transparent',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, padding: 0,
            transition: 'all 120ms',
          },
        }, t.fait ? icon('check', { weight: 'bold', size: 12, style: { color: '#fff' } }) : null),

        el('div', { style: { minWidth: 0, flex: 1 } },
          el('div', {
            style: {
              font: '400 13px/1.3 var(--cv-font-sans)',
              color: t.fait ? 'var(--cv-fg-subtle)' : 'var(--cv-fg)',
              textDecoration: t.fait ? 'line-through' : 'none',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            },
          }, t.titre),
        ),

        proj ? el('span', {
          style: { display: 'inline-flex', alignItems: 'center', gap: 6, font: '500 11px/1 var(--cv-font-sans)', color: 'var(--cv-fg-muted)', flexShrink: 0 },
        },
          el('span', { style: { width: 6, height: 6, borderRadius: 2, background: proj.couleur } }),
          proj.nom,
        ) : null,

        (t.echeance && !t.fait) ? echeanceBadge(t.echeance) : null,

        el('div', { style: { display: 'flex', gap: 2, flexShrink: 0 } },
          !t.fait ? UI.IconButton({
            icon: 'play', label: 'Démarrer un chrono sur cette tâche',
            onclick: () => opts.onDemarrerSurTodo(t.projetId, t.titre),
          }) : null,
          UI.IconButton({
            icon: 'trash', label: 'Supprimer', size: 'sm',
            onclick: () => store.actions.supprimerTodo(t.id),
          }),
        ),
      );
      return row;
    }

    function renderList() {
      const { todos } = store.state;
      const filtered = todos.filter(t => filtreProjet === 'all' || t.projetId === filtreProjet);

      const groups = {
        'En retard':     filtered.filter(t => !t.fait && t.echeance === 'overdue'),
        "Aujourd'hui":   filtered.filter(t => !t.fait && t.echeance === 'today'),
        'Demain':        filtered.filter(t => !t.fait && t.echeance === 'tomorrow'),
        'Cette semaine': filtered.filter(t => !t.fait && ['fri','mon','tue','wed','thu','week'].includes(t.echeance)),
        'Sans échéance': filtered.filter(t => !t.fait && !t.echeance),
        'Terminé':       filtered.filter(t => t.fait),
      };

      const sections = [];
      for (const [label, items] of Object.entries(groups)) {
        if (items.length === 0) continue;
        const isRetard = label === 'En retard';
        const isDone = label === 'Terminé';
        sections.push(
          el('section', {
            style: { background: 'var(--cv-surface)', border: '1px solid var(--cv-border)', borderRadius: 10, overflow: 'hidden' },
          },
            el('header', {
              style: {
                padding: '10px 14px', borderBottom: '1px solid var(--cv-border)',
                display: 'flex', alignItems: 'center', gap: 8,
                background: isRetard ? 'var(--cv-danger-50)' : 'transparent',
              },
            },
              el('span', {
                style: {
                  font: '600 11px/1 var(--cv-font-sans)',
                  color: isRetard ? 'var(--cv-danger-700)' : 'var(--cv-fg-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                },
              }, label),
              el('span', { style: { font: '500 11px/1 var(--cv-font-mono)', color: 'var(--cv-fg-subtle)' } }, String(items.length)),
            ),
            el('div', null, items.map(t => todoRow(t, isDone))),
          ),
        );
      }

      if (filtered.length === 0) {
        sections.push(el('div', {
          style: {
            padding: '48px 16px', textAlign: 'center', color: 'var(--cv-fg-muted)',
            font: '400 14px/1.5 var(--cv-font-sans)',
            border: '1px dashed var(--cv-border-strong)', borderRadius: 10,
          },
        },
          icon('check-circle', { size: 32, style: { color: 'var(--cv-fg-subtle)' } }),
          el('div', { style: { marginTop: 8 } }, 'Tout est à jour sur ce projet.'),
        ));
      }

      listSlot.replaceChildren(...sections);
    }

    function render() {
      renderHeader();
      if (store.state.projets !== lastProjetsRef) {
        renderForm();
        renderFiltres();
        lastProjetsRef = store.state.projets;
      }
      renderList();
    }

    render();
    const offState = store.onState(render);

    return {
      el: host,
      destroy() { offState(); },
    };
  }

  window.createTodos = createTodos;
})();
