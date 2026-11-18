import { normalizeTags, parseTagsInput } from '../../core/model.js';
import { initTooltips, setTooltip } from './tooltip.js';

/**
 * Create an accessible tag editor (or pure view-only tag display) widget.
 * When `viewOnly` is true, renders only read-only tag pills without any input controls.
 *
 * @param {{
 *   idPrefix: string;
 *   labelText?: string;
 *   initialTags?: readonly string[];
 *   suggestions?: readonly string[];
 *   readOnly: boolean;
 *   viewOnly?: boolean;
 *   onChange?: (tags: readonly string[]) => void;
 * }} opts
 * @returns {{
 *   element: HTMLElement;
 *   getTags: () => readonly string[];
 *   commitPending: () => readonly string[];
 *   setTags: (nextTags: readonly string[]) => void;
 * }}
 */
export function createTagEditor({
  idPrefix,
  labelText = 'Étiquettes',
  initialTags = [],
  suggestions = [],
  readOnly,
  viewOnly = false,
  onChange,
}) {
  /** @type {string[]} */
  let tags = [...normalizeTags(initialTags)];
  let composing = false;

  const wrapper = document.createElement('div');
  wrapper.className = viewOnly
    ? 'cv-field lc-tags-field lc-tags-field--readonly'
    : 'cv-field lc-tags-field';

  const label = document.createElement(viewOnly ? 'span' : 'label');
  label.className = 'cv-label';
  if (!viewOnly && label instanceof HTMLLabelElement) {
    label.htmlFor = `${idPrefix}-input`;
  }
  label.textContent = labelText;

  const chipsBox = document.createElement('div');
  chipsBox.id = `${idPrefix}-chips`;
  chipsBox.className = 'lc-tags-chips';
  chipsBox.setAttribute('aria-live', 'polite');

  const inputRow = document.createElement('div');
  inputRow.className = 'lc-checklist__add';

  const datalistId = `${idPrefix}-datalist`;
  const datalist = document.createElement('datalist');
  datalist.id = datalistId;

  const input = document.createElement('input');
  input.id = `${idPrefix}-input`;
  input.type = 'text';
  input.className = 'cv-input';
  input.placeholder = 'Ex. urgent, client-a (Entrée ou virgule)';
  input.maxLength = 120;
  input.disabled = readOnly;
  input.setAttribute('list', datalistId);

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.id = `${idPrefix}-add`;
  addBtn.className = 'cv-btn cv-btn--sm';
  addBtn.disabled = readOnly;
  addBtn.textContent = 'Ajouter l’étiquette';

  function refreshDatalist() {
    if (viewOnly) return;
    const activeLower = new Set(tags.map((t) => t.toLowerCase()));
    datalist.replaceChildren();
    for (const s of suggestions) {
      if (!activeLower.has(s.toLowerCase())) {
        const opt = document.createElement('option');
        opt.value = s;
        datalist.append(opt);
      }
    }
  }

  function renderChips() {
    chipsBox.replaceChildren();
    if (tags.length === 0) {
      if (viewOnly) {
        chipsBox.hidden = false;
        const emptyMsg = document.createElement('span');
        emptyMsg.className = 'cv-caption';
        emptyMsg.textContent = 'Aucune étiquette.';
        chipsBox.append(emptyMsg);
      } else {
        chipsBox.hidden = true;
      }
    } else {
      chipsBox.hidden = false;
      for (const tag of tags) {
        const chip = document.createElement('span');
        chip.className = 'cv-tag lc-tag-chip';
        chip.dataset.tag = tag;

        const txt = document.createElement('span');
        txt.textContent = `#${tag}`;
        chip.append(txt);

        if (!readOnly && !viewOnly) {
          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'lc-tag-chip__remove';
          removeBtn.setAttribute('aria-label', `Retirer l’étiquette ${tag}`);
          setTooltip(removeBtn, 'Retirer l’étiquette');
          const ic = document.createElement('i');
          ic.className = 'ph ph-x cv-icon';
          ic.setAttribute('aria-hidden', 'true');
          removeBtn.append(ic);
          removeBtn.addEventListener('click', () => {
            tags = tags.filter((t) => t.toLowerCase() !== tag.toLowerCase());
            renderChips();
            refreshDatalist();
            onChange?.([...tags]);
          });
          chip.append(removeBtn);
        }

        chipsBox.append(chip);
      }
      initTooltips(chipsBox);
    }
  }

  /**
   * Commit any tags currently typed inside the input box.
   * @param {boolean} [emitChange]
   * @returns {readonly string[]}
   */
  function commitPending(emitChange = true) {
    if (viewOnly) return [...tags];
    const raw = input.value.trim();
    if (!raw) return [...tags];
    const parsed = parseTagsInput(raw);
    input.value = '';
    if (parsed.length === 0) return [...tags];
    const merged = [...normalizeTags([...tags, ...parsed])];
    const changed = merged.length !== tags.length || merged.some((val, idx) => val !== tags[idx]);
    tags = merged;
    renderChips();
    refreshDatalist();
    if (changed && emitChange) {
      onChange?.([...tags]);
    }
    return [...tags];
  }

  if (!viewOnly) {
    input.addEventListener('compositionstart', () => {
      composing = true;
    });
    input.addEventListener('compositionend', () => {
      composing = false;
    });
    input.addEventListener('keydown', (event) => {
      if (composing || readOnly) return;
      if (event.key === 'Enter' || event.key === ',') {
        if (input.value.trim()) {
          event.preventDefault();
          commitPending(true);
        } else if (event.key === ',') {
          event.preventDefault();
        }
      }
    });
    input.addEventListener('blur', () => {
      if (!readOnly && input.value.trim()) {
        commitPending(true);
      }
    });
    addBtn.addEventListener('click', () => {
      if (readOnly) return;
      commitPending(true);
      input.focus();
    });
  }

  renderChips();
  refreshDatalist();

  if (viewOnly) {
    wrapper.append(label, chipsBox);
  } else {
    inputRow.append(input, addBtn);
    wrapper.append(label, chipsBox, inputRow, datalist);
  }

  return {
    element: wrapper,
    getTags() {
      return [...tags];
    },
    commitPending() {
      return commitPending(false);
    },
    setTags(nextTags) {
      tags = [...normalizeTags(nextTags)];
      renderChips();
      refreshDatalist();
    },
  };
}
