/** @import { Note, RichTextDoc } from '../types.d.ts' */
/** @import { RichTextNode } from '@simple-web-tools/rich-text' */

// Exports of notes as plain text and as Markdown, and the file names they are saved under.
// Pure: every text a file holds that is not the user's own (the header, "Untitled") comes in
// through `labels`, already translated, and the date of a file name is passed in as a local
// `YYYY-MM-DD` string (never `toISOString()`, which would give the UTC day).

import { richTextDocToMarkdown } from '@simple-web-tools/rich-text';

/**
 * @typedef {object} ExportLabels
 * @property {string} untitled title of a note that has none
 * @property {string} imageAlt text of an image that has no alt text
 */

/**
 * @typedef {object} ExportAllLabels
 * @property {string} heading first line of the file of all notes, for example `TRANSIENT NOTES - Full export`
 * @property {string} exportedAt the line that dates the export, already formatted
 * @property {string} count the line that gives the number of notes, already formatted
 */

const NOTE_RULE = '='.repeat(50);
const ALL_RULE = '='.repeat(80);

/**
 * @param {Note} note
 * @param {string} untitled
 * @returns {string}
 */
function titleOf(note, untitled) {
  return note.title.trim() || untitled;
}

/**
 * Notes in the order of an export: most recently edited first.
 * @param {readonly Note[]} notes
 * @returns {Note[]}
 */
export function notesForExport(notes) {
  return [...notes].sort((a, b) =>
    a.updatedAt === b.updatedAt ? (a.id < b.id ? -1 : 1) : a.updatedAt < b.updatedAt ? 1 : -1,
  );
}

/**
 * @param {readonly RichTextNode[] | undefined} nodes
 * @returns {string} the inline content of a block
 */
function inlineText(nodes) {
  if (!nodes) return '';
  let out = '';
  for (const node of nodes) {
    if (node.type === 'text' && typeof node.text === 'string') out += node.text;
    else if (node.type === 'hardBreak') out += '\n';
    else if (node.content) out += inlineText(node.content);
  }
  return out;
}

/**
 * @param {RichTextNode} list
 * @param {number} depth
 * @param {string} imageAlt
 * @returns {string[]} one line per item
 */
function listLines(list, depth, imageAlt) {
  /** @type {string[]} */
  const lines = [];
  let order = 1;
  const indent = '  '.repeat(depth);
  for (const item of list.content ?? []) {
    let marker = '- ';
    if (list.type === 'orderedList') {
      marker = `${order}. `;
      order += 1;
    } else if (list.type === 'taskList' || item.type === 'taskItem') {
      marker = item.attrs?.checked ? '[x] ' : '[ ] ';
    }
    /** @type {string[]} */
    const own = [];
    /** @type {string[]} */
    const nested = [];
    for (const child of item.content ?? []) {
      if (
        child.type === 'bulletList' ||
        child.type === 'orderedList' ||
        child.type === 'taskList'
      ) {
        nested.push(...listLines(child, depth + 1, imageAlt));
      } else {
        own.push(blockText(child, imageAlt));
      }
    }
    lines.push(`${indent}${marker}${own.join(' ').replace(/\n+/g, ' ')}`.trimEnd(), ...nested);
  }
  return lines;
}

/**
 * @param {RichTextNode} node
 * @param {string} imageAlt
 * @returns {string}
 */
function blockText(node, imageAlt) {
  if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList') {
    return listLines(node, 0, imageAlt).join('\n');
  }
  if (node.type === 'localImage') {
    const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt.trim() : '';
    return `[${alt || imageAlt}]`;
  }
  return inlineText(node.content);
}

/**
 * The text of a document with its structure kept as lines: one block per paragraph, blank line
 * between blocks, lists as `- `, `1. ` or `[ ] ` lines, an image as `[alt]`.
 * @param {RichTextDoc | null | undefined} doc
 * @param {{ imageAlt: string }} labels
 * @returns {string}
 */
