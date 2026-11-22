/** @import { App, AppState, DefaultEnv, ResolvedLink, Settings, Tag, Template } from '../types.d.ts' */

// What the views read from the state. Pure.

/**
 * @param {AppState} state
 * @param {string | null | undefined} id
 * @returns {App | null}
 */
export function appById(state, id) {
  return id ? (state.apps.find((app) => app.id === id) ?? null) : null;
}

/**
 * The template an application uses, `null` when it does not exist any more.
 * @param {AppState} state
 * @param {App} app
 * @returns {Template | null}
 */
export function templateOf(state, app) {
  return state.templates.find((template) => template.id === app.templateId) ?? null;
}

/**
 * The number of applications that use each template.
 * @param {AppState} state
 * @returns {Map<string, number>}
 */
export function templateUsage(state) {
  /** @type {Map<string, number>} */
  const usage = new Map(state.templates.map((template) => [template.id, 0]));
  for (const app of state.apps) {
    if (usage.has(app.templateId)) usage.set(app.templateId, (usage.get(app.templateId) ?? 0) + 1);
  }
  return usage;
}

/**
 * The environment an application opens on: the one chosen before when the template still has
 * it, else the first or the last of the template according to the setting (`remember` falls back
 * to the last one). `null` for a template with no environment.
 * @param {Template} template
 * @param {DefaultEnv} defaultEnv
 * @param {string | null | undefined} chosen
 * @returns {string | null}
 */
export function activeEnvKey(template, defaultEnv, chosen) {
  if (template.envs.length === 0) return null;
  if (chosen && template.envs.some((env) => env.key === chosen)) return chosen;
  const env = defaultEnv === 'first' ? template.envs[0] : template.envs[template.envs.length - 1];
  return env?.key ?? null;
}

/**
 * The application opened at the start: the default one when it exists, else the remembered one,
 * else the first.
 * @param {AppState} state
 * @param {string | null | undefined} remembered the last application looked at
 * @returns {App | null}
 */
export function startApp(state, remembered) {
  return (
    appById(state, state.settings.defaultAppId) ??
    (state.settings.defaultAppId === null ? appById(state, remembered) : null) ??
    state.apps[0] ??
    null
  );
}

/**
 * Links grouped by tag: the tags in the order of the settings first, then the keys no tag
 * defines (a tag that was deleted), then the links with no tag. A group with no link is left out.
 * @template T
 * @param {readonly T[]} items
 * @param {readonly Tag[]} tags
 * @param {(item: T) => string} tagOf the tag key of an item
 * @returns {{ key: string, tag: Tag | null, items: T[] }[]}
 */
export function groupByTag(items, tags, tagOf) {
  /** @type {Map<string, T[]>} */
  const byKey = new Map();
  for (const item of items) {
    const key = tagOf(item);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(item);
    else byKey.set(key, [item]);
  }
  /** @type {{ key: string, tag: Tag | null, items: T[] }[]} */
  const groups = [];
  for (const tag of tags) {
    const bucket = byKey.get(tag.key);
    if (bucket) groups.push({ key: tag.key, tag, items: bucket });
  }
  for (const [key, bucket] of byKey) {
    if (key !== '' && !tags.some((tag) => tag.key === key)) {
      groups.push({ key, tag: null, items: bucket });
    }
  }
  const untagged = byKey.get('');
  if (untagged) groups.push({ key: '', tag: null, items: untagged });
  return groups;
}

/**
 * @param {readonly ResolvedLink[]} links
 * @returns {number} how many of them can be opened
 */
export function openableCount(links) {
  return links.filter(({ problem }) => problem === null).length;
}

/**
 * Whether a slug is taken by another application.
 * @param {AppState} state
 * @param {string} slug
 * @param {string | null} exceptId
 * @returns {boolean}
 */
export function slugTaken(state, slug, exceptId) {
  return state.apps.some((app) => app.slug === slug && app.id !== exceptId);
}

/**
 * @param {Settings} settings
 * @param {string} key
 * @returns {Tag | null}
 */
export function tagByKey(settings, key) {
  return settings.tags.find((tag) => tag.key === key) ?? null;
}

/**
 * A slug that no application has: the base, else the base with `-2`, `-3`...
 * @param {AppState} state
 * @param {string} base
 * @returns {string}
 */
export function availableSlug(state, base) {
  const stem = base === '' ? 'app' : base;
  if (!slugTaken(state, stem, null)) return stem;
  for (let n = 2; ; n += 1) {
    const candidate = `${stem}-${n}`;
    if (!slugTaken(state, candidate, null)) return candidate;
  }
}
