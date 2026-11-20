// The preferences dialog: language, theme, text size and single-key shortcuts, with the list of
// shortcuts. The choices apply at once and are kept by adapters/preferences.js (the language by
// adapters/i18n.js: it reloads the page, since the interface is built in one language).
import { getLocaleChoice, saveLocaleChoice } from '../i18n.js';
import {
  getSingleKeyShortcuts,
  getTheme,
  setSingleKeyShortcuts,
  setTheme,
} from '../preferences.js';
import * as UI from './ui.js';

const { el, t } = UI;

/** The shortcuts that need no modifier key (Single-key shortcuts preference, decision H). */
const SHORTCUTS = [
  { key: t('prefs.keySpace'), label: t('prefs.shortcutToggle') },
  { key: 'N', label: t('prefs.shortcutNew') },
  { key: 'S', label: t('prefs.shortcutStopAll') },
];

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
  const theme = getTheme();
  const themeControl = UI.Segmented({
    legend: t('prefs.theme'),
    name: 'preferences-theme',
    options: [
      { value: 'system', label: t('prefs.themeSystem') },
      { value: 'light', label: t('prefs.themeLight') },
      { value: 'dark', label: t('prefs.themeDark') },
    ],
    value: theme ?? 'system',
    onchange: (value) => setTheme(value === 'light' || value === 'dark' ? value : null),
  });

  const shortcutsSwitch = UI.Checkbox({
    label: t('prefs.singleKey'),
    switchRole: true,
    checked: getSingleKeyShortcuts(),
    onchange: (checked) => setSingleKeyShortcuts(checked),
  });
  const shortcutsHintId = UI.fieldId('ch-hint');
  shortcutsSwitch.input.setAttribute('aria-describedby', shortcutsHintId);

  const textSizeHintId = UI.fieldId('ch-hint');
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
    { class: 'ch-stack ch-gap-5' },
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
      { class: 'ch-stack ch-gap-3' },
      el('h3', { class: 'cv-label ch-title-reset' }, t('prefs.shortcuts')),
      el(
        'ul',
        { class: 'ch-shortcuts ch-meta' },
        SHORTCUTS.map(({ key, label }) =>
          el(
            'li',
            { class: 'ch-row ch-between ch-center ch-gap-3' },
            el('span', null, label),
            UI.Kbd(key),
          ),
        ),
      ),
    ),
  );

  const modal = UI.Modal({
    title: t('prefs.title'),
    body,
    footer: UI.Button({ children: t('common.close'), onclick: () => modal.close() }),
  });
  return modal;
}
