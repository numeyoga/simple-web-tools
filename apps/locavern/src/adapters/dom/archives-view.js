/** @import { AppCommand, AppState, LocalRef, Note, Project, StoreEffect, Task, Whiteboard } from '../../types.d.ts' */

import { formatShortDateFr, isOffHoursDueTime } from '../../core/dates.js';
import { getTaskRecurrenceLabel, getTaskStatusMeta, getTaskStatusRole } from '../../core/model.js';
import { extractRichTextPlainText, extractWhiteboardSearchText } from '../../core/search.js';
import { selectArchivedEntries, selectEntityLinkEntries } from '../../core/store.js';
import { confirmAction, notify } from './app-shell.js';

/** @type {Readonly<Record<'project' | 'task' | 'note' | 'whiteboard', { label: string; icon: string }>>} */
const KIND_META = {
  project: { label: 'Projet', icon: 'ph-folder-open' },
  task: { label: 'Tâche', icon: 'ph-check-square' },
  note: { label: 'Note', icon: 'ph-notebook' },
  whiteboard: { label: 'Tableau blanc', icon: 'ph-chalkboard-simple' },
};

const PRIORITY_LABELS = {
  high: 'Haute',
  medium: 'Moyenne',
  low: 'Basse',
};

/**
 * Render the dedicated Archives screen allowing users to filter, inspect,
 * restore (unarchive), or send any archived project, task, note, or whiteboard to Trash.
 * Keeps filter controls mounted across searches so focus is preserved.
 *
 * @param {{
 *   container: HTMLElement;
 *   store: {
 *     getState: () => AppState;
 *     dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *   };
 *   filters: {
 *     query: string;
 *     kind: 'all' | 'project' | 'task' | 'note' | 'whiteboard';
 *     projectId: 'all' | '__none__' | string;
 *     tag: 'all' | string;
 *     sortBy: 'archivedAt' | 'updatedAt' | 'title';
 *     selectedKey: string | null;
 *   };
 *   onNavigateLocalRef?: (ref: LocalRef) => void;
 * }} opts
 */
