/** @import { RichTextDoc, RichTextNode } from './types.d.ts' */

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
