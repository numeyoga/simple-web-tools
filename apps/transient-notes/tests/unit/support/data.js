// Builders for the tests: a state with folders, notes and assets, and rich-text documents.
import { createInitialState } from '../../../src/core/store.js';

/** @typedef {import('../../../src/types.d.ts').AppState} AppState */
/** @typedef {import('../../../src/types.d.ts').Folder} Folder */
/** @typedef {import('../../../src/types.d.ts').Note} Note */
/** @typedef {import('../../../src/types.d.ts').RichTextDoc} RichTextDoc */

/** A fixed instant, as the ISO timestamp the commands carry. @param {number} [minutes] after 09:00 UTC */
export const at = (minutes = 0) => new Date(Date.UTC(2026, 10, 18, 9, minutes)).toISOString();

/** A document with one paragraph per text. @param {...string} paragraphs @returns {RichTextDoc} */
export function doc(...paragraphs) {
  return {
    type: 'doc',
    content: paragraphs.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
  };
}

/** A document with a picture. @param {string} assetId @param {string} [alt] @returns {RichTextDoc} */
export function docWithImage(assetId, alt = '') {
  return {
    type: 'doc',
    content: [{ type: 'paragraph' }, { type: 'localImage', attrs: { assetId, alt } }],
  };
}

/** @param {Partial<Folder> & { id: string }} f @returns {Folder} */
export const folder = (f) => ({
  name: f.id,
  category: 'projects',
  createdAt: at(0),
  ...f,
});

/** @param {Partial<Note> & { id: string }} n @returns {Note} */
export const note = (n) => ({
  title: n.id,
  doc: doc(),
  folderId: null,
  createdAt: at(0),
  updatedAt: at(0),
  ...n,
});

/** @param {string} id @param {number} [size] */
export const asset = (id, size = 4) => ({ id, mime: 'image/png', size, createdAt: at(0) });

/**
 * @param {Partial<AppState>} [overrides]
 * @returns {AppState}
 */
export const stateWith = (overrides = {}) => ({ ...createInitialState(), ...overrides });
