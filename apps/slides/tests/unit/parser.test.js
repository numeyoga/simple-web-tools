import { describe, expect, it } from 'vitest';
import { PresentationError } from '../../src/core/errors.js';
import { parsePresentation } from '../../src/core/parser.js';

describe('parsePresentation', () => {
  const source = [
    '---',
    'title: DDD workshop',
    'author: Nicolas',
    'theme: light',
    'ratio: auto',
    '---',
    '# Introduction',
    '',
    'First paragraph.',
    '',
    ':::notes-presenter',
    'Stress the vocabulary.',
    ':::',
    '',
    '---',
    '',
    '## Code sample',
    '',
    '```java',
    'public record Money(long cents) {}',
    '```',
  ].join('\n');

  it('parses the frontmatter and counts the slides', () => {
    const { meta, slides } = parsePresentation(source);
    expect(meta.title).toBe('DDD workshop');
    expect(meta.theme).toBe('light');
    expect(meta.ratio).toBe('auto');
    expect(slides).toHaveLength(2);
  });

  it('extracts the title and the description of each slide', () => {
    const { slides } = parsePresentation(source);
    expect(slides[0]?.meta.title).toBe('Introduction');
    expect(slides[0]?.meta.description).toBe('First paragraph.');
  });

  it('renders the presenter notes as HTML and leaves the public notes empty', () => {
    const { slides } = parsePresentation(source);
    expect(slides[0]?.notes.presenter).toContain('Stress the vocabulary');
    expect(slides[0]?.notes.public).toBe('');
  });

  it('turns a mermaid block into a diagram block that holds its code', () => {
    const { slides } = parsePresentation('# D\n\n```mermaid\ngraph TD; A-->B;\n```');
    expect(slides[0]?.html).toContain('class="slide__diagram mermaid"');
    expect(slides[0]?.html).toContain('graph TD; A--&gt;B;');
  });

  it('keeps an image reference as written (the adapter resolves it against the folder)', () => {
    const { slides } = parsePresentation('# Image\n\n![logo](assets/logo.png)');
    expect(slides[0]?.html).toContain('src="assets/logo.png"');
  });

  it('raises a clear error when there is no slide', () => {
    expect(() => parsePresentation('   ')).toThrowError(PresentationError);
    expect(() => parsePresentation('---\ntitle: x\n---\n')).toThrowError(/no-slides/);
  });

  it('applies the defaults: dark theme, fixed frame, empty texts', () => {
    const { meta } = parsePresentation('# Only');
    expect(meta).toEqual({
      title: '',
      description: '',
      author: '',
      theme: 'dark',
      ratio: 'fixed',
    });
  });

  it('accepts a title written as a number, and ignores one that is a list', () => {
    expect(parsePresentation('---\ntitle: 2026\n---\n# S').meta.title).toBe('2026');
    expect(parsePresentation('---\ntitle: [a, b]\n---\n# S').meta.title).toBe('');
  });

  it('gives the title and the description as plain text, with no marks and no entities', () => {
    const { slides } = parsePresentation(
      '## Tom &amp; **Jerry** `v2`\n\nA *very* <b>short</b> sentence.',
    );
    expect(slides[0]?.meta.title).toBe('Tom & Jerry v2');
    expect(slides[0]?.meta.description).toBe('A very short sentence.');
  });

  it('highlights the registered languages and escapes the others', () => {
    const { slides } = parsePresentation('```json\n{"a": 1}\n```\n\n```cobol\nDISPLAY "<x>".\n```');
    expect(slides[0]?.html).toContain('hljs-attr');
    expect(slides[0]?.html).toContain('DISPLAY &quot;&lt;x&gt;&quot;.');
  });

  it("lets raw HTML through: sanitizing is the adapter's job, at the one place that inserts it", () => {
    const { slides } = parsePresentation('<img src=x onerror=alert(1)>');
    expect(slides[0]?.html).toContain('onerror');
  });

  it('renders GitHub-flavoured tables and task lists', () => {
    const { slides } = parsePresentation('| a | b |\n| - | - |\n| 1 | 2 |\n\n- [x] done');
    expect(slides[0]?.html).toContain('<table>');
    expect(slides[0]?.html).toContain('type="checkbox"');
  });
});
