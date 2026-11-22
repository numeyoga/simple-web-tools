// The preferences dialog: language, theme, text size and the letter and digit shortcuts, with the
// list of shortcuts. The choices apply at once and are kept by adapters/preferences.js (the
// language by adapters/i18n.js: it reloads the page, since the interface is built in one language).
import { getLocaleChoice, saveLocaleChoice } from '../i18n.js';
import {
  getSingleKeyShortcuts,
  getTheme,
  setSingleKeyShortcuts,
  setTheme,
} from '../preferences.js';
import * as UI from './ui.js';

const { el, t } = UI;

/** What each shortcut does, in the order of the dialog. */
export function shortcutList() {
  return [
    { keys: [t('keys.arrows'), t('keys.space'), t('keys.pageDown')], label: t('shortcut.next') },
    { keys: [t('keys.arrowsBack'), t('keys.pageUp')], label: t('shortcut.previous') },
    { keys: [t('keys.home'), t('keys.end')], label: t('shortcut.firstLast') },
    { keys: ['O'], label: t('shortcut.overview') },
    { keys: ['S'], label: t('shortcut.presenter') },
    { keys: ['R'], label: t('shortcut.ratio') },
    { keys: ['F'], label: t('shortcut.fullscreen') },
    { keys: [t('keys.digits'), t('keys.enter')], label: t('shortcut.goto') },
    { keys: [t('keys.escape')], label: t('shortcut.closeOverview') },
  ];
}

/** The list of shortcuts, as a Covenant-styled list. */
export function shortcutsList() {
  return el(
    'ul',
    { class: 'sl-shortcuts' },
    shortcutList().map(({ keys, label }) =>
      el(
        'li',
        { class: 'sl-shortcuts__row' },
        el('span', null, label),
        el(
          'span',
          { class: 'sl-shortcuts__keys' },
          keys.map((key) => UI.Kbd(key)),
        ),
      ),
    ),
  );
}

/** Wires the Covenant TextSize control (`data-cv-text-size-control`): its change is stored by the app. */
function textSizeControl() {
  const options = [
    { value: 'auto', label: t('prefs.textSizeAuto') },
    { value: 'standard', label: t('prefs.textSizeStandard') },
    { value: 'comfortable', label: t('prefs.textSizeComfortable') },
    { value: 'large', label: t('prefs.textSizeLarge') },
  ];
  return el(
    'fieldset',
    { class: 'cv-segmented', 'data-cv-text-size-control': '' },
    el('legend', null, t('prefs.textSize')),
    options.map(({ value, label }) =>
      el(
        'label',
        null,
        el('input', { type: 'radio', name: 'text-size', value, checked: value === 'auto' }),
        el('span', null, label),
      ),
    ),
  );
}

/**
 * Opens the preferences. A native modal: Escape closes it and focus goes back to the opener.
 * @returns {import('./types.js').ModalHandle}
 */
export function openPreferences() {
  const themeControl = UI.Segmented({
    legend: t('prefs.theme'),
    name: 'preferences-theme',
    options: [
      { value: 'system', label: t('prefs.themeSystem') },
      { value: 'light', label: t('prefs.themeLight') },
      { value: 'dark', label: t('prefs.themeDark') },
    ],
    value: getTheme() ?? 'system',
    onchange: (value) => setTheme(value === 'light' || value === 'dark' ? value : null),
  });

  const shortcutsSwitch = UI.Checkbox({
    label: t('prefs.singleKey'),
    switchRole: true,
    checked: getSingleKeyShortcuts(),
    onchange: (checked) => setSingleKeyShortcuts(checked),
  });
  const shortcutsHintId = UI.fieldId('sl-hint');
  shortcutsSwitch.input.setAttribute('aria-describedby', shortcutsHintId);

  const textSizeHintId = UI.fieldId('sl-hint');
  const textSize = textSizeControl();
  textSize.setAttribute('aria-describedby', textSizeHintId);

  // The language: "Language / Langue" in both languages, so that it can be found whichever
  // language the page is in. The names of the languages are written in their own language.
  const languageField = UI.Select({
    label: t('prefs.language'),
    value: getLocaleChoice() ?? 'auto',
    hint: t('prefs.languageHint'),
    options: [
      { value: 'auto', label: t('prefs.languageAuto') },
      { value: 'en', label: t('prefs.languageEnglish') },
      { value: 'fr', label: t('prefs.languageFrench') },
    ],
    onchange: (value) => {
      saveLocaleChoice(value === 'auto' ? null : value);
      location.reload();
    },
  });

  const body = el(
    'div',
    { class: 'sl-stack sl-gap-5' },
    languageField,
    el(
      'div',
      { class: 'cv-field' },
      el('span', { class: 'cv-label', 'aria-hidden': 'true' }, t('prefs.theme')),
      themeControl,
      el('span', { class: 'cv-hint' }, t('prefs.themeHint')),
    ),
    el(
      'div',
      { class: 'cv-field' },
      el('span', { class: 'cv-label', 'aria-hidden': 'true' }, t('prefs.textSize')),
      textSize,
      el('span', { class: 'cv-hint', id: textSizeHintId }, t('prefs.textSizeHint')),
    ),
    el(
      'div',
      { class: 'cv-field' },
      shortcutsSwitch,
      el('span', { class: 'cv-hint', id: shortcutsHintId }, t('prefs.singleKeyHint')),
    ),
    el(
      'div',
      { class: 'sl-stack sl-gap-3' },
      el('h3', { class: 'cv-label' }, t('prefs.shortcuts')),
      shortcutsList(),
    ),
  );

  const modal = UI.Modal({
    title: t('prefs.title'),
    body,
    footer: UI.Button({ children: t('common.close'), onclick: () => modal.close() }),
  });
  return modal;
}
