// Notes: create (in the current folder or category, with a default folder when a category has
// none), update, move, delete (with the images only that note uses), assets and orphans.
import { describe, expect, test } from 'vitest';
import { reduce } from '../../src/core/store.js';
import { at, asset, doc, docWithImage, folder, note, stateWith } from './support/data.js';

const png = /** @type {Blob} */ (/** @type {unknown} */ ({ size: 4, type: 'image/png' }));

describe('create_note', () => {
  test('under "All notes" the note has no folder and is selected', () => {
    const { nextState, effects } = reduce(stateWith(), {
      type: 'create_note',
      id: 'n1',
      now: at(1),
    });

    expect(nextState.notes).toEqual([
      {
        id: 'n1',
        title: '',
        doc: { type: 'doc', content: [{ type: 'paragraph' }] },
        folderId: null,
        createdAt: at(1),
        updatedAt: at(1),
      },
    ]);
    expect(nextState.selectedNoteId).toBe('n1');
    expect(effects).toEqual([{ type: 'persist_note', note: nextState.notes[0] }]);
  });

  test('with a folder selected the note goes in that folder', () => {
    const state = stateWith({
      folders: [folder({ id: 'f1' })],
      selection: { kind: 'folder', folderId: 'f1' },
    });

    const { nextState } = reduce(state, { type: 'create_note', id: 'n1', now: at() });

    expect(nextState.notes[0]?.folderId).toBe('f1');
    expect(nextState.selection).toEqual({ kind: 'folder', folderId: 'f1' });
  });

  test('with a category selected it goes in the oldest folder of the category', () => {
    const state = stateWith({
      folders: [
        folder({ id: 'f2', category: 'areas', createdAt: at(9) }),
        folder({ id: 'f1', category: 'areas', createdAt: at(2) }),
        folder({ id: 'f3', category: 'projects', createdAt: at(0) }),
      ],
      selection: { kind: 'category', category: 'areas' },
    });

    const { nextState, effects } = reduce(state, { type: 'create_note', id: 'n1', now: at(10) });

    expect(nextState.notes[0]?.folderId).toBe('f1');
    expect(nextState.selection).toEqual({ kind: 'category', category: 'areas' });
    expect(effects.map((e) => e.type)).toEqual(['persist_note']);
  });

  test('a category with no folder gets the default folder, created with the note', () => {
    const state = stateWith({ selection: { kind: 'category', category: 'resources' } });

    const { nextState, effects } = reduce(state, {
      type: 'create_note',
      id: 'n1',
      now: at(3),
      defaultFolder: { id: 'fd', name: 'General resources' },
    });

    expect(nextState.folders).toEqual([
      { id: 'fd', name: 'General resources', category: 'resources', createdAt: at(3) },
    ]);
    expect(nextState.notes[0]?.folderId).toBe('fd');
    expect(effects.map((e) => e.type)).toEqual(['persist_folder', 'persist_note']);
  });

  test('without a default folder to create, a category with no folder refuses the note', () => {
    const state = stateWith({ selection: { kind: 'category', category: 'resources' } });

    expect(reduce(state, { type: 'create_note', id: 'n1', now: at() }).nextState).toBe(state);
  });

  test('a quick create in a category selects the folder that holds the note', () => {
    const state = stateWith({ folders: [folder({ id: 'f1', category: 'archives' })] });

    const { nextState } = reduce(state, {
      type: 'create_note',
      id: 'n1',
      now: at(),
      category: 'archives',
      defaultFolder: { id: 'unused', name: 'Unused' },
    });

    expect(nextState.notes[0]?.folderId).toBe('f1');
    expect(nextState.folders).toHaveLength(1); // the default folder is only for an empty category
    expect(nextState.selection).toEqual({ kind: 'folder', folderId: 'f1' });
  });

  test('a quick create ignores the selection: Areas selected, 1 creates in Projects', () => {
    const state = stateWith({
      folders: [
        folder({ id: 'fp', category: 'projects' }),
        folder({ id: 'fa', category: 'areas' }),
      ],
      selection: { kind: 'folder', folderId: 'fa' },
    });

    const { nextState } = reduce(state, {
      type: 'create_note',
      id: 'n1',
      now: at(),
      category: 'projects',
    });

    expect(nextState.notes[0]?.folderId).toBe('fp');
  });

  test('clears the search, which could hide the new note', () => {
    const state = stateWith({ search: 'something' });

    expect(reduce(state, { type: 'create_note', id: 'n1', now: at() }).nextState.search).toBe('');
  });

  test('an id already used, or an unknown category, changes nothing', () => {
    const state = stateWith({ notes: [note({ id: 'n1' })] });

    expect(reduce(state, { type: 'create_note', id: 'n1', now: at() }).nextState).toBe(state);
    expect(
      reduce(state, {
        type: 'create_note',
        id: 'n2',
        now: at(),
        category: /** @type {never} */ ('inbox'),
      }).nextState,
    ).toBe(state);
  });
});

