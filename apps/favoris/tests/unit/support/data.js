// Small builders for the tests: groups, links and states, with the position the core keeps.

/** @import { AppState, Group, Link } from '../../../src/types.d.ts' */

import { createStore } from '../../../src/core/store.js';

/**
 * @param {Partial<Group> & { id: string }} fields
 * @returns {Group}
 */
export function group(fields) {
  return {
    label: fields.id.toUpperCase(),
    category: 9,
    featured: false,
    collapsed: false,
    position: 0,
    ...fields,
  };
}

/**
 * @param {Partial<Link> & { id: string }} fields
 * @returns {Link}
 */
export function link(fields) {
  return {
    name: `Link ${fields.id}`,
    url: `https://${fields.id}.example`,
    groupId: null,
    position: 0,
    ...fields,
  };
}

/**
 * A store hydrated with groups and links (numbered by their place in the lists).
 * @param {{ groups?: Group[], links?: Link[], readOnly?: boolean }} [data]
 */
export function hydrated({ groups = [], links = [], readOnly = false } = {}) {
  const store = createStore();
  store.dispatch({
    type: 'hydrate',
    payload: {
      groups: groups.map((g, position) => ({ ...g, position })),
      links: links.map((l, position) => ({ ...l, position })),
      readOnly,
    },
  });
  return store;
}

/** The ids of the links of a group, in order. @param {AppState} state @param {string | null} groupId */
export function linkIds(state, groupId) {
  return state.links.filter((l) => l.groupId === groupId).map((l) => l.id);
}

/** @param {AppState} state */
export const groupIds = (state) => state.groups.map((g) => g.id);

/** Every position equals the index, in both lists. @param {AppState} state */
export function positionsAreNumbered(state) {
  return (
    state.groups.every((g, i) => g.position === i) && state.links.every((l, i) => l.position === i)
  );
}
