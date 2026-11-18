/** @import { AppState, LocalEntityKind, LocalRef } from '../../types.d.ts' */

import { isTerminalTaskStatus, normalizeLocalRefs } from '../../core/model.js';
import {
  isNoteEffectivelyArchived,
  isTaskEffectivelyArchived,
  isWhiteboardEffectivelyArchived,
  selectEntityLinkEntries,
} from '../../core/store.js';
import { initTooltips, setTooltip } from './tooltip.js';

/** @type {Readonly<Record<LocalEntityKind, { icon: string; label: string }>>} */
const KIND_META = {
  task: { icon: 'ph-check-square', label: 'Tâche' },
  note: { icon: 'ph-notebook', label: 'Note' },
  whiteboard: { icon: 'ph-chalkboard-simple', label: 'Tableau' },
};

/**
 * Create a local-reference linker component for Tasks, Notes, and Whiteboards.
 * Displays outgoing links (editable unless `viewOnly`), incoming backlinks (read-only navigation),
 * and a grouped target selector filtered against archived items and terminal tasks.
 *
 * @param {{
 *   idPrefix: string;
 *   state: AppState;
 *   currentRef: LocalRef | null;
 *   initialLinks?: readonly LocalRef[];
 *   readOnly: boolean;
 *   viewOnly?: boolean;
 *   sourceTerminal?: boolean;
 *   onChange?: (links: readonly LocalRef[]) => void;
 *   onNavigate?: (ref: LocalRef) => void;
 * }} opts
 * @returns {{
 *   element: HTMLElement;
 *   getLinks: () => readonly LocalRef[];
 *   setLinks: (nextLinks: readonly LocalRef[]) => void;
 *   setSourceTerminal: (nextTerminal: boolean) => void;
 * }}
 */
