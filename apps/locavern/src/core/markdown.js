/** @import { Note, RichTextDoc, RichTextMark, RichTextNode } from '../types.d.ts' */

import { frenchText } from './messages.js';

/**
 * Apply ProseMirror/Tiptap inline marks around a text string cleanly in Markdown.
 * @param {string} rawText
 * @param {readonly RichTextMark[] | undefined} marks
 * @returns {string}
 */
function formatMarkedText(rawText, marks) {
  if (!marks || marks.length === 0) return rawText;

  // Preserve leading/trailing whitespace outside emphasis delimiters per CommonMark rules.
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(rawText);
  const leading = match?.[1] ?? '';
  const core = match?.[2] ?? rawText;
  const trailing = match?.[3] ?? '';
  if (!core) return rawText;

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
 * @param {import('./messages.js').TranslateFn} t
 * @returns {string}
 */
function serializeListItem(itemNode, marker, depth, t) {
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
      lines.push(serializeListBlock(child, depth + 1, t));
    } else {
      const nested = serializeBlockNode(child, depth + 1, t);
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
 * @param {import('./messages.js').TranslateFn} t
 * @returns {string}
 */
function serializeListBlock(listNode, depth, t) {
  const items = Array.isArray(listNode.content) ? listNode.content : [];
  /** @type {string[]} */
  const out = [];
  let order = 1;

  for (const item of items) {
    if (listNode.type === 'orderedList') {
      out.push(serializeListItem(item, `${order}. `, depth, t));
      order += 1;
    } else if (listNode.type === 'taskList' || item.type === 'taskItem') {
      const checked = Boolean(item.attrs?.checked);
      out.push(serializeListItem(item, checked ? '- [x] ' : '- [ ] ', depth, t));
    } else {
      out.push(serializeListItem(item, '- ', depth, t));
    }
  }

  return out.join('\n');
}

/**
 * Serialize a single block node to Markdown.
 * @param {RichTextNode} node
 * @param {number} [depth]
 * @param {import('./messages.js').TranslateFn} [t]
 * @returns {string}
 */
function serializeBlockNode(node, depth = 0, t = frenchText) {
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
    return serializeListBlock(node, depth, t);
  }
  if (node.type === 'localImage') {
    const assetId = typeof node.attrs?.assetId === 'string' ? node.attrs.assetId.trim() : '';
    const rawAlt = typeof node.attrs?.alt === 'string' ? node.attrs.alt.trim() : '';
    const alt = (rawAlt || t('common.localImage')).replace(/[\][]/g, '');
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
 * @param {import('./messages.js').TranslateFn} [t] the translator of the interface (French when omitted)
 * @returns {string}
 */
export function richTextDocToMarkdown(doc, t = frenchText) {
  if (!doc || !Array.isArray(doc.content)) return '';
  /** @type {string[]} */
  const blocks = [];
  for (const node of doc.content) {
    const rendered = serializeBlockNode(node, 0, t);
    if (rendered !== '') {
      blocks.push(rendered);
    }
  }
  return blocks.join('\n\n').trim();
}

/**
 * Build a standalone Markdown (.md) document for a Locavern note.
 * @param {Note} note
 * @param {{ projectName?: string | null, t?: import('./messages.js').TranslateFn }} [opts]
 *   `t` is the translator of the interface (French when omitted)
 * @returns {string}
 */
export function noteToMarkdown(note, opts = {}) {
  const t = opts.t ?? frenchText;
  const title = note.title.trim() || t('export.markdown.untitledNote');
  /** @type {string[]} */
  const sections = [`# ${title}`];

  const metaParts = [];
  if (opts.projectName) {
    metaParts.push(t('export.markdown.project', { value: opts.projectName }));
  }
  if (note.updatedAt) {
    metaParts.push(t('export.markdown.updated', { value: note.updatedAt.slice(0, 10) }));
  }
  if (metaParts.length > 0) {
    sections.push(`> ${metaParts.join(' · ')}`);
  }

  const body = richTextDocToMarkdown(note.contentDoc, t);
  if (body) {
    sections.push(body);
  }

  return `${sections.join('\n\n')}\n`;
}
