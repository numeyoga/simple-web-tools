/** @import { AppCommand, AppState, LocalRef, Note, RichTextDoc, StoreEffect } from '../../types.d.ts' */

import { noteToMarkdown } from '../../core/markdown.js';
import { EMPTY_RICH_DOC, collectDocAssetIds } from '../../core/model.js';
import { extractRichTextPlainText } from '../../core/search.js';
import {
  selectAllTags,
  selectOrphanedAssetIds,
  selectProjectById,
  selectProjects,
  selectTemplates,
} from '../../core/store.js';
import { instantiateNoteTemplate } from '../../core/templates.js';
import { saveArchiveBlob } from '../archive-file.js';
import { mountRichTextEditor } from '../rich-text-lazy.js';
import {
  applyDialogPresentation,
  closeDialogById,
  confirmAction,
  notify,
  openDialogById,
} from './app-shell.js';
import { createLinkEditor } from './link-editor.js';
import { createTagEditor } from './tag-editor.js';
import { createTemplatePicker } from './template-picker.js';
import { builtinTemplates, format, t } from '../i18n.js';
import { errorText } from '../../core/messages.js';

/** @type {(() => void) | null} */
let activeNoteDialogCleanup = null;

/**
 * Build a safe local filename stem for Markdown exports.
 * @param {string} title
 * @returns {string}
 */
function toMarkdownSlug(title) {
  return (
    title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'note'
  );
}

/**
 * Open the Covenant dialog (drawer or modal per user preference) to consult, create, or edit a note.
 * @param {{
 *   store: {
 *     getState: () => AppState;
 *     dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *   };
 *   note?: Note;
 *   mode?: 'view' | 'edit';
 *   defaultProjectId?: string | null;
 *   resolveAssetUrl: (assetId: string) => Promise<string | null>;
 *   uploadLocalImage: (file: File) => Promise<{ assetId: string; alt: string } | null>;
 *   onAfterCreate?: (noteId: string) => void;
 *   onNavigateLocalRef?: (ref: LocalRef) => void;
 * }} opts
 */
