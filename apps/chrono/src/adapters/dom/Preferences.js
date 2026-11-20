// The preferences dialog: theme, text size and single-key shortcuts, with the list of shortcuts.
// The choices apply at once and are kept by adapters/preferences.js.
import {
  getSingleKeyShortcuts,
  getTheme,
  setSingleKeyShortcuts,
  setTheme,
} from '../preferences.js';
import * as UI from './ui.js';

const { el } = UI;

/** The shortcuts that need no modifier key (Single-key shortcuts preference, decision H). */
const SHORTCUTS = [
  { key: 'Espace', label: 'Démarrer, mettre en pause ou reprendre' },
  { key: 'N', label: 'Nouveau chrono' },
  { key: 'S', label: 'Tout arrêter' },
];

/** Wires the Covenant TextSize control (`data-cv-text-size-control`): its change is stored by the app. */
function textSizeControl() {
  /** @type {[string, string][]} */
  const options = [
    ['auto', 'Automatique'],
    ['standard', 'Standard'],
    ['comfortable', 'Confortable'],
    ['large', 'Grande'],
  ];
  return el(
    'fieldset',
    { class: 'cv-segmented', 'data-cv-text-size-control': '' },
    el('legend', null, 'Taille du texte'),
    options.map(([value, label]) =>
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
    legend: 'Thème',
    name: 'preferences-theme',
    options: [
      { value: 'system', label: 'Système' },
      { value: 'light', label: 'Clair' },
      { value: 'dark', label: 'Sombre' },
    ],
    value: theme ?? 'system',
    onchange: (value) => setTheme(value === 'light' || value === 'dark' ? value : null),
  });

  const shortcutsSwitch = UI.Checkbox({
    label: 'Raccourcis à une touche',
    switchRole: true,
    checked: getSingleKeyShortcuts(),
    onchange: (checked) => setSingleKeyShortcuts(checked),
  });
  const shortcutsHintId = UI.fieldId('ch-hint');
  shortcutsSwitch.input.setAttribute('aria-describedby', shortcutsHintId);

  const textSizeHintId = UI.fieldId('ch-hint');
  const textSize = textSizeControl();
  textSize.setAttribute('aria-describedby', textSizeHintId);

  const body = el(
    'div',
    { class: 'ch-stack ch-gap-5' },
    el(
      'div',
      { class: 'cv-field' },
      el('span', { class: 'cv-label', 'aria-hidden': 'true' }, 'Thème'),
      themeControl,
      el(
        'span',
        { class: 'cv-hint' },
        'Système suit le réglage de ton appareil, clair et sombre le remplacent.',
      ),
    ),
    el(
      'div',
      { class: 'cv-field' },
      el('span', { class: 'cv-label', 'aria-hidden': 'true' }, 'Taille du texte'),
      textSize,
      el(
        'span',
        { class: 'cv-hint', id: textSizeHintId },
        'Automatique agrandit le texte sur les grands écrans.',
      ),
    ),
    el(
      'div',
      { class: 'cv-field' },
      shortcutsSwitch,
      el(
        'span',
        { class: 'cv-hint', id: shortcutsHintId },
        'Espace, N et S agissent sans autre touche. Ils ne se déclenchent jamais pendant une saisie ni quand un dialogue est ouvert.',
      ),
    ),
    el(
      'div',
      { class: 'ch-stack ch-gap-3' },
      el('h3', { class: 'cv-label ch-title-reset' }, 'Raccourcis'),
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
    title: 'Préférences',
    body,
    footer: UI.Button({ children: 'Fermer', onclick: () => modal.close() }),
  });
  return modal;
}
