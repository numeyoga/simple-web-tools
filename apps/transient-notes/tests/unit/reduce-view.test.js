// View commands (selection, search, sort), hydrate, reload, and the read-only tab: data commands
// are refused, view commands keep working.
import { describe, expect, test } from 'vitest';
import { createInitialState, createStore, isDataCommand, reduce } from '../../src/core/store.js';
import { at, asset, doc, folder, note, stateWith } from './support/data.js';

const filled = () =>
  stateWith({
    folders: [folder({ id: 'f1', category: 'areas' }), folder({ id: 'f2', category: 'projects' })],
    notes: [
      note({ id: 'n1', folderId: 'f1' }),
      note({ id: 'n2', folderId: 'f2' }),
      note({ id: 'n3', folderId: null }),
    ],
  });

describe('select', () => {
  test('selects a category or a folder that exists', () => {
    const state = filled();

    expect(
      reduce(state, { type: 'select', selection: { kind: 'category', category: 'areas' } })
        .nextState.selection,
    ).toEqual({ kind: 'category', category: 'areas' });
    expect(
      reduce(state, { type: 'select', selection: { kind: 'folder', folderId: 'f2' } }).nextState
        .selection,
    ).toEqual({ kind: 'folder', folderId: 'f2' });
  });

  test('an unknown folder or category is ignored', () => {
    const state = filled();

    expect(
      reduce(state, { type: 'select', selection: { kind: 'folder', folderId: 'nope' } }).nextState,
    ).toBe(state);
    expect(
      reduce(state, {
        type: 'select',
        selection: { kind: 'category', category: /** @type {never} */ ('x') },
      }).nextState,
    ).toBe(state);
  });

  test('the open note stays open only if the new selection shows it', () => {
    const state = { ...filled(), selectedNoteId: 'n1' };

    const same = reduce(state, {
      type: 'select',
      selection: { kind: 'category', category: 'areas' },
    });
    const other = reduce(state, { type: 'select', selection: { kind: 'folder', folderId: 'f2' } });
    const all = reduce(other.nextState, { type: 'select', selection: { kind: 'all' } });

    expect(same.nextState.selectedNoteId).toBe('n1');
    expect(other.nextState.selectedNoteId).toBeNull();
    expect(all.nextState.selectedNoteId).toBeNull();
  });

  test('select_note opens a note that exists, or closes it', () => {
    const state = filled();
    const open = reduce(state, { type: 'select_note', noteId: 'n2' }).nextState;

    expect(open.selectedNoteId).toBe('n2');
    expect(reduce(open, { type: 'select_note', noteId: null }).nextState.selectedNoteId).toBeNull();
    expect(reduce(state, { type: 'select_note', noteId: 'nope' }).nextState).toBe(state);
  });
});

describe('search and sort', () => {
  test('set_search keeps the text as typed', () => {
    const { nextState } = reduce(stateWith(), { type: 'set_search', query: ' Café ' });

    expect(nextState.search).toBe(' Café ');
  });

  test('set_sort changes the sort and persists it', () => {
    const { nextState, effects } = reduce(stateWith(), { type: 'set_sort', sort: 'title' });

    expect(nextState.preferences).toEqual({ sort: 'title' });
    expect(effects).toEqual([{ type: 'persist_preferences', preferences: { sort: 'title' } }]);
  });

  test('an unknown sort, or the current one, changes nothing', () => {
    const state = stateWith();

    expect(reduce(state, { type: 'set_sort', sort: /** @type {never} */ ('size') }).nextState).toBe(
      state,
    );
    expect(reduce(state, { type: 'set_sort', sort: 'updated' }).nextState).toBe(state);
  });
});

