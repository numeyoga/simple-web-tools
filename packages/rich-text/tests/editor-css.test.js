// Covenant rule: component CSS uses semantic tokens only. A primitive scale token
// (`--cv-neutral-*`, `--cv-accent-<n>`...) does not follow the theme and has no role.
import { describe, expect, test } from 'vitest';

/** @type {{ readFileSync: (file: URL, encoding: 'utf8') => string }} */
const fs = /** @type {any} */ (globalThis).process.getBuiltinModule('node:fs');

const css = fs.readFileSync(new URL('../src/editor.css', import.meta.url), 'utf8');

describe('editor.css', () => {
  test('is not empty and uses no primitive Covenant token', () => {
    expect(css.length).toBeGreaterThan(1_000);
    const primitives = css.match(
      /var\(--cv-(neutral|accent|success|warning|danger|info)-[0-9]+\)/g,
    );
    expect(primitives).toBeNull();
  });

  test('carries the ProseMirror base rules that Tiptap no longer injects', () => {
    expect(css).toContain('.ProseMirror-gapcursor');
    expect(css).toContain('.ProseMirror-hideselection');
    expect(css).toContain('white-space: break-spaces');
  });
});
