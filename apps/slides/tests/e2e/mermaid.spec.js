// Mermaid diagrams: drawn on demand from a lazy chunk, with `securityLevel: 'strict'`, under a policy
// that has 'unsafe-inline' for styles and no 'unsafe-eval'.
import { expect, test } from '@playwright/test';
import {
  cachedPaths,
  chooseFolder,
  expectSlide,
  loadExample,
  slide,
  waitForShell,
  watchPage,
} from './support.js';

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

test('Mermaid is cached on first use, not at install, and a diagram is then drawn with no network', async ({
  context,
  page,
}) => {
  /** @type {string[]} */
  const requested = [];
  page.on('request', (request) => requested.push(new URL(request.url()).pathname));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const manifest = await waitForShell(page);

  // The build leaves Mermaid out of the precache, and lists it as on demand.
  const isMermaid = (/** @type {string} */ path) =>
    /\/(mermaid\.core|[a-zA-Z]+Diagram)-/.test(path);
  expect(manifest.precache.filter(isMermaid)).toEqual([]);
  expect(manifest.precache.some((path) => /\/(cytoscape|katex|dagre|elk|d3-)/.test(path))).toBe(
    false,
  );
  expect(manifest.onDemand.some((path) => /\/mermaid\.core-[^/]+\.js$/.test(path))).toBe(true);
  expect(
    manifest.onDemand.filter((path) => /Diagram-[^/]+\.js$/.test(path)).length,
  ).toBeGreaterThan(10);
  const onDemand = new Set(manifest.onDemand.map((url) => `/${url.slice(2)}`));

  // After install: the shell is there (and the manifest, which tells the worker the list), no chunk of Mermaid.
  const atInstall = await cachedPaths(page);
  expect(atInstall.filter((path) => onDemand.has(path))).toEqual([]);
  expect(atInstall.sort()).toEqual(
    [...manifest.precache.map((url) => `/${url.slice(2)}`), '/precache-manifest.json'].sort(),
  );

  // Showing the example's diagram fetches the chunks it needs, and caches exactly those.
  await loadExample(page);
  await page.keyboard.press('4');
  await page.keyboard.press('Enter');
  await expectSlide(page, 4);
  await expect(slide(page).locator('pre.mermaid svg')).toBeVisible();
  // The chunks it asked for are the chunks it cached, exactly (some load a little after the drawing).
  const usedChunks = () => [...new Set(requested.filter((path) => onDemand.has(path)))].sort();
  expect(usedChunks().some((path) => path.includes('mermaid.core'))).toBe(true);
  await expect
    .poll(async () => {
      const cachedChunks = (await cachedPaths(page)).filter((path) => onDemand.has(path)).sort();
      return JSON.stringify(cachedChunks) === JSON.stringify(usedChunks());
    })
    .toBe(true);
  const used = usedChunks();
  expect(used.length).toBeGreaterThan(2);
  // Not the whole library: the diagram types that were not drawn stay unfetched.
  expect(used.length).toBeLessThan(onDemand.size / 2);

  // Offline, a reload and the same diagram: drawn from the cache.
  await context.setOffline(true);
  await page.reload();
  await loadExample(page);
  await page.keyboard.press('4');
  await page.keyboard.press('Enter');
  await expectSlide(page, 4);
  await expect(slide(page).locator('pre.mermaid[data-drawn] svg')).toBeVisible();
  await context.setOffline(false);
});

test('offline before any diagram was shown, the diagram keeps its code with a message, and is drawn once back online', async ({
  context,
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await waitForShell(page);
  await loadExample(page);
  await context.setOffline(true);
  await page.keyboard.press('4');
  await page.keyboard.press('Enter');
  await expectSlide(page, 4);
  await expect(page.getByRole('alert')).toContainText('Ce diagramme n’a pas pu être dessiné');
  await expect(slide(page).locator('pre.mermaid svg')).toHaveCount(0);

  await context.setOffline(false);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  await expect(slide(page).locator('pre.mermaid[data-drawn] svg')).toBeVisible();
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