export function renderArchivesView({ container, store, filters, onNavigateLocalRef }) {
  const initialState = store.getState();
  const allArchivedEntries = selectArchivedEntries(initialState, {});

  const header = document.createElement('div');
  header.className = 'lc-view-header';

  const titleGroup = document.createElement('div');
  const titleEl = document.createElement('h2');
  titleEl.className = 'cv-h2';
  titleEl.style.margin = '0';
  titleEl.textContent = 'Archives';
  const subtitleEl = document.createElement('p');
  subtitleEl.className = 'cv-caption';
  subtitleEl.style.margin = '0';
  subtitleEl.textContent = `${allArchivedEntries.length} élément${allArchivedEntries.length > 1 ? 's' : ''} archivé${allArchivedEntries.length > 1 ? 's' : ''}`;
  titleGroup.append(titleEl, subtitleEl);
  header.append(titleGroup);

  const toolbar = document.createElement('div');
  toolbar.className = 'lc-filters-bar';

  // Search input
  const searchField = document.createElement('div');
  searchField.className = 'cv-field';
  const searchLabel = document.createElement('label');
  searchLabel.className = 'cv-label';
  searchLabel.htmlFor = 'archives-search-input';
  searchLabel.textContent = 'Recherche';
  const searchGroup = document.createElement('div');
  searchGroup.className = 'cv-input-group';
  const searchIcon = document.createElement('i');
  searchIcon.className = 'ph ph-magnifying-glass cv-icon';
  searchIcon.setAttribute('aria-hidden', 'true');
  const searchInput = document.createElement('input');
  searchInput.id = 'archives-search-input';
  searchInput.type = 'search';
  searchInput.className = 'cv-input';
  searchInput.placeholder = 'Titre, texte ou contenu…';
  searchInput.value = filters.query;
  searchGroup.append(searchIcon, searchInput);
  searchField.append(searchLabel, searchGroup);

  // Kind filter
  const kindField = document.createElement('div');
  kindField.className = 'cv-field';
  const kindLabel = document.createElement('label');
  kindLabel.className = 'cv-label';
  kindLabel.htmlFor = 'archives-kind-filter';
  kindLabel.textContent = 'Type';
  const kindWrap = document.createElement('div');
  kindWrap.className = 'cv-select';
  const kindSelect = document.createElement('select');
  kindSelect.id = 'archives-kind-filter';
  kindSelect.className = 'cv-input';
  for (const [val, lbl] of /** @type {const} */ ([
    ['all', 'Tous les types'],
    ['project', 'Projets'],
    ['task', 'Tâches'],
    ['note', 'Notes'],
    ['whiteboard', 'Tableaux blancs'],
  ])) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = lbl;
    kindSelect.append(opt);
  }
  kindSelect.value = filters.kind;
  kindWrap.append(kindSelect);
  kindField.append(kindLabel, kindWrap);

  // Project filter (only projects with archived content or archived projects themselves)
  const projField = document.createElement('div');
  projField.className = 'cv-field';
  const projLabel = document.createElement('label');
  projLabel.className = 'cv-label';
  projLabel.htmlFor = 'archives-project-filter';
  projLabel.textContent = 'Projet';
  const projWrap = document.createElement('div');
  projWrap.className = 'cv-select';
  const projSelect = document.createElement('select');
  projSelect.id = 'archives-project-filter';
  projSelect.className = 'cv-input';
  const projAllOpt = document.createElement('option');
  projAllOpt.value = 'all';
  projAllOpt.textContent = 'Tous les projets';
  const projNoneOpt = document.createElement('option');
  projNoneOpt.value = '__none__';
  projNoneOpt.textContent = 'Sans projet';
  projSelect.append(projAllOpt, projNoneOpt);

  /** @type {Set<string>} */
  const archivedProjIds = new Set();
  for (const entry of allArchivedEntries) {
    if (entry.projectId) archivedProjIds.add(entry.projectId);
  }
  for (const p of initialState.projects) {
    if (p.archived || archivedProjIds.has(p.id)) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.archived ? `${p.name} (archivé)` : p.name;
      projSelect.append(opt);
    }
  }
  if (
    filters.projectId !== 'all' &&
    filters.projectId !== '__none__' &&
    !archivedProjIds.has(filters.projectId)
  ) {
    filters.projectId = 'all';
  }
  projSelect.value = filters.projectId;
  projWrap.append(projSelect);
  projField.append(projLabel, projWrap);

  // Tag filter (tags present among archived items)
  const tagField = document.createElement('div');
  tagField.className = 'cv-field';
  const tagLabel = document.createElement('label');
  tagLabel.className = 'cv-label';
  tagLabel.htmlFor = 'archives-tag-filter';
  tagLabel.textContent = 'Étiquette';
  const tagWrap = document.createElement('div');
  tagWrap.className = 'cv-select';
  const tagSelect = document.createElement('select');
  tagSelect.id = 'archives-tag-filter';
  tagSelect.className = 'cv-input';
  const allTagsOpt = document.createElement('option');
  allTagsOpt.value = 'all';
  allTagsOpt.textContent = 'Toutes les étiquettes';
  tagSelect.append(allTagsOpt);
  /** @type {Set<string>} */
  const archivedTags = new Set();
  for (const entry of allArchivedEntries) {
    for (const tag of entry.tags) archivedTags.add(tag);
  }
  const sortedTags = [...archivedTags].sort((a, b) => a.localeCompare(b, 'fr'));
  for (const tag of sortedTags) {
    const opt = document.createElement('option');
    opt.value = tag;
    opt.textContent = `#${tag}`;
    tagSelect.append(opt);
  }
  if (
    filters.tag !== 'all' &&
    !sortedTags.some((t) => t.toLowerCase() === filters.tag.toLowerCase())
  ) {
    filters.tag = 'all';
  }
  tagSelect.value = filters.tag;
  tagWrap.append(tagSelect);
  tagField.append(tagLabel, tagWrap);

  // Sort select
  const sortField = document.createElement('div');
  sortField.className = 'cv-field';
  const sortLabel = document.createElement('label');
  sortLabel.className = 'cv-label';
  sortLabel.htmlFor = 'archives-sort-select';
  sortLabel.textContent = 'Tri';
  const sortWrap = document.createElement('div');
  sortWrap.className = 'cv-select';
  const sortSelect = document.createElement('select');
  sortSelect.id = 'archives-sort-select';
  sortSelect.className = 'cv-input';
  for (const [val, lbl] of /** @type {const} */ ([
    ['archivedAt', 'Archivé récemment'],
    ['updatedAt', 'Modifié récemment'],
    ['title', 'Titre (A–Z)'],
  ])) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = lbl;
    sortSelect.append(opt);
  }
  sortSelect.value = filters.sortBy;
  sortWrap.append(sortSelect);
  sortField.append(sortLabel, sortWrap);

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.id = 'btn-archives-reset-filters';
  resetBtn.className = 'cv-btn cv-btn--ghost cv-btn--sm';
  resetBtn.textContent = 'Réinitialiser';

  toolbar.append(searchField, kindField, projField, tagField, sortField, resetBtn);

  const bodySlot = document.createElement('div');

  /**
   * @param {'project' | 'task' | 'note' | 'whiteboard'} kind
   * @param {string} id
   * @returns {string}
   */
  const entryKey = (kind, id) => `${kind}:${id}`;

  function syncResetButton() {
    const dirty =
      filters.query.trim() !== '' ||
      filters.kind !== 'all' ||
      filters.projectId !== 'all' ||
      filters.tag !== 'all' ||
      filters.sortBy !== 'archivedAt';
    resetBtn.hidden = !dirty;
  }

  function renderBody() {
    syncResetButton();
    const state = store.getState();
    const readOnly = state.readOnly;
    const entries = selectArchivedEntries(state, filters);

    if (entries.length === 0) {
      const totalCount = selectArchivedEntries(state, {}).length;
      const empty = document.createElement('div');
      empty.className = 'cv-empty';
      const iconBox = document.createElement('span');
      iconBox.className = 'cv-empty__icon';
      const ic = document.createElement('i');
      ic.className = 'ph ph-archive cv-icon';
      ic.setAttribute('aria-hidden', 'true');
      iconBox.append(ic);

      const title = document.createElement('p');
      title.className = 'cv-empty__title';
      title.textContent =
        totalCount === 0 ? 'Aucun élément archivé' : 'Aucun élément ne correspond aux filtres';

      const desc = document.createElement('p');
      desc.textContent =
        totalCount === 0
          ? 'Archivez un projet, une tâche, une note ou un tableau blanc pour le retirer de ses écrans habituels tout en le conservant ici.'
          : 'Modifiez vos critères de recherche ou réinitialisez les filtres pour parcourir les archives.';

      empty.append(iconBox, title, desc);
      if (totalCount > 0) {
        const cta = document.createElement('button');
        cta.type = 'button';
        cta.className = 'cv-btn';
        cta.textContent = 'Réinitialiser les filtres';
        cta.addEventListener('click', resetAllFilters);
        empty.append(cta);
      }
      bodySlot.replaceChildren(empty);
      return;
    }

    const activeEntry =
      entries.find((e) => entryKey(e.kind, e.id) === filters.selectedKey) ?? entries[0];
    if (activeEntry) {
      filters.selectedKey = entryKey(activeEntry.kind, activeEntry.id);
    }

    const layout = document.createElement('div');
    layout.className = 'lc-notes-layout lc-archives-layout';

    const listEl = document.createElement('div');
    listEl.className = 'lc-notes-list lc-archives-list';
    listEl.setAttribute('role', 'navigation');
    listEl.setAttribute('aria-label', 'Liste des éléments archivés');

    for (const entry of entries) {
      const k = entryKey(entry.kind, entry.id);
      const km = KIND_META[entry.kind];
      const itemBtn = document.createElement('button');
      itemBtn.type = 'button';
      itemBtn.className = 'lc-note-item lc-archive-item';
      itemBtn.dataset.archiveEntry = k;
      if (activeEntry && entryKey(activeEntry.kind, activeEntry.id) === k) {
        itemBtn.setAttribute('aria-current', 'true');
      }

      const headRow = document.createElement('span');
      headRow.className = 'lc-archive-item__badges';
      const kindBadge = document.createElement('span');
      kindBadge.className = 'cv-badge';
      const kIc = document.createElement('i');
      kIc.className = `ph ${km.icon} cv-icon`;
      kIc.setAttribute('aria-hidden', 'true');
      kindBadge.append(kIc, document.createTextNode(` ${km.label}`));
      headRow.append(kindBadge);

      if (entry.archiveReason === 'project') {
        const viaBadge = document.createElement('span');
        viaBadge.className = 'cv-badge cv-badge--warning';
        viaBadge.textContent = 'Via projet';
        headRow.append(viaBadge);
      }

      const tSpan = document.createElement('span');
      tSpan.className = 'lc-note-item__title';
      tSpan.textContent = entry.title;

      const mSpan = document.createElement('span');
      mSpan.className = 'lc-note-item__meta';
      const archDate = formatShortDateFr(entry.archivedAt.slice(0, 10), true);
      mSpan.textContent =
        entry.projectName && entry.kind !== 'project'
          ? `${entry.projectName} · Archivé le ${archDate}`
          : `Archivé le ${archDate}`;

      itemBtn.append(headRow, tSpan, mSpan);
      itemBtn.addEventListener('click', () => {
        filters.selectedKey = k;
        renderBody();
      });
      listEl.append(itemBtn);
    }

    const detailCard = document.createElement('section');
    detailCard.id = 'archive-detail-panel';
    detailCard.className = 'cv-card lc-archive-detail';
    detailCard.setAttribute('aria-label', 'Détails de l’élément archivé');

    if (activeEntry) {
      const km = KIND_META[activeEntry.kind];

      const detailHead = document.createElement('div');
      detailHead.className = 'lc-archive-detail__head';

      const kindPill = document.createElement('span');
      kindPill.className = 'cv-badge cv-badge--accent';
      const pillIc = document.createElement('i');
      pillIc.className = `ph ${km.icon} cv-icon`;
      pillIc.setAttribute('aria-hidden', 'true');
      kindPill.append(pillIc, document.createTextNode(` ${km.label}`));

      const titleH3 = document.createElement('h3');
      titleH3.className = 'cv-h3';
      titleH3.style.margin = '0';
      titleH3.textContent = activeEntry.title;

      detailHead.append(kindPill, titleH3);

      const originNote = document.createElement('p');
      originNote.className = 'cv-hint';
      originNote.style.margin = '0';
      originNote.textContent =
        activeEntry.archiveReason === 'project' && activeEntry.projectName
          ? `Archivé via le projet « ${activeEntry.projectName} » : désarchiver cet élément réactivera également ce projet.`
          : `Archivé directement le ${formatShortDateFr(activeEntry.archivedAt.slice(0, 10), true)}.`;

      const metaList = document.createElement('dl');
      metaList.className = 'lc-archive-meta';

      /** @param {string} dtText @param {string | HTMLElement} ddValue */
      const addMetaRow = (dtText, ddValue) => {
        const row = document.createElement('div');
        row.className = 'lc-archive-meta__row';
        const dt = document.createElement('dt');
        dt.textContent = dtText;
        const dd = document.createElement('dd');
        if (typeof ddValue === 'string') {
          dd.textContent = ddValue;
        } else {
          dd.append(ddValue);
        }
        row.append(dt, dd);
        metaList.append(row);
      };

      if (activeEntry.projectName && activeEntry.kind !== 'project') {
        addMetaRow('Projet', activeEntry.projectName);
      } else if (activeEntry.kind !== 'project') {
        addMetaRow('Projet', 'Sans projet');
      }
      addMetaRow('Archivé le', formatShortDateFr(activeEntry.archivedAt.slice(0, 10), true));
      addMetaRow('Mis à jour le', formatShortDateFr(activeEntry.updatedAt.slice(0, 10), true));

      if (activeEntry.kind === 'project') {
        const proj = /** @type {Project} */ (activeEntry.item);
        const childTasks = state.tasks.filter((t) => t.projectId === proj.id).length;
        const childNotes = state.notes.filter((n) => n.projectId === proj.id).length;
        const childWbs = state.whiteboards.filter((w) => w.projectId === proj.id).length;
        addMetaRow(
          'Contenu associé',
          `${childTasks} tâche(s) · ${childNotes} note(s) · ${childWbs} tableau(x) blanc(s)`,
        );
      }

      if (activeEntry.kind === 'task') {
        const task = /** @type {Task} */ (activeEntry.item);
        const statusMeta = getTaskStatusMeta(task.status, state.preferences.taskStatuses);
        const role = getTaskStatusRole(task.status, state.preferences.taskStatuses);
        const statusVal = document.createElement('span');
        statusVal.className = 'lc-archive-inline-badges';
        const sBadge = document.createElement('span');
        sBadge.className = statusMeta.badgeClass;
        sBadge.textContent = statusMeta.label;
        statusVal.append(sBadge);
        if (role === 'initial' || role === 'terminal') {
          const rBadge = document.createElement('span');
          rBadge.className =
            role === 'terminal' ? 'cv-badge cv-badge--success' : 'cv-badge cv-badge--accent';
          rBadge.textContent = role === 'terminal' ? 'Terminal' : 'Initial';
          statusVal.append(rBadge);
        }
        addMetaRow('Statut', statusVal);
        addMetaRow('Priorité', PRIORITY_LABELS[task.priority]);

        if (task.dueDate) {
          const dueVal = document.createElement('span');
          dueVal.className = 'lc-archive-inline-badges';
          dueVal.append(
            document.createTextNode(
              `${formatShortDateFr(task.dueDate, true)}${task.dueTime ? ` à ${task.dueTime}` : ''}`,
            ),
          );
          if (isOffHoursDueTime(task.dueTime)) {
            const moonBadge = document.createElement('span');
            moonBadge.className = 'cv-badge lc-offhours-pill';
            const mIc = document.createElement('i');
            mIc.className = 'ph ph-moon cv-icon';
            mIc.setAttribute('aria-hidden', 'true');
            moonBadge.append(mIc, document.createTextNode(' Créneau 18h–7h'));
            dueVal.append(moonBadge);
          }
          addMetaRow('Échéance', dueVal);
        } else {
          addMetaRow('Échéance', 'Aucune');
        }

        if (task.recurrence) {
          addMetaRow('Récurrence', getTaskRecurrenceLabel(task.recurrence));
        }

        if (task.checklist.length > 0) {
          const doneCount = task.checklist.filter((c) => c.done).length;
          addMetaRow('Liste de contrôle', `${doneCount} / ${task.checklist.length} terminée(s)`);
        }
      }

      if (activeEntry.tags.length > 0) {
        const tagsWrap = document.createElement('span');
        tagsWrap.className = 'lc-tags-inline';
        for (const tag of activeEntry.tags) {
          const chip = document.createElement('span');
          chip.className = 'cv-tag';
          chip.textContent = `#${tag}`;
          tagsWrap.append(chip);
        }
        addMetaRow('Étiquettes', tagsWrap);
      }

      // Preview box
      const previewBox = document.createElement('div');
      previewBox.className = 'lc-archive-preview';
      if (activeEntry.kind === 'project') {
        const proj = /** @type {Project} */ (activeEntry.item);
        previewBox.textContent = proj.description || 'Aucune description.';
      } else if (activeEntry.kind === 'task') {
        const task = /** @type {Task} */ (activeEntry.item);
        const plain = extractRichTextPlainText(task.descriptionDoc);
        previewBox.textContent = plain || 'Aucune description rédigée.';
      } else if (activeEntry.kind === 'note') {
        const note = /** @type {Note} */ (activeEntry.item);
        const plain = extractRichTextPlainText(note.contentDoc);
        previewBox.textContent = plain || 'Note sans contenu texte.';
      } else {
        const wb = /** @type {Whiteboard} */ (activeEntry.item);
        const wbText = extractWhiteboardSearchText(wb);
        previewBox.textContent = `${wb.elements.length} élément(s) sur le canevas${wbText ? ` · ${wbText}` : ''}`;
      }

      // Links summary for tasks/notes/whiteboards
      /** @type {HTMLElement | null} */
      let linksBlock = null;
      if (
        activeEntry.kind === 'task' ||
        activeEntry.kind === 'note' ||
        activeEntry.kind === 'whiteboard'
      ) {
        const resolvedLinks = selectEntityLinkEntries(state, activeEntry.kind, activeEntry.id);
        if (resolvedLinks.outgoing.length > 0 || resolvedLinks.incoming.length > 0) {
          linksBlock = document.createElement('div');
          linksBlock.className = 'lc-archive-links';
          const lTitle = document.createElement('span');
          lTitle.className = 'cv-caption';
          lTitle.textContent = `Liens : ${resolvedLinks.outgoing.length} sortant(s) · ${resolvedLinks.incoming.length} entrant(s)`;
          const pills = document.createElement('div');
          pills.className = 'lc-links-list';
          for (const ref of [...resolvedLinks.outgoing, ...resolvedLinks.incoming]) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'cv-btn cv-btn--ghost cv-btn--sm';
            btn.textContent = `${KIND_META[ref.kind].label} · ${ref.title}`;
            btn.addEventListener('click', () => {
              onNavigateLocalRef?.({ kind: ref.kind, id: ref.id });
            });
            pills.append(btn);
          }
          linksBlock.append(lTitle, pills);
        }
      }

      // Footer actions: Unarchive + Trash
      const footer = document.createElement('div');
      footer.className = 'cv-card__footer';
      footer.style.flexWrap = 'wrap';
      footer.style.gap = 'var(--cv-space-3)';

      const restoreBtn = document.createElement('button');
      restoreBtn.type = 'button';
      restoreBtn.id = 'btn-archive-restore';
      restoreBtn.className = 'cv-btn cv-btn--primary';
      restoreBtn.disabled = readOnly;
      const restoreIc = document.createElement('i');
      restoreIc.className = 'ph ph-arrow-counter-clockwise cv-icon';
      restoreIc.setAttribute('aria-hidden', 'true');
      restoreBtn.append(restoreIc, document.createTextNode(' Désarchiver'));
      restoreBtn.setAttribute('aria-label', `Désarchiver « ${activeEntry.title} »`);
      restoreBtn.addEventListener('click', () => {
        const now = new Date().toISOString();
        if (activeEntry.kind === 'project') {
          store.dispatch({
            type: 'toggle_archive_project',
            id: activeEntry.id,
            archived: false,
            now,
          });
        } else if (activeEntry.kind === 'task') {
          store.dispatch({
            type: 'toggle_archive_task',
            id: activeEntry.id,
            archived: false,
            now,
          });
        } else if (activeEntry.kind === 'note') {
          store.dispatch({
            type: 'toggle_archive_note',
            id: activeEntry.id,
            archived: false,
            now,
          });
        } else {
          store.dispatch({
            type: 'toggle_archive_whiteboard',
            id: activeEntry.id,
            archived: false,
            now,
          });
        }
        notify({
          status: 'success',
          title: 'Élément désarchivé',
          text:
            activeEntry.archiveReason === 'project' && activeEntry.projectName
              ? `${activeEntry.title} (et projet « ${activeEntry.projectName} »)`
              : activeEntry.title,
        });
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.id = 'btn-archive-delete';
      deleteBtn.className = 'cv-btn cv-btn--danger';
      deleteBtn.disabled = readOnly;
      deleteBtn.textContent = 'Mettre à la corbeille';
      deleteBtn.setAttribute('aria-label', `Mettre « ${activeEntry.title} » à la corbeille`);
      deleteBtn.addEventListener('click', async () => {
        const confirmed = await confirmAction({
          title: `Mettre « ${activeEntry.title} » à la corbeille ?`,
          message: 'Cet élément quittera les archives pour la corbeille locale.',
          confirmLabel: 'Mettre à la corbeille',
          danger: true,
        });
        if (!confirmed) return;
        const trashId = crypto.randomUUID();
        const now = new Date().toISOString();
        if (activeEntry.kind === 'project') {
          store.dispatch({ type: 'trash_project', id: activeEntry.id, trashId, now });
        } else if (activeEntry.kind === 'task') {
          store.dispatch({ type: 'trash_task', id: activeEntry.id, trashId, now });
        } else if (activeEntry.kind === 'note') {
          store.dispatch({ type: 'trash_note', id: activeEntry.id, trashId, now });
        } else {
          store.dispatch({ type: 'trash_whiteboard', id: activeEntry.id, trashId, now });
        }
        notify({
          status: 'info',
          title: 'Élément placé dans la corbeille',
          text: activeEntry.title,
        });
      });

      footer.append(deleteBtn, restoreBtn);

      detailCard.append(detailHead, originNote, metaList, previewBox);
      if (linksBlock) detailCard.append(linksBlock);
      detailCard.append(footer);
    }

    layout.append(listEl, detailCard);
    bodySlot.replaceChildren(layout);
  }

  function resetAllFilters() {
    filters.query = '';
    filters.kind = 'all';
    filters.projectId = 'all';
    filters.tag = 'all';
    filters.sortBy = 'archivedAt';
    searchInput.value = '';
    kindSelect.value = 'all';
    projSelect.value = 'all';
    tagSelect.value = 'all';
    sortSelect.value = 'archivedAt';
    renderBody();
  }

  searchInput.addEventListener('input', () => {
    filters.query = searchInput.value;
    renderBody();
  });
  kindSelect.addEventListener('change', () => {
    filters.kind = /** @type {typeof filters.kind} */ (kindSelect.value);
    renderBody();
  });
  projSelect.addEventListener('change', () => {
    filters.projectId = projSelect.value;
    renderBody();
  });
  tagSelect.addEventListener('change', () => {
    filters.tag = tagSelect.value;
    renderBody();
  });
  sortSelect.addEventListener('change', () => {
    filters.sortBy = /** @type {typeof filters.sortBy} */ (sortSelect.value);
    renderBody();
  });
  resetBtn.addEventListener('click', resetAllFilters);

  renderBody();
  container.replaceChildren(header, toolbar, bodySlot);
}
