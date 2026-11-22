// Site icons (decision 0008): a coloured initial by default and no request outside the app; only
// while "Charger les icônes des sites depuis Google" is on does each link ask
// https://www.google.com/s2/favicons for its icon, with the domain of the link and nothing else.
// The network is never reached: the requests are intercepted and answered here.
import { expect, test } from '@playwright/test';
import { addLink, watchPage, waitForWrite } from './support.js';

/** A 1 x 1 PNG picture. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const SWITCH = /^Charger les icônes des sites depuis Google/;

/** Answers the favicon service with a picture, and records what was asked. @param {import('@playwright/test').Page} page */
async function fakeGoogle(page) {
  /** @type {URL[]} */
  const asked = [];
  await page.route('https://www.google.com/**', (route) => {
    asked.push(new URL(route.request().url()));
    return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  });
  return asked;
}

/** @param {import('@playwright/test').Page} page */
async function addTwoLinks(page) {
  await addLink(page, {
    name: 'GitHub',
    url: 'https://www.github.com/numeyoga/simple-web-tools?tab=readme#top',
  });
  await addLink(page, { name: 'Exemple', url: 'http://example.org/secret/path?token=abc' });
}

test('by default each link has a coloured initial, and no request leaves the origin', async ({
  page,
}) => {
  const { external, violations, errors } = await watchPage(page);
  const asked = await fakeGoogle(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await addTwoLinks(page);
  await waitForWrite(page, 'links', 'name', 'Exemple');
  await page.reload();
  await expect(page.getByRole('link', { name: /^GitHub/ })).toBeVisible();

  await expect(page.locator('.fv-site-icon')).toHaveText(['G', 'E']);
  await expect(page.locator('.fv-site-icon__image')).toHaveCount(0);
  await expect(page.locator('img[src^="http"]')).toHaveCount(0);
  expect(external).toEqual([]);
  expect(asked).toEqual([]);
  expect(violations).toEqual([]);
  expect(errors).toEqual([]);
  // The preference is off, and says what it costs.
  expect(await page.evaluate(() => localStorage.getItem('favoris-site-icons'))).toBeNull();
  await page.getByRole('button', { name: 'Préférences' }).click();
  const dialog = page.getByRole('dialog', { name: 'Préférences' });
  await expect(dialog.getByRole('switch', { name: SWITCH })).not.toBeChecked();
  await expect(dialog.getByRole('switch', { name: SWITCH })).toHaveAccessibleName(
    /Google voit les domaines de tes liens/,
  );
});

test('turned on, each link asks Google once, for its domain only; turned off, it stops at once', async ({
  page,
}) => {
  const { external, violations } = await watchPage(page);
  const asked = await fakeGoogle(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await addTwoLinks(page);
  expect(external).toEqual([]);

  await page.getByRole('button', { name: 'Préférences' }).click();
  const dialog = page.getByRole('dialog', { name: 'Préférences' });
  await dialog.getByRole('switch', { name: SWITCH }).check();

  await expect.poll(() => asked.length).toBe(2);
  expect(asked.map((url) => `${url.origin}${url.pathname}`)).toEqual([
    'https://www.google.com/s2/favicons',
    'https://www.google.com/s2/favicons',
  ]);
  // The domain of each link, never its path, its query or its fragment.
  expect(asked.map((url) => url.searchParams.get('domain')).sort()).toEqual([
    'example.org',
    'www.github.com',
  ]);
  for (const url of asked) {
    expect(url.search).not.toMatch(/secret|token|numeyoga|readme/);
  }
  expect([...new Set(external)]).toEqual(['https://www.google.com']);
  expect(await page.evaluate(() => localStorage.getItem('favoris-site-icons'))).toBe('1');
  await page.keyboard.press('Escape');
  await expect(page.locator('.fv-site-icon__image')).toHaveCount(2);
  await expect(page.locator('.fv-site-icon__image').first()).toHaveAttribute(
    'referrerpolicy',
    'no-referrer',
  );
  await expect(page.locator('.fv-site-icon__image').first()).toHaveAttribute('alt', '');
  // The icons the CSP allows: no violation.
  expect(violations).toEqual([]);

  // The choice is kept: a reload asks again, once per link.
  await page.reload();
  await expect.poll(() => asked.length).toBe(4);

  // Off: the images go, and nothing more is asked, even after a reload.
  await page.getByRole('button', { name: 'Préférences' }).click();
  await page
    .getByRole('dialog', { name: 'Préférences' })
    .getByRole('switch', { name: SWITCH })
    .uncheck();
  await page.keyboard.press('Escape');
  await expect(page.locator('.fv-site-icon__image')).toHaveCount(0);
  await expect(page.locator('.fv-site-icon')).toHaveText(['G', 'E']);
  expect(await page.evaluate(() => localStorage.getItem('favoris-site-icons'))).toBe('0');
  const total = asked.length;
  await page.reload();
  await expect(page.getByRole('link', { name: /^GitHub/ })).toBeVisible();
  await page.waitForTimeout(300);
  expect(asked.length).toBe(total);
});

test('the icon still shows when Google redirects to gstatic.com, as the real service does', async ({
  page,
}) => {
  const { violations } = await watchPage(page);
  await page.route('https://www.google.com/**', (route) => {
    const domain = new URL(route.request().url()).searchParams.get('domain');
    return route.fulfill({
      status: 301,
      headers: { location: `https://t1.gstatic.com/faviconV2?url=https://${domain}` },
    });
  });
  await page.route('https://t1.gstatic.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG }),
  );
  await page.addInitScript(() => localStorage.setItem('favoris-site-icons', '1'));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // The redirected hop is checked against the CSP before it is fetched: what matters is that the
  // browser goes to gstatic.com without a violation. Chromium may not route that second hop
  // through page.route, so whether the picture itself arrives is not asserted.
  const hop = page.waitForRequest((request) => request.url().startsWith('https://t1.gstatic.com/'));
  await addLink(page, { name: 'Redirigé', url: 'https://redirect.example' });
  await hop;
  await page.waitForTimeout(300);
  expect(violations).toEqual([]);
});

test('an icon that cannot load leaves the initial in place', async ({ page }) => {
  await page.route('https://www.google.com/**', (route) => route.abort());
  await page.addInitScript(() => localStorage.setItem('favoris-site-icons', '1'));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await addLink(page, { name: 'Hors ligne', url: 'offline.example' });

  await expect(page.locator('.fv-site-icon')).toHaveText('O');
  await expect(page.locator('.fv-site-icon__image')).toHaveCount(0); // removed after the error
});

test('the Content Security Policy allows Google’s favicon service in img-src and nowhere else', async ({
  page,
}) => {
  const response = await page.goto('/');
  const policy = response?.headers()['content-security-policy'] ?? '';

  const directives = Object.fromEntries(
    policy.split('; ').map((part) => {
      const [name, ...sources] = part.split(' ');
      return [name, sources];
    }),
  );
  expect(directives['img-src']).toEqual([
    "'self'",
    'https://www.google.com',
    'https://t0.gstatic.com',
    'https://t1.gstatic.com',
    'https://t2.gstatic.com',
    'https://t3.gstatic.com',
  ]);
  for (const [name, sources] of Object.entries(directives)) {
    if (name !== 'img-src') expect(sources.join(' '), name).not.toMatch(/google|gstatic|https?:/);
  }
});
