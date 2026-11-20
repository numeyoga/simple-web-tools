/// <reference types="vite/client" />
// No user-facing string outside the catalogs (decision 0002): the views, in French or in English,
// get every text from `t()`. The rule is in support/ui-text-rules.js and reads the syntax tree.
import { describe, expect, test } from 'vitest';
import { lint } from './support/ui-text-rules.js';

const views = /** @type {Record<string, string>} */ (
  import.meta.glob('../../src/adapters/dom/*.js', {
    query: '?raw',
    import: 'default',
    eager: true,
  })
);

/**
 * The few literals that are not interface text although they are words. Each one says why.
 * Keep it short: a new view string belongs in the catalogs.
 */
const ALLOWED = [
  {
    file: 'QuickAdd.js',
    text: 'quick-add-',
    why: 'prefix of the generated name of a radio group',
  },
];

/** @param {string} code @param {string} [file] */
const found = (code, file = 'View.js') => lint('no-ui-literals', code, file, { allow: ALLOWED });

describe('the rule that finds texts outside the catalogs', () => {
  test('finds French and English texts where a text goes', () => {
    expect(found("el('p', null, 'Bonjour le monde');")).toHaveLength(1);
    expect(found("el('p', null, 'Hello world');")).toHaveLength(1);
    expect(found("UI.Button({ children: 'Annuler' });")).toHaveLength(1);
    expect(found("UI.Button({ children: 'Cancel' });")).toHaveLength(1);
    expect(
      found("el('input', { placeholder: 'Ex. dupont', 'aria-label': 'Fermer' });"),
    ).toHaveLength(2);
    expect(found("toasts.push({ title: 'Saved', body: 'Done' });")).toHaveLength(2);
    expect(found('node.textContent = `Chargement`;')).toHaveLength(1);
    expect(found('const n = 3; el("p", null, `${n} chronos en cours`);')).toHaveLength(1);
    expect(found("const label = ok ? 'Oui' : 'Non';")).toHaveLength(2);
    expect(found("const names = ['lun.', 'mar.'];")).toHaveLength(2);
  });

  test('lets codes through', () => {
    expect(
      found(
        [
          "import { el } from './lib.js';",
          "el('div', { class: 'cv-card ch-row', role: 'region', 'aria-labelledby': id, type: 'button' });",
          "el('span', { 'data-cv-close': '', 'aria-expanded': 'false', style: { position: 'absolute' } });",
          "document.querySelector('[data-focus-key]'); node.setAttribute('role', 'tooltip');",
          "window.addEventListener('keydown', () => {}); if (e.key === 'Enter') run();",
          "const d = { weekday: 'long', month: 'short' }; icon('play'); fieldId('ch-hint');",
          "el('i', { class: cond ? 'ph-bold ph-x' : `ph ph-${name}` });",
          "console.error('[App] init failed');",
          "el('p', null, '·', ' → ', '', '35');",
        ].join('\n'),
      ),
    ).toEqual([]);
  });

  test('lets a lowercase code into a variable, but not a lowercase phrase', () => {
    expect(found("let section = 'timeline'; const base = bold ? 'ph-bold' : 'ph';")).toEqual([]);
    expect(found("const word = running ? 'en cours' : 'en pause';")).toHaveLength(2);
    expect(found("function f(style = 'long') {} node.style.top = 'auto'; a.id = 'x-y';")).toEqual(
      [],
    );
    expect(found("node.setAttribute('aria-expanded', 'false');")).toEqual([]);
    expect(found("node.setAttribute('aria-label', 'Fermer');")).toHaveLength(1);
    expect(found("throw new Error('el(): would parse HTML');")).toEqual([]);
  });

  test('has no hidden exception: an allowlisted text is allowed in its own file only', () => {
    const code = "function name(n) { return 'quick-add-' + n; }";
    expect(found(code, 'QuickAdd.js')).toEqual([]);
    expect(found(code, 'Other.js')).toHaveLength(1);
  });
});

describe('the views', () => {
  test('there are views to check', () => {
    expect(Object.keys(views).length).toBeGreaterThanOrEqual(10);
  });

  for (const [path, code] of Object.entries(views)) {
    const file = path.split('/').pop() ?? path;
    test(`${file} has no text outside the catalogs`, () => {
      expect(found(code, file)).toEqual([]);
    });
  }

  test('every allowlisted text is still needed', () => {
    for (const entry of ALLOWED) {
      const code = Object.entries(views).find(([path]) => path.endsWith(`/${entry.file}`))?.[1];
      expect(code, entry.file).toContain(entry.text);
    }
  });
});
