/// <reference types="vite/client" />
// No user-facing string outside the catalogs (decision 0002): the views, in French or in English,
// get every text from `t()`. The rule is in support/ui-text-rules.js and reads the syntax tree.
import { describe, expect, test } from 'vitest';
import { lint } from './support/ui-text-rules.js';

const views = /** @type {Record<string, string>} */ (
  import.meta.glob(['../../src/adapters/dom/*.js', '../../src/adapters/labels.js'], {
    query: '?raw',
    import: 'default',
    eager: true,
  })
);

/** @type {{ file: string, text: string, why: string }[]} */
const ALLOWED = [
  {
    file: 'ui.js',
    text: 'sl',
    why: "the app's class prefix, given to the shared builders",
  },
  {
    file: 'Home.js',
    text: '---',
    why: 'the slide separator the sentence names (a token of the Markdown format, not a word)',
  },
  {
    file: 'Home.js',
    text: 'title, description, author, theme, ratio',
    why: 'the keys of the frontmatter the sentence names (YAML keys, not words)',
  },
  {
    file: 'Home.js',
    text: ':::notes-presenter',
    why: 'the directive the sentence names (a token of the Markdown format, not a word)',
  },
  {
    file: 'Home.js',
    text: ':::notes-public',
    why: 'the directive the sentence names (a token of the Markdown format, not a word)',
  },
  {
    file: 'Home.js',
    text: 'assets/',
    why: 'the conventional folder of the images, which the sentence names (a path, not a word)',
  },
  {
    file: 'Home.js',
    text: 'mermaid',
    why: 'the name of the code block language the sentence names (a code, not a word)',
  },
];

/** @param {string} code @param {string} [file] @param {typeof ALLOWED} [allow] */
const found = (code, file = 'View.js', allow = ALLOWED) =>
  lint('no-ui-literals', code, file, { allow });

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
    expect(found('const n = 3; el("p", null, `${n} notes ouvertes`);')).toHaveLength(1);
    expect(found("const label = ok ? 'Oui' : 'Non';")).toHaveLength(2);
    expect(found("const names = ['lun.', 'mar.'];")).toHaveLength(2);
  });

  test('lets codes through', () => {
    expect(
      found(
        [
          "import { el } from './lib.js';",
          "el('div', { class: 'cv-card dsh-row', role: 'region', 'aria-labelledby': id, type: 'button' });",
          "el('span', { 'data-cv-close': '', 'aria-expanded': 'false', style: { position: 'absolute' } });",
          "document.querySelector('[data-focus-key]'); node.setAttribute('role', 'tooltip');",
          "window.addEventListener('keydown', () => {}); if (e.key === 'Enter') run();",
          "const d = { weekday: 'long', month: 'short' }; icon('play'); fieldId('dsh-hint');",
          "el('i', { class: cond ? 'ph-bold ph-x' : `ph ph-${name}` });",
          "console.error('[App] init failed');",
          "el('p', null, '·', ' → ', '', '35');",
        ].join('\n'),
      ),
    ).toEqual([]);
  });

  test('lets a lowercase code into a variable, but not a lowercase phrase', () => {
    expect(found("let section = 'all'; const base = bold ? 'ph-bold' : 'ph';")).toEqual([]);
    expect(found("const word = running ? 'en cours' : 'en pause';")).toHaveLength(2);
    expect(found("function f(style = 'long') {} node.style.top = 'auto'; a.id = 'x-y';")).toEqual(
      [],
    );
    expect(found("node.setAttribute('aria-expanded', 'false');")).toEqual([]);
    expect(found("node.setAttribute('aria-label', 'Fermer');")).toHaveLength(1);
    expect(found("throw new Error('el(): would parse HTML');")).toEqual([]);
  });

  test('has no hidden exception: an allowlisted text is allowed in its own file only', () => {
    const allow = [{ file: 'Special.js', text: 'note-prefix-', why: 'prefix of a generated name' }];
    const code = "function name(n) { return 'note-prefix-' + n; }";
    expect(found(code, 'Special.js', allow)).toEqual([]);
    expect(found(code, 'Other.js', allow)).toHaveLength(1);
  });
});

describe('the views', () => {
  test('there are views to check', () => {
    expect(Object.keys(views).length).toBeGreaterThanOrEqual(6);
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
