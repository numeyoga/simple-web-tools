/** @import { RichTextDoc, RichTextMark, RichTextNode } from './types.d.ts' */

/** The text of an image without alt text, when the app does not pass its own. */
const DEFAULT_IMAGE_ALT = 'Image';

/**
 * Apply ProseMirror/Tiptap inline marks around a text string cleanly in Markdown.
 * @param {string} rawText
 * @param {readonly RichTextMark[] | undefined} marks
 * @returns {string}
 */
function formatMarkedText(rawText, marks) {
  if (!marks || marks.length === 0) return rawText;

  // Preserve leading/trailing whitespace outside emphasis delimiters per CommonMark rules.
  // trimStart/trimEnd strip the same characters as `\s`, in linear time: a regex with a lazy
  // middle group between two `\s*` backtracks quadratically on long runs of spaces (ReDoS).
  const core = rawText.trim();
  if (!core) return rawText;
  const leading = rawText.slice(0, rawText.length - rawText.trimStart().length);
  const trailing = rawText.slice(rawText.trimEnd().length);

  let out = core;
  const hasCode = marks.some((m) => m.type === 'code');
  if (hasCode) {
    if (out.includes('`')) {
      const padded = out.startsWith('`') || out.endsWith('`') ? ` ${out} ` : out;
      out = `\`\`${padded}\`\``;
    } else {
      out = `\`${out}\``;
    }
  }

  for (const mark of marks) {
    if (mark.type === 'bold') {
      out = `**${out}**`;
    } else if (mark.type === 'italic') {
      out = `*${out}*`;
    } else if (mark.type === 'strike') {
      out = `~~${out}~~`;
    } else if (mark.type === 'link' && mark.attrs?.href) {
      out = `[${out}](${mark.attrs.href})`;
    }
  }

  return `${leading}${out}${trailing}`;
}

/**
 * Serialize inline child nodes (text + hardBreak) to a Markdown line.
 * @param {readonly RichTextNode[] | undefined} nodes
 * @returns {string}
 */
function serializeInlineNodes(nodes) {
  if (!nodes || nodes.length === 0) return '';
  let out = '';
  for (const node of nodes) {
    if (node.type === 'text' && typeof node.text === 'string') {
      out += formatMarkedText(node.text, node.marks);
    } else if (node.type === 'hardBreak') {
      out += '  \n';
    } else if (Array.isArray(node.content)) {
      out += serializeInlineNodes(node.content);
    }
  }
  return out;
}

/**
 * Serialize a list item (`listItem` or `taskItem`) with optional nested sublists.
 * @param {RichTextNode} itemNode
 * @param {string} marker
 * @param {number} depth
 * @param {string} imageAlt
 * @returns {string}
 */
function serializeListItem(itemNode, marker, depth, imageAlt) {
  const indent = '  '.repeat(depth);
  const children = Array.isArray(itemNode.content) ? itemNode.content : [];
  if (children.length === 0) {
    return `${indent}${marker}`;
  }

  /** @type {string[]} */
  const lines = [];
  let wroteFirst = false;

  for (const child of children) {
    if (child.type === 'paragraph') {
      const text = serializeInlineNodes(child.content);
      if (!wroteFirst) {
        lines.push(`${indent}${marker}${text}`);
        wroteFirst = true;
      } else {
        lines.push(`${indent}  ${text}`);
      }
    } else if (
      child.type === 'bulletList' ||
      child.type === 'orderedList' ||
      child.type === 'taskList'
    ) {
      if (!wroteFirst) {
        lines.push(`${indent}${marker.trimEnd()}`);
        wroteFirst = true;
      }
      lines.push(serializeListBlock(child, depth + 1, imageAlt));
    } else {
      const nested = serializeBlockNode(child, depth + 1, imageAlt);
      if (!wroteFirst) {
        lines.push(`${indent}${marker}${nested}`);
        wroteFirst = true;
      } else if (nested) {
        lines.push(`${indent}  ${nested}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Serialize a list container block (`bulletList`, `orderedList`, `taskList`).
 * @param {RichTextNode} listNode
 * @param {number} depth
 * @param {string} imageAlt
 * @returns {string}
 */
function serializeListBlock(listNode, depth, imageAlt) {
  const items = Array.isArray(listNode.content) ? listNode.content : [];
  /** @type {string[]} */
  const out = [];
  let order = 1;

  for (const item of items) {
    if (listNode.type === 'orderedList') {
      out.push(serializeListItem(item, `${order}. `, depth, imageAlt));
      order += 1;
    } else if (listNode.type === 'taskList' || item.type === 'taskItem') {
      const checked = Boolean(item.attrs?.checked);
      out.push(serializeListItem(item, checked ? '- [x] ' : '- [ ] ', depth, imageAlt));
    } else {
      out.push(serializeListItem(item, '- ', depth, imageAlt));
    }
  }

  return out.join('\n');
}

/**
 * Serialize a single block node to Markdown.
 * @param {RichTextNode} node
 * @param {number} [depth]
 * @param {string} [imageAlt]
 * @returns {string}
 */
function serializeBlockNode(node, depth = 0, imageAlt = DEFAULT_IMAGE_ALT) {
  if (node.type === 'heading') {
    const rawLevel = typeof node.attrs?.level === 'number' ? node.attrs.level : 2;
    const level = Math.min(3, Math.max(1, Math.trunc(rawLevel)));
    const hashes = '#'.repeat(level);
    return `${hashes} ${serializeInlineNodes(node.content)}`.trimEnd();
  }
  if (node.type === 'paragraph') {
    return serializeInlineNodes(node.content);
  }
  if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList') {
    return serializeListBlock(node, depth, imageAlt);
  }
  if (node.type === 'localImage') {
    const assetId = typeof node.attrs?.assetId === 'string' ? node.attrs.assetId.trim() : '';
    const rawAlt = typeof node.attrs?.alt === 'string' ? node.attrs.alt.trim() : '';
    const alt = (rawAlt || imageAlt).replace(/[\][]/g, '');
    return assetId ? `![${alt}](local-asset://${assetId})` : '';
  }
  if (Array.isArray(node.content)) {
    return serializeInlineNodes(node.content);
  }
  return '';
}

/**
 * Convert a Tiptap RichTextDoc into readable CommonMark/GFM Markdown.
 * @param {RichTextDoc | null | undefined} doc
 * @param {{ imageAlt?: string }} [labels] `imageAlt` is the text of an image that has no alt text
 *   (translated by the app, `Image` when omitted)
 * @returns {string}
 */
export function richTextDocToMarkdown(doc, labels = {}) {
  const imageAlt = labels.imageAlt ?? DEFAULT_IMAGE_ALT;
  if (!doc || !Array.isArray(doc.content)) return '';
  /** @type {string[]} */
  const blocks = [];
  for (const node of doc.content) {
    const rendered = serializeBlockNode(node, 0, imageAlt);
    if (rendered !== '') {
      blocks.push(rendered);
    }
  }
  return blocks.join('\n\n').trim();
}
