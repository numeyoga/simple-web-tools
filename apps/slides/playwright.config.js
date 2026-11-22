import { createPlaywrightConfig } from '@simple-web-tools/test-utils/playwright';

// Keep the port in sync with the `preview` script in package.json (4173 is Locavern, 4174 is
// Chrono, 4175 is Transient Notes, 4176 is Favoris, 4177 is Dashboard).
const config = createPlaywrightConfig({ port: 4178 });

// The suites are written against the French interface, and the interface follows the browser's
// language: Chromium's default is `en-US`. They run in French; i18n.spec.js picks other
// languages for its own tests with `test.use({ locale })`.
export default { ...config, use: { ...config.use, locale: 'fr-FR' } };