export function openNoteDialog(opts) {
  const {
    store,
    note,
    mode,
    defaultProjectId = null,
    resolveAssetUrl,
    uploadLocalImage,
    onAfterCreate,
    onNavigateLocalRef,
  } = opts;

  const dialog = /** @type {HTMLDialogElement | null} */ (document.getElementById('dialog-note'));
  const titleEl = document.getElementById('dialog-note-title');
  const bodyEl = document.getElementById('dialog-note-body');
  const footerEl = document.getElementById('dialog-note-footer');
  if (!dialog || !titleEl || !bodyEl || !footerEl) return;

  activeNoteDialogCleanup?.();
  activeNoteDialogCleanup = null;

  const state = store.getState();
  applyDialogPresentation(dialog, state.preferences.inputPresentations.notes);
  const isEdit = Boolean(note);
  const readOnly = state.readOnly;
  const effectiveMode = !isEdit ? 'edit' : readOnly ? 'view' : (mode ?? 'view');

  if (effectiveMode === 'view' && note) {
    titleEl.textContent = t('notes.consultTitle');

    const panel = document.createElement('div');
    panel.id = 'note-consult-view';
    panel.className = 'lc-consult-panel';

    const headRow = document.createElement('div');
    headRow.className = 'lc-consult-head';

    const noteHeading = document.createElement('h3');
    noteHeading.className = 'lc-consult-title';
    noteHeading.textContent = note.title;
    headRow.append(noteHeading);

    if (note.archived) {
      const archBadge = document.createElement('span');
      archBadge.className = 'cv-badge';
      archBadge.textContent = t('common.archivedFeminine');
      headRow.append(archBadge);
    }

    const metaList = document.createElement('dl');
    metaList.className = 'lc-archive-meta';
    const proj = note.projectId ? selectProjectById(state, note.projectId) : null;

    /** @param {string} labelText @param {string} val */
    const addMetaRow = (labelText, val) => {
      const row = document.createElement('div');
      row.className = 'lc-archive-meta__row';
      const dt = document.createElement('dt');
      dt.textContent = labelText;
      const dd = document.createElement('dd');
      dd.textContent = val;
      row.append(dt, dd);
      metaList.append(row);
    };
    addMetaRow(
      t('common.project'),
      proj
        ? proj.archived
          ? t('common.archivedName', { name: proj.name })
          : proj.name
        : t('common.noProject'),
    );
    addMetaRow(t('common.updatedAt'), format.formatShortDate(note.updatedAt.slice(0, 10), true));

    const tagEditor = createTagEditor({
      idPrefix: 'note-dialog-tags',
      labelText: t('common.tags'),
      initialTags: note.tags ?? [],
      readOnly,
      viewOnly: true,
    });

    const linkEditor = createLinkEditor({
      idPrefix: 'note-dialog-links',
      state,
      currentRef: { kind: 'note', id: note.id },
      initialLinks: note.links ?? [],
      readOnly,
      viewOnly: true,
      onNavigate(ref) {
        closeDialogById('dialog-note');
        cleanup();
        onNavigateLocalRef?.(ref);
      },
    });

    const contentField = document.createElement('div');
    contentField.className = 'cv-field';
    const contentLabel = document.createElement('span');
    contentLabel.className = 'cv-label';
    contentLabel.id = 'note-dialog-content-label';
    contentLabel.textContent = t('notes.content');
    contentField.append(contentLabel);

    const hasContent =
      extractRichTextPlainText(note.contentDoc).length > 0 ||
      collectDocAssetIds(note.contentDoc).length > 0;

    /** @type {ReturnType<typeof mountRichTextEditor> | null} */
    let editorHandle = null;
    if (hasContent) {
      const editorHost = document.createElement('div');
      editorHost.className = 'lc-editor-readonly-wrap';
      contentField.append(editorHost);
      editorHandle = mountRichTextEditor({
        container: editorHost,
        initialDoc: note.contentDoc,
        editable: false,
        ariaLabel: t('notes.contentAria'),
        resolveAssetUrl,
        onUploadImage: async () => null,
        onChange() {},
      });
    } else {
      const emptyBody = document.createElement('p');
      emptyBody.className = 'cv-caption';
      emptyBody.style.margin = '0';
      emptyBody.textContent = t('notes.noContent');
      contentField.append(emptyBody);
    }

    panel.append(headRow, metaList, tagEditor.element, linkEditor.element, contentField);
    bodyEl.replaceChildren(panel);

    const exportMdBtn = document.createElement('button');
    exportMdBtn.type = 'button';
    exportMdBtn.className = 'cv-btn';
    exportMdBtn.style.marginRight = 'auto';
    const exportIc = document.createElement('i');
    exportIc.className = 'ph ph-download-simple cv-icon';
    exportIc.setAttribute('aria-hidden', 'true');
    exportMdBtn.append(exportIc, document.createTextNode(` ${t('notes.exportMd')}`));
    exportMdBtn.addEventListener('click', async () => {
      const fresh = store.getState().notes.find((n) => n.id === note.id) ?? note;
      const projName = fresh.projectId
        ? (selectProjectById(store.getState(), fresh.projectId)?.name ?? null)
        : null;
      const md = noteToMarkdown(fresh, { projectName: projName, t });
      const filename = `${toMarkdownSlug(fresh.title)}.md`;
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      try {
        const saved = await saveArchiveBlob(blob, filename, {
          pickerTypes: [
            {
              description: t('export.markdownDescription'),
              accept: { 'text/markdown': ['.md'] },
            },
          ],
        });
        if (saved.saved) {
          notify({ status: 'success', title: t('notes.exported'), text: filename });
        }
      } catch {
        notify({
          status: 'danger',
          title: t('notes.exportFailed'),
          text: t('notes.exportFailedText'),
        });
      }
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'cv-btn';
    closeBtn.setAttribute('data-cv-close', '');
    closeBtn.textContent = t('common.close');

    /** @type {HTMLElement[]} */
    const footerBtns = [exportMdBtn, closeBtn];
    if (!readOnly) {
      const switchEditBtn = document.createElement('button');
      switchEditBtn.type = 'button';
      switchEditBtn.id = 'btn-switch-note-dialog-edit';
      switchEditBtn.className = 'cv-btn cv-btn--primary';
      const editIc = document.createElement('i');
      editIc.className = 'ph ph-pencil-simple cv-icon';
      editIc.setAttribute('aria-hidden', 'true');
      switchEditBtn.append(editIc, document.createTextNode(` ${t('common.edit')}`));
      switchEditBtn.addEventListener('click', () => {
        const fresh = store.getState().notes.find((n) => n.id === note.id) ?? note;
        openNoteDialog({ ...opts, note: fresh, mode: 'edit' });
      });
      footerBtns.push(switchEditBtn);
    }
    footerEl.replaceChildren(...footerBtns);

    let cleaned = false;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      if (activeNoteDialogCleanup === cleanup) activeNoteDialogCleanup = null;
      dialog?.removeEventListener('close', onClose);
      editorHandle?.destroy();
      editorHandle = null;
      if (bodyEl) bodyEl.replaceChildren();
      if (footerEl) footerEl.replaceChildren();
    }
    function onClose() {
      if (!dialog) return;
      dialog.returnValue = '';
      cleanup();
    }
    activeNoteDialogCleanup = cleanup;
    dialog.addEventListener('close', onClose);

    if (!dialog.open) {
      openDialogById('dialog-note');
    }
    closeBtn.focus();
    return;
  }

  titleEl.textContent = isEdit ? t('notes.editTitle') : t('notes.new');

  const form = document.createElement('form');
  form.id = 'form-note-dialog';
  form.noValidate = true;
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = 'var(--cv-space-4)';

  const titleField = document.createElement('div');
  titleField.className = 'cv-field';
  const titleLabel = document.createElement('label');
  titleLabel.className = 'cv-label';
  titleLabel.htmlFor = 'note-dialog-title-input';
  titleLabel.textContent = t('notes.titleLabel');
  const req = document.createElement('span');
  req.className = 'cv-required';
  req.setAttribute('aria-hidden', 'true');
  req.textContent = '*';
  titleLabel.append(req);

  const titleInput = document.createElement('input');
  titleInput.id = 'note-dialog-title-input';
  titleInput.type = 'text';
  titleInput.className = 'cv-input';
  titleInput.required = true;
  titleInput.maxLength = 200;
  titleInput.disabled = readOnly;
  titleInput.value = note?.title ?? '';

  const titleError = document.createElement('span');
  titleError.id = 'note-dialog-title-error';
  titleError.className = 'cv-error';
  titleError.hidden = true;
  const titleErrIcon = document.createElement('i');
  titleErrIcon.className = 'ph ph-warning-circle cv-icon';
  titleErrIcon.setAttribute('aria-hidden', 'true');
  const titleErrText = document.createElement('span');
  titleErrText.textContent = t('notes.titleRequired');
  titleError.append(titleErrIcon, titleErrText);
  titleField.append(titleLabel, titleInput, titleError);

  const activeProjects = selectProjects(state);
  const projectChoices =
    note?.projectId && !activeProjects.some((p) => p.id === note.projectId)
      ? [...activeProjects, ...state.projects.filter((p) => p.id === note.projectId)]
      : activeProjects;

  const projectField = document.createElement('div');
  projectField.className = 'cv-field';
  const projectLabel = document.createElement('label');
  projectLabel.className = 'cv-label';
  projectLabel.htmlFor = 'note-dialog-project-select';
  projectLabel.textContent = t('common.linkedProject');
  const projectSelectWrap = document.createElement('div');
  projectSelectWrap.className = 'cv-select';
  const projectSelect = document.createElement('select');
  projectSelect.id = 'note-dialog-project-select';
  projectSelect.className = 'cv-input';
  projectSelect.disabled = readOnly;
  const noProjOpt = document.createElement('option');
  noProjOpt.value = '';
  noProjOpt.textContent = t('common.noProject');
  projectSelect.append(noProjOpt);
  for (const p of projectChoices) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.archived ? t('common.archivedName', { name: p.name }) : p.name;
    projectSelect.append(opt);
  }
  const preferredProj =
    state.preferences.selectedProjectId &&
    projectChoices.some((p) => p.id === state.preferences.selectedProjectId)
      ? state.preferences.selectedProjectId
      : '';
  projectSelect.value =
    note !== undefined ? (note.projectId ?? '') : (defaultProjectId ?? preferredProj);
  projectSelectWrap.append(projectSelect);
  projectField.append(projectLabel, projectSelectWrap);

  const tagEditor = createTagEditor({
    idPrefix: 'note-dialog-tags',
    labelText: t('common.tags'),
    initialTags: note?.tags ?? [],
    suggestions: selectAllTags(state),
    readOnly,
  });

  const linkEditor = createLinkEditor({
    idPrefix: 'note-dialog-links',
    state,
    currentRef: note ? { kind: 'note', id: note.id } : null,
    initialLinks: note?.links ?? [],
    readOnly,
    onNavigate(ref) {
      closeDialogById('dialog-note');
      cleanup();
      onNavigateLocalRef?.(ref);
    },
  });

  const contentField = document.createElement('div');
  contentField.className = 'cv-field';
  const contentLabel = document.createElement('span');
  contentLabel.className = 'cv-label';
  contentLabel.id = 'note-dialog-content-label';
  contentLabel.textContent = t('notes.content');
  const editorHost = document.createElement('div');
  contentField.append(contentLabel, editorHost);

  /** @type {Set<string>} */
  const stagedAssetIds = new Set();
  /** @param {File} file */
  async function handleUploadImage(file) {
    const res = await uploadLocalImage(file);
    if (res) stagedAssetIds.add(res.assetId);
    return res;
  }

  /** @type {RichTextDoc} */
  const initialDoc = note?.contentDoc ?? EMPTY_RICH_DOC;
  const editorHandle = mountRichTextEditor({
    container: editorHost,
    initialDoc,
    editable: !readOnly,
    ariaLabel: t('notes.contentAria'),
    resolveAssetUrl,
    onUploadImage: handleUploadImage,
    onBlockedRemoteImage: () => {
      notify({
        status: 'warning',
        title: t('editor.remoteImageBlocked'),
        text: t('editor.remoteImageBlockedText'),
      });
    },
    onRejectedLink: () => {
      notify({
        status: 'warning',
        title: t('editor.linkRejected'),
        text: t('editor.linkRejectedText'),
      });
    },
    onChange() {},
  });

  const noteDialogTemplatePicker = createTemplatePicker({
    idPrefix: 'note-dialog-tpl',
    labelText: t('notes.templatesLabel'),
    templates: selectTemplates(state, 'note', builtinTemplates),
    readOnly,
    showSave: true,
    onApply(tpl) {
      editorHandle.setDoc(instantiateNoteTemplate(tpl));
      notify({ status: 'success', title: t('notes.templateApplied'), text: tpl.name });
    },
    onSaveNew(name) {
      const id = crypto.randomUUID();
      store.dispatch({
        type: 'create_template',
        id,
        kind: 'note',
        name,
        contentDoc: editorHandle.getDoc(),
        now: new Date().toISOString(),
      });
      noteDialogTemplatePicker.setTemplates(
        selectTemplates(store.getState(), 'note', builtinTemplates),
        id,
      );
      notify({ status: 'success', title: t('notes.templateSaved'), text: name });
      return id;
    },
    onDeleteCustom(tpl) {
      store.dispatch({ type: 'delete_template', id: tpl.id });
      noteDialogTemplatePicker.setTemplates(
        selectTemplates(store.getState(), 'note', builtinTemplates),
      );
      notify({ status: 'info', title: t('templates.deleted'), text: tpl.name });
    },
  });

  form.append(
    titleField,
    projectField,
    tagEditor.element,
    linkEditor.element,
    noteDialogTemplatePicker.element,
    contentField,
  );
  bodyEl.replaceChildren(form);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'cv-btn';
  cancelBtn.setAttribute('data-cv-close', '');
  cancelBtn.textContent = t('common.cancel');

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.setAttribute('form', 'form-note-dialog');
  saveBtn.className = 'cv-btn cv-btn--primary';
  saveBtn.disabled = readOnly;
  saveBtn.textContent = isEdit ? t('common.save') : t('notes.create');

  /** @type {HTMLElement[]} */
  const footerButtons = [];
  if (isEdit && note && !readOnly) {
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'cv-btn cv-btn--danger';
    deleteBtn.textContent = t('common.delete');
    deleteBtn.addEventListener('click', async () => {
      closeDialogById('dialog-note');
      const confirmed = await confirmAction({
        title: t('common.deleteTitle', { title: note.title }),
        message: t('notes.deleteConfirm'),
        confirmLabel: t('notes.deleteLabel'),
        danger: true,
      });
      if (confirmed) {
        store.dispatch({
          type: 'trash_note',
          id: note.id,
          trashId: crypto.randomUUID(),
          now: new Date().toISOString(),
        });
        notify({ status: 'info', title: t('notes.trashed'), text: note.title });
      }
    });

    const archiveBtn = document.createElement('button');
    archiveBtn.type = 'button';
    archiveBtn.id = 'btn-dialog-archive-note';
    archiveBtn.className = 'cv-btn';
    archiveBtn.style.marginRight = 'auto';
    archiveBtn.textContent = note.archived ? t('common.unarchive') : t('common.archive');
    archiveBtn.addEventListener('click', () => {
      const nextArchived = !note.archived;
      store.dispatch({
        type: 'toggle_archive_note',
        id: note.id,
        archived: nextArchived,
        now: new Date().toISOString(),
      });
      closeDialogById('dialog-note');
      cleanup();
      notify({
        status: 'info',
        title: nextArchived ? t('notes.archivedTitle') : t('notes.unarchivedTitle'),
        text: nextArchived ? t('notes.archivedText', { title: note.title }) : note.title,
      });
    });

    const consultBtn = document.createElement('button');
    consultBtn.type = 'button';
    consultBtn.id = 'btn-switch-note-dialog-view';
    consultBtn.className = 'cv-btn';
    consultBtn.textContent = t('common.consult');
    consultBtn.addEventListener('click', () => {
      const fresh = store.getState().notes.find((n) => n.id === note.id) ?? note;
      openNoteDialog({ ...opts, note: fresh, mode: 'view' });
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
      titleInput.setAttribute('aria-describedby', 'note-dialog-title-error');
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
    const projectId = projectSelect.value ? projectSelect.value : null;
    const now = new Date().toISOString();

    try {
      if (isEdit && note) {
        store.dispatch({
          type: 'update_note',
          id: note.id,
          patch: {
            title: cleanTitle,
            projectId,
            contentDoc: doc,
            tags,
            links,
            assetIds,
          },
          now,
        });
        notify({ status: 'success', title: t('notes.saved'), text: cleanTitle });
      } else {
        const id = crypto.randomUUID();
        store.dispatch({
          type: 'create_note',
          id,
          projectId,
          title: cleanTitle,
          contentDoc: doc,
          tags,
          links,
          assetIds,
          now,
        });
        notify({ status: 'success', title: t('notes.created'), text: cleanTitle });
        onAfterCreate?.(id);
      }
    } catch (err) {
      notify({
        status: 'danger',
        title: t('common.saveFailed'),
        text: errorText(err, t, 'errors.validation'),
      });
      return;
    }

    const orphanedStaged = selectOrphanedAssetIds(store.getState(), stagedAssetIds);
    for (const id of orphanedStaged) {
      store.dispatch({ type: 'delete_asset', id });
    }
    stagedAssetIds.clear();
    closeDialogById('dialog-note');
    cleanup();
  });

  let closed = false;
  function cleanup() {
    if (closed) return;
    closed = true;
    if (activeNoteDialogCleanup === cleanup) activeNoteDialogCleanup = null;
    dialog?.removeEventListener('close', onClose);
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
    if (!dialog) return;
    dialog.returnValue = '';
    cleanup();
  }
  activeNoteDialogCleanup = cleanup;
  dialog.addEventListener('close', onClose);

  if (!dialog.open) {
    openDialogById('dialog-note');
  }
  titleInput.focus();
}
