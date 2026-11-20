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
 * Whether a key press may run a single-key shortcut (Space, N, S). WCAG 2.1.4: such a shortcut
 * never fires while the user types, behind a dialog, with a modifier, on a held key, or once the
 * user turned the preference off. Space also keeps its native job on a button, a link or a
 * control that has a role of its own.
 * @param {{ enabled: boolean, key: string, ctrl: boolean, alt: boolean, meta: boolean,
 *   shift: boolean, repeat: boolean, inTextField: boolean, dialogOpen: boolean,
 *   onActivatable: boolean }} press
 * @returns {boolean}
 */
export function allowsSingleKeyShortcut(press) {
  if (!press.enabled) return false;
  if (press.inTextField || press.dialogOpen) return false;
  if (press.ctrl || press.alt || press.meta || press.shift) return false;
  if (press.repeat) return false;
  if (press.key === ' ' && press.onActivatable) return false;
  return true;
}
