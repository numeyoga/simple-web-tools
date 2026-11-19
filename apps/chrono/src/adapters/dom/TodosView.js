// to-do list: add, filter by project, groups by due date.
import {
  bucket as bucketAt,
  dueDateToTimestamp,
  presetToDate as presetToDateAt,
} from '../../core/due-dates.js';
import * as UI from './ui.js';

const { el, icon } = UI;

// A due date is stored as a local date 'YYYY-MM-DD' (or null).
// The interface shortcuts ('today', 'tomorrow', 'fri', 'mon', 'week'...) are only
// presets: they are converted to a date when chosen, relative to TODAY (`ref`).
// The logic (conversion, buckets) lives in src/core/due-dates.js; these wrappers
// supply the current time.
const presetToDate = (preset, ref = Date.now()) => presetToDateAt(preset, ref);
const bucket = (todo, ref = Date.now()) => bucketAt(todo, ref);

// Short date for the badge: "ven. 21 nov.".
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

export function createTodosView(store, opts) {
  let projectFilter = 'all';
  let draftDueDate = 'today';
  let draftProject = null;
  let lastProjectsRef = null;

  const host = el('div', { class: 'ch-pile ch-g16', style: { maxWidth: 920 } });
  const headerSlot = el('div', null);
  const formSlot = el('div', null);
  const filtersSlot = el('div', { class: 'ch-flex ch-g6', style: { flexWrap: 'wrap' } });
  const listSlot = el('div', { class: 'ch-pile ch-g16' });
  host.append(headerSlot, formSlot, filtersSlot, listSlot);

  // Refs to the form inputs (kept between renders of the list)
  let inputTitle, selectProject, selectDueDate;

  // draftProject can be 'none' (no project): in that case it is not rewritten.
  function ensureDraftProject() {
    if (draftProject === 'none') return;
    const projects = store.state.projects;
    if (!projects.find((p) => p.id === draftProject) && projects.length > 0) {
      draftProject = (projects.find((p) => !p.archived) || projects[0]).id;
    }
  }

  function renderHeader() {
    const { todos } = store.state;
    const open = todos.filter((t) => !t.done).length;
    const done = todos.filter((t) => t.done).length;
    headerSlot.replaceChildren(
      el('div', { class: 'ch-titre-page' }, 'Todos'),
      el(
        'div',
        { class: 'ch-meta', style: { marginTop: 4 } },
        `${open} en cours · ${done} terminées`,
      ),
    );
  }

  function renderForm() {
    ensureDraftProject();
    const projects = store.state.projects;

    const inputW = UI.Input({
      value: '',
      placeholder: "Qu'est-ce qu'il faut faire ?",
      icon: 'plus',
      onkeydown: (e) => {
        if (e.key === 'Enter') submit();
      },
      style: { flex: 1 },
    });
    inputTitle = inputW.input;

    const selectProjectW = UI.Select({
      value: draftProject || 'none',
      onchange: (v) => (draftProject = v),
      options: [
        { value: 'none', label: 'Sans projet' },
        ...projects.filter((p) => !p.archived).map((p) => ({ value: p.id, label: p.name })),
      ],
      style: { width: 220 },
    });
    selectProject = selectProjectW.input;

    const selectDueW = UI.Select({
      value: draftDueDate,
      onchange: (v) => (draftDueDate = v),
      options: [
        { value: 'today', label: "Aujourd'hui" },
        { value: 'tomorrow', label: 'Demain' },
        { value: 'fri', label: 'Cette semaine' },
        { value: 'none', label: 'Sans échéance' },
      ],
      style: { width: 150 },
    });
    selectDueDate = selectDueW.input;

    formSlot.replaceChildren(
      el(
        'div',
        {
          class: 'ch-panneau ch-flex ch-g8',
          style: {
            alignItems: 'flex-end',
            padding: 12,
            boxShadow: 'var(--cv-shadow-sm)',
          },
        },
        inputW,
        selectProjectW,
        selectDueW,
        UI.Button({
          variant: 'primary',
          icon: 'arrow-right',
          children: 'Ajouter',
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
    inputTitle.value = '';
    inputTitle.focus();
  }

  function chip(label, isOn, onclick, color) {
    return el(
      'button',
      {
        onclick,
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          height: 26,
          borderRadius: 9999,
          border: isOn ? '1px solid var(--cv-fg)' : '1px solid var(--cv-border-strong)',
          background: isOn ? 'var(--cv-fg)' : 'var(--cv-surface)',
          color: isOn ? 'var(--cv-fg-inverse)' : 'var(--cv-fg)',
          font: '500 12px/1 var(--cv-font-sans)',
          cursor: 'pointer',
          transition: 'all 120ms',
        },
      },
      color
        ? el('span', { style: { width: 6, height: 6, borderRadius: 2, background: color } })
        : null,
      label,
    );
  }

  function renderFilters() {
    const projects = store.state.projects;
    filtersSlot.replaceChildren(
      chip('Tous', projectFilter === 'all', () => {
        projectFilter = 'all';
        renderFilters();
        renderList();
      }),
      chip('Sans projet', projectFilter === 'none', () => {
        projectFilter = 'none';
        renderFilters();
        renderList();
      }),
      ...projects
        .filter((p) => !p.archived)
        .map((p) =>
          chip(
            p.name,
            projectFilter === p.id,
            () => {
              projectFilter = p.id;
              renderFilters();
              renderList();
            },
            p.color,
          ),
        ),
    );
  }

  function dueDateBadge(t) {
    const b = bucket(t);
    const map = {
      overdue: { label: 'en retard', variant: 'danger' },
      today: { label: "aujourd'hui", variant: 'accent' },
      tomorrow: { label: 'demain', variant: 'neutral' },
      // beyond tomorrow: the short date is more useful than "this week"
      week: { label: formatShortDueDate(t.dueDate) || 'cette semaine', variant: 'neutral' },
    };
    const m = map[b];
    if (!m) return null;
    return UI.Badge({ variant: m.variant, children: m.label });
  }

  function openTodoEditor(t) {
    const projects = store.state.projects;
    let modal;
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
    const shortcuts = [
      ['today', "Aujourd'hui"],
      ['tomorrow', 'Demain'],
      ['fri', 'Vendredi'],
      ['mon', 'Lundi'],
      ['none', 'Aucune'],
    ];
    const shortcutsRow = el(
      'div',
      { class: 'ch-flex ch-g6', style: { flexWrap: 'wrap', marginTop: -4 } },
      shortcuts.map(([preset, label]) =>
        UI.Button({
          variant: 'secondary',
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
      if (!title) return;
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
    function originalDelete() {
      if (!confirm(`Effacer la tâche « ${t.title} » ? Cette action est définitive.`)) return;
      store.actions.deleteTodo(t.id);
      modal.close();
    }
    nameW.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
    });
    modal = UI.Modal({
      title: 'Modifier la tâche',
      width: 460,
      body: el('div', { class: 'ch-pile ch-g12' }, nameW, descW, projectW, dueW, shortcutsRow),
      footer: [
        UI.Button({
          variant: 'destructive',
          icon: 'trash',
          children: 'Effacer',
          onclick: originalDelete,
          style: { marginRight: 'auto' },
        }),
        UI.Button({ variant: 'ghost', children: 'Annuler', onclick: () => modal.close() }),
        UI.Button({
          variant: 'primary',
          icon: 'check',
          children: 'Enregistrer',
          onclick: save,
        }),
      ],
    });
  }

  function todoRow(t, faded) {
    const project = store.state.projects.find((p) => p.id === t.projectId);
    const hasDesc = !!(t.description && t.description.trim());
    const row = el(
      'div',
      {
        class: 'ch-ligne ch-flex ch-g12',
        style: {
          alignItems: 'flex-start',
          padding: '11px 14px',
          minHeight: 44,
          boxSizing: 'border-box',
          opacity: faded ? 0.6 : 1,
        },
      },
      el(
        'button',
        {
          onclick: () => store.actions.toggleTodo(t.id),
          'aria-label': t.done ? 'Rouvrir' : 'Terminer',
          style: {
            width: 18,
            height: 18,
            borderRadius: 4,
            marginTop: 1,
            border: `1.5px solid ${t.done ? 'var(--cv-success-500)' : 'var(--cv-border-strong)'}`,
            background: t.done ? 'var(--cv-success-500)' : 'transparent',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            padding: 0,
            transition: 'all 120ms',
          },
        },
        t.done ? icon('check', { weight: 'bold', size: 12, style: { color: '#fff' } }) : null,
      ),

      el(
        'div',
        { class: 'ch-souple' },
        el(
          'div',
          {
            title: 'Cliquer pour modifier',
            onclick: () => {
              if (!t.done) openTodoEditor(t);
            },
            class: 'ch-ellipse',
            style: {
              font: '400 13px/1.3 var(--cv-font-sans)',
              color: t.done ? 'var(--cv-fg-subtle)' : 'var(--cv-fg)',
              textDecoration: t.done ? 'line-through' : 'none',
              cursor: t.done ? 'default' : 'pointer',
            },
          },
          t.title,
        ),
        hasDesc
          ? el(
              'div',
              {
                title: t.description,
                style: {
                  marginTop: 3,
                  font: '400 12px/1.45 var(--cv-font-sans)',
                  color: 'var(--cv-fg-muted)',
                  display: '-webkit-box',
                  WebkitLineClamp: '2',
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                },
              },
              t.description,
            )
          : null,
      ),

      el(
        'div',
        { class: 'ch-flex-c ch-g8', style: { flexShrink: 0, marginTop: 1 } },
        project
          ? el(
              'span',
              {
                style: {
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  font: '500 11px/1 var(--cv-font-sans)',
                  color: 'var(--cv-fg-muted)',
                },
              },
              el('span', {
                style: { width: 6, height: 6, borderRadius: 2, background: project.color },
              }),
              project.name,
            )
          : el(
              'span',
              {
                style: {
                  font: '400 11px/1 var(--cv-font-sans)',
                  color: 'var(--cv-fg-subtle)',
                  fontStyle: 'italic',
                },
              },
              'Sans projet',
            ),

        t.dueDate && !t.done ? dueDateBadge(t) : null,

        el(
          'div',
          { class: 'ch-flex ch-g2' },
          !t.done
            ? UI.IconButton({
                icon: 'play',
                label: 'Démarrer un chrono sur cette tâche',
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
            onclick: () => {
              if (!confirm(`Effacer la tâche « ${t.title} » ? Cette action est définitive.`))
                return;
              store.actions.deleteTodo(t.id);
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
          {
            class: 'ch-panneau',
            style: { overflow: 'hidden' },
          },
          el(
            'header',
            {
              class: 'ch-flex-c ch-g8',
              style: {
                padding: '10px 14px',
                borderBottom: '1px solid var(--cv-border)',
                background: isOverdue ? 'var(--cv-danger-50)' : 'transparent',
              },
            },
            el(
              'span',
              {
                style: {
                  font: '600 11px/1 var(--cv-font-sans)',
                  color: isOverdue ? 'var(--cv-danger-700)' : 'var(--cv-fg-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                },
              },
              label,
            ),
            el(
              'span',
              { style: { font: '500 11px/1 var(--cv-font-mono)', color: 'var(--cv-fg-subtle)' } },
              String(items.length),
            ),
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
        el(
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
          icon('check-circle', { size: 32, style: { color: 'var(--cv-fg-subtle)' } }),
          el('div', { style: { marginTop: 8 } }, 'Tout est à jour sur ce projet.'),
        ),
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
