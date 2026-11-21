// The translator of the interface: the language is chosen once per page load, from the saved
// choice (`transient-notes-locale`, set in the preferences) or else from `navigator.languages`.
// A new choice is saved and the page reloads (the shell and the views are built with the text of
// one language). The translator's locale is the language plus the user's region when the browser
// gives one, `en-GB` for instance: the catalog is `en`, the date formats are British. Views get
// `t` and the formatters through `adapters/dom/lib.js`. The module is safe to import where there
// is no page (unit tests): the language is then English.

import { createLocalePreference, createTranslator } from '@simple-web-tools/i18n';
import { applyDocumentLanguage } from '@simple-web-tools/i18n/dom';
import { catalogs } from '../i18n/index.js';
import { parseLocaleChoice, resolveFormatLocale } from '../core/locale.js';
import { APP } from './names.js';

/** `localStorage`, or nothing when there is none (unit tests) or the browser refuses to hand it out. */
function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  }
}

const preference = createLocalePreference({ app: APP, storage: browserStorage() });

/** The saved choice: `en`, `fr`, or `null` for automatic. */
export function getLocaleChoice() {
  return parseLocaleChoice(preference.get());
}

/**
 * Saves the choice (`null` is automatic: the key is removed). Returns `false` when the browser
 * refused to store it.
 * @param {string | null} choice
 */
export function saveLocaleChoice(choice) {
  return preference.set(parseLocaleChoice(choice));
}

export const i18n = createTranslator({
  locale: resolveFormatLocale({
    stored: preference.get(),
    // Node has a `navigator` too, whose languages follow the machine's locale: test for a page.
    languages: typeof window === 'undefined' ? [] : navigator.languages,
  }),
  catalogs,
  // A key missing from every catalog shows its name: say so in the console while developing.
  onMissing: (event) => console.warn('[i18n] missing', event),
});

if (typeof document !== 'undefined') {
  applyDocumentLanguage(i18n.locale);
  document.title = i18n.t('app.title');
}

/** The translation function of the interface. */
export const t = i18n.t;
