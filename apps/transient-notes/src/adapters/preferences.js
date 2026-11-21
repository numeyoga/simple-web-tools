// Display preferences kept in localStorage: theme, text size and single-key shortcuts. Every
// name starts with the app name (decision 0005). Reads and writes never throw: a browser that
// refuses the storage keeps the defaults for the session. `public/theme-init.js` applies the
// theme and the text size before the first paint; this module does it again when the user
// changes them.

import {
  formatCollapsedCategories,
  formatFlag,
  parseCollapsedCategories,
  parseFlag,
  parseTextSize,
  parseTheme,
} from '../core/preferences.js';
import { collapsedCategoriesKey, singleKeyShortcutsKey, textSizeKey, themeKey } from './names.js';

/** @typedef {import('../core/preferences.js').Theme} Theme */
/** @typedef {import('../core/preferences.js').TextSize} TextSize */

/** @param {string} key */
function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * @param {string} key
 * @param {string | null} value `null` removes the key
 */
function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // The preference applies for this session only.
  }
}

/* ---------------- Theme ---------------- */

/** The stored theme; `null` is the system theme. @returns {Theme | null} */
export function getTheme() {
  return parseTheme(read(themeKey()));
}

/**
 * Applies a theme to the page: `data-theme` and the `color-scheme` meta. `null` follows the
 * system, as `theme-init.js` does at load.
 * @param {Theme | null} theme
 */
export function applyTheme(theme) {
  const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme ?? system;
  document
    .querySelector('meta[name="color-scheme"]')
    ?.setAttribute('content', theme ?? 'light dark');
}

/**
 * Stores and applies a theme. The system theme stores nothing: the key is removed.
 * @param {Theme | null} theme
 */
export function setTheme(theme) {
  write(themeKey(), theme);
  applyTheme(theme);
}

/* ---------------- Text size ---------------- */

/** @returns {TextSize} */
export function getTextSize() {
  return parseTextSize(read(textSizeKey()));
}

/**
 * Stores a text size (the automatic size removes the key). Covenant applies it: the TextSize
 * control and `Covenant.setTextSize` write `data-text-size` and fire `cv:textsize`.
 * @param {string} size
 */
export function storeTextSize(size) {
  const parsed = parseTextSize(size);
  write(textSizeKey(), parsed === 'auto' ? null : parsed);
}

/* ---------------- Single-key shortcuts ---------------- */

/** On by default. */
export function getSingleKeyShortcuts() {
  return parseFlag(read(singleKeyShortcutsKey()), true);
}

/** @param {boolean} enabled */
export function setSingleKeyShortcuts(enabled) {
  write(singleKeyShortcutsKey(), formatFlag(enabled));
}

/* ---------------- Folded categories of the tree ---------------- */

/**
 * The categories of the tree the user folded in a workspace.
 * @param {string} workspaceId
 */
export function getCollapsedCategories(workspaceId) {
  return parseCollapsedCategories(read(collapsedCategoriesKey(workspaceId)));
}

/**
 * Remembers the folded categories of a workspace; none folded removes the key.
 * @param {string} workspaceId
 * @param {Iterable<string>} collapsed
 */
export function setCollapsedCategories(workspaceId, collapsed) {
  const value = formatCollapsedCategories(collapsed);
  write(collapsedCategoriesKey(workspaceId), value === '[]' ? null : value);
}

/* ---------------- Page and other tabs ---------------- */

/**
 * Keeps the page in step with the system theme (while the theme is the system one) and with a
 * change made in another tab, and stores the text size each time Covenant applies one.
 */
export function watchPreferences() {
  document.addEventListener('cv:textsize', (event) => {
    storeTextSize(/** @type {CustomEvent<{ size: string }>} */ (event).detail.size);
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getTheme() === null) applyTheme(null);
  });
  window.addEventListener('storage', (event) => {
    if (event.key === themeKey()) applyTheme(parseTheme(event.newValue));
    if (event.key === textSizeKey()) window.Covenant?.setTextSize?.(parseTextSize(event.newValue));
  });
}