export function docToPlainText(doc, { imageAlt }) {
  if (!doc || !Array.isArray(doc.content)) return '';
  return doc.content
    .map((node) => blockText(node, imageAlt))
    .filter((block) => block !== '')
    .join('\n\n')
    .trim();
}

/**
 * One note as text: the title, a rule, then the content.
 * @param {Note} note
 * @param {ExportLabels} labels
 * @returns {string}
 */
export function noteToText(note, labels) {
  const body = docToPlainText(note.doc, labels);
  return `${titleOf(note, labels.untitled)}\n${NOTE_RULE}${body ? `\n\n${body}` : ''}\n`;
}

/**
 * Every note in one text file, with a header. The notes are given in the order to write.
 * @param {readonly Note[]} notes
 * @param {ExportLabels & ExportAllLabels} labels
 * @returns {string}
 */
export function notesToText(notes, labels) {
  const header = `${labels.heading}\n${labels.exportedAt}\n${labels.count}\n${ALL_RULE}\n\n`;
  const body = notes.map((note) => noteToText(note, labels).trimEnd()).join(`\n\n${ALL_RULE}\n\n`);
  return `${header}${body}\n`;
}

/**
 * One note as Markdown: a `#` heading with the title, then the content. Local images read
 * `![alt](local-asset://<id>)`: the export carries no picture, use the JSON backup for that.
 * @param {Note} note
 * @param {ExportLabels} labels
 * @returns {string}
 */
export function noteToMarkdown(note, labels) {
  const body = richTextDocToMarkdown(note.doc, { imageAlt: labels.imageAlt });
  return `# ${titleOf(note, labels.untitled)}${body ? `\n\n${body}` : ''}\n`;
}

/**
 * Every note in one Markdown file, separated by rules. The notes are given in the order to write.
 * @param {readonly Note[]} notes
 * @param {ExportLabels} labels
 * @returns {string}
 */
export function notesToMarkdown(notes, labels) {
  return `${notes.map((note) => noteToMarkdown(note, labels).trimEnd()).join('\n\n---\n\n')}\n`;
}

const MAX_NAME_LENGTH = 80;
// Characters no common file system accepts in a name; control characters are replaced apart.
const UNSAFE_NAME_CHARS = /[<>:"/\\|?*]/g;
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * A title as a file name part: no path separator, no reserved character, no leading dot,
 * spaces kept as single spaces, at most 80 characters. `fallback` when nothing is left.
 * @param {string} title
 * @param {string} fallback
 * @returns {string}
 */
export function safeFileName(title, fallback) {
  let name = [...title]
    .map((char) => ((char.codePointAt(0) ?? 0) < 32 || char === '\u007f' ? ' ' : char))
    .join('')
    .replace(UNSAFE_NAME_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();
  // Dots at the ends are dropped one at a time: a trailing dot is not allowed on Windows and a
  // leading one hides the file.
  while (name.startsWith('.')) name = name.slice(1).trim();
  while (name.endsWith('.')) name = name.slice(0, -1).trim();
  if (name === '' || RESERVED_NAMES.test(name)) return fallback;
  return name;
}

/**
 * The name of an export file.
 * - a note: `<title>.<ext>` (`<fallback>.<ext>` when the title gives nothing usable);
 * - everything and the backup: `transient-notes-<workspace>-<date>.<ext>`.
 * @param {{ kind: 'note', title: string, fallback: string, extension: 'txt' | 'md' }
 *   | { kind: 'all', workspaceId: string, date: string, extension: 'txt' | 'md' | 'json' }} input
 *   `date` is a local calendar date, `YYYY-MM-DD`
 * @returns {string}
 */
export function exportFileName(input) {
  if (input.kind === 'note') {
    return `${safeFileName(input.title, input.fallback)}.${input.extension}`;
  }
  return `transient-notes-${input.workspaceId}-${input.date}.${input.extension}`;
}
