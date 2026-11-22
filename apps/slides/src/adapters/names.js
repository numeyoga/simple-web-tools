// Every persisted or shared name of Slides. All the apps live on one origin, so every name starts
// with the app name (decision 0005), and each one is built here, never concatenated elsewhere.
// `tests/unit/names.test.js` asserts the prefix of each name. Slides stores no document (a
// presentation is read from a folder each time and lives in memory), so it has no database and
// does not use `@simple-web-tools/storage`: the names are `<app>-<suffix>` like that package's.
//
//   localStorage      slides-theme, slides-text-size, slides-single-key-shortcuts,
//                     slides-locale (i18n package)
//   BroadcastChannel  slides-sync         main window and presenter window
//   window name       slides-presenter    the presenter window
//   Cache Storage     slides-shell-<build id>   the offline shell (@simple-web-tools/pwa)

export const APP = 'slides';

/** @param {string} suffix lowercase letters, digits and hyphens */
const storageName = (suffix) => `${APP}-${suffix}`;

/** Theme chosen in the preferences: `light` or `dark`; absent, the theme follows the system. `slides-theme`. */
export const themeKey = () => storageName('theme');

/** Text size chosen in the preferences: `standard`, `comfortable` or `large`; absent, automatic. */
export const textSizeKey = () => storageName('text-size');

/** Letter and digit shortcuts: `1` on, `0` off; absent, on. `slides-single-key-shortcuts`. */
export const singleKeyShortcutsKey = () => storageName('single-key-shortcuts');

/** Language chosen in the preferences: `en` or `fr`; absent, the browser's language. `slides-locale`. */
export const localeKey = () => storageName('locale');

/** BroadcastChannel between the main window and the presenter window: `slides-sync`. */
export const channelName = () => storageName('sync');

/** Name given to the presenter window, so that opening it twice reuses it: `slides-presenter`. */
export const presenterWindowName = () => storageName('presenter');
