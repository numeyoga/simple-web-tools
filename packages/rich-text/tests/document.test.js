import { describe, expect, it } from 'vitest';
import {
  ALLOWED_IMAGE_MIMES,
  EMPTY_RICH_DOC,
  collectDocAssetIds,
  sanitizeLinkHref,
  sanitizeRichTextDoc,
} from '../src/index.js';

describe('sanitizeRichTextDoc', () => {
  it('drops dangerous links and remote images, and keeps local images', () => {
    const dirtyDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Safe link',
              marks: [{ type: 'link', attrs: { href: 'https://example.org/' } }],
            },
            {
              type: 'text',
              text: 'XSS link',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
          ],
        },
        { type: 'image', attrs: { src: 'https://tracker.example/pixel.png', alt: 'remote' } },
        { type: 'localImage', attrs: { assetId: 'asset-1', alt: 'Local capture' } },
      ],
    };

    const clean = sanitizeRichTextDoc(dirtyDoc);
    expect(clean.content).toHaveLength(2);
    expect(clean.content?.[0]?.content?.[0]?.marks).toEqual([
      {
        type: 'link',
        attrs: { href: 'https://example.org/', target: '_blank', rel: 'noopener noreferrer' },
      },
    ]);
    expect(clean.content?.[0]?.content?.[1]?.marks).toEqual([]);
    expect(clean.content?.[1]).toEqual({
      type: 'localImage',
      attrs: { assetId: 'asset-1', alt: 'Local capture' },
    });
    expect(collectDocAssetIds(clean)).toEqual(['asset-1']);
  });

  it('falls back to the empty document for anything that is not a document', () => {
    expect(sanitizeRichTextDoc(null)).toBe(EMPTY_RICH_DOC);
    expect(sanitizeRichTextDoc('text')).toBe(EMPTY_RICH_DOC);
    expect(sanitizeRichTextDoc({ type: 'paragraph' })).toBe(EMPTY_RICH_DOC);
    expect(sanitizeRichTextDoc({ type: 'doc', content: [{ type: 'script' }] })).toBe(
      EMPTY_RICH_DOC,
    );
  });

  it('clamps heading levels, truncates alt texts and drops images without an asset', () => {
    const clean = sanitizeRichTextDoc({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 9 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'localImage', attrs: { assetId: '  ', alt: 'No asset' } },
        { type: 'localImage', attrs: { assetId: ' a1 ', alt: 'x'.repeat(300) } },
      ],
    });
    expect(clean.content?.[0]?.attrs).toEqual({ level: 2 });
    expect(clean.content).toHaveLength(2);
    expect(clean.content?.[1]?.attrs).toEqual({ assetId: 'a1', alt: 'x'.repeat(200) });
  });
});

describe('sanitizeLinkHref', () => {
  it('accepts https and mailto only', () => {
    expect(sanitizeLinkHref('https://example.org/a b')).toBe('https://example.org/a%20b');
    expect(sanitizeLinkHref('mailto:me@example.org')).toBe('mailto:me@example.org');
    expect(sanitizeLinkHref('http://example.org')).toBeNull();
    expect(sanitizeLinkHref('javascript:alert(1)')).toBeNull();
    expect(sanitizeLinkHref('data:text/html,x')).toBeNull();
    expect(sanitizeLinkHref('not a url')).toBeNull();
    expect(sanitizeLinkHref('   ')).toBeNull();
    expect(sanitizeLinkHref(42)).toBeNull();
  });
});

describe('collectDocAssetIds', () => {
  it('lists every local image once, nested ones included', () => {
    const doc = sanitizeRichTextDoc({
      type: 'doc',
      content: [
        { type: 'localImage', attrs: { assetId: 'a', alt: '' } },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'localImage', attrs: { assetId: 'b', alt: '' } }],
            },
          ],
        },
        { type: 'localImage', attrs: { assetId: 'a', alt: '' } },
      ],
    });
    expect(collectDocAssetIds(doc)).toEqual(['a', 'b']);
    expect(collectDocAssetIds(EMPTY_RICH_DOC)).toEqual([]);
  });
});

describe('ALLOWED_IMAGE_MIMES', () => {
  it('lists the raster formats the editor accepts, and no SVG', () => {
    expect([...ALLOWED_IMAGE_MIMES].sort()).toEqual([
      'image/gif',
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
  });
});
