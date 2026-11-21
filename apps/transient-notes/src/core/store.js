/** @import { AppCommand, AppState, AssetMeta, Folder, Note, Selection, StoreEffect } from '../types.d.ts' */

// The state machine (decision 0004): `reduce(state, command)` returns the next state and the
// effects the adapter has to persist. Nothing here reads a clock, makes an id, touches the DOM
// or the storage: a command carries its ids and its timestamp.
//
// - View commands (`select`, `select_note`, `set_search`, `set_sort`, `reload_data`,
//   `set_read_only`, `hydrate`) work in every tab. A read-only tab does not persist the sort.
// - Data commands change folders, notes or assets. In a read-only tab they are refused: the
//   state is returned as it was, with no effect. `isDataCommand` tells the adapter which
//   commands to announce as refused.
// - A command that cannot apply (unknown id, blank name, nothing changed) returns the same
//   state object and no effect, so callers can compare references.

import { ALLOWED_IMAGE_MIMES, sanitizeRichTextDoc } from '@simple-web-tools/rich-text';
import {
  DEFAULT_PREFERENCES,
  EPOCH,
  cleanWorkspaceData,
  createFolder,
  createNote,
  isParaCategory,
  normalizeFolderName,
  normalizeNoteTitle,
  normalizeSort,
  referencedAssetIds,
} from './model.js';

/** @type {ReadonlySet<AppCommand['type']>} */
const VIEW_COMMANDS = new Set([
  'hydrate',
  'reload_data',
  'set_read_only',
  'select',
  'select_note',
  'set_search',
  'set_sort',
]);

/**
 * Whether a command changes the data of the workspace (and so needs the write lock).
 * @param {AppCommand['type']} type
 * @returns {boolean}
 */
export function isDataCommand(type) {
  return !VIEW_COMMANDS.has(type);
}

/** @type {Selection} */
const SELECT_ALL = Object.freeze({ kind: 'all' });

/** @returns {AppState} */
export function createInitialState() {
  return {
    schemaVersion: 1,
    readOnly: false,
    folders: [],
    notes: [],
    assets: [],
    selection: SELECT_ALL,
    selectedNoteId: null,
    search: '',
    preferences: { ...DEFAULT_PREFERENCES },
  };
}

/** @param {AppState} state */
const unchanged = (state) => ({ nextState: state, effects: /** @type {StoreEffect[]} */ ([]) });

/**
 * The oldest folder of a category: where a quick create puts its note.
 * @param {readonly Folder[]} folders
 * @param {string} category
 * @returns {Folder | undefined}
 */
function firstFolderOf(folders, category) {
  /** @type {Folder | undefined} */
  let first;
  for (const folder of folders) {
    if (folder.category !== category) continue;
    if (
      !first ||
      folder.createdAt < first.createdAt ||
      (folder.createdAt === first.createdAt && folder.id < first.id)
    ) {
      first = folder;
    }
  }
  return first;
}

/**
 * Whether a note belongs to what a selection shows.
 * @param {Note} note
 * @param {Selection} selection
 * @param {readonly Folder[]} folders
 * @returns {boolean}
 */
export function noteInSelection(note, selection, folders) {
  if (selection.kind === 'all') return true;
  if (selection.kind === 'folder') return note.folderId === selection.folderId;
  const folder = folders.find((f) => f.id === note.folderId);
  return folder?.category === selection.category;
}

/**
 * Whether a selection still points at something that exists.
 * @param {Selection} selection
 * @param {readonly Folder[]} folders
 * @returns {boolean}
 */
function isValidSelection(selection, folders) {
  if (selection.kind === 'all') return true;
  if (selection.kind === 'category') return isParaCategory(selection.category);
  return folders.some((f) => f.id === selection.folderId);
}

/**
 * The state after folders, notes and assets were (re)read: view state is kept where it is still
 * valid.
 * @param {AppState} state
 * @param {{ folders: readonly Folder[], notes: readonly Note[], assets: readonly AssetMeta[] }} data
 * @returns {AppState}
 */
function withData(state, data) {
  const selection = isValidSelection(state.selection, data.folders) ? state.selection : SELECT_ALL;
  const selectedNoteId = data.notes.some((n) => n.id === state.selectedNoteId)
    ? state.selectedNoteId
    : null;
  return { ...state, ...data, selection, selectedNoteId };
}

/**
 * @param {unknown} a
 * @param {unknown} b
 */
const sameJson = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * The assets only these notes reference: nobody else keeps them alive.
 * @param {readonly Note[]} removed the notes that go away
 * @param {readonly Note[]} remaining the notes that stay
 * @param {readonly AssetMeta[]} assets
 * @returns {string[]}
 */
function assetsOnlyUsedBy(removed, remaining, assets) {
  const stillUsed = referencedAssetIds(remaining);
  const existing = new Set(assets.map((a) => a.id));
  return [...referencedAssetIds(removed)].filter((id) => existing.has(id) && !stillUsed.has(id));
}

/**
 * Pure state reducer: the next state and the effects to persist.
 * @param {AppState} state
 * @param {AppCommand} command
 * @returns {{ nextState: AppState, effects: StoreEffect[] }}
 */
