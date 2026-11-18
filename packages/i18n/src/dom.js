// The only DOM-touching code of the package, kept out of the main entry point
// (`@simple-web-tools/i18n/dom`) so that `src/core` can import the rest safely.

/**
 * Reflect the active locale on `<html lang>`, for screen readers, hyphenation and
 * locale-aware browser features.
 * @param {string} locale a BCP 47 tag, for example `fr`
 * @param {Document} [doc]
 */
export function applyDocumentLanguage(locale, doc = document) {
  doc.documentElement.lang = locale;
}
