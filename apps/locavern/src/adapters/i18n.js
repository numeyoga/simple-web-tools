// The translator of the interface: the language is chosen once per page load, from the saved
// choice (`locavern-locale`, set in the display preferences) or else from `navigator.languages`.
// A new choice is saved and the page reloads (the shell and the views are built with the text of
// one language). The translator's locale is the language plus the user's region when the browser
// gives one, `en-GB` for instance: the catalog is `en`, the date formats are British. Views get
// `t` and the formatters from here. The module is safe to import where there is no browser (unit
// tests): the language is then English.

import { createLocalePreference, createTranslator } from '@simple-web-tools/i18n';
import { applyDocumentLanguage } from '@simple-web-tools/i18n/dom';
import { catalogs } from '../i18n/index.js';
import { createFormatters } from '../core/format.js';
import { createBuiltinTemplates } from '../core/templates.js';
import { parseLocaleChoice, resolveFormatLocale } from '../core/locale.js';

/** `localStorage`, or nothing when there is none (unit tests) or the browser refuses to hand it out. */
function browserStorage() {
  try {
    if (typeof window === 'undefined') throw new Error('no window');
    return window.localStorage;
  } catch {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  }
}

const preference = createLocalePreference({ app: 'locavern', storage: browserStorage() });

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
    languages: typeof navigator === 'undefined' ? [] : navigator.languages,
  }),
  catalogs,
  // A key missing from every catalog shows its name: say so in the console while developing.
  onMissing: (event) => console.warn('[i18n] missing', event),
});

/** The translation function of the interface. */
export const t = i18n.t;

/** Dates, times, durations and names of weekdays and months, in the language and region of the page. */
export const format = createFormatters(i18n);

/** The built-in templates (checklists, notes, whiteboards), written in the language of the page. */
export const builtinTemplates = createBuiltinTemplates(t);

if (typeof document !== 'undefined') {
  applyDocumentLanguage(i18n.locale);
  document.title = t('app.titleWithView', { view: t('common.tasks') });
}

/**
 * The counts of the items of a project, `3 tâches · 1 note · 0 tableau blanc`.
 * @param {number} tasks
 * @param {number} notes
 * @param {number} whiteboards
 */
export function describeCounts(tasks, notes, whiteboards) {
  return [
    t('common.tasksCount', { count: tasks }),
    t('common.notesCount', { count: notes }),
    t('common.whiteboardsCount', { count: whiteboards }),
  ].join(' · ');
}
