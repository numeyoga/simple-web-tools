// IndexedDB that cannot be used shows an error screen instead of the app, and writes nothing.
import { expect, test } from '@playwright/test';

test('without IndexedDB an error screen replaces the app, and nothing is written', async ({
  page,
}) => {
  await page.addInitScript(() => {
    indexedDB.open = () => {
      throw new DOMException('denied', 'SecurityError');
    };
  });

  await page.goto('/');

  const screen = page.getByTestId('storage-error');
  await expect(screen).toHaveAttribute('data-code', 'unavailable');
  await expect(screen.getByRole('heading', { level: 1 })).toHaveText(
    'Transient Notes ne peut pas utiliser le stockage du navigateur',
  );
  await expect(screen.getByRole('button', { name: 'Recharger la page' })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  // Only the registry of workspaces (its default list) was written, never a note.
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys.every((key) => key.startsWith('transient-notes-'))).toBe(true);
});

test('an IndexedDB open that fails with an error event ends on the error screen', async ({
  page,
}) => {
  await page.addInitScript(() => {
    indexedDB.open = () => {
      const request = /** @type {IDBOpenDBRequest} */ ({});
      setTimeout(() => /** @type {() => void} */ (request.onerror)?.(), 0);
      return request;
    };
  });

  await page.goto('/');

  await expect(page.getByTestId('storage-error')).toBeVisible();
});

test('the lock is given back when the database cannot be opened: another tab can write', async ({
  context,
}) => {
  const broken = await context.newPage();
  await broken.addInitScript(() => {
    indexedDB.open = () => {
      throw new DOMException('denied', 'SecurityError');
    };
  });
  await broken.goto('/');
  await expect(broken.getByTestId('storage-error')).toBeVisible();

  const healthy = await context.newPage();
  await healthy.goto('/');

  await expect(healthy.getByRole('button', { name: 'Nouvelle note' })).toBeEnabled();
  await expect(healthy.getByTestId('read-only-banner')).toHaveCount(0);
});
