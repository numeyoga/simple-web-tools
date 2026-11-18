// Catalog checks, meant for each app's Vitest suite: `expect(compareCatalogs(en, fr)).toEqual(NO_DIFFERENCES)`.

import {
  PLURAL_CATEGORIES,
  extractPlaceholders,
  flattenCatalog,
  isPluralMessage,
} from './messages.js';
import { pluralRules } from './formatters.js';

/**
 * @typedef {object} CatalogComparison
 * @property {string[]} missing keys in the reference that `other` lacks
 * @property {string[]} extra keys in `other` that the reference lacks
 * @property {{ key: string, expected: string[], actual: string[] }[]} placeholderMismatches
 *   messages whose placeholder names differ from the reference
 * @property {{ key: string, missing: string[] }[]} pluralGaps plural messages lacking a
 *   category the locale needs (or `shape` when one side is plural and the other is not)
 */

/** What a clean comparison returns. */
export const NO_DIFFERENCES = Object.freeze({
  missing: [],
  extra: [],
  placeholderMismatches: [],
  pluralGaps: [],
});

/**
 * Plural categories a locale needs, as reached by whole counts 0..1000. This leaves out
 * categories that only large or fractional numbers reach (French `many`, for millions), so
 * translators are not asked for variants nobody will see. `other` is always required.
 * @param {string} locale
 * @returns {string[]} in the order `zero, one, two, few, many, other`
 */
export function requiredPluralCategories(locale) {
  const rules = pluralRules(locale);
  const categories = new Set(['other']);
  for (let count = 0; count <= 1000; count += 1) categories.add(rules.select(count));
  return PLURAL_CATEGORIES.filter((category) => categories.has(category));
}

/**
 * Compare a catalog to the reference one (usually `en`).
 *
 * @param {import('./messages.js').Catalog} reference
 * @param {import('./messages.js').Catalog} other
 * @param {object} [options]
 * @param {string} [options.locale] locale of `other`; decides which plural categories its
 *   plural messages need. Without it, only `other` is required.
 * @returns {CatalogComparison}
 */
export function compareCatalogs(reference, other, { locale } = {}) {
  const ref = flattenCatalog(reference);
  const oth = flattenCatalog(other);
  const required = locale ? requiredPluralCategories(locale) : ['other'];

  /** @type {CatalogComparison} */
  const result = { missing: [], extra: [], placeholderMismatches: [], pluralGaps: [] };

  for (const key of Object.keys(ref)) {
    const expected = ref[key];
    const actual = oth[key];
    if (expected === undefined) continue;
    if (actual === undefined) {
      result.missing.push(key);
      continue;
    }
    if (isPluralMessage(expected) !== isPluralMessage(actual)) {
      result.pluralGaps.push({ key, missing: ['shape'] });
    } else if (isPluralMessage(actual)) {
      const variants = actual;
      const gap = required.filter((category) => variants[category] === undefined);
      if (gap.length) result.pluralGaps.push({ key, missing: gap });
    }
    const expectedNames = extractPlaceholders(expected);
    const actualNames = extractPlaceholders(actual);
    if (expectedNames.join() !== actualNames.join()) {
      result.placeholderMismatches.push({ key, expected: expectedNames, actual: actualNames });
    }
  }
  for (const key of Object.keys(oth)) {
    if (!(key in ref)) result.extra.push(key);
  }
  return result;
}
