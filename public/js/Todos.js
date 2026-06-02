// js/Todos.js — liste de tâches : ajout, filtre par projet, groupes par échéance.
(function () {
  const { el, icon, startOfDay } = window.UI;

  // Convertit une étiquette d'échéance ('today', 'tomorrow', 'fri', 'mon', ...) en timestamp absolu,
  // ancré sur la date de création du todo (pour qu'un "today" créé hier devienne "overdue" aujourd'hui).
  function resoudreEcheance(label, creeLe) {
    if (!label) return null;
    const base = startOfDay(new Date(creeLe || Date.now()));
    const J = 86400000;
    if (label === 'today')    return base;
    if (label === 'tomorrow') return base + J;
    // jour de la semaine : on cherche le prochain ≥ base (lundi=1 ... dimanche=0)
    const dayMap = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 };
    if (label in dayMap) {
      const target = dayMap[label];
      const baseDay = new Date(base).getDay();
      let diff = (target - baseDay + 7) % 7;
      if (diff === 0) diff = 0; // même jour ok
      return base + diff * J;
    }
    if (label === 'week') return base + 6 * J;
    return null;
  }

  // Catégorise un todo en fonction de la date d'échéance et d'aujourd'hui.
  // Retourne : 'overdue' | 'today' | 'tomorrow' | 'week' | 'none' | 'done'.
  function bucket(todo) {
    if (todo.fait) return 'done';
    const due = resoudreEcheance(todo.echeance, todo.creeLe);
    if (due == null) return 'none';
    const today = startOfDay();
    const J = 86400000;
    if (due < today)            return 'overdue';
    if (due < today + J)        return 'today';
    if (due < today + 2 * J)    return 'tomorrow';
    return 'week';
  }

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

    // draftProjet peut valoir 'none' (sans projet) — dans ce cas on ne le réécrit pas.
    function ensureDraftProjet() {
      if (draftProjet === 'none') return;
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
        value: draftProjet || 'none', onchange: v => draftProjet = v,
        options: [
          { value: 'none', label: 'Sans projet' },
          ...projets.filter(p => !p.archive).map(p => ({ value: p.id, label: p.nom })),
        ],
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
      const projVal = selectProjet?.value || draftProjet || 'none';
      const ech   = selectEcheance?.value || draftEcheance;
      if (!titre) return;
      store.actions.ajouterTodo(titre, projVal === 'none' ? null : projVal, ech === 'none' ? null : ech);
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
        chip('Sans projet', filtreProjet === 'none', () => { filtreProjet = 'none'; renderFiltres(); renderList(); }),
        ...projets.filter(p => !p.archive).map(p =>
          chip(p.nom, filtreProjet === p.id, () => { filtreProjet = p.id; renderFiltres(); renderList(); }, p.couleur)
        ),
      );
    }

    function echeanceBadge(b) {
      const map = {
        overdue:  { label: 'en retard',   variant: 'danger' },
        today:    { label: "aujourd'hui", variant: 'accent' },
        tomorrow: { label: 'demain',      variant: 'neutral' },
        week:     { label: 'cette semaine', variant: 'neutral' },
      };
      const m = map[b];
      if (!m) return null;
      return UI.Badge({ variant: m.variant, children: m.label });
    }

    function ouvrirEditionTodo(t) {
      const projets = store.state.projets;
      let modal;
      const nomW    = UI.Input({ label: 'Titre', value: t.titre, autoFocus: true });
      const descW   = UI.Textarea({
        label: 'Description', value: t.description || '',
        placeholder: 'Notes, détails, critères d’acceptation… (facultatif)',
        maxLength: 2000, rows: 4,
      });
      const projW   = UI.Select({
        label: 'Projet', value: t.projetId || 'none',
        options: [
          { value: 'none', label: 'Sans projet' },
          ...projets.map(p => ({ value: p.id, label: p.nom + (p.archive ? ' (archivé)' : '') })),
        ],
      });
      const echW    = UI.Select({
        label: 'Échéance', value: t.echeance || 'none',
        options: [
          { value: 'today',    label: "Aujourd'hui" },
          { value: 'tomorrow', label: 'Demain' },
          { value: 'fri',      label: 'Vendredi' },
          { value: 'mon',      label: 'Lundi prochain' },
          { value: 'week',     label: 'Cette semaine' },
          { value: 'none',     label: 'Sans échéance' },
        ],
      });
      function enregistrer() {
        const titre = nomW.input.value.trim();
        if (!titre) return;
        const ech = echW.input.value;
        const proj = projW.input.value;
        store.actions.majTodo(t.id, {
          titre,
          description: descW.input.value.trim().slice(0, 2000),
          projetId: proj === 'none' ? null : proj,
          echeance: ech === 'none' ? null : ech,
        });
        modal.close();
      }
      function supprimer() {
        if (!confirm(`Effacer la tâche « ${t.titre} » ? Cette action est définitive.`)) return;
        store.actions.supprimerTodo(t.id);
        modal.close();
      }
      nomW.input.addEventListener('keydown', e => { if (e.key === 'Enter') enregistrer(); });
      modal = UI.Modal({
        title: 'Modifier la tâche', width: 460,
        body: el('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } }, nomW, descW, projW, echW),
        footer: [
          UI.Button({ variant: 'destructive', icon: 'trash', children: 'Effacer', onclick: supprimer, style: { marginRight: 'auto' } }),
          UI.Button({ variant: 'ghost', children: 'Annuler', onclick: () => modal.close() }),
          UI.Button({ variant: 'primary', icon: 'check', children: 'Enregistrer', onclick: enregistrer }),
        ],
      });
    }

    function todoRow(t, faded) {
      const proj = store.state.projets.find(p => p.id === t.projetId);
      const hasDesc = !!(t.description && t.description.trim());
      const row = el('div', {
        style: {
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '11px 14px', minHeight: 44, boxSizing: 'border-box',
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
            width: 18, height: 18, borderRadius: 4, marginTop: 1,
            border: `1.5px solid ${t.fait ? 'var(--cv-success-500)' : 'var(--cv-border-strong)'}`,
            background: t.fait ? 'var(--cv-success-500)' : 'transparent',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, padding: 0,
            transition: 'all 120ms',
          },
        }, t.fait ? icon('check', { weight: 'bold', size: 12, style: { color: '#fff' } }) : null),

        el('div', { style: { minWidth: 0, flex: 1 } },
          el('div', {
            title: 'Cliquer pour modifier',
            onclick: () => { if (!t.fait) ouvrirEditionTodo(t); },
            style: {
              font: '400 13px/1.3 var(--cv-font-sans)',
              color: t.fait ? 'var(--cv-fg-subtle)' : 'var(--cv-fg)',
              textDecoration: t.fait ? 'line-through' : 'none',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              cursor: t.fait ? 'default' : 'pointer',
            },
          }, t.titre),
          hasDesc ? el('div', {
            title: t.description,
            style: {
              marginTop: 3,
              font: '400 12px/1.45 var(--cv-font-sans)', color: 'var(--cv-fg-muted)',
              display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            },
          }, t.description) : null,
        ),

        el('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginTop: 1 } },
          proj ? el('span', {
            style: { display: 'inline-flex', alignItems: 'center', gap: 6, font: '500 11px/1 var(--cv-font-sans)', color: 'var(--cv-fg-muted)' },
          },
            el('span', { style: { width: 6, height: 6, borderRadius: 2, background: proj.couleur } }),
            proj.nom,
          ) : el('span', {
            style: { font: '400 11px/1 var(--cv-font-sans)', color: 'var(--cv-fg-subtle)', fontStyle: 'italic' },
          }, 'Sans projet'),

          (t.echeance && !t.fait) ? echeanceBadge(bucket(t)) : null,

          el('div', { style: { display: 'flex', gap: 2 } },
            !t.fait ? UI.IconButton({
              icon: 'play', label: 'Démarrer un chrono sur cette tâche',
              onclick: () => opts.onDemarrerSurTodo(t.projetId, t.titre),
            }) : null,
            !t.fait ? UI.IconButton({
              icon: 'pencil-simple', label: 'Modifier', size: 'sm',
              onclick: () => ouvrirEditionTodo(t),
            }) : null,
            UI.IconButton({
              icon: 'trash', label: 'Effacer', size: 'sm',
              onclick: () => {
                if (!confirm(`Effacer la tâche « ${t.titre} » ? Cette action est définitive.`)) return;
                store.actions.supprimerTodo(t.id);
              },
            }),
          ),
        ),
      );
      return row;
    }

    function renderList() {
      const { todos } = store.state;
      const filtered = todos.filter(t => filtreProjet === 'all' || t.projetId === filtreProjet);

      const groups = {
        'En retard':     filtered.filter(t => bucket(t) === 'overdue'),
        "Aujourd'hui":   filtered.filter(t => bucket(t) === 'today'),
        'Demain':        filtered.filter(t => bucket(t) === 'tomorrow'),
        'Cette semaine': filtered.filter(t => bucket(t) === 'week'),
        'Sans échéance': filtered.filter(t => bucket(t) === 'none'),
        'Terminé':       filtered.filter(t => bucket(t) === 'done'),
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
