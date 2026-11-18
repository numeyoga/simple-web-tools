import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

test.describe('Notes — alignement des listes de contrôle Tiptap', () => {
  test('aligne les cases à cocher avec la première ligne du texte et respecte Covenant / WCAG 2.2 AA', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('[data-nav-view="notes"]').click();
    await expect(page.locator('#topbar-title')).toHaveText('Notes');

    await page.locator('#btn-new-note').click();
    await expect(page.locator('#dialog-note')).toBeVisible();
    await page.locator('#note-dialog-title-input').fill('Tests cases');
    await page.locator('#dialog-note button[type="submit"]').click();
    await expect(page.locator('#dialog-note')).not.toBeVisible();
    await expect(page.locator('html')).not.toHaveAttribute('data-persisting', 'true');
    await expect(page.locator('#note-title-input')).toHaveValue('Tests cases');

    const headerSpacing = await page.evaluate(() => {
      const header = document.querySelector('#app-view > .lc-view-header');
      const list = document.querySelector('.lc-notes-list');
      const card = document.querySelector('.lc-notes-layout > .cv-card');
      if (!header || !list || !card) {
        throw new Error('Notes layout elements missing');
      }
      const headerRect = header.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      return {
        headerToList: listRect.top - headerRect.bottom,
        headerToCard: cardRect.top - headerRect.bottom,
      };
    });
    expect(headerSpacing.headerToList).toBeGreaterThanOrEqual(12);
    expect(headerSpacing.headerToCard).toBeGreaterThanOrEqual(12);

    const editor = page.locator('#app-view .lc-editor__surface .ProseMirror');
    await editor.click();
    await expect(editor).toBeFocused();
    const taskBtn = page.locator('#app-view').getByRole('button', { name: 'Liste de contrôle' });
    await taskBtn.click();
    await expect(taskBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(editor).toBeFocused();

    await editor.pressSequentially("C'est à faire");
    await page.keyboard.press('Enter');
    await editor.pressSequentially(
      'Une tâche suffisamment longue pour passer sur plusieurs lignes afin de vérifier que la case à cocher reste bien en face de la première ligne du paragraphe dans la zone de prise de notes',
    );
    await page.keyboard.press('Enter');

    const items = page.locator(
      "#app-view .lc-editor__surface .ProseMirror ul[data-type='taskList'] > li",
    );
    await expect(items).toHaveCount(3);

    async function measureAlignment() {
      return page.evaluate(() => {
        const listItems = [
          ...document.querySelectorAll(
            "#app-view .lc-editor__surface .ProseMirror ul[data-type='taskList'] > li",
          ),
        ];
        return listItems.map((li) => {
          const input = li.querySelector('input[type="checkbox"]');
          const p = li.querySelector('div > p');
          if (!input || !p) {
            throw new Error('Task item missing checkbox or paragraph');
          }
          const inputRect = input.getBoundingClientRect();
          const pRect = p.getBoundingClientRect();

          let firstLineCenterY = pRect.top + pRect.height / 2;
          const firstTextNode = [...p.childNodes].find(
            (n) => n.nodeType === Node.TEXT_NODE && n.textContent,
          );
          if (firstTextNode) {
            const range = document.createRange();
            range.setStart(firstTextNode, 0);
            range.setEnd(firstTextNode, 1);
            const charRect = range.getBoundingClientRect();
            firstLineCenterY = charRect.top + charRect.height / 2;
          }

          return {
            inputWidth: inputRect.width,
            inputHeight: inputRect.height,
            inputCenterY: inputRect.top + inputRect.height / 2,
            firstLineCenterY,
            pMarginTop: parseFloat(getComputedStyle(p).marginTop),
          };
        });
      });
    }

    const standardMetrics = await measureAlignment();
    for (const [index, item] of standardMetrics.entries()) {
      expect(item.inputWidth, `standard item ${index} width`).toBeGreaterThanOrEqual(24);
      expect(item.inputHeight, `standard item ${index} height`).toBeGreaterThanOrEqual(24);
      expect(item.pMarginTop, `standard item ${index} p margin-top`).toBe(0);
      expect(
        Math.abs(item.inputCenterY - item.firstLineCenterY),
        `standard item ${index} vertical center delta`,
      ).toBeLessThanOrEqual(2);
    }

    // Cocher le premier élément et vérifier accessibilité clair + sombre
    await items.nth(0).locator('input[type="checkbox"]').click();
    await expect(items.nth(0)).toHaveAttribute('data-checked', 'true');

    const lightAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(lightAxe.violations).toEqual([]);

    await page.locator('#theme-switch').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    const darkAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(darkAxe.violations).toEqual([]);

    // Vérifier avec grande taille de texte Covenant et à 320 px de large
    await page.evaluate(() => {
      document.documentElement.dataset.textSize = 'large';
    });
    const largeMetrics = await measureAlignment();
    for (const [index, item] of largeMetrics.entries()) {
      expect(
        Math.abs(item.inputCenterY - item.firstLineCenterY),
        `large item ${index} vertical center delta`,
      ).toBeLessThanOrEqual(2);
    }

    await page.setViewportSize({ width: 320, height: 640 });
    const overflow320 = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow320).toBe(false);
  });
});
