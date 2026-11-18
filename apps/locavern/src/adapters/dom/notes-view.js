/** @import { AppCommand, AppState, LocalRef, Note, RichTextDoc, StoreEffect } from '../../types.d.ts' */

import { formatShortDateFr } from '../../core/dates.js';
import { collectDocAssetIds } from '../../core/model.js';
import { noteToMarkdown } from '../../core/markdown.js';
import { extractRichTextPlainText } from '../../core/search.js';
import {
  selectAllTags,
  selectNotes,
  selectProjectById,
  selectProjects,
  selectTemplates,
} from '../../core/store.js';
import { instantiateNoteTemplate } from '../../core/templates.js';
import { createTemplatePicker } from './template-picker.js';
import { initTooltips, setTooltip } from './tooltip.js';
import { saveArchiveBlob } from '../archive-file.js';
import { mountRichTextEditor } from '../rich-text-tiptap.js';
import { confirmAction, notify } from './app-shell.js';
import { createLinkEditor } from './link-editor.js';
import { createTagEditor } from './tag-editor.js';

/**
 * Render the standalone Notes view with Tiptap rich text and local images.
 * Supports separate Consultation (read-only) and Modification (edit) modes.
 * Keeps header controls mounted when filtering so search input never loses focus.
 * @param {{
 *   container: HTMLElement;
 *   store: {
 *     getState: () => AppState;
 *     dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *   };
 *   filters: {
 *     projectId: string | null | 'all';
 *     query: string;
 *     tag: string | 'all';
 *   };
 *   modeState: { noteId: string | null; mode: 'view' | 'edit' };
 *   resolveAssetUrl: (assetId: string) => Promise<string | null>;
 *   uploadLocalImage: (file: File) => Promise<{ assetId: string; alt: string } | null>;
 *   onOpenNoteDialog?: (opts?: { note?: Note; mode?: 'view' | 'edit'; defaultProjectId?: string | null }) => void;
 *   onNavigateLocalRef?: (ref: LocalRef) => void;
 * }} opts
 * @returns {{ flushAndDestroy: () => void; isDispatchingInline: () => boolean }}
 */
