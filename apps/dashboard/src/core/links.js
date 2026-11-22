/** @import { App, EnvData, LinkProblem, ResolvedLink, Template, TemplateLink } from '../types.d.ts' */

// Link patterns: how `{env}`, `{slug}`, `{jiraKey}` and `{meta.<key>}` are filled in, and what
// an address has to be to be opened. Pure.
//
// A pattern holds placeholders written `{name}`. `env`, `slug` and `jiraKey` are always there;
// `{meta.<key>}` reads the metadata field `<key>` of the application for the environment, and
// `{<key>}` does the same (the earlier version wrote it that way; the three names above win). A
// placeholder with no value stays as written and is reported as missing. Values are inserted as
// they are, not URL-encoded: a host, a path or a query are written as they go in an address.

import { emptyEnvData } from './model.js';

/** `{name}` or `{meta.name}`: letters, digits and underscores. */
const PLACEHOLDER = /\{((?:meta\.)?[A-Za-z0-9_]+)\}/g;

/**
 * The placeholders of a pattern, as written, once each.
 * @param {string} pattern
 * @returns {string[]}
 */
export function placeholdersOf(pattern) {
  return [...new Set([...pattern.matchAll(PLACEHOLDER)].map((match) => match[0]))];
}

/**
 * The value a placeholder stands for, `''` when there is none.
 * @param {string} name the text between the braces
 * @param {{ env: string, slug: string, jiraKey: string, meta: Readonly<Record<string, string>> }} values
 * @returns {string}
 */
function valueOf(name, values) {
  if (name.startsWith('meta.')) return values.meta[name.slice(5)] ?? '';
  if (name === 'env') return values.env;
  if (name === 'slug') return values.slug;
  if (name === 'jiraKey') return values.jiraKey;
  return values.meta[name] ?? '';
}

/**
 * A pattern with its placeholders filled in.
 * @param {string} pattern
 * @param {{ env: string, slug: string, jiraKey: string, meta: Readonly<Record<string, string>> }} values
 * @returns {{ url: string, missing: string[] }} `missing`: the placeholders left as written
 */
export function renderPattern(pattern, values) {
  /** @type {Set<string>} */
  const missing = new Set();
  const url = pattern.replace(PLACEHOLDER, (placeholder, name) => {
    const value = valueOf(name, values);
    if (value === '') {
      missing.add(placeholder);
      return placeholder;
    }
    return value;
  });
  return { url, missing: [...missing] };
}

/** A scheme written out: `https://`, `javascript:`, `mailto:`. */
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
/** After a colon, a port (`localhost:3000`): a host, not a scheme. */
const PORT_AFTER_HOST = /^[a-z0-9.-]+:\d/i;

/**
 * What stops a resolved address from being opened, `null` when it can be. Only `http:` and
 * `https:` addresses with a host are opened: another scheme (`javascript:`, `data:`, `file:`...)
 * is `unsafe`, and an address with no scheme at all (`example.com/x`) is `invalid`: the pattern
 * or the value has to bring the `https://`.
 * @param {string} url
 * @returns {Exclude<LinkProblem, 'unresolved'> | null}
 */
export function classifyUrl(url) {
  const text = url.trim();
  if (text === '') return 'empty';
  const scheme = SCHEME.exec(text);
  if (!scheme) return 'invalid';
  const name = /** @type {string} */ (scheme[1]).toLowerCase();
  if (name !== 'http' && name !== 'https') {
    return PORT_AFTER_HOST.test(text) && !text.slice(scheme[0].length).startsWith('//')
      ? 'invalid'
      : 'unsafe';
  }
  if (!text.slice(scheme[0].length).startsWith('//')) return 'invalid';
  try {
    const parsed = new URL(text);
    return parsed.hostname === '' ? 'invalid' : null;
  } catch {
    return 'invalid';
  }
}

/**
 * The data an application holds for an environment (nothing when it holds none yet).
 * @param {App} app
 * @param {string} envKey
 * @returns {EnvData}
 */
export function envDataOf(app, envKey) {
  return app.envs[envKey] ?? emptyEnvData();
}

/**
 * A link of a template, for one application and one environment: the override when there is
 * one, else the pattern with its placeholders filled in.
 * @param {App} app
 * @param {string} envKey
 * @param {TemplateLink} link
 * @returns {ResolvedLink}
 */
export function resolveLink(app, envKey, link) {
  const env = envDataOf(app, envKey);
  const override = env.overrides[link.id];
  if (override !== undefined && override !== '') {
    return { link, url: override, overridden: true, problem: classifyUrl(override), missing: [] };
  }
  const { url, missing } = renderPattern(link.pattern, {
    env: envKey,
    slug: app.slug,
    jiraKey: app.jiraKey,
    meta: env.meta,
  });
  /** @type {LinkProblem | null} */
  const problem = missing.length > 0 ? 'unresolved' : classifyUrl(url);
  return { link, url, overridden: false, problem, missing };
}

/**
 * Every link of a template resolved for one environment, in the order of the template.
 * @param {App} app
 * @param {Template} template
 * @param {string} envKey
 * @returns {ResolvedLink[]}
 */
export function resolveLinks(app, template, envKey) {
  return template.links.map((link) => resolveLink(app, envKey, link));
}

/**
 * How many links of each environment have nothing to open yet: an empty pattern or a value
 * still to fill in.
 * @param {App} app
 * @param {Template} template
 * @returns {Record<string, number>} by environment key
 */
export function missingByEnv(app, template) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const env of template.envs) {
    counts[env.key] = resolveLinks(app, template, env.key).filter(
      ({ problem }) => problem === 'unresolved' || problem === 'empty',
    ).length;
  }
  return counts;
}

/**
 * The placeholders a pattern of a template can use, as written: the three that always exist, then
 * one per metadata field.
 * @param {Template} template
 * @returns {string[]}
 */
export function availablePlaceholders(template) {
  return ['{env}', '{slug}', '{jiraKey}', ...template.metaFields.map((f) => `{meta.${f.key}}`)];
}
