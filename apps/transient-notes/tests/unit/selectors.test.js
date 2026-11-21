// What the list shows: the selection (all notes, a category, one folder), the search and the
// sort; the counts of the tree.
import { describe, expect, test } from 'vitest';
import {
  selectFolders,
  selectNoteCounts,
  selectOrphanedAssetIds,
  selectVisibleNotes,
  sortNotes,
} from '../../src/core/selectors.js';
import { at, asset, doc, docWithImage, folder, note, stateWith } from './support/data.js';

const state = stateWith({
  folders: [
    folder({ id: 'p1', name: 'Website', category: 'projects' }),
    folder({ id: 'p2', name: 'accounting', category: 'projects' }),
    folder({ id: 'a1', name: 'Health', category: 'areas' }),
  ],
  notes: [
    note({ id: 'n1', title: 'Quote', folderId: 'p1', createdAt: at(1), updatedAt: at(30) }),
    note({ id: 'n2', title: 'Invoice', folderId: 'p2', createdAt: at(2), updatedAt: at(10) }),
    note({ id: 'n3', title: 'Run', folderId: 'a1', createdAt: at(3), updatedAt: at(20) }),
    note({ id: 'n4', title: 'Loose', folderId: null, createdAt: at(4), updatedAt: at(5) }),
  ],
});

/** @param {Partial<typeof state>} change */
const ids = (change) => selectVisibleNotes({ ...state, ...change }).map((n) => n.id);

describe('selection', () => {
  test('"All notes" shows every note, with or without a folder', () => {
    expect(ids({})).toEqual(['n1', 'n3', 'n2', 'n4']); // updated, newest first
  });

  test('a category shows the notes of all its folders', () => {
    expect(ids({ selection: { kind: 'category', category: 'projects' } })).toEqual(['n1', 'n2']);
    expect(ids({ selection: { kind: 'category', category: 'archives' } })).toEqual([]);
  });

  test('a folder shows its own notes only', () => {
    expect(ids({ selection: { kind: 'folder', folderId: 'p2' } })).toEqual(['n2']);
  });
});

describe('search', () => {
  test('filters within the selection, by title and content, ignoring case and accents', () => {
    const withContent = {
      ...state,
      notes: [
        ...state.notes,
        note({ id: 'n5', title: 'Ideas', folderId: 'a1', doc: doc('Café noir') }),
      ],
    };

    expect(selectVisibleNotes({ ...withContent, search: 'CAFE' }).map((n) => n.id)).toEqual(['n5']);
    expect(
      selectVisibleNotes({
        ...withContent,
        search: 'u',
        selection: { kind: 'category', category: 'areas' },
      }).map((n) => n.id),
    ).toEqual(['n3']); // "Run" has a u, "Ideas" does not
  });
});

describe('sort', () => {
  test('updated and created: newest first', () => {
    expect(ids({ preferences: { sort: 'updated' } })).toEqual(['n1', 'n3', 'n2', 'n4']);
    expect(ids({ preferences: { sort: 'created' } })).toEqual(['n4', 'n3', 'n2', 'n1']);
  });

  test('title: by the given comparison, ignoring case, and notes with no title last', () => {
    const notes = [
      note({ id: 'b', title: 'banana' }),
      note({ id: 'e', title: '' }),
      note({ id: 'a', title: 'Apple' }),
      note({ id: 'c', title: 'cherry 10' }),
      note({ id: 'd', title: 'cherry 2' }),
    ];
    const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

    expect(sortNotes(notes, 'title', collator.compare).map((n) => n.id)).toEqual([
      'a',
      'b',
      'd',
      'c',
      'e',
    ]);
  });

  test('French collation puts an accented word where a French reader looks for it', () => {
    const notes = [
      note({ id: 'z', title: 'zèbre' }),
      note({ id: 'e', title: 'éclair' }),
      note({ id: 'f', title: 'fin' }),
    ];
    const collator = new Intl.Collator('fr', { sensitivity: 'base' });

    expect(sortNotes(notes, 'title', collator.compare).map((n) => n.id)).toEqual(['e', 'f', 'z']);
  });

  test('ties keep a stable order: newest edit, then id', () => {
    const notes = [
      note({ id: 'b', title: 'same', updatedAt: at(1) }),
      note({ id: 'a', title: 'same', updatedAt: at(1) }),
      note({ id: 'c', title: 'same', updatedAt: at(9) }),
    ];

    expect(sortNotes(notes, 'title').map((n) => n.id)).toEqual(['c', 'a', 'b']);
  });

  test('does not change the given list', () => {
    const notes = [note({ id: 'b', title: 'b' }), note({ id: 'a', title: 'a' })];

    sortNotes(notes, 'title');

    expect(notes.map((n) => n.id)).toEqual(['b', 'a']);
  });
});

describe('folders and counts', () => {
  test('folders of a category, sorted by name with the given comparison', () => {
    const collator = new Intl.Collator('en', { sensitivity: 'base' });

    expect(selectFolders(state, 'projects', collator.compare).map((f) => f.id)).toEqual([
      'p2',
      'p1',
    ]);
    expect(selectFolders(state, null, collator.compare)).toHaveLength(3);
  });

  test('counts per category and per folder; a note with no folder counts only in "All"', () => {
    expect(selectNoteCounts(state)).toEqual({
      all: 4,
      byCategory: { projects: 2, areas: 1, resources: 0, archives: 0 },
      byFolder: { p1: 1, p2: 1, a1: 1 },
    });
  });
});

describe('orphaned assets', () => {
  test('lists the pictures no note shows', () => {
    const withAssets = stateWith({
      notes: [note({ id: 'n1', doc: docWithImage('used') })],
      assets: [asset('used'), asset('orphan')],
    });

    expect(selectOrphanedAssetIds(withAssets)).toEqual(['orphan']);
  });
});
