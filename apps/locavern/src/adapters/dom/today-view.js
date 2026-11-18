/** @import { AppCommand, AppState, Note, StoreEffect, Task, Whiteboard } from '../../types.d.ts' */

import {
  diffIsoDays,
  formatFullDateFr,
  formatShortDateFr,
  isOffHoursDueTime,
} from '../../core/dates.js';
import {
  getDefaultTerminalTaskStatusId,
  getTaskRecurrenceLabel,
  getTaskStatusMeta,
} from '../../core/model.js';
import { selectProjectById, selectTodaySummary } from '../../core/store.js';
import { notify } from './app-shell.js';
import { setTooltip } from './tooltip.js';

/**
 * Create a Covenant KPI summary tile.
 * @param {{ id: string; label: string; count: number; badgeClass?: string; icon: string }} opts
 * @returns {HTMLElement}
 */
function createStatCard({ id, label, count, badgeClass = 'cv-badge', icon }) {
  const card = document.createElement('div');
  card.className = 'cv-card lc-today-stat';
  card.id = id;

  const head = document.createElement('div');
  head.className = 'lc-today-stat__head';

  const ic = document.createElement('i');
  ic.className = `ph ${icon} cv-icon`;
  ic.setAttribute('aria-hidden', 'true');

  const lbl = document.createElement('span');
  lbl.className = 'cv-caption';
  lbl.textContent = label;
  head.append(ic, lbl);

  const valWrap = document.createElement('div');
  valWrap.className = 'lc-today-stat__val';
  const badge = document.createElement('span');
  badge.className = `${badgeClass} cv-num`;
  badge.textContent = String(count);
  valWrap.append(badge);

  card.append(head, valWrap);
  return card;
}

/**
 * Render the "Aujourd’hui" dashboard summarizing overdue tasks, upcoming deadlines,
 * high-priority open tasks, and recently updated local items.
 * @param {{
 *   container: HTMLElement;
 *   store: {
 *     getState: () => AppState;
 *     dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *   };
 *   onOpenTask: (task: Task, mode?: 'view' | 'edit') => void;
 *   onOpenNote: (note: Note, mode?: 'view' | 'edit') => void;
 *   onOpenWhiteboard: (wb: Whiteboard, mode?: 'view' | 'edit') => void;
 *   onNewTask: () => void;
 *   onNewNote: () => void;
 *   onNewWhiteboard: () => void;
 * }} opts
 */
