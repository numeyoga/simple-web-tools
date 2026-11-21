/** @import { Note } from '../types.d.ts' */

import { richTextDocToMarkdown } from '@simple-web-tools/rich-text';
import { frenchText } from './messages.js';

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

  const body = richTextDocToMarkdown(note.contentDoc, { imageAlt: t('common.localImage') });
  if (body) {
    sections.push(body);
  }

  return `${sections.join('\n\n')}\n`;
}
