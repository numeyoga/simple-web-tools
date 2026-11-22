/** @import { AppCommand } from '../types.d.ts' */

// Builds the commands that need an id from the adapter's side, so that a view only says what the
// user asked for.

import { nextCategory } from '../core/colors.js';
import { newId } from './ids.js';

/**
 * A new group. Without a colour it gets the next one of Covenant's advised order.
 * @param {import('../types.d.ts').AppState} state
 * @param {string} label
 * @param {number} [category]
 * @returns {Extract<AppCommand, { type: 'create_group' }>}
 */
export function createGroupCommand(state, label, category) {
  return {
    type: 'create_group',
    id: newId(),
    label,
    category: category ?? nextCategory(state.groups),
  };
}

/**
 * A new link.
 * @param {{ name: string, url: string, groupId: string | null }} link
 * @returns {Extract<AppCommand, { type: 'create_link' }>}
 */
export function createLinkCommand({ name, url, groupId }) {
  return { type: 'create_link', id: newId(), name, url, groupId };
}
