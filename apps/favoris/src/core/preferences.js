// Display preferences: what a stored value means. Pure functions: reading and writing the
// storage, and applying the result to the page, belong to adapters/preferences.js.

/** @typedef {'light' | 'dark'} Theme */
/** @typedef {'auto' | 'standard' | 'comfortable' | 'large'} TextSize */

/**
 * The theme a stored value stands for. `null` is the system theme: nothing is stored for it.
 * @param {string | null | undefined} raw
 * @returns {Theme | null}
 */
export function parseTheme(raw) {
  return raw === 'light' || raw === 'dark' ? raw : null;
}

/**
 * The text size a stored value stands for; anything else is the automatic size.
 * @param {string | null | undefined} raw
 * @returns {TextSize}
 */
export function parseTextSize(raw) {
  return raw === 'standard' || raw === 'comfortable' || raw === 'large' ? raw : 'auto';
}

/**
 * A stored on/off preference written as `1` or `0`; anything else is the default.
 * @param {string | null | undefined} raw
 * @param {boolean} fallback
 * @returns {boolean}
 */
export function parseFlag(raw, fallback) {
  if (raw === '1') return true;
  if (raw === '0') return false;
  return fallback;
}

/**
 * The value to store for an on/off preference.
 * @param {boolean} value
 * @returns {'1' | '0'}
 */
export function formatFlag(value) {
  return value ? '1' : '0';
}

/**
 * Whether a key press may run a single-key shortcut (`N`, `/`). WCAG 2.1.4: such a
 * shortcut never fires while the user types, behind a dialog, with a modifier, on a held key,
 * or once the user turned the preference off.
 *
 * Shift is refused for a letter (`Shift+N` is not `N`) but allowed for a digit or a symbol: on
 * an AZERTY keyboard `1` and `/` are typed with Shift, and `event.key` is then the character
 * itself. Ctrl, Alt and Meta always belong to the browser or the system (AltGr reports Ctrl and
 * Alt together).
 * @param {{ enabled: boolean, key: string, ctrl: boolean, alt: boolean, meta: boolean,
 *   shift: boolean, repeat: boolean, inTextField: boolean, dialogOpen: boolean }} press
 * @returns {boolean}
 */
export function allowsSingleKeyShortcut(press) {
  if (!press.enabled) return false;
  if (press.inTextField || press.dialogOpen) return false;
  if (press.ctrl || press.alt || press.meta) return false;
  if (press.repeat) return false;
  if (press.shift && /^\p{L}$/u.test(press.key)) return false;
  return true;
}
