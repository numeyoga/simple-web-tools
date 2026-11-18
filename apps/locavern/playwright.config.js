import { createPlaywrightConfig } from '@simple-web-tools/test-utils/playwright';

// Keep the port in sync with the `preview` script in package.json.
export default createPlaywrightConfig({ port: 4173 });
