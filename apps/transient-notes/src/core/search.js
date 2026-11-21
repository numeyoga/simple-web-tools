/** @import { Note } from '../types.d.ts' */

// Search: case and accent insensitive, every word of the query must be found in the title or
// in the text of the note. Pure.

import { extractRichTextPlainText } from '@simple-web-tools/rich-text';

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
 * Whether every token is found in the text (already normalized or not).
 * @param {string} haystack
 * @param {readonly string[]} tokens
 * @returns {boolean}
 */
export function matchesSearchTokens(haystack, tokens) {
  if (tokens.length === 0) return true;
  const normalized = normalizeSearchText(haystack);
  return tokens.every((token) => normalized.includes(token));
}

/** The normalized text of a note, kept per note object: notes are never mutated. */
const searchTextCache = new WeakMap();

/**
 * The searchable text of a note: title and plain text of its content, normalized.
 * @param {Note} note
 * @returns {string}
 */
export function noteSearchText(note) {
  const cached = searchTextCache.get(note);
  if (cached !== undefined) return cached;
  const text = normalizeSearchText(`${note.title} ${extractRichTextPlainText(note.doc)}`);
  searchTextCache.set(note, text);
  return text;
}

/**
 * Whether a note matches a query (a blank query matches every note).
 * @param {Note} note
 * @param {readonly string[]} tokens from `tokenizeSearchQuery`
 * @returns {boolean}
 */
export function noteMatches(note, tokens) {
  if (tokens.length === 0) return true;
  const text = noteSearchText(note);
  return tokens.every((token) => text.includes(token));
}

/**
 * A short plain-text preview of a note for a list (the text of the content, cut).
 * @param {Note} note
 * @param {number} [maxLength]
 * @returns {string}
 */
export function notePreview(note, maxLength = 120) {
  const text = extractRichTextPlainText(note.doc);
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}
