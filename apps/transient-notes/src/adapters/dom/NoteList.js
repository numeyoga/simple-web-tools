// The notes list pane: a search field, a sort select, and one button per note (title, preview,
// date and folder). It shows what the selection, the search and the sort give; choosing a note
// opens it in the editor pane. The header (search, sort) is built once so that typing in the
// search field is never interrupted; only the list below it is drawn again.
import { toLocalIsoDate } from '@simple-web-tools/dates';
import { selectVisibleNotes } from '../../core/selectors.js';
import { notePreview } from '../../core/search.js';
import * as UI from './ui.js';

const { el, t } = UI;

/**
 * The date of a note in a list: the time for today, else the short date.
 * @param {string} iso an ISO 8601 timestamp
 * @param {Date} now
 */
function listDate(iso, now) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return toLocalIsoDate(date) === toLocalIsoDate(now)
    ? UI.formatDateTime(date, { timeStyle: 'short' })
    : UI.formatDateTime(date, { dateStyle: 'medium' });
}

/**
 * @param {import('./types.js').Store} store
 * @returns {import('./types.js').View & { focusSearch: () => void, focusNote: (noteId: string | null) => boolean }}
 */
export function createNoteList(store) {
  const collator = new Intl.Collator(UI.locale, { numeric: true, sensitivity: 'base' });

  const searchField = UI.Input({
    ariaLabel: t('notes.search'),
    placeholder: t('notes.searchPlaceholder'),
    type: 'search',
    icon: 'magnifying-glass',
    className: 'tn-grow',
    oninput: (e) =>
      store.dispatch({
        type: 'set_search',
        query: /** @type {HTMLInputElement} */ (e.target).value,
      }),
  });
  const sortSelect = UI.Select({
    ariaLabel: t('notes.sort'),
    value: store.getState().preferences.sort,
    options: [
      { value: 'updated', label: t('notes.sortUpdated') },
      { value: 'created', label: t('notes.sortCreated') },
      { value: 'title', label: t('notes.sortTitle') },
    ],
    onchange: (value) =>
      store.dispatch({
        type: 'set_sort',
        sort: /** @type {'updated' | 'created' | 'title'} */ (value),
      }),
  });
  const count = el('p', { class: 'tn-meta', role: 'status' });
  const body = el('div', { class: 'tn-list-body' });

  const header = el(
    'div',
    { class: 'tn-list-header' },
    el('div', { class: 'tn-row tn-gap-3' }, searchField),
    sortSelect,
    count,
  );
  const root = el(
    'section',
    { class: 'tn-list-pane', 'aria-label': t('notes.listLabel') },
    header,
    body,
  );

  /** The rows of the list, by note id. @type {Map<string, ReturnType<typeof createRow>>} */
  const rows = new Map();
  const list = el('ul', { class: 'tn-note-list' });

  /** @param {string} noteId */
  function createRow(noteId) {
    const title = el('span', { class: 'tn-note-title tn-ellipsis' });
    const preview = el('span', { class: 'tn-note-preview' });
    const date = el('span', { class: 'cv-num' });
    const folder = el('span', { class: 'tn-ellipsis' });
    const button = el(
      'button',
      {
        type: 'button',
        class: 'tn-note-item',
        'data-note-id': noteId,
        onclick: () => store.dispatch({ type: 'select_note', noteId }),
      },
      title,
      preview,
      el('span', { class: 'tn-note-meta' }, date, folder),
    );
    return { li: el('li', null, button), button, title, preview, date, folder };
  }

  /** @param {HTMLElement} node @param {string} text */
  function setText(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }

  function paint() {
    const state = store.getState();
    const notes = selectVisibleNotes(state, { compare: collator.compare });
    const now = new Date();

    // The header follows the state without touching what the user is typing or choosing.
    if (searchField.input.value !== state.search) searchField.input.value = state.search;
    if (sortSelect.input.value !== state.preferences.sort) {
      sortSelect.input.value = state.preferences.sort;
    }
    const countText = t('notes.count', { count: notes.length });
    if (count.textContent !== countText) count.textContent = countText;

    if (notes.length === 0) {
      const searching = state.search.trim() !== '';
      list.replaceChildren();
      rows.clear();
      body.replaceChildren(
        UI.EmptyState({
          icon: searching ? 'magnifying-glass' : 'note-pencil',
          title: searching ? t('notes.noMatchTitle') : t('notes.emptyTitle'),
          text: searching ? t('notes.noMatchText') : t('notes.emptyText'),
        }),
      );
      return;
    }
    if (body.firstElementChild !== list) body.replaceChildren(list);

    // The rows are kept and updated in place, never rebuilt: a note saved while the pointer is
    // down on a row (the title field blurs on mousedown and writes its change) must not swallow
    // the click.
    const folderName = new Map(state.folders.map((f) => [f.id, f.name]));
    const byCreation = state.preferences.sort === 'created';
    const shown = new Set(notes.map((note) => note.id));
    for (const [id, row] of rows) {
      if (!shown.has(id)) {
        row.li.remove();
        rows.delete(id);
      }
    }
    /** @type {ChildNode | null} */
    let next = list.firstChild;
    for (const note of notes) {
      let row = rows.get(note.id);
      if (!row) {
        row = createRow(note.id);
        rows.set(note.id, row);
      }
      const preview = notePreview(note);
      const folder = note.folderId ? folderName.get(note.folderId) : null;
      setText(row.title, note.title.trim() || t('notes.untitled'));
      setText(row.preview, preview);
      row.preview.hidden = preview === '';
      setText(row.date, listDate(byCreation ? note.createdAt : note.updatedAt, now));
      setText(row.folder, folder ?? '');
      row.folder.hidden = !folder;
      if (note.id === state.selectedNoteId) row.button.setAttribute('aria-current', 'true');
      else row.button.removeAttribute('aria-current');
      if (row.li === next) next = next.nextSibling;
      else list.insertBefore(row.li, next);
    }
  }

  paint();
  const unsubscribe = store.subscribe(paint);
  return {
    el: root,
    destroy: unsubscribe,
    focusSearch() {
      searchField.input.focus();
      searchField.input.select();
    },
    /**
     * Gives the focus to the button of a note, or to the first one when it is not in the list.
     * @param {string | null} noteId
     * @returns {boolean} whether a button took the focus
     */
    focusNote(noteId) {
      const buttons = /** @type {NodeListOf<HTMLElement>} */ (
        body.querySelectorAll('[data-note-id]')
      );
      const target = [...buttons].find((button) => button.dataset.noteId === noteId) ?? buttons[0];
      target?.focus({ preventScroll: true });
      return !!target;
    },
  };
}
