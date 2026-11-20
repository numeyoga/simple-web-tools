/// <reference types="vite/client" />
// No user-facing string outside the catalogs (decision 0002): the views, the adapters and the
// core, in French or in English, get every text from `t()`. The rule is in
// support/ui-text-rules.js and reads the syntax tree, not the source text.
import { describe, expect, test } from 'vitest';
import { lint } from './support/ui-text-rules.js';

const files = /** @type {Record<string, string>} */ ({
  ...import.meta.glob('../../src/main.js', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../../src/adapters/**/*.js', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob('../../src/core/*.js', { query: '?raw', import: 'default', eager: true }),
});

/**
 * The few literals that are not interface text although they are words. Each one says why.
 * Keep it short: a new string belongs in the catalogs.
 */
const ALLOWED = [
  {
    file: 'ical.js',
    text: 'PRODID:-//Locavern//Locavern PWA//FR',
    why: 'RFC 5545 product identifier: a protocol field, the same in every language',
  },
  {
    file: 'markdown.js',
    text: '](local-asset://',
    why: 'Markdown syntax of an image link to a local asset, not text',
  },
];

/** @param {string} code @param {string} [file] */
const found = (code, file = 'View.js') => lint('no-ui-literals', code, file, { allow: ALLOWED });

describe('the rule that finds texts outside the catalogs', () => {
  test('finds French and English texts where a text goes', () => {
    expect(found("el.textContent = 'Bonjour le monde';")).toHaveLength(1);
    expect(found("el.textContent = 'Hello world';")).toHaveLength(1);
    expect(found("btn.setAttribute('aria-label', 'Fermer');")).toHaveLength(1);
    expect(found("input.placeholder = 'Ex. urgent, client-a';")).toHaveLength(1);
    expect(found("notify({ status: 'info', title: 'Saved', text: 'Done' });")).toHaveLength(2);
    expect(found('node.textContent = `Chargement`;')).toHaveLength(1);
    expect(found('const n = 3; el.textContent = `${n} tâches en retard`;')).toHaveLength(1);
    expect(found("const label = ok ? 'Oui' : 'Non';")).toHaveLength(2);
    expect(found("const names = ['Lun', 'Mar'];")).toHaveLength(2);
    expect(found("setTooltip(btn, 'Modifier');")).toHaveLength(1);
    expect(found("throw new LocavernError('errors.x', { a: 'Texte' });")).toHaveLength(1);
  });

  test('finds a lowercase word where a text goes', () => {
    expect(found("el.textContent = 'fermer';")).toHaveLength(1);
    expect(found("notify({ title: 'saved' });")).toHaveLength(1);
    expect(found("btn.append(document.createTextNode('ok'));")).toHaveLength(1);
  });

  test('lets codes through', () => {
    expect(
      found(
        [
          "import { el } from './lib.js';",
          "dialog.classList.add('cv-modal'); node.className = 'cv-btn cv-btn--ghost';",
          "node.setAttribute('role', 'tooltip'); node.setAttribute('aria-expanded', 'false');",
          "document.getElementById('modal-trash'); document.querySelector('[data-focus-key]');",
          "window.addEventListener('keydown', () => {}); if (event.key === 'Enter') run();",
          "store.dispatch({ type: 'set_view', view: 'notes' }); const kind = 'all';",
          "const mime = 'image/svg+xml'; input.accept = 'image/png,image/jpeg';",
          "const rel = { rel: 'noopener noreferrer', target: '_blank' };",
          'const svg = `<rect x="0" width="${w}" />`; const e = \'&amp;\';',
          "const line = 'BEGIN:VCALENDAR'; const algorithm = 'SHA-256'; const id = 'UID:';",
          "console.error('[App] init failed'); throw new Error('Cannot render the SVG');",
          "failure('errors.backup.invalidJson'); errorText(err, t, 'errors.validation');",
          "el.style.top = 'auto'; el.dataset.persisting = 'true'; node.value = 'light';",
          'const sel = `[data-move-up="${id}"]`; const q = \'img[data-asset-id]\';',
          "const parts = ['', ' · ', '—', '×', '35'];",
        ].join('\n'),
      ),
    ).toEqual([]);
  });

  test('has no hidden exception: an allowlisted text is allowed in its own file only', () => {
    const code = "const line = 'PRODID:-//Locavern//Locavern PWA//FR';";
    expect(found(code, 'ical.js')).toEqual([]);
    expect(found(code, 'other.js')).toHaveLength(1);
  });
});

describe('the application code', () => {
  test('there is code to check', () => {
    expect(Object.keys(files).length).toBeGreaterThanOrEqual(40);
  });

  for (const [path, code] of Object.entries(files)) {
    const file = path.split('/').pop() ?? path;
    test(`${path.replace('../../src/', 'src/')} has no text outside the catalogs`, () => {
      expect(found(code, file)).toEqual([]);
    });
  }

  test('every allowlisted text is still needed', () => {
    for (const entry of ALLOWED) {
      const code = Object.entries(files).find(([path]) => path.endsWith(`/${entry.file}`))?.[1];
      expect(code, entry.file).toContain(entry.text);
    }
  });
});