describe('hydrate and reload_data', () => {
  test('hydrate builds the state from what was read, and cleans it', () => {
    const { nextState } = reduce(createInitialState(), {
      type: 'hydrate',
      payload: {
        folders: [folder({ id: 'f1' }), folder({ id: 'f1' }), /** @type {never} */ ({ id: 'bad' })],
        notes: [note({ id: 'n1', folderId: 'gone' }), /** @type {never} */ (null)],
        assets: [asset('a1'), { ...asset('a2'), mime: 'text/html' }],
        preferences: { sort: 'created' },
        readOnly: true,
      },
    });

    expect(nextState.folders.map((f) => f.id)).toEqual(['f1']);
    expect(nextState.notes).toHaveLength(1);
    expect(nextState.notes[0]?.folderId).toBeNull(); // its folder does not exist
    expect(nextState.assets.map((a) => a.id)).toEqual(['a1']);
    expect(nextState.preferences.sort).toBe('created');
    expect(nextState.readOnly).toBe(true);
  });

  test('reload_data replaces the data and keeps the view where it is still valid', () => {
    const state = {
      ...filled(),
      selection: /** @type {const} */ ({ kind: 'folder', folderId: 'f1' }),
      selectedNoteId: 'n1',
      search: 'text',
    };

    const kept = reduce(state, {
      type: 'reload_data',
      payload: { folders: state.folders, notes: [...state.notes, note({ id: 'n4' })], assets: [] },
    }).nextState;
    const gone = reduce(state, {
      type: 'reload_data',
      payload: { folders: [folder({ id: 'f2' })], notes: [], assets: [] },
    }).nextState;

    expect(kept.notes).toHaveLength(4);
    expect(kept.selection).toEqual({ kind: 'folder', folderId: 'f1' });
    expect(kept.selectedNoteId).toBe('n1');
    expect(kept.search).toBe('text');
    expect(gone.selection).toEqual({ kind: 'all' }); // the folder was deleted elsewhere
    expect(gone.selectedNoteId).toBeNull();
  });
});

describe('a read-only tab', () => {
  const readOnly = () => ({ ...filled(), readOnly: true });

  test.each([
    { type: 'create_folder', id: 'x', name: 'X', category: 'projects', now: at() },
    { type: 'rename_folder', id: 'f1', name: 'X' },
    { type: 'move_folder', id: 'f1', category: 'archives' },
    { type: 'delete_folder', id: 'f1' },
    { type: 'create_note', id: 'x', now: at() },
    { type: 'update_note', id: 'n1', now: at(), title: 'X' },
    { type: 'move_note', id: 'n1', folderId: 'f2' },
    { type: 'delete_note', id: 'n1' },
    { type: 'purge_orphaned_assets' },
  ])('refuses $type: same state, no effect', (command) => {
    const state = readOnly();

    const result = reduce(state, /** @type {never} */ (command));

    expect(result.nextState).toBe(state);
    expect(result.effects).toEqual([]);
    expect(isDataCommand(/** @type {never} */ (command.type))).toBe(true);
  });

  test('keeps the view commands working, and persists nothing', () => {
    const state = readOnly();

    const sorted = reduce(state, { type: 'set_sort', sort: 'title' });

    expect(reduce(state, { type: 'select_note', noteId: 'n2' }).nextState.selectedNoteId).toBe(
      'n2',
    );
    expect(reduce(state, { type: 'set_search', query: 'x' }).nextState.search).toBe('x');
    expect(sorted.nextState.preferences.sort).toBe('title');
    expect(sorted.effects).toEqual([]);
  });

  test('set_read_only switches the role of the tab, and nothing else', () => {
    const state = readOnly();

    const writer = reduce(state, { type: 'set_read_only', readOnly: false });

    expect(writer.nextState).toEqual({ ...state, readOnly: false });
    expect(reduce(writer.nextState, { type: 'set_read_only', readOnly: false }).nextState).toBe(
      writer.nextState,
    );
    expect(reduce(writer.nextState, { type: 'delete_note', id: 'n1' }).effects).toHaveLength(1);
  });
});

describe('createStore', () => {
  test('notifies the listeners with the effects, and only when the state changed', () => {
    const store = createStore();
    /** @type {string[]} */
    const seen = [];
    store.subscribe(({ command, effects }) => seen.push(`${command.type}:${effects.length}`));

    store.dispatch({ type: 'create_note', id: 'n1', now: at() });
    store.dispatch({ type: 'select_note', noteId: 'nope' }); // nothing happens
    store.dispatch({ type: 'update_note', id: 'n1', now: at(1), doc: doc('x') });

    expect(seen).toEqual(['create_note:1', 'update_note:1']);
    expect(store.getState().notes).toHaveLength(1);
  });
});
