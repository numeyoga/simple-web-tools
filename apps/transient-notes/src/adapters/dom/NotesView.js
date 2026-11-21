// The main region. For now a plain list of the notes of the current selection: the three panes
// (tree, list, editor) come with the rich-text editor. It already goes through the store, so what
// it shows is what is saved: the selection, the counts and the notes of the active workspace.
import { selectVisibleNotes } from '../../core/selectors.js';
import { categoryLabel } from '../labels.js';
import * as UI from './ui.js';

const { el, icon, t } = UI;

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
 * @returns {import('./types.js').View}
 */
export function createNotesView(store) {
  const root = el('section', { class: 'tn-view', 'aria-label': t('notes.listLabel') });
  const collator = new Intl.Collator(UI.locale, { numeric: true, sensitivity: 'base' });

  function paint() {
    const state = store.getState();
    const notes = selectVisibleNotes(state, { compare: collator.compare });
    if (notes.length === 0) {
      root.replaceChildren(
        UI.EmptyState({
          icon: 'note-pencil',
          title: t('notes.emptyTitle'),
          text: t('notes.emptyText'),
        }),
      );
      return;
    }
    root.replaceChildren(
      el('p', { class: 'tn-meta' }, t('notes.count', { count: notes.length })),
      el(
        'ul',
        { class: 'tn-note-list' },
        notes.map((note) =>
          el(
            'li',
            null,
            el(
              'button',
              {
                type: 'button',
                class: 'cv-btn cv-btn--ghost tn-note-item',
                'aria-current': note.id === state.selectedNoteId ? 'true' : null,
                onclick: () => store.dispatch({ type: 'select_note', noteId: note.id }),
              },
              icon('note'),
              el('span', { class: 'tn-ellipsis' }, note.title.trim() || t('notes.untitled')),
            ),
          ),
        ),
      ),
    );
  }

  paint();
  const unsubscribe = store.subscribe(paint);
  return { el: root, destroy: unsubscribe };
}
