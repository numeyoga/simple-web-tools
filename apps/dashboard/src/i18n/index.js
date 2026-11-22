// The catalogs of the interface, by locale. English is the reference and the fallback.

import en from './en.js';
import fr from './fr.js';

/** @type {Record<string, import('@simple-web-tools/i18n').Catalog>} */
export const catalogs = { en, fr };

/** The locales the interface ships in, English first (the default). */
export const SUPPORTED_LOCALES = Object.freeze(Object.keys(catalogs));

export const DEFAULT_LOCALE = 'en';
