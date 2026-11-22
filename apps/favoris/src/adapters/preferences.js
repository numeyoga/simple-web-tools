// Display preferences kept in localStorage: theme, text size, single-key shortcuts and the site icons. Every
// name starts with the app name (decision 0005). Reads and writes never throw: a browser that
// refuses the storage keeps the defaults for the session. `public/theme-init.js` applies the
// theme and the text size before the first paint; this module does it again when the user
// changes them.

import { formatFlag, parseFlag, parseTextSize, parseTheme } from '../core/preferences.js';
import { singleKeyShortcutsKey, siteIconsKey, textSizeKey, themeKey } from './names.js';

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

/* ---------------- Site icons from Google (decision 0008) ---------------- */

/** Off by default: no request leaves the page until the person turns it on. */
export function getSiteIcons() {
  return parseFlag(read(siteIconsKey()), false);
}

/**
 * Stores the choice and tells the views, which draw the icons again: the requests start or stop
 * at once.
 * @param {boolean} enabled
 */
export function setSiteIcons(enabled) {
  write(siteIconsKey(), formatFlag(enabled));
  document.dispatchEvent(new CustomEvent(SITE_ICONS_EVENT));
}

/** Fired on `document` when the site icons preference changed, here or in another tab. */
export const SITE_ICONS_EVENT = 'favoris:site-icons';

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
    if (event.key === siteIconsKey()) document.dispatchEvent(new CustomEvent(SITE_ICONS_EVENT));
  });
}
