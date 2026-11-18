import { setTooltip } from './tooltip.js';

/** @import { LocalTemplate } from '../../types.d.ts' */

/**
 * Reusable accessible Covenant bar to apply, save, or delete local templates
 * (task checklists, note outlines, and whiteboard canvases).
 * Never uses window.prompt(); saving uses an inline accessible input bar.
 * @param {{
 *   idPrefix: string;
 *   labelText: string;
 *   templates: readonly LocalTemplate[];
 *   readOnly: boolean;
 *   showSave?: boolean;
 *   onApply: (template: LocalTemplate) => void | Promise<void>;
 *   onSaveNew?: (name: string) => string | null | false | void;
 *   onDeleteCustom?: (template: LocalTemplate) => void | Promise<void>;
 * }} opts
 * @returns {{
 *   element: HTMLElement;
 *   setTemplates: (nextTemplates: readonly LocalTemplate[], selectId?: string) => void;
 * }}
 */
export function createTemplatePicker({
  idPrefix,
  labelText,
  templates: initialTemplates,
  readOnly,
  showSave = true,
  onApply,
  onSaveNew,
  onDeleteCustom,
}) {
  /** @type {LocalTemplate[]} */
  let currentTemplates = [...initialTemplates];

  const wrap = document.createElement('div');
  wrap.className = 'lc-template-bar';

  const row = document.createElement('div');
  row.className = 'lc-template-bar__row';

  const selectField = document.createElement('div');
  selectField.className = 'lc-template-bar__select';

  const label = document.createElement('label');
  label.className = 'cv-label';
  label.htmlFor = `${idPrefix}-select`;
  label.textContent = labelText;

  const selectWrap = document.createElement('div');
  selectWrap.className = 'cv-select';
  const select = document.createElement('select');
  select.id = `${idPrefix}-select`;
  select.className = 'cv-input';
  select.disabled = readOnly;
  selectWrap.append(select);
  selectField.append(label, selectWrap);

  const actions = document.createElement('div');
  actions.className = 'lc-template-bar__actions';

  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.id = `${idPrefix}-apply`;
  applyBtn.className = 'cv-btn cv-btn--sm';
  applyBtn.disabled = readOnly;
  const applyIc = document.createElement('i');
  applyIc.className = 'ph ph-sparkle cv-icon';
  applyIc.setAttribute('aria-hidden', 'true');
  applyBtn.append(applyIc, document.createTextNode(' Appliquer'));

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.id = `${idPrefix}-delete`;
  deleteBtn.className = 'cv-btn cv-btn--ghost cv-btn--sm';
  deleteBtn.setAttribute('aria-label', 'Supprimer le modèle sélectionné');
  setTooltip(deleteBtn, 'Supprimer ce modèle personnalisé');
  deleteBtn.hidden = true;
  const delIc = document.createElement('i');
  delIc.className = 'ph ph-trash cv-icon';
  delIc.setAttribute('aria-hidden', 'true');
  deleteBtn.append(delIc);

  actions.append(applyBtn, deleteBtn);

  /** @type {HTMLButtonElement | null} */
  let saveOpenBtn = null;
  if (showSave && onSaveNew) {
    saveOpenBtn = document.createElement('button');
    saveOpenBtn.type = 'button';
    saveOpenBtn.id = `${idPrefix}-save-open`;
    saveOpenBtn.className = 'cv-btn cv-btn--ghost cv-btn--sm';
    saveOpenBtn.disabled = readOnly;
    const saveIc = document.createElement('i');
    saveIc.className = 'ph ph-bookmark-simple cv-icon';
    saveIc.setAttribute('aria-hidden', 'true');
    saveOpenBtn.append(saveIc, document.createTextNode(' Enregistrer comme modèle'));
    actions.append(saveOpenBtn);
  }

  row.append(selectField, actions);
  wrap.append(row);

  // Inline save form bar (collapsible, never submits outer <form>)
  const saveBar = document.createElement('div');
  saveBar.className = 'lc-template-bar__save';
  saveBar.id = `${idPrefix}-save-bar`;
  saveBar.hidden = true;

  const nameLabel = document.createElement('label');
  nameLabel.className = 'cv-label lc-sr-only';
  nameLabel.htmlFor = `${idPrefix}-name-input`;
  nameLabel.textContent = 'Nom du nouveau modèle';

  const nameInput = document.createElement('input');
  nameInput.id = `${idPrefix}-name-input`;
  nameInput.type = 'text';
  nameInput.className = 'cv-input';
  nameInput.maxLength = 120;
  nameInput.placeholder = 'Nom du modèle local';
  nameInput.disabled = readOnly;

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.id = `${idPrefix}-save-confirm`;
  confirmBtn.className = 'cv-btn cv-btn--primary cv-btn--sm';
  confirmBtn.textContent = 'Valider';
  confirmBtn.disabled = readOnly;

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.id = `${idPrefix}-save-cancel`;
  cancelBtn.className = 'cv-btn cv-btn--sm';
  cancelBtn.textContent = 'Annuler';

  saveBar.append(nameLabel, nameInput, confirmBtn, cancelBtn);
  if (showSave && onSaveNew) {
    wrap.append(saveBar);
  }

  function getSelectedTemplate() {
    const id = select.value;
    return currentTemplates.find((t) => t.id === id) ?? null;
  }

  function syncButtons() {
    const selected = getSelectedTemplate();
    applyBtn.disabled = readOnly || !selected;
    const canDelete = Boolean(!readOnly && selected && !selected.builtin && onDeleteCustom);
    deleteBtn.hidden = !canDelete;
    deleteBtn.disabled = !canDelete;
  }

  /**
   * @param {readonly LocalTemplate[]} nextTemplates
   * @param {string} [selectId]
   */
  function rebuildOptions(nextTemplates, selectId) {
    const prevValue = selectId ?? select.value;
    currentTemplates = [...nextTemplates];
    select.replaceChildren();

    const builtins = currentTemplates.filter((t) => Boolean(t.builtin));
    const custom = currentTemplates.filter((t) => !t.builtin);

    if (builtins.length > 0) {
      const grp = document.createElement('optgroup');
      grp.label = 'Modèles intégrés';
      for (const tpl of builtins) {
        const opt = document.createElement('option');
        opt.value = tpl.id;
        opt.textContent = tpl.name;
        grp.append(opt);
      }
      select.append(grp);
    }

    if (custom.length > 0) {
      const grp = document.createElement('optgroup');
      grp.label = 'Mes modèles locaux';
      for (const tpl of custom) {
        const opt = document.createElement('option');
        opt.value = tpl.id;
        opt.textContent = tpl.name;
        grp.append(opt);
      }
      select.append(grp);
    }

    if (prevValue && currentTemplates.some((t) => t.id === prevValue)) {
      select.value = prevValue;
    } else if (currentTemplates[0]) {
      select.value = currentTemplates[0].id;
    }
    syncButtons();
  }

  select.addEventListener('change', syncButtons);

  applyBtn.addEventListener('click', () => {
    if (readOnly) return;
    const selected = getSelectedTemplate();
    if (selected) void onApply(selected);
  });

  deleteBtn.addEventListener('click', () => {
    if (readOnly || !onDeleteCustom) return;
    const selected = getSelectedTemplate();
    if (selected && !selected.builtin) {
      void onDeleteCustom(selected);
    }
  });

  function closeSaveBar() {
    saveBar.hidden = true;
    nameInput.value = '';
    saveOpenBtn?.focus();
  }

  function submitSave() {
    if (readOnly || !onSaveNew) return;
    const clean = nameInput.value.trim();
    if (!clean) {
      nameInput.focus();
      return;
    }
    const result = onSaveNew(clean);
    if (result !== false) {
      saveBar.hidden = true;
      nameInput.value = '';
    }
  }

  saveOpenBtn?.addEventListener('click', () => {
    if (readOnly) return;
    saveBar.hidden = !saveBar.hidden;
    if (!saveBar.hidden) {
      nameInput.focus();
    }
  });

  confirmBtn.addEventListener('click', submitSave);
  cancelBtn.addEventListener('click', closeSaveBar);

  nameInput.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      submitSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeSaveBar();
    }
  });

  rebuildOptions(currentTemplates);

  return {
    element: wrap,
    setTemplates: rebuildOptions,
  };
}
