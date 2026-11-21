/** @import { Note } from '../types.d.ts' */

// What the export buttons do: build the text of one note or of every note of the workspace, name
// the file with the local date, and save it. The core builds the text (`core/export.js`); the
// labels, the clock and the download are the adapter's.

import { toLocalIsoDate } from '@simple-web-tools/dates';
import {
  exportFileName,
  noteToMarkdown,
  noteToText,
  notesToMarkdown,
  notesToText,
  notesForExport,
} from '../core/export.js';
import { downloadText } from './download.js';
import { i18n } from './i18n.js';
import { exportAllLabels, exportLabels } from './labels.js';

/** @typedef {'txt' | 'md'} ExportFormat */

/** The two formats, for the views (they hold no literal that is not text of the interface). */
export const EXPORT_FORMAT = /** @type {const} */ ({ text: 'txt', markdown: 'md' });

/** @type {Record<ExportFormat, string>} */
const MIME = { txt: 'text/plain;charset=utf-8', md: 'text/markdown;charset=utf-8' };

/**
 * Saves one note as a text or a Markdown file named after its title.
 * @param {Note} note
 * @param {ExportFormat} format
 */
export function exportNote(note, format) {
  const labels = exportLabels();
  const text = format === 'md' ? noteToMarkdown(note, labels) : noteToText(note, labels);
  const fileName = exportFileName({
    kind: 'note',
    title: note.title,
    fallback: labels.untitled,
    extension: format,
  });
  downloadText(fileName, text, MIME[format]);
}

/**
 * Saves every note of the workspace in one file, most recently edited first.
 * @param {readonly Note[]} notes
 * @param {ExportFormat} format
 * @param {string} workspaceId
 */
export function exportAllNotes(notes, format, workspaceId) {
  const now = new Date();
  const ordered = notesForExport(notes);
  const text =
    format === 'md'
      ? notesToMarkdown(ordered, exportLabels())
      : notesToText(
          ordered,
          exportAllLabels({ count: ordered.length, exportedAt: i18n.formatDateTime(now) }),
        );
  const fileName = exportFileName({
    kind: 'all',
    workspaceId,
    date: toLocalIsoDate(now),
    extension: format,
  });
  downloadText(fileName, text, MIME[format]);
}
