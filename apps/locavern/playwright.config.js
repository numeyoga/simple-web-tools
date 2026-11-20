import { createPlaywrightConfig } from '@simple-web-tools/test-utils/playwright';

// Keep the port in sync with the `preview` script in package.json.
const config = createPlaywrightConfig({ port: 4173 });

// The suites were written against the French interface, and the interface follows the browser's
// language: Chromium's default is `en-US`. They run in French; i18n.spec.js picks other
// languages for its own tests with `test.use({ locale })`.
export default { ...config, use: { ...config.use, locale: 'fr-FR' } };
