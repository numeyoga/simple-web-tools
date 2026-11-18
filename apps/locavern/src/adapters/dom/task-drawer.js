/** @import { AppCommand, AppState, ChecklistItem, LocalRef, RichTextDoc, StoreEffect, Task, TaskPriority, TaskRecurrence, TaskStatus } from '../../types.d.ts' */

import { formatShortDateFr, isOffHoursDueTime } from '../../core/dates.js';
import {
  EMPTY_RICH_DOC,
  TASK_RECURRENCES,
  collectDocAssetIds,
  getDefaultInitialTaskStatusId,
  getTaskRecurrenceLabel,
  getTaskStatusMeta,
  getTaskStatusRole,
  isTerminalTaskStatus,
  normalizeDueTime,
  normalizeTaskRecurrence,
} from '../../core/model.js';
import { extractRichTextPlainText } from '../../core/search.js';
import {
  selectAllTags,
  selectOrphanedAssetIds,
  selectProjectById,
  selectProjects,
  selectTemplates,
} from '../../core/store.js';
import { instantiateChecklistTemplate } from '../../core/templates.js';
import { createTemplatePicker } from './template-picker.js';
import { mountRichTextEditor } from '../rich-text-tiptap.js';
import { createLinkEditor } from './link-editor.js';
import { createTagEditor } from './tag-editor.js';
import { initTooltips, setTooltip } from './tooltip.js';
import {
  applyDialogPresentation,
  closeDialogById,
  confirmAction,
  notify,
  openDialogById,
} from './app-shell.js';

/** @type {Readonly<Record<TaskPriority, { label: string; badgeClass: string }>>} */
const PRIORITY_META = {
  low: { label: 'Basse', badgeClass: 'cv-badge' },
  medium: { label: 'Moyenne', badgeClass: 'cv-badge cv-badge--warning' },
  high: { label: 'Haute', badgeClass: 'cv-badge cv-badge--danger' },
};

/** @type {(() => void) | null} */
let activeTaskCleanup = null;

/**
 * Check whether a rich text document has meaningful visible text or local images.
 * @param {RichTextDoc} doc
 * @returns {boolean}
 */
function hasRichTextContent(doc) {
  return extractRichTextPlainText(doc).length > 0 || collectDocAssetIds(doc).length > 0;
}

/**
 * Open the Covenant dialog (drawer or modal per user preference) to consult, create, or edit a task.
 * @param {{
 *   store: {
 *     getState: () => AppState;
 *     dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *   };
 *   task?: Task;
 *   mode?: 'view' | 'edit';
 *   defaultProjectId?: string | null;
 *   defaultStatus?: TaskStatus | null;
 *   defaultDueDate?: string | null;
 *   defaultDueTime?: string | null;
 *   resolveAssetUrl: (assetId: string) => Promise<string | null>;
 *   uploadLocalImage: (file: File) => Promise<{ assetId: string; alt: string } | null>;
 *   onNavigateLocalRef?: (ref: LocalRef) => void;
 * }} opts
 */