export function createLinkEditor({
  idPrefix,
  state,
  currentRef,
  initialLinks = [],
  readOnly,
  viewOnly = false,
  sourceTerminal = false,
  onChange,
  onNavigate,
}) {
  /** @type {LocalRef[]} */
  let links = [...normalizeLocalRefs(initialLinks, currentRef)];
  let terminalLocked = Boolean(sourceTerminal);

  const wrapper = document.createElement('div');
  wrapper.className = viewOnly
    ? 'cv-field lc-links-field lc-links-field--readonly'
    : 'cv-field lc-links-field';

  const label = document.createElement(viewOnly ? 'span' : 'label');
  label.className = 'cv-label';
  if (!viewOnly && label instanceof HTMLLabelElement) {
    label.htmlFor = `${idPrefix}-select`;
  }
  label.textContent = 'Éléments liés';

  const outgoingList = document.createElement('div');
  outgoingList.id = `${idPrefix}-list`;
  outgoingList.className = 'lc-links-list';
  outgoingList.setAttribute('aria-live', 'polite');

  const backlinksWrap = document.createElement('div');
  backlinksWrap.id = `${idPrefix}-backlinks`;
  backlinksWrap.className = 'lc-links-backlinks';

  const addRow = document.createElement('div');
  addRow.className = 'lc-checklist__add';

  const select = document.createElement('select');
  select.id = `${idPrefix}-select`;
  select.className = 'cv-input';
  select.disabled = readOnly || terminalLocked;
  select.setAttribute('aria-label', 'Sélectionner une tâche, note ou tableau blanc à lier');

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.id = `${idPrefix}-add`;
  addBtn.className = 'cv-btn cv-btn--sm';
  addBtn.disabled = readOnly || terminalLocked;
  addBtn.textContent = 'Lier';

  const terminalHint = document.createElement('p');
  terminalHint.id = `${idPrefix}-terminal-hint`;
  terminalHint.className = 'cv-hint';
  terminalHint.style.margin = '0';
  terminalHint.textContent =
    'Statut terminal : il n’est plus possible d’ajouter de nouveaux liens à cette tâche.';
  terminalHint.hidden = !terminalLocked;

  /**
   * Build a clickable link pill (and optional remove button).
   * @param {{
   *   kind: LocalEntityKind;
   *   id: string;
   *   title: string;
   *   projectName: string | null;
   *   archived?: boolean;
   *   terminal?: boolean;
   * }} entry
   * @param {boolean} removable
   * @returns {HTMLElement}
   */
  function makeLinkPill(entry, removable) {
    const meta = KIND_META[entry.kind];
    const chip = document.createElement('div');
    chip.className = 'lc-link-chip';
    chip.dataset.linkKind = entry.kind;
    chip.dataset.linkId = entry.id;

    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'cv-btn cv-btn--ghost cv-btn--sm lc-link-chip__open';
    const ic = document.createElement('i');
    ic.className = `ph ${meta.icon} cv-icon`;
    ic.setAttribute('aria-hidden', 'true');
    const txt = document.createElement('span');
    txt.textContent = entry.projectName
      ? `${meta.label} · ${entry.title} (${entry.projectName})`
      : `${meta.label} · ${entry.title}`;
    openBtn.append(ic, txt);
    openBtn.setAttribute('aria-label', `Ouvrir ${meta.label.toLowerCase()} « ${entry.title} »`);
    openBtn.addEventListener('click', () => {
      onNavigate?.({ kind: entry.kind, id: entry.id });
    });

    chip.append(openBtn);

    if (entry.terminal) {
      const termBadge = document.createElement('span');
      termBadge.className = 'cv-badge cv-badge--success';
      termBadge.textContent = 'Terminal';
      chip.append(termBadge);
    }

    if (entry.archived) {
      const archBadge = document.createElement('span');
      archBadge.className = 'cv-badge';
      archBadge.textContent = 'Archivé';
      chip.append(archBadge);
    }

    if (removable && !readOnly && !viewOnly) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'lc-tag-chip__remove';
      removeBtn.setAttribute('aria-label', `Retirer le lien vers « ${entry.title} »`);
      setTooltip(removeBtn, 'Retirer le lien');
      const xIc = document.createElement('i');
      xIc.className = 'ph ph-x cv-icon';
      xIc.setAttribute('aria-hidden', 'true');
      removeBtn.append(xIc);
      removeBtn.addEventListener('click', () => {
        links = links.filter((r) => !(r.kind === entry.kind && r.id === entry.id));
        render();
        onChange?.([...links]);
      });
      chip.append(removeBtn);
    }

    return chip;
  }

  function renderSelectOptions() {
    if (viewOnly) return;
    const linkedKeys = new Set(links.map((r) => `${r.kind}:${r.id}`));
    if (currentRef) linkedKeys.add(`${currentRef.kind}:${currentRef.id}`);

    select.replaceChildren();
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = terminalLocked
      ? 'Liaison bloquée (statut terminal)'
      : 'Choisir un élément à lier…';
    select.append(emptyOpt);

    const configuredStatuses = state.preferences.taskStatuses;
    const activeTasks = state.tasks.filter(
      (t) =>
        !linkedKeys.has(`task:${t.id}`) &&
        !isTaskEffectivelyArchived(t, state.projects) &&
        !isTerminalTaskStatus(t.status, configuredStatuses),
    );
    const activeNotes = state.notes.filter(
      (n) => !linkedKeys.has(`note:${n.id}`) && !isNoteEffectivelyArchived(n, state.projects),
    );
    const activeWhiteboards = state.whiteboards.filter(
      (w) =>
        !linkedKeys.has(`whiteboard:${w.id}`) &&
        !isWhiteboardEffectivelyArchived(w, state.projects),
    );

    const groups = /** @type {const} */ ([
      ['Tâches', 'task', activeTasks],
      ['Notes', 'note', activeNotes],
      ['Tableaux blancs', 'whiteboard', activeWhiteboards],
    ]);

    let availableCount = 0;
    for (const [groupLabel, kind, items] of groups) {
      if (items.length === 0) continue;
      const optgroup = document.createElement('optgroup');
      optgroup.label = groupLabel;
      for (const it of items) {
        const opt = document.createElement('option');
        opt.value = `${kind}:${it.id}`;
        opt.textContent = it.title;
        optgroup.append(opt);
        availableCount += 1;
      }
      select.append(optgroup);
    }

    const disableAdd = readOnly || terminalLocked || availableCount === 0;
    addBtn.disabled = disableAdd;
    select.disabled = disableAdd;
    terminalHint.hidden = !terminalLocked;
  }

  function render() {
    const resolved = currentRef
      ? selectEntityLinkEntries(state, currentRef.kind, currentRef.id, links)
      : selectEntityLinkEntries(state, 'task', '__new__', links);

    outgoingList.replaceChildren();
    if (resolved.outgoing.length === 0) {
      if (viewOnly && resolved.incoming.length === 0) {
        outgoingList.hidden = false;
        const emptyMsg = document.createElement('span');
        emptyMsg.className = 'cv-caption';
        emptyMsg.textContent = 'Aucun élément lié.';
        outgoingList.append(emptyMsg);
      } else {
        outgoingList.hidden = true;
      }
    } else {
      outgoingList.hidden = false;
      for (const entry of resolved.outgoing) {
        outgoingList.append(makeLinkPill(entry, !viewOnly));
      }
    }

    backlinksWrap.replaceChildren();
    if (resolved.incoming.length === 0) {
      backlinksWrap.hidden = true;
    } else {
      backlinksWrap.hidden = false;
      const backLabel = document.createElement('span');
      backLabel.className = 'cv-caption';
      backLabel.textContent = 'Lié depuis :';
      backlinksWrap.append(backLabel);
      for (const entry of resolved.incoming) {
        backlinksWrap.append(makeLinkPill(entry, false));
      }
    }

    initTooltips(outgoingList);
    renderSelectOptions();
  }

  if (!viewOnly) {
    addBtn.addEventListener('click', () => {
      if (readOnly || terminalLocked || !select.value) return;
      const colonIdx = select.value.indexOf(':');
      if (colonIdx === -1) return;
      const kind = /** @type {LocalEntityKind} */ (select.value.slice(0, colonIdx));
      const id = select.value.slice(colonIdx + 1);
      const next = [...normalizeLocalRefs([...links, { kind, id }], currentRef)];
      const changed = next.length !== links.length;
      links = next;
      render();
      if (changed) {
        onChange?.([...links]);
      }
    });
  }

  render();

  if (viewOnly) {
    wrapper.append(label, outgoingList, backlinksWrap);
  } else {
    addRow.append(select, addBtn);
    wrapper.append(label, outgoingList, backlinksWrap, addRow, terminalHint);
  }

  return {
    element: wrapper,
    getLinks() {
      return [...links];
    },
    setLinks(nextLinks) {
      links = [...normalizeLocalRefs(nextLinks, currentRef)];
      render();
    },
    setSourceTerminal(nextTerminal) {
      const normalized = Boolean(nextTerminal);
      if (normalized === terminalLocked) return;
      terminalLocked = normalized;
      renderSelectOptions();
    },
  };
}
