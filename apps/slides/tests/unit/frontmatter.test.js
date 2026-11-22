import { describe, expect, it } from 'vitest';
import { PresentationError } from '../../src/core/errors.js';
import { extractFrontmatter } from '../../src/core/frontmatter.js';

describe('extractFrontmatter', () => {
  it('returns an empty meta when there is no frontmatter', () => {
    const { meta, body } = extractFrontmatter('# Title\n\nContent');
    expect(meta).toEqual({});
    expect(body).toBe('# Title\n\nContent');
  });

  it('extracts the frontmatter at the top of the file', () => {
    const source = '---\ntitle: Demo\nauthor: Nicolas\ntheme: light\n---\n# Slide 1';
    const { meta, body } = extractFrontmatter(source);
    expect(meta.title).toBe('Demo');
    expect(meta.author).toBe('Nicolas');
    expect(meta.theme).toBe('light');
    expect(body).toBe('# Slide 1');
  });

  it('normalizes the ratio "auto"', () => {
    const { meta } = extractFrontmatter('---\nratio: auto\n---\n# S');
    expect(meta.ratio).toBe('auto');
  });

  it('normalizes an explicit ratio (16/9, for instance) to "fixed"', () => {
    const { meta } = extractFrontmatter('---\nratio: "16/9"\n---\n# S');
    expect(meta.ratio).toBe('fixed');
  });

  it('does not take a slide separator for a frontmatter', () => {
    const source = '# Slide 1\n\n---\n\n# Slide 2';
    const { meta, body } = extractFrontmatter(source);
    expect(meta).toEqual({});
    expect(body).toBe(source);
  });

  it('does not take a first slide framed by two separators for a frontmatter', () => {
    const source = '---\n# Slide 1\n---\n# Slide 2';
    const { meta, body } = extractFrontmatter(source);
    expect(meta).toEqual({});
    expect(body).toBe(source);
  });

  it('accepts Windows line endings and a frontmatter that ends the file', () => {
    expect(extractFrontmatter('---\r\ntitle: A\r\n---\r\n# S').body).toBe('# S');
    expect(extractFrontmatter('---\ntitle: A\n---')).toEqual({ meta: { title: 'A' }, body: '' });
  });

  it('refuses a block that is not valid YAML, with the reason', () => {
    expect(() => extractFrontmatter('---\ntitle: [unclosed\n---\n# S')).toThrowError(
      PresentationError,
    );
    try {
      extractFrontmatter('---\ntitle: [unclosed\n---\n# S');
    } catch (error) {
      expect(error).toMatchObject({ code: 'invalid-frontmatter' });
      expect(/** @type {PresentationError} */ (error).detail).not.toBe('');
    }
  });

  it('does not expand a YAML alias bomb', () => {
    const bomb = [
      '---',
      'a: &a [x, x, x, x, x, x, x, x, x, x]',
      ...Array.from(
        { length: 6 },
        (_, i) =>
          `b${i}: &b${i} [${Array(10)
            .fill(i === 0 ? '*a' : `*b${i - 1}`)
            .join(', ')}]`,
      ),
      'c: *b5',
      '---',
      '# S',
    ].join('\n');
    expect(() => extractFrontmatter(bomb)).toThrowError(PresentationError);
  });
});
