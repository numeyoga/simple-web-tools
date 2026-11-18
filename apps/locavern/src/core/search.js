/** @import { Note, RichTextDoc, RichTextNode, Task, Whiteboard } from '../types.d.ts' */

/**
 * Normalize text for case-insensitive and accent-insensitive local search.
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
 * Split a normalized query into searchable whitespace-delimited tokens.
 * @param {string} query
 * @returns {string[]}
 */
export function tokenizeSearchQuery(query) {
  const norm = normalizeSearchText(query);
  return norm ? norm.split(' ') : [];
}

/**
 * Check whether every query token matches the normalized haystack text.
 * @param {string} haystack
 * @param {readonly string[]} tokens
 * @returns {boolean}
 */
export function matchesSearchTokens(haystack, tokens) {
  if (tokens.length === 0) return true;
  const norm = normalizeSearchText(haystack);
  return tokens.every((tok) => norm.includes(tok));
}

/**
 * Extract readable plain text from a sanitized Tiptap RichTextDoc (text nodes and image alt labels).
 * @param {RichTextDoc | null | undefined} doc
 * @returns {string}
 */
export function extractRichTextPlainText(doc) {
  if (!doc || !Array.isArray(doc.content)) return '';
  /** @type {string[]} */
  const parts = [];

  /** @param {readonly RichTextNode[] | undefined} nodes */
  function walk(nodes) {
    if (!nodes) return;
    for (const node of nodes) {
      if (node.type === 'text' && typeof node.text === 'string') {
        parts.push(node.text);
      } else if (node.type === 'localImage' && typeof node.attrs?.alt === 'string') {
        const alt = node.attrs.alt.trim();
        if (alt) parts.push(alt);
      } else if (node.type === 'hardBreak') {
        parts.push(' ');
      }
      if (Array.isArray(node.content)) {
        walk(node.content);
        parts.push(' ');
      }
    }
  }

  walk(doc.content);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Build searchable text for a task (title, rich-text description, checklist items).
 * @param {Task} task
 * @returns {string}
 */
export function extractTaskSearchText(task) {
  const parts = [task.title];
  const descText = extractRichTextPlainText(task.descriptionDoc);
  if (descText) parts.push(descText);
  for (const item of task.checklist) {
    if (item.text) parts.push(item.text);
  }
  for (const tag of task.tags ?? []) {
    parts.push(tag);
  }
  return parts.join(' ');
}

/**
 * Build searchable text for a note (title and rich-text Tiptap content).
 * @param {Note} note
 * @returns {string}
 */
export function extractNoteSearchText(note) {
  const parts = [note.title];
  const descText = extractRichTextPlainText(note.contentDoc);
  if (descText) parts.push(descText);
  for (const tag of note.tags ?? []) {
    parts.push(tag);
  }
  return parts.join(' ');
}

/**
 * Build searchable text for a whiteboard (title and all element texts).
 * @param {Whiteboard} whiteboard
 * @returns {string}
 */
export function extractWhiteboardSearchText(whiteboard) {
  const parts = [whiteboard.title];
  for (const el of whiteboard.elements) {
    if (typeof el.text === 'string' && el.text.trim()) {
      parts.push(el.text.trim());
    }
  }
  return parts.join(' ');
}
