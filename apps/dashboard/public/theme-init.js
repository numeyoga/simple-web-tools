// Runs before the first paint (a classic script in <head>, never inline: the CSP forbids it).
// `dashboard-theme` is `light` or `dark`; absent, the theme follows `prefers-color-scheme`.
// `dashboard-text-size` is `standard`, `comfortable` or `large`; absent, the size is automatic.
// `dashboard-density` is `compact`; absent, the density is comfortable (no attribute).
// `dashboard-locale` is `en` or `fr`; absent, `<html lang>` follows the first language of the browser
// that the interface speaks (`fr`, `fr-CA`... French, `en`...), else English. The same rule as
// negotiateLocale in src/adapters/i18n.js, which sets the language again once the app starts.
// Every storage name starts with the app name (decision 0005). The preferences dialog changes
// them (src/adapters/preferences.js, which builds the same names).
(() => {
  const THEME_STORAGE_KEY = 'dashboard-theme';
  /** @type {string | null} */
  let storedTheme = null;
  try {
    storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // Ignore storage access errors in restricted contexts.
  }
  const themeOverride = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : null;
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.setAttribute('content', themeOverride ?? 'light dark');
  }
  const prefersDark =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = themeOverride ?? (prefersDark ? 'dark' : 'light');

  const TEXT_SIZE_STORAGE_KEY = 'dashboard-text-size';
  /** @type {string | null} */
  let storedTextSize = null;
  try {
    storedTextSize = localStorage.getItem(TEXT_SIZE_STORAGE_KEY);
  } catch {
    // Ignore storage access errors in restricted contexts.
  }
  if (
    storedTextSize === 'standard' ||
    storedTextSize === 'comfortable' ||
    storedTextSize === 'large'
  ) {
    document.documentElement.dataset.textSize = storedTextSize;
  } else {
    delete document.documentElement.dataset.textSize;
  }

  const DENSITY_STORAGE_KEY = 'dashboard-density';
  /** @type {string | null} */
  let storedDensity = null;
  try {
    storedDensity = localStorage.getItem(DENSITY_STORAGE_KEY);
  } catch {
    // Ignore storage access errors in restricted contexts.
  }
  if (storedDensity === 'compact') {
    document.documentElement.dataset.density = 'compact';
  } else {
    delete document.documentElement.dataset.density;
  }

  const LOCALE_STORAGE_KEY = 'dashboard-locale';
  const SUPPORTED_LOCALES = ['en', 'fr'];
  /** @type {string | null} */
  let storedLocale = null;
  try {
    storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    // Ignore storage access errors in restricted contexts.
  }
  let language = storedLocale && SUPPORTED_LOCALES.includes(storedLocale) ? storedLocale : null;
  if (!language) {
    for (const tag of navigator.languages || []) {
      const base = String(tag).toLowerCase().split(/[-_]/)[0] ?? '';
      if (SUPPORTED_LOCALES.includes(base)) {
        language = base;
        break;
      }
    }
  }
  // With the region of the browser when it gives one for that language (`en-GB`), as the
  // translator's locale (resolveFormatLocale in src/core/locale.js).
  let tag = language || 'en';
  for (const entry of navigator.languages || []) {
    let canonical = null;
    try {
      canonical = Intl.getCanonicalLocales(String(entry).replace(/_/g, '-'))[0] ?? null;
    } catch {
      // Not a language tag: skipped.
    }
    if (canonical && (canonical.split('-')[0] ?? '').toLowerCase() === tag) {
      tag = canonical;
      break;
    }
  }
  document.documentElement.lang = tag;
})();
