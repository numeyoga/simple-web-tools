/** @import { AppCommand, AppState, StoreEffect, TaskDisplayMode } from '../../types.d.ts' */

import { openStatusModal } from './status-modal.js';
import { setTooltip } from './tooltip.js';

/**
 * Render the shared header for Task views (project filter, List/Kanban switch, status config button, New Task CTA).
 * @param {{
 *   state: AppState;
 *   dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *   onOpenNewTask: () => void;
 * }} opts
 * @returns {HTMLElement}
 */
export function createTaskWorkspaceHeader({ state, dispatch, onOpenNewTask }) {
  const header = document.createElement('div');
  header.className = 'lc-view-header';

  const leftGroup = document.createElement('div');
  leftGroup.className = 'lc-view-header__group';

  const projectWrap = document.createElement('div');
  projectWrap.className = 'cv-select';
  const projectSelect = document.createElement('select');
  projectSelect.id = 'task-project-filter';
  projectSelect.className = 'cv-input';
  projectSelect.setAttribute('aria-label', 'Filtrer par projet');

  const allOpt = document.createElement('option');
  allOpt.value = '';
  allOpt.textContent = 'Tous les projets';
  projectSelect.append(allOpt);

  for (const project of state.projects) {
    const opt = document.createElement('option');
    opt.value = project.id;
    opt.textContent = project.archived ? `${project.name} (archivé)` : project.name;
    projectSelect.append(opt);
  }
  projectSelect.value = state.preferences.selectedProjectId ?? '';
  projectSelect.addEventListener('change', () => {
    dispatch({
      type: 'select_project',
      projectId: projectSelect.value ? projectSelect.value : null,
    });
  });
  projectWrap.append(projectSelect);

  // Covenant SegmentedControl (native radios)
  const segFieldset = document.createElement('fieldset');
  segFieldset.className = 'cv-segmented';
  const segLegend = document.createElement('legend');
  segLegend.textContent = 'Mode d’affichage des tâches';
  segFieldset.append(segLegend);

  /** @type {Array<[TaskDisplayMode, string]>} */
  const modes = [
    ['list', 'Liste'],
    ['kanban', 'Kanban'],
  ];
  for (const [modeValue, label] of modes) {
    const lbl = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'task-display-mode';
    radio.value = modeValue;
    radio.checked = state.preferences.taskDisplayMode === modeValue;
    radio.addEventListener('change', () => {
      if (radio.checked) {
        dispatch({ type: 'set_task_display_mode', mode: modeValue });
      }
    });
    const span = document.createElement('span');
    span.textContent = label;
    lbl.append(radio, span);
    segFieldset.append(lbl);
  }

  leftGroup.append(projectWrap, segFieldset);

  const rightGroup = document.createElement('div');
  rightGroup.className = 'lc-view-header__group';

  const statusBtn = document.createElement('button');
  statusBtn.type = 'button';
  statusBtn.className = 'cv-btn';
  statusBtn.id = 'btn-configure-statuses';
  statusBtn.disabled = state.readOnly;
  const statusIcon = document.createElement('i');
  statusIcon.className = 'ph ph-columns cv-icon';
  statusIcon.setAttribute('aria-hidden', 'true');
  statusBtn.append(statusIcon, document.createTextNode(' Statuts'));
  setTooltip(statusBtn, 'Configurer les colonnes du Kanban');
  statusBtn.addEventListener('click', openStatusModal);

  const newBtn = document.createElement('button');
  newBtn.type = 'button';
  newBtn.className = 'cv-btn cv-btn--primary';
  newBtn.id = 'btn-new-task';
  newBtn.disabled = state.readOnly || state.projects.length === 0;
  const icon = document.createElement('i');
  icon.className = 'ph ph-plus cv-icon';
  icon.setAttribute('aria-hidden', 'true');
  newBtn.append(icon, document.createTextNode(' Nouvelle tâche'));
  newBtn.addEventListener('click', onOpenNewTask);

  rightGroup.append(statusBtn, newBtn);
  header.append(leftGroup, rightGroup);
  return header;
}
