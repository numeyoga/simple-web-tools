import { describe, expect, it } from 'vitest';
import { splitSlides } from '../../src/core/slide-splitter.js';

describe('splitSlides', () => {
  it('cuts at the separators that stand alone on a line', () => {
    const slides = splitSlides('# One\n\n---\n\n# Two\n\n---\n\n# Three');
    expect(slides).toHaveLength(3);
    expect(slides[0]).toBe('# One');
    expect(slides[2]).toBe('# Three');
  });

  it('ignores empty segments', () => {
    const slides = splitSlides('\n\n---\n\n# Only\n\n---\n\n');
    expect(slides).toEqual(['# Only']);
  });

  it('does not cut at a horizontal rule *** inside a slide', () => {
    const slides = splitSlides('# One\n\nBefore\n\n***\n\nAfter');
    expect(slides).toHaveLength(1);
    expect(slides[0]).toContain('***');
  });

  it('handles a separator with trailing spaces', () => {
    const slides = splitSlides('# One\n--- \n# Two');
    expect(slides).toHaveLength(2);
  });

  it('handles Windows line endings', () => {
    expect(splitSlides('# One\r\n---\r\n# Two\r\n')).toEqual(['# One', '# Two']);
  });

  it('does not cut inside a fenced code block', () => {
    const body = [
      '# One',
      '',
      '```yaml',
      'a: 1',
      '---',
      'b: 2',
      '```',
      '',
      '---',
      '',
      '# Two',
    ].join('\n');
    const slides = splitSlides(body);
    expect(slides).toHaveLength(2);
    expect(slides[0]).toContain('a: 1\n---\nb: 2');
  });

  it('does not cut inside a ~~~ fence, and a shorter fence does not close a longer one', () => {
    const body = ['~~~', '---', '~~~', '````md', '```', '---', '```', '````', '---', 'Next'].join(
      '\n',
    );
    expect(splitSlides(body)).toHaveLength(2);
  });

  it('cuts again after an unclosed fence is closed by the next one', () => {
    expect(splitSlides('```\ncode\n```\n---\nNext')).toEqual(['```\ncode\n```', 'Next']);
  });
});
