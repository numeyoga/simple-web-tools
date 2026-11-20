// to-do list: add, filter by project, groups by due date.
import {
  bucket as bucketAt,
  dueDateToTimestamp,
  presetToDate as presetToDateAt,
} from '../../core/due-dates.js';
import * as UI from './ui.js';

const { el } = UI;

// A due date is stored as a local date 'YYYY-MM-DD' (or null).
// The interface shortcuts ('today', 'tomorrow', 'fri', 'mon', 'week'...) are only
// presets: they are converted to a date when chosen, relative to TODAY (`ref`).
// The logic (conversion, buckets) lives in src/core/due-dates.js; these wrappers
// supply the current time.
/** @typedef {import('../../types.js').Todo} Todo */

const presetToDate = (/** @type {string} */ preset, ref = Date.now()) =>
  presetToDateAt(preset, ref);
const bucket = (/** @type {Pick<Todo, 'done' | 'dueDate'>} */ todo, ref = Date.now()) =>
  bucketAt(todo, ref);

// Short date for the badge: "ven. 21 nov.".
/** @param {unknown} str */
function formatShortDueDate(str) {
  const ts = dueDateToTimestamp(str);
  return ts == null
    ? ''
    : new Date(ts).toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
}

/** @type {import('./types.js').ViewFactory} */
export function createTodosView(store, opts) {
  let projectFilter = 'all';
  let draftDueDate = 'today';
  /** @type {string | null} */
  let draftProject = null;
  /** @type {import('../../types.js').Project[] | null} */
  let lastProjectsRef = null;

  const host = el('div', { class: 'ch-view ch-view--narrow' });
  const headerSlot = el('div', null);
  const formSlot = el('div', null);
  const filtersSlot = el('div', null);
  const listSlot = el('div', { class: 'ch-stack ch-gap-5' });
  host.append(headerSlot, formSlot, filtersSlot, listSlot);

  // Refs to the form inputs (kept between renders of the list)
  /** @type {HTMLInputElement | undefined} */
  let inputTitle;
  /** @type {HTMLSelectElement | undefined} */
  let selectProject;
  /** @type {HTMLSelectElement | undefined} */
  let selectDueDate;

  // draftProject can be 'none' (no project): in that case it is not rewritten.
  function ensureDraftProject() {
    if (draftProject === 'none') return;
    const projects = store.state.projects;
    const fallback = projects.find((p) => !p.archived) ?? projects[0];
    if (!projects.find((p) => p.id === draftProject) && fallback) {
      draftProject = fallback.id;
    }
  }

  function renderHeader() {
    const { todos } = store.state;
    const open = todos.filter((t) => !t.done).length;
    const done = todos.filter((t) => t.done).length;
    // The page title is in the top bar: the header keeps the summary.
    headerSlot.replaceChildren(
      el('p', { class: 'ch-figure ch-page-title' }, `${open} en cours · ${done} terminées`),
    );
  }

  function renderForm() {
    ensureDraftProject();
    const projects = store.state.projects;

    const inputW = UI.Input({
      label: 'Nouvelle tâche',
      value: '',
      placeholder: "Qu'est-ce qu'il faut faire ?",
      icon: 'plus',
      onkeydown: (e) => {
        if (e.key === 'Enter') submit();
      },
      className: 'ch-field-wide',
    });
    inputTitle = inputW.input;

    const selectProjectW = UI.Select({
      label: 'Projet',
      value: draftProject || 'none',
      onchange: (v) => (draftProject = v),
      options: [
        { value: 'none', label: 'Sans projet' },
        ...projects.filter((p) => !p.archived).map((p) => ({ value: p.id, label: p.name })),
      ],
      className: 'ch-field-md',
    });
    selectProject = selectProjectW.input;

    const selectDueW = UI.Select({
      label: 'Échéance',
      value: draftDueDate,
      onchange: (v) => (draftDueDate = v),
      options: [
        { value: 'today', label: "Aujourd'hui" },
        { value: 'tomorrow', label: 'Demain' },
        { value: 'fri', label: 'Cette semaine' },
        { value: 'none', label: 'Sans échéance' },
      ],
      className: 'ch-field-sm',
    });
    selectDueDate = selectDueW.input;

    formSlot.replaceChildren(
      el(
        'div',
        { class: 'cv-card cv-card--compact ch-row ch-wrap ch-align-end ch-gap-4' },
        inputW,
        selectProjectW,
        selectDueW,
        UI.Button({
          variant: 'primary',
          icon: 'arrow-right',
          children: 'Ajouter',
          mutates: true,
          onclick: submit,
        }),
      ),
    );
  }

  function submit() {
    const title = (inputTitle?.value || '').trim();
    const projectValue = selectProject?.value || draftProject || 'none';
    const due = selectDueDate?.value || draftDueDate;
    if (!title) return;
    // the preset ('today', 'fri'...) is converted to an absolute date now, not stored as is
    store.actions.addTodo(title, projectValue === 'none' ? null : projectValue, presetToDate(due));
    if (inputTitle) {
      inputTitle.value = '';
      inputTitle.focus();
    }
  }

  // The project filter is a select: built when the projects change, never on a choice, so the
  // select keeps the keyboard focus while the list below it is redrawn.
  function renderFilters() {
    const projects = store.state.projects;
    filtersSlot.replaceChildren(
      UI.Select({
        label: 'Filtrer par projet',
        value: projectFilter,
        onchange: (v) => {
          projectFilter = v;
          renderList();
        },
        options: [
          { value: 'all', label: 'Tous les projets' },
          { value: 'none', label: 'Sans projet' },
          ...projects.filter((p) => !p.archived).map((p) => ({ value: p.id, label: p.name })),
        ],
        className: 'ch-field-md',
      }),
    );
  }

  /** @param {Todo} t */
  function dueDateBadge(t) {
    const b = bucket(t);
    /** @type {Partial<Record<ReturnType<typeof bucket>, { label: string, variant: import('./types.js').BadgeOptions['variant'] }>>} */
    const map = {
      overdue: { label: 'En retard', variant: 'danger' },
      today: { label: "Aujourd'hui", variant: 'accent' },
      tomorrow: { label: 'Demain', variant: 'neutral' },
      // beyond tomorrow: the short date is more useful than "this week"
      week: { label: formatShortDueDate(t.dueDate) || 'Cette semaine', variant: 'neutral' },
    };
    const m = map[b];
    if (!m) return null;
    return UI.Badge({ variant: m.variant, children: m.label });
  }

  /** @param {Todo} t */
  function openTodoEditor(t) {
    const projects = store.state.projects;
    const nameW = UI.Input({ label: 'Titre', value: t.title, autoFocus: true });
    const descW = UI.Textarea({
      label: 'Description',
      value: t.description || '',
      placeholder: 'Notes, détails, critères d’acceptation… (facultatif)',
      maxLength: 2000,
      rows: 4,
    });
    const projectW = UI.Select({
      label: 'Projet',
      value: t.projectId || 'none',
      options: [
        { value: 'none', label: 'Sans projet' },
        ...projects.map((p) => ({ value: p.id, label: p.name + (p.archived ? ' (archivé)' : '') })),
      ],
    });
    // Due date: editable absolute date + shortcuts that fill the field (relative to today).
    const dueW = UI.Input({
      label: 'Échéance',
      type: 'date',
      value: dueDateToTimestamp(t.dueDate) != null ? t.dueDate : '',
    });
    /** @type {[string, string][]} */
    const shortcuts = [
      ['today', "Aujourd'hui"],
      ['tomorrow', 'Demain'],
      ['fri', 'Vendredi'],
      ['mon', 'Lundi'],
      ['none', 'Aucune'],
    ];
    const shortcutsRow = el(
      'div',
      { class: 'ch-row ch-wrap ch-gap-3' },
      shortcuts.map(([preset, label]) =>
        UI.Button({
          size: 'sm',
          children: label,
          onclick: () => {
            dueW.input.value = presetToDate(preset) || '';
          },
        }),
      ),
    );
    function save() {
      const title = nameW.input.value.trim();
      if (!title) {
        nameW.setError('Le titre est vide. Saisis le titre de la tâche.');
        nameW.input.focus();
        return;
      }
      const due = dueW.input.value; // 'YYYY-MM-DD' or '' (field cleared)
      const project = projectW.input.value;
      store.actions.updateTodo(t.id, {
        title,
        description: descW.input.value.trim().slice(0, 2000),
        projectId: project === 'none' ? null : project,
        dueDate: dueDateToTimestamp(due) != null ? due : null,
      });
      modal.close();
    }
    async function originalDelete() {
      const ok = await UI.Confirm({
        title: 'Effacer la tâche ?',
        message: `« ${t.title} » sera effacée. Tu ne pourras pas annuler.`,
        confirmLabel: 'Effacer la tâche',
        danger: true,
        within: modal,
      });
      if (!ok) return;
      store.actions.deleteTodo(t.id);
      modal.close();
    }
    nameW.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
    });
    nameW.input.addEventListener('input', () => nameW.setError(null));
    const modal = UI.Modal({
      title: 'Modifier la tâche',
      body: el('div', { class: 'ch-stack ch-gap-4' }, nameW, descW, projectW, dueW, shortcutsRow),
      footer: [
        UI.Button({
          variant: 'danger',
          children: 'Effacer',
          onclick: originalDelete,
          className: 'ch-push',
        }),
        UI.Button({ children: 'Annuler', onclick: () => modal.close() }),
        UI.Button({
          variant: 'primary',
          children: 'Enregistrer',
          onclick: save,
        }),
      ],
    });
  }

  /**
   * @param {Todo} t
   * @param {boolean} isDone
   */
  function todoRow(t, isDone) {
    const project = store.state.projects.find((p) => p.id === t.projectId);
    const hasDesc = !!(t.description && t.description.trim());
    const row = el(
      'div',
      { class: 'ch-line ch-line--top ch-wrap' },
      UI.Checkbox({
        ariaLabel: t.title,
        checked: t.done,
        mutates: true,
        onchange: () => store.actions.toggleTodo(t.id),
      }),

      el(
        'div',
        { class: 'ch-grow ch-todo-main' },
        isDone
          ? el('div', { class: 'ch-ellipsis ch-done' }, t.title)
          : el(
              'button',
              {
                type: 'button',
                class: 'ch-todo-title ch-ellipsis',
                onclick: () => openTodoEditor(t),
              },
              t.title,
            ),
        hasDesc
          ? el(
              'div',
              {
                class: `ch-meta ch-clamp-2 ch-mt-1${isDone ? ' ch-done' : ''}`,
                title: t.description,
              },
              t.description,
            )
          : null,
      ),

      el(
        'div',
        { class: 'ch-row ch-center ch-wrap ch-gap-3 ch-shrink-0' },
        project
          ? el(
              'span',
              { class: 'ch-meta ch-row ch-center ch-gap-3' },
              el('span', { class: 'ch-swatch', style: { background: project.color } }),
              project.name,
            )
          : el('span', { class: 'ch-subtle ch-italic' }, 'Sans projet'),

        t.dueDate && !t.done ? dueDateBadge(t) : null,

        el(
          'div',
          { class: 'ch-row ch-gap-1' },
          !t.done
            ? UI.IconButton({
                icon: 'play',
                label: 'Démarrer un chrono sur cette tâche',
                mutates: true,
                onclick: () => opts.onStartOnTodo(t.projectId, t.title),
              })
            : null,
          !t.done
            ? UI.IconButton({
                icon: 'pencil-simple',
                label: 'Modifier',
                size: 'sm',
                onclick: () => openTodoEditor(t),
              })
            : null,
          UI.IconButton({
            icon: 'trash',
            label: 'Effacer',
            size: 'sm',
            mutates: true,
            onclick: async () => {
              const ok = await UI.Confirm({
                title: 'Effacer la tâche ?',
                message: `« ${t.title} » sera effacée. Tu ne pourras pas annuler.`,
                confirmLabel: 'Effacer la tâche',
                danger: true,
              });
              if (ok) store.actions.deleteTodo(t.id);
            },
          }),
        ),
      ),
    );
    return row;
  }

  function renderList() {
    const { todos } = store.state;
    const filtered = todos.filter((t) => projectFilter === 'all' || t.projectId === projectFilter);

    const groups = {
      'En retard': filtered.filter((t) => bucket(t) === 'overdue'),
      "Aujourd'hui": filtered.filter((t) => bucket(t) === 'today'),
      Demain: filtered.filter((t) => bucket(t) === 'tomorrow'),
      'Cette semaine': filtered.filter((t) => bucket(t) === 'week'),
      'Sans échéance': filtered.filter((t) => bucket(t) === 'none'),
      Terminé: filtered.filter((t) => bucket(t) === 'done'),
    };

    const sections = [];
    for (const [label, items] of Object.entries(groups)) {
      if (items.length === 0) continue;
      const isOverdue = label === 'En retard';
      const isDone = label === 'Terminé';
      sections.push(
        el(
          'section',
          { class: 'cv-card ch-flush' },
          el(
            'header',
            { class: `ch-card-header ch-gap-3${isOverdue ? ' ch-card-header--danger' : ''}` },
            el(
              'h2',
              { class: `cv-overline ch-title-reset${isOverdue ? ' ch-danger-text' : ''}` },
              label,
            ),
            el('span', { class: 'cv-num ch-subtle' }, String(items.length)),
          ),
          el(
            'div',
            null,
            items.map((t) => todoRow(t, isDone)),
          ),
        ),
      );
    }

    if (filtered.length === 0) {
      sections.push(
        UI.EmptyState({ icon: 'check-circle', title: 'Tout est à jour sur ce projet.' }),
      );
    }

    listSlot.replaceChildren(...sections);
  }

  function render() {
    renderHeader();
    if (store.state.projects !== lastProjectsRef) {
      renderForm();
      renderFilters();
      lastProjectsRef = store.state.projects;
    }
    renderList();
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

// Pure functions exposed for the tests.
