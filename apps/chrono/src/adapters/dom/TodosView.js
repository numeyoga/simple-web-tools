// to-do list: add, filter by project, groups by due date.
import {
  bucket as bucketAt,
  dueDateToTimestamp,
  presetToDate as presetToDateAt,
} from '../../core/due-dates.js';
import * as UI from './ui.js';

const { el, t, formatIsoDate, formatNumber, weekdayName, capitalize } = UI;

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

// Short date for the badge: "ven. 21 nov." / "Fri, Nov 21".
/** @param {unknown} str */
function formatShortDueDate(str) {
  return dueDateToTimestamp(str) == null
    ? ''
    : formatIsoDate(String(str), { weekday: 'short', day: 'numeric', month: 'short' });
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
    const open = todos.filter((todo) => !todo.done).length;
    const done = todos.filter((todo) => todo.done).length;
    // The page title is in the top bar: the header keeps the summary.
    headerSlot.replaceChildren(
      el(
        'p',
        { class: 'ch-figure ch-page-title' },
        t('todos.summary', { open: formatNumber(open), done: formatNumber(done) }),
      ),
    );
  }

  function renderForm() {
    ensureDraftProject();
    const projects = store.state.projects;

    const inputW = UI.Input({
      label: t('todos.newTask'),
      value: '',
      placeholder: t('todos.newTaskPlaceholder'),
      icon: 'plus',
      onkeydown: (e) => {
        if (e.key === 'Enter') submit();
      },
      className: 'ch-field-wide',
    });
    inputTitle = inputW.input;

    const selectProjectW = UI.Select({
      label: t('common.project'),
      value: draftProject || 'none',
      onchange: (v) => (draftProject = v),
      options: [
        { value: 'none', label: t('common.noProject') },
        ...projects.filter((p) => !p.archived).map((p) => ({ value: p.id, label: p.name })),
      ],
      className: 'ch-field-md',
    });
    selectProject = selectProjectW.input;

    const selectDueW = UI.Select({
      label: t('todos.due'),
      value: draftDueDate,
      onchange: (v) => (draftDueDate = v),
      options: [
        { value: 'today', label: t('common.today') },
        { value: 'tomorrow', label: t('common.tomorrow') },
        { value: 'fri', label: t('todos.dueWeek') },
        { value: 'none', label: t('todos.dueNone') },
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
          children: t('common.add'),
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
        label: t('todos.filter'),
        value: projectFilter,
        onchange: (v) => {
          projectFilter = v;
          renderList();
        },
        options: [
          { value: 'all', label: t('todos.allProjects') },
          { value: 'none', label: t('common.noProject') },
          ...projects.filter((p) => !p.archived).map((p) => ({ value: p.id, label: p.name })),
        ],
        className: 'ch-field-md',
      }),
    );
  }

  /** @param {Todo} todo */
  function dueDateBadge(todo) {
    const b = bucket(todo);
    /** @type {Partial<Record<ReturnType<typeof bucket>, { label: string, variant: import('./types.js').BadgeOptions['variant'] }>>} */
    const map = {
      overdue: { label: t('todos.overdue'), variant: 'danger' },
      today: { label: t('common.today'), variant: 'accent' },
      tomorrow: { label: t('common.tomorrow'), variant: 'neutral' },
      // beyond tomorrow: the short date is more useful than "this week"
      week: { label: formatShortDueDate(todo.dueDate) || t('todos.dueWeek'), variant: 'neutral' },
    };
    const m = map[b];
    if (!m) return null;
    return UI.Badge({ variant: m.variant, children: m.label });
  }

  /** @param {Todo} todo */
  function openTodoEditor(todo) {
    const projects = store.state.projects;
    const nameW = UI.Input({ label: t('todos.title'), value: todo.title, autoFocus: true });
    const descW = UI.Textarea({
      label: t('common.description'),
      value: todo.description || '',
      placeholder: t('todos.notesPlaceholder'),
      maxLength: 2000,
      rows: 4,
    });
    const projectW = UI.Select({
      label: t('common.project'),
      value: todo.projectId || 'none',
      options: [
        { value: 'none', label: t('common.noProject') },
        ...projects.map((p) => ({
          value: p.id,
          label: p.archived ? t('common.archivedName', { name: p.name }) : p.name,
        })),
      ],
    });
    // Due date: editable absolute date + shortcuts that fill the field (relative to today).
    const dueW = UI.Input({
      label: t('todos.due'),
      type: 'date',
      value: dueDateToTimestamp(todo.dueDate) != null ? todo.dueDate : '',
    });
    const shortcuts = [
      { preset: 'today', label: t('common.today') },
      { preset: 'tomorrow', label: t('common.tomorrow') },
      { preset: 'fri', label: capitalize(weekdayName(4)) },
      { preset: 'mon', label: capitalize(weekdayName(0)) },
      { preset: 'none', label: t('todos.shortcutNone') },
    ];
    const shortcutsRow = el(
      'div',
      { class: 'ch-row ch-wrap ch-gap-3' },
      shortcuts.map(({ preset, label }) =>
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
        nameW.setError(t('todos.titleEmpty'));
        nameW.input.focus();
        return;
      }
      const due = dueW.input.value; // 'YYYY-MM-DD' or '' (field cleared)
      const project = projectW.input.value;
      store.actions.updateTodo(todo.id, {
        title,
        description: descW.input.value.trim().slice(0, 2000),
        projectId: project === 'none' ? null : project,
        dueDate: dueDateToTimestamp(due) != null ? due : null,
      });
      modal.close();
    }
    async function originalDelete() {
      const ok = await UI.Confirm({
        title: t('todos.deleteTitle'),
        message: t('todos.deleteMessage', { title: todo.title }),
        confirmLabel: t('todos.deleteConfirm'),
        danger: true,
        within: modal,
      });
      if (!ok) return;
      store.actions.deleteTodo(todo.id);
      modal.close();
    }
    nameW.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
    });
    nameW.input.addEventListener('input', () => nameW.setError(null));
    const modal = UI.Modal({
      title: t('todos.edit'),
      body: el('div', { class: 'ch-stack ch-gap-4' }, nameW, descW, projectW, dueW, shortcutsRow),
      footer: [
        UI.Button({
          variant: 'danger',
          children: t('todos.deleteLabel'),
          onclick: originalDelete,
          className: 'ch-push',
        }),
        UI.Button({ children: t('common.cancel'), onclick: () => modal.close() }),
        UI.Button({
          variant: 'primary',
          children: t('common.save'),
          onclick: save,
        }),
      ],
    });
  }

  /**
   * @param {Todo} todo
   * @param {boolean} isDone
   */
  function todoRow(todo, isDone) {
    const project = store.state.projects.find((p) => p.id === todo.projectId);
    const hasDesc = !!(todo.description && todo.description.trim());
    const row = el(
      'div',
      { class: 'ch-line ch-line--top ch-wrap' },
      UI.Checkbox({
        ariaLabel: todo.title,
        checked: todo.done,
        mutates: true,
        onchange: () => store.actions.toggleTodo(todo.id),
      }),

      el(
        'div',
        { class: 'ch-grow ch-todo-main' },
        isDone
          ? el('div', { class: 'ch-ellipsis ch-done' }, todo.title)
          : el(
              'button',
              {
                type: 'button',
                class: 'ch-todo-title ch-ellipsis',
                onclick: () => openTodoEditor(todo),
              },
              todo.title,
            ),
        hasDesc
          ? el(
              'div',
              {
                class: `ch-meta ch-clamp-2 ch-mt-1${isDone ? ' ch-done' : ''}`,
                title: todo.description,
              },
              todo.description,
            )
          : null,
      ),

      el(
        'div',
        { class: 'ch-row ch-center ch-wrap ch-gap-3 ch-shrink-0' },
        project
          ? UI.projectName(project, 'ch-meta')
          : el('span', { class: 'ch-subtle ch-italic' }, t('common.noProject')),

        todo.dueDate && !todo.done ? dueDateBadge(todo) : null,

        el(
          'div',
          { class: 'ch-row ch-gap-1' },
          !todo.done
            ? UI.IconButton({
                icon: 'play',
                label: t('todos.startOnTask'),
                mutates: true,
                onclick: () => opts.onStartOnTodo(todo.projectId, todo.title),
              })
            : null,
          !todo.done
            ? UI.IconButton({
                icon: 'pencil-simple',
                label: t('common.edit'),
                size: 'sm',
                onclick: () => openTodoEditor(todo),
              })
            : null,
          UI.IconButton({
            icon: 'trash',
            label: t('todos.deleteLabel'),
            size: 'sm',
            mutates: true,
            onclick: async () => {
              const ok = await UI.Confirm({
                title: t('todos.deleteTitle'),
                message: t('todos.deleteMessage', { title: todo.title }),
                confirmLabel: t('todos.deleteConfirm'),
                danger: true,
              });
              if (ok) store.actions.deleteTodo(todo.id);
            },
          }),
        ),
      ),
    );
    return row;
  }

  function renderList() {
    const { todos } = store.state;
    const filtered = todos.filter(
      (todo) => projectFilter === 'all' || todo.projectId === projectFilter,
    );

    const groups = [
      { id: 'overdue', label: t('todos.overdue') },
      { id: 'today', label: t('common.today') },
      { id: 'tomorrow', label: t('common.tomorrow') },
      { id: 'week', label: t('todos.dueWeek') },
      { id: 'none', label: t('todos.dueNone') },
      { id: 'done', label: t('todos.done') },
    ];

    const sections = [];
    for (const { id, label } of groups) {
      const items = filtered.filter((todo) => bucket(todo) === id);
      if (items.length === 0) continue;
      const isOverdue = id === 'overdue';
      const isDone = id === 'done';
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
            el('span', { class: 'cv-num ch-subtle' }, formatNumber(items.length)),
          ),
          el(
            'div',
            null,
            items.map((todo) => todoRow(todo, isDone)),
          ),
        ),
      );
    }

    if (filtered.length === 0) {
      sections.push(UI.EmptyState({ icon: 'check-circle', title: t('todos.allDone') }));
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
