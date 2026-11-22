/** @import { AppCommand, AppState, StoreEffect, Task, TaskDueFilter, TaskPriority, TaskStatus } from '../../types.d.ts' */
import { classifyDueDateUrgency, getTodayIsoDate, isOffHoursDueTime } from '../../core/dates.js';
import {
  getDefaultInitialTaskStatusId,
  getTaskRecurrenceLabel,
  getTaskStatusMeta,
  getTaskStatusRole,
  isTerminalTaskStatus,
} from '../../core/model.js';
import {
  selectAllTags,
  selectKanbanColumns,
  selectProjectById,
  selectProjects,
  selectUnmappedKanbanTasks,
} from '../../core/store.js';
import { confirmAction, initCovenant, notify } from './app-shell.js';
import { openStatusModal } from './status-modal.js';
import { createTaskWorkspaceHeader } from './task-workspace-header.js';
import { format, t } from '../i18n.js';

/** @type {Record<TaskPriority, { label: string; badgeClass: string }>} */
const PRIORITY_META = {
  low: { label: t('priority.low'), badgeClass: 'cv-badge' },
  medium: { label: t('priority.medium'), badgeClass: 'cv-badge cv-badge--warning' },
  high: { label: t('priority.high'), badgeClass: 'cv-badge cv-badge--danger' },
};

/**
 * Render the Kanban Board view with native drag-and-drop and full keyboard move controls.
 * @param {{
 *   container: HTMLElement;
 *   store: {
 *     getState: () => AppState;
 *     dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *   };
 *   filters: {
 *     query: string;
 *     priority: TaskPriority | 'all';
 *     due: TaskDueFilter;
 *     tag: string | 'all';
 *   };
 *   onOpenNewProject: () => void;
 *   onOpenTaskDrawer: (task?: Task, opts?: { defaultStatus?: TaskStatus | null; mode?: 'view' | 'edit' }) => void;
 * }} opts
 */