describe('update_note', () => {
  const state = stateWith({
    notes: [note({ id: 'n1', title: 'Old', doc: doc('a'), updatedAt: at(1) })],
  });

  test('changes the title and the content, and stamps the edit', () => {
    const { nextState, effects } = reduce(state, {
      type: 'update_note',
      id: 'n1',
      now: at(7),
      title: 'New',
      doc: doc('b'),
    });

    expect(nextState.notes[0]).toMatchObject({ title: 'New', doc: doc('b'), updatedAt: at(7) });
    expect(nextState.notes[0]?.createdAt).toBe(at(0));
    expect(effects).toEqual([{ type: 'persist_note', note: nextState.notes[0] }]);
  });

  test('the content is sanitized: a script-like link or a remote image does not get in', () => {
    const dirty = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'x',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
          ],
        },
        { type: 'script', content: [] },
      ],
    };

    const { nextState } = reduce(state, {
      type: 'update_note',
      id: 'n1',
      now: at(7),
      doc: /** @type {never} */ (dirty),
    });

    expect(JSON.stringify(nextState.notes[0]?.doc)).not.toMatch(/javascript|script/);
  });

  test('a title is kept as typed (spaces included) but never holds a line break', () => {
    const { nextState } = reduce(state, {
      type: 'update_note',
      id: 'n1',
      now: at(7),
      title: 'My note \n two',
    });

    expect(nextState.notes[0]?.title).toBe('My note   two');
  });

  test('the same title and content change nothing, not even the edit date', () => {
    const result = reduce(state, {
      type: 'update_note',
      id: 'n1',
      now: at(9),
      title: 'Old',
      doc: doc('a'),
    });

    expect(result.nextState).toBe(state);
    expect(result.effects).toEqual([]);
  });

  test('an unknown note changes nothing', () => {
    expect(
      reduce(state, { type: 'update_note', id: 'nope', now: at(), title: 'x' }).nextState,
    ).toBe(state);
  });

  test('removing a picture from a note keeps its asset: the editor can still undo', () => {
    const withImage = stateWith({
      notes: [note({ id: 'n1', doc: docWithImage('a1') })],
      assets: [asset('a1')],
    });

    const { nextState, effects } = reduce(withImage, {
      type: 'update_note',
      id: 'n1',
      now: at(2),
      doc: doc('text'),
    });

    expect(nextState.assets.map((a) => a.id)).toEqual(['a1']);
    expect(effects.map((e) => e.type)).toEqual(['persist_note']);
  });
});

