// The texts the pure core produces: errors of the model and the store, failures of an import,
// labels written into an export. The core has no translator of its own language choice (it
// takes no clock, no `navigator`, no storage): a function that produces text takes the
// translator `t` of the interface as an argument, and uses French when none is given, the
// language it always spoke (the unit tests and the older call sites rely on it).
//
// An error carries the catalog key and the parameters it was built from, so that the
// interface shows it in the language of the page (`errorText`), while `message` stays the
// French text for logs and tests.

import { createTranslator } from '@simple-web-tools/i18n';
import { catalogs } from '../i18n/index.js';

/** @typedef {(key: string, params?: Record<string, string | number>) => string} TranslateFn */
/** @typedef {{ ok: false, error: string, key: string, params?: Record<string, string | number> }} Failure */

/** The French translator, the default of every function that takes a `t`. @type {TranslateFn} */
export const frenchText = createTranslator({ locale: 'fr', catalogs }).t;

/** An error of the domain, with the key of its message in the catalogs. */
export class LocavernError extends Error {
  /**
   * @param {string} key a key of the `errors` namespace of the catalogs
   * @param {Record<string, string | number>} [params]
   */
  constructor(key, params) {
    super(frenchText(key, params));
    this.name = 'LocavernError';
    this.key = key;
    this.params = params;
  }
}

/**
 * A failed result (`{ ok: false }`) with its message in French and the key to translate it.
 * @param {string} key a key of the `errors` namespace of the catalogs
 * @param {Record<string, string | number>} [params]
 * @returns {Failure}
 */
export function failure(key, params) {
  return { ok: false, error: frenchText(key, params), key, ...(params ? { params } : {}) };
}

/**
 * The message of an error or of a failed result in the language of the interface. An error of
 * the core is translated from its key; another `Error` (a browser error, the permission error of
 * the export folder, which is built from the catalogs) keeps its own message; anything else gets
 * `fallbackKey`.
 * @param {unknown} error an error, or a failed result of the core
 * @param {TranslateFn} translate
 * @param {string} fallbackKey
 * @returns {string}
 */
export function errorText(error, translate, fallbackKey) {
  const known = /** @type {{ key?: unknown, params?: Record<string, string | number> } | null} */ (
    error && typeof error === 'object' ? error : null
  );
  if (typeof known?.key === 'string') return translate(known.key, known.params);
  if (error instanceof Error && error.message) return error.message;
  return translate(fallbackKey);
}
