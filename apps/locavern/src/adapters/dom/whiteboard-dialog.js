/** @import { AppCommand, AppState, StoreEffect, Whiteboard } from '../../types.d.ts' */

import { formatShortDateFr } from '../../core/dates.js';
import { DEFAULT_WHITEBOARD_VIEWPORT } from '../../core/model.js';
import { selectProjectById, selectProjects, selectTemplates } from '../../core/store.js';
import { instantiateWhiteboardTemplate } from '../../core/templates.js';
import {
  applyDialogPresentation,
  closeDialogById,
  confirmAction,
  notify,
  openDialogById,
} from './app-shell.js';

/** @type {(() => void) | null} */
let activeWhiteboardDialogCleanup = null;

/**
 * Open the Covenant dialog (drawer or modal per user preference) to consult, create, or edit a whiteboard.
 * @param {{
 *   store: {
 *     getState: () => AppState;
 *     dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *   };
 *   whiteboard?: Whiteboard;
 *   mode?: 'view' | 'edit';
 *   defaultProjectId?: string | null;
 *   onAfterCreate?: (whiteboardId: string) => void;
 * }} opts
 */
export function openWhiteboardDialog(opts) {
  const { store, whiteboard, mode, defaultProjectId = null, onAfterCreate } = opts;
  const dialog = /** @type {HTMLDialogElement | null} */ (
    document.getElementById('dialog-whiteboard')
  );
  const titleEl = document.getElementById('dialog-whiteboard-title');
  const bodyEl = document.getElementById('dialog-whiteboard-body');
  const footerEl = document.getElementById('dialog-whiteboard-footer');
  if (!dialog || !titleEl || !bodyEl || !footerEl) return;

  activeWhiteboardDialogCleanup?.();
  activeWhiteboardDialogCleanup = null;

  const state = store.getState();
  applyDialogPresentation(dialog, state.preferences.inputPresentations.whiteboards);
  const isEdit = Boolean(whiteboard);
  const readOnly = state.readOnly;
  const effectiveMode = !isEdit ? 'edit' : readOnly ? 'view' : (mode ?? 'view');

  if (effectiveMode === 'view' && whiteboard) {
    titleEl.textContent = 'Consulter le tableau blanc';

    const panel = document.createElement('div');
    panel.id = 'whiteboard-consult-view';
    panel.className = 'lc-consult-panel';

    const headRow = document.createElement('div');
    headRow.className = 'lc-consult-head';

    const wbHeading = document.createElement('h3');
    wbHeading.className = 'lc-consult-title';
    wbHeading.textContent = whiteboard.title;
    headRow.append(wbHeading);

    if (whiteboard.archived) {
      const archBadge = document.createElement('span');
      archBadge.className = 'cv-badge';
      archBadge.textContent = 'Archivé';
      headRow.append(archBadge);
    }

    const meta = document.createElement('dl');
    meta.className = 'lc-archive-meta';
    const proj = whiteboard.projectId ? selectProjectById(state, whiteboard.projectId) : null;
    const elCount = whiteboard.elements.length;

    /** @param {string} label @param {string} val */
    const addRow = (label, val) => {
      const row = document.createElement('div');
      row.className = 'lc-archive-meta__row';
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = val;
      row.append(dt, dd);
      meta.append(row);
    };

    addRow('Projet', proj ? (proj.archived ? `${proj.name} (archivé)` : proj.name) : 'Sans projet');
    addRow('Éléments', `${elCount} élément${elCount > 1 ? 's' : ''} sur le canevas`);
    addRow('Mise à jour', formatShortDateFr(whiteboard.updatedAt.slice(0, 10), true));

    panel.append(headRow, meta);
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
      switchEditBtn.id = 'btn-switch-whiteboard-dialog-edit';
      switchEditBtn.className = 'cv-btn cv-btn--primary';
      const editIc = document.createElement('i');
      editIc.className = 'ph ph-pencil-simple cv-icon';
      editIc.setAttribute('aria-hidden', 'true');
      switchEditBtn.append(editIc, document.createTextNode(' Modifier'));
      switchEditBtn.addEventListener('click', () => {
        const fresh =
          store.getState().whiteboards.find((w) => w.id === whiteboard.id) ?? whiteboard;
        openWhiteboardDialog({ ...opts, whiteboard: fresh, mode: 'edit' });
      });
      footerBtns.push(switchEditBtn);
    }
    footerEl.replaceChildren(...footerBtns);

    let cleaned = false;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      if (activeWhiteboardDialogCleanup === cleanup) activeWhiteboardDialogCleanup = null;
      dialog?.removeEventListener('close', onClose);
      if (bodyEl) bodyEl.replaceChildren();
      if (footerEl) footerEl.replaceChildren();
    }
    function onClose() {
      if (!dialog) return;
      dialog.returnValue = '';
      cleanup();
    }
    activeWhiteboardDialogCleanup = cleanup;
    dialog.addEventListener('close', onClose);

    if (!dialog.open) {
      openDialogById('dialog-whiteboard');
    }
    closeBtn.focus();
    return;
  }

  titleEl.textContent = isEdit ? 'Modifier le tableau blanc' : 'Nouveau tableau blanc';

  const form = document.createElement('form');
  form.id = 'form-whiteboard-dialog';
  form.noValidate = true;
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = 'var(--cv-space-4)';

  const titleField = document.createElement('div');
  titleField.className = 'cv-field';
  const titleLabel = document.createElement('label');
  titleLabel.className = 'cv-label';
  titleLabel.htmlFor = 'whiteboard-dialog-title-input';
  titleLabel.textContent = 'Titre du tableau blanc';
  const req = document.createElement('span');
  req.className = 'cv-required';
  req.setAttribute('aria-hidden', 'true');
  req.textContent = '*';
  titleLabel.append(req);

  const titleInput = document.createElement('input');
  titleInput.id = 'whiteboard-dialog-title-input';
  titleInput.type = 'text';
  titleInput.className = 'cv-input';
  titleInput.required = true;
  titleInput.maxLength = 200;
  titleInput.disabled = readOnly;
  titleInput.value = whiteboard?.title ?? '';

  const titleError = document.createElement('span');
  titleError.id = 'whiteboard-dialog-title-error';
  titleError.className = 'cv-error';
  titleError.hidden = true;
  const titleErrIcon = document.createElement('i');
  titleErrIcon.className = 'ph ph-warning-circle cv-icon';
  titleErrIcon.setAttribute('aria-hidden', 'true');
  const titleErrText = document.createElement('span');
  titleErrText.textContent = 'Saisissez un titre de tableau blanc.';
  titleError.append(titleErrIcon, titleErrText);
  titleField.append(titleLabel, titleInput, titleError);

  const activeProjects = selectProjects(state);
  const projectChoices =
    whiteboard?.projectId && !activeProjects.some((p) => p.id === whiteboard.projectId)
      ? [...activeProjects, ...state.projects.filter((p) => p.id === whiteboard.projectId)]
      : activeProjects;

  const projectField = document.createElement('div');
  projectField.className = 'cv-field';
  const projectLabel = document.createElement('label');
  projectLabel.className = 'cv-label';
  projectLabel.htmlFor = 'whiteboard-dialog-project-select';
  projectLabel.textContent = 'Projet associé';
  const projectSelectWrap = document.createElement('div');
  projectSelectWrap.className = 'cv-select';
  const projectSelect = document.createElement('select');
  projectSelect.id = 'whiteboard-dialog-project-select';
  projectSelect.className = 'cv-input';
  projectSelect.disabled = readOnly;
  const noProjOpt = document.createElement('option');
  noProjOpt.value = '';
  noProjOpt.textContent = 'Sans projet';
  projectSelect.append(noProjOpt);
  for (const p of projectChoices) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.archived ? `${p.name} (archivé)` : p.name;
    projectSelect.append(opt);
  }
  const preferredProj =
    state.preferences.selectedProjectId &&
    projectChoices.some((p) => p.id === state.preferences.selectedProjectId)
      ? state.preferences.selectedProjectId
      : '';
  projectSelect.value =
    whiteboard !== undefined ? (whiteboard.projectId ?? '') : (defaultProjectId ?? preferredProj);
  projectSelectWrap.append(projectSelect);
  projectField.append(projectLabel, projectSelectWrap);

  /** @type {HTMLSelectElement | null} */
  let templateSelect = null;
  if (!isEdit) {
    const tplField = document.createElement('div');
    tplField.className = 'cv-field';
    const tplLabel = document.createElement('label');
    tplLabel.className = 'cv-label';
    tplLabel.htmlFor = 'whiteboard-dialog-template-select';
    tplLabel.textContent = 'Modèle de canevas';
    const tplWrap = document.createElement('div');
    tplWrap.className = 'cv-select';
    templateSelect = document.createElement('select');
    templateSelect.id = 'whiteboard-dialog-template-select';
    templateSelect.className = 'cv-input';
    templateSelect.disabled = readOnly;
    const blankOpt = document.createElement('option');
    blankOpt.value = '';
    blankOpt.textContent = 'Canevas vierge';
    templateSelect.append(blankOpt);
    for (const tpl of selectTemplates(state, 'whiteboard')) {
      const opt = document.createElement('option');
      opt.value = tpl.id;
      opt.textContent = tpl.builtin ? tpl.name : `${tpl.name} (modèle local)`;
      templateSelect.append(opt);
    }
    tplWrap.append(templateSelect);
    tplField.append(tplLabel, tplWrap);
    form.append(titleField, projectField, tplField);
  } else {
    form.append(titleField, projectField);
  }
  bodyEl.replaceChildren(form);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'cv-btn';
  cancelBtn.setAttribute('data-cv-close', '');
  cancelBtn.textContent = 'Annuler';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.setAttribute('form', 'form-whiteboard-dialog');
  saveBtn.className = 'cv-btn cv-btn--primary';
  saveBtn.disabled = readOnly;
  saveBtn.textContent = isEdit ? 'Enregistrer' : 'Créer le tableau blanc';

  /** @type {HTMLElement[]} */
  const footerButtons = [];
  if (isEdit && whiteboard && !readOnly) {
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'cv-btn cv-btn--danger';
    deleteBtn.textContent = 'Supprimer';
    deleteBtn.addEventListener('click', async () => {
      closeDialogById('dialog-whiteboard');
      const confirmed = await confirmAction({
        title: `Supprimer « ${whiteboard.title} » ?`,
        message: 'Ce tableau blanc sera déplacé dans la corbeille locale.',
        confirmLabel: 'Supprimer le tableau blanc',
        danger: true,
      });
      if (confirmed) {
        store.dispatch({
          type: 'trash_whiteboard',
          id: whiteboard.id,
          trashId: crypto.randomUUID(),
          now: new Date().toISOString(),
        });
        notify({
          status: 'info',
          title: 'Tableau blanc placé dans la corbeille',
          text: whiteboard.title,
        });
      }
    });

    const archiveBtn = document.createElement('button');
    archiveBtn.type = 'button';
    archiveBtn.id = 'btn-dialog-archive-whiteboard';
    archiveBtn.className = 'cv-btn';
    archiveBtn.style.marginRight = 'auto';
    archiveBtn.textContent = whiteboard.archived ? 'Désarchiver' : 'Archiver';
    archiveBtn.addEventListener('click', () => {
      const nextArchived = !whiteboard.archived;
      store.dispatch({
        type: 'toggle_archive_whiteboard',
        id: whiteboard.id,
        archived: nextArchived,
        now: new Date().toISOString(),
      });
      closeDialogById('dialog-whiteboard');
      cleanup();
      notify({
        status: 'info',
        title: nextArchived ? 'Tableau blanc archivé' : 'Tableau blanc désarchivé',
        text: nextArchived ? `${whiteboard.title} déplacé vers les archives.` : whiteboard.title,
      });
    });

    const consultBtn = document.createElement('button');
    consultBtn.type = 'button';
    consultBtn.id = 'btn-switch-whiteboard-dialog-view';
    consultBtn.className = 'cv-btn';
    consultBtn.textContent = 'Consulter';
    consultBtn.addEventListener('click', () => {
      const fresh = store.getState().whiteboards.find((w) => w.id === whiteboard.id) ?? whiteboard;
      openWhiteboardDialog({ ...opts, whiteboard: fresh, mode: 'view' });
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
      titleInput.setAttribute('aria-describedby', 'whiteboard-dialog-title-error');
      titleError.hidden = false;
      titleInput.focus();
      return;
    }
    titleInput.removeAttribute('aria-invalid');
    titleInput.removeAttribute('aria-describedby');
    titleError.hidden = true;

    const projectId = projectSelect.value ? projectSelect.value : null;
    const now = new Date().toISOString();

    if (isEdit && whiteboard) {
      store.dispatch({
        type: 'update_whiteboard',
        id: whiteboard.id,
        patch: {
          title: cleanTitle,
          projectId,
        },
        now,
      });
      notify({ status: 'success', title: 'Tableau blanc enregistré', text: cleanTitle });
    } else {
      const selectedTplId = templateSelect?.value ?? '';
      const selectedTpl = selectedTplId
        ? selectTemplates(store.getState(), 'whiteboard').find((t) => t.id === selectedTplId)
        : undefined;
      const instantiated = selectedTpl
        ? instantiateWhiteboardTemplate(selectedTpl, () => crypto.randomUUID())
        : { viewport: DEFAULT_WHITEBOARD_VIEWPORT, elements: [] };
      const id = crypto.randomUUID();
      store.dispatch({
        type: 'create_whiteboard',
        id,
        projectId,
        title: cleanTitle,
        viewport: instantiated.viewport,
        elements: instantiated.elements,
        assetIds: [],
        now,
      });
      notify({ status: 'success', title: 'Tableau blanc créé', text: cleanTitle });
      onAfterCreate?.(id);
    }

    closeDialogById('dialog-whiteboard');
    cleanup();
  });

  let closed = false;
  function cleanup() {
    if (closed) return;
    closed = true;
    if (activeWhiteboardDialogCleanup === cleanup) activeWhiteboardDialogCleanup = null;
    dialog?.removeEventListener('close', onClose);
    if (bodyEl) bodyEl.replaceChildren();
    if (footerEl) footerEl.replaceChildren();
  }
  function onClose() {
    if (!dialog) return;
    dialog.returnValue = '';
    cleanup();
  }
  activeWhiteboardDialogCleanup = cleanup;
  dialog.addEventListener('close', onClose);

  if (!dialog.open) {
    openDialogById('dialog-whiteboard');
  }
  titleInput.focus();
}