export function renderNotesView({
  container,
  store,
  filters,
  modeState,
  resolveAssetUrl,
  uploadLocalImage,
  onOpenNoteDialog,
  onNavigateLocalRef,
}) {
  const initialState = store.getState();
  const initialActiveProjects = selectProjects(initialState);

  const header = document.createElement('div');
  header.className = 'lc-view-header';

  const leftGroup = document.createElement('div');
  leftGroup.className = 'lc-view-header__group';

  const projectWrap = document.createElement('div');
  projectWrap.className = 'cv-select';
  const projectFilter = document.createElement('select');
  projectFilter.id = 'notes-project-filter';
  projectFilter.className = 'cv-input';
  projectFilter.setAttribute('aria-label', 'Filtrer les notes par projet');

  const optAll = document.createElement('option');
  optAll.value = 'all';
  optAll.textContent = 'Toutes les notes';
  const optNone = document.createElement('option');
  optNone.value = 'none';
  optNone.textContent = 'Sans projet';
  projectFilter.append(optAll, optNone);
  for (const p of initialActiveProjects) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    projectFilter.append(opt);
  }
  if (
    filters.projectId !== 'all' &&
    filters.projectId !== null &&
    !initialActiveProjects.some((p) => p.id === filters.projectId)
  ) {
    filters.projectId = 'all';
  }
  projectFilter.value = filters.projectId === 'all' ? 'all' : (filters.projectId ?? 'none');
  projectWrap.append(projectFilter);

  const searchGroup = document.createElement('div');
  searchGroup.className = 'cv-input-group';
  const searchIcon = document.createElement('i');
  searchIcon.className = 'ph ph-magnifying-glass cv-icon';
  searchIcon.setAttribute('aria-hidden', 'true');
  const searchInput = document.createElement('input');
  searchInput.id = 'notes-search-input';
  searchInput.type = 'search';
  searchInput.className = 'cv-input';
  searchInput.placeholder = 'Rechercher titre ou contenu';
  searchInput.setAttribute('aria-label', 'Rechercher une note');
  searchInput.value = filters.query;
  searchGroup.append(searchIcon, searchInput);

  const tagWrap = document.createElement('div');
  tagWrap.className = 'cv-select';
  const tagFilter = document.createElement('select');
  tagFilter.id = 'notes-tag-filter';
  tagFilter.className = 'cv-input';
  tagFilter.setAttribute('aria-label', 'Filtrer les notes par étiquette');
  function rebuildNotesTagOptions() {
    const allTags = selectAllTags(store.getState());
    tagFilter.replaceChildren();
    const allTagOpt = document.createElement('option');
    allTagOpt.value = 'all';
    allTagOpt.textContent = 'Toutes les étiquettes';
    tagFilter.append(allTagOpt);
    for (const tag of allTags) {
      const opt = document.createElement('option');
      opt.value = tag;
      opt.textContent = `#${tag}`;
      tagFilter.append(opt);
    }
    if (
      filters.tag !== 'all' &&
      !allTags.some((t) => t.toLowerCase() === filters.tag.toLowerCase())
    ) {
      filters.tag = 'all';
    }
    tagFilter.value = filters.tag;
  }
  rebuildNotesTagOptions();
  tagWrap.append(tagFilter);

  leftGroup.append(projectWrap, tagWrap, searchGroup);

  const newNoteBtn = document.createElement('button');
  newNoteBtn.type = 'button';
  newNoteBtn.className = 'cv-btn cv-btn--primary';
  newNoteBtn.id = 'btn-new-note';
  newNoteBtn.disabled = initialState.readOnly;
  const plusIc = document.createElement('i');
  plusIc.className = 'ph ph-plus cv-icon';
  plusIc.setAttribute('aria-hidden', 'true');
  newNoteBtn.append(plusIc, document.createTextNode(' Nouvelle note'));

  header.append(leftGroup, newNoteBtn);

  const bodySlot = document.createElement('div');

  /** @type {ReturnType<typeof mountRichTextEditor> | null} */
  let editorHandle = null;
  /** @type {number | null} */
  let saveTimer = null;
  /** @type {(() => void) | null} */
  let flushPending = null;
  let dispatchingInlineUpdate = false;

  function cleanupEditor() {
    if (saveTimer !== null) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    editorHandle?.destroy();
    editorHandle = null;
  }

  function openNewNoteDialog() {
    flushPending?.();
    const state = store.getState();
    const defaultProjId =
      filters.projectId === 'all' ? state.preferences.selectedProjectId : filters.projectId;
    onOpenNoteDialog?.({ defaultProjectId: defaultProjId ?? null, mode: 'edit' });
  }

  newNoteBtn.addEventListener('click', openNewNoteDialog);

  /** @param {Note} targetNote */
  async function exportNoteMarkdown(targetNote) {
    const fresh = store.getState().notes.find((n) => n.id === targetNote.id) ?? targetNote;
    const projName = fresh.projectId
      ? (selectProjectById(store.getState(), fresh.projectId)?.name ?? null)
      : null;
    const md = noteToMarkdown(fresh, { projectName: projName });
    const slug =
      fresh.title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'note';
    const filename = `${slug}.md`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    try {
      const saved = await saveArchiveBlob(blob, filename, {
        pickerTypes: [
          {
            description: 'Document Markdown (.md)',
            accept: { 'text/markdown': ['.md'] },
          },
        ],
      });
      if (saved.saved) {
        notify({ status: 'success', title: 'Note exportée en Markdown', text: filename });
      }
    } catch {
      notify({
        status: 'danger',
        title: 'Échec de l’export Markdown',
        text: 'Impossible d’enregistrer le fichier localement.',
      });
    }
  }

  function renderBody() {
    cleanupEditor();
    flushPending = null;

    const state = store.getState();
    const readOnly = state.readOnly;
    const filteredNotes = selectNotes(state, filters);
    const activeNote =
      filteredNotes.find((n) => n.id === state.preferences.selectedNoteId) ??
      filteredNotes[0] ??
      null;

    if (!activeNote) {
      modeState.noteId = null;
      modeState.mode = 'view';
    } else if (modeState.noteId !== activeNote.id) {
      modeState.noteId = activeNote.id;
      modeState.mode = 'view';
    }
    const effectiveMode = readOnly ? 'view' : modeState.mode;

    if (filteredNotes.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'cv-empty';
      const iconBox = document.createElement('span');
      iconBox.className = 'cv-empty__icon';
      const ic = document.createElement('i');
      ic.className = 'ph ph-notebook cv-icon';
      ic.setAttribute('aria-hidden', 'true');
      iconBox.append(ic);
      const title = document.createElement('p');
      title.className = 'cv-empty__title';
      title.textContent = 'Aucune note disponible';
      const desc = document.createElement('p');
      desc.textContent =
        'Rédigez des notes locales avec mise en forme, listes de contrôle et images stockées dans IndexedDB.';
      const cta = document.createElement('button');
      cta.type = 'button';
      cta.className = 'cv-btn cv-btn--primary';
      cta.disabled = readOnly;
      cta.textContent = 'Créer une note';
      cta.addEventListener('click', openNewNoteDialog);
      empty.append(iconBox, title, desc, cta);
      bodySlot.replaceChildren(empty);
      return;
    }

    const layout = document.createElement('div');
    layout.className = 'lc-notes-layout';

    const listEl = document.createElement('div');
    listEl.className = 'lc-notes-list';
    listEl.setAttribute('role', 'navigation');
    listEl.setAttribute('aria-label', 'Liste des notes');

    /** @type {Map<string, HTMLElement>} */
    const listTitleEls = new Map();

    for (const note of filteredNotes) {
      const row = document.createElement('div');
      row.className = 'lc-note-row';

      const itemBtn = document.createElement('button');
      itemBtn.type = 'button';
      itemBtn.className = 'lc-note-item';
      if (activeNote && note.id === activeNote.id) {
        itemBtn.setAttribute('aria-current', 'true');
        row.classList.add('is-active');
      }
      const tSpan = document.createElement('span');
      tSpan.className = 'lc-note-item__title';
      tSpan.textContent = note.title;
      listTitleEls.set(note.id, tSpan);

      const mSpan = document.createElement('span');
      mSpan.className = 'lc-note-item__meta';
      const projName = note.projectId ? selectProjectById(state, note.projectId)?.name : null;
      const tagsSummary =
        (note.tags ?? []).length > 0 ? ` · ${(note.tags ?? []).map((t) => `#${t}`).join(' ')}` : '';
      mSpan.textContent = projName
        ? `${projName} · ${note.updatedAt.slice(0, 10)}${tagsSummary}`
        : `${note.updatedAt.slice(0, 10)}${tagsSummary}`;

      itemBtn.append(tSpan, mSpan);
      itemBtn.addEventListener('click', () => {
        flushPending?.();
        modeState.noteId = note.id;
        modeState.mode = 'view';
        if (activeNote && activeNote.id === note.id) {
          renderBody();
          return;
        }
        store.dispatch({ type: 'select_note', noteId: note.id });
      });

      row.append(itemBtn);

      if (!readOnly) {
        const editRowBtn = document.createElement('button');
        editRowBtn.type = 'button';
        editRowBtn.className = 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm lc-note-row__edit';
        editRowBtn.setAttribute('aria-label', `Modifier la note « ${note.title} »`);
        setTooltip(editRowBtn, 'Modifier la note');
        const penIc = document.createElement('i');
        penIc.className = 'ph ph-pencil-simple cv-icon';
        penIc.setAttribute('aria-hidden', 'true');
        editRowBtn.append(penIc);
        editRowBtn.addEventListener('click', () => {
          flushPending?.();
          modeState.noteId = note.id;
          modeState.mode = 'edit';
          if (activeNote && activeNote.id === note.id) {
            renderBody();
            return;
          }
          store.dispatch({ type: 'select_note', noteId: note.id });
        });
        row.append(editRowBtn);
      }

      listEl.append(row);
    }

    const editorCard = document.createElement('section');

    if (activeNote && effectiveMode === 'view') {
      const currentNote = activeNote;
      editorCard.className = 'cv-card lc-consult-card';
      editorCard.setAttribute('aria-label', 'Consultation de note');

      const consultHead = document.createElement('div');
      consultHead.className = 'lc-view-header';

      const titleWrap = document.createElement('div');
      titleWrap.className = 'lc-consult-head';

      const titleH3 = document.createElement('h3');
      titleH3.id = 'note-consult-title';
      titleH3.className = 'lc-consult-title';
      titleH3.textContent = currentNote.title;

      const modeBadge = document.createElement('span');
      modeBadge.className = 'cv-badge';
      modeBadge.textContent = 'Consultation';

      const proj = currentNote.projectId ? selectProjectById(state, currentNote.projectId) : null;
      const projBadge = document.createElement('span');
      projBadge.className = 'cv-badge cv-badge--accent';
      projBadge.textContent = proj ? proj.name : 'Sans projet';

      const dateBadge = document.createElement('span');
      dateBadge.className = 'cv-caption';
      dateBadge.textContent = `Mis à jour le ${formatShortDateFr(currentNote.updatedAt.slice(0, 10), true)}`;

      titleWrap.append(titleH3, modeBadge, projBadge, dateBadge);

      const headActions = document.createElement('div');
      headActions.className = 'lc-table-actions';
      headActions.style.flexWrap = 'wrap';

      const exportMdBtn = document.createElement('button');
      exportMdBtn.type = 'button';
      exportMdBtn.id = 'btn-export-note-md';
      exportMdBtn.className = 'cv-btn cv-btn--sm';
      const exportIc = document.createElement('i');
      exportIc.className = 'ph ph-download-simple cv-icon';
      exportIc.setAttribute('aria-hidden', 'true');
      exportMdBtn.append(exportIc, document.createTextNode(' Exporter (.md)'));
      exportMdBtn.setAttribute('aria-label', `Exporter « ${currentNote.title} » en Markdown (.md)`);
      exportMdBtn.addEventListener('click', () => void exportNoteMarkdown(currentNote));
      headActions.append(exportMdBtn);

      if (!readOnly) {
        const switchEditBtn = document.createElement('button');
        switchEditBtn.type = 'button';
        switchEditBtn.id = 'btn-switch-note-edit';
        switchEditBtn.className = 'cv-btn cv-btn--primary cv-btn--sm';
        const editIc = document.createElement('i');
        editIc.className = 'ph ph-pencil-simple cv-icon';
        editIc.setAttribute('aria-hidden', 'true');
        switchEditBtn.append(editIc, document.createTextNode(' Modifier'));
        switchEditBtn.addEventListener('click', () => {
          modeState.noteId = currentNote.id;
          modeState.mode = 'edit';
          renderBody();
        });
        headActions.append(switchEditBtn);
      }

      consultHead.append(titleWrap, headActions);

      const tagEditor = createTagEditor({
        idPrefix: 'note-tags',
        labelText: 'Étiquettes',
        initialTags: currentNote.tags ?? [],
        readOnly,
        viewOnly: true,
      });

      const linkEditor = createLinkEditor({
        idPrefix: 'note-links',
        state,
        currentRef: { kind: 'note', id: currentNote.id },
        initialLinks: currentNote.links ?? [],
        readOnly,
        viewOnly: true,
        onNavigate(ref) {
          onNavigateLocalRef?.(ref);
        },
      });

      const editorHost = document.createElement('div');
      const hasContent =
        extractRichTextPlainText(currentNote.contentDoc).length > 0 ||
        collectDocAssetIds(currentNote.contentDoc).length > 0;

      if (hasContent) {
        editorHost.className = 'lc-editor-readonly-wrap';
        editorHandle = mountRichTextEditor({
          container: editorHost,
          initialDoc: currentNote.contentDoc,
          editable: false,
          ariaLabel: `Contenu de la note ${currentNote.title}`,
          resolveAssetUrl,
          onUploadImage: async () => null,
          onChange() {},
        });
      } else {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'cv-caption';
        emptyMsg.style.margin = '0';
        emptyMsg.textContent = 'Cette note ne contient aucun texte pour le moment.';
        editorHost.append(emptyMsg);
      }

      editorCard.append(consultHead, tagEditor.element, linkEditor.element, editorHost);
    } else if (activeNote) {
      const currentNote = activeNote;
      editorCard.className = 'cv-card';
      editorCard.setAttribute('aria-label', 'Éditeur de note');

      const metaRow = document.createElement('div');
      metaRow.className = 'lc-view-header';

      const titleField = document.createElement('div');
      titleField.className = 'cv-field';
      titleField.style.flex = '1 1 15rem';
      const titleLabel = document.createElement('label');
      titleLabel.className = 'cv-label';
      titleLabel.htmlFor = 'note-title-input';
      titleLabel.textContent = 'Titre de la note';
      const titleInput = document.createElement('input');
      titleInput.id = 'note-title-input';
      titleInput.type = 'text';
      titleInput.className = 'cv-input';
      titleInput.maxLength = 200;
      titleInput.disabled = readOnly;
      titleInput.value = currentNote.title;
      titleField.append(titleLabel, titleInput);

      const projField = document.createElement('div');
      projField.className = 'cv-field';
      projField.style.minWidth = 'min(100%, 11.25rem)';
      const projLabel = document.createElement('label');
      projLabel.className = 'cv-label';
      projLabel.htmlFor = 'note-project-select';
      projLabel.textContent = 'Projet associé';
      const projWrap = document.createElement('div');
      projWrap.className = 'cv-select';
      const projSelect = document.createElement('select');
      projSelect.id = 'note-project-select';
      projSelect.className = 'cv-input';
      projSelect.disabled = readOnly;
      const noProjOpt = document.createElement('option');
      noProjOpt.value = '';
      noProjOpt.textContent = 'Sans projet';
      projSelect.append(noProjOpt);
      for (const p of selectProjects(state)) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        projSelect.append(opt);
      }
      projSelect.value = currentNote.projectId ?? '';
      projWrap.append(projSelect);
      projField.append(projLabel, projWrap);

      metaRow.append(titleField, projField);

      const tagEditor = createTagEditor({
        idPrefix: 'note-tags',
        labelText: 'Étiquettes',
        initialTags: currentNote.tags ?? [],
        suggestions: selectAllTags(state),
        readOnly,
        onChange() {
          saveNow(false);
          rebuildNotesTagOptions();
        },
      });

      const linkEditor = createLinkEditor({
        idPrefix: 'note-links',
        state,
        currentRef: { kind: 'note', id: currentNote.id },
        initialLinks: currentNote.links ?? [],
        readOnly,
        onChange() {
          saveNow(false);
        },
        onNavigate(ref) {
          flushPending?.();
          onNavigateLocalRef?.(ref);
        },
      });

      const editorHost = document.createElement('div');
      /** @type {RichTextDoc} */
      let latestDoc = currentNote.contentDoc;
      let dirty = false;

      const statusNote = document.createElement('span');
      statusNote.className = 'cv-caption';
      statusNote.id = 'note-save-status';
      statusNote.textContent = 'Enregistrée localement';

      function saveNow(showToast = false) {
        if (readOnly) return;
        if (saveTimer !== null) {
          window.clearTimeout(saveTimer);
          saveTimer = null;
        }
        const cleanTitle = titleInput.value.trim() || currentNote.title;
        const tags = tagEditor.commitPending();
        const links = linkEditor.getLinks();
        const doc = editorHandle ? editorHandle.getDoc() : latestDoc;
        const assetIds = collectDocAssetIds(doc);
        const projectId = projSelect.value ? projSelect.value : null;
        dirty = false;
        statusNote.textContent = 'Enregistrée localement';
        const listTitle = listTitleEls.get(currentNote.id);
        if (listTitle) listTitle.textContent = cleanTitle;
        dispatchingInlineUpdate = true;
        try {
          store.dispatch({
            type: 'update_note',
            id: currentNote.id,
            patch: {
              title: cleanTitle,
              projectId,
              contentDoc: doc,
              tags,
              links,
              assetIds,
            },
            now: new Date().toISOString(),
          });
        } catch (err) {
          notify({
            status: 'danger',
            title: 'Enregistrement impossible',
            text: err instanceof Error ? err.message : 'Erreur de validation.',
          });
          return;
        } finally {
          dispatchingInlineUpdate = false;
        }
        if (showToast) {
          notify({ status: 'success', title: 'Note enregistrée', text: cleanTitle });
        }
      }

      flushPending = () => {
        if (dirty || saveTimer !== null) {
          saveNow(false);
        }
      };

      function scheduleSave() {
        if (readOnly) return;
        dirty = true;
        statusNote.textContent = 'Modifications en cours';
        if (saveTimer !== null) window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => saveNow(false), 200);
      }

      editorHandle = mountRichTextEditor({
        container: editorHost,
        initialDoc: currentNote.contentDoc,
        editable: !readOnly,
        ariaLabel: `Contenu de la note ${currentNote.title}`,
        resolveAssetUrl,
        onUploadImage: uploadLocalImage,
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
        onChange(nextDoc) {
          latestDoc = nextDoc;
          scheduleSave();
        },
      });

      titleInput.addEventListener('input', scheduleSave);
      titleInput.addEventListener('blur', () => {
        if (dirty) saveNow(false);
      });
      projSelect.addEventListener('change', () => saveNow(false));

      const footer = document.createElement('div');
      footer.className = 'cv-card__footer';
      footer.style.flexWrap = 'wrap';
      footer.style.gap = 'var(--cv-space-3)';

      const actions = document.createElement('div');
      actions.className = 'lc-table-actions';
      actions.style.flexWrap = 'wrap';

      const consultBtn = document.createElement('button');
      consultBtn.type = 'button';
      consultBtn.id = 'btn-switch-note-view';
      consultBtn.className = 'cv-btn cv-btn--sm';
      const eyeIc = document.createElement('i');
      eyeIc.className = 'ph ph-eye cv-icon';
      eyeIc.setAttribute('aria-hidden', 'true');
      consultBtn.append(eyeIc, document.createTextNode(' Consulter'));
      consultBtn.addEventListener('click', () => {
        flushPending?.();
        modeState.noteId = currentNote.id;
        modeState.mode = 'view';
        renderBody();
      });

      const duplicateBtn = document.createElement('button');
      duplicateBtn.type = 'button';
      duplicateBtn.id = 'btn-duplicate-note';
      duplicateBtn.className = 'cv-btn cv-btn--sm';
      duplicateBtn.disabled = readOnly;
      const dupIc = document.createElement('i');
      dupIc.className = 'ph ph-copy cv-icon';
      dupIc.setAttribute('aria-hidden', 'true');
      duplicateBtn.append(dupIc, document.createTextNode(' Dupliquer'));
      duplicateBtn.setAttribute('aria-label', `Dupliquer la note « ${currentNote.title} »`);
      duplicateBtn.addEventListener('click', () => {
        if (readOnly) return;
        flushPending?.();
        const fresh = store.getState().notes.find((n) => n.id === currentNote.id) ?? currentNote;
        const copyId = crypto.randomUUID();
        const copyTitle = `${fresh.title} (copie)`.slice(0, 200);
        const clonedDoc = /** @type {RichTextDoc} */ (structuredClone(fresh.contentDoc));
        const clonedAssetIds = [...fresh.assetIds];
        const now = new Date().toISOString();
        store.dispatch({
          type: 'create_note',
          id: copyId,
          projectId: fresh.projectId,
          title: copyTitle,
          contentDoc: clonedDoc,
          tags: [...(fresh.tags ?? [])],
          assetIds: clonedAssetIds,
          now,
        });
        store.dispatch({ type: 'select_note', noteId: copyId });
        notify({ status: 'success', title: 'Note dupliquée', text: copyTitle });
      });

      const exportMdBtn = document.createElement('button');
      exportMdBtn.type = 'button';
      exportMdBtn.id = 'btn-export-note-md';
      exportMdBtn.className = 'cv-btn cv-btn--sm';
      const exportIc = document.createElement('i');
      exportIc.className = 'ph ph-download-simple cv-icon';
      exportIc.setAttribute('aria-hidden', 'true');
      exportMdBtn.append(exportIc, document.createTextNode(' Exporter (.md)'));
      exportMdBtn.setAttribute('aria-label', `Exporter « ${currentNote.title} » en Markdown (.md)`);
      exportMdBtn.addEventListener('click', () => {
        flushPending?.();
        void exportNoteMarkdown(currentNote);
      });

      const openDialogBtn = document.createElement('button');
      openDialogBtn.type = 'button';
      openDialogBtn.id = 'btn-open-note-dialog';
      openDialogBtn.className = 'cv-btn cv-btn--sm';
      openDialogBtn.textContent = 'Ouvrir la saisie';
      openDialogBtn.setAttribute('aria-label', `Ouvrir la saisie pour « ${currentNote.title} »`);
      openDialogBtn.addEventListener('click', () => {
        flushPending?.();
        const freshNote =
          store.getState().notes.find((n) => n.id === currentNote.id) ?? currentNote;
        onOpenNoteDialog?.({ note: freshNote, mode: 'edit' });
      });

      const archiveBtn = document.createElement('button');
      archiveBtn.type = 'button';
      archiveBtn.id = 'btn-archive-note';
      archiveBtn.className = 'cv-btn cv-btn--sm';
      archiveBtn.disabled = readOnly;
      archiveBtn.textContent = 'Archiver';
      archiveBtn.setAttribute('aria-label', `Archiver la note « ${currentNote.title} »`);
      archiveBtn.addEventListener('click', () => {
        flushPending?.();
        store.dispatch({
          type: 'toggle_archive_note',
          id: currentNote.id,
          archived: true,
          now: new Date().toISOString(),
        });
        notify({
          status: 'info',
          title: 'Note archivée',
          text: `${currentNote.title} déplacée vers les archives.`,
        });
      });

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.id = 'btn-save-note';
      saveBtn.className = 'cv-btn cv-btn--primary cv-btn--sm';
      saveBtn.disabled = readOnly;
      saveBtn.textContent = 'Enregistrer';
      saveBtn.addEventListener('click', () => saveNow(true));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.id = 'btn-delete-note';
      deleteBtn.className = 'cv-btn cv-btn--danger cv-btn--sm';
      deleteBtn.disabled = readOnly;
      deleteBtn.textContent = 'Supprimer';
      deleteBtn.addEventListener('click', async () => {
        const confirmed = await confirmAction({
          title: `Supprimer « ${currentNote.title} » ?`,
          message: 'Cette note sera déplacée dans la corbeille locale.',
          confirmLabel: 'Supprimer la note',
          danger: true,
        });
        if (!confirmed) return;
        if (saveTimer !== null) {
          window.clearTimeout(saveTimer);
          saveTimer = null;
        }
        dirty = false;
        store.dispatch({
          type: 'trash_note',
          id: currentNote.id,
          trashId: crypto.randomUUID(),
          now: new Date().toISOString(),
        });
        notify({ status: 'info', title: 'Note placée dans la corbeille', text: currentNote.title });
      });

      const noteTemplatePicker = createTemplatePicker({
        idPrefix: 'note-tpl',
        labelText: 'Modèles de trame',
        templates: selectTemplates(store.getState(), 'note'),
        readOnly,
        showSave: true,
        async onApply(tpl) {
          const currentDoc = editorHandle ? editorHandle.getDoc() : latestDoc;
          const hasContent =
            extractRichTextPlainText(currentDoc).length > 0 ||
            collectDocAssetIds(currentDoc).length > 0;
          if (hasContent) {
            const confirmed = await confirmAction({
              title: `Appliquer la trame « ${tpl.name} » ?`,
              message: 'Le contenu actuel de cette note sera remplacé par le modèle sélectionné.',
              confirmLabel: 'Appliquer le modèle',
            });
            if (!confirmed) return;
          }
          const nextDoc = instantiateNoteTemplate(tpl);
          latestDoc = nextDoc;
          editorHandle?.setDoc(nextDoc);
          saveNow(false);
          notify({ status: 'success', title: 'Trame appliquée', text: tpl.name });
        },
        onSaveNew(name) {
          const doc = editorHandle ? editorHandle.getDoc() : latestDoc;
          const id = crypto.randomUUID();
          store.dispatch({
            type: 'create_template',
            id,
            kind: 'note',
            name,
            contentDoc: doc,
            now: new Date().toISOString(),
          });
          noteTemplatePicker.setTemplates(selectTemplates(store.getState(), 'note'), id);
          notify({ status: 'success', title: 'Modèle de note enregistré', text: name });
          return id;
        },
        onDeleteCustom(tpl) {
          store.dispatch({ type: 'delete_template', id: tpl.id });
          noteTemplatePicker.setTemplates(selectTemplates(store.getState(), 'note'));
          notify({ status: 'info', title: 'Modèle supprimé', text: tpl.name });
        },
      });

      actions.append(
        consultBtn,
        openDialogBtn,
        duplicateBtn,
        exportMdBtn,
        archiveBtn,
        deleteBtn,
        saveBtn,
      );
      footer.append(statusNote, actions);
      editorCard.append(
        metaRow,
        tagEditor.element,
        linkEditor.element,
        editorHost,
        footer,
        noteTemplatePicker.element,
      );
    }

    layout.append(listEl, editorCard);
    bodySlot.replaceChildren(layout);
    initTooltips(bodySlot);
  }

  projectFilter.addEventListener('change', () => {
    flushPending?.();
    filters.projectId =
      projectFilter.value === 'all'
        ? 'all'
        : projectFilter.value === 'none'
          ? null
          : projectFilter.value;
    renderBody();
  });

  tagFilter.addEventListener('change', () => {
    flushPending?.();
    filters.tag = tagFilter.value;
    renderBody();
  });

  searchInput.addEventListener('input', () => {
    flushPending?.();
    filters.query = searchInput.value;
    renderBody();
  });

  renderBody();
  container.replaceChildren(header, bodySlot);

  return {
    flushAndDestroy() {
      flushPending?.();
      cleanupEditor();
    },
    isDispatchingInline() {
      return dispatchingInlineUpdate;
    },
  };
}
