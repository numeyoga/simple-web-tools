/** @import { AppCommand, AppState, Group, Link, StoreEffect } from '../types.d.ts' */

// The state machine (decision 0004): `reduce(state, command)` returns the next state and the
// effects the adapter has to persist. Nothing here reads a clock, makes an id, touches the DOM
// or the storage: a command carries its ids.
//
// - View commands (`hydrate`, `reload_data`, `set_read_only`, `set_search`, `set_edit_mode`) work
//   in every tab.
// - Data commands change groups or links. In a read-only tab they are refused: the state is
//   returned as it was, with no effect. `isDataCommand` tells the adapter which commands to
//   announce as refused.
// - A command that cannot apply (unknown id, blank name, unsafe address, nothing changed) returns
//   the same state object and no effect, so callers can compare references.
// - The effects of a data command are the difference between the two states, record by record
//   (`diffEffects`): a reorder persists the records whose `position` changed and nothing else.

import { isCategory } from './colors.js';
import {
  cleanData,
  endOfGroupIndex,
  linksOfGroup,
  moveItem,
  normalizeGroupLabel,
  normalizeLinkName,
  orderedGroups,
  renumber,
} from './model.js';
import { normalizeUrl } from './url.js';

/** @type {ReadonlySet<AppCommand['type']>} */
const VIEW_COMMANDS = new Set([
  'hydrate',
  'reload_data',
  'set_read_only',
  'set_search',
  'set_edit_mode',
]);

/**
 * Whether a command changes the data of the workspace (and so needs the write lock).
 * @param {AppCommand['type']} type
 * @returns {boolean}
 */
export function isDataCommand(type) {
  return !VIEW_COMMANDS.has(type);
}

/** @returns {AppState} */
export function createInitialState() {
  return {
    schemaVersion: 1,
    readOnly: false,
    groups: [],
    links: [],
    search: '',
    editMode: false,
  };
}

/** @param {AppState} state */
const unchanged = (state) => ({ nextState: state, effects: /** @type {StoreEffect[]} */ ([]) });

/**
 * The records that differ between two states: removals first, then the writes, groups before
 * links.
 * @param {AppState} prev
 * @param {AppState} next
 * @returns {StoreEffect[]}
 */
export function diffEffects(prev, next) {
  /** @type {StoreEffect[]} */
  const effects = [];
  const groupIds = new Set(next.groups.map((g) => g.id));
  const linkIds = new Set(next.links.map((l) => l.id));
  for (const group of prev.groups) {
    if (!groupIds.has(group.id)) effects.push({ type: 'remove_group', id: group.id });
  }
  for (const link of prev.links) {
    if (!linkIds.has(link.id)) effects.push({ type: 'remove_link', id: link.id });
  }
  const before = new Map(prev.groups.map((g) => [g.id, g]));
  for (const group of next.groups) {
    if (before.get(group.id) !== group) effects.push({ type: 'persist_group', group });
  }
  const beforeLinks = new Map(prev.links.map((l) => [l.id, l]));
  for (const link of next.links) {
    if (beforeLinks.get(link.id) !== link) effects.push({ type: 'persist_link', link });
  }
  return effects;
}

/**
 * The next state of a data command, before its effects are worked out.
 * @param {AppState} state
 * @param {AppCommand} command
 * @returns {AppState}
 */
