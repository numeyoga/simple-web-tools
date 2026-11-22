/** @import { Group, Link } from '../types.d.ts' */

// Search: case and accent insensitive, every word of the query must be found in the name, the
// address or the group label of a link. Pure.

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
 * The links that match a query; every link for a blank query (the same array).
 * @param {readonly Link[]} links
 * @param {readonly Group[]} groups
 * @param {string} query
 * @returns {readonly Link[]}
 */
export function filterLinks(links, groups, query) {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) return links;
  const labels = new Map(groups.map((group) => [group.id, group.label]));
  return links.filter((link) => {
    const text = normalizeSearchText(
      `${link.name} ${link.url} ${link.groupId === null ? '' : (labels.get(link.groupId) ?? '')}`,
    );
    return tokens.every((token) => text.includes(token));
  });
}
