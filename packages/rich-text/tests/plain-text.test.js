import { describe, expect, it } from 'vitest';
import { extractRichTextPlainText } from '../src/index.js';

describe('extractRichTextPlainText', () => {
  it('reads text nodes, hard breaks and image alt texts', () => {
    /** @type {import('../src/index.js').RichTextDoc} */
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Architecture' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Sync' },
            { type: 'hardBreak' },
            { type: 'text', text: 'Local IndexedDB.' },
          ],
        },
        { type: 'localImage', attrs: { assetId: 'a1', alt: 'Network diagram' } },
      ],
    };
    const text = extractRichTextPlainText(doc);
    expect(text).toContain('Architecture');
    expect(text).toContain('Local IndexedDB.');
    expect(text).toContain('Network diagram');
  });

  it('returns an empty string for a missing or empty document', () => {
    expect(extractRichTextPlainText(null)).toBe('');
    expect(extractRichTextPlainText(undefined)).toBe('');
    expect(extractRichTextPlainText({ type: 'doc' })).toBe('');
  });
});
