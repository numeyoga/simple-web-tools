// The slide HTML is the person's file, but it can be someone else's: what raw HTML in `slides.md`
// can do is limited to what the sanitizer lets through, and the policy is the second line of defence.
// The fixture folder `tests/fixtures/sanitizer` holds the hostile slide; it is loaded the way a
// person loads a folder.
import { expect, test } from '@playwright/test';
import { chooseFolder, expectSlide, slide, watchPage } from './support.js';

test('a hostile slide runs no script, keeps no handler, no unsafe address, no form and no frame', async ({
  page,
}) => {
  const { violations, errors, external } = await watchPage(page);
  await page.goto('/');
  await chooseFolder(page, 'sanitizer');
  await expectSlide(page, 1);
  await expect(slide(page).getByRole('heading', { name: 'Hostile slide' })).toBeVisible();
  // Give a handler that slipped through time to fire (a broken image fails at once).
  await page.waitForTimeout(300);

  // Nothing ran.
  expect(await page.evaluate(() => /** @type {any} */ (window).__pwned)).toBeUndefined();
  // Nothing dangerous is left in the slide.
  const content = slide(page);
  for (const selector of [
    'script',
    'iframe',
    'form',
    'input',
    'button',
    'svg',
    '[onerror]',
    '[onclick]',
    '[onmouseover]',
    '[onload]',
    '[style]',
    '[srcset]',
  ]) {
    expect(await content.locator(selector).count(), selector).toBe(0);
  }
  const hrefs = await content.locator('a').evaluateAll((links) =>
    links.map((link) => ({
      text: link.textContent,
      href: link.getAttribute('href'),
      target: link.getAttribute('target'),
      rel: link.getAttribute('rel'),
    })),
  );
  // `javascript:` addresses are gone, and the safe link opens elsewhere with no opener.
  expect(hrefs.every((link) => !/^\s*javascript:/i.test(link.href ?? ''))).toBe(true);
  expect(hrefs.find((link) => link.text === 'markdown link')?.href).toBeNull();
  expect(hrefs.find((link) => link.text === 'mixed case')?.href).toBeNull();
  expect(hrefs.find((link) => link.text === 'a safe link')).toEqual({
    text: 'a safe link',
    href: 'https://example.org/page',
    target: '_blank',
    rel: 'noopener noreferrer',
  });

  // The CSP had nothing to refuse: the sanitizer stopped it all first (no inline handler, no frame,
  // no request to another origin).
  expect(violations).toEqual([]);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('images: the folder image is shown from an object URL, the others get a placeholder that says why', async ({
  page,
}) => {
  const { violations, external } = await watchPage(page);
  await page.goto('/');
  await chooseFolder(page, 'sanitizer');
  await expectSlide(page, 1);

  const images = slide(page).locator('img');
  await expect(images).toHaveCount(1);
  await expect(images.first()).toHaveAttribute('alt', 'local image');
  expect(await images.first().getAttribute('src')).toMatch(/^blob:http:\/\/127\.0\.0\.1:4178\//);
  await expect
    .poll(() =>
      images.first().evaluate((image) => /** @type {HTMLImageElement} */ (image).naturalWidth),
    )
    .toBe(16);

  const remote = slide(page).locator('.sl-blocked[data-reason="remote"]');
  await expect(remote).toContainText('Image du web non chargée');
  await expect(remote).toContainText('Slides ne contacte jamais d’autres sites');
  await expect(remote).toContainText('https://example.com/tracker.png');
  const missing = slide(page)
    .locator('.sl-blocked[data-reason="missing"]')
    .filter({ hasText: 'assets/nope.png' });
  await expect(missing).toContainText('Image introuvable dans le dossier');
  await expect(missing).toContainText('assets/nope.png');
  // The `<img src="x">` of the hostile markup is not a request either: it became a placeholder.
  await expect(slide(page).locator('.sl-blocked[data-reason="missing"]')).toHaveCount(2);

  expect(violations).toEqual([]);
  expect(external).toEqual([]);
});

test('the presenter notes are cleaned too', async ({ context, page }) => {
  await page.goto('/');
  await chooseFolder(page, 'sanitizer');
  await expectSlide(page, 1);

  const presenter = await context.newPage();
  await presenter.goto('/?view=presenter');
  await expect(presenter.getByTestId('notes-presenter')).toContainText('Careful notes.');
  await presenter.waitForTimeout(300);

  expect(await presenter.getByTestId('notes-presenter').locator('[onerror], img').count()).toBe(0);
  expect(await presenter.evaluate(() => /** @type {any} */ (window).__pwned)).toBeUndefined();
  expect(await page.evaluate(() => /** @type {any} */ (window).__pwned)).toBeUndefined();
});

test('another page of the origin cannot push HTML or a remote image into the presenter window', async ({
  context,
  page,
}) => {
  await page.goto('/');
  await chooseFolder(page, 'plain');
  await expectSlide(page, 1);
  const presenter = await context.newPage();
  const { violations, external } = await watchPage(presenter);
  await presenter.goto('/?view=presenter');
  await expect(presenter.getByTestId('counter')).toHaveText('1 / 4');

  // Any page of the origin can post on the channel. A malformed message is dropped, and a
  // well-formed one still goes through the sanitizer.
  await page.evaluate(() => {
    const channel = new BroadcastChannel('slides-sync');
    channel.postMessage({ type: 'STATE', presentation: { slides: [] }, currentIndex: 0 });
    channel.postMessage({
      type: 'STATE',
      presentation: {
        meta: { title: 'Forged', description: '', author: '', theme: 'dark', ratio: 'fixed' },
        slides: [
          {
            index: 0,
            html: '<h1>Forged</h1><img src="https://evil.example/x.png" onerror="window.__pwned=1">',
            notes: { public: '', presenter: '' },
            meta: { title: 'Forged', description: '' },
          },
        ],
      },
      assets: {},
      currentIndex: 0,
    });
  });

  await expect(
    presenter.getByTestId('slide').getByRole('heading', { name: 'Forged' }),
  ).toBeVisible();
  await expect(presenter.locator('.sl-blocked[data-reason="remote"]')).toBeVisible();
  await presenter.waitForTimeout(200);
  expect(await presenter.evaluate(() => /** @type {any} */ (window).__pwned)).toBeUndefined();
  expect(violations).toEqual([]);
  expect(external).toEqual([]);
});
