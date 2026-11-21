/** @import { AppCommand, AppState, ParaCategory } from '../types.d.ts' */

// Builds the commands that need an id, a timestamp or a translated name from the adapter's
// side, so that a view only says what the user asked for.

import { defaultFolderName } from './labels.js';
import { newId, nowIso } from './ids.js';

/**
 * A new note. Without `category` it goes where the selection points (the folder selected, the
 * first folder of the category selected, or no folder under "All notes"); with one it is a quick
 * create in that category. A category with no folder gets a default one, named in the language
 * of the page.
 * @param {AppState} state
 * @param {ParaCategory} [category]
 * @returns {AppCommand}
 */
export function createNoteCommand(state, category) {
  const target =
    category ?? (state.selection.kind === 'category' ? state.selection.category : null);
  return {
    type: 'create_note',
    id: newId(),
    now: nowIso(),
    ...(category ? { category } : {}),
    ...(target ? { defaultFolder: { id: newId(), name: defaultFolderName(target) } } : {}),
  };
}

/**
 * A new folder in a category.
 * @param {string} name
 * @param {ParaCategory} category
 * @returns {AppCommand}
 */
export function createFolderCommand(name, category) {
  return { type: 'create_folder', id: newId(), now: nowIso(), name, category };
}

/**
 * A change of the title or of the content of a note.
 * @param {string} id
 * @param {{ title?: string, doc?: import('../types.js').RichTextDoc }} changes
 * @returns {AppCommand}
 */
export function updateNoteCommand(id, changes) {
  return { type: 'update_note', id, now: nowIso(), ...changes };
}
