// projects view: cards with totals, creation modal.
import { getShowProjectTotals, setShowProjectTotals } from '../preferences.js';
import { nextCategory } from '../../core/categories.js';
import * as UI from './ui.js';

const { el, formatDuration, liveDuration, t } = UI;

/* The 16 categories of the Covenant palette (`data-cat` 1 to 16), by hue: the accessible name of
   each choice of the colour picker. A project can also keep a free colour (`customColor`). */
const CATEGORY_NAMES = [
  t('hues.orange'),
  t('hues.amber'),
  t('hues.yellow'),
  t('hues.lime'),
  t('hues.green'),
  t('hues.teal'),
  t('hues.cyan'),
  t('hues.sky'),
  t('hues.blue'),
  t('hues.indigo'),
  t('hues.violet'),
  t('hues.purple'),
  t('hues.fuchsia'),
  t('hues.pink'),
  t('hues.rose'),
  t('hues.slate'),
];

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
    /** @type {{ name: string, client: string, category: number | null, customColor: string | null }} */
    const draft = existing
      ? {
          name: existing.name,
          client: existing.client || '',
          category: existing.category,
          customColor: existing.customColor,
        }
      : {
          name: '',
          client: '',
          // A new project takes the next category of the default order.
          category: nextCategory(store.state.projects),
          customColor: null,
        };

    /* The 16 categories: native radios (arrow keys, one stop), drawn as swatches. */
    const groupName = UI.fieldId('ch-category');
    /** @type {HTMLInputElement[]} */
    const radios = [];
    const swatchRow = el(
      'div',
      { class: 'ch-swatches' },
      CATEGORY_NAMES.map((hue, index) => {
        const category = index + 1;
        const radio = el('input', {
          type: 'radio',
          name: groupName,
          value: String(category),
          class: 'ch-swatch-radio',
          'aria-label': hue,
          checked: draft.category === category,
          onchange: () => {
            draft.category = category;
            draft.customColor = null;
            paintCustom();
          },
        });
        radios.push(radio);
        return el(
          'span',
          { class: 'ch-swatch-choice', dataset: { cat: String(category) } },
          radio,
          el('span', { class: 'ch-swatch-btn', 'aria-hidden': 'true' }),
        );
      }),
    );

    /* The free colour: the native picker, kept. Its swatch shows the colour once one is chosen. */
    const customId = UI.fieldId('ch-custom-color');
    const customSwatch = el('span', { class: 'ch-swatch-btn', 'aria-hidden': 'true' });
    const customPicker = el('input', {
      type: 'color',
      id: customId,
      class: 'ch-swatch-radio',
      oninput: (/** @type {import('./types.js').TargetEvent} */ e) => {
        draft.customColor = e.target.value;
        draft.category = null;
        for (const radio of radios) radio.checked = false;
        paintCustom();
      },
    });
    const customChoice = el(
      'span',
      { class: 'ch-swatch-choice ch-swatch-choice--custom' },
      customPicker,
      customSwatch,
    );
    function paintCustom() {
      const custom = draft.customColor !== null;
      customChoice.classList.toggle('is-selected', custom);
      customChoice.classList.toggle('is-unset', !custom);
      if (custom) {
        UI.setProjectColor(customChoice, { category: null, customColor: draft.customColor });
        customPicker.value = /** @type {string} */ (draft.customColor);
      } else {
        customChoice.removeAttribute('data-cat');
      }
    }
    paintCustom();

    const nameW = UI.Input({
      label: t('projects.name'),
      value: draft.name,
      placeholder: t('projects.namePlaceholder'),
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
      knownClients.length > 0 ? t('projects.clientsKnown', { count: knownClients.length }) : null;
    const clientW =
      knownClients.length > 0
        ? UI.Combobox({
            label: t('common.client'),
            value: draft.client,
            options: knownClients,
            placeholder: t('projects.clientPlaceholder'),
            hint: clientHint,
            emptyText: t('projects.noMatchingClient'),
          })
        : UI.Input({
            label: t('common.client'),
            value: draft.client,
            placeholder: t('projects.clientPlaceholder'),
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
        el('legend', { class: 'cv-label' }, t('projects.color')),
        swatchRow,
        el(
          'div',
          { class: 'ch-row ch-center ch-gap-3 ch-mt-3' },
          customChoice,
          el('label', { class: 'cv-label ch-fg', for: customId }, t('projects.customColor')),
        ),
      ),
    );

    function save() {
      const name = inputName.value.trim();
      if (!name) {
        nameW.setError(t('projects.nameEmpty'));
        inputName.focus();
        return;
      }
      const color = { category: draft.category, customColor: draft.customColor };
      if (existing) {
        store.actions.updateProject(existing.id, {
          name,
          client: inputClient.value.trim(),
          ...color,
        });
      } else store.actions.addProject(name, inputClient.value.trim(), color);
      modal.close();
    }

    async function originalDelete() {
      if (!existing) return;
      const { sessions, todos } = store.state;
      const n = sessions.filter((s) => s.projectId === existing.id).length;
      const m = todos.filter((todo) => todo.projectId === existing.id).length;
      const msg =
        n + m > 0
          ? t('projects.deleteWith', {
              name: existing.name,
              sessions: t('common.sessionsCount', { count: n }),
              tasks: t('common.tasksCount', { count: m }),
            })
          : t('projects.deleteAlone', { name: existing.name });
      const ok = await UI.Confirm({
        title: t('projects.deleteTitle', { name: existing.name }),
        message: msg,
        confirmLabel: t('projects.deleteConfirm'),
        danger: true,
        within: modal,
      });
      if (!ok) return;
      store.actions.deleteProject(existing.id);
      modal.close();
    }

    const saveButton = UI.Button({
      variant: 'primary',
      children: isEdit ? t('common.save') : t('common.create'),
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
          children: t('common.delete'),
          onclick: originalDelete,
          className: 'ch-push',
        }),
      );
    footer.push(UI.Button({ children: t('common.cancel'), onclick: () => modal.close() }));
    footer.push(saveButton);

    const modal = UI.Modal({
      title: isEdit ? t('projects.editProject') : t('projects.newProject'),
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
          label: t('projects.showTotals'),
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
          legend: t('projects.shown'),
          name: 'projects-shown',
          options: [
            { value: 'active', label: t('projects.shownActive') },
            { value: 'archived', label: t('projects.shownArchived') },
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
          children: t('projects.newProject'),
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
    for (const todo of todos) {
      const counts = (todosByProject[String(todo.projectId)] ??= { open: 0, done: 0 });
      if (todo.done) counts.done += 1;
      else counts.open += 1;
    }

    metaNode.textContent = t('projects.activeCount', {
      active: projects.filter((p) => !p.archived).length,
      archived: projects.filter((p) => p.archived).length,
    });
    gridSlot.replaceChildren(
      listEl.length === 0
        ? UI.EmptyState({
            icon: 'folder-open',
            title: showArchived ? t('projects.noneArchived') : t('projects.noneActive'),
            text: showArchived ? t('projects.noneArchivedHint') : t('projects.noneActiveHint'),
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
   * @param {{ duration: number, count: number }} totalsOf
   * @param {{ open: number, done: number }} td
   */
  function projectCard(p, totalsOf, td) {
    return UI.setProjectColor(
      el(
        'article',
        { class: 'cv-card cv-card--compact cv-cat-stripe ch-project-card' },
        el(
          'div',
          null,
          el('h2', { class: 'cv-card__title' }, UI.projectName(p)),
          el('div', { class: 'cv-card__meta ch-mt-1' }, p.client || '—'),
        ),

        showTotals || computed.has(p.id)
          ? el(
              'div',
              null,
              el('div', { class: 'cv-overline' }, t('projects.totalTime')),
              el('div', { class: 'cv-num ch-kpi ch-mt-3' }, formatDuration(totalsOf.duration)),
              el(
                'div',
                { class: 'ch-subtle ch-mt-1' },
                t('projects.sessionsRecorded', { count: totalsOf.count }),
              ),
            )
          : el(
              'div',
              null,
              UI.Button({
                size: 'sm',
                icon: 'clock-countdown',
                children: t('projects.computeTime'),
                onclick: () => {
                  computed.add(p.id);
                  render();
                },
              }),
            ),

        el(
          'div',
          { class: 'ch-row ch-wrap ch-gap-3' },
          UI.Tag(t('projects.todosTag', { count: td.open })),
          td.done > 0
            ? UI.Badge({
                variant: 'success',
                children: t('projects.doneBadge', { count: td.done }),
              })
            : null,
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
                  children: t('common.start'),
                  mutates: true,
                  onclick: () => opts.onStartOnProject(p.id),
                  className: 'ch-grow',
                }),
                UI.IconButton({
                  icon: 'pencil-simple',
                  label: t('common.edit'),
                  variant: 'secondary',
                  size: 'sm',
                  onclick: () => openProjectModal(p),
                }),
                UI.IconButton({
                  icon: 'archive',
                  label: t('projects.archive'),
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
                  children: t('projects.unarchive'),
                  mutates: true,
                  onclick: () => store.actions.toggleProjectArchived(p.id),
                  className: 'ch-grow',
                }),
                UI.IconButton({
                  icon: 'pencil-simple',
                  label: t('common.edit'),
                  variant: 'secondary',
                  size: 'sm',
                  onclick: () => openProjectModal(p),
                }),
              ],
        ),
      ),
      p,
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