export function openTaskDrawer(opts) {
  const {
    store,
    task,
    mode,
    defaultProjectId = null,
    defaultStatus,
    defaultDueDate = null,
    defaultDueTime = null,
    resolveAssetUrl,
    uploadLocalImage,
    onNavigateLocalRef,
  } = opts;

  const drawer = /** @type {HTMLDialogElement | null} */ (document.getElementById('drawer-task'));
  const titleEl = document.getElementById('drawer-task-title');
  const bodyEl = document.getElementById('drawer-task-body');
  const footerEl = document.getElementById('drawer-task-footer');
  if (!drawer || !titleEl || !bodyEl || !footerEl) return;

  activeTaskCleanup?.();
  activeTaskCleanup = null;

  const state = store.getState();
  applyDialogPresentation(drawer, state.preferences.inputPresentations.tasks);
  const isEdit = Boolean(task);
  const readOnly = state.readOnly;
  const effectiveMode = !isEdit ? 'edit' : readOnly ? 'view' : (mode ?? 'view');

  if (effectiveMode === 'view' && task) {
    titleEl.textContent = 'Consulter la tâche';

    const panel = document.createElement('div');
    panel.id = 'task-consult-view';
    panel.className = 'lc-consult-panel';

    const configuredStatuses = state.preferences.taskStatuses;
    const statusMeta = getTaskStatusMeta(task.status, configuredStatuses);
    const statusRole = getTaskStatusRole(task.status, configuredStatuses);
    const prioInfo = PRIORITY_META[task.priority];

    const headRow = document.createElement('div');
    headRow.className = 'lc-consult-head';

    const titleHeading = document.createElement('h3');
    titleHeading.className = 'lc-consult-title';
    titleHeading.textContent = task.title;

    const badgesRow = document.createElement('div');
    badgesRow.className = 'lc-archive-inline-badges';

    const statusBadge = document.createElement('span');
    statusBadge.className = statusMeta.badgeClass;
    statusBadge.textContent = statusMeta.label;
    badgesRow.append(statusBadge);

    if (statusRole === 'initial' || statusRole === 'terminal') {
      const roleBadge = document.createElement('span');
      roleBadge.className =
        statusRole === 'terminal' ? 'cv-badge cv-badge--success' : 'cv-badge cv-badge--accent';
      roleBadge.dataset.statusRole = statusRole;
      roleBadge.textContent = statusRole === 'terminal' ? 'Terminal' : 'Initial';
      badgesRow.append(roleBadge);
    }

    const prioBadge = document.createElement('span');
    prioBadge.className = prioInfo.badgeClass;
    prioBadge.textContent = prioInfo.label;
    badgesRow.append(prioBadge);

    if (task.archived) {
      const archBadge = document.createElement('span');
      archBadge.className = 'cv-badge';
      archBadge.textContent = 'Archivée';
      badgesRow.append(archBadge);
    }

    headRow.append(titleHeading, badgesRow);

    const metaList = document.createElement('dl');
    metaList.className = 'lc-archive-meta';

    /** @param {string} labelText @param {string | HTMLElement} value */
    const addMetaRow = (labelText, value) => {
      const row = document.createElement('div');
      row.className = 'lc-archive-meta__row';
      const dt = document.createElement('dt');
      dt.textContent = labelText;
      const dd = document.createElement('dd');
      if (typeof value === 'string') {
        dd.textContent = value;
      } else {
        dd.append(value);
      }
      row.append(dt, dd);
      metaList.append(row);
    };

    const proj = selectProjectById(state, task.projectId);
    addMetaRow(
      'Projet',
      proj ? (proj.archived ? `${proj.name} (archivé)` : proj.name) : 'Sans projet',
    );

    if (task.dueDate) {
      const dueVal = document.createElement('span');
      dueVal.className = 'lc-archive-inline-badges';
      dueVal.append(
        document.createTextNode(
          `${formatShortDateFr(task.dueDate, true)}${task.dueTime ? ` à ${task.dueTime}` : ''}`,
        ),
      );
      if (isOffHoursDueTime(task.dueTime)) {
        const offBadge = document.createElement('span');
        offBadge.className = 'cv-badge lc-offhours-pill';
        const moonIc = document.createElement('i');
        moonIc.className = 'ph ph-moon cv-icon';
        moonIc.setAttribute('aria-hidden', 'true');
        offBadge.append(moonIc, document.createTextNode(' Créneau 18h–7h'));
        dueVal.append(offBadge);
      }
      addMetaRow('Échéance', dueVal);
    } else {
      addMetaRow('Échéance', 'Aucune');
    }

    addMetaRow('Récurrence', task.recurrence ? getTaskRecurrenceLabel(task.recurrence) : 'Aucune');

    const tagEditor = createTagEditor({
      idPrefix: 'task-tags',
      labelText: 'Étiquettes',
      initialTags: task.tags ?? [],
      readOnly,
      viewOnly: true,
    });

    const linkEditor = createLinkEditor({
      idPrefix: 'task-links',
      state,
      currentRef: { kind: 'task', id: task.id },
      initialLinks: task.links ?? [],
      readOnly,
      viewOnly: true,
      onNavigate(ref) {
        closeDialogById('drawer-task');
        cleanup();
        onNavigateLocalRef?.(ref);
      },
    });

    // Read-only checklist (zero inputs or interactive checkboxes)
    const checklistField = document.createElement('div');
    checklistField.className = 'cv-field';
    const checklistLabel = document.createElement('span');
    checklistLabel.className = 'cv-label';
    const checklistItems = task.checklist ?? [];
    const doneCount = checklistItems.filter((item) => item.done).length;
    checklistLabel.textContent =
      checklistItems.length > 0
        ? `Liste de contrôle (${doneCount}/${checklistItems.length})`
        : 'Liste de contrôle';
    checklistField.append(checklistLabel);

    if (checklistItems.length === 0) {
      const emptyCk = document.createElement('p');
      emptyCk.className = 'cv-caption';
      emptyCk.style.margin = '0';
      emptyCk.textContent = 'Aucune étape.';
      checklistField.append(emptyCk);
    } else {
      const ul = document.createElement('ul');
      ul.className = 'lc-consult-checklist';
      for (const item of checklistItems) {
        const li = document.createElement('li');
        li.className = item.done
          ? 'lc-consult-checklist__item is-done'
          : 'lc-consult-checklist__item';
        const ic = document.createElement('i');
        ic.className = item.done ? 'ph ph-check-square cv-icon' : 'ph ph-square cv-icon';
        ic.setAttribute('aria-hidden', 'true');
        const sr = document.createElement('span');
        sr.className = 'lc-sr-only';
        sr.textContent = item.done ? 'Fait : ' : 'À faire : ';
        const txt = document.createElement('span');
        txt.className = 'lc-consult-checklist__text';
        txt.textContent = item.text;
        li.append(ic, sr, txt);
        ul.append(li);
      }
      checklistField.append(ul);
    }

    // Read-only description
    const descField = document.createElement('div');
    descField.className = 'cv-field';
    const descLabel = document.createElement('span');
    descLabel.className = 'cv-label';
    descLabel.id = 'task-desc-label';
    descLabel.textContent = 'Description';
    descField.append(descLabel);

    /** @type {ReturnType<typeof mountRichTextEditor> | null} */
    let editorHandle = null;
    if (hasRichTextContent(task.descriptionDoc)) {
      const editorHost = document.createElement('div');
      editorHost.className = 'lc-editor-readonly-wrap';
      descField.append(editorHost);
      editorHandle = mountRichTextEditor({
        container: editorHost,
        initialDoc: task.descriptionDoc,
        editable: false,
        ariaLabel: 'Description de la tâche',
        resolveAssetUrl,
        onUploadImage: async () => null,
        onChange() {},
      });
    } else {
      const emptyDesc = document.createElement('p');
      emptyDesc.className = 'cv-caption';
      emptyDesc.style.margin = '0';
      emptyDesc.textContent = 'Aucune description.';
      descField.append(emptyDesc);
    }

    panel.append(
      headRow,
      metaList,
      tagEditor.element,
      linkEditor.element,
      checklistField,
      descField,
    );
    bodyEl.replaceChildren(panel);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'cv-btn';
    closeBtn.setAttribute('data-cv-close', '');
    closeBtn.textContent = 'Fermer';

    /** @type {HTMLElement[]} */
    const footerBtns = [closeBtn];
    if (!readOnly) {
      const switchEditBtn = document.createElement('button');
      switchEditBtn.type = 'button';
      switchEditBtn.id = 'btn-switch-task-edit';
      switchEditBtn.className = 'cv-btn cv-btn--primary';
      const editIc = document.createElement('i');
      editIc.className = 'ph ph-pencil-simple cv-icon';
      editIc.setAttribute('aria-hidden', 'true');
      switchEditBtn.append(editIc, document.createTextNode(' Modifier'));
      switchEditBtn.addEventListener('click', () => {
        const freshTask = store.getState().tasks.find((t) => t.id === task.id) ?? task;
        openTaskDrawer({ ...opts, task: freshTask, mode: 'edit' });
      });
      footerBtns.push(switchEditBtn);
    }
    footerEl.replaceChildren(...footerBtns);

    let cleaned = false;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      if (activeTaskCleanup === cleanup) activeTaskCleanup = null;
      drawer?.removeEventListener('close', onClose);
      editorHandle?.destroy();
      editorHandle = null;
      if (bodyEl) bodyEl.replaceChildren();
      if (footerEl) footerEl.replaceChildren();
    }
    function onClose() {
      if (!drawer) return;
      drawer.returnValue = '';
      cleanup();
    }
    activeTaskCleanup = cleanup;
    drawer.addEventListener('close', onClose);

    if (!drawer.open) {
      openDialogById('drawer-task');
    }
    closeBtn.focus();
    return;
  }

  titleEl.textContent = isEdit ? 'Modifier la tâche' : 'Nouvelle tâche';

  const form = document.createElement('form');
  form.id = 'form-task-drawer';
  form.noValidate = true;
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = 'var(--cv-space-4)';

  // Title field
  const titleField = document.createElement('div');
  titleField.className = 'cv-field';
  const titleLabel = document.createElement('label');
  titleLabel.className = 'cv-label';
  titleLabel.htmlFor = 'task-title-input';
  titleLabel.textContent = 'Titre';
  const req = document.createElement('span');
  req.className = 'cv-required';
  req.setAttribute('aria-hidden', 'true');
  req.textContent = '*';
  titleLabel.append(req);

  const titleInput = document.createElement('input');
  titleInput.id = 'task-title-input';
  titleInput.type = 'text';
  titleInput.className = 'cv-input';
  titleInput.required = true;
  titleInput.maxLength = 200;
  titleInput.disabled = readOnly;
  titleInput.value = task?.title ?? '';

  const titleError = document.createElement('span');
  titleError.id = 'task-title-error';
  titleError.className = 'cv-error';
  titleError.hidden = true;
  const titleErrIcon = document.createElement('i');
  titleErrIcon.className = 'ph ph-warning-circle cv-icon';
  titleErrIcon.setAttribute('aria-hidden', 'true');
  const titleErrText = document.createElement('span');
  titleErrText.textContent = 'Saisissez un titre de tâche.';
  titleError.append(titleErrIcon, titleErrText);
  titleField.append(titleLabel, titleInput, titleError);

  // Project select (active projects, plus task's current project if archived)
  const activeProjects = selectProjects(state);
  const projectChoices =
    task && !activeProjects.some((p) => p.id === task.projectId)
      ? [...activeProjects, ...state.projects.filter((p) => p.id === task.projectId)]
      : activeProjects;

  const projectField = document.createElement('div');
  projectField.className = 'cv-field';
  const projectLabel = document.createElement('label');
  projectLabel.className = 'cv-label';
  projectLabel.htmlFor = 'task-project-select';
  projectLabel.textContent = 'Projet';
  const projectSelectWrap = document.createElement('div');
  projectSelectWrap.className = 'cv-select';
  const projectSelect = document.createElement('select');
  projectSelect.id = 'task-project-select';
  projectSelect.className = 'cv-input';
  projectSelect.disabled = readOnly;
  for (const p of projectChoices) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.archived ? `${p.name} (archivé)` : p.name;
    projectSelect.append(opt);
  }
  const preferredProject =
    state.preferences.selectedProjectId &&
    projectChoices.some((p) => p.id === state.preferences.selectedProjectId)
      ? state.preferences.selectedProjectId
      : null;
  projectSelect.value =
    task?.projectId ?? defaultProjectId ?? preferredProject ?? projectChoices[0]?.id ?? '';
  projectSelectWrap.append(projectSelect);
  projectField.append(projectLabel, projectSelectWrap);

  // Status + live role badge
  const configuredStatuses = state.preferences.taskStatuses;
  const statusField = document.createElement('div');
  statusField.className = 'cv-field';
  const statusHead = document.createElement('div');
  statusHead.className = 'lc-field-head';
  const statusLabel = document.createElement('label');
  statusLabel.className = 'cv-label';
  statusLabel.htmlFor = 'task-status-select';
  statusLabel.textContent = 'Statut';
  const statusRoleBadge = document.createElement('span');
  statusRoleBadge.id = 'task-status-role-badge';
  statusRoleBadge.className = 'cv-badge';
  statusRoleBadge.hidden = true;
  statusHead.append(statusLabel, statusRoleBadge);

  const statusWrap = document.createElement('div');
  statusWrap.className = 'cv-select';
  const statusSelect = document.createElement('select');
  statusSelect.id = 'task-status-select';
  statusSelect.className = 'cv-input';
  statusSelect.disabled = readOnly;

  const currentStatusMeta = task ? getTaskStatusMeta(task.status, configuredStatuses) : null;
  if (currentStatusMeta?.kind === 'unknown' && task?.status) {
    const unknownOpt = document.createElement('option');
    unknownOpt.value = task.status;
    unknownOpt.textContent = currentStatusMeta.label;
    unknownOpt.disabled = true;
    statusSelect.append(unknownOpt);
  }

  const noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = 'Sans statut';
  statusSelect.append(noneOpt);

  for (const statusCfg of configuredStatuses) {
    const opt = document.createElement('option');
    opt.value = statusCfg.id;
    opt.textContent = statusCfg.label;
    statusSelect.append(opt);
  }

  const defaultInitialId = getDefaultInitialTaskStatusId(configuredStatuses);
  const fallbackDefaultStatus =
    defaultStatus !== undefined &&
    defaultStatus !== null &&
    configuredStatuses.some((s) => s.id === defaultStatus)
      ? defaultStatus
      : (defaultInitialId ?? '');
  statusSelect.value = task ? (task.status ?? '') : fallbackDefaultStatus;
  statusWrap.append(statusSelect);
  statusField.append(statusHead, statusWrap);

  // Priority field
  const priorityField = document.createElement('div');
  priorityField.className = 'cv-field';
  const priorityLabel = document.createElement('label');
  priorityLabel.className = 'cv-label';
  priorityLabel.htmlFor = 'task-priority-select';
  priorityLabel.textContent = 'Priorité';
  const priorityWrap = document.createElement('div');
  priorityWrap.className = 'cv-select';
  const prioritySelect = document.createElement('select');
  prioritySelect.id = 'task-priority-select';
  prioritySelect.className = 'cv-input';
  prioritySelect.disabled = readOnly;
  /** @type {Array<[TaskPriority, string]>} */
  const priorityOptions = [
    ['low', 'Basse'],
    ['medium', 'Moyenne'],
    ['high', 'Haute'],
  ];
  for (const [val, label] of priorityOptions) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = label;
    prioritySelect.append(opt);
  }
  prioritySelect.value = task?.priority ?? 'medium';
  priorityWrap.append(prioritySelect);
  priorityField.append(priorityLabel, priorityWrap);

  // Due date & optional Due time
  const dueField = document.createElement('div');
  dueField.className = 'cv-field';
  const dueLabel = document.createElement('label');
  dueLabel.className = 'cv-label';
  dueLabel.htmlFor = 'task-due-input';
  dueLabel.textContent = 'Échéance et heure';

  const dueInputsRow = document.createElement('div');
  dueInputsRow.className = 'lc-due-inputs';

  const dueInput = document.createElement('input');
  dueInput.id = 'task-due-input';
  dueInput.type = 'date';
  dueInput.className = 'cv-input';
  dueInput.disabled = readOnly;
  dueInput.value = task?.dueDate ?? defaultDueDate ?? '';

  const timeInput = document.createElement('input');
  timeInput.id = 'task-due-time-input';
  timeInput.type = 'time';
  timeInput.className = 'cv-input lc-due-inputs__time';
  timeInput.setAttribute('aria-label', 'Heure d’échéance');
  const initialTime = task ? (task.dueTime ?? '') : (normalizeDueTime(defaultDueTime) ?? '');
  timeInput.value = dueInput.value ? initialTime : '';

  const offHoursHint = document.createElement('span');
  offHoursHint.id = 'task-due-offhours-hint';
  offHoursHint.className = 'cv-badge lc-offhours-pill';
  const moonIc = document.createElement('i');
  moonIc.className = 'ph ph-moon cv-icon';
  moonIc.setAttribute('aria-hidden', 'true');
  offHoursHint.append(moonIc, document.createTextNode(' Créneau 18h–7h'));

  function syncDueTimeState() {
    if (!dueInput.value) {
      timeInput.value = '';
      timeInput.disabled = true;
      offHoursHint.hidden = true;
    } else {
      timeInput.disabled = readOnly;
      offHoursHint.hidden = !isOffHoursDueTime(timeInput.value || null);
    }
  }
  dueInput.addEventListener('input', syncDueTimeState);
  dueInput.addEventListener('change', syncDueTimeState);
  timeInput.addEventListener('input', syncDueTimeState);
  timeInput.addEventListener('change', syncDueTimeState);
  syncDueTimeState();

  dueInputsRow.append(dueInput, timeInput, offHoursHint);
  dueField.append(dueLabel, dueInputsRow);

  // Recurrence
  const recurrenceField = document.createElement('div');
  recurrenceField.className = 'cv-field';
  const recurrenceLabel = document.createElement('label');
  recurrenceLabel.className = 'cv-label';
  recurrenceLabel.htmlFor = 'task-recurrence-select';
  recurrenceLabel.textContent = 'Récurrence';
  const recurrenceWrap = document.createElement('div');
  recurrenceWrap.className = 'cv-select';
  const recurrenceSelect = document.createElement('select');
  recurrenceSelect.id = 'task-recurrence-select';
  recurrenceSelect.className = 'cv-input';
  recurrenceSelect.disabled = readOnly;
  const noRecOpt = document.createElement('option');
  noRecOpt.value = '';
  noRecOpt.textContent = 'Aucune';
  recurrenceSelect.append(noRecOpt);
  for (const rec of TASK_RECURRENCES) {
    const opt = document.createElement('option');
    opt.value = rec;
    opt.textContent = getTaskRecurrenceLabel(rec);
    recurrenceSelect.append(opt);
  }
  recurrenceSelect.value = task?.recurrence ?? '';
  recurrenceWrap.append(recurrenceSelect);
  const recurrenceHint = document.createElement('span');
  recurrenceHint.className = 'cv-hint';
  recurrenceHint.textContent =
    'Lorsque la tâche passe à un statut terminal, l’occurrence suivante est créée automatiquement.';
  recurrenceField.append(recurrenceLabel, recurrenceWrap, recurrenceHint);

  const tagEditor = createTagEditor({
    idPrefix: 'task-tags',
    labelText: 'Étiquettes',
    initialTags: task?.tags ?? [],
    suggestions: selectAllTags(state),
    readOnly,
  });

  const initialTerminal = isTerminalTaskStatus(statusSelect.value || null, configuredStatuses);
  const linkEditor = createLinkEditor({
    idPrefix: 'task-links',
    state,
    currentRef: task ? { kind: 'task', id: task.id } : null,
    initialLinks: task?.links ?? [],
    readOnly,
    sourceTerminal: initialTerminal,
    onNavigate(ref) {
      closeDialogById('drawer-task');
      cleanup();
      onNavigateLocalRef?.(ref);
    },
  });

  function syncStatusRoleUi() {
    const chosen = statusSelect.value || null;
    const role = getTaskStatusRole(chosen, configuredStatuses);
    if (role === 'initial') {
      statusRoleBadge.hidden = false;
      statusRoleBadge.className = 'cv-badge cv-badge--accent';
      statusRoleBadge.dataset.statusRole = 'initial';
      statusRoleBadge.textContent = 'Initial';
    } else if (role === 'terminal') {
      statusRoleBadge.hidden = false;
      statusRoleBadge.className = 'cv-badge cv-badge--success';
      statusRoleBadge.dataset.statusRole = 'terminal';
      statusRoleBadge.textContent = 'Terminal';
    } else {
      statusRoleBadge.hidden = true;
      delete statusRoleBadge.dataset.statusRole;
      statusRoleBadge.textContent = '';
    }
    linkEditor.setSourceTerminal(isTerminalTaskStatus(chosen, configuredStatuses));
  }
  statusSelect.addEventListener('change', syncStatusRoleUi);
  syncStatusRoleUi();

  // Checklist section
  /** @type {ChecklistItem[]} */
  let checklist = (task?.checklist ?? []).map((item) => ({ ...item }));
  const checklistFieldset = document.createElement('fieldset');
  checklistFieldset.className = 'cv-fieldset';
  const checklistLegend = document.createElement('legend');
  checklistLegend.className = 'cv-label';
  checklistLegend.textContent = 'Liste de contrôle';
  const checklistList = document.createElement('div');
  checklistList.className = 'lc-checklist';

  const checklistAddRow = document.createElement('div');
  checklistAddRow.className = 'lc-checklist__add';
  const checklistInput = document.createElement('input');
  checklistInput.id = 'task-checklist-new';
  checklistInput.type = 'text';
  checklistInput.className = 'cv-input';
  checklistInput.placeholder = 'Ajouter une étape';
  checklistInput.setAttribute('aria-label', 'Nouvelle étape de la liste de contrôle');
  checklistInput.disabled = readOnly;

  const checklistAddBtn = document.createElement('button');
  checklistAddBtn.type = 'button';
  checklistAddBtn.className = 'cv-btn';
  checklistAddBtn.textContent = 'Ajouter';
  checklistAddBtn.disabled = readOnly;

  function renderChecklist() {
    checklistList.replaceChildren();
    for (const item of checklist) {
      const row = document.createElement('div');
      row.className = 'lc-checklist__row';

      const checkLabel = document.createElement('label');
      checkLabel.className = 'cv-check';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = item.done;
      cb.disabled = readOnly;
      cb.addEventListener('change', () => {
        checklist = checklist.map((x) => (x.id === item.id ? { ...x, done: cb.checked } : x));
      });
      const textSpan = document.createElement('span');
      textSpan.textContent = item.text;
      checkLabel.append(cb, textSpan);

      const rmBtn = document.createElement('button');
      rmBtn.type = 'button';
      rmBtn.className = 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm';
      rmBtn.setAttribute('aria-label', `Retirer ${item.text}`);
      setTooltip(rmBtn, 'Retirer l’étape');
      rmBtn.disabled = readOnly;
      const rmIcon = document.createElement('i');
      rmIcon.className = 'ph ph-x cv-icon';
      rmIcon.setAttribute('aria-hidden', 'true');
      rmBtn.append(rmIcon);
      rmBtn.addEventListener('click', () => {
        checklist = checklist.filter((x) => x.id !== item.id);
        renderChecklist();
      });

      row.append(checkLabel, rmBtn);
      checklistList.append(row);
    }
    initTooltips(checklistList);
  }

  checklistAddBtn.addEventListener('click', () => {
    const text = checklistInput.value.trim();
    if (!text) return;
    checklist = [...checklist, { id: crypto.randomUUID(), text, done: false }];
    checklistInput.value = '';
    renderChecklist();
  });

  const checklistTemplatePicker = createTemplatePicker({
    idPrefix: 'task-checklist-tpl',
    labelText: 'Modèles de checklist',
    templates: selectTemplates(store.getState(), 'checklist'),
    readOnly,
    showSave: true,
    onApply(tpl) {
      const added = instantiateChecklistTemplate(tpl, () => crypto.randomUUID());
      if (added.length === 0) return;
      checklist = [...checklist, ...added];
      renderChecklist();
      notify({ status: 'success', title: 'Modèle de checklist appliqué', text: tpl.name });
    },
    onSaveNew(name) {
      const texts = checklist.map((item) => item.text.trim()).filter(Boolean);
      if (texts.length === 0) {
        notify({
          status: 'warning',
          title: 'Liste de contrôle vide',
          text: 'Ajoutez au moins une étape avant d’enregistrer un modèle.',
        });
        return false;
      }
      const id = crypto.randomUUID();
      store.dispatch({
        type: 'create_template',
        id,
        kind: 'checklist',
        name,
        checklistItems: texts,
        now: new Date().toISOString(),
      });
      checklistTemplatePicker.setTemplates(selectTemplates(store.getState(), 'checklist'), id);
      notify({ status: 'success', title: 'Modèle de checklist enregistré', text: name });
      return id;
    },
    onDeleteCustom(tpl) {
      store.dispatch({ type: 'delete_template', id: tpl.id });
      checklistTemplatePicker.setTemplates(selectTemplates(store.getState(), 'checklist'));
      notify({ status: 'info', title: 'Modèle supprimé', text: tpl.name });
    },
  });

  renderChecklist();
  checklistAddRow.append(checklistInput, checklistAddBtn);
  checklistFieldset.append(
    checklistLegend,
    checklistTemplatePicker.element,
    checklistList,
    checklistAddRow,
  );

  // Rich text description
  const descField = document.createElement('div');
  descField.className = 'cv-field';
  const descLabel = document.createElement('span');
  descLabel.className = 'cv-label';
  descLabel.id = 'task-desc-label';
  descLabel.textContent = 'Description';
  const editorHost = document.createElement('div');
  descField.append(descLabel, editorHost);

  /** @type {Set<string>} */
  const stagedAssetIds = new Set();
  /** @param {File} file */
  async function handleUploadImage(file) {
    const res = await uploadLocalImage(file);
    if (res) stagedAssetIds.add(res.assetId);
    return res;
  }

  /** @type {RichTextDoc} */
  const initialDoc = task?.descriptionDoc ?? EMPTY_RICH_DOC;
  const editorHandle = mountRichTextEditor({
    container: editorHost,
    initialDoc,
    editable: !readOnly,
    ariaLabel: 'Description de la tâche',
    resolveAssetUrl,
    onUploadImage: handleUploadImage,
    onBlockedRemoteImage: () => {
      notify({
        status: 'warning',
        title: 'Image distante bloquée',
        text: 'Seules les images locales enregistrées sur cet appareil sont autorisées.',
      });
    },
    onRejectedLink: () => {
      notify({
        status: 'warning',
        title: 'Lien refusé',
        text: 'Seuls les liens https:// et mailto: sont acceptés.',
      });
    },
    onChange() {},
  });

  form.append(
    titleField,
    projectField,
    statusField,
    priorityField,
    dueField,
    recurrenceField,
    tagEditor.element,
    linkEditor.element,
    checklistFieldset,
    descField,
  );
  bodyEl.replaceChildren(form);

  // Footer actions
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'cv-btn';
  cancelBtn.setAttribute('data-cv-close', '');
  cancelBtn.textContent = 'Annuler';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.setAttribute('form', 'form-task-drawer');
  saveBtn.className = 'cv-btn cv-btn--primary';
  saveBtn.disabled = readOnly;
  saveBtn.textContent = isEdit ? 'Enregistrer' : 'Créer la tâche';

  /** @type {HTMLElement[]} */
  const footerButtons = [];
  if (isEdit && task && !readOnly) {
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'cv-btn cv-btn--danger';
    deleteBtn.textContent = 'Supprimer';
    deleteBtn.addEventListener('click', async () => {
      closeDialogById('drawer-task');
      const confirmed = await confirmAction({
        title: `Supprimer « ${task.title} » ?`,
        message: 'Cette tâche sera déplacée dans la corbeille locale.',
        confirmLabel: 'Supprimer la tâche',
        danger: true,
      });
      if (confirmed) {
        store.dispatch({
          type: 'trash_task',
          id: task.id,
          trashId: crypto.randomUUID(),
          now: new Date().toISOString(),
        });
        notify({ status: 'info', title: 'Tâche placée dans la corbeille', text: task.title });
      }
    });

    const archiveBtn = document.createElement('button');
    archiveBtn.type = 'button';
    archiveBtn.id = 'btn-archive-task';
    archiveBtn.className = 'cv-btn';
    archiveBtn.style.marginRight = 'auto';
    archiveBtn.textContent = task.archived ? 'Désarchiver' : 'Archiver';
    archiveBtn.addEventListener('click', () => {
      const nextArchived = !task.archived;
      store.dispatch({
        type: 'toggle_archive_task',
        id: task.id,
        archived: nextArchived,
        now: new Date().toISOString(),
      });
      closeDialogById('drawer-task');
      cleanup();
      notify({
        status: 'info',
        title: nextArchived ? 'Tâche archivée' : 'Tâche désarchivée',
        text: nextArchived ? `${task.title} déplacée vers les archives.` : task.title,
      });
    });

    const consultBtn = document.createElement('button');
    consultBtn.type = 'button';
    consultBtn.id = 'btn-switch-task-view';
    consultBtn.className = 'cv-btn';
    consultBtn.textContent = 'Consulter';
    consultBtn.addEventListener('click', () => {
      const freshTask = store.getState().tasks.find((t) => t.id === task.id) ?? task;
      openTaskDrawer({ ...opts, task: freshTask, mode: 'view' });
    });

    footerButtons.push(deleteBtn, archiveBtn, consultBtn);
  }
  footerButtons.push(cancelBtn, saveBtn);
  footerEl.replaceChildren(...footerButtons);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (readOnly) return;

    const cleanTitle = titleInput.value.trim();
    if (!cleanTitle) {
      titleInput.setAttribute('aria-invalid', 'true');
      titleInput.setAttribute('aria-describedby', 'task-title-error');
      titleError.hidden = false;
      titleInput.focus();
      return;
    }
    titleInput.removeAttribute('aria-invalid');
    titleInput.removeAttribute('aria-describedby');
    titleError.hidden = true;

    const tags = tagEditor.commitPending();
    const links = linkEditor.getLinks();
    const doc = editorHandle.getDoc();
    const assetIds = collectDocAssetIds(doc);
    const now = new Date().toISOString();
    const rawSelectedStatus = statusSelect.value;
    const status = rawSelectedStatus ? /** @type {TaskStatus} */ (rawSelectedStatus) : null;
    const priority = /** @type {TaskPriority} */ (prioritySelect.value);
    const dueDate = dueInput.value ? dueInput.value : null;
    const dueTime = dueDate ? normalizeDueTime(timeInput.value) : null;
    const recurrence = normalizeTaskRecurrence(recurrenceSelect.value);

    try {
      if (isEdit && task) {
        /** @type {{
         *   title: string;
         *   projectId: string;
         *   status?: TaskStatus | null;
         *   priority: TaskPriority;
         *   dueDate: string | null;
         *   dueTime: string | null;
         *   recurrence?: TaskRecurrence | null;
         *   checklist: readonly ChecklistItem[];
         *   tags: readonly string[];
         *   links: readonly LocalRef[];
         *   descriptionDoc: RichTextDoc;
         *   assetIds: readonly string[];
         * }} */
        const patch = {
          title: cleanTitle,
          projectId: projectSelect.value,
          priority,
          dueDate,
          dueTime,
          recurrence,
          checklist,
          tags,
          links,
          descriptionDoc: doc,
          assetIds,
        };
        if (status !== task.status) {
          patch.status = status;
        }
        const prevIds = new Set(store.getState().tasks.map((t) => t.id));
        const { state: nextState } = store.dispatch({
          type: 'update_task',
          id: task.id,
          patch,
          now,
        });
        const spawned = nextState.tasks.find((t) => !prevIds.has(t.id));
        if (spawned) {
          notify({
            status: 'success',
            title: 'Prochaine occurrence créée',
            text: spawned.dueDate ? `${spawned.title} (${spawned.dueDate})` : spawned.title,
          });
        } else {
          notify({ status: 'success', title: 'Tâche enregistrée', text: cleanTitle });
        }
      } else {
        store.dispatch({
          type: 'create_task',
          id: crypto.randomUUID(),
          projectId: projectSelect.value,
          title: cleanTitle,
          status,
          priority,
          dueDate,
          dueTime,
          recurrence,
          checklist,
          tags,
          links,
          descriptionDoc: doc,
          assetIds,
          now,
        });
        notify({ status: 'success', title: 'Tâche créée', text: cleanTitle });
      }
    } catch (err) {
      notify({
        status: 'danger',
        title: 'Enregistrement impossible',
        text: err instanceof Error ? err.message : 'Erreur de validation.',
      });
      return;
    }

    const orphanedStaged = selectOrphanedAssetIds(store.getState(), stagedAssetIds);
    for (const id of orphanedStaged) {
      store.dispatch({ type: 'delete_asset', id });
    }
    stagedAssetIds.clear();
    closeDialogById('drawer-task');
    cleanup();
  });

  let closed = false;
  function cleanup() {
    if (closed) return;
    closed = true;
    if (activeTaskCleanup === cleanup) activeTaskCleanup = null;
    drawer?.removeEventListener('close', onClose);
    if (stagedAssetIds.size > 0 && !store.getState().readOnly) {
      const orphanedStaged = selectOrphanedAssetIds(store.getState(), stagedAssetIds);
      for (const id of orphanedStaged) {
        store.dispatch({ type: 'delete_asset', id });
      }
      stagedAssetIds.clear();
    }
    editorHandle.destroy();
    if (bodyEl) bodyEl.replaceChildren();
    if (footerEl) footerEl.replaceChildren();
  }
  function onClose() {
    if (!drawer) return;
    drawer.returnValue = '';
    cleanup();
  }
  activeTaskCleanup = cleanup;
  drawer.addEventListener('close', onClose);

  if (!drawer.open) {
    openDialogById('drawer-task');
  }
  titleInput.focus();
}
