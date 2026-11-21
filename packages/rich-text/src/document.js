/** @import { AllowedImageMimeType, RichTextDoc, RichTextMark, RichTextNode } from './types.d.ts' */

/**
 * The rich-text document model shared by every app that edits rich text: what a Tiptap JSON
 * document may contain, and the pure functions that clean and inspect one. No DOM, no Tiptap,
 * no storage: this module is safe to import from a `src/core` folder.
 */

/** @type {ReadonlySet<AllowedImageMimeType>} */
export const ALLOWED_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/** @type {RichTextDoc} */
export const EMPTY_RICH_DOC = Object.freeze({
  type: 'doc',
  content: Object.freeze([{ type: 'paragraph' }]),
});

const ALLOWED_NODE_TYPES = new Set([
  'doc',
  'paragraph',
  'text',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'taskList',
  'taskItem',
  'hardBreak',
  'localImage',
]);

const ALLOWED_MARK_TYPES = new Set(['bold', 'italic', 'code', 'strike', 'link']);

/**
 * Validate and sanitize a link URL (only https: and mailto: allowed).
 * @param {unknown} rawHref
 * @returns {string | null}
 */
export function sanitizeLinkHref(rawHref) {
  if (typeof rawHref !== 'string') return null;
  const trimmed = rawHref.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Sanitize a single ProseMirror/Tiptap mark.
 * @param {unknown} raw
 * @returns {RichTextMark | null}
 */
function sanitizeMark(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = /** @type {Record<string, unknown>} */ (raw);
  if (typeof candidate.type !== 'string' || !ALLOWED_MARK_TYPES.has(candidate.type)) {
    return null;
  }
  if (candidate.type === 'link') {
    const attrs =
      candidate.attrs && typeof candidate.attrs === 'object'
        ? /** @type {Record<string, unknown>} */ (candidate.attrs)
        : null;
    const safeHref = sanitizeLinkHref(attrs?.href);
    if (!safeHref) return null;
    return {
      type: 'link',
      attrs: {
        href: safeHref,
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    };
  }
  return { type: candidate.type };
}

/**
 * Sanitize a single ProseMirror/Tiptap node recursively.
 * @param {unknown} raw
 * @returns {RichTextNode | null}
 */
function sanitizeNode(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const node = /** @type {Record<string, unknown>} */ (raw);
  if (typeof node.type !== 'string' || !ALLOWED_NODE_TYPES.has(node.type)) {
    return null;
  }

  if (node.type === 'text') {
    if (typeof node.text !== 'string') return null;
    const rawMarks = Array.isArray(node.marks) ? node.marks : [];
    /** @type {RichTextMark[]} */
    const marks = [];
    for (const m of rawMarks) {
      const cleanMark = sanitizeMark(m);
      if (cleanMark) marks.push(cleanMark);
    }
    return node.marks !== undefined
      ? { type: 'text', text: node.text, marks }
      : { type: 'text', text: node.text };
  }

  if (node.type === 'localImage') {
    const attrs =
      node.attrs && typeof node.attrs === 'object'
        ? /** @type {Record<string, unknown>} */ (node.attrs)
        : null;
    const assetId = typeof attrs?.assetId === 'string' ? attrs.assetId.trim() : '';
    if (!assetId) return null;
    const alt = typeof attrs?.alt === 'string' ? attrs.alt.slice(0, 200) : '';
    return {
      type: 'localImage',
      attrs: { assetId, alt },
    };
  }

  /** @type {Record<string, unknown> | undefined} */
  let cleanAttrs;
  if (node.type === 'heading') {
    const attrs =
      node.attrs && typeof node.attrs === 'object'
        ? /** @type {Record<string, unknown>} */ (node.attrs)
        : null;
    const level =
      typeof attrs?.level === 'number' && [1, 2, 3].includes(attrs.level) ? attrs.level : 2;
    cleanAttrs = { level };
  } else if (node.type === 'taskItem') {
    const attrs =
      node.attrs && typeof node.attrs === 'object'
        ? /** @type {Record<string, unknown>} */ (node.attrs)
        : null;
    cleanAttrs = { checked: Boolean(attrs?.checked) };
  }

  const rawContent = Array.isArray(node.content) ? node.content : undefined;
  /** @type {RichTextNode[] | undefined} */
  let cleanContent;
  if (rawContent) {
    cleanContent = [];
    for (const child of rawContent) {
      const sanitized = sanitizeNode(child);
      if (sanitized) cleanContent.push(sanitized);
    }
  }

  /** @type {RichTextNode} */
  const out = { type: node.type };
  if (cleanAttrs) {
    return cleanContent !== undefined
      ? { ...out, attrs: cleanAttrs, content: cleanContent }
      : { ...out, attrs: cleanAttrs };
  }
  return cleanContent !== undefined ? { ...out, content: cleanContent } : out;
}

/**
 * Sanitize an arbitrary Tiptap JSON document and remove remote images / unsafe links.
 * @param {unknown} rawDoc
 * @returns {RichTextDoc}
 */
export function sanitizeRichTextDoc(rawDoc) {
  if (!rawDoc || typeof rawDoc !== 'object') {
    return EMPTY_RICH_DOC;
  }
  const candidate = /** @type {Record<string, unknown>} */ (rawDoc);
  if (candidate.type !== 'doc' || !Array.isArray(candidate.content)) {
    return EMPTY_RICH_DOC;
  }
  /** @type {RichTextNode[]} */
  const cleanContent = [];
  for (const child of candidate.content) {
    if (
      child &&
      typeof child === 'object' &&
      /** @type {Record<string, unknown>} */ (child).type === 'doc'
    ) {
      continue;
    }
    const clean = sanitizeNode(child);
    if (clean) cleanContent.push(clean);
  }
  if (cleanContent.length === 0) {
    return EMPTY_RICH_DOC;
  }
  return { type: 'doc', content: cleanContent };
}

/**
 * Extract all unique localImage assetIds referenced in a RichTextDoc.
 * @param {RichTextDoc} doc
 * @returns {string[]}
 */
export function collectDocAssetIds(doc) {
  /** @type {Set<string>} */
  const ids = new Set();

  /** @param {readonly RichTextNode[] | undefined} nodes */
  function walk(nodes) {
    if (!nodes) return;
    for (const node of nodes) {
      if (node.type === 'localImage' && typeof node.attrs?.assetId === 'string') {
        const assetId = node.attrs.assetId.trim();
        if (assetId) ids.add(assetId);
      }
      if (node.content) walk(node.content);
    }
  }

  walk(doc.content);
  return [...ids];
}
