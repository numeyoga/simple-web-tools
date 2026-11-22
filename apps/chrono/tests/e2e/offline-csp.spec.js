// Lot B of step 4: the strict Content Security Policy and the PWA (manifest, service worker,
// offline start, update toast). The service worker needs a secure context: the suite runs against
// `vite preview` on 127.0.0.1 (see playwright.config.js).
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { saveDownload } from '@simple-web-tools/test-utils/playwright';
import { expectNoA11yViolations } from '@simple-web-tools/test-utils/axe';
import { goToSection, loadDemoData, waitForWrite } from './support.js';

/** @typedef {import('@playwright/test').Page} Page */

test.use({ locale: 'en-US', reducedMotion: 'reduce' });

/**
 * Collects what the browser reports about the page: CSP violations (the event of the document
 * and the console message), page errors and requests that leave the origin.
 * @param {Page} page
 */
async function watchPage(page) {
  /** @type {string[]} */
  const violations = [];
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const external = [];
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      // Read back through the exposed function below: it lives outside the page's own scripts.
      /** @type {any} */ (window).__reportCsp(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  await page.exposeFunction('__reportCsp', (/** @type {string} */ text) => violations.push(text));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) errors.push(m.text());
  });
  page.on('request', (request) => {
    const { protocol, origin } = new URL(request.url());
    if (/^https?:$/.test(protocol) && origin !== 'http://127.0.0.1:4174') external.push(origin);
  });
  return { violations, errors, external };
}

/** Waits until the service worker controls the page. @param {Page} page */
async function waitForController(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(undefined), {
          once: true,
        }),
      );
    }
  });
}

