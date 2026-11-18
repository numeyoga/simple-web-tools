/**
 * Message catalogs, plurals and `Intl` formatting (decision 0002).
 *
 * Rules (decision 0004): no DOM, no storage, no clock, no `navigator`. The language list is
 * passed in; the one DOM helper lives in `@simple-web-tools/i18n/dom`.
 */

export { createTranslator } from './translator.js';
export { negotiateLocale } from './negotiate.js';
export { createLocalePreference, localePreferenceKey } from './preference.js';
export { NO_DIFFERENCES, compareCatalogs, requiredPluralCategories } from './compare.js';
export { PLURAL_CATEGORIES, flattenCatalog } from './messages.js';

/** @typedef {import('./messages.js').Catalog} Catalog */
/** @typedef {import('./messages.js').PluralMessage} PluralMessage */
/** @typedef {import('./translator.js').Translator} Translator */
/** @typedef {import('./translator.js').TranslatorOptions} TranslatorOptions */
/** @typedef {import('./translator.js').MissingEvent} MissingEvent */
/** @typedef {import('./translator.js').DurationOptions} DurationOptions */
/** @typedef {import('./preference.js').LocalePreference} LocalePreference */
/** @typedef {import('./preference.js').PreferenceStorage} PreferenceStorage */
/** @typedef {import('./compare.js').CatalogComparison} CatalogComparison */
