/** @import { AppCommand, AppState, StoreEffect, Task, TaskPriority } from '../../types.d.ts' */

import {
  WEEKDAY_SHORT_FR,
  addMonthsClamped,
  buildMonthCalendarGrid,
  buildWeekCalendarGrid,
  formatIsoDate,
  formatMonthYearLabel,
  formatShortDateFr,
  getTodayIsoDate,
  isOffHoursDueTime,
  isOffHoursHour,
  isWeekendWeekdayIndex,
  parseIsoDate,
  parseTimeHhMm,
  shiftIsoDate,
} from '../../core/dates.js';
import { getTaskStatusMeta, isTerminalTaskStatus } from '../../core/model.js';
import { buildTasksIcsCalendar } from '../../core/ical.js';
import { selectProjectById, selectProjects, selectTasks } from '../../core/store.js';
import { saveArchiveBlob } from '../archive-file.js';
import { notify } from './app-shell.js';
import { initTooltips, setTooltip } from './tooltip.js';

/** @type {Readonly<Record<TaskPriority, { label: string; badgeClass: string }>>} */
const PRIORITY_META = {
  high: { label: 'Haute', badgeClass: 'cv-badge cv-badge--danger' },
  medium: { label: 'Moyenne', badgeClass: 'cv-badge cv-badge--warning' },
  low: { label: 'Basse', badgeClass: 'cv-badge cv-badge--info' },
};

/** @type {string | null} */
let draggedTaskId = null;

/**
 * Render the interactive monthly & weekly Calendar view of task due dates
 * with weekend differentiation, 18h–7h off-hours time-band styling,
 * hourly slot scheduling, drag-and-drop, and keyboard rescheduling.
 * @param {{
 *   container: HTMLElement;
 *   store: {
 *     getState: () => AppState;
 *     dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *   };
 *   calendarState: {
 *     mode: 'month' | 'week';
 *     anchorDate: string;
 *     focusTaskId: string | null;
 *   };
 *   onOpenTask: (task: Task, mode?: 'view' | 'edit') => void;
 *   onNewTask: (defaultDueDate?: string | null, defaultDueTime?: string | null) => void;
 *   onOpenNewProject: () => void;
 * }} opts
 */