export function renderKanbanView({
  container,
  store,
  filters,
  onOpenNewProject,
  onOpenTaskDrawer,
}) {
  const state = store.getState();
  const activeProjects = selectProjects(state);
  const initialDefaultStatus = getDefaultInitialTaskStatusId(state.preferences.taskStatuses);

  const header = createTaskWorkspaceHeader({
    state,
    dispatch: store.dispatch,
    onOpenNewTask: () =>
      onOpenTaskDrawer(undefined, { defaultStatus: initialDefaultStatus, mode: 'edit' }),
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
    desc.textContent = t('kanban.emptyText');
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

  const filtersBar = document.createElement('div');
  filtersBar.className = 'lc-filters';

  const searchField = document.createElement('div');
  searchField.className = 'cv-field';
  const searchLabel = document.createElement('label');
  searchLabel.className = 'cv-label';
  searchLabel.htmlFor = 'kanban-search-input';
  searchLabel.textContent = t('kanban.search');
  const searchGroup = document.createElement('div');
  searchGroup.className = 'cv-input-group';
  const searchIcon = document.createElement('i');
  searchIcon.className = 'ph ph-magnifying-glass cv-icon';
  searchIcon.setAttribute('aria-hidden', 'true');
  const searchInput = document.createElement('input');
  searchInput.id = 'kanban-search-input';
  searchInput.type = 'search';
  searchInput.className = 'cv-input';
  searchInput.placeholder = t('common.searchPlaceholder');
  searchInput.value = filters.query;
  searchGroup.append(searchIcon, searchInput);
  searchField.append(searchLabel, searchGroup);

  const priorityField = document.createElement('div');
  priorityField.className = 'cv-field';
  const priorityLabel = document.createElement('label');
  priorityLabel.className = 'cv-label';
  priorityLabel.htmlFor = 'kanban-priority-filter';
  priorityLabel.textContent = t('common.priority');
  const priorityWrap = document.createElement('div');
  priorityWrap.className = 'cv-select';
  const prioritySelect = document.createElement('select');
  prioritySelect.id = 'kanban-priority-filter';
  prioritySelect.className = 'cv-input';
  for (const [val, lbl] of /** @type {const} */ ([
    ['all', t('common.allPriorities')],
    ['high', t('priority.high')],
    ['medium', t('priority.medium')],
    ['low', t('priority.low')],
  ])) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = lbl;
    prioritySelect.append(opt);
  }
  prioritySelect.value = filters.priority;
  priorityWrap.append(prioritySelect);
  priorityField.append(priorityLabel, priorityWrap);

  const dueField = document.createElement('div');
  dueField.className = 'cv-field';
  const dueLabel = document.createElement('label');
  dueLabel.className = 'cv-label';
  dueLabel.htmlFor = 'kanban-due-filter';
  dueLabel.textContent = t('common.dueDate');
  const dueWrap = document.createElement('div');
  dueWrap.className = 'cv-select';
  const dueSelect = document.createElement('select');
  dueSelect.id = 'kanban-due-filter';
  dueSelect.className = 'cv-input';
  for (const [val, lbl] of /** @type {const} */ ([
    ['all', t('kanban.allDueDates')],
    ['overdue', t('common.overdue')],
    ['today', t('common.today')],
    ['week', t('common.within7Days')],
    ['undated', t('common.noDueDate')],
  ])) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = lbl;
    dueSelect.append(opt);
  }
  dueSelect.value = filters.due;
  dueWrap.append(dueSelect);
  dueField.append(dueLabel, dueWrap);

  const tagField = document.createElement('div');
  tagField.className = 'cv-field';
  const tagLabel = document.createElement('label');
  tagLabel.className = 'cv-label';
  tagLabel.htmlFor = 'kanban-tag-filter';
  tagLabel.textContent = t('common.tag');
  const tagWrap = document.createElement('div');
  tagWrap.className = 'cv-select';
  const tagSelect = document.createElement('select');
  tagSelect.id = 'kanban-tag-filter';
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

  filtersBar.append(searchField, priorityField, dueField, tagField);

  const hint = document.createElement('p');
  hint.className = 'cv-hint';
  hint.style.margin = '0 0 var(--cv-space-3)';
  hint.textContent = t('kanban.dragHelp');

  const boardSlot = document.createElement('div');
  /** @type {string | null} */
  let draggedTaskId = null;

  /**
   * Move a task to a target status and target position index within its project.
   * @param {string} taskId
   * @param {TaskStatus} targetStatus
   * @param {number} targetIndex
   * @param {boolean} [refocusAfterMove]
   */
  function dispatchMove(taskId, targetStatus, targetIndex, refocusAfterMove = false) {
    const prevIds = new Set(store.getState().tasks.map((t) => t.id));
    const { state: nextState } = store.dispatch({
      type: 'move_task',
      id: taskId,
      targetStatus,
      targetIndex,
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
    if (refocusAfterMove) {
      requestAnimationFrame(() => {
        const movedEl = /** @type {HTMLElement | null} */ (
          document.querySelector(`[data-kanban-task-id="${CSS.escape(taskId)}"]`)
        );
        movedEl?.focus();
      });
    }
  }

  function renderBoard() {
    const currentState = store.getState();
    const configuredStatuses = currentState.preferences.taskStatuses;
    const statusIds = configuredStatuses.map((s) => s.id);

    if (configuredStatuses.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'cv-empty';
      const iconBox = document.createElement('span');
      iconBox.className = 'cv-empty__icon';
      const ic = document.createElement('i');
      ic.className = 'ph ph-columns cv-icon';
      ic.setAttribute('aria-hidden', 'true');
      iconBox.append(ic);
      const title = document.createElement('p');
      title.className = 'cv-empty__title';
      title.textContent = t('kanban.noStatusTitle');
      const desc = document.createElement('p');
      desc.textContent = t('kanban.noStatusText');
      const cta = document.createElement('button');
      cta.type = 'button';
      cta.className = 'cv-btn cv-btn--primary';
      cta.disabled = currentState.readOnly;
      cta.textContent = t('kanban.configureStatuses');
      cta.addEventListener('click', openStatusModal);
      empty.append(iconBox, title, desc, cta);
      boardSlot.replaceChildren(empty);
      return;
    }

    const columnsData = selectKanbanColumns(
      currentState,
      currentState.preferences.selectedProjectId,
      filters.query,
      { priority: filters.priority, due: filters.due, tag: filters.tag },
    );
    const unmappedTasks = selectUnmappedKanbanTasks(
      currentState,
      currentState.preferences.selectedProjectId,
      { query: filters.query, priority: filters.priority, due: filters.due, tag: filters.tag },
    );

    /** @type {HTMLElement | null} */
    let unmappedAlert = null;
    if (unmappedTasks.length > 0) {
      const alert = document.createElement('div');
      alert.className = 'cv-alert cv-alert--warning lc-kanban-unmapped';
      alert.id = 'kanban-unmapped-alert';
      alert.setAttribute('role', 'region');
      alert.setAttribute('aria-label', t('kanban.unmappedLabel'));

      const icon = document.createElement('i');
      icon.className = 'ph ph-warning cv-icon';
      icon.setAttribute('aria-hidden', 'true');

      const body = document.createElement('div');
      body.className = 'cv-alert__body lc-kanban-unmapped__body';

      const lead = document.createElement('span');
      lead.className = 'cv-alert__title';
      lead.textContent =
        unmappedTasks.length === 1
          ? t('kanban.unmapped', { count: 1 })
          : t('kanban.unmapped', { count: unmappedTasks.length });
      body.append(lead);

      const list = document.createElement('ul');
      list.className = 'lc-kanban-unmapped__list';

      for (const task of unmappedTasks) {
        const meta = getTaskStatusMeta(task.status, configuredStatuses, t);
        const li = document.createElement('li');
        li.className = 'lc-kanban-unmapped__item';
        li.dataset.unmappedTaskId = task.id;

        const info = document.createElement('div');
        info.className = 'lc-kanban-unmapped__info';

        const openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.className = 'lc-row-title-btn';
        openBtn.textContent = task.title;
        openBtn.addEventListener('click', () => onOpenTaskDrawer(task, { mode: 'view' }));

        const badge = document.createElement('span');
        badge.className = meta.badgeClass;
        badge.dataset.statusBadge = meta.kind;
        const bIc = document.createElement('i');
        bIc.className = 'ph ph-warning cv-icon';
        bIc.setAttribute('aria-hidden', 'true');
        badge.append(bIc, document.createTextNode(` ${meta.label}`));

        info.append(openBtn, badge);

        if (!currentState.readOnly) {
          const editUnmappedBtn = document.createElement('button');
          editUnmappedBtn.type = 'button';
          editUnmappedBtn.className = 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm';
          editUnmappedBtn.setAttribute('aria-label', t('common.editNamed', { title: task.title }));
          window.Covenant?.setTooltip?.(editUnmappedBtn, t('common.edit'));
          const penIc = document.createElement('i');
          penIc.className = 'ph ph-pencil-simple cv-icon';
          penIc.setAttribute('aria-hidden', 'true');
          editUnmappedBtn.append(penIc);
          editUnmappedBtn.addEventListener('click', () => onOpenTaskDrawer(task, { mode: 'edit' }));
          info.append(editUnmappedBtn);
        }

        const assignSelect = document.createElement('select');
        assignSelect.className = 'cv-input lc-kanban-unmapped__select';
        assignSelect.disabled = currentState.readOnly;
        assignSelect.setAttribute(
          'aria-label',
          t('kanban.assignColumnNamed', { title: task.title }),
        );

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = t('kanban.placeInColumn');
        assignSelect.append(placeholder);

        for (const colCfg of configuredStatuses) {
          const opt = document.createElement('option');
          opt.value = colCfg.id;
          opt.textContent = colCfg.label;
          assignSelect.append(opt);
        }

        assignSelect.addEventListener('change', () => {
          const targetStatus = assignSelect.value;
          if (!targetStatus) return;
          const endPos = currentState.tasks.filter(
            (t) => t.projectId === task.projectId && t.status === targetStatus,
          ).length;
          dispatchMove(task.id, targetStatus, endPos);
          notify({ status: 'success', title: t('kanban.taskRestored'), text: task.title });
        });

        li.append(info, assignSelect);
        list.append(li);
      }

      body.append(list);
      alert.append(icon, body);
      unmappedAlert = alert;
    }

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

    const board = document.createElement('div');
    board.className = 'lc-kanban';

    for (const colMeta of configuredStatuses) {
      const colTasks = columnsData[colMeta.id] ?? [];
      const colRole = getTaskStatusRole(colMeta.id, configuredStatuses);
      const colEl = document.createElement('section');
      colEl.className = 'lc-kanban__col';
      colEl.dataset.kanbanStatus = colMeta.id;
      if (colRole) {
        colEl.dataset.statusRole = colRole;
      }
      colEl.setAttribute('aria-labelledby', `kanban-col-${colMeta.id}`);

      const colHead = document.createElement('div');
      colHead.className = 'lc-kanban__col-header';

      const colTitleGroup = document.createElement('div');
      colTitleGroup.className = 'lc-kanban__col-title-group';

      const colTitle = document.createElement('h2');
      colTitle.id = `kanban-col-${colMeta.id}`;
      colTitle.className = 'lc-kanban__col-title';
      colTitle.textContent = colMeta.label;
      colTitleGroup.append(colTitle);

      if (colRole === 'initial') {
        const roleBadge = document.createElement('span');
        roleBadge.className = 'cv-badge cv-badge--accent';
        roleBadge.dataset.statusRole = 'initial';
        roleBadge.textContent = t('common.initial');
        colTitleGroup.append(roleBadge);
      } else if (colRole === 'terminal') {
        const roleBadge = document.createElement('span');
        roleBadge.className = 'cv-badge cv-badge--success';
        roleBadge.dataset.statusRole = 'terminal';
        roleBadge.textContent = t('common.terminal');
        colTitleGroup.append(roleBadge);
      }

      const colControls = document.createElement('div');
      colControls.className = 'lc-table-actions';
      const countBadge = document.createElement('span');
      countBadge.className = 'cv-badge cv-num';
      countBadge.textContent = String(colTasks.length);

      const quickAddBtn = document.createElement('button');
      quickAddBtn.type = 'button';
      quickAddBtn.className = 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm';
      quickAddBtn.disabled = currentState.readOnly;
      quickAddBtn.setAttribute('aria-label', t('kanban.addInColumn', { column: colMeta.label }));
      window.Covenant?.setTooltip?.(
        quickAddBtn,
        t('kanban.addInColumn', { column: colMeta.label }),
      );
      const addIc = document.createElement('i');
      addIc.className = 'ph ph-plus cv-icon';
      addIc.setAttribute('aria-hidden', 'true');
      quickAddBtn.append(addIc);
      quickAddBtn.addEventListener('click', () =>
        onOpenTaskDrawer(undefined, { defaultStatus: colMeta.id, mode: 'edit' }),
      );

      colControls.append(countBadge, quickAddBtn);
      colHead.append(colTitleGroup, colControls);

      const colQuickForm = document.createElement('form');
      colQuickForm.className = 'lc-kanban__quick-add';
      colQuickForm.dataset.kanbanQuickAdd = colMeta.id;
      colQuickForm.noValidate = true;

      const colQuickLabel = document.createElement('label');
      colQuickLabel.className = 'lc-sr-only';
      colQuickLabel.htmlFor = `kanban-quick-add-${colMeta.id}`;
      colQuickLabel.textContent = t('kanban.quickAddIn', { column: colMeta.label });

      const colQuickInput = document.createElement('input');
      colQuickInput.id = `kanban-quick-add-${colMeta.id}`;
      colQuickInput.type = 'text';
      colQuickInput.className = 'cv-input lc-kanban__quick-input';
      colQuickInput.maxLength = 200;
      colQuickInput.disabled = currentState.readOnly;
      colQuickInput.placeholder = t('kanban.quickAddPlaceholder');

      const colQuickSubmit = document.createElement('button');
      colQuickSubmit.type = 'submit';
      colQuickSubmit.className = 'cv-btn cv-btn--sm';
      colQuickSubmit.disabled = currentState.readOnly;
      colQuickSubmit.setAttribute(
        'aria-label',
        t('kanban.quickAddSubmit', { column: colMeta.label }),
      );
      colQuickSubmit.textContent = t('common.add');

      let colComposing = false;
      colQuickInput.addEventListener('compositionstart', () => {
        colComposing = true;
      });
      colQuickInput.addEventListener('compositionend', () => {
        colComposing = false;
      });

      colQuickForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (colComposing) return;
        const latestState = store.getState();
        if (latestState.readOnly) return;
        const cleanTitle = colQuickInput.value.trim();
        if (!cleanTitle) {
          colQuickInput.focus();
          return;
        }
        const targetProjectId =
          latestState.preferences.selectedProjectId ?? selectProjects(latestState)[0]?.id;
        if (!targetProjectId) return;
        const defaultPriority = filters.priority !== 'all' ? filters.priority : 'medium';

        store.dispatch({
          type: 'create_task',
          id: crypto.randomUUID(),
          projectId: targetProjectId,
          title: cleanTitle,
          status: colMeta.id,
          priority: defaultPriority,
          dueDate: null,
          now: new Date().toISOString(),
        });
        notify({ status: 'success', title: t('tasks.added'), text: cleanTitle });
        requestAnimationFrame(() => {
          document.getElementById(`kanban-quick-add-${colMeta.id}`)?.focus();
        });
      });

      colQuickForm.append(colQuickLabel, colQuickInput, colQuickSubmit);

      const listEl = document.createElement('div');
      listEl.className = 'lc-kanban__list';

      colEl.addEventListener('dragover', (event) => {
        if (currentState.readOnly) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        colEl.dataset.dropActive = 'true';
      });

      colEl.addEventListener('dragleave', (event) => {
        const related = /** @type {Node | null} */ (event.relatedTarget);
        if (!related || !colEl.contains(related)) {
          delete colEl.dataset.dropActive;
        }
      });

      colEl.addEventListener('drop', (event) => {
        if (currentState.readOnly) return;
        event.preventDefault();
        delete colEl.dataset.dropActive;
        const taskId = event.dataTransfer?.getData('text/plain') || draggedTaskId;
        if (!taskId) return;
        const droppedTask = currentState.tasks.find((t) => t.id === taskId);
        if (!droppedTask) return;

        const projectColTasks = currentState.tasks
          .filter(
            (t) =>
              t.projectId === droppedTask.projectId &&
              t.status === colMeta.id &&
              t.id !== droppedTask.id,
          )
          .sort((a, b) => a.position - b.position);
        dispatchMove(taskId, colMeta.id, projectColTasks.length);
      });

      for (const task of colTasks) {
        const projectSiblings = currentState.tasks
          .filter((t) => t.projectId === task.projectId && t.status === colMeta.id)
          .sort((a, b) => a.position - b.position);
        const siblingIndex = projectSiblings.findIndex((t) => t.id === task.id);

        const card = document.createElement('article');
        card.className = 'cv-card lc-kanban__card';
        card.tabIndex = 0;
        card.draggable = !currentState.readOnly;
        card.dataset.kanbanTaskId = task.id;
        card.setAttribute('aria-label', `${task.title}, ${colMeta.label}`);

        card.addEventListener('dragstart', (event) => {
          if (currentState.readOnly) {
            event.preventDefault();
            return;
          }
          draggedTaskId = task.id;
          card.dataset.dragging = 'true';
          if (event.dataTransfer) {
            event.dataTransfer.setData('text/plain', task.id);
            event.dataTransfer.effectAllowed = 'move';
          }
        });

        card.addEventListener('dragend', () => {
          draggedTaskId = null;
          delete card.dataset.dragging;
          boardSlot.querySelectorAll('[data-drop-active]').forEach((el) => {
            if (el instanceof HTMLElement) delete el.dataset.dropActive;
          });
        });

        card.addEventListener('dragover', (event) => {
          if (currentState.readOnly) return;
          event.preventDefault();
        });

        card.addEventListener('drop', (event) => {
          if (currentState.readOnly) return;
          event.preventDefault();
          event.stopPropagation();
          delete colEl.dataset.dropActive;
          const taskId = event.dataTransfer?.getData('text/plain') || draggedTaskId;
          if (!taskId || taskId === task.id) return;
          const droppedTask = currentState.tasks.find((t) => t.id === taskId);
          if (!droppedTask) return;

          if (droppedTask.projectId === task.projectId) {
            const targetSiblings = currentState.tasks
              .filter(
                (t) =>
                  t.projectId === task.projectId &&
                  t.status === colMeta.id &&
                  t.id !== droppedTask.id,
              )
              .sort((a, b) => a.position - b.position);
            const idx = targetSiblings.findIndex((t) => t.id === task.id);
            dispatchMove(taskId, colMeta.id, idx >= 0 ? idx : targetSiblings.length);
          } else {
            const endLen = currentState.tasks.filter(
              (t) => t.projectId === droppedTask.projectId && t.status === colMeta.id,
            ).length;
            dispatchMove(taskId, colMeta.id, endLen);
          }
        });

        // Keyboard shortcuts on focused card: Alt + ArrowLeft / ArrowRight / ArrowUp / ArrowDown
        card.addEventListener('keydown', (event) => {
          if (currentState.readOnly || !event.altKey) return;
          const statusIdx = task.status ? statusIds.indexOf(task.status) : -1;
          if (statusIdx === -1) return;
          const nextStatus = statusIds[statusIdx + 1];
          const prevStatus = statusIds[statusIdx - 1];
          if (event.key === 'ArrowRight' && nextStatus) {
            event.preventDefault();
            const endPos = currentState.tasks.filter(
              (t) => t.projectId === task.projectId && t.status === nextStatus,
            ).length;
            dispatchMove(task.id, nextStatus, endPos, true);
          } else if (event.key === 'ArrowLeft' && prevStatus) {
            event.preventDefault();
            const endPos = currentState.tasks.filter(
              (t) => t.projectId === task.projectId && t.status === prevStatus,
            ).length;
            dispatchMove(task.id, prevStatus, endPos, true);
          } else if (event.key === 'ArrowUp' && siblingIndex > 0) {
            event.preventDefault();
            dispatchMove(task.id, colMeta.id, siblingIndex - 1, true);
          } else if (event.key === 'ArrowDown' && siblingIndex < projectSiblings.length - 1) {
            event.preventDefault();
            dispatchMove(task.id, colMeta.id, siblingIndex + 1, true);
          }
        });

        const cardHead = document.createElement('div');
        cardHead.className = 'lc-kanban__card-head';

        const titleBtn = document.createElement('button');
        titleBtn.type = 'button';
        titleBtn.className = 'lc-kanban__card-title-btn';
        titleBtn.textContent = task.title;
        titleBtn.addEventListener('click', () => onOpenTaskDrawer(task, { mode: 'view' }));

        const menuId = `menu-task-${task.id}`;
        const menuBtn = document.createElement('button');
        menuBtn.type = 'button';
        menuBtn.className = 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm';
        menuBtn.setAttribute('popovertarget', menuId);
        menuBtn.setAttribute('aria-haspopup', 'menu');
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.setAttribute('aria-label', t('kanban.actionsFor', { title: task.title }));
        window.Covenant?.setTooltip?.(menuBtn, t('kanban.taskActions'));
        const dotsIc = document.createElement('i');
        dotsIc.className = 'ph ph-dots-three-vertical cv-icon';
        dotsIc.setAttribute('aria-hidden', 'true');
        menuBtn.append(dotsIc);

        const menu = document.createElement('div');
        menu.className = 'cv-menu';
        menu.id = menuId;
        menu.setAttribute('popover', '');
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', t('kanban.actionsOn', { title: task.title }));

        /**
         * @param {string} label
         * @param {() => void} handler
         * @param {{ danger?: boolean; disabled?: boolean }} [cfg]
         */
        const addMenuItem = (label, handler, cfg = {}) => {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = cfg.danger ? 'cv-menu__item cv-menu__item--danger' : 'cv-menu__item';
          item.setAttribute('role', 'menuitem');
          if (cfg.disabled) {
            item.setAttribute('aria-disabled', 'true');
            item.disabled = true;
          }
          item.textContent = label;
          item.addEventListener('click', () => {
            try {
              if (menu.matches(':popover-open')) {
                menu.hidePopover();
              }
            } catch {
              // Ignore when popover API is unavailable or already closed
            }
            handler();
          });
          menu.append(item);
        };

        addMenuItem(t('common.consult'), () => onOpenTaskDrawer(task, { mode: 'view' }));

        if (!currentState.readOnly) {
          addMenuItem(t('common.edit'), () => onOpenTaskDrawer(task, { mode: 'edit' }));

          const sep1 = document.createElement('hr');
          sep1.className = 'cv-menu__sep';
          menu.append(sep1);

          for (const targetCol of configuredStatuses) {
            if (targetCol.id !== task.status) {
              addMenuItem(t('kanban.moveTo', { column: targetCol.label }), () => {
                const endPos = currentState.tasks.filter(
                  (t) => t.projectId === task.projectId && t.status === targetCol.id,
                ).length;
                dispatchMove(task.id, targetCol.id, endPos, true);
              });
            }
          }

          if (siblingIndex > 0) {
            addMenuItem(t('kanban.moveUp'), () => {
              dispatchMove(task.id, colMeta.id, siblingIndex - 1, true);
            });
          }
          if (siblingIndex < projectSiblings.length - 1) {
            addMenuItem(t('kanban.moveDown'), () => {
              dispatchMove(task.id, colMeta.id, siblingIndex + 1, true);
            });
          }

          const sep2 = document.createElement('hr');
          sep2.className = 'cv-menu__sep';
          menu.append(sep2);

          addMenuItem(t('common.archive'), () => {
            store.dispatch({
              type: 'toggle_archive_task',
              id: task.id,
              archived: true,
              now: new Date().toISOString(),
            });
            notify({ status: 'info', title: t('tasks.archived'), text: task.title });
          });

          addMenuItem(
            t('common.delete'),
            async () => {
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
            },
            { danger: true },
          );
        }

        cardHead.append(titleBtn, menuBtn, menu);

        const metaRow = document.createElement('div');
        metaRow.className = 'lc-kanban__card-meta';

        const prioInfo = PRIORITY_META[task.priority];
        const prioBadge = document.createElement('span');
        prioBadge.className = prioInfo.badgeClass;
        const prioDot = document.createElement('span');
        prioDot.className = 'cv-badge__dot';
        prioBadge.append(prioDot, document.createTextNode(prioInfo.label));
        metaRow.append(prioBadge);

        const urgency = classifyDueDateUrgency(
          task.dueDate,
          todayIso,
          task.status,
          isTerminalTaskStatus(task.status, configuredStatuses),
        );
        if (urgency === 'overdue' || urgency === 'today' || urgency === 'this_week') {
          card.dataset.dueUrgency = urgency;
          card.classList.add(`lc-kanban__card--${urgency}`);
          const urgMeta = URGENCY_META[urgency];
          const urgBadge = document.createElement('span');
          urgBadge.className = urgMeta.badgeClass;
          urgBadge.dataset.dueBadge = urgency;
          const uIc = document.createElement('i');
          uIc.className = `ph ${urgMeta.iconName} cv-icon`;
          uIc.setAttribute('aria-hidden', 'true');
          urgBadge.append(uIc, document.createTextNode(` ${urgMeta.label}`));
          metaRow.append(urgBadge);
        }

        if (task.dueDate) {
          const dueTag = document.createElement('span');
          dueTag.className = 'cv-tag cv-tag--mono';
          dueTag.textContent = task.dueTime
            ? `${task.dueDate} · ${format.formatTimeOfDay(task.dueTime)}`
            : task.dueDate;
          metaRow.append(dueTag);
          if (isOffHoursDueTime(task.dueTime)) {
            const nightBadge = document.createElement('span');
            nightBadge.className = 'cv-badge cv-badge--info lc-offhours-pill';
            nightBadge.dataset.offhours = 'true';
            const nIc = document.createElement('i');
            nIc.className = 'ph ph-moon cv-icon';
            nIc.setAttribute('aria-hidden', 'true');
            nightBadge.append(nIc, document.createTextNode(` ${t('common.offHoursRange')}`));
            metaRow.append(nightBadge);
          }
        }

        if (task.recurrence) {
          const recBadge = document.createElement('span');
          recBadge.className = 'cv-badge cv-badge--info';
          recBadge.dataset.recurrenceBadge = task.recurrence;
          const rIc = document.createElement('i');
          rIc.className = 'ph ph-arrows-clockwise cv-icon';
          rIc.setAttribute('aria-hidden', 'true');
          recBadge.append(
            rIc,
            document.createTextNode(` ${getTaskRecurrenceLabel(task.recurrence, t)}`),
          );
          metaRow.append(recBadge);
        }

        if (task.checklist.length > 0) {
          const doneCount = task.checklist.filter((c) => c.done).length;
          const checkTag = document.createElement('span');
          checkTag.className = 'cv-tag cv-tag--mono';
          checkTag.textContent = `${doneCount}/${task.checklist.length}`;
          metaRow.append(checkTag);
        }

        for (const tag of task.tags ?? []) {
          const tagPill = document.createElement('span');
          tagPill.className = 'cv-tag';
          tagPill.textContent = `#${tag}`;
          metaRow.append(tagPill);
        }

        if (!currentState.preferences.selectedProjectId) {
          const projName = selectProjectById(currentState, task.projectId)?.name;
          if (projName) {
            const projTag = document.createElement('span');
            projTag.className = 'cv-tag';
            projTag.textContent = projName;
            metaRow.append(projTag);
          }
        }

        card.append(cardHead, metaRow);
        listEl.append(card);
      }

      colEl.append(colHead, colQuickForm, listEl);
      board.append(colEl);
    }

    if (unmappedAlert) {
      boardSlot.replaceChildren(unmappedAlert, board);
    } else {
      boardSlot.replaceChildren(board);
    }
    initCovenant(boardSlot);
    window.Covenant?.init?.(boardSlot);
  }

  searchInput.addEventListener('input', () => {
    filters.query = searchInput.value;
    renderBoard();
  });
  prioritySelect.addEventListener('change', () => {
    filters.priority = /** @type {TaskPriority | 'all'} */ (prioritySelect.value);
    renderBoard();
  });
  dueSelect.addEventListener('change', () => {
    filters.due = /** @type {TaskDueFilter} */ (dueSelect.value);
    renderBoard();
  });
  tagSelect.addEventListener('change', () => {
    filters.tag = tagSelect.value;
    renderBoard();
  });

  container.replaceChildren(header, filtersBar, hint, boardSlot);
  renderBoard();
}
