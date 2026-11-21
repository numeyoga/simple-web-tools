// The main region: the notes list and the editor pane, side by side (the tree is the sidebar).
// Below 768 px they are stacked: the list while no note is open, the editor once one is, with a
// back control in the editor. Everything goes through the store, so what is shown is what is
// saved: the selection, the counts and the notes of the active workspace.
import { categoryLabel } from '../labels.js';
import { createNoteEditor } from './NoteEditor.js';
import { createNoteList } from './NoteList.js';
import * as UI from './ui.js';

const { el, t } = UI;

/**
 * @param {import('../../types.d.ts').AppState} state
 * @returns {string} the name of what the selection shows: the h1 of the page
 */
export function selectionTitle(state) {
  const { selection } = state;
  if (selection.kind === 'all') return t('nav.allNotes');
  if (selection.kind === 'category') return categoryLabel(selection.category);
  return state.folders.find((f) => f.id === selection.folderId)?.name ?? t('nav.allNotes');
}

/**
 * @param {import('./types.js').Store} store
 * @param {{ toasts: import('./types.js').ToastHost }} options
 * @returns {import('./types.js').View & { focusSearch: () => void, commit: () => void }}
 */
export function createNotesView(store, { toasts }) {
  const narrow = window.matchMedia('(max-width: 767px)');
  const root = el('div', { class: 'tn-notes' });

  /** Which pane the narrow layout shows: first, so the editor is visible when it takes the focus. */
  const unsubscribePane = store.subscribe(({ state }) => {
    root.dataset.pane = state.selectedNoteId === null ? 'list' : 'editor';
  });
  root.dataset.pane = store.getState().selectedNoteId === null ? 'list' : 'editor';

  const list = createNoteList(store);
  const editor = createNoteEditor(store, {
    toasts,
    onBack: () => store.dispatch({ type: 'select_note', noteId: null }),
  });
  root.append(list.el, editor.el);

  // Last: the list and the editor have drawn. A pane that disappears took the focus with it.
  const unsubscribeFocus = store.subscribe(({ state, prevState }) => {
    if (state.selectedNoteId === prevState.selectedNoteId) return;
    const active = document.activeElement;
    const lost = !active || active === document.body || !active.isConnected;
    if (state.selectedNoteId === null) {
      if (lost || editor.el.contains(active)) {
        if (!list.focusNote(prevState.selectedNoteId)) list.focusSearch();
      }
    } else if (narrow.matches && (lost || list.el.contains(active))) {
      editor.focus();
    }
  });

  return {
    el: root,
    mounted: () => editor.mounted?.(),
    focusSearch() {
      // The list is hidden while the editor shows on a narrow screen: close the note first.
      if (store.getState().selectedNoteId !== null && narrow.matches) {
        editor.commit();
        store.dispatch({ type: 'select_note', noteId: null });
      }
      list.focusSearch();
    },
    commit: () => editor.commit(),
    destroy() {
      unsubscribePane();
      unsubscribeFocus();
      list.destroy?.();
      editor.destroy?.();
    },
  };
}
