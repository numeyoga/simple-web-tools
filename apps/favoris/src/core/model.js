/** @import { Group, Link, Place, Skipped, WorkspaceData } from '../types.d.ts' */

// The data model: how a group and a link are made, and how data read from storage, from a backup
// file or from the old app is cleaned, record by record. Pure: no clock, no id generation (ids
// are arguments), no DOM.

import { DEFAULT_CATEGORY, categoryFromHex, isCategory } from './colors.js';
import { parseUrl } from './url.js';

export const MAX_GROUP_LABEL_LENGTH = 80;
export const MAX_LINK_NAME_LENGTH = 200;

/**
 * A group label or a link name: whitespace collapsed, trimmed, cut to the maximum length. Empty
 * when the input is not a usable text.
 * @param {unknown} raw
 * @param {number} max
 * @returns {string}
 */
function cleanText(raw, max) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\s+/g, ' ').trim().slice(0, max).trim();
}

/** @param {unknown} raw */
export const normalizeGroupLabel = (raw) => cleanText(raw, MAX_GROUP_LABEL_LENGTH);

/** @param {unknown} raw */
export const normalizeLinkName = (raw) => cleanText(raw, MAX_LINK_NAME_LENGTH);

/**
 * Items numbered by their place in the list. An item that already has its number is kept as it
 * is (same object), so that a diff by reference finds what really changed.
 * @template {{ position: number }} T
 * @param {readonly T[]} items
 * @returns {T[]}
 */
export function renumber(items) {
  return items.map((item, index) =>
    item.position === index ? item : { ...item, position: index },
  );
}

/**
 * The items by their stored position (the order is the one of the lists).
 * @template {{ position?: unknown }} T
 * @param {readonly T[]} items
 * @returns {T[]}
 */
export function sortByPosition(items) {
  const rank = (/** @type {T} */ item) =>
    typeof item.position === 'number' && Number.isFinite(item.position)
      ? item.position
      : Number.MAX_SAFE_INTEGER;
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index)
    .map(({ item }) => item);
}

/**
 * The groups as they are shown: the featured ones first, each class in its own order.
 * @param {readonly Group[]} groups
 * @returns {Group[]}
 */
export function orderedGroups(groups) {
  return [...groups.filter((g) => g.featured), ...groups.filter((g) => !g.featured)];
}

/**
 * The links of a group (`null`: the links with no group), in order.
 * @param {readonly Link[]} links
 * @param {string | null} groupId
 * @returns {Link[]}
 */
export function linksOfGroup(links, groupId) {
  return links.filter((link) => link.groupId === groupId);
}

/**
 * Moves the item `id` next to `targetId` in a list.
 * @template {{ id: string }} T
 * @param {readonly T[]} items
 * @param {string} id
 * @param {string} targetId
 * @param {Place} place
 * @returns {T[]} the same order when either id is unknown or they are the same
 */
export function moveItem(items, id, targetId, place) {
  if (id === targetId) return [...items];
  const from = items.findIndex((item) => item.id === id);
  if (from < 0 || !items.some((item) => item.id === targetId)) return [...items];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  let to = next.findIndex((item) => item.id === targetId);
  if (place === 'after') to += 1;
  next.splice(to, 0, /** @type {T} */ (moved));
  return next;
}

/**
 * Where a link goes when it is put at the end of a group: after the last link of the group, or
 * at the end of the list when the group has none yet.
 * @param {readonly Link[]} links without the link being moved
 * @param {string | null} groupId
 * @returns {number} the index to insert at
 */
export function endOfGroupIndex(links, groupId) {
  let last = -1;
  links.forEach((link, index) => {
    if (link.groupId === groupId) last = index;
  });
  return last < 0 ? links.length : last + 1;
}

/* ------------------------------------------------------------------ */
/* Cleaning of records read from storage, a backup file or the old app */

/**
 * Clean a group. `null` when it cannot be one. The colour is the category number, or else the
 * hex `color` of the old app.
 * @param {unknown} raw
 * @param {() => string} [makeId] makes the id of a record that has none
 * @returns {Omit<Group, 'position'> | null}
 */
