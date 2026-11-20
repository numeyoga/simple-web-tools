// projects view: cards with totals, creation modal.
import { getShowProjectTotals, setShowProjectTotals } from '../preferences.js';
import * as UI from './ui.js';

const { el, formatDuration, liveDuration } = UI;

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
  // Persisted in localStorage (`chrono-show-project-totals`, adapters/preferences.js). When hidden,
  // each card offers an on-demand computation, project by project.
  let showTotals = getShowProjectTotals();
  const computed = new Set(); // projects whose total was computed on demand

  const host = el('div', { class: 'ch-view' });

  /** @param {Project | null} [existing] */
  function openProjectModal(existing = null) {
    const isEdit = !!existing;
    const draft = existing
      ? { name: existing.name, client: existing.client || '', color: existing.color }
      : { name: '', client: '', color: COLORS[0] ?? '#2563eb' };
    const colorsRow = el('div', { class: 'ch-swatches' });

    /* Hidden native picker, triggered by the "+" button. */
    const nativePicker = el('input', {
      type: 'color',
      value: COLORS.includes(norm(draft.color)) ? COLORS[0] : draft.color,
      tabindex: -1,
      'aria-hidden': 'true',
      class: 'ch-color-input',
      oninput: (/** @type {import('./types.js').TargetEvent} */ e) => {
        draft.color = e.target.value;
        paintColors();
      },
    });

    function paintColors() {
      const current = norm(draft.color);
      const isInPalette = COLORS.some((c) => norm(c) === current);
      colorsRow.replaceChildren(
        ...COLORS.map((c) =>
          el('button', {
            type: 'button',
            class: 'ch-swatch-btn',
            'aria-pressed': String(norm(c) === current),
            onclick: () => {
              draft.color = c;
              paintColors();
            },
            'aria-label': `Couleur ${c}`,
            style: { background: c },
          }),
        ),
        /* "Custom colour" button: opens the native colour picker.
             If a custom colour is already chosen, it is shown in the button. */
        isInPalette
          ? UI.IconButton({
              icon: 'plus',
              label: 'Couleur personnalisée',
              variant: 'secondary',
              onclick: () => nativePicker.click(),
            })
          : el('button', {
              type: 'button',
              class: 'ch-swatch-btn',
              'aria-pressed': 'true',
              'aria-label': `Couleur personnalisée ${draft.color}`,
              style: { background: draft.color },
              onclick: () => nativePicker.click(),
            }),
        nativePicker,
      );
    }
    paintColors();

    const nameW = UI.Input({
      label: 'Nom du projet',
      value: draft.name,
      placeholder: 'Ex. Refonte site — Acme',
      autoFocus: true,
      required: true,
    });
    /* Suggestions from the clients already known. The user can also type
         a new free value: it is created on the fly. */
    const knownClients = Array.from(
      new Set(
        store.state.projects
          .filter((p) => p.client && p.id !== existing?.id)
          .map((p) => p.client.trim())
          .filter(Boolean),
      ),
    );
    const clientHint =
      knownClients.length > 0
        ? `${knownClients.length} client${knownClients.length > 1 ? 's' : ''} déjà saisi${knownClients.length > 1 ? 's' : ''}, ou tape un nouveau nom`
        : null;
    const clientW =
      knownClients.length > 0
        ? UI.Combobox({
            label: 'Client',
            value: draft.client,
            options: knownClients,
            placeholder: 'Ex. Acme SAS (facultatif)',
            hint: clientHint,
            emptyText: 'Aucun client correspondant. Ce nom sera créé.',
          })
        : UI.Input({
            label: 'Client',
            value: draft.client,
            placeholder: 'Ex. Acme SAS (facultatif)',
          });
    const inputName = nameW.input;
    const inputClient = clientW.input;

    const body = el(
      'div',
      { class: 'ch-stack ch-gap-5' },
      nameW,
      clientW,
      el(
        'fieldset',
        { class: 'cv-fieldset' },
        el('legend', { class: 'cv-label' }, 'Couleur'),
        colorsRow,
      ),
    );

    function save() {
      const name = inputName.value.trim();
      if (!name) {
        nameW.setError('Le nom est vide. Saisis le nom du projet.');
        inputName.focus();
        return;
      }
      const patch = {
        name,
        client: inputClient.value.trim(),
        color: draft.color,
      };
      if (existing) store.actions.updateProject(existing.id, patch);
      else store.actions.addProject(patch.name, patch.client, patch.color);
      modal.close();
    }

    async function originalDelete() {
      if (!existing) return;
      const { sessions, todos } = store.state;
      const n = sessions.filter((s) => s.projectId === existing.id).length;
      const m = todos.filter((t) => t.projectId === existing.id).length;
      const msg =
        n + m > 0
          ? `Le projet « ${existing.name} » sera supprimé avec ${n} session${n > 1 ? 's' : ''} et ${m} tâche${m > 1 ? 's' : ''}. Tu ne pourras pas annuler.`
          : `Le projet « ${existing.name} » sera supprimé. Tu ne pourras pas annuler.`;
      const ok = await UI.Confirm({
        title: `Supprimer le projet « ${existing.name} » ?`,
        message: msg,
        confirmLabel: 'Supprimer le projet',
        danger: true,
        within: modal,
      });
      if (!ok) return;
      store.actions.deleteProject(existing.id);
      modal.close();
    }

    const saveButton = UI.Button({
      variant: 'primary',
      children: isEdit ? 'Enregistrer' : 'Créer',
      onclick: save,
    });
    const updateDisabled = () => {
      saveButton.disabled = !inputName.value.trim();
    };
    inputName.addEventListener('input', () => {
      nameW.setError(null);
      updateDisabled();
    });
    updateDisabled();
    inputName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
    });

    const footer = [];
    if (isEdit)
      footer.push(
        UI.Button({
          variant: 'danger',
          children: 'Supprimer',
          onclick: originalDelete,
          className: 'ch-push',
        }),
      );
    footer.push(UI.Button({ children: 'Annuler', onclick: () => modal.close() }));
    footer.push(saveButton);

    const modal = UI.Modal({
      title: isEdit ? 'Modifier le projet' : 'Nouveau projet',
      body,
      footer,
    });
  }

  function openCreationModal() {
    openProjectModal(null);
  }

  const metaNode = el('p', { class: 'ch-figure ch-page-title' });
  const gridSlot = el('div', null);
  host.append(
    // Header: built once, so the controls keep the focus when the grid changes
    el(
      'div',
      { class: 'ch-row ch-center ch-wrap ch-gap-4' },
      metaNode,
      el(
        'div',
        { class: 'ch-row ch-center ch-wrap ch-gap-4 ch-end' },
        UI.Checkbox({
          label: 'Afficher les totaux',
          switchRole: true,
          checked: showTotals,
          onchange: (checked) => {
            showTotals = checked;
            setShowProjectTotals(showTotals);
            computed.clear();
            render();
          },
        }),
        UI.Segmented({
          legend: 'Projets affichés',
          name: 'projects-shown',
          options: [
            { value: 'active', label: 'Actifs' },
            { value: 'archived', label: 'Archivés' },
          ],
          value: showArchived ? 'archived' : 'active',
          onchange: (value) => {
            showArchived = value === 'archived';
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
    gridSlot,
  );

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

    metaNode.textContent = `${projects.filter((p) => !p.archived).length} actifs · ${projects.filter((p) => p.archived).length} archivés`;
    gridSlot.replaceChildren(
      listEl.length === 0
        ? UI.EmptyState({
            icon: 'folder-open',
            title: `Aucun projet ${showArchived ? 'archivé' : 'actif'}.`,
            text: showArchived
              ? 'Les projets que tu archives apparaissent ici.'
              : 'Crée un projet pour y rattacher des chronos et des todos.',
          })
        : el(
            'div',
            { class: 'ch-grid-cards' },
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
      { class: 'cv-card cv-card--compact ch-project-card' },
      el('div', { class: 'ch-card-stripe', style: { background: p.color } }),
      el(
        'div',
        null,
        el('h2', { class: 'cv-card__title' }, p.name),
        el('div', { class: 'cv-card__meta ch-mt-1' }, p.client || '—'),
      ),

      showTotals || computed.has(p.id)
        ? el(
            'div',
            null,
            el('div', { class: 'cv-overline' }, 'Temps total'),
            el('div', { class: 'cv-num ch-kpi ch-mt-3' }, formatDuration(t.duration)),
            el(
              'div',
              { class: 'ch-subtle ch-mt-1' },
              `${t.count} session${t.count > 1 ? 's' : ''} enregistrée${t.count > 1 ? 's' : ''}`,
            ),
          )
        : el(
            'div',
            null,
            UI.Button({
              size: 'sm',
              icon: 'clock-countdown',
              children: 'Calculer le temps',
              onclick: () => {
                computed.add(p.id);
                render();
              },
            }),
          ),

      el(
        'div',
        { class: 'ch-row ch-wrap ch-gap-3' },
        UI.Tag(`${td.open} todo${td.open > 1 ? 's' : ''}`),
        td.done > 0 ? UI.Badge({ variant: 'success', children: `${td.done} faites` }) : null,
      ),

      el(
        'div',
        { class: 'ch-row ch-gap-3 ch-mt-auto' },
        !p.archived
          ? [
              UI.Button({
                size: 'sm',
                variant: 'primary',
                icon: 'play',
                children: 'Démarrer',
                mutates: true,
                onclick: () => opts.onStartOnProject(p.id),
                className: 'ch-grow',
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
                className: 'ch-grow',
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