describe('move_note', () => {
  const state = stateWith({
    folders: [folder({ id: 'f1' })],
    notes: [note({ id: 'n1', folderId: null, updatedAt: at(4) })],
  });

  test('files the note in a folder without counting as an edit', () => {
    const { nextState, effects } = reduce(state, { type: 'move_note', id: 'n1', folderId: 'f1' });

    expect(nextState.notes[0]).toMatchObject({ folderId: 'f1', updatedAt: at(4) });
    expect(effects).toEqual([{ type: 'persist_note', note: nextState.notes[0] }]);
  });

  test('takes a note out of its folder', () => {
    const filed = reduce(state, { type: 'move_note', id: 'n1', folderId: 'f1' }).nextState;

    expect(
      reduce(filed, { type: 'move_note', id: 'n1', folderId: null }).nextState.notes[0]?.folderId,
    ).toBe(null);
  });

  test('an unknown folder, an unknown note or the same folder change nothing', () => {
    for (const command of [
      { type: 'move_note', id: 'n1', folderId: 'nope' },
      { type: 'move_note', id: 'nope', folderId: 'f1' },
      { type: 'move_note', id: 'n1', folderId: null },
    ]) {
      expect(reduce(state, /** @type {never} */ (command)).nextState).toBe(state);
    }
  });
});

describe('delete_note', () => {
  const state = stateWith({
    notes: [
      note({ id: 'n1', doc: docWithImage('mine') }),
      note({
        id: 'n2',
        doc: { type: 'doc', content: [docWithImage('shared').content?.[1] ?? { type: 'x' }] },
      }),
      note({ id: 'n3', doc: docWithImage('shared') }),
    ],
    assets: [asset('mine'), asset('shared'), asset('orphan')],
    selectedNoteId: 'n1',
  });

  test('removes the note and the images that only it references', () => {
    const { nextState, effects } = reduce(state, { type: 'delete_note', id: 'n1' });

    expect(nextState.notes.map((n) => n.id)).toEqual(['n2', 'n3']);
    expect(nextState.assets.map((a) => a.id)).toEqual(['shared', 'orphan']);
    expect(nextState.selectedNoteId).toBeNull();
    expect(effects).toEqual([
      { type: 'remove_note', id: 'n1' },
      { type: 'remove_asset', id: 'mine' },
    ]);
  });

  test('keeps an image that another note still shows', () => {
    const { nextState, effects } = reduce(state, { type: 'delete_note', id: 'n2' });

    expect(nextState.assets.map((a) => a.id)).toContain('shared');
    expect(effects).toEqual([{ type: 'remove_note', id: 'n2' }]);
  });

  test('deleting another note keeps the selection', () => {
    expect(reduce(state, { type: 'delete_note', id: 'n3' }).nextState.selectedNoteId).toBe('n1');
  });

  test('an unknown note changes nothing', () => {
    expect(reduce(state, { type: 'delete_note', id: 'nope' }).nextState).toBe(state);
  });
});

describe('assets', () => {
  test('add_asset stores the metadata in the state and the picture in the effect', () => {
    const { nextState, effects } = reduce(stateWith(), {
      type: 'add_asset',
      asset: asset('a1'),
      blob: png,
    });

    expect(nextState.assets).toEqual([asset('a1')]);
    expect(effects).toEqual([{ type: 'persist_asset', asset: asset('a1'), blob: png }]);
  });

  test.each([
    ['an SVG, which can hold script', { ...asset('a1'), mime: 'image/svg+xml' }],
    ['an empty picture', { ...asset('a1'), size: 0 }],
    ['an empty id', { ...asset(''), id: '' }],
  ])('add_asset refuses %s', (_label, meta) => {
    const state = stateWith();

    expect(reduce(state, { type: 'add_asset', asset: meta, blob: png }).nextState).toBe(state);
  });

  test('add_asset refuses an id already stored', () => {
    const state = stateWith({ assets: [asset('a1')] });

    expect(reduce(state, { type: 'add_asset', asset: asset('a1'), blob: png }).nextState).toBe(
      state,
    );
  });

  test('purge_orphaned_assets removes the pictures no note shows, and only those', () => {
    const state = stateWith({
      notes: [note({ id: 'n1', doc: docWithImage('used') })],
      assets: [asset('used'), asset('orphan')],
    });

    const { nextState, effects } = reduce(state, { type: 'purge_orphaned_assets' });

    expect(nextState.assets.map((a) => a.id)).toEqual(['used']);
    expect(effects).toEqual([{ type: 'remove_asset', id: 'orphan' }]);
    expect(reduce(nextState, { type: 'purge_orphaned_assets' }).nextState).toBe(nextState);
  });
});
