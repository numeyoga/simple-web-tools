import { describe, expect, it } from 'vitest';
import { extractDirectives } from '../../src/core/directives.js';

describe('extractDirectives', () => {
  it('extracts the public and the presenter notes', () => {
    const source = [
      '# Slide',
      '',
      'Content',
      '',
      ':::notes-public',
      'See RFC 2119',
      ':::',
      '',
      ':::notes-presenter',
      'Recall the context',
      ':::',
    ].join('\n');

    const { content, notes } = extractDirectives(source);
    expect(content).toBe('# Slide\n\nContent');
    expect(notes.public).toBe('See RFC 2119');
    expect(notes.presenter).toBe('Recall the context');
  });

  it('returns empty notes when there is no directive', () => {
    const { content, notes } = extractDirectives('# Slide\n\nContent');
    expect(content).toBe('# Slide\n\nContent');
    expect(notes.public).toBe('');
    expect(notes.presenter).toBe('');
  });

  it('joins several directives of the same kind', () => {
    const source = [
      'Text',
      ':::notes-presenter',
      'Note A',
      ':::',
      ':::notes-presenter',
      'Note B',
      ':::',
    ].join('\n');
    const { notes } = extractDirectives(source);
    expect(notes.presenter).toBe('Note A\n\nNote B');
  });

  it('keeps a multi-line directive as it is written', () => {
    const source = ['Text', ':::notes-public', 'Line 1', 'Line 2', ':::'].join('\n');
    const { notes } = extractDirectives(source);
    expect(notes.public).toBe('Line 1\nLine 2');
  });

  it('accepts Windows line endings and spaces around the name', () => {
    const { content, notes } = extractDirectives('Text\r\n::: notes-public \r\nA\r\n:::\r\n');
    expect(content).toBe('Text');
    expect(notes.public).toBe('A');
  });

  it('leaves an unknown directive in the content', () => {
    const { content, notes } = extractDirectives('Text\n:::warning\nCareful\n:::');
    expect(content).toContain(':::warning');
    expect(notes).toEqual({ public: '', presenter: '' });
  });
});
