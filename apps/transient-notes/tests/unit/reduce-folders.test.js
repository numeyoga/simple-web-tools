// Folders: create (with the category chosen), rename, move to another category, delete (its
// notes are kept, with no folder).
import { describe, expect, test } from 'vitest';
import { reduce } from '../../src/core/store.js';
import { at, folder, note, stateWith } from './support/data.js';

describe('create_folder', () => {
  test('creates a folder in the chosen category, not always in Projects', () => {
    const { nextState, effects } = reduce(stateWith(), {
      type: 'create_folder',
      id: 'f1',
      name: 'Garden',
      category: 'areas',
      now: at(1),
    });

    expect(nextState.folders).toEqual([
      { id: 'f1', name: 'Garden', category: 'areas', createdAt: at(1) },
    ]);
    expect(effects).toEqual([{ type: 'persist_folder', folder: nextState.folders[0] }]);
  });

  test('tidies the name: spaces collapsed, trimmed, cut at 80 characters', () => {
    const { nextState } = reduce(stateWith(), {
      type: 'create_folder',
      id: 'f1',
      name: `  Home   ${'x'.repeat(100)}  `,
      category: 'resources',
      now: at(),
    });

    expect(nextState.folders[0]?.name).toMatch(/^Home x+$/);
    expect(nextState.folders[0]?.name.length).toBe(80);
  });

  test.each([
    ['a blank name', { id: 'f1', name: '   ', category: 'projects' }],
    ['an unknown category', { id: 'f1', name: 'A', category: 'inbox' }],
    ['an empty id', { id: '', name: 'A', category: 'projects' }],
    ['an id already used', { id: 'f0', name: 'A', category: 'projects' }],
  ])('refuses %s: same state, no effect', (_label, input) => {
    const state = stateWith({ folders: [folder({ id: 'f0' })] });

    const result = reduce(
      state,
      /** @type {never} */ ({ type: 'create_folder', now: at(), ...input }),
    );

    expect(result.nextState).toBe(state);
    expect(result.effects).toEqual([]);
  });
});

describe('rename_folder and move_folder', () => {
  const state = stateWith({
    folders: [folder({ id: 'f1', name: 'Old', category: 'projects' })],
    notes: [note({ id: 'n1', folderId: 'f1' })],
  });

  test('renames a folder', () => {
    const { nextState, effects } = reduce(state, {
      type: 'rename_folder',
      id: 'f1',
      name: ' New ',
    });

    expect(nextState.folders[0]?.name).toBe('New');
    expect(effects).toEqual([{ type: 'persist_folder', folder: nextState.folders[0] }]);
  });

  test('a blank name, an unknown id or the same name change nothing', () => {
    for (const command of [
      { type: 'rename_folder', id: 'f1', name: '  ' },
      { type: 'rename_folder', id: 'nope', name: 'X' },
      { type: 'rename_folder', id: 'f1', name: 'Old' },
    ]) {
      expect(reduce(state, /** @type {never} */ (command)).nextState).toBe(state);
    }
  });

  test('moves a folder to another category, and its notes follow it', () => {
    const { nextState, effects } = reduce(state, {
      type: 'move_folder',
      id: 'f1',
      category: 'archives',
    });

    expect(nextState.folders[0]).toMatchObject({ id: 'f1', category: 'archives' });
    expect(nextState.notes[0]?.folderId).toBe('f1'); // notes keep their folder
    expect(effects).toHaveLength(1);
  });

  test('moving to the same or to an unknown category changes nothing', () => {
    expect(reduce(state, { type: 'move_folder', id: 'f1', category: 'projects' }).nextState).toBe(
      state,
    );
    expect(
      reduce(state, { type: 'move_folder', id: 'f1', category: /** @type {never} */ ('x') })
        .nextState,
    ).toBe(state);
  });
});

describe('delete_folder', () => {
  const state = stateWith({
    folders: [folder({ id: 'f1', category: 'areas' }), folder({ id: 'f2' })],
    notes: [
      note({ id: 'n1', folderId: 'f1', updatedAt: at(5) }),
      note({ id: 'n2', folderId: 'f2' }),
    ],
    selection: { kind: 'folder', folderId: 'f1' },
  });

  test('keeps the notes of the folder: they are left with no folder, edit date untouched', () => {
    const { nextState, effects } = reduce(state, { type: 'delete_folder', id: 'f1' });

    expect(nextState.folders.map((f) => f.id)).toEqual(['f2']);
    expect(nextState.notes.find((n) => n.id === 'n1')).toMatchObject({
      folderId: null,
      updatedAt: at(5),
    });
    expect(nextState.notes.find((n) => n.id === 'n2')?.folderId).toBe('f2');
    expect(effects.map((e) => e.type)).toEqual(['remove_folder', 'persist_note']);
  });

  test('a selection of the deleted folder falls back to its category', () => {
    const { nextState } = reduce(state, { type: 'delete_folder', id: 'f1' });

    expect(nextState.selection).toEqual({ kind: 'category', category: 'areas' });
  });

  test('an unknown folder changes nothing', () => {
    expect(reduce(state, { type: 'delete_folder', id: 'nope' }).nextState).toBe(state);
  });
});
