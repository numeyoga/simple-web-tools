// Mermaid diagrams: drawn on demand from a lazy chunk, with `securityLevel: 'strict'`, under a policy
// that has 'unsafe-inline' for styles and no 'unsafe-eval'.
import { expect, test } from '@playwright/test';
import { chooseFolder, expectSlide, loadExample, slide, watchPage } from './support.js';

test.use({ reducedMotion: 'reduce' });

/** The requests for Mermaid's own files: its core and its diagram chunks. @param {string} url */
const isMermaidChunk = (url) => /\/assets\/(mermaid\.core|[a-zA-Z]+Diagram)-/.test(url);

test('Mermaid is not loaded until a slide with a diagram is shown, then draws it with no policy violation', async ({
  page,
}) => {
  const { violations, errors, external } = await watchPage(page);
  /** @type {string[]} */
  const chunks = [];
  page.on('request', (request) => {
    if (isMermaidChunk(request.url())) chunks.push(new URL(request.url()).pathname);
  });
  await page.goto('/');
  await loadExample(page);

  // Slides 1 to 3 hold no diagram: the library stays on the server.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expectSlide(page, 3);
  expect(chunks).toEqual([]);

  await page.keyboard.press('ArrowRight');
  await expectSlide(page, 4);
  const diagram = slide(page).locator('pre.mermaid');
  await expect(diagram).toHaveAttribute('data-drawn', '');
  await expect(diagram.locator('svg')).toBeVisible();
  await expect(diagram).toContainText('Contrôleur');
  await expect(diagram).toContainText('Adaptateur JPA');
  expect(chunks.some((path) => path.includes('mermaid.core'))).toBe(true);

  // The diagram has its own colours and a real size: the inline styles of its SVG are applied.
  const box = await diagram.locator('svg').boundingBox();
  expect(box?.width).toBeGreaterThan(200);
  expect(box?.height).toBeGreaterThan(50);
  const fill = await diagram
    .locator('svg .node rect, svg .node polygon, svg .node path')
    .first()
    .evaluate((node) => getComputedStyle(node).fill);
  expect(fill).not.toBe('rgb(0, 0, 0)');

  // No 'unsafe-eval' in the policy, and nothing complained: no violation, no error, no request out.
  expect(violations).toEqual([]);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('the diagram follows the theme of the slides: light slides, light diagram', async ({
  page,
}) => {
  await page.goto('/');
  await chooseFolder(page, 'mermaid-light');
  await expectSlide(page, 1);

  const diagram = slide(page).locator('pre.mermaid');
  await expect(diagram).toHaveAttribute('data-drawn', '');
  const [fills, slideColor] = await Promise.all([
    diagram
      .locator('.node rect, .node path, .node polygon')
      .evaluateAll((nodes) => nodes.map((n) => getComputedStyle(n).fill)),
    page.locator('.sl-slide').evaluate((n) => getComputedStyle(n).backgroundColor),
  ]);
  // The default Mermaid theme has pale nodes on a light slide.
  expect(fills.some((fill) => /^rgb\((2[0-9]{2}|1[89][0-9]), /.test(fill))).toBe(true);
  expect(slideColor).toMatch(/^rgb\(2[0-9]{2}/);
});

test('a diagram that cannot be drawn keeps its code on screen, with a message, and the next one is drawn', async ({
  page,
}) => {
  await page.goto('/');
  await chooseFolder(page, 'mermaid-broken');
  await expectSlide(page, 1);

  const diagrams = slide(page).locator('pre.mermaid');
  await expect(diagrams.nth(1).locator('svg')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Ce diagramme n’a pas pu être dessiné');
  await expect(diagrams.nth(0)).toContainText('this is not a diagram');
  await expect(diagrams.nth(0).locator('svg')).toHaveCount(0);
  // Mermaid leaves nothing behind in the page: its temporary elements are gone.
  expect(await page.locator('body > [id^="dmermaid"], body > [id^="mermaid"]').count()).toBe(0);
});

test('a diagram written in the slide HTML cannot run script: labels are cleaned by strict mode', async ({
  page,
}) => {
  const { violations } = await watchPage(page);
  await page.goto('/');
  await chooseFolder(page, 'mermaid-hostile');
  await expectSlide(page, 1);
  await expect(
    slide(page).locator('pre.mermaid[data-processed], pre.mermaid[data-failed]'),
  ).toBeVisible();

  expect(await page.evaluate(() => /** @type {any} */ (window).__pwned)).toBeUndefined();
  expect(await slide(page).locator('[onerror], [onclick]').count()).toBe(0);
  expect(violations.filter((v) => /script-src/.test(v))).toEqual([]);
});

test('the lazy chunks are in the offline manifest, and a diagram is drawn with no network', async ({
  context,
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
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

  const manifest = /** @type {string[]} */ (
    JSON.parse((await (await page.request.get('/precache-manifest.json')).body()).toString('utf8'))
  );
  expect(manifest.some((path) => /\/mermaid\.core-[^/]+\.js$/.test(path))).toBe(true);
  expect(manifest.filter((path) => /Diagram-[^/]+\.js$/.test(path)).length).toBeGreaterThan(10);
  const cached = await page.evaluate(async () => {
    const [name] = await caches.keys();
    const cache = await caches.open(name ?? '');
    return (await cache.keys()).map((r) => new URL(r.url).pathname);
  });
  expect(cached.length).toBe(manifest.length);

  await context.setOffline(true);
  await page.reload();
  await loadExample(page);
  await page.keyboard.press('End');
  await page.keyboard.press('Home');
  await page.keyboard.press('3');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await expectSlide(page, 4);
  await expect(slide(page).locator('pre.mermaid svg')).toBeVisible();
  await context.setOffline(false);
});

test('the example folder is the same path as a chosen folder: the diagram of a fixture is drawn too', async ({
  page,
}) => {
  await page.goto('/');
  await chooseFolder(page, 'plain');
  await page.keyboard.press('4');
  await page.keyboard.press('Enter');
  await expectSlide(page, 4);
  await expect(slide(page).locator('pre.mermaid svg')).toBeVisible();
});
