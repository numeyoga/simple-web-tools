// projects view: cards with totals, creation modal.
import * as UI from './ui.js';

const { el, icon, formatDuration, liveDuration } = UI;

/* Curated palette (16 well-separated hues). A custom colour can be entered with the native picker. */
const COLORS = [
  '#ea580c',
  '#d97706',
  '#ca8a04',
  '#65a30d',
  '#16a34a',
  '#0d9488',
  '#0891b2',
  '#0284c7',
  '#2563eb',
  '#4f46e5',
  '#7c3aed',
  '#9333ea',
  '#c026d3',
  '#db2777',
  '#e11d48',
  '#475569',
];
/** @param {string | null | undefined} c */
const norm = (c) => (c || '').trim().toLowerCase();

/** @typedef {import('../../types.js').Project} Project */

/** @type {import('./types.js').ViewFactory} */
export function createProjectsView(store, opts) {
  let showArchived = false;

  // Preference: show or hide the cumulated times and the session count on the
  // cards. Hidden by default (not useful in every case, and visually costly).
  // Persisted in localStorage. When hidden, each card offers an on-demand
  // computation, project by project.
  const PREF_TOTALS = 'chrono.prefs.projetsTotaux';
  let showTotals = localStorage.getItem(PREF_TOTALS) === '1';
  const computed = new Set(); // projects whose total was computed on demand

  const host = el('div', { class: 'ch-pile ch-g16' });

  /** @param {Project | null} [existing] */
  function openProjectModal(existing = null) {
    const isEdit = !!existing;
    const draft = existing
      ? { name: existing.name, client: existing.client || '', color: existing.color }
      : { name: '', client: '', color: COLORS[0] ?? '#2563eb' };
    const colorsRow = el('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(9, 28px)',
        gap: 8,
        alignItems: 'center',
      },
    });

    /* Hidden native picker, triggered by the "+" button. */
    const nativePicker = el('input', {
      type: 'color',
      value: COLORS.includes(norm(draft.color)) ? COLORS[0] : draft.color,
      oninput: (/** @type {import('./types.js').TargetEvent} */ e) => {
        draft.color = e.target.value;
        paintColors();
      },
      style: {
        position: 'absolute',
        width: 0,
        height: 0,
        padding: 0,
        border: 0,
        opacity: 0,
        pointerEvents: 'none',
      },
    });

    function paintColors() {
      const current = norm(draft.color);
      const isInPalette = COLORS.some((c) => norm(c) === current);
      colorsRow.replaceChildren(
        ...COLORS.map((c) => {
          const isSelected = norm(c) === current;
          return el('button', {
            type: 'button',
            onclick: () => {
              draft.color = c;
              paintColors();
            },
            'aria-label': `Couleur ${c}`,
            title: c,
            style: {
              width: 28,
              height: 28,
              borderRadius: 8,
              border: isSelected ? '2px solid var(--cv-fg)' : '2px solid transparent',
              background: c,
              cursor: 'pointer',
              padding: 0,
              boxShadow: isSelected ? '0 0 0 2px var(--cv-surface) inset' : 'none',
            },
          });
        }),
        /* "Custom colour" button: opens the native colour picker.
             If a custom colour is already chosen, it is shown in the button. */
        el(
          'button',
          {
            type: 'button',
            onclick: () => nativePicker.click(),
            'aria-label': 'Couleur personnalisée',
            title: isInPalette
              ? 'Couleur personnalisée…'
              : `Couleur personnalisée : ${draft.color}`,
            style: {
              width: 28,
              height: 28,
              borderRadius: 8,
              padding: 0,
              cursor: 'pointer',
              border: !isInPalette
                ? '2px solid var(--cv-fg)'
                : '1px dashed var(--cv-border-strong)',
              background: !isInPalette
                ? draft.color
                : 'conic-gradient(from 180deg, #ef4444, #f59e0b, #84cc16, #06b6d4, #6366f1, #d946ef, #ef4444)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              textShadow: '0 0 2px rgba(0,0,0,0.4)',
              boxShadow: !isInPalette ? '0 0 0 2px var(--cv-surface) inset' : 'none',
            },
          },
          !isInPalette ? '' : icon('plus', { size: 14, style: { color: 'var(--cv-fg)' } }),
        ),
        nativePicker,
      );
    }
    paintColors();

    const nameW = UI.Input({
      label: 'Nom du projet',
      value: draft.name,
      placeholder: 'Ex. Refonte site — Acme',
      autoFocus: !isEdit,
    });
    /* Autocomplete on the clients already known. The user can also type
         a new free value: it is created on the fly. */
    const knownClients = Array.from(
      new Set(
        store.state.projects
          .filter((p) => p.client && p.id !== existing?.id)
          .map((p) => p.client.trim())
          .filter(Boolean),
      ),
    );
    const clientW = UI.Autocomplete({
      label: 'Client',
      value: draft.client,
      options: knownClients,
      placeholder: 'Ex. Acme SAS (facultatif)',
      hint:
        knownClients.length > 0
          ? `${knownClients.length} client${knownClients.length > 1 ? 's' : ''} déjà saisi${knownClients.length > 1 ? 's' : ''} — ou tape un nouveau nom`
          : null,
    });
    const inputName = nameW.input;
    const inputClient = clientW.input;

    const body = el(
      'div',
      { class: 'ch-pile ch-g12' },
      nameW,
      clientW,
      el(
        'div',
        null,
        el('div', { class: 'ch-label', style: { marginBottom: 6 } }, 'Couleur'),
        colorsRow,
      ),
    );

    function save() {
      const name = inputName.value.trim();
      if (!name) return;
      const patch = {
        name,
        client: inputClient.value.trim(),
        color: draft.color,
      };
      if (existing) store.actions.updateProject(existing.id, patch);
      else store.actions.addProject(patch.name, patch.client, patch.color);
      modal.close();
    }

    function originalDelete() {
      if (!existing) return;
      const { sessions, todos } = store.state;
      const n = sessions.filter((s) => s.projectId === existing.id).length;
      const m = todos.filter((t) => t.projectId === existing.id).length;
      const msg =
        n + m > 0
          ? `Supprimer le projet « ${existing.name} » ? ${n} session${n > 1 ? 's' : ''} et ${m} tâche${m > 1 ? 's' : ''} seront aussi supprimées.`
          : `Supprimer le projet « ${existing.name} » ?`;
      if (!confirm(msg)) return;
      store.actions.deleteProject(existing.id);
      modal.close();
    }

    const saveButton = UI.Button({
      variant: 'primary',
      icon: 'check',
      children: isEdit ? 'Enregistrer' : 'Créer',
      onclick: save,
    });
    const updateDisabled = () => {
      saveButton.disabled = !inputName.value.trim();
      saveButton.style.opacity = saveButton.disabled ? '0.5' : '1';
      saveButton.style.cursor = saveButton.disabled ? 'not-allowed' : 'pointer';
    };
    inputName.addEventListener('input', updateDisabled);
    updateDisabled();
    inputName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
    });

    const footer = [];
    if (isEdit)
      footer.push(
        UI.Button({
          variant: 'destructive',
          icon: 'trash',
          children: 'Supprimer',
          onclick: originalDelete,
          style: { marginRight: 'auto' },
        }),
      );
    footer.push(UI.Button({ variant: 'ghost', children: 'Annuler', onclick: () => modal.close() }));
    footer.push(saveButton);

    const modal = UI.Modal({
      title: isEdit ? 'Modifier le projet' : 'Nouveau projet',
      width: 480,
      body,
      footer,
    });
  }

  function openCreationModal() {
    openProjectModal(null);
  }

  function render() {
    const { projects, sessions, todos } = store.state;
    const listEl = projects.filter((p) => (showArchived ? p.archived : !p.archived));

    /** @type {Record<string, { duration: number, count: number }>} */
    const totals = {};
    for (const s of sessions) {
      const total = (totals[s.projectId] ??= { duration: 0, count: 0 });
      total.duration += liveDuration(s);
      total.count += 1;
    }
    /** @type {Record<string, { open: number, done: number }>} */
    const todosByProject = {};
    for (const t of todos) {
      const counts = (todosByProject[String(t.projectId)] ??= { open: 0, done: 0 });
      if (t.done) counts.done += 1;
      else counts.open += 1;
    }

    host.replaceChildren(
      // Header
      el(
        'div',
        { class: 'ch-flex-c ch-g12' },
        el(
          'div',
          null,
          el('div', { class: 'ch-titre-page' }, 'Projets'),
          el(
            'div',
            { class: 'ch-meta', style: { marginTop: 4 } },
            `${projects.filter((p) => !p.archived).length} actifs · ${projects.filter((p) => p.archived).length} archivés`,
          ),
        ),
        el(
          'div',
          { class: 'ch-flex ch-g8', style: { marginLeft: 'auto' } },
          UI.Button({
            variant: showTotals ? 'primary' : 'secondary',
            icon: showTotals ? 'clock' : 'clock-countdown',
            children: showTotals ? 'Totaux affichés' : 'Totaux masqués',
            title:
              'Afficher ou masquer les temps cumulés et le nombre de sessions sur toutes les cartes',
            onclick: () => {
              showTotals = !showTotals;
              localStorage.setItem(PREF_TOTALS, showTotals ? '1' : '0');
              computed.clear();
              render();
            },
          }),
          UI.Button({
            variant: showArchived ? 'primary' : 'secondary',
            icon: 'archive',
            children: showArchived ? 'Archivés' : 'Actifs',
            onclick: () => {
              showArchived = !showArchived;
              render();
            },
          }),
          UI.Button({
            variant: 'primary',
            icon: 'plus',
            children: 'Nouveau projet',
            mutates: true,
            onclick: openCreationModal,
          }),
        ),
      ),

      // Grid
      listEl.length === 0
        ? el(
            'div',
            {
              style: {
                padding: '48px 16px',
                textAlign: 'center',
                color: 'var(--cv-fg-muted)',
                font: '400 14px/1.5 var(--cv-font-sans)',
                border: '1px dashed var(--cv-border-strong)',
                borderRadius: 10,
              },
            },
            icon('folder-open', { size: 32, style: { color: 'var(--cv-fg-subtle)' } }),
            el(
              'div',
              { style: { marginTop: 8 } },
              `Aucun projet ${showArchived ? 'archivé' : 'actif'}.`,
            ),
          )
        : el(
            'div',
            {
              style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 12,
              },
            },
            listEl.map((p) =>
              projectCard(
                p,
                totals[p.id] || { duration: 0, count: 0 },
                todosByProject[p.id] || { open: 0, done: 0 },
              ),
            ),
          ),
    );
  }

  /**
   * @param {Project} p
   * @param {{ duration: number, count: number }} t
   * @param {{ open: number, done: number }} td
   */
  function projectCard(p, t, td) {
    return el(
      'article',
      {
        class: 'ch-carte ch-carte--rogne ch-pile ch-g12',
        style: { padding: 16, position: 'relative' },
      },
      el('div', {
        style: {
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: 4,
          background: p.color,
        },
      }),
      el(
        'div',
        { style: { paddingLeft: 6 } },
        el(
          'div',
          { style: { font: '600 14px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg)' } },
          p.name,
        ),
        el('div', { class: 'ch-meta', style: { marginTop: 2 } }, p.client || '—'),
      ),

      showTotals || computed.has(p.id)
        ? el(
            'div',
            { style: { paddingLeft: 6 } },
            el('div', { class: 'ch-surtitre ch-surtitre--xs' }, 'Temps total'),
            el(
              'div',
              {
                style: {
                  font: '500 22px/1 var(--cv-font-mono)',
                  color: 'var(--cv-fg)',
                  marginTop: 6,
                  letterSpacing: '-0.01em',
                },
              },
              formatDuration(t.duration),
            ),
            el(
              'div',
              {
                style: {
                  font: '400 11px/1.2 var(--cv-font-sans)',
                  color: 'var(--cv-fg-subtle)',
                  marginTop: 2,
                },
              },
              `${t.count} session${t.count > 1 ? 's' : ''} enregistrée${t.count > 1 ? 's' : ''}`,
            ),
          )
        : el(
            'div',
            { style: { paddingLeft: 6 } },
            el(
              'button',
              {
                onclick: () => {
                  computed.add(p.id);
                  render();
                },
                title: 'Calculer le temps cumulé et le nombre de sessions de ce projet',
                class: 'ch-btn-pointille',
              },
              icon('clock-countdown', { size: 14 }),
              'Calculer le temps',
            ),
          ),

      el(
        'div',
        { class: 'ch-flex ch-g6', style: { paddingLeft: 6 } },
        UI.Badge({ variant: 'neutral', children: `${td.open} todo${td.open > 1 ? 's' : ''}` }),
        td.done > 0 ? UI.Badge({ variant: 'success', children: `${td.done} faites` }) : null,
      ),

      el(
        'div',
        { class: 'ch-flex ch-g6', style: { marginTop: 'auto', paddingLeft: 6 } },
        !p.archived
          ? [
              UI.Button({
                size: 'sm',
                variant: 'primary',
                icon: 'play',
                children: 'Démarrer',
                mutates: true,
                onclick: () => opts.onStartOnProject(p.id),
                style: { flex: 1 },
              }),
              UI.IconButton({
                icon: 'pencil-simple',
                label: 'Modifier',
                variant: 'secondary',
                size: 'sm',
                onclick: () => openProjectModal(p),
              }),
              UI.IconButton({
                icon: 'archive',
                label: 'Archiver',
                variant: 'secondary',
                size: 'sm',
                mutates: true,
                onclick: () => store.actions.toggleProjectArchived(p.id),
              }),
            ]
          : [
              UI.Button({
                size: 'sm',
                variant: 'secondary',
                icon: 'arrow-counter-clockwise',
                children: 'Désarchiver',
                mutates: true,
                onclick: () => store.actions.toggleProjectArchived(p.id),
                style: { flex: 1 },
              }),
              UI.IconButton({
                icon: 'pencil-simple',
                label: 'Modifier',
                variant: 'secondary',
                size: 'sm',
                onclick: () => openProjectModal(p),
              }),
            ],
      ),
    );
  }

  render();
  const offState = store.onState(render);

  return {
    el: host,
    destroy() {
      offState();
    },
  };
}
