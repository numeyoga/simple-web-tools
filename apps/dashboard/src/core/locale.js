// Which language the interface speaks. Pure: the caller passes the stored choice and
// `navigator.languages`, and reads/writes the storage (adapters/i18n.js).

import { negotiateLocale } from '@simple-web-tools/i18n';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../i18n/index.js';

/**
 * The language a stored choice stands for, `null` for the automatic choice (nothing stored,
 * `auto`, or a language the interface no longer ships in). Only an exact supported tag counts:
 * the choice is one of the entries of the language select.
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
export function parseLocaleChoice(raw) {
  return typeof raw === 'string' && SUPPORTED_LOCALES.includes(raw) ? raw : null;
}

/**
 * The language of the interface: the stored choice when there is one, else the best match
 * between the browser's languages and the catalogs (`fr-CA` gets French), else English.
 * @param {{ stored?: string | null, languages?: readonly string[] | null }} input
 * @returns {string}
 */
export function resolveLocale({ stored, languages }) {
  const choice = parseLocaleChoice(stored);
  return negotiateLocale({
    requested: [...(choice ? [choice] : []), ...(languages ?? [])],
    supported: SUPPORTED_LOCALES,
    fallback: DEFAULT_LOCALE,
  });
}

/**
 * A BCP 47 tag in its canonical spelling (`en_gb` is `en-GB`), `null` for anything that is not one.
 * @param {unknown} tag
 * @returns {string | null}
 */
function canonicalTag(tag) {
  try {
    return Intl.getCanonicalLocales(String(tag).replace(/_/g, '-'))[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * The locale of the translator and of `<html lang>`: the language of the interface (`en`, `fr`:
 * the catalog) with the user's region when the browser gives one, so that dates and numbers
 * follow the region (`en-GB` writes 16/11/2026). It is the first entry of `navigator.languages`
 * whose language is the chosen one, in its canonical spelling, else the bare language. A saved
 * choice picks the language only: `fr` chosen in an `en-GB` browser that also lists `fr-CA` is
 * `fr-CA`, and `fr` alone when no entry has that language.
 * @param {{ stored?: string | null, languages?: readonly string[] | null }} input
 * @returns {string}
 */
export function resolveFormatLocale({ stored, languages }) {
  const language = resolveLocale({ stored, languages });
  for (const entry of languages ?? []) {
    const tag = canonicalTag(entry);
    if (tag && tag.split('-')[0]?.toLowerCase() === language) return tag;
  }
  return language;
}