export function renderTodayView({
  container,
  store,
  onOpenTask,
  onOpenNote,
  onOpenWhiteboard,
  onNewTask,
  onNewNote,
  onNewWhiteboard,
}) {
  const state = store.getState();
  const summary = selectTodaySummary(state);
  const configuredStatuses = state.preferences.taskStatuses;
  const terminalStatusId = getDefaultTerminalTaskStatusId(configuredStatuses);

  // Header
  const header = document.createElement('div');
  header.className = 'lc-view-header';

  const titleGroup = document.createElement('div');
  const titleEl = document.createElement('h2');
  titleEl.className = 'cv-heading-2';
  titleEl.style.margin = '0';
  titleEl.textContent = 'Aujourd’hui';

  const subtitle = document.createElement('p');
  subtitle.className = 'cv-caption';
  subtitle.style.margin = '0';
  subtitle.textContent = formatFullDateFr(summary.todayIso);
  titleGroup.append(titleEl, subtitle);

  const actionsGroup = document.createElement('div');
  actionsGroup.className = 'lc-view-header__group';

  const newTaskBtn = document.createElement('button');
  newTaskBtn.type = 'button';
  newTaskBtn.className = 'cv-btn cv-btn--primary cv-btn--sm';
  newTaskBtn.id = 'today-btn-new-task';
  newTaskBtn.disabled = state.readOnly;
  const taskIc = document.createElement('i');
  taskIc.className = 'ph ph-plus cv-icon';
  taskIc.setAttribute('aria-hidden', 'true');
  newTaskBtn.append(taskIc, document.createTextNode('Nouvelle tâche'));
  newTaskBtn.addEventListener('click', onNewTask);

  const newNoteBtn = document.createElement('button');
  newNoteBtn.type = 'button';
  newNoteBtn.className = 'cv-btn cv-btn--sm';
  newNoteBtn.id = 'today-btn-new-note';
  newNoteBtn.disabled = state.readOnly;
  const noteIc = document.createElement('i');
  noteIc.className = 'ph ph-note-pencil cv-icon';
  noteIc.setAttribute('aria-hidden', 'true');
  newNoteBtn.append(noteIc, document.createTextNode('Nouvelle note'));
  newNoteBtn.addEventListener('click', onNewNote);

  const newWbBtn = document.createElement('button');
  newWbBtn.type = 'button';
  newWbBtn.className = 'cv-btn cv-btn--sm';
  newWbBtn.id = 'today-btn-new-wb';
  newWbBtn.disabled = state.readOnly;
  const wbIc = document.createElement('i');
  wbIc.className = 'ph ph-chalkboard-simple cv-icon';
  wbIc.setAttribute('aria-hidden', 'true');
  newWbBtn.append(wbIc, document.createTextNode('Nouveau tableau blanc'));
  newWbBtn.addEventListener('click', onNewWhiteboard);

  actionsGroup.append(newTaskBtn, newNoteBtn, newWbBtn);
  header.append(titleGroup, actionsGroup);

  // KPI cards
  const statsRow = document.createElement('div');
  statsRow.className = 'lc-today-stats';
  statsRow.setAttribute('aria-label', 'Indicateurs du jour');
  statsRow.append(
    createStatCard({
      id: 'today-stat-overdue',
      label: 'En retard',
      count: summary.overdueTasks.length,
      badgeClass: summary.overdueTasks.length > 0 ? 'cv-badge cv-badge--danger' : 'cv-badge',
      icon: 'ph-warning-circle',
    }),
    createStatCard({
      id: 'today-stat-due-today',
      label: 'Pour aujourd’hui',
      count: summary.dueTodayTasks.length,
      badgeClass: summary.dueTodayTasks.length > 0 ? 'cv-badge cv-badge--warning' : 'cv-badge',
      icon: 'ph-sun',
    }),
    createStatCard({
      id: 'today-stat-upcoming',
      label: 'Sous 7 jours',
      count: summary.upcomingTasks.length,
      badgeClass: summary.upcomingTasks.length > 0 ? 'cv-badge cv-badge--accent' : 'cv-badge',
      icon: 'ph-calendar-blank',
    }),
    createStatCard({
      id: 'today-stat-high-prio',
      label: 'Priorités hautes',
      count: summary.highPriorityTasks.length,
      badgeClass: summary.highPriorityTasks.length > 0 ? 'cv-badge cv-badge--danger' : 'cv-badge',
      icon: 'ph-flag',
    }),
  );

  // Helper to build dashboard section card
  /**
   * @param {{ id: string; title: string; icon: string; count: number; badgeClass?: string }} cfg
   * @returns {{ card: HTMLElement; list: HTMLUListElement; body: HTMLElement }}
   */
  function createSectionCard({ id, title, icon, count, badgeClass = 'cv-badge' }) {
    const card = document.createElement('section');
    card.className = 'cv-card lc-today-section';
    card.id = id;
    card.setAttribute('aria-labelledby', `${id}-title`);

    const head = document.createElement('div');
    head.className = 'lc-today-section__header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'lc-view-header__group';
    const ic = document.createElement('i');
    ic.className = `ph ${icon} cv-icon`;
    ic.setAttribute('aria-hidden', 'true');
    const h3 = document.createElement('h3');
    h3.className = 'lc-today-section__title';
    h3.id = `${id}-title`;
    h3.textContent = title;
    titleWrap.append(ic, h3);

    const badge = document.createElement('span');
    badge.className = `${badgeClass} cv-num`;
    badge.textContent = String(count);

    head.append(titleWrap, badge);

    const list = document.createElement('ul');
    list.className = 'lc-today-list';

    card.append(head, list);
    return { card, list, body: card };
  }

  /**
   * Build a task item row for the dashboard sections.
   * @param {Task} task
   * @param {{ rightBadgeLabel: string; rightBadgeClass: string; showCompleteBtn?: boolean; iconName?: string }} opts
   * @returns {HTMLLIElement}
   */
  function createTaskListItem(
    task,
    { rightBadgeLabel, rightBadgeClass, showCompleteBtn = true, iconName },
  ) {
    const li = document.createElement('li');
    li.className = 'lc-today-item';
    li.dataset.taskId = task.id;

    const mainBtn = document.createElement('button');
    mainBtn.type = 'button';
    mainBtn.className = 'lc-today-item__btn';
    mainBtn.addEventListener('click', () => onOpenTask(task, 'view'));

    const titleSpan = document.createElement('span');
    titleSpan.className = 'lc-today-item__title';
    titleSpan.textContent = task.title;
    mainBtn.append(titleSpan);

    const projName = selectProjectById(state, task.projectId)?.name;
    if (projName) {
      const projTag = document.createElement('span');
      projTag.className = 'cv-tag';
      projTag.textContent = projName;
      mainBtn.append(projTag);
    }

    const side = document.createElement('div');
    side.className = 'lc-today-item__side';

    if (task.dueTime) {
      const offHours = isOffHoursDueTime(task.dueTime);
      const timeBadge = document.createElement('span');
      timeBadge.className = offHours ? 'cv-badge lc-offhours-pill cv-num' : 'cv-badge cv-num';
      if (offHours) {
        const moonIc = document.createElement('i');
        moonIc.className = 'ph ph-moon cv-icon';
        moonIc.setAttribute('aria-hidden', 'true');
        timeBadge.append(moonIc, document.createTextNode(` ${task.dueTime}`));
        timeBadge.setAttribute('title', 'Créneau 18h–7h');
      } else {
        timeBadge.textContent = task.dueTime;
      }
      side.append(timeBadge);
    }

    if (task.recurrence) {
      const recBadge = document.createElement('span');
      recBadge.className = 'cv-badge cv-badge--info';
      recBadge.dataset.recurrenceBadge = task.recurrence;
      const rIc = document.createElement('i');
      rIc.className = 'ph ph-arrows-clockwise cv-icon';
      rIc.setAttribute('aria-hidden', 'true');
      recBadge.append(rIc, document.createTextNode(` ${getTaskRecurrenceLabel(task.recurrence)}`));
      side.append(recBadge);
    }

    const badge = document.createElement('span');
    badge.className = rightBadgeClass;
    if (iconName) {
      const bIc = document.createElement('i');
      bIc.className = `ph ${iconName} cv-icon`;
      bIc.setAttribute('aria-hidden', 'true');
      badge.append(bIc, document.createTextNode(` ${rightBadgeLabel}`));
    } else {
      badge.textContent = rightBadgeLabel;
    }
    side.append(badge);

    if (!state.readOnly) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm';
      editBtn.setAttribute('aria-label', `Modifier « ${task.title} »`);
      setTooltip(editBtn, 'Modifier');
      const editIc = document.createElement('i');
      editIc.className = 'ph ph-pencil-simple cv-icon';
      editIc.setAttribute('aria-hidden', 'true');
      editBtn.append(editIc);
      editBtn.addEventListener('click', () => onOpenTask(task, 'edit'));
      side.append(editBtn);
    }

    if (showCompleteBtn && terminalStatusId && !state.readOnly) {
      const doneBtn = document.createElement('button');
      doneBtn.type = 'button';
      doneBtn.className = 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm';
      doneBtn.setAttribute('aria-label', `Marquer « ${task.title} » comme terminée`);
      setTooltip(doneBtn, 'Marquer terminée');
      const checkIc = document.createElement('i');
      checkIc.className = 'ph ph-check cv-icon';
      checkIc.setAttribute('aria-hidden', 'true');
      doneBtn.append(checkIc);
      doneBtn.addEventListener('click', () => {
        const prevIds = new Set(store.getState().tasks.map((t) => t.id));
        const { state: nextState } = store.dispatch({
          type: 'update_task',
          id: task.id,
          patch: { status: terminalStatusId },
          now: new Date().toISOString(),
        });
        const spawned = nextState.tasks.find((t) => !prevIds.has(t.id));
        if (spawned) {
          notify({
            status: 'success',
            title: 'Prochaine occurrence créée',
            text: spawned.dueDate ? `${spawned.title} (${spawned.dueDate})` : spawned.title,
          });
        } else {
          notify({ status: 'success', title: 'Tâche terminée', text: task.title });
        }
      });
      side.append(doneBtn);
    }

    li.append(mainBtn, side);
    return li;
  }

  /**
   * Append an inline muted empty message when a dashboard section has 0 items.
   * @param {HTMLUListElement} list
   * @param {string} message
   */
  function appendEmptyMessage(list, message) {
    const li = document.createElement('li');
    li.className = 'lc-today-empty cv-caption';
    li.textContent = message;
    list.append(li);
  }

  // 1. Overdue section
  const overdueSec = createSectionCard({
    id: 'today-overdue-section',
    title: 'Tâches en retard',
    icon: 'ph-warning-circle',
    count: summary.overdueTasks.length,
    badgeClass: summary.overdueTasks.length > 0 ? 'cv-badge cv-badge--danger' : 'cv-badge',
  });
  if (summary.overdueTasks.length === 0) {
    appendEmptyMessage(overdueSec.list, 'Aucune tâche en retard.');
  } else {
    for (const task of summary.overdueTasks) {
      const daysLate = task.dueDate ? Math.abs(diffIsoDays(summary.todayIso, task.dueDate)) : 0;
      const lateLabel =
        daysLate === 1
          ? `1 j de retard (${formatShortDateFr(task.dueDate ?? '')})`
          : `${daysLate} j de retard (${formatShortDateFr(task.dueDate ?? '')})`;
      overdueSec.list.append(
        createTaskListItem(task, {
          rightBadgeLabel: lateLabel,
          rightBadgeClass: 'cv-badge cv-badge--danger',
          iconName: 'ph-warning',
        }),
      );
    }
  }

  // 2. Due today & next 7 days section
  const nearTasks = [...summary.dueTodayTasks, ...summary.upcomingTasks];
  const upcomingSec = createSectionCard({
    id: 'today-upcoming-section',
    title: 'Échéances proches',
    icon: 'ph-calendar-blank',
    count: nearTasks.length,
    badgeClass: summary.dueTodayTasks.length > 0 ? 'cv-badge cv-badge--warning' : 'cv-badge',
  });
  if (nearTasks.length === 0) {
    appendEmptyMessage(upcomingSec.list, 'Aucune échéance prévue dans les 7 prochains jours.');
  } else {
    for (const task of nearTasks) {
      const isToday = task.dueDate === summary.todayIso;
      upcomingSec.list.append(
        createTaskListItem(task, {
          rightBadgeLabel: isToday ? 'Aujourd’hui' : formatShortDateFr(task.dueDate ?? ''),
          rightBadgeClass: isToday ? 'cv-badge cv-badge--warning' : 'cv-badge cv-badge--accent',
          iconName: isToday ? 'ph-sun' : 'ph-clock',
        }),
      );
    }
  }

  // 3. High priority tasks section
  const prioSec = createSectionCard({
    id: 'today-priority-section',
    title: 'Priorités hautes',
    icon: 'ph-flag',
    count: summary.highPriorityTasks.length,
    badgeClass: summary.highPriorityTasks.length > 0 ? 'cv-badge cv-badge--danger' : 'cv-badge',
  });
  if (summary.highPriorityTasks.length === 0) {
    appendEmptyMessage(prioSec.list, 'Aucune tâche ouverte de priorité haute.');
  } else {
    for (const task of summary.highPriorityTasks) {
      const statusMeta = getTaskStatusMeta(task.status, configuredStatuses);
      const dueTxt = task.dueDate ? ` · ${formatShortDateFr(task.dueDate)}` : '';
      prioSec.list.append(
        createTaskListItem(task, {
          rightBadgeLabel: `${statusMeta.label}${dueTxt}`,
          rightBadgeClass: statusMeta.badgeClass,
        }),
      );
    }
  }

  // 4. Recent items section (tasks, notes, whiteboards)
  const recentSec = createSectionCard({
    id: 'today-recent-section',
    title: 'Éléments récents',
    icon: 'ph-clock-counter-clockwise',
    count: summary.recentItems.length,
  });
  if (summary.recentItems.length === 0) {
    appendEmptyMessage(recentSec.list, 'Aucune activité récente enregistrée.');
  } else {
    const kindMeta = {
      task: { label: 'Tâche', icon: 'ph-check-square' },
      note: { label: 'Note', icon: 'ph-notebook' },
      whiteboard: { label: 'Tableau blanc', icon: 'ph-chalkboard-simple' },
    };
    for (const item of summary.recentItems) {
      const li = document.createElement('li');
      li.className = 'lc-today-item';

      /** @param {'view' | 'edit'} mode */
      const triggerOpen = (mode) => {
        if (item.kind === 'task') {
          const found = state.tasks.find((t) => t.id === item.id);
          if (found) onOpenTask(found, mode);
        } else if (item.kind === 'note') {
          const found = state.notes.find((n) => n.id === item.id);
          if (found) onOpenNote(found, mode);
        } else {
          const found = state.whiteboards.find((w) => w.id === item.id);
          if (found) onOpenWhiteboard(found, mode);
        }
      };

      const mainBtn = document.createElement('button');
      mainBtn.type = 'button';
      mainBtn.className = 'lc-today-item__btn';
      mainBtn.addEventListener('click', () => triggerOpen('view'));

      const ic = document.createElement('i');
      ic.className = `ph ${kindMeta[item.kind].icon} cv-icon`;
      ic.setAttribute('aria-hidden', 'true');

      const titleSpan = document.createElement('span');
      titleSpan.className = 'lc-today-item__title';
      titleSpan.textContent = item.title;
      mainBtn.append(ic, titleSpan);

      const side = document.createElement('div');
      side.className = 'lc-today-item__side';
      if (item.projectId) {
        const projName = selectProjectById(state, item.projectId)?.name;
        if (projName) {
          const projTag = document.createElement('span');
          projTag.className = 'cv-tag';
          projTag.textContent = projName;
          side.append(projTag);
        }
      }
      const kindTag = document.createElement('span');
      kindTag.className = 'cv-badge';
      kindTag.textContent = kindMeta[item.kind].label;
      side.append(kindTag);

      if (!state.readOnly) {
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm';
        editBtn.setAttribute('aria-label', `Modifier « ${item.title} »`);
        setTooltip(editBtn, 'Modifier');
        const editIc = document.createElement('i');
        editIc.className = 'ph ph-pencil-simple cv-icon';
        editIc.setAttribute('aria-hidden', 'true');
        editBtn.append(editIc);
        editBtn.addEventListener('click', () => triggerOpen('edit'));
        side.append(editBtn);
      }

      li.append(mainBtn, side);
      recentSec.list.append(li);
    }
  }

  const grid = document.createElement('div');
  grid.className = 'lc-today-grid';
  grid.append(overdueSec.card, upcomingSec.card, prioSec.card, recentSec.card);

  container.replaceChildren(header, statsRow, grid);
}
