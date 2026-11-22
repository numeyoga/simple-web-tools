// The strict Content Security Policy and the PWA (manifest, service worker, offline start). The
// service worker needs a secure context: the suite runs against `vite preview` on 127.0.0.1 (see
// playwright.config.js).
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { saveDownload } from '@simple-web-tools/test-utils/playwright';
import { expectNoA11yViolations } from '@simple-web-tools/test-utils/axe';
import { loadSample, openWorkspaces, waitForWrite, watchPage } from './support.js';

/** @typedef {import('@playwright/test').Page} Page */

test.use({ reducedMotion: 'reduce' });

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
    // Nothing inline: no 'unsafe-inline', no 'unsafe-eval', no wildcard, no data: or blob:, and no
    // host at all: the app makes no third-party request.
    expect(meta).not.toMatch(/unsafe-|\*|data:|blob:/);
    expect(meta.match(/https?:\/\/[^\s;]+/g)).toBeNull();
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
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
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

  test('a whole journey raises no violation, no error and no request outside the origin', async ({
    page,
  }) => {
    const { violations, errors, external } = await watchPage(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await loadSample(page);
    await page.getByRole('button', { name: 'Éditer', exact: true }).click();
    await page.getByRole('button', { name: 'Modifier l’adresse de « Pipeline »' }).click();
    await page.getByRole('button', { name: 'Annuler' }).click();
    await page.getByRole('button', { name: 'Éditer', exact: true }).click();
    await page.getByRole('link', { name: 'Templates', exact: true }).click();
    await page.getByRole('link', { name: 'Import et export', exact: true }).click();

    // The dialogs.
    await page.getByRole('button', { name: 'Préférences' }).click();
    await expect(page.getByRole('dialog', { name: 'Préférences' })).toBeVisible();
    await page.keyboard.press('Escape');
    const workspaces = await openWorkspaces(page);
    await expect(workspaces).toBeVisible();
    await page.keyboard.press('Escape');

    // The JSON download (a blob: link, which a CSP does not govern).
    await waitForWrite(page, 'apps', 'name', 'SearchIndex');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Télécharger le fichier JSON' }).click();
    const json = JSON.parse((await readFile(await saveDownload(await download))).toString('utf8'));
    expect(json).toMatchObject({ app: 'dashboard', format: 'dashboard-workspace' });

    expect(violations).toEqual([]);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
});

test.describe('PWA', () => {
  test('the web app manifest is relative and its icons exist', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe('./manifest.webmanifest');
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest).toMatchObject({
      name: 'Dashboard',
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

  test('the service worker is scoped to the app, caches under dashboard- and starts offline', async ({
    context,
    page,
  }) => {
    const { violations, errors, external } = await watchPage(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await waitForController(page);

    const info = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return {
        scope: registration.scope,
        script: registration.active?.scriptURL,
        caches: await caches.keys(),
      };
    });
    expect(info.scope).toBe('http://127.0.0.1:4177/');
    expect(info.script).toBe('http://127.0.0.1:4177/sw.js');
    expect(info.caches.length).toBeGreaterThan(0);
    expect(info.caches.every((name) => name.startsWith('dashboard-'))).toBe(true);

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
    await loadSample(page);
    await waitForWrite(page, 'apps', 'name', 'SearchIndex');
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('AccountPortal');
    // Icons and fonts come from the cache too: the app renders without error.
    await expectNoA11yViolations(page);
    await context.setOffline(false);

    expect(violations).toEqual([]);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
});
