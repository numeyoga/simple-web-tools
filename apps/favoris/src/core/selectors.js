/** @import { AppState, Group, Link } from '../types.d.ts' */

// What the views read from the state. Pure.

import { linksOfGroup, orderedGroups } from './model.js';
import { filterLinks, tokenizeSearchQuery } from './search.js';

/**
 * @typedef {object} Section a card of the board
 * @property {Group | null} group `null` is the card of the links that have no group
 * @property {readonly Link[]} links the links shown in it (the ones that match the search)
 */

/**
 * The cards of the board, in the order they are shown: the featured groups first, then the other
 * groups, then the links with no group. While searching, only the cards that hold a match;
 * otherwise every group (an empty group shows an invitation to fill it), and the card of the
 * links with no group when there is one.
 * @param {AppState} state
 * @returns {{ sections: Section[], matching: number, searching: boolean }}
 */
export function selectBoard(state) {
  const searching = tokenizeSearchQuery(state.search).length > 0;
  const matches = filterLinks(state.links, state.groups, state.search);
  const matching = new Set(matches.map((link) => link.id));
  /** @type {Section[]} */
  const sections = [];
  for (const group of orderedGroups(state.groups)) {
    const links = linksOfGroup(state.links, group.id).filter((link) => matching.has(link.id));
    if (!searching || links.length > 0) sections.push({ group, links });
  }
  const loose = linksOfGroup(state.links, null).filter((link) => matching.has(link.id));
  if (loose.length > 0) sections.push({ group: null, links: loose });
  return { sections, matching: matches.length, searching };
}

/**
 * Whether a group can move one place up (`-1`) or down (`1`) among the groups as they are shown.
 * A featured group stays among the featured ones, so it cannot pass a group of the other class.
 * @param {AppState} state
 * @param {string} id
 * @param {-1 | 1} delta
 * @returns {boolean}
 */
export function canShiftGroup(state, id, delta) {
  const shown = orderedGroups(state.groups);
  const index = shown.findIndex((group) => group.id === id);
  const neighbour = shown[index + delta];
  const group = shown[index];
  return !!group && !!neighbour && neighbour.featured === group.featured;
}

/**
 * Whether a link can move one place up (`-1`) or down (`1`) inside its group.
 * @param {AppState} state
 * @param {string} id
 * @param {-1 | 1} delta
 * @returns {boolean}
 */
export function canShiftLink(state, id, delta) {
  const link = state.links.find((l) => l.id === id);
  if (!link) return false;
  const siblings = linksOfGroup(state.links, link.groupId);
  const index = siblings.findIndex((l) => l.id === id);
  return index + delta >= 0 && index + delta < siblings.length;
}

/**
 * How many links each group holds, `null` standing for the links with no group.
 * @param {AppState} state
 * @returns {Map<string | null, number>}
 */
export function countByGroup(state) {
  /** @type {Map<string | null, number>} */
  const counts = new Map();
  for (const link of state.links) counts.set(link.groupId, (counts.get(link.groupId) ?? 0) + 1);
  return counts;
}
