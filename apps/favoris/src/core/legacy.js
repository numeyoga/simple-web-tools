/** @import { Skipped, WorkspaceData } from '../types.d.ts' */

// The first start of Favoris on a browser that ran the previous version: its data is in
// `localStorage` of the same origin, under keys that start with `favoris.` (a dot: the keys of
// this app have a hyphen, `favoris-workspaces`, so the two never meet). The adapter reads the raw
// strings and hands them to `parseLegacyStorage`, which works out the workspaces to create. The
// old keys are never changed or deleted: they stay as a backup.
//
//   favoris.spaces         [{ id, label, createdAt, synced? }]
//   favoris.currentSpace   the id of the space that was open
//   favoris.v1:<id>        { tags, links, editMode }  the data of a space
//   favoris.v1             the same, before there were spaces (one space)
//   favoris.theme          `light` or `dark`
//
// Pure: the clock and the ids are arguments.

import { readLegacyData } from './backup.js';
import { normalizeGroupLabel } from './model.js';

/** The keys of the previous version. */
export const LEGACY_KEYS = Object.freeze({
  spaces: 'favoris.spaces',
  currentSpace: 'favoris.currentSpace',
  dataPrefix: 'favoris.v1:',
  singleSpace: 'favoris.v1',
  theme: 'favoris.theme',
});

/** The id of the space that the previous version made when it had no list of spaces. */
export const LEGACY_DEFAULT_SPACE = 'default';

/**
 * @typedef {object} LegacyWorkspace
 * @property {string} id the workspace id (a slug, unique)
 * @property {string} label
 * @property {number} createdAt epoch milliseconds
 * @property {WorkspaceData} data
 * @property {Skipped} skipped what the old records left out
 * @property {boolean} unreadable the stored data of the space was not valid JSON: the workspace is empty
 */

/**
 * @typedef {object} LegacyImport
 * @property {LegacyWorkspace[]} workspaces
 * @property {string} activeId the workspace that was open
 * @property {'light' | 'dark' | null} theme
 */

/**
 * What the raw strings of the old keys hold. `null` when there is nothing to import.
 * @typedef {object} LegacyStorage
 * @property {string | null} spaces `favoris.spaces`
 * @property {string | null} currentSpace `favoris.currentSpace`
 * @property {string | null} singleSpace `favoris.v1`
 * @property {string | null} theme `favoris.theme`
 * @property {(id: string) => string | null} dataOf `favoris.v1:<id>`
 */

/** @param {string | null} raw @returns {unknown} */
function parseJson(raw) {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * A workspace id (lowercase letters, digits and hyphens, 40 at most) for an old space id, unique
 * among `taken`.
 * @param {string} oldId
 * @param {ReadonlySet<string>} taken
 * @returns {string}
 */
export function toWorkspaceId(oldId, taken) {
  const slug = oldId
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('-')
    .slice(0, 36)
    .replace(/-+$/, '');
  const base = slug || 'space';
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
  return id;
}

/**
 * The spaces of the old list: objects with a text `id`, the first one of each id.
 * @param {unknown} list
 * @returns {{ id: string, label: string, createdAt: number | null }[]}
 */
function oldSpaces(list) {
  if (!Array.isArray(list)) return [];
  /** @type {{ id: string, label: string, createdAt: number | null }[]} */
  const spaces = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const { id, label, createdAt } = /** @type {Record<string, unknown>} */ (entry);
    if (typeof id !== 'string' || id === '' || spaces.some((s) => s.id === id)) continue;
    spaces.push({
      id,
      label: normalizeGroupLabel(label) || normalizeGroupLabel(id) || id,
      createdAt: typeof createdAt === 'number' && Number.isFinite(createdAt) ? createdAt : null,
    });
  }
  return spaces;
}

/**
 * The workspaces to create from the data of the previous version.
 * @param {LegacyStorage} storage
 * @param {{ makeId: () => string, defaultLabel: string, now: number }} options `defaultLabel`
 *   names the single space of a browser that has no list; `now` stands for a missing `createdAt`
 * @returns {LegacyImport | null} `null` when the browser holds nothing of the previous version
 */
export function parseLegacyStorage(storage, { makeId, defaultLabel, now }) {
  let spaces = oldSpaces(parseJson(storage.spaces));
  /** @type {(id: string) => string | null} */
  let dataOf = storage.dataOf;
  if (spaces.length === 0) {
    // No list: the previous version made one space, `default`, from the single key it had before.
    const own = storage.dataOf(LEGACY_DEFAULT_SPACE);
    const raw = own ?? storage.singleSpace;
    if (raw === null) return null;
    spaces = [{ id: LEGACY_DEFAULT_SPACE, label: defaultLabel, createdAt: null }];
    dataOf = () => raw;
  }

  const current = storage.currentSpace;
  /** @type {Set<string>} */
  const taken = new Set();
  /** @type {Map<string, string>} */
  const idOf = new Map();
  /** @type {LegacyWorkspace[]} */
  const workspaces = spaces.map((space) => {
    const id = toWorkspaceId(space.id, taken);
    taken.add(id);
    idOf.set(space.id, id);
    const raw = dataOf(space.id);
    const parsed = parseJson(raw);
    const isObject = !!parsed && typeof parsed === 'object' && !Array.isArray(parsed);
    // A space that was never opened has no data: it is empty, as the old app showed it.
    const { data, skipped } = readLegacyData(
      isObject ? /** @type {Record<string, unknown>} */ (parsed) : {},
      makeId,
    );
    return {
      id,
      label: space.label,
      createdAt: space.createdAt ?? now,
      data,
      skipped,
      unreadable: raw !== null && !isObject,
    };
  });

  const theme = storage.theme === 'light' || storage.theme === 'dark' ? storage.theme : null;
  return {
    workspaces,
    activeId:
      (current !== null && idOf.get(current)) || /** @type {LegacyWorkspace} */ (workspaces[0]).id,
    theme,
  };
}

/**
 * The totals of what an import left out.
 * @param {LegacyImport} legacy
 * @returns {{ workspaces: number, links: number, skipped: Skipped, unreadable: number }}
 */
export function summarizeLegacyImport(legacy) {
  const skipped = { groups: 0, links: 0, unsafeUrls: 0 };
  let links = 0;
  let unreadable = 0;
  for (const workspace of legacy.workspaces) {
    links += workspace.data.links.length;
    skipped.groups += workspace.skipped.groups;
    skipped.links += workspace.skipped.links;
    skipped.unsafeUrls += workspace.skipped.unsafeUrls;
    if (workspace.unreadable) unreadable += 1;
  }
  return { workspaces: legacy.workspaces.length, links, skipped, unreadable };
}