export function reduce(state, command) {
  if (state.readOnly && isDataCommand(command.type)) return unchanged(state);

  switch (command.type) {
    case 'hydrate': {
      const { readOnly, preferences } = command.payload;
      const data = cleanWorkspaceData(command.payload, EPOCH);
      return {
        nextState: {
          ...createInitialState(),
          ...data,
          readOnly: Boolean(readOnly),
          preferences: { sort: normalizeSort(preferences?.sort) },
        },
        effects: [],
      };
    }

    case 'reload_data': {
      const data = cleanWorkspaceData(command.payload, EPOCH);
      return { nextState: withData(state, data), effects: [] };
    }

    case 'set_read_only': {
      if (state.readOnly === command.readOnly) return unchanged(state);
      return { nextState: { ...state, readOnly: command.readOnly }, effects: [] };
    }

    case 'select': {
      const { selection } = command;
      if (!isValidSelection(selection, state.folders)) return unchanged(state);
      const selectedNote = state.notes.find((n) => n.id === state.selectedNoteId);
      const keepNote = selectedNote && noteInSelection(selectedNote, selection, state.folders);
      return {
        nextState: { ...state, selection, selectedNoteId: keepNote ? selectedNote.id : null },
        effects: [],
      };
    }

    case 'select_note': {
      const { noteId } = command;
      if (noteId !== null && !state.notes.some((n) => n.id === noteId)) return unchanged(state);
      if (noteId === state.selectedNoteId) return unchanged(state);
      return { nextState: { ...state, selectedNoteId: noteId }, effects: [] };
    }

    case 'set_search': {
      if (command.query === state.search) return unchanged(state);
      return { nextState: { ...state, search: command.query }, effects: [] };
    }

    case 'set_sort': {
      const sort = normalizeSort(command.sort);
      if (sort === state.preferences.sort) return unchanged(state);
      const preferences = { ...state.preferences, sort };
      return {
        nextState: { ...state, preferences },
        effects: state.readOnly ? [] : [{ type: 'persist_preferences', preferences }],
      };
    }

    case 'create_folder': {
      const name = normalizeFolderName(command.name);
      if (name === '' || !isParaCategory(command.category) || command.id === '') {
        return unchanged(state);
      }
      if (state.folders.some((f) => f.id === command.id)) return unchanged(state);
      const folder = createFolder({
        id: command.id,
        name,
        category: command.category,
        now: command.now,
      });
      return {
        nextState: { ...state, folders: [...state.folders, folder] },
        effects: [{ type: 'persist_folder', folder }],
      };
    }

    case 'rename_folder': {
      const name = normalizeFolderName(command.name);
      const folder = state.folders.find((f) => f.id === command.id);
      if (!folder || name === '' || name === folder.name) return unchanged(state);
      const renamed = { ...folder, name };
      return {
        nextState: {
          ...state,
          folders: state.folders.map((f) => (f === folder ? renamed : f)),
        },
        effects: [{ type: 'persist_folder', folder: renamed }],
      };
    }

    case 'move_folder': {
      const folder = state.folders.find((f) => f.id === command.id);
      if (!folder || !isParaCategory(command.category) || folder.category === command.category) {
        return unchanged(state);
      }
      const moved = { ...folder, category: command.category };
      return {
        nextState: { ...state, folders: state.folders.map((f) => (f === folder ? moved : f)) },
        effects: [{ type: 'persist_folder', folder: moved }],
      };
    }

    case 'delete_folder': {
      // The notes of the folder are kept: they are left with no folder (shown in "All notes").
      // Deleting notes with their folder would lose data on one click; a note is deleted on its own.
      const folder = state.folders.find((f) => f.id === command.id);
      if (!folder) return unchanged(state);
      /** @type {StoreEffect[]} */
      const effects = [{ type: 'remove_folder', id: folder.id }];
      const notes = state.notes.map((note) => {
        if (note.folderId !== folder.id) return note;
        const orphan = { ...note, folderId: null };
        effects.push({ type: 'persist_note', note: orphan });
        return orphan;
      });
      const selection =
        state.selection.kind === 'folder' && state.selection.folderId === folder.id
          ? /** @type {Selection} */ ({ kind: 'category', category: folder.category })
          : state.selection;
      return {
        nextState: {
          ...state,
          folders: state.folders.filter((f) => f !== folder),
          notes,
          selection,
        },
        effects,
      };
    }

    case 'create_note': {
      if (command.id === '' || state.notes.some((n) => n.id === command.id)) {
        return unchanged(state);
      }
      /** @type {StoreEffect[]} */
      const effects = [];
      let folders = state.folders;
      /** @type {string | null} */
      let folderId = null;
      let selection = state.selection;

      // The category a new note goes to: the one asked for (quick create), else the one the
      // selection shows. A folder selection names the folder itself.
      const category =
        command.category ?? (state.selection.kind === 'category' ? state.selection.category : null);
      if (command.category !== undefined && !isParaCategory(command.category)) {
        return unchanged(state);
      }
      if (command.category === undefined && state.selection.kind === 'folder') {
        folderId = state.selection.folderId;
      } else if (category !== null) {
        let target = firstFolderOf(state.folders, category);
        if (!target) {
          const name = normalizeFolderName(command.defaultFolder?.name);
          if (!command.defaultFolder || command.defaultFolder.id === '' || name === '') {
            return unchanged(state); // a category with no folder needs a default folder to create
          }
          if (state.folders.some((f) => f.id === command.defaultFolder?.id))
            return unchanged(state);
          target = createFolder({
            id: command.defaultFolder.id,
            name,
            category,
            now: command.now,
          });
          folders = [...state.folders, target];
          effects.push({ type: 'persist_folder', folder: target });
        }
        folderId = target.id;
        // A quick create shows the folder that holds the new note.
        if (command.category !== undefined) selection = { kind: 'folder', folderId: target.id };
      }

      const note = createNote({ id: command.id, now: command.now, folderId });
      effects.push({ type: 'persist_note', note });
      return {
        nextState: {
          ...state,
          folders,
          notes: [...state.notes, note],
          selection,
          selectedNoteId: note.id,
          search: '', // a filter could hide the note that was just created
        },
        effects,
      };
    }

    case 'update_note': {
      const note = state.notes.find((n) => n.id === command.id);
      if (!note) return unchanged(state);
      const title = command.title === undefined ? note.title : normalizeNoteTitle(command.title);
      const doc = command.doc === undefined ? note.doc : sanitizeRichTextDoc(command.doc);
      if (title === note.title && sameJson(doc, note.doc)) return unchanged(state);
      const updated = { ...note, title, doc, updatedAt: command.now };
      return {
        nextState: { ...state, notes: state.notes.map((n) => (n === note ? updated : n)) },
        effects: [{ type: 'persist_note', note: updated }],
      };
    }

    case 'move_note': {
      // Moving a note files it; it does not count as an edit, so `updatedAt` stays.
      const note = state.notes.find((n) => n.id === command.id);
      if (!note || note.folderId === command.folderId) return unchanged(state);
      if (command.folderId !== null && !state.folders.some((f) => f.id === command.folderId)) {
        return unchanged(state);
      }
      const moved = { ...note, folderId: command.folderId };
      return {
        nextState: { ...state, notes: state.notes.map((n) => (n === note ? moved : n)) },
        effects: [{ type: 'persist_note', note: moved }],
      };
    }

    case 'delete_note': {
      const note = state.notes.find((n) => n.id === command.id);
      if (!note) return unchanged(state);
      const notes = state.notes.filter((n) => n !== note);
      const goneAssets = assetsOnlyUsedBy([note], notes, state.assets);
      return {
        nextState: {
          ...state,
          notes,
          assets: state.assets.filter((a) => !goneAssets.includes(a.id)),
          selectedNoteId: state.selectedNoteId === note.id ? null : state.selectedNoteId,
        },
        effects: [
          { type: 'remove_note', id: note.id },
          ...goneAssets.map((id) => /** @type {StoreEffect} */ ({ type: 'remove_asset', id })),
        ],
      };
    }

    case 'add_asset': {
      const { asset, blob } = command;
      if (
        asset.id === '' ||
        !ALLOWED_IMAGE_MIMES.has(/** @type {never} */ (asset.mime)) ||
        !(asset.size > 0) ||
        state.assets.some((a) => a.id === asset.id)
      ) {
        return unchanged(state);
      }
      return {
        nextState: { ...state, assets: [...state.assets, asset] },
        effects: [{ type: 'persist_asset', asset, blob }],
      };
    }

    case 'purge_orphaned_assets': {
      // Editing a note never removes an image on its own: the editor can still undo it. The
      // adapter calls this when it is safe (a note was closed, the app starts).
      const used = referencedAssetIds(state.notes);
      const gone = state.assets.filter((a) => !used.has(a.id));
      if (gone.length === 0) return unchanged(state);
      return {
        nextState: { ...state, assets: state.assets.filter((a) => used.has(a.id)) },
        effects: gone.map((a) => /** @type {StoreEffect} */ ({ type: 'remove_asset', id: a.id })),
      };
    }

    default:
      return unchanged(state);
  }
}

/**
 * A small observable around `reduce`.
 * @param {AppState} [initialState]
 */
export function createStore(initialState = createInitialState()) {
  let state = initialState;
  /** @type {Set<(info: { state: AppState, prevState: AppState, command: AppCommand, effects: StoreEffect[] }) => void>} */
  const listeners = new Set();
  return {
    getState: () => state,
    /**
     * @param {AppCommand} command
     * @returns {{ state: AppState, effects: StoreEffect[] }}
     */
    dispatch(command) {
      const prevState = state;
      const { nextState, effects } = reduce(prevState, command);
      state = nextState;
      if (nextState !== prevState) {
        for (const listener of listeners) listener({ state, prevState, command, effects });
      }
      return { state, effects };
    },
    /**
     * @param {(info: { state: AppState, prevState: AppState, command: AppCommand, effects: StoreEffect[] }) => void} listener
     * @returns {() => void}
     */
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
