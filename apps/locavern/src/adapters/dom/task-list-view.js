/** @import { AppCommand, AppState, StoreEffect, Task, TaskPriority, TaskStatus, TaskStatusFilter } from '../../types.d.ts' */

import { classifyDueDateUrgency, getTodayIsoDate, isOffHoursDueTime } from '../../core/dates.js';
import {
  getDefaultInitialTaskStatusId,
  getTaskRecurrenceLabel,
  getTaskStatusMeta,
  getTaskStatusRole,
} from '../../core/model.js';
import { selectAllTags, selectProjectById, selectProjects, selectTasks } from '../../core/store.js';
import { confirmAction, notify } from './app-shell.js';
import { createTaskWorkspaceHeader } from './task-workspace-header.js';
import { format, t } from '../i18n.js';

/** @type {Record<TaskPriority, { label: string; badgeClass: string }>} */
const PRIORITY_META = {
  low: { label: t('priority.low'), badgeClass: 'cv-badge' },
  medium: { label: t('priority.medium'), badgeClass: 'cv-badge cv-badge--warning' },
  high: { label: t('priority.high'), badgeClass: 'cv-badge cv-badge--danger' },
};

/**
 * Create a Covenant badge element.
 * @param {string} label
 * @param {string} badgeClass
 * @param {{ warningIcon?: boolean; iconName?: string; statusBadgeKind?: 'known' | 'missing' | 'unknown' }} [opts]
 * @returns {HTMLSpanElement}
 */
function makeBadge(label, badgeClass, opts = {}) {
  const badge = document.createElement('span');
  badge.className = badgeClass;
  if (opts.statusBadgeKind) {
    badge.dataset.statusBadge = opts.statusBadgeKind;
  }
  if (opts.iconName || opts.warningIcon) {
    const ic = document.createElement('i');
    ic.className = `ph ${opts.iconName ?? 'ph-warning'} cv-icon`;
    ic.setAttribute('aria-hidden', 'true');
    badge.append(ic, document.createTextNode(` ${label}`));
  } else {
    const dot = document.createElement('span');
    dot.className = 'cv-badge__dot';
    badge.append(dot, document.createTextNode(label));
  }
  return badge;
}

/**
 * Render the Task List view (Covenant DataTable, filters, sorting).
 * @param {{
 *   container: HTMLElement;
 *   store: {
 *     getState: () => AppState;
 *     dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *   };
 *   filters: {
 *     query: string;
 *     status: TaskStatusFilter;
 *     priority: TaskPriority | 'all';
 *     tag: string | 'all';
 *     sortBy: 'position' | 'dueDate' | 'priority';
 *   };
 *   onOpenNewProject: () => void;
 *   onOpenTaskDrawer: (task?: Task, opts?: { defaultStatus?: TaskStatus | null; mode?: 'view' | 'edit' }) => void;
 * }} opts
 */
