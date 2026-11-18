/** @import { AppCommand, AppState, StoreEffect, TaskStatusConfig } from '../../types.d.ts' */

import {
  DEFAULT_TASK_STATUSES,
  createTaskStatusId,
  normalizeTaskStatuses,
} from '../../core/model.js';
import { closeDialogById, notify, openDialogById } from './app-shell.js';
import { initTooltips, setTooltip } from './tooltip.js';

/**
 * Open the Kanban statuses configuration modal (`#modal-statuses`).
 */
export function openStatusModal() {
  openDialogById('modal-statuses');
}

/**
 * Wire the Kanban statuses configuration modal (`#modal-statuses`).
 * Allows adding, renaming, assigning semantic roles (initial/terminal), reordering, deleting, and resetting task statuses.
 * @param {{
 *   store: {
 *     getState: () => AppState;
 *     dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *   };
 * }} opts
 */
export function wireStatusModal({ store }) {
  const modal = /** @type {HTMLDialogElement | null} */ (document.getElementById('modal-statuses'));
  const bodyEl = document.getElementById('modal-statuses-body');
  const footerEl = document.getElementById('modal-statuses-footer');
  if (!modal || !bodyEl || !footerEl) return;

  const modalDialog = modal;
  const modalBody = bodyEl;
  const modalFooter = footerEl;

  /** @type {Array<{ id: string; label: string; isInitial?: boolean; isTerminal?: boolean }>} */
  let draftStatuses = [];

  /**
   * Convert status flags to select value.
   * @param {{ isInitial?: boolean; isTerminal?: boolean }} item
   * @returns {'none' | 'initial' | 'terminal'}
   */
  function roleValueOf(item) {
    if (item.isTerminal) return 'terminal';
    if (item.isInitial) return 'initial';
    return 'none';
  }

  /**
   * Synchronize in-memory `draftStatuses` labels and roles from currently rendered inputs before list mutations.
   */
  function syncDraftFromInputs() {
    const inputs = modalBody.querySelectorAll('input[data-status-index]');
    for (const input of inputs) {
      if (input instanceof HTMLInputElement) {
        const idx = Number.parseInt(input.dataset.statusIndex ?? '', 10);
        const item = draftStatuses[idx];
        if (!Number.isNaN(idx) && item) {
          item.label = input.value;
        }
      }
    }
    const roleSelects = modalBody.querySelectorAll('select[data-status-role-index]');
    for (const sel of roleSelects) {
      if (sel instanceof HTMLSelectElement) {
        const idx = Number.parseInt(sel.dataset.statusRoleIndex ?? '', 10);
        const item = draftStatuses[idx];
        if (!Number.isNaN(idx) && item) {
          item.isInitial = sel.value === 'initial';
          item.isTerminal = sel.value === 'terminal';
        }
      }
    }
  }

  /**
   * Build a small role badge preview element.
   * @param {'none' | 'initial' | 'terminal'} role
   * @returns {HTMLSpanElement | null}
   */
  function makeRoleBadge(role) {
    if (role === 'initial') {
      const b = document.createElement('span');
      b.className = 'cv-badge cv-badge--accent';
      b.dataset.statusRoleBadge = 'initial';
      b.textContent = 'Initial';
      return b;
    }
    if (role === 'terminal') {
      const b = document.createElement('span');
      b.className = 'cv-badge cv-badge--success';
      b.dataset.statusRoleBadge = 'terminal';
      b.textContent = 'Terminal';
      return b;
    }
    return null;
  }

  /**
   * Render the modal body and footer from `draftStatuses`.
   * @param {{ focusSelector?: string }} [renderOpts]
   */
  function renderDraft(renderOpts = {}) {
    const state = store.getState();
    const readOnly = state.readOnly;

    const form = document.createElement('form');
    form.id = 'form-task-statuses';
    form.noValidate = true;
    form.className = 'lc-status-form';

    const intro = document.createElement('p');
    intro.className = 'cv-hint';
    intro.style.margin = '0';
    intro.textContent =
      'Définissez les colonnes du Kanban et leur rôle métier. Un statut initial identifie le point d’entrée ; un statut terminal clôture la tâche et empêche d’y ajouter de nouveaux liens.';

    const listGroup = document.createElement('div');
    listGroup.className = 'lc-status-list';
    listGroup.setAttribute('role', 'group');
    listGroup.setAttribute('aria-label', 'Colonnes du Kanban');

    if (draftStatuses.length === 0) {
      const emptyHint = document.createElement('p');
      emptyHint.className = 'cv-caption';
      emptyHint.style.margin = '0';
      emptyHint.textContent =
        'Aucun statut configuré. Ajoutez un statut ci-dessous ou restaurez les statuts par défaut.';
      listGroup.append(emptyHint);
    }

    draftStatuses.forEach((statusItem, idx) => {
      const row = document.createElement('div');
      row.className = 'lc-status-row';
      row.dataset.statusId = statusItem.id;

      const field = document.createElement('div');
      field.className = 'cv-field lc-status-row__field';

      const label = document.createElement('label');
      label.className = 'lc-sr-only';
      const inputId = `status-label-input-${statusItem.id}`;
      const errorId = `status-label-error-${statusItem.id}`;
      label.htmlFor = inputId;
      label.textContent = `Libellé du statut ${idx + 1}`;

      const input = document.createElement('input');
      input.id = inputId;
      input.type = 'text';
      input.className = 'cv-input';
      input.required = true;
      input.maxLength = 60;
      input.disabled = readOnly;
      input.value = statusItem.label;
      input.dataset.statusIndex = String(idx);
      input.dataset.statusId = statusItem.id;

      const errSpan = document.createElement('span');
      errSpan.id = errorId;
      errSpan.className = 'cv-error';
      errSpan.hidden = true;
      const errIcon = document.createElement('i');
      errIcon.className = 'ph ph-warning-circle cv-icon';
      errIcon.setAttribute('aria-hidden', 'true');
      const errText = document.createElement('span');
      errText.textContent = 'Saisissez un libellé de statut.';
      errSpan.append(errIcon, errText);

      input.addEventListener('input', () => {
        statusItem.label = input.value;
        if (input.value.trim()) {
          input.removeAttribute('aria-invalid');
          input.removeAttribute('aria-describedby');
          errSpan.hidden = true;
        }
      });

      field.append(label, input, errSpan);

      const roleWrap = document.createElement('div');
      roleWrap.className = 'cv-select lc-status-row__role';
      const roleSelect = document.createElement('select');
      roleSelect.id = `status-role-select-${statusItem.id}`;
      roleSelect.className = 'cv-input';
      roleSelect.disabled = readOnly;
      roleSelect.dataset.statusRoleIndex = String(idx);
      roleSelect.setAttribute('aria-label', `Rôle du statut ${idx + 1}`);
      for (const [val, txt] of /** @type {const} */ ([
        ['none', 'Intermédiaire'],
        ['initial', 'Initial'],
        ['terminal', 'Terminal'],
      ])) {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = txt;
        roleSelect.append(opt);
      }
      roleSelect.value = roleValueOf(statusItem);

      const roleBadgeSlot = document.createElement('span');
      roleBadgeSlot.className = 'lc-status-row__role-badge';
      const syncRoleBadgeSlot = () => {
        const badge = makeRoleBadge(roleValueOf(statusItem));
        roleBadgeSlot.replaceChildren(...(badge ? [badge] : []));
      };
      syncRoleBadgeSlot();

      roleSelect.addEventListener('change', () => {
        statusItem.isInitial = roleSelect.value === 'initial';
        statusItem.isTerminal = roleSelect.value === 'terminal';
        syncRoleBadgeSlot();
      });
      roleWrap.append(roleSelect);

      const actions = document.createElement('div');
      actions.className = 'lc-status-row__actions';

      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm';
      upBtn.disabled = readOnly || idx === 0;
      upBtn.dataset.moveUp = statusItem.id;
      upBtn.setAttribute('aria-label', `Monter le statut ${statusItem.label || String(idx + 1)}`);
      setTooltip(upBtn, 'Monter le statut');
      const upIc = document.createElement('i');
      upIc.className = 'ph ph-arrow-up cv-icon';
      upIc.setAttribute('aria-hidden', 'true');
      upBtn.append(upIc);
      upBtn.addEventListener('click', () => {
        if (idx <= 0) return;
        syncDraftFromInputs();
        const prev = draftStatuses[idx - 1];
        const curr = draftStatuses[idx];
        if (!prev || !curr) return;
        draftStatuses[idx - 1] = curr;
        draftStatuses[idx] = prev;
        renderDraft({ focusSelector: `[data-move-up="${CSS.escape(statusItem.id)}"]` });
      });

      const downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.className = 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm';
      downBtn.disabled = readOnly || idx === draftStatuses.length - 1;
      downBtn.dataset.moveDown = statusItem.id;
      downBtn.setAttribute(
        'aria-label',
        `Descendre le statut ${statusItem.label || String(idx + 1)}`,
      );
      setTooltip(downBtn, 'Descendre le statut');
      const downIc = document.createElement('i');
      downIc.className = 'ph ph-arrow-down cv-icon';
      downIc.setAttribute('aria-hidden', 'true');
      downBtn.append(downIc);
      downBtn.addEventListener('click', () => {
        if (idx >= draftStatuses.length - 1) return;
        syncDraftFromInputs();
        const next = draftStatuses[idx + 1];
        const curr = draftStatuses[idx];
        if (!next || !curr) return;
        draftStatuses[idx + 1] = curr;
        draftStatuses[idx] = next;
        renderDraft({ focusSelector: `[data-move-down="${CSS.escape(statusItem.id)}"]` });
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm';
      delBtn.disabled = readOnly;
      delBtn.dataset.deleteStatus = statusItem.id;
      delBtn.setAttribute(
        'aria-label',
        `Supprimer le statut ${statusItem.label || String(idx + 1)}`,
      );
      setTooltip(delBtn, 'Supprimer le statut');
      const delIc = document.createElement('i');
      delIc.className = 'ph ph-trash cv-icon';
      delIc.setAttribute('aria-hidden', 'true');
      delBtn.append(delIc);
      delBtn.addEventListener('click', () => {
        syncDraftFromInputs();
        draftStatuses = draftStatuses.filter((item) => item.id !== statusItem.id);
        renderDraft({ focusSelector: '#new-status-label-input' });
      });

      actions.append(roleBadgeSlot, upBtn, downBtn, delBtn);
      row.append(field, roleWrap, actions);
      listGroup.append(row);
    });

    // Add new status row
    const addField = document.createElement('div');
    addField.className = 'cv-field';
    const addLabel = document.createElement('label');
    addLabel.className = 'cv-label';
    addLabel.htmlFor = 'new-status-label-input';
    addLabel.textContent = 'Ajouter un statut';

    const addRow = document.createElement('div');
    addRow.className = 'lc-checklist__add lc-status-add-row';
    const addInput = document.createElement('input');
    addInput.id = 'new-status-label-input';
    addInput.type = 'text';
    addInput.className = 'cv-input';
    addInput.maxLength = 60;
    addInput.placeholder = 'Ex. En revue';
    addInput.disabled = readOnly;

    const addRoleWrap = document.createElement('div');
    addRoleWrap.className = 'cv-select lc-status-row__role';
    const addRoleSelect = document.createElement('select');
    addRoleSelect.id = 'new-status-role-select';
    addRoleSelect.className = 'cv-input';
    addRoleSelect.disabled = readOnly;
    addRoleSelect.setAttribute('aria-label', 'Rôle du nouveau statut');
    for (const [val, txt] of /** @type {const} */ ([
      ['none', 'Intermédiaire'],
      ['initial', 'Initial'],
      ['terminal', 'Terminal'],
    ])) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = txt;
      addRoleSelect.append(opt);
    }
    addRoleWrap.append(addRoleSelect);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.id = 'btn-add-status';
    addBtn.className = 'cv-btn';
    addBtn.disabled = readOnly;
    addBtn.textContent = 'Ajouter';

    const addError = document.createElement('span');
    addError.id = 'new-status-label-error';
    addError.className = 'cv-error';
    addError.hidden = true;
    const addErrIcon = document.createElement('i');
    addErrIcon.className = 'ph ph-warning-circle cv-icon';
    addErrIcon.setAttribute('aria-hidden', 'true');
    const addErrText = document.createElement('span');
    addErrText.textContent = 'Saisissez un libellé pour ajouter un statut.';
    addError.append(addErrIcon, addErrText);

    function handleAddStatus() {
      syncDraftFromInputs();
      const cleanLabel = addInput.value.trim();
      if (!cleanLabel) {
        addInput.setAttribute('aria-invalid', 'true');
        addInput.setAttribute('aria-describedby', 'new-status-label-error');
        addError.hidden = false;
        addInput.focus();
        return;
      }
      addInput.removeAttribute('aria-invalid');
      addInput.removeAttribute('aria-describedby');
      addError.hidden = true;
      const existingIds = [
        ...draftStatuses.map((s) => s.id),
        ...state.tasks.map((t) => t.status).filter((s) => typeof s === 'string'),
      ];
      const newId = createTaskStatusId(cleanLabel, existingIds);
      const roleVal = addRoleSelect.value;
      draftStatuses.push({
        id: newId,
        label: cleanLabel.slice(0, 60),
        isInitial: roleVal === 'initial',
        isTerminal: roleVal === 'terminal',
      });
      renderDraft({ focusSelector: '#new-status-label-input' });
    }

    addBtn.addEventListener('click', handleAddStatus);
    addInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleAddStatus();
      }
    });
    addInput.addEventListener('input', () => {
      if (addInput.value.trim()) {
        addInput.removeAttribute('aria-invalid');
        addInput.removeAttribute('aria-describedby');
        addError.hidden = true;
      }
    });

    addRow.append(addInput, addRoleWrap, addBtn);
    addField.append(addLabel, addRow, addError);

    form.append(intro, listGroup, addField);
    modalBody.replaceChildren(form);
    initTooltips(modalBody);

    // Footer buttons
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.id = 'btn-reset-statuses';
    resetBtn.className = 'cv-btn cv-btn--ghost';
    resetBtn.style.marginRight = 'auto';
    resetBtn.disabled = readOnly;
    resetBtn.textContent = 'Valeurs par défaut';
    resetBtn.addEventListener('click', () => {
      draftStatuses = DEFAULT_TASK_STATUSES.map((s) => ({
        id: s.id,
        label: s.label,
        ...(s.isInitial ? { isInitial: true } : {}),
        ...(s.isTerminal ? { isTerminal: true } : {}),
      }));
      renderDraft({ focusSelector: '#btn-reset-statuses' });
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'cv-btn';
    cancelBtn.setAttribute('data-cv-close', '');
    cancelBtn.textContent = 'Annuler';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.setAttribute('form', 'form-task-statuses');
    saveBtn.className = 'cv-btn cv-btn--primary';
    saveBtn.id = 'btn-save-statuses';
    saveBtn.disabled = readOnly;
    saveBtn.textContent = 'Enregistrer';

    modalFooter.replaceChildren(resetBtn, cancelBtn, saveBtn);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (readOnly) return;
      syncDraftFromInputs();

      // If the user typed a new status in the "Add" input without clicking "Ajouter", include it
      const pendingNew = addInput.value.trim();
      if (pendingNew) {
        const existingIds = [
          ...draftStatuses.map((s) => s.id),
          ...state.tasks.map((t) => t.status).filter((s) => typeof s === 'string'),
        ];
        const newId = createTaskStatusId(pendingNew, existingIds);
        const roleVal = addRoleSelect.value;
        draftStatuses.push({
          id: newId,
          label: pendingNew.slice(0, 60),
          isInitial: roleVal === 'initial',
          isTerminal: roleVal === 'terminal',
        });
        addInput.value = '';
      }

      // Validate that every existing row has a non-empty label
      const inputs = modalBody.querySelectorAll('input[data-status-index]');
      for (const input of inputs) {
        if (!(input instanceof HTMLInputElement)) continue;
        if (!input.value.trim()) {
          const statusId = input.dataset.statusId ?? '';
          const errId = `status-label-error-${statusId}`;
          const errEl = document.getElementById(errId);
          input.setAttribute('aria-invalid', 'true');
          input.setAttribute('aria-describedby', errId);
          if (errEl) errEl.hidden = false;
          input.focus();
          return;
        }
      }

      /** @type {readonly TaskStatusConfig[]} */
      const cleaned = normalizeTaskStatuses(draftStatuses);
      store.dispatch({
        type: 'set_task_statuses',
        statuses: cleaned,
      });
      closeDialogById('modal-statuses');
      notify({
        status: 'success',
        title: 'Statuts mis à jour',
        text: `${cleaned.length} ${cleaned.length > 1 ? 'statuts configurés' : 'statut configuré'} pour le Kanban.`,
      });
    });

    if (renderOpts.focusSelector) {
      const target = /** @type {HTMLElement | null} */ (
        modalDialog.querySelector(renderOpts.focusSelector)
      );
      target?.focus();
    }
  }

  function resetDraftFromStore() {
    const current = store.getState().preferences.taskStatuses;
    draftStatuses = current.map((s) => ({
      id: s.id,
      label: s.label,
      ...(s.isInitial ? { isInitial: true } : {}),
      ...(s.isTerminal ? { isTerminal: true } : {}),
    }));
    renderDraft();
  }

  const observer = new MutationObserver(() => {
    if (modalDialog.open) {
      resetDraftFromStore();
    }
  });
  observer.observe(modalDialog, { attributes: true, attributeFilter: ['open'] });

  modalDialog.addEventListener('close', () => {
    modalDialog.returnValue = '';
  });
}
