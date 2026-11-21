import { describe, expect, it } from 'vitest';
import { richTextDocToMarkdown } from '../src/index.js';

/** @type {import('../src/index.js').RichTextDoc} */
const doc = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Big title' }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section' }] },
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Subsection' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Text ' },
        { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
        { type: 'text', text: ', ' },
        { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
        { type: 'text', text: ', ' },
        { type: 'text', text: 'struck', marks: [{ type: 'strike' }] },
        { type: 'text', text: ', ' },
        { type: 'text', text: 'npm test', marks: [{ type: 'code' }] },
        { type: 'text', text: ' and ' },
        {
          type: 'text',
          text: 'docs',
          marks: [{ type: 'link', attrs: { href: 'https://example.org/doc' } }],
        },
        { type: 'text', text: '.' },
      ],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bullet A' }] }],
        },
      ],
    },
    {
      type: 'orderedList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Step 1' }] }],
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Step 2' }] }],
        },
      ],
    },
    {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: true },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Done' }] }],
        },
        {
          type: 'taskItem',
          attrs: { checked: false },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'To do' }] }],
        },
      ],
    },
    { type: 'localImage', attrs: { assetId: 'img-1', alt: 'Local capture' } },
  ],
};

describe('richTextDocToMarkdown', () => {
  it('converts headings, inline marks, lists and local images', () => {
    const md = richTextDocToMarkdown(doc);
    expect(md).toContain('# Big title');
    expect(md).toContain('## Section');
    expect(md).toContain('### Subsection');
    expect(md).toContain(
      'Text **bold**, *italic*, ~~struck~~, `npm test` and [docs](https://example.org/doc).',
    );
    expect(md).toContain('- Bullet A');
    expect(md).toContain('1. Step 1\n2. Step 2');
    expect(md).toContain('- [x] Done\n- [ ] To do');
    expect(md).toContain('![Local capture](local-asset://img-1)');
  });

  it("uses the caller's text for an image without alt text", () => {
    const bare = {
      type: 'doc',
      content: [{ type: 'localImage', attrs: { assetId: 'img-2', alt: '' } }],
    };
    expect(richTextDocToMarkdown(/** @type {any} */ (bare), { imageAlt: 'Image locale' })).toBe(
      '![Image locale](local-asset://img-2)',
    );
    expect(richTextDocToMarkdown(/** @type {any} */ (bare))).toBe('![Image](local-asset://img-2)');
  });

  it('keeps the whitespace outside emphasis delimiters and nests lists', () => {
    /** @type {import('../src/index.js').RichTextDoc} */
    const nested = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: ' padded ', marks: [{ type: 'bold' }] }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Parent' }] },
                {
                  type: 'bulletList',
                  content: [
                    {
                      type: 'listItem',
                      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Child' }] }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(richTextDocToMarkdown(nested)).toBe('**padded** \n\n- Parent\n  - Child');
  });

  it('formats marked text with long runs of spaces in linear time', () => {
    const spaces = ' '.repeat(100_000);
    /**
     * @param {string} text
     * @returns {import('../src/index.js').RichTextDoc}
     */
    const boldParagraph = (text) => ({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text, marks: [{ type: 'bold' }] }] },
      ],
    });
    // With the former backtracking regex, this input took minutes (CodeQL js/polynomial-redos).
    expect(richTextDocToMarkdown(boldParagraph(`a${spaces}b${spaces}`))).toBe(
      `**a${spaces}b**${spaces}`.trim(),
    );
    expect(richTextDocToMarkdown(boldParagraph(`x\t\n`))).toBe('**x**');
  });

  it('returns an empty string for a missing document', () => {
    expect(richTextDocToMarkdown(null)).toBe('');
    expect(richTextDocToMarkdown({ type: 'doc' })).toBe('');
  });
});