export function sanitizeGroup(raw, makeId) {
  if (!raw || typeof raw !== 'object') return null;
  const { id, label, category, color, featured, collapsed } =
    /** @type {Record<string, unknown>} */ (raw);
  const cleanId = typeof id === 'string' && id !== '' ? id : (makeId?.() ?? '');
  if (cleanId === '') return null;
  const cleanLabel = normalizeGroupLabel(label) || normalizeGroupLabel(cleanId);
  if (cleanLabel === '') return null;
  return {
    id: cleanId,
    label: cleanLabel,
    category: isCategory(category)
      ? category
      : color === undefined
        ? DEFAULT_CATEGORY
        : categoryFromHex(color),
    featured: featured === true,
    collapsed: collapsed === true,
  };
}

/**
 * Clean a link. `reason` says why a record cannot be one: `unsafe` for an address that is not an
 * `http:` or `https:` one, `invalid` for the rest.
 * @param {unknown} raw
 * @param {() => string} [makeId]
 * @returns {{ link: Omit<Link, 'position'> } | { reason: 'unsafe' | 'invalid' }}
 */
export function sanitizeLink(raw, makeId) {
  if (!raw || typeof raw !== 'object') return { reason: 'invalid' };
  const { id, name, url, groupId } = /** @type {Record<string, unknown>} */ (raw);
  const cleanId = typeof id === 'string' && id !== '' ? id : (makeId?.() ?? '');
  if (cleanId === '') return { reason: 'invalid' };
  const parsed = parseUrl(url);
  if (!parsed.ok) return { reason: parsed.reason === 'unsupported' ? 'unsafe' : 'invalid' };
  return {
    link: {
      id: cleanId,
      name: normalizeLinkName(name) || parsed.url,
      url: parsed.url,
      groupId: typeof groupId === 'string' && groupId !== '' ? groupId : null,
    },
  };
}

/**
 * Keep the first record of each id.
 * @template {{ id: string }} T
 * @param {readonly T[]} items
 * @returns {T[]}
 */
function uniqueById(items) {
  /** @type {Set<string>} */
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/**
 * Groups and links cleaned one record at a time. A record that cannot be used is skipped and
 * counted, never fatal: a group or link that is not an object, a duplicate id, a link whose
 * address is not an `http:` or `https:` one. A link whose group does not exist is left with no
 * group. The order of the lists is kept (and numbered).
 * @param {{ groups?: unknown, links?: unknown }} raw
 * @param {{ makeId?: () => string, sorted?: boolean }} [options] `makeId` gives an id to a
 *   record that has none (a file); `sorted`: the lists carry `position` and are put in that
 *   order first (what storage holds)
 * @returns {{ data: WorkspaceData, skipped: Skipped }}
 */
export function cleanData(raw, { makeId, sorted = false } = {}) {
  const list = (/** @type {unknown} */ value) => (Array.isArray(value) ? value : []);
  const rawGroups = sorted ? sortByPosition(list(raw.groups)) : list(raw.groups);
  const rawLinks = sorted ? sortByPosition(list(raw.links)) : list(raw.links);

  const cleanedGroups = rawGroups.map((record) => sanitizeGroup(record, makeId));
  const groups = uniqueById(cleanedGroups.filter((g) => g !== null));
  const groupIds = new Set(groups.map((g) => g.id));

  let unsafeUrls = 0;
  /** @type {Omit<Link, 'position'>[]} */
  const links = [];
  for (const record of rawLinks) {
    const result = sanitizeLink(record, makeId);
    if ('link' in result) links.push(result.link);
    else if (result.reason === 'unsafe') unsafeUrls += 1;
  }
  const uniqueLinks = uniqueById(links).map((link) =>
    link.groupId !== null && !groupIds.has(link.groupId) ? { ...link, groupId: null } : link,
  );

  return {
    data: {
      groups: renumber(groups.map((g) => ({ ...g, position: 0 }))),
      links: renumber(uniqueLinks.map((l) => ({ ...l, position: 0 }))),
    },
    skipped: {
      groups: rawGroups.length - groups.length,
      links: rawLinks.length - uniqueLinks.length - unsafeUrls,
      unsafeUrls,
    },
  };
}
