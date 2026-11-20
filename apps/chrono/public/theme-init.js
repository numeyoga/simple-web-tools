// Runs before the first paint (a classic script in <head>, never inline: the CSP forbids it).
// `chrono-theme` is `light` or `dark`; absent, the theme follows `prefers-color-scheme`.
// `chrono-text-size` is `standard`, `comfortable` or `large`; absent, the size is automatic.
// Every storage name starts with the app name (decision 0005). The interface that changes them
// comes with the preferences of the app shell.
(() => {
  const THEME_STORAGE_KEY = 'chrono-theme';
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

  const TEXT_SIZE_STORAGE_KEY = 'chrono-text-size';
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
})();
