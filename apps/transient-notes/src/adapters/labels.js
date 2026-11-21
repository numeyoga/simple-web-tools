/** @import { ParaCategory } from '../types.d.ts' */

// The translated texts that the core takes as arguments: the names of the categories, the folder
// created for a category that has none, and the texts of the export files. The keys are written
// out one by one (never built from a variable) so that the catalog test can check them.

import { t } from './i18n.js';

/**
 * The name of a PARA category.
 * @param {ParaCategory} category
 * @returns {string}
 */
export function categoryLabel(category) {
  switch (category) {
    case 'projects':
      return t('para.projects');
    case 'areas':
      return t('para.areas');
    case 'resources':
      return t('para.resources');
    case 'archives':
      return t('para.archives');
  }
}

/**
 * The name of the folder created when a note is added to a category that has no folder yet.
 * @param {ParaCategory} category
 * @returns {string}
 */
export function defaultFolderName(category) {
  switch (category) {
    case 'projects':
      return t('para.defaultFolder.projects');
    case 'areas':
      return t('para.defaultFolder.areas');
    case 'resources':
      return t('para.defaultFolder.resources');
    case 'archives':
      return t('para.defaultFolder.archives');
  }
}

/**
 * Texts of the export of one note (`noteToText`, `noteToMarkdown`).
 * @returns {import('../core/export.js').ExportLabels}
 */
export function exportLabels() {
  return { untitled: t('notes.untitled'), imageAlt: t('export.imageAlt') };
}

/**
 * Texts of the export of all notes, with its header.
 * @param {{ count: number, exportedAt: string }} input `exportedAt`: the date and time of the
 *   export, already formatted in the language of the page
 * @returns {import('../core/export.js').ExportLabels & import('../core/export.js').ExportAllLabels}
 */
export function exportAllLabels({ count, exportedAt }) {
  return {
    ...exportLabels(),
    heading: t('export.heading'),
    exportedAt: t('export.exportedAt', { date: exportedAt }),
    count: t('export.count', { count }),
  };
}
