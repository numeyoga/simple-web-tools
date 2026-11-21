// The editor pane: the title field, the folder picker, the export menu, the delete button and the
// rich-text editor of the open note.
//
// - The editor (Tiptap) is a lazy chunk of `@simple-web-tools/rich-text`, mounted when a note is
//   opened. It reports every change; the change is held for a moment and written as one
//   `update_note`, and always before the note is left, a note is deleted, an export is made or the
//   tab is hidden or closed (the store then flushes to IndexedDB).
// - The stored title is never written back into the field while it has the focus (the person is
//   typing); the field only follows the state when a read-only tab re-reads the database.
// - Images are stored by the store (`addImage`); the document holds only their ids. Edits keep an
//   image that was removed, so that undo works: the orphans are purged when the note is left.
import { mountRichTextEditor } from '@simple-web-tools/rich-text/editor-lazy';
import { PARA_CATEGORIES } from '../../core/model.js';
import { selectFolders, selectNoteById } from '../../core/selectors.js';
import { EXPORT_FORMAT, exportNote } from '../export-actions.js';
import { updateNoteCommand } from '../commands.js';
import { categoryLabel } from '../labels.js';
import { editorLabels, initEditorTooltips, setEditorTooltip } from './editor-hooks.js';
import * as UI from './ui.js';

const { el, t } = UI;

/** How long a change waits for the next one before it is written, in milliseconds. */
const SAVE_DELAY_MS = 300;

/**
 * @param {import('./types.js').Store} store
 * @param {{ toasts: import('./types.js').ToastHost, onBack: () => void }} options
 * @returns {import('./types.js').View & { commit: () => void, focus: () => void }}
 */