export function renderTaskListView({
  container,
  store,
  filters,
  onOpenNewProject,
  onOpenTaskDrawer,
}) {
  const state = store.getState();
  const activeProjects = selectProjects(state);

  const header = createTaskWorkspaceHeader({
    state,
    dispatch: store.dispatch,
    onOpenNewTask: () => onOpenTaskDrawer(undefined, { mode: 'edit' }),
  });

  if (activeProjects.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'cv-empty';
    const iconBox = document.createElement('span');
    iconBox.className = 'cv-empty__icon';
    const ic = document.createElement('i');
    ic.className = 'ph ph-folder-plus cv-icon';
    ic.setAttribute('aria-hidden', 'true');
    iconBox.append(ic);

    const title = document.createElement('p');
    title.className = 'cv-empty__title';
    title.textContent =
      state.projects.length === 0 ? t('common.createFirstProject') : t('common.noActiveProject');

    const desc = document.createElement('p');
    desc.textContent = t('tasks.emptyText');

    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'cv-btn cv-btn--primary';
    cta.disabled = state.readOnly;
    cta.textContent = t('projects.createCta');
    cta.addEventListener('click', onOpenNewProject);

    empty.append(iconBox, title, desc, cta);
    container.replaceChildren(header, empty);
    return;
  }

  // Filters bar
  const filtersBar = document.createElement('div');
  filtersBar.className = 'lc-filters';

  const searchField = document.createElement('div');
  searchField.className = 'cv-field';
  const searchLabel = document.createElement('label');
  searchLabel.className = 'cv-label';
  searchLabel.htmlFor = 'list-search-input';
  searchLabel.textContent = t('common.search');
  const searchGroup = document.createElement('div');
  searchGroup.className = 'cv-input-group';
  const searchIcon = document.createElement('i');
  searchIcon.className = 'ph ph-magnifying-glass cv-icon';
  searchIcon.setAttribute('aria-hidden', 'true');
  const searchInput = document.createElement('input');
  searchInput.id = 'list-search-input';
  searchInput.type = 'search';
  searchInput.className = 'cv-input';
  searchInput.placeholder = t('common.searchPlaceholder');
  searchInput.value = filters.query;
  searchGroup.append(searchIcon, searchInput);
  searchField.append(searchLabel, searchGroup);

  const statusField = document.createElement('div');
  statusField.className = 'cv-field';
  const statusLabel = document.createElement('label');
  statusLabel.className = 'cv-label';
  statusLabel.htmlFor = 'list-status-filter';
  statusLabel.textContent = t('common.status');
  const statusWrap = document.createElement('div');
  statusWrap.className = 'cv-select';
  const statusSelect = document.createElement('select');
  statusSelect.id = 'list-status-filter';
  statusSelect.className = 'cv-input';
  /** @type {Array<[string, string]>} */
  const statusOptions = [
    ['all', t('tasks.allStatuses')],
    ...state.preferences.taskStatuses.map((s) => /** @type {[string, string]} */ ([s.id, s.label])),
    ['__none__', t('statuses.none')],
    ['__unknown__', t('statuses.unknownShort')],
  ];
  for (const [val, lbl] of statusOptions) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = lbl;
    statusSelect.append(opt);
  }
  const validFilterValues = new Set(statusOptions.map(([val]) => val));
  if (!validFilterValues.has(filters.status)) {
    filters.status = 'all';
  }
  statusSelect.value = filters.status;
  statusWrap.append(statusSelect);
  statusField.append(statusLabel, statusWrap);

  const priorityField = document.createElement('div');
  priorityField.className = 'cv-field';
  const priorityLabel = document.createElement('label');
  priorityLabel.className = 'cv-label';
  priorityLabel.htmlFor = 'list-priority-filter';
  priorityLabel.textContent = t('common.priority');
  const priorityWrap = document.createElement('div');
  priorityWrap.className = 'cv-select';
  const prioritySelect = document.createElement('select');
  prioritySelect.id = 'list-priority-filter';
  prioritySelect.className = 'cv-input';
  /** @type {Array<[string, string]>} */
  const priorityOptions = [
    ['all', t('common.allPriorities')],
    ['high', t('priority.high')],
    ['medium', t('priority.medium')],
    ['low', t('priority.low')],
  ];
  for (const [val, lbl] of priorityOptions) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = lbl;
    prioritySelect.append(opt);
  }
  prioritySelect.value = filters.priority;
  priorityWrap.append(prioritySelect);
  priorityField.append(priorityLabel, priorityWrap);

  const sortField = document.createElement('div');
  sortField.className = 'cv-field';
  const sortLabel = document.createElement('label');
  sortLabel.className = 'cv-label';
  sortLabel.htmlFor = 'list-sort-select';
  sortLabel.textContent = t('tasks.sort');
  const sortWrap = document.createElement('div');
  sortWrap.className = 'cv-select';
  const sortSelect = document.createElement('select');
  sortSelect.id = 'list-sort-select';
  sortSelect.className = 'cv-input';
  /** @type {Array<[string, string]>} */
  const sortOptions = [
    ['position', t('tasks.sortKanban')],
    ['dueDate', t('common.dueDate')],
    ['priority', t('common.priority')],
  ];
  for (const [val, lbl] of sortOptions) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = lbl;
    sortSelect.append(opt);
  }
  sortSelect.value = filters.sortBy;
  sortWrap.append(sortSelect);
  sortField.append(sortLabel, sortWrap);

  const tagField = document.createElement('div');
  tagField.className = 'cv-field';
  const tagLabel = document.createElement('label');
  tagLabel.className = 'cv-label';
  tagLabel.htmlFor = 'list-tag-filter';
  tagLabel.textContent = t('common.tag');
  const tagWrap = document.createElement('div');
  tagWrap.className = 'cv-select';
  const tagSelect = document.createElement('select');
  tagSelect.id = 'list-tag-filter';
  tagSelect.className = 'cv-input';
  const allTagsList = selectAllTags(state);
  const allTagOpt = document.createElement('option');
  allTagOpt.value = 'all';
  allTagOpt.textContent = t('common.allTags');
  tagSelect.append(allTagOpt);
  for (const tag of allTagsList) {
    const opt = document.createElement('option');
    opt.value = tag;
    opt.textContent = `#${tag}`;
    tagSelect.append(opt);
  }
  if (
    filters.tag !== 'all' &&
    !allTagsList.some((t) => t.toLowerCase() === filters.tag.toLowerCase())
  ) {
    filters.tag = 'all';
  }
  tagSelect.value = filters.tag;
  tagWrap.append(tagSelect);
  tagField.append(tagLabel, tagWrap);

  filtersBar.append(searchField, statusField, priorityField, tagField, sortField);

  // Quick-add bar at top of List view
  const quickForm = document.createElement('form');
  quickForm.id = 'list-quick-add-form';
  quickForm.className = 'lc-quick-add';
  quickForm.noValidate = true;

  const quickLabel = document.createElement('label');
  quickLabel.className = 'lc-sr-only';
  quickLabel.htmlFor = 'list-quick-add-input';
  quickLabel.textContent = t('tasks.quickAddLabel');

  const quickInput = document.createElement('input');
  quickInput.id = 'list-quick-add-input';
  quickInput.type = 'text';
  quickInput.className = 'cv-input lc-quick-add__input';
  quickInput.maxLength = 200;
  quickInput.disabled = state.readOnly;
  quickInput.placeholder = t('tasks.quickAddPlaceholder');

  /** @type {HTMLSelectElement | null} */
  let quickProjectSelect = null;
  if (!state.preferences.selectedProjectId) {
    quickProjectSelect = document.createElement('select');
    quickProjectSelect.id = 'list-quick-add-project';
    quickProjectSelect.className = 'cv-input lc-quick-add__project';
    quickProjectSelect.disabled = state.readOnly;
    quickProjectSelect.setAttribute('aria-label', t('tasks.quickAddProject'));
    for (const proj of activeProjects) {
      const opt = document.createElement('option');
      opt.value = proj.id;
      opt.textContent = proj.name;
      quickProjectSelect.append(opt);
    }
    if (activeProjects[0]) quickProjectSelect.value = activeProjects[0].id;
  }

  const quickSubmitBtn = document.createElement('button');
  quickSubmitBtn.type = 'submit';
  quickSubmitBtn.id = 'list-quick-add-submit';
  quickSubmitBtn.className = 'cv-btn cv-btn--primary cv-btn--sm';
  quickSubmitBtn.disabled = state.readOnly;
  quickSubmitBtn.textContent = t('tasks.quickAddSubmit');

  let quickComposing = false;
  quickInput.addEventListener('compositionstart', () => {
    quickComposing = true;
  });
  quickInput.addEventListener('compositionend', () => {
    quickComposing = false;
  });

  quickForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (quickComposing) return;
    const latestState = store.getState();
    if (latestState.readOnly) return;
    const cleanTitle = quickInput.value.trim();
    if (!cleanTitle) {
      quickInput.focus();
      return;
    }
    const targetProjectId =
      latestState.preferences.selectedProjectId ??
      quickProjectSelect?.value ??
      selectProjects(latestState)[0]?.id;
    if (!targetProjectId) return;

    const defaultStatus =
      filters.status !== 'all' && filters.status !== '__none__' && filters.status !== '__unknown__'
        ? filters.status
        : getDefaultInitialTaskStatusId(latestState.preferences.taskStatuses);
    const defaultPriority = filters.priority !== 'all' ? filters.priority : 'medium';

    store.dispatch({
      type: 'create_task',
      id: crypto.randomUUID(),
      projectId: targetProjectId,
      title: cleanTitle,
      status: defaultStatus,
      priority: defaultPriority,
      dueDate: null,
      now: new Date().toISOString(),
    });
    notify({ status: 'success', title: t('tasks.added'), text: cleanTitle });
    requestAnimationFrame(() => {
      document.getElementById('list-quick-add-input')?.focus();
    });
  });

  if (quickProjectSelect) {
    quickForm.append(quickLabel, quickInput, quickProjectSelect, quickSubmitBtn);
  } else {
    quickForm.append(quickLabel, quickInput, quickSubmitBtn);
  }

  const tableSlot = document.createElement('div');

  function renderTable() {
    const currentState = store.getState();
    const configuredStatuses = currentState.preferences.taskStatuses;
    const tasks = selectTasks(currentState, {
      projectId: currentState.preferences.selectedProjectId,
      status: filters.status,
      priority: filters.priority,
      tag: filters.tag,
      query: filters.query,
      sortBy: filters.sortBy,
    });

    if (tasks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'cv-empty';
      const iconBox = document.createElement('span');
      iconBox.className = 'cv-empty__icon';
      const ic = document.createElement('i');
      ic.className = 'ph ph-list-checks cv-icon';
      ic.setAttribute('aria-hidden', 'true');
      iconBox.append(ic);
      const title = document.createElement('p');
      title.className = 'cv-empty__title';
      title.textContent = t('tasks.noneFoundTitle');
      const desc = document.createElement('p');
      desc.textContent = t('tasks.noneFoundText');
      const cta = document.createElement('button');
      cta.type = 'button';
      cta.className = 'cv-btn cv-btn--primary';
      cta.disabled = currentState.readOnly;
      cta.textContent = t('tasks.new');
      cta.addEventListener('click', () => onOpenTaskDrawer(undefined, { mode: 'edit' }));
      empty.append(iconBox, title, desc, cta);
      tableSlot.replaceChildren(empty);
      return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'cv-table-wrap';
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-labelledby', 'task-table-caption');
    wrap.tabIndex = 0;
    const table = document.createElement('table');
    table.className = 'cv-table';

    const selectedProject = selectProjectById(
      currentState,
      currentState.preferences.selectedProjectId,
    );
    const caption = document.createElement('caption');
    caption.id = 'task-table-caption';
    caption.textContent = selectedProject
      ? t('tasks.tableTitleProject', { project: selectedProject.name, count: tasks.length })
      : t('tasks.tableTitleAll', { count: tasks.length });
    table.append(caption);

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    /** @type {Array<[string, boolean]>} */
    const cols = [
      [t('common.task'), false],
      [t('common.project'), false],
      [t('common.status'), false],
      [t('common.priority'), false],
      [t('common.dueDate'), true],
      [t('common.actions'), false],
    ];
    for (const [label, isNum] of cols) {
      const th = document.createElement('th');
      th.scope = 'col';
      if (isNum) th.className = 'cv-num';
      th.textContent = label;
      headRow.append(th);
    }
    thead.append(headRow);

    const todayIso = getTodayIsoDate();
    /** @type {Record<'overdue' | 'today' | 'this_week', { label: string; badgeClass: string; iconName: string }>} */
    const URGENCY_META = {
      overdue: {
        label: t('common.overdue'),
        badgeClass: 'cv-badge cv-badge--danger',
        iconName: 'ph-warning-circle',
      },
      today: {
        label: t('common.today'),
        badgeClass: 'cv-badge cv-badge--warning',
        iconName: 'ph-sun',
      },
      this_week: {
        label: t('common.thisWeek'),
        badgeClass: 'cv-badge cv-badge--accent',
        iconName: 'ph-calendar-blank',
      },
    };

    const tbody = document.createElement('tbody');
    for (const task of tasks) {
      const tr = document.createElement('tr');
      const statusMeta = getTaskStatusMeta(task.status, configuredStatuses, t);
      const statusRole = getTaskStatusRole(task.status, configuredStatuses);
      if (!statusMeta.known) {
        tr.classList.add('lc-task-row--unmapped');
        tr.dataset.statusUnknown = 'true';
      }
      if (statusRole) {
        tr.dataset.statusRole = statusRole;
      }

      const tdTitle = document.createElement('td');
      const titleBtn = document.createElement('button');
      titleBtn.type = 'button';
      titleBtn.className = 'lc-row-title-btn';
      titleBtn.textContent = task.title;
      titleBtn.addEventListener('click', () => onOpenTaskDrawer(task, { mode: 'view' }));
      tdTitle.append(titleBtn);
      if (task.recurrence || (task.tags ?? []).length > 0) {
        const tagList = document.createElement('div');
        tagList.className = 'lc-tags-inline';
        if (task.recurrence) {
          const recBadge = makeBadge(
            getTaskRecurrenceLabel(task.recurrence, t),
            'cv-badge cv-badge--info',
            { iconName: 'ph-arrows-clockwise' },
          );
          recBadge.dataset.recurrenceBadge = task.recurrence;
          tagList.append(recBadge);
        }
        for (const tag of task.tags ?? []) {
          const pill = document.createElement('span');
          pill.className = 'cv-tag';
          pill.textContent = `#${tag}`;
          tagList.append(pill);
        }
        tdTitle.append(tagList);
      }

      const tdProject = document.createElement('td');
      tdProject.textContent =
        selectProjectById(currentState, task.projectId)?.name ?? t('common.project');

      const tdStatus = document.createElement('td');
      const statusCellWrap = document.createElement('span');
      statusCellWrap.className = 'lc-status-cell';
      statusCellWrap.append(
        makeBadge(statusMeta.label, statusMeta.badgeClass, {
          warningIcon: !statusMeta.known,
          statusBadgeKind: statusMeta.kind,
        }),
      );
      if (statusRole === 'initial') {
        const roleTag = document.createElement('span');
        roleTag.className = 'cv-badge cv-badge--accent';
        roleTag.dataset.statusRole = 'initial';
        roleTag.textContent = t('common.initial');
        statusCellWrap.append(roleTag);
      } else if (statusRole === 'terminal') {
        const roleTag = document.createElement('span');
        roleTag.className = 'cv-badge cv-badge--success';
        roleTag.dataset.statusRole = 'terminal';
        roleTag.textContent = t('common.terminal');
        statusCellWrap.append(roleTag);
      }
      tdStatus.append(statusCellWrap);

      const tdPriority = document.createElement('td');
      const priorityInfo = PRIORITY_META[task.priority];
      tdPriority.append(makeBadge(priorityInfo.label, priorityInfo.badgeClass));

      const urgency = classifyDueDateUrgency(
        task.dueDate,
        todayIso,
        task.status,
        statusRole === 'terminal',
      );
      const tdDue = document.createElement('td');
      tdDue.className = 'cv-num';
      const dueText = task.dueDate
        ? task.dueTime
          ? `${task.dueDate} · ${format.formatTimeOfDay(task.dueTime)}`
          : task.dueDate
        : '';
      if (
        urgency === 'overdue' ||
        urgency === 'today' ||
        urgency === 'this_week' ||
        isOffHoursDueTime(task.dueTime)
      ) {
        if (urgency === 'overdue' || urgency === 'today' || urgency === 'this_week') {
          tr.dataset.dueUrgency = urgency;
          tr.classList.add(`lc-task-row--${urgency}`);
        }
        const wrapDue = document.createElement('span');
        wrapDue.className = 'lc-due-cell';
        const dateSpan = document.createElement('span');
        dateSpan.textContent = dueText || '—';
        wrapDue.append(dateSpan);
        if (isOffHoursDueTime(task.dueTime)) {
          const nightBadge = makeBadge(
            t('common.offHoursRange'),
            'cv-badge cv-badge--info lc-offhours-pill',
            {
              iconName: 'ph-moon',
            },
          );
          nightBadge.dataset.offhours = 'true';
          wrapDue.append(nightBadge);
        }
        if (urgency === 'overdue' || urgency === 'today' || urgency === 'this_week') {
          const urgMeta = URGENCY_META[urgency];
          const urgBadge = makeBadge(urgMeta.label, urgMeta.badgeClass, {
            iconName: urgMeta.iconName,
          });
          urgBadge.dataset.dueBadge = urgency;
          wrapDue.append(urgBadge);
        }
        tdDue.append(wrapDue);
      } else {
        tdDue.textContent = dueText || '—';
      }

      const tdActions = document.createElement('td');
      const actions = document.createElement('div');
      actions.className = 'lc-table-actions';

      const quickStatus = document.createElement('select');
      quickStatus.className = 'cv-input';
      quickStatus.style.width = 'auto';
      quickStatus.style.minHeight = 'var(--cv-row-sm)';
      quickStatus.setAttribute('aria-label', t('tasks.changeStatusNamed', { title: task.title }));
      quickStatus.disabled = currentState.readOnly;

      if (statusMeta.kind === 'unknown' && task.status) {
        const unknownOpt = document.createElement('option');
        unknownOpt.value = task.status;
        unknownOpt.textContent = statusMeta.label;
        unknownOpt.disabled = true;
        quickStatus.append(unknownOpt);
      }

      const noneOpt = document.createElement('option');
      noneOpt.value = '';
      noneOpt.textContent = t('statuses.none');
      quickStatus.append(noneOpt);

      for (const statusCfg of configuredStatuses) {
        const opt = document.createElement('option');
        opt.value = statusCfg.id;
        opt.textContent = statusCfg.label;
        quickStatus.append(opt);
      }
      quickStatus.value = task.status ?? '';
      quickStatus.addEventListener('change', () => {
        const nextStatus = quickStatus.value ? /** @type {TaskStatus} */ (quickStatus.value) : null;
        const prevIds = new Set(store.getState().tasks.map((t) => t.id));
        const { state: nextState } = store.dispatch({
          type: 'update_task',
          id: task.id,
          patch: { status: nextStatus },
          now: new Date().toISOString(),
        });
        const spawned = nextState.tasks.find((t) => !prevIds.has(t.id));
        if (spawned) {
          notify({
            status: 'success',
            title: t('tasks.nextOccurrenceTitle'),
            text: spawned.dueDate ? `${spawned.title} (${spawned.dueDate})` : spawned.title,
          });
        }
      });

      const consultBtn = document.createElement('button');
      consultBtn.type = 'button';
      consultBtn.className = 'cv-btn cv-btn--ghost cv-btn--sm';
      consultBtn.textContent = t('common.consult');
      consultBtn.setAttribute('aria-label', t('common.consultQuoted', { title: task.title }));
      consultBtn.addEventListener('click', () => onOpenTaskDrawer(task, { mode: 'view' }));

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'cv-btn cv-btn--ghost cv-btn--sm';
      editBtn.disabled = currentState.readOnly;
      editBtn.textContent = t('common.edit');
      editBtn.setAttribute('aria-label', t('common.editNamed', { title: task.title }));
      editBtn.addEventListener('click', () => onOpenTaskDrawer(task, { mode: 'edit' }));

      const archiveBtn = document.createElement('button');
      archiveBtn.type = 'button';
      archiveBtn.className = 'cv-btn cv-btn--ghost cv-btn--sm';
      archiveBtn.disabled = currentState.readOnly;
      archiveBtn.textContent = t('common.archive');
      archiveBtn.setAttribute('aria-label', t('common.archiveQuoted', { title: task.title }));
      archiveBtn.addEventListener('click', () => {
        store.dispatch({
          type: 'toggle_archive_task',
          id: task.id,
          archived: true,
          now: new Date().toISOString(),
        });
        notify({ status: 'info', title: t('tasks.archived'), text: task.title });
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'cv-btn cv-btn--ghost cv-btn--sm';
      delBtn.disabled = currentState.readOnly;
      delBtn.textContent = t('common.delete');
      delBtn.setAttribute('aria-label', t('common.deleteQuoted', { title: task.title }));
      delBtn.addEventListener('click', async () => {
        const confirmed = await confirmAction({
          title: t('common.deleteTitle', { title: task.title }),
          message: t('tasks.deleteConfirm'),
          confirmLabel: t('common.delete'),
          danger: true,
        });
        if (!confirmed) return;
        store.dispatch({
          type: 'trash_task',
          id: task.id,
          trashId: crypto.randomUUID(),
          now: new Date().toISOString(),
        });
        notify({ status: 'info', title: t('tasks.trashed'), text: task.title });
      });

      actions.append(quickStatus, consultBtn, editBtn, archiveBtn, delBtn);
      tdActions.append(actions);

      tr.append(tdTitle, tdProject, tdStatus, tdPriority, tdDue, tdActions);
      tbody.append(tr);
    }

    table.append(thead, tbody);
    wrap.append(table);
    tableSlot.replaceChildren(wrap);
  }

  searchInput.addEventListener('input', () => {
    filters.query = searchInput.value;
    renderTable();
  });
  statusSelect.addEventListener('change', () => {
    filters.status = /** @type {TaskStatusFilter} */ (statusSelect.value);
    renderTable();
  });
  prioritySelect.addEventListener('change', () => {
    filters.priority = /** @type {TaskPriority | 'all'} */ (prioritySelect.value);
    renderTable();
  });
  tagSelect.addEventListener('change', () => {
    filters.tag = tagSelect.value;
    renderTable();
  });
  sortSelect.addEventListener('change', () => {
    filters.sortBy = /** @type {'position' | 'dueDate' | 'priority'} */ (sortSelect.value);
    renderTable();
  });

  renderTable();
  container.replaceChildren(header, filtersBar, quickForm, tableSlot);
}
