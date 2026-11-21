// Pure part of the package: no DOM, no Tiptap. The editor has its own entry points
// (`@simple-web-tools/rich-text/editor` and `/editor-lazy`) so that importing this module never
// pulls Tiptap into a bundle.

/** @typedef {import('./types.d.ts').AllowedImageMimeType} AllowedImageMimeType */
/** @typedef {import('./types.d.ts').RichTextDoc} RichTextDoc */
/** @typedef {import('./types.d.ts').RichTextNode} RichTextNode */
/** @typedef {import('./types.d.ts').RichTextMark} RichTextMark */

export {
  ALLOWED_IMAGE_MIMES,
  EMPTY_RICH_DOC,
  collectDocAssetIds,
  sanitizeLinkHref,
  sanitizeRichTextDoc,
} from './document.js';
export { extractRichTextPlainText } from './plain-text.js';
export { richTextDocToMarkdown } from './markdown.js';