export function createNoteEditor(store, { toasts, onBack }) {
  const collator = new Intl.Collator(UI.locale, { numeric: true, sensitivity: 'base' });

  /** The note shown, and what was last drawn of it. */
  let currentId = /** @type {string | null} */ (null);
  let drawnNote = /** @type {import('../../types.d.ts').Note | null} */ (null);
  let foldersKey = '';
  /** @type {ReturnType<typeof mountRichTextEditor> | null} */
  let handle = null;
  let editable = true;
  /** Changes not written yet. @type {{ id: string, title?: string, doc?: import('../../types.d.ts').RichTextDoc } | null} */
  let pending = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null;

  /* ---------------- saving ---------------- */

  /** Writes the held changes now. */
  function commit() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (!pending) return;
    const { id, ...changes } = pending;
    pending = null;
    store.dispatch(updateNoteCommand(id, changes));
  }

  /** @param {{ title?: string, doc?: import('../../types.d.ts').RichTextDoc }} change */
  function hold(change) {
    if (currentId === null) return;
    pending = { ...(pending?.id === currentId ? pending : null), id: currentId, ...change };
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(commit, SAVE_DELAY_MS);
  }

  /** Drops the held changes (the note is going away). */
  function discard() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    pending = null;
  }

  // Before the store's own listeners (they are on the same targets, added earlier): a hidden or
  // closing tab writes the held changes first, so that the store flushes them with the rest.
  window.addEventListener('pagehide', commit, { capture: true });
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.visibilityState === 'hidden') commit();
    },
    { capture: true },
  );

  /* ---------------- the controls ---------------- */

  const titleField = UI.Input({
    ariaLabel: t('notes.title'),
    placeholder: t('notes.untitled'),
    className: 'tn-title-field',
    oninput: (e) => hold({ title: /** @type {HTMLInputElement} */ (e.target).value }),
    onblur: commit,
  });
  titleField.input.classList.add('tn-title-input');
  titleField.input.maxLength = 200;

  const folderSelect = UI.Select({
    ariaLabel: t('notes.folder'),
    value: '',
    options: [],
    mutates: true,
    className: 'tn-folder-field',
    onchange: (value) => {
      if (currentId === null) return;
      commit();
      store.dispatch({ type: 'move_note', id: currentId, folderId: value === '' ? null : value });
    },
  });

  const backButton = UI.Button({
    icon: 'arrow-left',
    children: t('notes.back'),
    className: 'tn-back',
    onclick: onBack,
  });

  const exportMenu = UI.Menu({
    icon: 'download-simple',
    label: t('notes.export'),
    size: 'md',
    items: [
      {
        label: t('notes.exportText'),
        icon: 'file-text',
        onclick: () => exportCurrent(EXPORT_FORMAT.text),
      },
      {
        label: t('notes.exportMarkdown'),
        icon: 'file-md',
        onclick: () => exportCurrent(EXPORT_FORMAT.markdown),
      },
    ],
  });

  const deleteButton = UI.IconButton({
    icon: 'trash',
    label: t('notes.delete'),
    mutates: true,
    onclick: () => void deleteCurrent(),
  });

  const meta = el('p', { class: 'tn-meta tn-editor-meta' });
  const editorBody = el('div', { class: 'tn-editor-body' });

  const header = el(
    'div',
    { class: 'tn-editor-head' },
    backButton,
    el('div', { class: 'tn-editor-tools' }, folderSelect, exportMenu, deleteButton),
  );
  const form = el('div', { class: 'tn-editor-form' }, header, titleField, editorBody, meta);

  const empty = UI.EmptyState({
    icon: 'note-pencil',
    title: t('notes.selectTitle'),
    text: t('notes.selectText'),
  });
  const root = el(
    'section',
    { class: 'tn-editor-pane', 'aria-label': t('notes.editorLabel'), tabindex: -1 },
    form,
    empty,
  );

  /* ---------------- actions on the open note ---------------- */

  /** @param {import('../export-actions.js').ExportFormat} format */
  function exportCurrent(format) {
    commit();
    const note = selectNoteById(store.getState(), currentId);
    if (note) exportNote(note, format);
  }

  async function deleteCurrent() {
    const note = selectNoteById(store.getState(), currentId);
    if (!note) return;
    commit();
    const ok = await UI.Confirm({
      title: t('notes.deleteTitle'),
      message: t('notes.deleteMessage', { title: note.title.trim() || t('notes.untitled') }),
      confirmLabel: t('common.delete'),
      danger: true,
    });
    if (!ok) return;
    discard();
    store.dispatch({ type: 'delete_note', id: note.id });
    toasts.push({ variant: 'success', title: t('notes.deleted') });
  }

  /** @param {File} file */
  async function uploadImage(file) {
    const result = store.addImage(file);
    if ('error' in result) {
      if (result.error === 'unsupported-type') {
        toasts.push({
          variant: 'warning',
          title: t('editor.imageUnsupported'),
          body: t('editor.imageUnsupportedText'),
        });
      } else if (result.error === 'too-large') {
        toasts.push({
          variant: 'warning',
          title: t('editor.imageTooLarge'),
          body: t('editor.imageTooLargeText'),
        });
      }
      return null;
    }
    return { assetId: result.asset.id, alt: file.name };
  }

  /* ---------------- drawing ---------------- */

  /** @param {import('../../types.d.ts').AppState} state */
  function paintFolders(state, /** @type {import('../../types.d.ts').Note} */ note) {
    const folders = selectFolders(state, null, collator.compare);
    const key = JSON.stringify([folders.map((f) => [f.id, f.name, f.category]), note.folderId]);
    if (key === foldersKey) return;
    foldersKey = key;
    const select = folderSelect.input;
    select.replaceChildren(el('option', { value: '' }, t('notes.noFolder')));
    for (const category of PARA_CATEGORIES) {
      const inCategory = folders.filter((f) => f.category === category);
      if (inCategory.length === 0) continue;
      select.append(
        el(
          'optgroup',
          { label: categoryLabel(category) },
          inCategory.map((f) => el('option', { value: f.id }, f.name)),
        ),
      );
    }
    select.value = note.folderId ?? '';
  }

  /** @param {import('../../types.d.ts').Note} note */
  function paintMeta(note) {
    const text = t('notes.edited', {
      date: UI.formatDateTime(new Date(note.updatedAt), {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    });
    if (meta.textContent !== text) meta.textContent = text;
  }

  /** Shows a note that was not open: the title, a new editor, the folder. @param {import('../../types.d.ts').Note} note @param {boolean} readOnly */
  function open(note, readOnly) {
    leave();
    currentId = note.id;
    drawnNote = note;
    foldersKey = '';
    editable = !readOnly;
    titleField.input.value = note.title;
    handle = mountRichTextEditor({
      container: editorBody,
      initialDoc: note.doc,
      editable: !readOnly,
      ariaLabel: t('notes.body'),
      labels: editorLabels(),
      resolveAssetUrl: (id) => store.getAssetUrl(id),
      onUploadImage: uploadImage,
      onChange: (doc) => hold({ doc }),
      onBlockedRemoteImage: () =>
        toasts.push({
          variant: 'warning',
          title: t('editor.remoteImageBlocked'),
          body: t('editor.remoteImageBlockedText'),
        }),
      onRejectedLink: () =>
        toasts.push({
          variant: 'warning',
          title: t('editor.linkRejected'),
          body: t('editor.linkRejectedText'),
        }),
      setTooltip: setEditorTooltip,
      initTooltips: initEditorTooltips,
    });
  }

  /** Closes the open note: writes what is held, drops its editor, purges the unused images. */
  function leave() {
    if (currentId === null) return;
    commit();
    handle?.destroy();
    handle = null;
    currentId = null;
    drawnNote = null;
    editorBody.replaceChildren();
    if (!store.getState().readOnly) store.dispatch({ type: 'purge_orphaned_assets' });
  }

  /** @param {{ state: import('../../types.d.ts').AppState, command?: import('../../types.d.ts').AppCommand }} [info] */
  function paint(info) {
    const state = store.getState();
    const note = selectNoteById(state, state.selectedNoteId);
    form.hidden = !note;
    empty.hidden = !!note;
    if (!note) {
      leave();
      return;
    }
    if (note.id !== currentId) {
      open(note, state.readOnly);
      if (info?.command?.type === 'create_note') titleField.input.focus();
    } else {
      if (drawnNote !== note && state.readOnly) {
        // Another tab wrote: follow it (this tab cannot be typing).
        if (titleField.input.value !== note.title) titleField.input.value = note.title;
        handle?.setDoc(note.doc);
      }
      drawnNote = note;
    }
    // A read-only tab shows the note without a toolbar; the title field stays readable.
    titleField.input.readOnly = state.readOnly;
    if (editable === state.readOnly) {
      editable = !state.readOnly;
      handle?.setEditable(editable);
    }
    paintFolders(state, note);
    paintMeta(note);
  }

  form.hidden = true;
  const unsubscribe = store.subscribe((info) => paint(info));
  paint();
  return {
    el: root,
    commit,
    focus: () => root.focus({ preventScroll: true }),
    mounted: () => UI.initCovenant(root),
    destroy() {
      unsubscribe();
      leave();
    },
  };
}
