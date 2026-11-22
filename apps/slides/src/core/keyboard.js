// The keyboard map of the main window, as a pure function: a key press and the digits typed so far
// in, what to do and the new digits out. The adapter listens to the events, owns the one-second
// timer that clears the digits, and runs the intent.
//
//   next        ArrowRight, ArrowDown, Space, PageDown
//   previous    ArrowLeft, ArrowUp, PageUp
//   first/last  Home, End
//   overview    O toggles, Escape closes
//   ratio       R
//   fullscreen  F
//   presenter   S
//   go to       digits, then Enter
//
// Letters and digits are single-key shortcuts (WCAG 2.1.4): the adapter runs them only while the
// preference is on and no modifier, text field or dialog is involved. Arrows, Space, Home, End,
// PageUp and PageDown are not character keys and always work.

/**
 * @typedef {{ type: 'command', command: import('./store.js').Command }
 *   | { type: 'fullscreen' }
 *   | { type: 'presenter' }} Intent
 * @typedef {{ intent: Intent | null, buffer: string, handled: boolean, restartTimer: boolean }} KeyResult
 *   `handled`: the browser's own behaviour for the key must be cancelled
 */

/** How long the digits wait for Enter before they are dropped, in milliseconds. */
export const GOTO_RESET_DELAY = 1000;

/** The keys that are not characters: they are not single-key shortcuts. */
const NAVIGATION_KEYS = new Set([
  'ArrowRight',
  'ArrowDown',
  ' ',
  'PageDown',
  'ArrowLeft',
  'ArrowUp',
  'PageUp',
  'Home',
  'End',
]);

/**
 * Whether a key is one of the character shortcuts (a letter or a digit of the map).
 * @param {string} key
 */
export function isCharacterShortcut(key) {
  return /^[0-9]$/.test(key) || ['o', 'r', 'f', 's'].includes(key.toLowerCase());
}

/**
 * @param {string} key `event.key`
 * @param {string} buffer the digits typed so far
 * @param {{ characterShortcuts?: boolean }} [options] `false` when the person turned the letter and
 *   digit shortcuts off: only the navigation keys and Escape remain
 * @returns {KeyResult}
 */
export function interpretKey(key, buffer, { characterShortcuts = true } = {}) {
  /** @param {import('./store.js').Command} command @returns {KeyResult} */
  const run = (command) => ({
    intent: { type: 'command', command },
    buffer: '',
    handled: true,
    restartTimer: false,
  });
  /** @type {KeyResult} */
  const nothing = { intent: null, buffer, handled: false, restartTimer: false };

  if (!characterShortcuts && isCharacterShortcut(key)) return nothing;

  if (/^[0-9]$/.test(key)) {
    return { intent: null, buffer: buffer + key, handled: false, restartTimer: true };
  }

  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
    case ' ':
    case 'PageDown':
      return run({ type: 'next' });
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'PageUp':
      return run({ type: 'previous' });
    case 'Home':
      return run({ type: 'first' });
    case 'End':
      return run({ type: 'last' });
    case 'Enter':
      if (buffer === '') return nothing;
      return run({ type: 'navigate', index: Number(buffer) - 1 });
    case 'Escape':
      return { ...run({ type: 'close_overview' }), handled: false };
    case 'o':
    case 'O':
      return { ...run({ type: 'toggle_overview' }), handled: false };
    case 'r':
    case 'R':
      return { ...run({ type: 'toggle_ratio' }), handled: false };
    case 'f':
    case 'F':
      return { intent: { type: 'fullscreen' }, buffer: '', handled: false, restartTimer: false };
    case 's':
    case 'S':
      return { intent: { type: 'presenter' }, buffer: '', handled: false, restartTimer: false };
    default:
      return nothing;
  }
}

/**
 * Whether a key is one the person may expect to keep working with the shortcuts turned off.
 * @param {string} key
 */
export function isNavigationKey(key) {
  return NAVIGATION_KEYS.has(key);
}
