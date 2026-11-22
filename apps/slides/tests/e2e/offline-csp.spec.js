// The strict Content Security Policy and the PWA (manifest, service worker, offline start). The
// service worker needs a secure context: the suite runs against `vite preview` on 127.0.0.1 (see
// playwright.config.js).
import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from '@simple-web-tools/test-utils/axe';
import { chooseFolder, expectSlide, loadExample, watchPage } from './support.js';

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
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob:",
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
    // The one 'unsafe-inline' of the app is for styles (Mermaid's SVG). Scripts are as strict as
    // anywhere: no 'unsafe-inline', no 'unsafe-eval'. No wildcard, no data: and no host at all: the
    // app makes no third-party request.
    expect(meta.match(/'unsafe-[a-z-]+'/g)).toEqual(["'unsafe-inline'"]);
    expect(meta).not.toMatch(/unsafe-eval|\*|data:/);
    expect(meta.match(/https?:\/\/[^\s;]+/g)).toBeNull();
    // And the page has no inline script or handler for the policy to refuse.
    expect(await page.locator('script:not([src])').count()).toBe(0);
    expect(await page.locator('[onclick], [onload], [onerror]').count()).toBe(0);
    expect(await page.locator('style').count()).toBe(0);
  });

  test('the policy refuses inline script, other origins and data: images (the watcher does see violations)', async ({
    page,
  }) => {
    const { violations } = await watchPage(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'window.__inlineRan = true';
      document.head.append(script);
      const remote = document.createElement('img');
      remote.src = 'https://example.com/x.png';
      const inline = document.createElement('img');
      inline.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
      document.body.append(remote, inline);
    });
    await expect.poll(() => violations.length).toBeGreaterThanOrEqual(3);
    expect(violations.join('\n')).toMatch(/script-src-elem/);
    expect(violations.join('\n')).toMatch(/img-src https:\/\/example\.com/);
    expect(violations.join('\n')).toMatch(/img-src data/);
    expect(await page.evaluate(() => /** @type {any} */ (window).__inlineRan)).toBeUndefined();
  });

  test('a whole journey raises no violation, no error and no request outside the origin', async ({
    context,
    page,
  }) => {
    const { violations, errors, external } = await watchPage(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await loadExample(page);
    // A diagram, an image of the folder, the overview, the preferences, the presenter window, print.
    await page.keyboard.press('2');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('slide').getByRole('img')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('pre.mermaid[data-drawn]')).toBeVisible();
    await page.keyboard.press('o');
    await expect(page.getByRole('dialog', { name: 'Vue d’ensemble' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Préférences' }).click();
    await expect(page.getByRole('dialog', { name: 'Préférences' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      window.print = () => {};
    });
    await page.getByRole('button', { name: 'Imprimer' }).click();
    await expect(page.locator('.sl-print__page pre.mermaid[data-drawn]')).toHaveCount(1);

    const presenter = await context.newPage();
    const presenterWatch = await watchPage(presenter);
    await presenter.goto('/?view=presenter');
    await expect(presenter.getByTestId('counter')).toHaveText('4 / 6');
    await expect(presenter.locator('pre.mermaid[data-drawn]')).toBeVisible();

    expect(violations).toEqual([]);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    expect(presenterWatch.violations).toEqual([]);
    expect(presenterWatch.errors).toEqual([]);
    expect(presenterWatch.external).toEqual([]);
  });
});

test.describe('PWA', () => {
  test('the web app manifest is relative and its icons exist', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe('./manifest.webmanifest');
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest).toMatchObject({
      name: 'Slides',
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

  test('the service worker is scoped to the app, caches under slides- and starts offline, example included', async ({
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
    expect(info.scope).toBe('http://127.0.0.1:4178/');
    expect(info.script).toBe('http://127.0.0.1:4178/sw.js');
    expect(info.caches.length).toBeGreaterThan(0);
    expect(info.caches.every((name) => name.startsWith('slides-'))).toBe(true);

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
    // The two examples are lazy chunks, and are precached with the rest.
    expect(cached.some((path) => /^\/assets\/en-.*\.js$/.test(path))).toBe(true);
    expect(cached.some((path) => /^\/assets\/fr-.*\.js$/.test(path))).toBe(true);

    // Offline: the app starts, the example loads, a folder is read, a diagram is drawn.
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ouvrir une présentation');
    await expectNoA11yViolations(page);
    await loadExample(page);
    await page.keyboard.press('4');
    await page.keyboard.press('Enter');
    await expect(page.locator('pre.mermaid[data-drawn]')).toBeVisible();
    await page.getByRole('button', { name: 'Fermer la présentation' }).click();
    await chooseFolder(page, 'plain');
    await expectSlide(page, 1);
    await context.setOffline(false);

    expect(violations).toEqual([]);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
});
