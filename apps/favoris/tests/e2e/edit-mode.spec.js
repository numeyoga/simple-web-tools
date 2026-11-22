// Edit mode: drag and drop (links within a group, between groups, and the groups themselves) and
// its keyboard alternative: move up, move down and move to a group, which are in a menu for each
// link and each group. Dragging is never the only way (WCAG 2.5.7).
import { expect, test } from '@playwright/test';
import {
  card,
  cardLabels,
  dialogNamed,
  linkNames,
  openApp,
  seedBoard,
  setEditMode,
  waitForWrite,
} from './support.js';

/** The row of a link. @param {import('@playwright/test').Page} page @param {string} name */
const row = (page, name) => page.locator('li.fv-link').filter({ hasText: name });

/** The drag handle of a link row. @param {import('@playwright/test').Page} page @param {string} name */
const grip = (page, name) => row(page, name).locator('.fv-grip');

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await seedBoard(page);
});

test('edit mode shows the handles and the menus, and leaving it hides them', async ({ page }) => {
  await expect(page.locator('.fv-grip')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Supprimer « a1 »' })).toHaveCount(0);

  await setEditMode(page, true);

  await expect(page.locator('.fv-grip')).toHaveCount(6); // 2 groups and 4 links
  await expect(page.getByRole('button', { name: 'Déplacer « a1 »' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Actions du groupe « Alpha »' })).toBeVisible();

  await setEditMode(page, false);
  await expect(page.locator('.fv-grip')).toHaveCount(0);
});

test.describe('with the mouse', () => {
  test('a link is dragged before and after another in its group, and the order is kept', async ({
    page,
  }) => {
    await setEditMode(page, true);
    expect(await linkNames(page, 'Alpha')).toEqual(['a1', 'a2', 'a3']);

    // After a3: the lower half of the row.
    const target = row(page, 'a3');
    const box = await target.boundingBox();
    await grip(page, 'a1').dragTo(target, {
      targetPosition: { x: 40, y: (box?.height ?? 30) - 3 },
    });
    expect(await linkNames(page, 'Alpha')).toEqual(['a2', 'a3', 'a1']);

    // Before a2: the upper half.
    await grip(page, 'a1').dragTo(row(page, 'a2'), { targetPosition: { x: 40, y: 3 } });
    expect(await linkNames(page, 'Alpha')).toEqual(['a1', 'a2', 'a3']);

    await waitForWrite(page, 'links', 'position', 3);
    await page.reload();
    await setEditMode(page, true);
    expect(await linkNames(page, 'Alpha')).toEqual(['a1', 'a2', 'a3']);
  });

  test('a link is dragged to another group, next to a link or onto the card', async ({ page }) => {
    await setEditMode(page, true);

    await grip(page, 'a2').dragTo(row(page, 'b1'), { targetPosition: { x: 40, y: 3 } });
    expect(await linkNames(page, 'Alpha')).toEqual(['a1', 'a3']);
    expect(await linkNames(page, 'Bravo')).toEqual(['a2', 'b1']);

    // Onto the title of a card: the link goes to the end of that group.
    await grip(page, 'a1').dragTo(card(page, 'Bravo').locator('.fv-card__head'));
    expect(await linkNames(page, 'Alpha')).toEqual(['a3']);
    expect(await linkNames(page, 'Bravo')).toEqual(['a2', 'b1', 'a1']);

    await waitForWrite(page, 'links', 'name', 'a1');
    await page.reload();
    expect(await linkNames(page, 'Bravo')).toEqual(['a2', 'b1', 'a1']);
  });

  test('a group is dragged before another, and the order is kept', async ({ page }) => {
    await setEditMode(page, true);
    expect(await cardLabels(page)).toEqual(['Alpha', 'Bravo']);

    await card(page, 'Bravo').locator('.fv-card__head .fv-grip').dragTo(card(page, 'Alpha'));
    expect(await cardLabels(page)).toEqual(['Bravo', 'Alpha']);

    await waitForWrite(page, 'groups', 'position', 1);
    await page.reload();
    expect(await cardLabels(page)).toEqual(['Bravo', 'Alpha']);
  });

  test('a row cannot be dragged by its text: only the handle starts a drag', async ({ page }) => {
    await setEditMode(page, true);

    await expect(row(page, 'a1')).not.toHaveAttribute('draggable', 'true');
  });
});

test.describe('with the keyboard', () => {
  test('a link moves up and down with its menu, and the focus stays on the menu button', async ({
    page,
  }) => {
    await setEditMode(page, true);
    const menuButton = page.getByRole('button', { name: 'Déplacer « a3 »' });

    await menuButton.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu', { name: 'Déplacer « a3 »' });
    await expect(menu.getByRole('menuitem', { name: 'Descendre' })).toHaveCount(0); // already last
    await menu.getByRole('menuitem', { name: 'Monter' }).click();

    expect(await linkNames(page, 'Alpha')).toEqual(['a1', 'a3', 'a2']);
    await expect(page.getByRole('button', { name: 'Déplacer « a3 »' })).toBeFocused();

    await page.keyboard.press('Enter');
    await page
      .getByRole('menu', { name: 'Déplacer « a3 »' })
      .getByRole('menuitem', { name: 'Monter' })
      .click();
    expect(await linkNames(page, 'Alpha')).toEqual(['a3', 'a1', 'a2']);
    // At the top: no "move up" any more.
    await page.getByRole('button', { name: 'Déplacer « a3 »' }).click();
    const top = page.getByRole('menu', { name: 'Déplacer « a3 »' });
    await expect(top.getByRole('menuitem', { name: 'Monter' })).toHaveCount(0);
    await top.getByRole('menuitem', { name: 'Descendre' }).click();
    expect(await linkNames(page, 'Alpha')).toEqual(['a1', 'a3', 'a2']);
  });

  test('a link moves to another group with "Déplacer vers un groupe"', async ({ page }) => {
    await setEditMode(page, true);

    await page.getByRole('button', { name: 'Déplacer « a2 »' }).click();
    await page.getByRole('menuitem', { name: 'Déplacer vers un groupe…' }).click();
    const dialog = await dialogNamed(page, 'Déplacer « a2 »');
    await dialog.getByLabel('Groupe').selectOption({ label: 'Bravo' });
    await dialog.getByRole('button', { name: 'Déplacer', exact: true }).click();

    expect(await linkNames(page, 'Alpha')).toEqual(['a1', 'a3']);
    expect(await linkNames(page, 'Bravo')).toEqual(['b1', 'a2']);
    await expect(page.getByText('Lien déplacé')).toBeVisible();

    // And out of every group.
    await page.getByRole('button', { name: 'Déplacer « a2 »' }).click();
    await page.getByRole('menuitem', { name: 'Déplacer vers un groupe…' }).click();
    const again = await dialogNamed(page, 'Déplacer « a2 »');
    await again.getByLabel('Groupe').selectOption({ label: 'Sans groupe' });
    await again.getByRole('button', { name: 'Déplacer', exact: true }).click();
    expect(await linkNames(page, 'Sans groupe')).toEqual(['a2']);
  });

  test('a group moves up and down with its menu, and the ends have no impossible move', async ({
    page,
  }) => {
    await setEditMode(page, true);

    await page.getByRole('button', { name: 'Actions du groupe « Alpha »' }).click();
    let menu = page.getByRole('menu', { name: 'Actions du groupe « Alpha »' });
    await expect(menu.getByRole('menuitem', { name: 'Monter' })).toHaveCount(0);
    await menu.getByRole('menuitem', { name: 'Descendre' }).click();

    expect(await cardLabels(page)).toEqual(['Bravo', 'Alpha']);
    await expect(page.getByRole('button', { name: 'Actions du groupe « Alpha »' })).toBeFocused();
    await page.keyboard.press('Enter');
    menu = page.getByRole('menu', { name: 'Actions du groupe « Alpha »' });
    await expect(menu.getByRole('menuitem', { name: 'Descendre' })).toHaveCount(0);
    await menu.getByRole('menuitem', { name: 'Monter' }).click();
    expect(await cardLabels(page)).toEqual(['Alpha', 'Bravo']);
  });

  test('the whole move is reachable without a pointer: Tab reaches the menus in edit mode', async ({
    page,
  }) => {
    await setEditMode(page, true);
    const target = page.getByRole('button', { name: 'Déplacer « a1 »' });

    for (
      let i = 0;
      i < 40 && !(await target.evaluate((n) => n === document.activeElement));
      i += 1
    ) {
      await page.keyboard.press('Tab');
    }

    await expect(target).toBeFocused();
  });
});
