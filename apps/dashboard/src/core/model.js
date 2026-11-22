/** @import { App, Env, EnvData, Extra, MetaField, MetaFieldType, Settings, Skipped, Tag, Template, TemplateLink, WorkspaceData, DefaultEnv, LinkScope } from '../types.d.ts' */

// The data model: how a template, an application, a tag and the settings are made, and how data
// read from storage, from a backup file or from the earlier version's export is cleaned, record
// by record. Pure: no clock, no id generation (ids are arguments), no DOM.

import { parseUrl } from './url.js';

export const MAX_NAME_LENGTH = 120;
export const MAX_LABEL_LENGTH = 80;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_PATTERN_LENGTH = 2048;
export const MAX_VALUE_LENGTH = 300;
export const MAX_KEY_LENGTH = 40;
export const MAX_OPTIONS = 50;

/** The placeholders a pattern always has; a metadata field cannot take their names. */
export const RESERVED_KEYS = Object.freeze(['env', 'slug', 'jiraKey', 'meta']);

/** The metadata field types, in the order the interface lists them. */
export const META_FIELD_TYPES = /** @type {readonly MetaFieldType[]} */ (
  Object.freeze(['text', 'mono', 'select', 'date'])
);

/** The icons the tag screen offers (Phosphor names); any other name a file brings is kept. */
export const TAG_ICONS = Object.freeze([
  'tag',
  'git-branch',
  'browser',
  'gauge',
  'list-magnifying-glass',
  'check-square',
  'kanban',
  'book-open',
  'sitemap',
  'users-three',
  'shield',
  'database',
  'cloud',
  'cube',
  'rocket-launch',
  'wrench',
  'lifebuoy',
  'flag',
  'lightning',
  'lock',
  'key',
  'package',
  'calendar',
]);

export const DEFAULT_ENVS = /** @type {readonly DefaultEnv[]} */ (
  Object.freeze(['first', 'last', 'remember'])
);

/**
 * A name, a label or a description: whitespace collapsed (kept as is when `multiline`), trimmed,
 * cut to the maximum length. Empty when the input is not a usable text.
 * @param {unknown} raw
 * @param {number} max
 * @param {boolean} [multiline]
 * @returns {string}
 */
export function cleanText(raw, max, multiline = false) {
  if (typeof raw !== 'string') return '';
  const text = multiline
    ? raw.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
    : raw.replace(/\s+/g, ' ');
  return text.trim().slice(0, max).trim();
}

/** @param {unknown} raw */
export const normalizeName = (raw) => cleanText(raw, MAX_NAME_LENGTH);
/** @param {unknown} raw */
export const normalizeLabel = (raw) => cleanText(raw, MAX_LABEL_LENGTH);
/** @param {unknown} raw */
export const normalizeDescription = (raw) => cleanText(raw, MAX_DESCRIPTION_LENGTH, true);

/**
 * Lowercase letters, digits and dashes: the form of a slug, an environment key and a tag key.
 * Accents are dropped (`Équipe` is `equipe`).
 * @param {unknown} raw
 * @returns {string} `''` when nothing usable is left
 */
export function slugify(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_KEY_LENGTH)
    .replace(/-+$/g, '');
}

/**
 * The key of a metadata field: letters, digits and underscores, as `{key}` reads them. The case
 * is kept (`controlM`). Accents are dropped.
 * @param {unknown} raw
 * @returns {string} `''` when nothing usable is left
 */
export function normalizeMetaKey(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_KEY_LENGTH);
}

/**
 * A Phosphor icon name: lowercase letters, digits and dashes. Anything else is the `tag` icon.
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeIcon(raw) {
  return typeof raw === 'string' && /^[a-z][a-z0-9-]{0,40}$/.test(raw) ? raw : 'tag';
}

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
 * Moves the item at `index` by `delta` places. The same array when it cannot move.
 * @template T
 * @param {readonly T[]} items
 * @param {number} index
 * @param {-1 | 1} delta
 * @returns {readonly T[]}
 */
