/// <reference types="vite/client" />
// index.html holds no text of its own (decision 0002): every word is a `data-i18n` element or a
// `data-i18n-attrs` attribute that src/adapters/dom/static-text.js fills in the language of the
// page, so that neither language is baked into the markup.
import { describe, expect, test } from 'vitest';

const page = /** @type {Record<string, string>} */ (
  import.meta.glob('../../index.html', { query: '?raw', import: 'default', eager: true })
);
const html = Object.values(page)[0] ?? '';
// Texts that are names of keys or of the application, not words of a language.
const KEY_LABELS = new Set(['Ctrl+K', 'esc', 'Locavern']);

/**
 * Removes HTML comments. A single pass can leave a new `<!--` behind when comments are nested or
 * overlap (`<!-<!-- x -->- y -->`), so it repeats until the text no longer changes.
 * @param {string} markup
 */
function stripComments(markup) {
  let previous;
  let current = markup;
  do {
    previous = current;
    current = current.replace(/<!--[\s\S]*?-->/g, '');
  } while (current !== previous);
  return current;
}

describe('index.html', () => {
  test('there is markup to check', () => {
    expect(html).toContain('data-i18n=');
  });

  test('has no text node with words, but the key labels', () => {
    const body = stripComments(html);
    const texts = [...body.matchAll(/>([^<>]*\p{L}{2,}[^<>]*)</gu)].map((m) => (m[1] ?? '').trim());
    expect(texts.filter((text) => !KEY_LABELS.has(text))).toEqual([]);
  });

  test('strips nested comments completely', () => {
    expect(stripComments('a<!-<!-- x -->- y -->b')).toBe('ab');
    expect(stripComments('<!-<!-- x -->- y -->')).not.toContain('<!--');
  });

  test('writes no text in an attribute either', () => {
    expect(html).not.toMatch(/\s(aria-label|title|placeholder|alt|data-lc-tooltip)="/);
  });

  test('starts in English: the early script and the app set the language of the user', () => {
    expect(html).toMatch(/<html lang="en"/);
  });
});