test.describe('strict Content Security Policy', () => {
  test('the build carries the policy, as a meta tag and as a header of the preview', async ({
    page,
  }) => {
    const response = await page.goto('/');
    const header = response?.headers()['content-security-policy'] ?? '';
    const meta =
      (await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')) ??
      '';
    expect(meta).toBe(header);
    for (const directive of [
      "default-src 'none'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self'",
      "font-src 'self'",
      "connect-src 'self'",
      "worker-src 'self'",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-src 'none'",
    ]) {
      expect(meta.split('; ')).toContain(directive);
    }
    // Nothing inline: no 'unsafe-inline', no 'unsafe-eval', no wildcard, no remote host.
    expect(meta).not.toMatch(/unsafe-|\*|https?:/);
    // And the page has no inline script or handler for the policy to refuse.
    expect(await page.locator('script:not([src])').count()).toBe(0);
    expect(await page.locator('[onclick], [onload], [onerror]').count()).toBe(0);
    expect(await page.locator('style').count()).toBe(0);
  });

  test('the policy refuses inline code and other origins (the watcher does see violations)', async ({
    page,
  }) => {
    const { violations } = await watchPage(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Timeline' })).toBeVisible();
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'window.__inlineRan = true';
      document.head.append(script);
      const style = document.createElement('style');
      style.textContent = 'body { outline: 5px solid red }';
      document.head.append(style);
      document.body.insertAdjacentHTML('beforeend', '<img src="https://example.com/x.png">');
    });
    await expect.poll(() => violations.length).toBeGreaterThanOrEqual(3);
    expect(violations.join('\n')).toMatch(/script-src-elem/);
    expect(violations.join('\n')).toMatch(/style-src-elem/);
    expect(violations.join('\n')).toMatch(/img-src https:\/\/example\.com/);
    expect(await page.evaluate(() => /** @type {any} */ (window).__inlineRan)).toBeUndefined();
  });

  test('no violation on the four views, the dialogs and the downloads', async ({ page }) => {
    const { violations, errors, external } = await watchPage(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Timeline' })).toBeVisible();
    await loadDemoData(page);
    const main = page.getByRole('main');

    // The four views, with data.
    await expect(main.getByText('Website redesign — Orion SAS').first()).toBeVisible();
    for (const [label, heading] of [
      ['To-dos', 'To-dos'],
      ['Projects', 'Projects'],
      ['Report', 'Report'],
      ['Timeline', 'Timeline'],
    ]) {
      await goToSection(page, label);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    }

    // The dialogs.
    await page.getByRole('button', { name: 'Start another timer' }).click();
    await expect(page.getByRole('dialog', { name: 'Add a timer' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Preferences' }).click();
    await expect(page.getByRole('dialog', { name: 'Preferences' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Workspace/ }).click();
    const workspaces = page.getByRole('dialog', { name: 'Workspaces' });
    await expect(workspaces).toBeVisible();

    // The JSON download (a blob: link).
    const jsonDownload = page.waitForEvent('download');
    await workspaces.getByRole('button', { name: 'Export JSON' }).click();
    const json = JSON.parse(
      (await readFile(await saveDownload(await jsonDownload))).toString('utf8'),
    );
    expect(json).toMatchObject({ app: 'chrono', format: 'chrono-workspace' });
    await page.keyboard.press('Escape');

    // The CSV download.
    await goToSection(page, 'Report');
    const csvDownload = page.waitForEvent('download');
    await page.getByRole('main').getByRole('button', { name: 'Export CSV' }).click();
    const csv = (await readFile(await saveDownload(await csvDownload))).toString('utf8');
    expect(csv).toContain('"Date","Project"');

    expect(violations).toEqual([]);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
});

test.describe('PWA', () => {
  test('the web app manifest is English, relative and its icons exist', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe('./manifest.webmanifest');
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest).toMatchObject({
      name: 'Chrono',
      start_url: './',
      scope: './',
      display: 'standalone',
    });
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith('./')).toBe(true);
      expect((await request.get(`/${icon.src.slice(2)}`)).ok()).toBe(true);
    }
    expect(manifest.icons.map((/** @type {{ sizes: string }} */ i) => i.sizes)).toEqual(
      expect.arrayContaining(['192x192', '512x512']),
    );
  });

  test('the service worker is scoped to the app, caches under chrono- and starts offline', async ({
    context,
    page,
  }) => {
    const { violations, errors, external } = await watchPage(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Timeline' })).toBeVisible();
    await waitForController(page);

    const info = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return {
        scope: registration.scope,
        script: registration.active?.scriptURL,
        caches: await caches.keys(),
      };
    });
    expect(info.scope).toBe('http://127.0.0.1:4174/');
    expect(info.script).toBe('http://127.0.0.1:4174/sw.js');
    expect(info.caches.length).toBeGreaterThan(0);
    expect(info.caches.every((name) => name.startsWith('chrono-'))).toBe(true);

    // The shell holds what the build manifest lists, and nothing from another origin.
    const precached = JSON.parse(
      (await (await page.request.get('/precache-manifest.json')).body()).toString('utf8'),
    );
    const cached = await page.evaluate(async () => {
      const [name] = await caches.keys();
      const cache = await caches.open(name ?? '');
      return (await cache.keys()).map((r) => new URL(r.url).pathname);
    });
    expect(cached.length).toBe(precached.length);
    expect(cached).toContain('/index.html');
    expect(cached.some((path) => /^\/assets\/index-.*\.js$/.test(path))).toBe(true);
    expect(cached.some((path) => path.endsWith('.woff2'))).toBe(true);

    // Data written online, then the app reloads with no network at all.
    await loadDemoData(page);
    await waitForWrite(page, 'projects', 'name', 'Website redesign — Orion SAS');
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Timeline' })).toBeVisible();
    await expect(
      page.getByRole('main').getByText('Website redesign — Orion SAS').first(),
    ).toBeVisible();
    // Icons and fonts come from the cache too: a view that uses them renders without error.
    await goToSection(page, 'Projects');
    await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();
    await expectNoA11yViolations(page);
    await context.setOffline(false);

    expect(violations).toEqual([]);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('an old Chrono cache is deleted on update; the caches of other apps are left alone', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForController(page);
    await page.evaluate(async () => {
      await caches.open('chrono-shell-oldbuild');
      await caches.open('locavern-shell-v4');
    });
    // A new worker (another URL, same scope) installs, waits, and is activated on request.
    await page.evaluate(() => navigator.serviceWorker.register('./sw.js?v=2', { scope: './' }));
    await expect(
      page.getByRole('status').filter({ hasText: 'A new version is ready' }),
    ).toBeVisible();
    await Promise.all([
      page.waitForEvent('load'),
      page.getByRole('button', { name: 'Reload', exact: true }).click(),
    ]);
    await waitForController(page);
    await expect
      .poll(() => page.evaluate(() => caches.keys()))
      .not.toContain('chrono-shell-oldbuild');
    const names = await page.evaluate(() => caches.keys());
    expect(names).toContain('locavern-shell-v4');
    expect(names.filter((name) => name.startsWith('chrono-'))).toHaveLength(1);
    // Clean up the cache of the other app that this test made up.
    await page.evaluate(() => caches.delete('locavern-shell-v4'));
  });

  test('a message from a page outside the worker scope does not activate a waiting worker', async ({
    context,
    page,
  }) => {
    await page.goto('/');
    await waitForController(page);
    // Two workers on a narrower scope (`/assets/`). A tab inside that scope keeps the first one
    // busy, so the second waits. The tab at `/` is outside the scope, like a page of another app
    // on the shared origin; the tab in `/assets/` is a page of this app.
    const manifest = JSON.parse(
      (await (await page.request.get('/precache-manifest.json')).body()).toString('utf8'),
    );
    const asset = manifest.find((/** @type {string} */ f) => /^\.?\/?assets\/.*\.css$/.test(f));
    const waitUntil = () =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration('./assets/');
        return registration?.waiting?.scriptURL ?? null;
      });
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.register('./sw.js?v=3', {
        scope: './assets/',
      });
      while (!registration.active) await new Promise((resolve) => setTimeout(resolve, 50));
    });
    const inside = await context.newPage();
    await inside.goto(`/${asset.replace(/^\.?\//, '')}`);
    await inside.evaluate(async () => {
      while (!navigator.serviceWorker.controller) await new Promise((r) => setTimeout(r, 50));
    });
    await page.evaluate(() =>
      navigator.serviceWorker.register('./sw.js?v=4', { scope: './assets/' }),
    );
    await expect.poll(waitUntil).toContain('sw.js?v=4');

    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration('./assets/');
      registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    });
    await page.waitForTimeout(1500);
    expect(await waitUntil()).toContain('sw.js?v=4'); // ignored: still waiting

    // The same message from a page inside the scope is accepted.
    await inside.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration('./assets/');
      registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    });
    await expect.poll(waitUntil).toBeNull();
    const active = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration('./assets/');
      return registration?.active?.scriptURL;
    });
    expect(active).toContain('sw.js?v=4');
  });

  test('a toast offers to reload when a new version is waiting, and reloads on request', async ({
    page,
  }) => {
    const { errors } = await watchPage(page);
    await page.goto('/');
    await waitForController(page);
    await expect(page.getByText('A new version is ready')).toHaveCount(0);

    await page.evaluate(() => navigator.serviceWorker.register('./sw.js?v=2', { scope: './' }));
    const toast = page.getByRole('status').filter({ hasText: 'A new version is ready' });
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Reload Chrono to use it.');
    // It stays until the person acts (no timeout).
    await page.waitForTimeout(6500);
    await expect(toast).toBeVisible();

    await Promise.all([
      page.waitForEvent('load'),
      toast.getByRole('button', { name: 'Reload', exact: true }).click(),
    ]);
    await expect(page.getByRole('heading', { level: 1, name: 'Timeline' })).toBeVisible();
    const controller = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL);
    expect(controller).toContain('sw.js?v=2');
    expect(errors).toEqual([]);
  });

  test.describe('in French', () => {
    test.use({ locale: 'fr-FR' });

    test('the update toast is translated', async ({ page }) => {
      await page.goto('/');
      await waitForController(page);
      await page.evaluate(() => navigator.serviceWorker.register('./sw.js?v=2', { scope: './' }));
      const toast = page.getByRole('status').filter({ hasText: 'Une nouvelle version est prête' });
      await expect(toast).toBeVisible();
      await expect(toast).toContainText('Elle est déjà disponible hors ligne.');
      await expect(toast.getByRole('button', { name: 'Recharger', exact: true })).toBeVisible();
    });
  });
});