export function shiftAt(items, index, delta) {
  const to = index + delta;
  if (index < 0 || index >= items.length || to < 0 || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(index, 1);
  next.splice(to, 0, /** @type {T} */ (moved));
  return next;
}

/** The settings of an empty workspace. @returns {Settings} */
export function emptySettings() {
  return { dashboardName: '', defaultAppId: null, defaultEnv: 'last', tags: [] };
}

/** @returns {WorkspaceData} */
export function emptyData() {
  return { settings: emptySettings(), templates: [], apps: [] };
}

/** An environment data record with nothing in it. @returns {EnvData} */
export function emptyEnvData() {
  return { meta: {}, overrides: {} };
}

/**
 * The tag with a key.
 * @param {readonly Tag[]} tags
 * @param {string} key
 * @returns {Tag | undefined}
 */
export function findTag(tags, key) {
  return tags.find((tag) => tag.key === key);
}

/* ------------------------------------------------------------------ */
/* Cleaning of records read from storage, a backup file or the earlier version */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** @param {unknown} value @returns {unknown[]} */
const list = (value) => (Array.isArray(value) ? value : []);

/**
 * @param {unknown} raw
 * @param {() => string} [makeId]
 * @returns {string} the id of a record, or one made for a record that has none, or `''`
 */
function cleanId(raw, makeId) {
  if (typeof raw === 'string' && raw.trim() !== '' && raw.length <= 200) return raw;
  return makeId?.() ?? '';
}

/**
 * The tags of a file: the earlier version wrote an object `{ key: { label, icon } }`, this one a
 * list `[{ key, label, icon }]`. A key must already be in the slug form (the links refer to it).
 * @param {unknown} raw
 * @returns {{ tags: Tag[], skipped: number }}
 */
export function sanitizeTags(raw) {
  /** @type {[unknown, unknown][]} */
  let entries = [];
  if (Array.isArray(raw)) {
    entries = raw.map((tag) => [isRecord(tag) ? tag.key : undefined, tag]);
  } else if (isRecord(raw)) {
    entries = Object.entries(raw);
  }
  /** @type {Tag[]} */
  const tags = [];
  const seen = new Set();
  let skipped = 0;
  for (const [key, tag] of entries) {
    if (typeof key !== 'string' || key === '' || slugify(key) !== key || seen.has(key)) {
      skipped += 1;
      continue;
    }
    const record = isRecord(tag) ? tag : {};
    seen.add(key);
    tags.push({
      key,
      label: normalizeLabel(record.label) || key,
      icon: normalizeIcon(record.icon),
    });
  }
  return { tags, skipped };
}

/**
 * @param {unknown} raw
 * @returns {Env[] | null} the environments, `null` when `raw` is not a list
 */
function sanitizeEnvs(raw) {
  if (!Array.isArray(raw)) return null;
  /** @type {Env[]} */
  const envs = [];
  const seen = new Set();
  for (const env of raw) {
    if (!isRecord(env)) continue;
    const key = slugify(env.key);
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    envs.push({ key, label: normalizeLabel(env.label) || key.toUpperCase() });
  }
  return envs;
}

/**
 * @param {unknown} raw
 * @returns {MetaField[]}
 */
function sanitizeMetaFields(raw) {
  /** @type {MetaField[]} */
  const fields = [];
  const seen = new Set();
  for (const field of list(raw)) {
    if (!isRecord(field)) continue;
    const key = normalizeMetaKey(field.key);
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    const type = /** @type {MetaFieldType} */ (
      META_FIELD_TYPES.includes(/** @type {MetaFieldType} */ (field.type)) ? field.type : 'text'
    );
    fields.push({
      key,
      label: normalizeLabel(field.label) || key,
      type,
      options: type === 'select' ? sanitizeOptions(field.options) : [],
    });
  }
  return fields;
}

/**
 * The choices of a list field: texts, trimmed, without duplicates.
 * @param {unknown} raw
 * @returns {string[]}
 */
export function sanitizeOptions(raw) {
  /** @type {string[]} */
  const options = [];
  for (const option of list(raw)) {
    const text = cleanText(typeof option === 'number' ? String(option) : option, MAX_LABEL_LENGTH);
    if (text !== '' && !options.includes(text) && options.length < MAX_OPTIONS) options.push(text);
  }
  return options;
}

/**
 * @param {unknown} raw
 * @returns {LinkScope}
 */
function cleanScope(raw) {
  return raw === 'global' ? 'global' : 'env';
}

/**
 * @param {unknown} raw
 * @param {() => string} [makeId]
 * @returns {TemplateLink[]}
 */
function sanitizeTemplateLinks(raw, makeId) {
  /** @type {TemplateLink[]} */
  const links = [];
  const seen = new Set();
  for (const link of list(raw)) {
    if (!isRecord(link) || typeof link.pattern !== 'string') continue;
    const id = cleanId(link.id, makeId);
    if (id === '' || seen.has(id)) continue;
    seen.add(id);
    const tag = typeof link.tag === 'string' ? link.tag.trim().slice(0, MAX_KEY_LENGTH) : '';
    links.push({
      id,
      name: normalizeName(link.name) || id,
      tag,
      scope: cleanScope(link.scope),
      pattern: link.pattern.trim().slice(0, MAX_PATTERN_LENGTH),
    });
  }
  return links;
}

/**
 * Clean a template. `null` when it cannot be one (not an object, no id, no list of environments).
 * @param {unknown} raw
 * @param {() => string} [makeId] makes the id of a record that has none
 * @returns {Omit<Template, 'position'> | null}
 */
export function sanitizeTemplate(raw, makeId) {
  if (!isRecord(raw)) return null;
  const id = cleanId(raw.id, makeId);
  const envs = sanitizeEnvs(raw.envs);
  if (id === '' || envs === null) return null;
  return {
    id,
    name: normalizeName(raw.name) || id,
    description: normalizeDescription(raw.description),
    envs,
    metaFields: sanitizeMetaFields(raw.metaFields),
    links: sanitizeTemplateLinks(raw.links, makeId),
  };
}

/**
 * The data of one environment of an application. The earlier version wrote
 * `{ meta: { key: value }, overrides: { linkId: url } }`; a plain `{ key: value }` is read as the
 * metadata. An override that is not an `http:` or `https:` address is dropped and counted.
 * @param {unknown} raw
 * @returns {{ env: EnvData, unsafe: number }}
 */
function sanitizeEnvData(raw) {
  if (!isRecord(raw)) return { env: emptyEnvData(), unsafe: 0 };
  const wrapped = isRecord(raw.meta) || isRecord(raw.overrides);
  const metaSource = wrapped ? raw.meta : raw;
  /** @type {Record<string, string>} */
  const meta = {};
  if (isRecord(metaSource)) {
    for (const [key, value] of Object.entries(metaSource)) {
      const clean = normalizeMetaKey(key);
      const text =
        typeof value === 'string' || typeof value === 'number'
          ? cleanText(String(value), MAX_VALUE_LENGTH)
          : '';
      if (clean !== '' && clean === key && text !== '') meta[key] = text;
    }
  }
  /** @type {Record<string, string>} */
  const overrides = {};
  let unsafe = 0;
  if (wrapped && isRecord(raw.overrides)) {
    for (const [linkId, url] of Object.entries(raw.overrides)) {
      if (typeof url !== 'string' || url.trim() === '') continue;
      const parsed = parseUrl(url);
      if (parsed.ok) overrides[linkId] = parsed.url;
      else unsafe += 1;
    }
  }
  return { env: { meta, overrides }, unsafe };
}

/**
 * @param {unknown} raw
 * @param {() => string} [makeId]
 * @returns {{ extras: Extra[], skipped: number, unsafe: number }}
 */
function sanitizeExtras(raw, makeId) {
  /** @type {Extra[]} */
  const extras = [];
  const seen = new Set();
  let skipped = 0;
  let unsafe = 0;
  for (const extra of list(raw)) {
    if (!isRecord(extra)) {
      skipped += 1;
      continue;
    }
    const parsed = parseUrl(extra.url);
    if (!parsed.ok) {
      if (parsed.reason === 'unsupported') unsafe += 1;
      else skipped += 1;
      continue;
    }
    const id = cleanId(extra.id, makeId);
    if (id === '' || seen.has(id)) {
      skipped += 1;
      continue;
    }
    seen.add(id);
    extras.push({
      id,
      name: normalizeName(extra.name) || parsed.url,
      url: parsed.url,
      tag: typeof extra.tag === 'string' ? extra.tag.trim().slice(0, MAX_KEY_LENGTH) : '',
    });
  }
  return { extras, skipped, unsafe };
}

/**
 * Clean an application. `null` when it cannot be one (not an object, no id, no template).
 * @param {unknown} raw
 * @param {() => string} [makeId]
 * @returns {{ app: Omit<App, 'position'>, parts: number, unsafe: number } | null}
 */
export function sanitizeApp(raw, makeId) {
  if (!isRecord(raw)) return null;
  const id = cleanId(raw.id, makeId);
  const templateId = typeof raw.templateId === 'string' ? raw.templateId : '';
  if (id === '' || templateId === '') return null;
  const name = normalizeName(raw.name);
  const slug = slugify(raw.slug) || slugify(name) || slugify(id);
  /** @type {Record<string, EnvData>} */
  const envs = {};
  let unsafe = 0;
  if (isRecord(raw.envs)) {
    for (const [key, value] of Object.entries(raw.envs)) {
      const { env, unsafe: dropped } = sanitizeEnvData(value);
      envs[key] = env;
      unsafe += dropped;
    }
  }
  const extras = sanitizeExtras(raw.extras, makeId);
  return {
    app: {
      id,
      name: name || slug || id,
      slug,
      templateId,
      jiraKey: cleanText(raw.jiraKey, MAX_LABEL_LENGTH),
      description: normalizeDescription(raw.description),
      envs,
      extras: extras.extras,
    },
    parts: extras.skipped,
    unsafe: unsafe + extras.unsafe,
  };
}

/**
 * @param {unknown} raw
 * @returns {DefaultEnv}
 */
function cleanDefaultEnv(raw) {
  return DEFAULT_ENVS.includes(/** @type {DefaultEnv} */ (raw))
    ? /** @type {DefaultEnv} */ (raw)
    : 'last';
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
 * Settings, templates and applications cleaned one record at a time. A record that cannot be
 * used is skipped and counted, never fatal: a template or an application that is not an object,
 * a duplicate id, an address that is not an `http:` or `https:` one. The order of the lists is
 * kept (and numbered). An application that names a template the data does not hold is kept (the
 * interface says the template is missing and where to repair it).
 * @param {{ settings?: unknown, templates?: unknown, apps?: unknown, tags?: unknown,
 *   dashboardName?: unknown, defaultAppId?: unknown, defaultEnv?: unknown }} raw the settings are
 *   read from `settings`, or from the top level (the earlier version's shape)
 * @param {{ makeId?: () => string, sorted?: boolean }} [options] `makeId` gives an id to a
 *   record that has none (a file); `sorted`: the lists carry `position` and are put in that order
 *   first (what storage holds)
 * @returns {{ data: WorkspaceData, skipped: Skipped }}
 */
export function cleanData(raw, { makeId, sorted = false } = {}) {
  const source = isRecord(raw.settings) ? raw.settings : raw;
  const sortRecords = (/** @type {unknown[]} */ records) =>
    sorted ? sortByPosition(/** @type {{ position?: unknown }[]} */ (records)) : records;
  const rawTemplates = sortRecords(list(raw.templates));
  const rawApps = sortRecords(list(raw.apps));

  const { tags, skipped: skippedTags } = sanitizeTags(source.tags);

  const cleanedTemplates = rawTemplates.map((record) => sanitizeTemplate(record, makeId));
  const templates = uniqueById(cleanedTemplates.filter((template) => template !== null));

  let parts = skippedTags;
  let unsafeUrls = 0;
  /** @type {Omit<App, 'position'>[]} */
  const cleanedApps = [];
  for (const record of rawApps) {
    const result = sanitizeApp(record, makeId);
    if (!result) continue;
    cleanedApps.push(result.app);
    parts += result.parts;
    unsafeUrls += result.unsafe;
  }
  const apps = uniqueById(cleanedApps);

  const defaultAppId =
    typeof source.defaultAppId === 'string' && apps.some((app) => app.id === source.defaultAppId)
      ? source.defaultAppId
      : null;

  return {
    data: {
      settings: {
        dashboardName: normalizeLabel(source.dashboardName),
        defaultAppId,
        defaultEnv: cleanDefaultEnv(source.defaultEnv),
        tags,
      },
      templates: renumber(templates.map((template) => ({ ...template, position: 0 }))),
      apps: renumber(apps.map((app) => ({ ...app, position: 0 }))),
    },
    skipped: {
      templates: rawTemplates.length - templates.length,
      apps: rawApps.length - apps.length,
      parts,
      unsafeUrls,
    },
  };
}
