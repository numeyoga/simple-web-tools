import { test, expect } from '@playwright/test';
import { expectNoA11yViolations } from '@simple-web-tools/test-utils/axe';
import { setTheme } from './support/shell.js';

// Covenant colour rules the axe audit does not measure (WCAG 1.4.11 non-text contrast): the
// whiteboard artwork and the calendar stripes, in both themes, and the colours an exported
// whiteboard carries. The primitive-token guard is tests/unit/no-primitive-tokens.test.js.

const COLORS = ['neutral', 'accent', 'success', 'warning', 'danger'];

/**
 * Page-side helpers: any CSS colour (rgb, hex, color(srgb ...)) to RGBA through a canvas, the
 * background actually painted behind an element, and WCAG contrast ratios.
 */
const installMeasure = () => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const g = /** @type {CanvasRenderingContext2D} */ (
    canvas.getContext('2d', { willReadFrequently: true })
  );
  /** @param {string} css @returns {number[]} */
  const rgba = (css) => {
    g.clearRect(0, 0, 1, 1);
    g.fillStyle = '#000';
    g.fillStyle = css;
    g.fillRect(0, 0, 1, 1);
    const d = g.getImageData(0, 0, 1, 1).data;
    return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0, (d[3] ?? 0) / 255];
  };
  /** @param {number[]} top @param {number[]} bottom */
  const over = (top, bottom) => {
    const a = top[3] ?? 1;
    return [0, 1, 2].map((i) => (top[i] ?? 0) * a + (bottom[i] ?? 0) * (1 - a)).concat(1);
  };
  /** @param {Element} el */
  const bgOf = (el) => {
    /** @type {number[][]} */
    const layers = [];
    for (let n = /** @type {Element | null} */ (el); n; n = n.parentElement) {
      const c = rgba(getComputedStyle(n).backgroundColor);
      if ((c[3] ?? 0) > 0) {
        layers.push(c);
        if (c[3] === 1) break;
      }
    }
    let acc = [255, 255, 255, 1];
    for (let i = layers.length - 1; i >= 0; i -= 1) acc = over(layers[i] ?? [0, 0, 0, 1], acc);
    return acc;
  };
  /** @param {number[]} c */
  const lum = (c) => {
    /** @param {number | undefined} v */
    const f = (v) => {
      const s = (v ?? 0) / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  /** @param {number[]} a @param {number[]} b */
  const ratio = (a, b) => {
    const hi = Math.max(lum(a), lum(b));
    const lo = Math.min(lum(a), lum(b));
    return (hi + 0.05) / (lo + 0.05);
  };
  /** @type {any} */ (window).__measure = { rgba, over, bgOf, ratio };
};

/** @param {import('@playwright/test').Page} page */
async function setDark(page) {
  await setTheme(page, 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.evaluate(installMeasure);
}

/** @param {import('@playwright/test').Page} page @param {string} title */
async function openNewWhiteboard(page, title) {
  await page.locator('[data-nav-view="whiteboards"]').click();
  await page.getByRole('button', { name: 'Créer un tableau blanc' }).click();
  await page.locator('#whiteboard-dialog-title-input').fill(title);
  await page.locator('#dialog-whiteboard button[type="submit"]').click();
  await expect(page.locator('.lc-wb-svg')).toBeVisible();
}

/** One element of every type in every colour, at the centre of the canvas. */
/** @param {import('@playwright/test').Page} page */
async function addEveryElement(page) {
  for (const color of COLORS) {
    await page.locator(`[data-wb-color="${color}"]`).click();
    for (const tool of ['sticky', 'rect', 'ellipse', 'arrow', 'path', 'text']) {
      await page.locator(`[data-wb-tool="${tool}"]`).click();
      await page.locator('[data-wb-action="add-center"]').click();
      await page.locator('.lc-wb-container').press('Escape');
    }
  }
  await page.locator('[data-wb-tool="select"]').click();
}

/** @param {import('@playwright/test').Page} page */
async function measureWhiteboard(page) {
  return page.evaluate((colors) => {
    const { rgba, over, bgOf, ratio } = /** @type {any} */ (window).__measure;
    const stage = /** @type {Element} */ (document.querySelector('.lc-wb-stage'));
    const canvasBg = bgOf(stage);
    const toolbarBg = bgOf(/** @type {Element} */ (document.querySelector('.lc-wb-toolbar')));
    const svg = /** @type {SVGSVGElement} */ (document.querySelector('.lc-wb-svg'));
    /** @type {{ what: string; ratio: number; min: number }[]} */
    const out = [];
    /** @param {string} what @param {number[]} fg @param {number[]} bg @param {number} min */
    const rec = (what, fg, bg, min) => out.push({ what, ratio: ratio(fg, bg), min });
    for (const color of colors) {
      const shapes = [
        ...document.querySelectorAll(
          `.lc-wb-el[data-el-type="sticky"] .lc-wb-shape[data-color="${color}"]`,
        ),
        ...document.querySelectorAll(
          `.lc-wb-el[data-el-type="rect"] .lc-wb-shape[data-color="${color}"]`,
        ),
        ...document.querySelectorAll(
          `.lc-wb-el[data-el-type="ellipse"] .lc-wb-shape[data-color="${color}"]`,
        ),
      ];
      if (shapes.length !== 3) throw new Error(`${color}: ${shapes.length} shapes`);
      for (const shape of shapes) {
        const cs = getComputedStyle(shape);
        rec(`${color} shape stroke on the canvas`, rgba(cs.stroke), canvasBg, 3);
      }
      const sticky = /** @type {Element} */ (
        document.querySelector(
          `.lc-wb-el[data-el-type="sticky"] .lc-wb-shape[data-color="${color}"]`,
        )
      );
      const fill = over(rgba(getComputedStyle(sticky).fill), canvasBg);
      const stickyText = svg.querySelector(
        `.lc-wb-el[data-el-type="sticky"] .lc-wb-el-text[data-color="${color}"]`,
      );
      if (!stickyText) throw new Error(`${color}: no sticky text`);
      rec(`${color} sticky text on the note`, rgba(getComputedStyle(stickyText).fill), fill, 4.5);
      for (const kind of ['arrow', 'path']) {
        const line = svg.querySelector(
          `.lc-wb-el[data-el-type="${kind}"] [data-color="${color}"]:not(.lc-wb-hit-stroke):not(.lc-wb-arrow-head)`,
        );
        if (!line) throw new Error(`${color}: no ${kind}`);
        rec(
          `${color} ${kind} line on the canvas`,
          rgba(getComputedStyle(line).stroke),
          canvasBg,
          3,
        );
      }
      const head = svg.querySelector(`.lc-wb-arrow-head[data-color="${color}"]`);
      if (head)
        rec(`${color} arrow head on the canvas`, rgba(getComputedStyle(head).fill), canvasBg, 3);
      const swatch = /** @type {Element} */ (document.querySelector(`.lc-wb-swatch--${color}`));
      rec(
        `${color} toolbar swatch border on the toolbar`,
        rgba(getComputedStyle(swatch).borderTopColor),
        toolbarBg,
        3,
      );
    }
    // Working feedback drawn while editing: marquee, arrow handle, snap guides.
    const NS = 'http://www.w3.org/2000/svg';
    for (const [tag, cls] of [
      ['rect', 'lc-wb-marquee'],
      ['circle', 'lc-wb-arrow-handle'],
      ['rect', 'lc-wb-snap-ring'],
      ['circle', 'lc-wb-snap-dot'],
    ]) {
      const probe = document.createElementNS(NS, tag ?? 'rect');
      probe.setAttribute('class', cls ?? '');
      svg.append(probe);
      rec(`${cls} stroke on the canvas`, rgba(getComputedStyle(probe).stroke), canvasBg, 3);
      probe.remove();
    }
    return out;
  }, COLORS);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @returns {Promise<Uint8Array>} the bytes of the file the button downloads
 */
async function downloadBytes(page, selector) {
  const downloadPromise = page.waitForEvent('download');
  await page.locator(selector).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  /** @type {Uint8Array[]} */
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(
      typeof chunk === 'string' ? new TextEncoder().encode(chunk) : new Uint8Array(chunk),
    );
  }
  const bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

test.describe('Covenant colours: whiteboard artwork, calendar stripes and exports', () => {
  for (const theme of ['light', 'dark']) {
    test(`whiteboard shapes, lines and notes keep their contrast in the ${theme} theme`, async ({
      page,
    }) => {
      await page.goto('/');
      if (theme === 'dark') await setDark(page);
      else await page.evaluate(installMeasure);
      await openNewWhiteboard(page, `Contrastes ${theme}`);
      await addEveryElement(page);
      await expect(page.locator('.lc-wb-el')).toHaveCount(COLORS.length * 6);

      const measures = await measureWhiteboard(page);
      // Per colour: 3 shape strokes, sticky text, arrow, freehand, arrow head, swatch; and 4 feedback strokes.
      expect(measures).toHaveLength(COLORS.length * 8 + 4);
      const failing = measures
        .filter((m) => m.ratio < m.min)
        .map((m) => `${m.what}: ${m.ratio.toFixed(2)} (needs ${m.min})`);
      expect(failing).toEqual([]);

      await expectNoA11yViolations(page);
    });

    test(`an exported whiteboard embeds concrete colours in the ${theme} theme (SVG and PNG)`, async ({
      page,
    }) => {
      await page.goto('/');
      if (theme === 'dark') await setDark(page);
      await openNewWhiteboard(page, `Export ${theme}`);
      await addEveryElement(page);

      const svg = new TextDecoder().decode(await downloadBytes(page, '#btn-export-wb-svg'));
      // Outside the app a CSS variable or a CSS function resolves to nothing.
      expect(svg).not.toMatch(/var\(|color-mix|color\(|--cv-|--lc-/);
      /** @type {string[]} */
      const paints = [];
      for (const match of svg.matchAll(/\s(?:fill|stroke)="([^"]*)"/g)) paints.push(match[1] ?? '');
      expect(paints.length).toBeGreaterThan(COLORS.length * 4);
      const concrete = /^(none|#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+(?:\s*,\s*[\d.]+){2,3}\s*\))$/i;
      expect(paints.filter((paint) => !concrete.test(paint))).toEqual([]);
      // Five colours: five distinct note fills and five distinct arrow strokes.
      const fills = [...svg.matchAll(/<rect[^>]*rx="8"[^>]*fill="([^"]+)"/g)].map((m) => m[1]);
      expect(new Set(fills).size).toBe(COLORS.length);
      const arrows = [...svg.matchAll(/<line[^>]*stroke="([^"]+)"/g)].map((m) => m[1]);
      expect(new Set(arrows).size).toBe(COLORS.length);

      const png = await downloadBytes(page, '#btn-export-wb-png');
      expect([...png.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(png.length).toBeGreaterThan(1000);
    });
  }

  test('calendar stripes and priority icons keep 3:1 on their surface in both themes, and the words and icons stay', async ({
    page,
  }) => {
    // Fixed day: the layout of the week (and which days are weekend) depends on today's date.
    await page.clock.install({ time: new Date('2026-11-20T12:00:00') });
    await page.goto('/');
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Rayures');
    await page.locator('#modal-project button[type="submit"]').click();
    for (const [title, priority, due, time] of [
      ['Haute', 'high', '2026-11-17', '10:00'],
      ['Moyenne', 'medium', '2026-11-17', '21:30'],
      ['Basse', 'low', '2026-11-18', '09:00'],
    ]) {
      await page.locator('#btn-new-task').click();
      await page.locator('#task-title-input').fill(title ?? '');
      await page.locator('#task-priority-select').selectOption(priority ?? 'medium');
      await page.locator('#task-due-input').fill(due ?? '');
      await page.locator('#task-due-time-input').fill(time ?? '');
      await page.locator('#drawer-task button[type="submit"]').click();
      await expect(page.locator('#drawer-task')).toBeHidden();
    }
    await page.locator('[data-nav-view="calendar"]').click();
    await page.locator('input[name="calendar-view-mode"][value="week"]').check();
    await expect(page.locator('.lc-cal-task')).toHaveCount(3);

    // Meaning is also carried by words and icons: the weekend badge, the off-hours pill with its
    // moon, and the legend items. The stripes reinforce them.
    await expect(page.locator('.lc-cal-weekend-tag').first()).toContainText('Week-end');
    await expect(page.locator('.lc-offhours-pill i.ph-moon').first()).toBeVisible();
    await expect(page.locator('.lc-cal-legend')).toContainText('Samedi & dimanche');
    await expect(page.locator('.lc-cal-legend')).toContainText('Créneau 18h–7h');

    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await setTheme(page, 'dark');
      await page.evaluate(installMeasure);
      const measures = await page.evaluate(() => {
        const { rgba, bgOf, ratio } = /** @type {any} */ (window).__measure;
        /** @type {{ what: string; ratio: number }[]} */
        const out = [];
        /** @param {string} what @param {number[]} fg @param {number[]} bg */
        const rec = (what, fg, bg) => out.push({ what, ratio: ratio(fg, bg) });
        for (const priority of ['high', 'medium', 'low']) {
          const card = /** @type {Element} */ (document.querySelector(`.lc-cal-task--${priority}`));
          const stripe = rgba(getComputedStyle(card).borderLeftColor);
          rec(`${priority} priority stripe on its card`, stripe, bgOf(card));
          rec(
            `${priority} priority stripe on its column`,
            stripe,
            bgOf(/** @type {Element} */ (card.parentElement)),
          );
          // The icon next to the title: same role as the stripe, 3:1 as a graphic on the card.
          const icon = /** @type {Element} */ (card.querySelector('.lc-cal-task__prio i'));
          rec(
            `${priority} priority icon on its card`,
            rgba(getComputedStyle(icon).color),
            bgOf(card),
          );
        }
        const slot = /** @type {Element} */ (document.querySelector('.lc-cal-slot--offhours'));
        const slotStripe = rgba(getComputedStyle(slot).borderInlineStartColor);
        rec('off-hours slot stripe on the slot', slotStripe, bgOf(slot));
        rec(
          'off-hours slot stripe on the column',
          slotStripe,
          bgOf(/** @type {Element} */ (slot.parentElement)),
        );
        const boundary = /** @type {Element} */ (document.querySelector('.lc-cal-slot--boundary'));
        rec(
          '18h and 7h boundary on the slot',
          rgba(getComputedStyle(boundary).borderTopColor),
          bgOf(boundary),
        );
        const weekend = /** @type {Element} */ (document.querySelector('.lc-cal-cell.is-weekend'));
        rec(
          'weekend top edge on the cell',
          rgba(getComputedStyle(weekend).borderTopColor),
          bgOf(weekend),
        );
        for (const kind of ['weekend', 'offhours']) {
          const swatch = /** @type {Element} */ (
            document.querySelector(`.lc-cal-legend__swatch--${kind}`)
          );
          const cs = getComputedStyle(swatch);
          rec(
            `legend ${kind} swatch edge`,
            rgba(kind === 'weekend' ? cs.borderTopColor : cs.borderInlineStartColor),
            bgOf(swatch),
          );
        }
        return out;
      });
      expect(measures).toHaveLength(15);
      const failing = measures
        .filter((m) => m.ratio < 3)
        .map((m) => `${theme}: ${m.what} ${m.ratio.toFixed(2)}`);
      expect(failing).toEqual([]);
      await expectNoA11yViolations(page);

      // The same icons in the month view (cards sit in the day cell, on the cell background).
      await page.locator('input[name="calendar-view-mode"][value="month"]').check();
      await expect(page.locator('.lc-cal-task')).toHaveCount(3);
      const monthIcons = await page.evaluate(() => {
        const { rgba, bgOf, ratio } = /** @type {any} */ (window).__measure;
        return ['high', 'medium', 'low'].map((priority) => {
          const card = /** @type {Element} */ (document.querySelector(`.lc-cal-task--${priority}`));
          const icon = /** @type {Element} */ (card.querySelector('.lc-cal-task__prio i'));
          return {
            what: `month ${priority} priority icon on its card`,
            ratio: ratio(rgba(getComputedStyle(icon).color), bgOf(card)),
          };
        });
      });
      expect(
        monthIcons.filter((m) => m.ratio < 3).map((m) => `${theme}: ${m.what} ${m.ratio}`),
      ).toEqual([]);
      await expectNoA11yViolations(page);
      await page.locator('input[name="calendar-view-mode"][value="week"]').check();
      await expect(page.locator('.lc-cal-task')).toHaveCount(3);
    }
  });
});