function applyData(state, command) {
  switch (command.type) {
    case 'create_group': {
      const label = normalizeGroupLabel(command.label);
      if (command.id === '' || label === '' || state.groups.some((g) => g.id === command.id)) {
        return state;
      }
      /** @type {Group} */
      const group = {
        id: command.id,
        label,
        category: isCategory(command.category) ? command.category : 16,
        featured: command.featured === true,
        collapsed: false,
        position: state.groups.length,
      };
      return { ...state, groups: [...state.groups, group] };
    }

    case 'update_group': {
      const group = state.groups.find((g) => g.id === command.id);
      if (!group) return state;
      const label = command.label === undefined ? group.label : normalizeGroupLabel(command.label);
      if (label === '') return state;
      const next = {
        ...group,
        label,
        category:
          command.category !== undefined && isCategory(command.category)
            ? command.category
            : group.category,
        featured: command.featured ?? group.featured,
        collapsed: command.collapsed ?? group.collapsed,
      };
      const same =
        next.label === group.label &&
        next.category === group.category &&
        next.featured === group.featured &&
        next.collapsed === group.collapsed;
      if (same) return state;
      return { ...state, groups: state.groups.map((g) => (g === group ? next : g)) };
    }

    case 'delete_group': {
      if (!state.groups.some((g) => g.id === command.id)) return state;
      return {
        ...state,
        groups: renumber(state.groups.filter((g) => g.id !== command.id)),
        // The links of a deleted group are kept, with no group.
        links: state.links.map((l) => (l.groupId === command.id ? { ...l, groupId: null } : l)),
      };
    }

    case 'move_group': {
      // The order that counts is the one that is shown (the featured groups first): it becomes
      // the stored order.
      const shown = orderedGroups(state.groups);
      const moved = moveItem(shown, command.id, command.targetId, command.place);
      if (moved.every((g, i) => g === shown[i])) return state;
      return { ...state, groups: renumber(moved) };
    }

    case 'shift_group': {
      const shown = orderedGroups(state.groups);
      const index = shown.findIndex((g) => g.id === command.id);
      const group = shown[index];
      const neighbour = shown[index + command.delta];
      if (!group || !neighbour || neighbour.featured !== group.featured) return state;
      return applyData(state, {
        type: 'move_group',
        id: group.id,
        targetId: neighbour.id,
        place: command.delta < 0 ? 'before' : 'after',
      });
    }

    case 'create_link': {
      const url = normalizeUrl(command.url);
      if (
        command.id === '' ||
        url === null ||
        state.links.some((l) => l.id === command.id) ||
        (command.groupId !== null && !state.groups.some((g) => g.id === command.groupId))
      ) {
        return state;
      }
      /** @type {Link} */
      const link = {
        id: command.id,
        name: normalizeLinkName(command.name) || url,
        url,
        groupId: command.groupId,
        position: 0,
      };
      const links = [...state.links];
      links.splice(endOfGroupIndex(links, command.groupId), 0, link);
      return { ...state, links: renumber(links) };
    }

    case 'update_link': {
      const link = state.links.find((l) => l.id === command.id);
      if (!link) return state;
      const url = command.url === undefined ? link.url : normalizeUrl(command.url);
      if (url === null) return state;
      const name = command.name === undefined ? link.name : normalizeLinkName(command.name) || url;
      const groupId = command.groupId === undefined ? link.groupId : command.groupId;
      if (groupId !== null && !state.groups.some((g) => g.id === groupId)) return state;
      if (name === link.name && url === link.url && groupId === link.groupId) return state;
      if (groupId !== link.groupId) {
        // A link that changes group goes to the end of the new one.
        return applyData(
          { ...state, links: state.links.map((l) => (l === link ? { ...link, name, url } : l)) },
          { type: 'move_link', id: link.id, groupId },
        );
      }
      return { ...state, links: state.links.map((l) => (l === link ? { ...link, name, url } : l)) };
    }

    case 'delete_link': {
      if (!state.links.some((l) => l.id === command.id)) return state;
      return { ...state, links: renumber(state.links.filter((l) => l.id !== command.id)) };
    }

    case 'move_link': {
      const link = state.links.find((l) => l.id === command.id);
      if (!link) return state;
      const rest = state.links.filter((l) => l !== link);
      /** @type {string | null} */
      let groupId = command.groupId;
      let index;
      if (command.targetId !== undefined) {
        const target = rest.find((l) => l.id === command.targetId);
        if (!target) return state;
        groupId = target.groupId;
        index = rest.indexOf(target) + (command.place === 'after' ? 1 : 0);
      } else {
        if (groupId !== null && !state.groups.some((g) => g.id === groupId)) return state;
        // Already the last of its group: nothing moves (the order of the other groups' links
        // in the list is not part of what the person asked for).
        if (groupId === link.groupId && linksOfGroup(state.links, groupId).at(-1) === link) {
          return state;
        }
        index = endOfGroupIndex(rest, groupId);
      }
      const links = [...rest];
      links.splice(index, 0, groupId === link.groupId ? link : { ...link, groupId });
      const next = renumber(links);
      if (next.every((l, i) => l === state.links[i])) return state;
      return { ...state, links: next };
    }

    case 'shift_link': {
      const link = state.links.find((l) => l.id === command.id);
      if (!link) return state;
      const siblings = linksOfGroup(state.links, link.groupId);
      const neighbour = siblings[siblings.indexOf(link) + command.delta];
      if (!neighbour) return state;
      return applyData(state, {
        type: 'move_link',
        id: link.id,
        groupId: link.groupId,
        targetId: neighbour.id,
        place: command.delta < 0 ? 'before' : 'after',
      });
    }

    default:
      return state;
  }
}

/**
 * @param {AppState} state
 * @param {AppCommand} command
 * @returns {{ nextState: AppState, effects: StoreEffect[] }}
 */
export function reduce(state, command) {
  switch (command.type) {
    case 'hydrate': {
      const { readOnly = false, ...data } = command.payload;
      const { data: clean } = cleanData(data, { sorted: true });
      return { nextState: { ...state, ...clean, readOnly }, effects: [] };
    }

    case 'reload_data': {
      const { data: clean } = cleanData(command.payload, { sorted: true });
      return { nextState: { ...state, ...clean }, effects: [] };
    }

    case 'set_read_only':
      return state.readOnly === command.readOnly
        ? unchanged(state)
        : { nextState: { ...state, readOnly: command.readOnly }, effects: [] };

    case 'set_search':
      return state.search === command.query
        ? unchanged(state)
        : { nextState: { ...state, search: command.query }, effects: [] };

    case 'set_edit_mode':
      return state.editMode === command.editMode
        ? unchanged(state)
        : { nextState: { ...state, editMode: command.editMode }, effects: [] };

    default: {
      if (state.readOnly) return unchanged(state);
      const nextState = applyData(state, command);
      if (nextState === state) return unchanged(state);
      return { nextState, effects: diffEffects(state, nextState) };
    }
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
