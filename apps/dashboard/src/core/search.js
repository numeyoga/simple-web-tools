/** @import { App, Extra, ResolvedLink, Tag, Template } from '../types.d.ts' */

// Search: case and accent insensitive, every word of the query must be found. Pure.

/**
 * Lowercase, without accents, whitespace collapsed.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeSearchText(raw) {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The words of a query, normalized. Empty for a blank query.
 * @param {string} query
 * @returns {string[]}
 */
export function tokenizeSearchQuery(query) {
  const normalized = normalizeSearchText(query);
  return normalized ? normalized.split(' ') : [];
}

/**
 * Whether every word is found in the text.
 * @param {string} text
 * @param {readonly string[]} tokens from `tokenizeSearchQuery`
 * @returns {boolean}
 */
export function matchesTokens(text, tokens) {
  if (tokens.length === 0) return true;
  const haystack = normalizeSearchText(text);
  return tokens.every((token) => haystack.includes(token));
}

/**
 * The applications that match a query: by name, slug, description, template, Jira key or the
 * name of one of their extra links. Every application for a blank query (the same array).
 * @param {readonly App[]} apps
 * @param {readonly Template[]} templates
 * @param {string} query
 * @returns {readonly App[]}
 */
export function filterApps(apps, templates, query) {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) return apps;
  const names = new Map(templates.map((template) => [template.id, template.name]));
  return apps.filter((app) =>
    matchesTokens(
      [
        app.name,
        app.slug,
        app.jiraKey,
        app.description,
        names.get(app.templateId) ?? '',
        ...app.extras.map((extra) => extra.name),
      ].join(' '),
      tokens,
    ),
  );
}

/**
 * The links of an application and environment that match a query: by name, address or tag
 * label. Every link for a blank query (the same array).
 * @param {readonly ResolvedLink[]} links
 * @param {readonly Tag[]} tags
 * @param {string} query
 * @returns {readonly ResolvedLink[]}
 */
export function filterResolvedLinks(links, tags, query) {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) return links;
  return links.filter(({ link, url }) =>
    matchesTokens(
      `${link.name} ${url} ${tags.find((tag) => tag.key === link.tag)?.label ?? link.tag}`,
      tokens,
    ),
  );
}

/**
 * The extra links that match a query: by name, address or tag label.
 * @param {readonly Extra[]} extras
 * @param {readonly Tag[]} tags
 * @param {string} query
 * @returns {readonly Extra[]}
 */
export function filterExtras(extras, tags, query) {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) return extras;
  return extras.filter((extra) =>
    matchesTokens(
      `${extra.name} ${extra.url} ${tags.find((tag) => tag.key === extra.tag)?.label ?? extra.tag}`,
      tokens,
    ),
  );
}
