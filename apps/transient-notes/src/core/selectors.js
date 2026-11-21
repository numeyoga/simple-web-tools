/** @import { AppState, Folder, Note, ParaCategory, SortKey } from '../types.d.ts' */

// Read-only views of the state: what the lists and the tree show. Pure, and cheap enough to be
// called on each render.

import { referencedAssetIds, PARA_CATEGORIES } from './model.js';
import { noteMatches, tokenizeSearchQuery } from './search.js';
import { noteInSelection } from './store.js';

/**
 * @callback TextCompare
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */

/**
 * The text comparison of the interface language: `new Intl.Collator(locale, { numeric: true,
 * sensitivity: 'base' }).compare`. The core takes it as an argument because the language is the
 * adapter's business.
 * @type {TextCompare}
 */
const defaultCompare = (a, b) => a.localeCompare(b);

/**
 * @param {AppState} state
 * @param {string | null} id
 * @returns {Note | undefined}
 */
export function selectNoteById(state, id) {
  return id === null ? undefined : state.notes.find((n) => n.id === id);
}

/**
 * @param {AppState} state
 * @param {string | null} id
 * @returns {Folder | undefined}
 */
export function selectFolderById(state, id) {
  return id === null ? undefined : state.folders.find((f) => f.id === id);
}

/**
 * The folders of a category (or all of them), sorted by name.
 * @param {AppState} state
 * @param {ParaCategory | null} [category]
 * @param {TextCompare} [compare]
 * @returns {Folder[]}
 */
export function selectFolders(state, category = null, compare = defaultCompare) {
  return state.folders
    .filter((f) => category === null || f.category === category)
    .sort((a, b) => compare(a.name, b.name) || (a.id < b.id ? -1 : 1));
}

/**
 * The notes of the current selection, before search and sort.
 * @param {AppState} state
 * @returns {Note[]}
 */
export function selectSelectionNotes(state) {
  return state.notes.filter((n) => noteInSelection(n, state.selection, state.folders));
}

/**
 * Sort notes. Updated and created: newest first. Title: by the given comparison, notes with no
 * title last. Ties go to the newest, then to the id, so the order is stable.
 * @param {readonly Note[]} notes
 * @param {SortKey} sort
 * @param {TextCompare} [compare]
 * @returns {Note[]}
 */
export function sortNotes(notes, sort, compare = defaultCompare) {
  /** @param {Note} a @param {Note} b */
  const byDate = (a, b) => {
    if (sort === 'created' && a.createdAt !== b.createdAt)
      return a.createdAt < b.createdAt ? 1 : -1;
    if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id < b.id ? -1 : 1;
  };
  return [...notes].sort((a, b) => {
    if (sort === 'title') {
      const titleA = a.title.trim();
      const titleB = b.title.trim();
      if (titleA === '' && titleB !== '') return 1;
      if (titleA !== '' && titleB === '') return -1;
      const byTitle = compare(titleA, titleB);
      if (byTitle !== 0) return byTitle;
    }
    return byDate(a, b);
  });
}

/**
 * What the notes list shows: the notes of the selection that match the search, sorted.
 * @param {AppState} state
 * @param {{ compare?: TextCompare }} [options]
 * @returns {Note[]}
 */
export function selectVisibleNotes(state, { compare } = {}) {
  const tokens = tokenizeSearchQuery(state.search);
  const matching = selectSelectionNotes(state).filter((n) => noteMatches(n, tokens));
  return sortNotes(matching, state.preferences.sort, compare);
}

/**
 * Number of notes: everywhere, per category (all its folders) and per folder.
 * @param {AppState} state
 * @returns {{ all: number, byCategory: Record<ParaCategory, number>, byFolder: Record<string, number> }}
 */
export function selectNoteCounts(state) {
  const categoryOfFolder = new Map(state.folders.map((f) => [f.id, f.category]));
  const byCategory = /** @type {Record<ParaCategory, number>} */ (
    Object.fromEntries(PARA_CATEGORIES.map((c) => [c, 0]))
  );
  /** @type {Record<string, number>} */
  const byFolder = Object.fromEntries(state.folders.map((f) => [f.id, 0]));
  for (const note of state.notes) {
    if (note.folderId === null) continue;
    const category = categoryOfFolder.get(note.folderId);
    if (!category) continue;
    byCategory[category] += 1;
    byFolder[note.folderId] = (byFolder[note.folderId] ?? 0) + 1;
  }
  return { all: state.notes.length, byCategory, byFolder };
}

/**
 * The assets no note references any more (left by an edit, kept so that undo works).
 * @param {AppState} state
 * @returns {string[]}
 */
export function selectOrphanedAssetIds(state) {
  const used = referencedAssetIds(state.notes);
  return state.assets.filter((a) => !used.has(a.id)).map((a) => a.id);
}
