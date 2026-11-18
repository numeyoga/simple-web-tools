(() => {
  const THEME_STORAGE_KEY = 'locavern-color-scheme';
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

  const TEXT_SIZE_STORAGE_KEY = 'locavern-text-size';
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