export function renderCalendarView({
  container,
  store,
  calendarState,
  onOpenTask,
  onNewTask,
  onOpenNewProject,
}) {
  const state = store.getState();
  const readOnly = state.readOnly;
  const activeProjects = selectProjects(state);

  if (activeProjects.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'cv-empty';
    const iconBox = document.createElement('span');
    iconBox.className = 'cv-empty__icon';
    const icon = document.createElement('i');
    icon.className = 'ph ph-calendar-blank cv-icon';
    icon.setAttribute('aria-hidden', 'true');
    iconBox.append(icon);
    const title = document.createElement('p');
    title.className = 'cv-empty__title';
    title.textContent =
      state.projects.length === 0
        ? 'Créez un premier projet pour planifier vos échéances'
        : 'Tous vos projets sont archivés';
    const desc = document.createElement('p');
    desc.textContent =
      state.projects.length === 0
        ? 'Les tâches datées apparaîtront ici en vue mensuelle ou hebdomadaire avec report par glisser-déposer et clavier.'
        : 'Désarchivez un projet depuis les archives ou créez un nouveau projet actif pour afficher son agenda.';
    const actionsRow = document.createElement('div');
    actionsRow.className = 'lc-view-header__group';
    if (state.projects.length > 0) {
      const archBtn = document.createElement('button');
      archBtn.type = 'button';
      archBtn.className = 'cv-btn';
      archBtn.textContent = 'Ouvrir les archives';
      archBtn.addEventListener('click', () => {
        store.dispatch({ type: 'set_view', view: 'archives' });
      });
      actionsRow.append(archBtn);
    }
    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'cv-btn cv-btn--primary';
    cta.disabled = readOnly;
    cta.textContent = 'Créer un projet';
    cta.addEventListener('click', onOpenNewProject);
    actionsRow.append(cta);
    empty.append(iconBox, title, desc, actionsRow);
    container.replaceChildren(empty);
    return;
  }

  const todayIso = getTodayIsoDate();
  if (!parseIsoDate(calendarState.anchorDate)) {
    calendarState.anchorDate = todayIso;
  }
  const anchorParts = parseIsoDate(calendarState.anchorDate) ?? {
    year: 2026,
    month: 11,
    day: 15,
  };

  // Top header bar
  const header = document.createElement('div');
  header.className = 'lc-view-header';

  const leftGroup = document.createElement('div');
  leftGroup.className = 'lc-view-header__group';

  const projSelectWrap = document.createElement('div');
  projSelectWrap.className = 'cv-select';
  const projSelect = document.createElement('select');
  projSelect.id = 'calendar-project-filter';
  projSelect.className = 'cv-input';
  projSelect.setAttribute('aria-label', 'Filtrer le calendrier par projet');

  const allOpt = document.createElement('option');
  allOpt.value = '__all__';
  allOpt.textContent = 'Tous les projets';
  projSelect.append(allOpt);
  for (const proj of activeProjects) {
    const opt = document.createElement('option');
    opt.value = proj.id;
    opt.textContent = proj.name;
    projSelect.append(opt);
  }
  const selectedActiveProjectId =
    state.preferences.selectedProjectId &&
    activeProjects.some((p) => p.id === state.preferences.selectedProjectId)
      ? state.preferences.selectedProjectId
      : '__all__';
  projSelect.value = selectedActiveProjectId;
  projSelect.addEventListener('change', () => {
    store.dispatch({
      type: 'select_project',
      projectId: projSelect.value === '__all__' ? null : projSelect.value,
    });
  });
  projSelectWrap.append(projSelect);

  const modeGroup = document.createElement('fieldset');
  modeGroup.className = 'cv-segmented';
  modeGroup.setAttribute('aria-label', 'Période du calendrier');
  const modeLegend = document.createElement('legend');
  modeLegend.textContent = 'Période du calendrier';

  const monthRadioLabel = document.createElement('label');
  const monthRadio = document.createElement('input');
  monthRadio.type = 'radio';
  monthRadio.name = 'calendar-view-mode';
  monthRadio.value = 'month';
  monthRadio.checked = calendarState.mode === 'month';
  const monthSpan = document.createElement('span');
  monthSpan.textContent = 'Mois';
  monthRadioLabel.append(monthRadio, monthSpan);

  const weekRadioLabel = document.createElement('label');
  const weekRadio = document.createElement('input');
  weekRadio.type = 'radio';
  weekRadio.name = 'calendar-view-mode';
  weekRadio.value = 'week';
  weekRadio.checked = calendarState.mode === 'week';
  const weekSpan = document.createElement('span');
  weekSpan.textContent = 'Semaine';
  weekRadioLabel.append(weekRadio, weekSpan);

  modeGroup.append(modeLegend, monthRadioLabel, weekRadioLabel);
  modeGroup.addEventListener('change', (event) => {
    const target = event.target;
    if (
      target instanceof HTMLInputElement &&
      (target.value === 'month' || target.value === 'week')
    ) {
      calendarState.mode = target.value;
      renderCalendarView({
        container,
        store,
        calendarState,
        onOpenTask,
        onNewTask,
        onOpenNewProject,
      });
    }
  });

  leftGroup.append(projSelectWrap, modeGroup);

  const rightGroup = document.createElement('div');
  rightGroup.className = 'lc-view-header__group';

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.id = 'btn-cal-prev';
  prevBtn.className = 'cv-btn cv-btn--sm';
  prevBtn.setAttribute(
    'aria-label',
    calendarState.mode === 'month' ? 'Mois précédent' : 'Semaine précédente',
  );
  const prevIc = document.createElement('i');
  prevIc.className = 'ph ph-caret-left cv-icon';
  prevIc.setAttribute('aria-hidden', 'true');
  prevBtn.append(prevIc, document.createTextNode(' Précédent'));

  const todayBtn = document.createElement('button');
  todayBtn.type = 'button';
  todayBtn.id = 'btn-cal-today';
  todayBtn.className = 'cv-btn cv-btn--sm';
  todayBtn.textContent = 'Aujourd’hui';

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.id = 'btn-cal-next';
  nextBtn.className = 'cv-btn cv-btn--sm';
  nextBtn.setAttribute(
    'aria-label',
    calendarState.mode === 'month' ? 'Mois suivant' : 'Semaine suivante',
  );
  const nextIc = document.createElement('i');
  nextIc.className = 'ph ph-caret-right cv-icon';
  nextIc.setAttribute('aria-hidden', 'true');
  nextBtn.append(document.createTextNode('Suivant '), nextIc);

  const exportIcsBtn = document.createElement('button');
  exportIcsBtn.type = 'button';
  exportIcsBtn.id = 'btn-cal-export-ics';
  exportIcsBtn.className = 'cv-btn cv-btn--sm';
  exportIcsBtn.setAttribute('aria-label', 'Exporter les tâches datées au format iCalendar (.ics)');
  const exportIc = document.createElement('i');
  exportIc.className = 'ph ph-download-simple cv-icon';
  exportIc.setAttribute('aria-hidden', 'true');
  exportIcsBtn.append(exportIc, document.createTextNode(' Exporter (.ics)'));

  const newTaskBtn = document.createElement('button');
  newTaskBtn.type = 'button';
  newTaskBtn.id = 'btn-cal-new-task';
  newTaskBtn.className = 'cv-btn cv-btn--primary';
  newTaskBtn.disabled = readOnly;
  const plusIc = document.createElement('i');
  plusIc.className = 'ph ph-plus cv-icon';
  plusIc.setAttribute('aria-hidden', 'true');
  newTaskBtn.append(plusIc, document.createTextNode(' Nouvelle tâche'));
  newTaskBtn.addEventListener('click', () => onNewTask(calendarState.anchorDate, null));

  rightGroup.append(prevBtn, todayBtn, nextBtn, exportIcsBtn, newTaskBtn);
  header.append(leftGroup, rightGroup);

  const rerenderSelf = () => {
    renderCalendarView({
      container,
      store,
      calendarState,
      onOpenTask,
      onNewTask,
      onOpenNewProject,
    });
  };

  prevBtn.addEventListener('click', () => {
    calendarState.anchorDate =
      calendarState.mode === 'month'
        ? addMonthsClamped(formatIsoDate(anchorParts.year, anchorParts.month, 1), -1)
        : shiftIsoDate(calendarState.anchorDate, -7);
    rerenderSelf();
  });

  nextBtn.addEventListener('click', () => {
    calendarState.anchorDate =
      calendarState.mode === 'month'
        ? addMonthsClamped(formatIsoDate(anchorParts.year, anchorParts.month, 1), 1)
        : shiftIsoDate(calendarState.anchorDate, 7);
    rerenderSelf();
  });

  todayBtn.addEventListener('click', () => {
    calendarState.anchorDate = todayIso;
    rerenderSelf();
  });

  // Period title + keyboard hint + legend + live status region
  const subBar = document.createElement('div');
  subBar.className = 'lc-cal-subbar';

  const periodHeading = document.createElement('h2');
  periodHeading.id = 'cal-period-label';
  periodHeading.className = 'cv-h3';
  periodHeading.style.margin = '0';

  const weekCells = buildWeekCalendarGrid(calendarState.anchorDate);
  const monthCells = buildMonthCalendarGrid(anchorParts.year, anchorParts.month);
  if (calendarState.mode === 'month') {
    periodHeading.textContent = formatMonthYearLabel(anchorParts.year, anchorParts.month);
  } else {
    const first = weekCells[0];
    const last = weekCells[weekCells.length - 1];
    periodHeading.textContent =
      first && last
        ? `Semaine du ${formatShortDateFr(first.date)} au ${formatShortDateFr(last.date, true)}`
        : 'Semaine';
  }

  const helpText = document.createElement('p');
  helpText.className = 'cv-caption';
  helpText.style.margin = '0';
  helpText.textContent =
    calendarState.mode === 'week'
      ? 'Glissez une tâche sur un créneau horaire ou un jour, ou utilisez Alt/Maj + Flèches ou −1 j / +1 j.'
      : 'Glissez une tâche sur un jour, ou utilisez Alt/Maj + Flèches ou les boutons −1 j / +1 j pour reporter l’échéance.';

  const liveRegion = document.createElement('div');
  liveRegion.id = 'calendar-live-status';
  liveRegion.className = 'lc-sr-only';
  liveRegion.setAttribute('aria-live', 'polite');

  subBar.append(periodHeading, helpText, liveRegion);

  // Legend differentiating Weekends (Sam/Dim) from Off-hours (18h-7h)
  const legendBar = document.createElement('div');
  legendBar.className = 'lc-cal-legend';
  legendBar.setAttribute('aria-label', 'Légende de l’agenda');

  const weekendLegend = document.createElement('span');
  weekendLegend.className = 'lc-cal-legend__item lc-cal-legend__item--weekend';
  const weekendSwatch = document.createElement('span');
  weekendSwatch.className = 'lc-cal-legend__swatch lc-cal-legend__swatch--weekend';
  weekendSwatch.setAttribute('aria-hidden', 'true');
  weekendLegend.append(weekendSwatch, document.createTextNode('Samedi & dimanche (week-end)'));

  const offHoursLegend = document.createElement('span');
  offHoursLegend.className = 'lc-cal-legend__item lc-cal-legend__item--offhours';
  const offHoursSwatch = document.createElement('span');
  offHoursSwatch.className = 'lc-cal-legend__swatch lc-cal-legend__swatch--offhours';
  offHoursSwatch.setAttribute('aria-hidden', 'true');
  const legendMoon = document.createElement('i');
  legendMoon.className = 'ph ph-moon cv-icon';
  legendMoon.setAttribute('aria-hidden', 'true');
  offHoursLegend.append(
    offHoursSwatch,
    legendMoon,
    document.createTextNode('Créneau 18h–7h (soir et nuit)'),
  );

  legendBar.append(weekendLegend, offHoursLegend);

  // Prepare filtered active tasks grouped by dueDate (and sorted by dueTime)
  const effectiveProjectFilter =
    selectedActiveProjectId === '__all__' ? null : selectedActiveProjectId;
  const allTasks = selectTasks(state, {
    projectId: effectiveProjectFilter,
    sortBy: 'dueDate',
  });
  /** @type {Map<string, Task[]>} */
  const tasksByDate = new Map();
  /** @type {Task[]} */
  const undatedTasks = [];

  for (const task of allTasks) {
    if (!task.dueDate) {
      undatedTasks.push(task);
    } else {
      const bucket = tasksByDate.get(task.dueDate) ?? [];
      bucket.push(task);
      tasksByDate.set(task.dueDate, bucket);
    }
  }

  exportIcsBtn.addEventListener('click', async () => {
    const selectedProj = effectiveProjectFilter
      ? selectProjectById(state, effectiveProjectFilter)
      : null;
    const calName = selectedProj ? `Locavern — ${selectedProj.name}` : 'Locavern — Échéances';
    const { icsContent, exportedCount } = buildTasksIcsCalendar(allTasks, state.projects, {
      calName,
      statuses: state.preferences.taskStatuses,
    });
    if (exportedCount === 0) {
      liveRegion.textContent = 'Aucune tâche datée à exporter.';
      notify({
        status: 'info',
        title: 'Aucune tâche datée',
        text: 'Ajoutez une date d’échéance à au moins une tâche pour exporter un fichier .ics.',
      });
      return;
    }

    const filenameSlug = selectedProj
      ? selectedProj.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'projet'
      : 'echeances';
    const filename = `locavern-${filenameSlug}-${todayIso}.ics`;
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    try {
      const saved = await saveArchiveBlob(blob, filename, {
        pickerTypes: [
          {
            description: 'Calendrier iCalendar (.ics)',
            accept: { 'text/calendar': ['.ics'] },
          },
        ],
      });
      if (!saved.saved) return;
      liveRegion.textContent = `${exportedCount} tâche(s) datée(s) exportée(s) dans ${filename}.`;
      notify({
        status: 'success',
        title: 'Export iCalendar terminé',
        text: `${exportedCount} tâche(s) datée(s) exportée(s).`,
      });
    } catch {
      notify({
        status: 'danger',
        title: 'Échec de l’export .ics',
        text: 'Impossible d’enregistrer le fichier calendrier localement.',
      });
    }
  });

  const configuredStatuses = state.preferences.taskStatuses;
  const multiProjectMode = effectiveProjectFilter === null;

  /**
   * Move `taskId` to `targetDate` (YYYY-MM-DD), optionally updating `dueTime`.
   * @param {string} taskId
   * @param {string} targetDate
   * @param {{ dueTime?: string | null; restoreFocus?: boolean }} [opts]
   */
  function moveTaskToSchedule(taskId, targetDate, opts = {}) {
    if (readOnly) return;
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const hasExplicitTime = Object.prototype.hasOwnProperty.call(opts, 'dueTime');
    const nextDueTime = hasExplicitTime ? (opts.dueTime ?? null) : (task.dueTime ?? null);
    if (task.dueDate === targetDate && (task.dueTime ?? null) === nextDueTime) {
      return;
    }
    if (opts.restoreFocus) {
      calendarState.focusTaskId = taskId;
      calendarState.anchorDate = targetDate;
    }
    /** @type {{ dueDate: string; dueTime?: string | null }} */
    const patch = { dueDate: targetDate };
    if (hasExplicitTime) {
      patch.dueTime = nextDueTime;
    }
    store.dispatch({
      type: 'update_task',
      id: taskId,
      patch,
      now: new Date().toISOString(),
    });
    const timeNote = nextDueTime ? ` à ${nextDueTime}` : '';
    liveRegion.textContent = `Échéance de « ${task.title} » déplacée au ${formatShortDateFr(targetDate, true)}${timeNote}.`;
  }

  /**
   * Create a task card element inside a calendar cell or hourly slot.
   * @param {Task} task
   * @param {boolean} detailed
   * @returns {HTMLElement}
   */
  function createTaskCard(task, detailed) {
    const terminal = isTerminalTaskStatus(task.status, configuredStatuses);
    const offHours = isOffHoursDueTime(task.dueTime);

    const item = document.createElement('div');
    item.className = `lc-cal-task lc-cal-task--${task.priority}`;
    if (terminal) {
      item.classList.add('is-terminal');
      item.dataset.taskTerminal = 'true';
    }
    if (offHours) {
      item.classList.add('is-offhours');
      item.dataset.calOffhours = 'true';
    }
    item.setAttribute('data-cal-task-id', task.id);

    if (!readOnly) {
      item.draggable = true;
      item.addEventListener('dragstart', (event) => {
        draggedTaskId = task.id;
        item.classList.add('is-dragging');
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', task.id);
        }
      });
      item.addEventListener('dragend', () => {
        draggedTaskId = null;
        item.classList.remove('is-dragging');
        container
          .querySelectorAll('.is-drop-target')
          .forEach((el) => el.classList.remove('is-drop-target'));
      });
    }

    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'lc-cal-task__btn';
    openBtn.setAttribute('data-cal-task-open', task.id);

    const statusMeta = getTaskStatusMeta(task.status, configuredStatuses);
    const prioMeta = PRIORITY_META[task.priority];
    openBtn.setAttribute(
      'aria-label',
      `Consulter ${task.title} · Priorité ${prioMeta.label} · ${statusMeta.label}${task.dueDate ? ` · ${task.dueDate}` : ''}${task.dueTime ? ` à ${task.dueTime}` : ''}${offHours ? ' (créneau 18h–7h)' : ''}`,
    );

    if (task.dueTime) {
      const timeRow = document.createElement('span');
      timeRow.className = 'lc-cal-task__time-row';
      const timeBadge = document.createElement('span');
      timeBadge.className = 'lc-cal-task__time cv-num';
      timeBadge.textContent = task.dueTime;
      timeRow.append(timeBadge);

      if (offHours) {
        const offPill = document.createElement('span');
        offPill.className = 'cv-badge lc-offhours-pill';
        const mIc = document.createElement('i');
        mIc.className = 'ph ph-moon cv-icon';
        mIc.setAttribute('aria-hidden', 'true');
        offPill.append(mIc, document.createTextNode(' 18h–7h'));
        timeRow.append(offPill);
      }
      openBtn.append(timeRow);
    }

    const titleEl = document.createElement('span');
    titleEl.className = 'lc-cal-task__title';
    titleEl.textContent = task.title;
    openBtn.append(titleEl);

    if (detailed) {
      const metaEl = document.createElement('span');
      metaEl.className = 'lc-cal-task__meta';
      const projName = multiProjectMode ? selectProjectById(state, task.projectId)?.name : null;
      metaEl.textContent = projName ? `${statusMeta.label} · ${projName}` : statusMeta.label;
      openBtn.append(metaEl);
    }

    openBtn.addEventListener('click', () => onOpenTask(task, 'view'));
    openBtn.addEventListener('keydown', (event) => {
      if (readOnly || !task.dueDate) return;
      if (!event.altKey && !event.shiftKey) return;
      let delta = 0;
      if (event.key === 'ArrowLeft') delta = -1;
      else if (event.key === 'ArrowRight') delta = 1;
      else if (event.key === 'ArrowUp') delta = -7;
      else if (event.key === 'ArrowDown') delta = 7;
      if (delta !== 0) {
        event.preventDefault();
        moveTaskToSchedule(task.id, shiftIsoDate(task.dueDate, delta), { restoreFocus: true });
      }
    });

    item.append(openBtn);

    if (!readOnly) {
      const actionsGroup = document.createElement('div');
      actionsGroup.className = 'lc-cal-task__actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm lc-cal-edit-btn';
      editBtn.setAttribute('aria-label', `Modifier « ${task.title} »`);
      setTooltip(editBtn, 'Modifier');
      const editIc = document.createElement('i');
      editIc.className = 'ph ph-pencil-simple cv-icon';
      editIc.setAttribute('aria-hidden', 'true');
      editBtn.append(editIc);
      editBtn.addEventListener('click', () => onOpenTask(task, 'edit'));
      actionsGroup.append(editBtn);

      if (task.dueDate) {
        const dueDate = task.dueDate;
        const minusBtn = document.createElement('button');
        minusBtn.type = 'button';
        minusBtn.className = 'cv-btn cv-btn--ghost cv-btn--sm lc-cal-shift-btn';
        minusBtn.setAttribute('aria-label', `Avancer « ${task.title} » d’un jour`);
        minusBtn.textContent = '−1 j';
        setTooltip(minusBtn, 'Avancer d’un jour');
        minusBtn.addEventListener('click', () =>
          moveTaskToSchedule(task.id, shiftIsoDate(dueDate, -1)),
        );

        const plusBtn = document.createElement('button');
        plusBtn.type = 'button';
        plusBtn.className = 'cv-btn cv-btn--ghost cv-btn--sm lc-cal-shift-btn';
        plusBtn.setAttribute('aria-label', `Reporter « ${task.title} » d’un jour`);
        plusBtn.textContent = '+1 j';
        setTooltip(plusBtn, 'Reporter d’un jour');
        plusBtn.addEventListener('click', () =>
          moveTaskToSchedule(task.id, shiftIsoDate(dueDate, 1)),
        );

        actionsGroup.append(minusBtn, plusBtn);
      }

      item.append(actionsGroup);
    }

    return item;
  }

  /**
   * Wire drag-and-drop listeners onto a drop container (cell, all-day box, or hourly slot).
   * @param {HTMLElement} targetEl
   * @param {(taskId: string) => void} onDropTask
   * @param {boolean} [stopProp]
   */
  function wireDropTarget(targetEl, onDropTask, stopProp = false) {
    if (readOnly) return;
    targetEl.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (stopProp) event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      targetEl.classList.add('is-drop-target');
    });
    targetEl.addEventListener('dragleave', (event) => {
      if (!targetEl.contains(/** @type {Node | null} */ (event.relatedTarget))) {
        targetEl.classList.remove('is-drop-target');
      }
    });
    targetEl.addEventListener('drop', (event) => {
      event.preventDefault();
      if (stopProp) event.stopPropagation();
      targetEl.classList.remove('is-drop-target');
      const id = event.dataTransfer?.getData('text/plain') || draggedTaskId;
      draggedTaskId = null;
      if (id) {
        onDropTask(id);
      }
    });
  }

  // Weekday header strip (visible in 7-column layout)
  const gridWrapper = document.createElement('div');
  gridWrapper.className = 'lc-cal-wrap';

  const weekdayRow = document.createElement('div');
  weekdayRow.className = 'lc-cal-weekdays';
  weekdayRow.setAttribute('aria-hidden', 'true');
  WEEKDAY_SHORT_FR.forEach((label, idx) => {
    const wd = document.createElement('div');
    wd.className = 'lc-cal-weekday';
    if (isWeekendWeekdayIndex(idx)) {
      wd.classList.add('is-weekend');
      wd.dataset.calWeekend = 'true';
    }
    wd.textContent = label;
    weekdayRow.append(wd);
  });

  const grid = document.createElement('div');
  grid.className =
    calendarState.mode === 'month'
      ? 'lc-cal-grid lc-cal-grid--month'
      : 'lc-cal-grid lc-cal-grid--week';
  grid.setAttribute('role', 'region');
  grid.setAttribute('aria-label', periodHeading.textContent);

  const cells = calendarState.mode === 'month' ? monthCells : weekCells;

  for (const cellInfo of cells) {
    const cell = document.createElement('section');
    cell.className = 'lc-cal-cell';
    cell.setAttribute('data-cal-date', cellInfo.date);
    const isWeekend = Boolean(cellInfo.isWeekend);
    if (isWeekend) {
      cell.classList.add('is-weekend');
      cell.dataset.calWeekend = 'true';
    }
    const dayAriaLabel = isWeekend
      ? `${formatShortDateFr(cellInfo.date, true)} (Week-end)`
      : formatShortDateFr(cellInfo.date, true);
    cell.setAttribute('aria-label', dayAriaLabel);

    if (
      calendarState.mode === 'month' &&
      'inCurrentMonth' in cellInfo &&
      !cellInfo.inCurrentMonth
    ) {
      cell.classList.add('is-outside-month');
    }
    if (cellInfo.date === todayIso) {
      cell.classList.add('is-today');
    }

    wireDropTarget(cell, (id) => moveTaskToSchedule(id, cellInfo.date));

    const cellHead = document.createElement('div');
    cellHead.className = 'lc-cal-cell__head';

    const dayNum = document.createElement('span');
    dayNum.className = 'lc-cal-cell__day';
    dayNum.textContent =
      calendarState.mode === 'week'
        ? `${WEEKDAY_SHORT_FR[cellInfo.weekdayIndex]} ${formatShortDateFr(cellInfo.date)}`
        : `${WEEKDAY_SHORT_FR[cellInfo.weekdayIndex]} ${cellInfo.day}`;

    cellHead.append(dayNum);

    if (isWeekend) {
      const weekendTag = document.createElement('span');
      weekendTag.className = 'cv-badge lc-cal-weekend-tag';
      weekendTag.textContent = 'Week-end';
      cellHead.append(weekendTag);
    }

    if (cellInfo.date === todayIso) {
      const todayBadge = document.createElement('span');
      todayBadge.className = 'cv-badge cv-badge--info';
      todayBadge.textContent = 'Auj.';
      cellHead.append(todayBadge);
    }

    if (!readOnly) {
      const addDayBtn = document.createElement('button');
      addDayBtn.type = 'button';
      addDayBtn.className = 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm lc-cal-cell__add';
      const addDayLabel = `Ajouter une tâche le ${formatShortDateFr(cellInfo.date, true)}`;
      addDayBtn.setAttribute('aria-label', addDayLabel);
      setTooltip(addDayBtn, addDayLabel);
      const addIc = document.createElement('i');
      addIc.className = 'ph ph-plus cv-icon';
      addIc.setAttribute('aria-hidden', 'true');
      addDayBtn.append(addIc);
      addDayBtn.addEventListener('click', () => onNewTask(cellInfo.date, null));
      cellHead.append(addDayBtn);
    }

    const dayTasks = tasksByDate.get(cellInfo.date) ?? [];

    if (calendarState.mode === 'month') {
      const cellList = document.createElement('div');
      cellList.className = 'lc-cal-cell__tasks';
      for (const task of dayTasks) {
        cellList.append(createTaskCard(task, false));
      }
      cell.append(cellHead, cellList);
    } else {
      // Week view: All-day / untimed section + 24h hourly schedule highlighting 18h–7h
      /** @type {Task[]} */
      const alldayTasks = [];
      /** @type {Map<number, Task[]>} */
      const tasksByHour = new Map();
      for (const task of dayTasks) {
        const parsedTime = parseTimeHhMm(task.dueTime);
        if (!parsedTime) {
          alldayTasks.push(task);
        } else {
          const list = tasksByHour.get(parsedTime.hour) ?? [];
          list.push(task);
          tasksByHour.set(parsedTime.hour, list);
        }
      }

      const alldayBox = document.createElement('div');
      alldayBox.className = 'lc-cal-allday';
      alldayBox.dataset.calAllday = 'true';
      wireDropTarget(
        alldayBox,
        (id) => moveTaskToSchedule(id, cellInfo.date, { dueTime: null }),
        true,
      );

      const alldayHead = document.createElement('div');
      alldayHead.className = 'lc-cal-allday__head';
      alldayHead.textContent = 'Sans heure';
      const alldayList = document.createElement('div');
      alldayList.className = 'lc-cal-cell__tasks';
      for (const t of alldayTasks) {
        alldayList.append(createTaskCard(t, true));
      }
      alldayBox.append(alldayHead, alldayList);

      const slotsWrap = document.createElement('div');
      slotsWrap.className = 'lc-cal-slots';

      for (let hour = 0; hour < 24; hour += 1) {
        const hh = String(hour).padStart(2, '0');
        const slotTime = `${hh}:00`;
        const offHours = isOffHoursHour(hour);

        const slot = document.createElement('div');
        slot.className = offHours
          ? 'lc-cal-slot lc-cal-slot--offhours'
          : 'lc-cal-slot lc-cal-slot--daytime';
        if (hour === 7 || hour === 18) {
          slot.classList.add('lc-cal-slot--boundary');
        }
        slot.dataset.calHour = hh;
        slot.dataset.calOffhours = offHours ? 'true' : 'false';

        wireDropTarget(
          slot,
          (id) => moveTaskToSchedule(id, cellInfo.date, { dueTime: slotTime }),
          true,
        );

        const slotHead = document.createElement('div');
        slotHead.className = 'lc-cal-slot__head';

        const hourLabel = document.createElement('span');
        hourLabel.className = 'lc-cal-slot__hour cv-num';
        hourLabel.textContent = slotTime;
        slotHead.append(hourLabel);

        if (offHours && (hour === 0 || hour === 18)) {
          const bandTag = document.createElement('span');
          bandTag.className = 'cv-badge lc-offhours-pill';
          const moonIc = document.createElement('i');
          moonIc.className = 'ph ph-moon cv-icon';
          moonIc.setAttribute('aria-hidden', 'true');
          bandTag.append(moonIc, document.createTextNode(' 18h–7h'));
          slotHead.append(bandTag);
        }

        if (!readOnly) {
          const addSlotBtn = document.createElement('button');
          addSlotBtn.type = 'button';
          addSlotBtn.className = 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm lc-cal-slot__add';
          const slotLabel = offHours
            ? `Ajouter une tâche le ${formatShortDateFr(cellInfo.date, true)} à ${slotTime} (créneau 18h–7h)`
            : `Ajouter une tâche le ${formatShortDateFr(cellInfo.date, true)} à ${slotTime}`;
          addSlotBtn.setAttribute('aria-label', slotLabel);
          setTooltip(addSlotBtn, `Planifier à ${slotTime}`);
          const addIc = document.createElement('i');
          addIc.className = 'ph ph-plus cv-icon';
          addIc.setAttribute('aria-hidden', 'true');
          addSlotBtn.append(addIc);
          addSlotBtn.addEventListener('click', () => onNewTask(cellInfo.date, slotTime));
          slotHead.append(addSlotBtn);
        }

        const slotTasks = tasksByHour.get(hour) ?? [];
        const slotList = document.createElement('div');
        slotList.className = 'lc-cal-slot__tasks';
        for (const t of slotTasks) {
          slotList.append(createTaskCard(t, true));
        }

        slot.append(slotHead, slotList);
        slotsWrap.append(slot);
      }

      cell.append(cellHead, alldayBox, slotsWrap);
    }

    grid.append(cell);
  }

  gridWrapper.append(weekdayRow, grid);

  // Undated backlog panel below so users can schedule undated tasks
  const undatedSection = document.createElement('section');
  undatedSection.className = 'cv-card lc-cal-undated';
  undatedSection.setAttribute('aria-label', 'Tâches sans échéance');

  const undatedHead = document.createElement('div');
  undatedHead.className = 'lc-view-header';
  const undatedTitle = document.createElement('h3');
  undatedTitle.className = 'cv-h4';
  undatedTitle.style.margin = '0';
  undatedTitle.textContent = `Sans échéance (${undatedTasks.length})`;
  undatedHead.append(undatedTitle);

  const undatedList = document.createElement('div');
  undatedList.className = 'lc-cal-undated__list';
  if (undatedTasks.length === 0) {
    const emptyUndated = document.createElement('p');
    emptyUndated.className = 'cv-caption';
    emptyUndated.style.margin = '0';
    emptyUndated.textContent = 'Toutes les tâches affichées ont une date d’échéance.';
    undatedList.append(emptyUndated);
  } else {
    for (const task of undatedTasks) {
      const chip = document.createElement('div');
      chip.className = 'lc-cal-undated__item';
      if (!readOnly) {
        chip.draggable = true;
        chip.addEventListener('dragstart', (event) => {
          draggedTaskId = task.id;
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', task.id);
          }
        });
      }
      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'cv-btn cv-btn--sm';
      openBtn.textContent = task.title;
      openBtn.addEventListener('click', () => onOpenTask(task, 'view'));
      chip.append(openBtn);

      if (!readOnly) {
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

        const planTodayBtn = document.createElement('button');
        planTodayBtn.type = 'button';
        planTodayBtn.className = 'cv-btn cv-btn--ghost cv-btn--sm';
        planTodayBtn.setAttribute('aria-label', `Planifier « ${task.title} » aujourd’hui`);
        planTodayBtn.textContent = 'Planifier aujourd’hui';
        planTodayBtn.addEventListener('click', () => moveTaskToSchedule(task.id, todayIso));
        chip.append(editBtn, planTodayBtn);
      }

      undatedList.append(chip);
    }
  }
  undatedSection.append(undatedHead, undatedList);

  container.replaceChildren(header, subBar, legendBar, gridWrapper, undatedSection);
  initTooltips(container);

  // Restore focus after keyboard rescheduling
  if (calendarState.focusTaskId) {
    const targetId = calendarState.focusTaskId;
    calendarState.focusTaskId = null;
    const focusTarget = /** @type {HTMLElement | null} */ (
      container.querySelector(`[data-cal-task-open="${CSS.escape(targetId)}"]`)
    );
    focusTarget?.focus();
  }
}
