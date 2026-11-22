import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

describe('package exports', () => {
  it('point at files that exist', () => {
    for (const target of Object.values(pkg.exports)) {
      const path = String(target);
      if (path.includes('*')) {
        expect(existsSync(join(root, dirname(path)))).toBe(true);
      } else {
        expect(existsSync(join(root, path)), path).toBe(true);
      }
    }
  });

  it('expose the logos with their original names', () => {
    for (const name of ['covenant-logo.svg', 'covenant-logo-dark.svg', 'covenant-mark.svg']) {
      expect(existsSync(join(root, 'src/logos', name)), name).toBe(true);
    }
  });
});

describe('no third-party request (decision 0003)', () => {
  it('has no @import and no remote url() in the stylesheets', () => {
    for (const name of ['covenant-tokens.css', 'covenant.css']) {
      const css = readFileSync(join(root, 'src', name), 'utf8');
      expect(css, name).not.toMatch(/@import/);
      expect(css, name).not.toMatch(/url\(\s*['"]?(https?:)?\/\//);
    }
  });

  it('has no remote URL in the behaviours', () => {
    expect(readFileSync(join(root, 'src/covenant.js'), 'utf8')).not.toMatch(/https?:\/\//);
  });

  it('bundles the fonts and icons from npm packages it depends on', () => {
    const fonts = readFileSync(join(root, 'src/fonts.js'), 'utf8');
    const specifiers = [...fonts.matchAll(/import '([^']+)'/g)].map((match) => String(match[1]));
    expect(specifiers.length).toBe(8);
    for (const specifier of specifiers) {
      const name = specifier.startsWith('@')
        ? specifier.split('/').slice(0, 2).join('/')
        : specifier;
      expect(Object.keys(pkg.dependencies), specifier).toContain(name);
    }
  });
});

describe('reset and prose', () => {
  const css = readFileSync(join(root, 'src/covenant.css'), 'utf8');
  const layer = /@layer cv-reset \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';

  it('resets the browser margins inside @layer cv-reset, so that unlayered rules still win', () => {
    expect(layer).toMatch(/body \{ margin: 0; \}/);
    expect(layer).toMatch(
      /h1, h2, h3, h4, h5, h6, p, ul, ol, figure, blockquote, dl, dd \{ margin: 0; \}/,
    );
    expect(layer).toMatch(/img, picture, video, canvas \{ display: block; max-width: 100%; \}/);
    expect(layer).toMatch(/text-wrap: balance/);
  });

  it('leaves inline svg and list markers alone', () => {
    expect(layer).not.toMatch(/svg/);
    expect(layer).not.toMatch(/list-style/);
  });

  it('keeps .cv-prose outside the layer, with zero specificity', () => {
    expect(layer).not.toMatch(/cv-prose/);
    const rules = css
      .split('\n')
      .filter((line) => line.includes('.cv-prose') && line.includes('{'));
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) expect(rule).toMatch(/^:where\(\.cv-prose\)/);
  });
});
