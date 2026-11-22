import { describe, expect, it } from 'vitest';
import { assetKeyOf, classifyImage, safeLinkHref } from '../../src/core/assets.js';

const folder = new Set(['assets/a.png', 'assets/my pic.png', 'b.svg']);
/** @param {string} source */
const classify = (source) => classifyImage(source, (key) => folder.has(key));

describe('assetKeyOf', () => {
  it('reads a relative reference as a path of the folder', () => {
    expect(assetKeyOf('assets/a.png')).toBe('assets/a.png');
    expect(assetKeyOf('./assets/a.png')).toBe('assets/a.png');
    expect(assetKeyOf('assets//a.png')).toBe('assets/a.png');
    expect(assetKeyOf('assets/my%20pic.png')).toBe('assets/my pic.png');
    expect(assetKeyOf('assets/a.png?v=2#top')).toBe('assets/a.png');
  });

  it('refuses what leaves the folder or is not a path', () => {
    for (const source of [
      '',
      '  ',
      '../secret.png',
      'assets/../../secret.png',
      '/etc/passwd',
      '\\windows\\a.png',
      'https://example.com/a.png',
      '//example.com/a.png',
      'javascript:alert(1)',
      'file:///etc/passwd',
      'assets/%E0%A4%A.png',
    ]) {
      expect(assetKeyOf(source), source).toBeNull();
    }
  });
});

describe('classifyImage', () => {
  it('finds the images of the folder', () => {
    expect(classify('assets/a.png')).toEqual({ kind: 'asset', key: 'assets/a.png' });
    expect(classify('./b.svg')).toEqual({ kind: 'asset', key: 'b.svg' });
    expect(classify('assets/my%20pic.png')).toEqual({ kind: 'asset', key: 'assets/my pic.png' });
  });

  it('says the image is missing when no file has the path', () => {
    expect(classify('assets/nope.png')).toEqual({
      kind: 'blocked',
      reason: 'missing',
      shown: 'assets/nope.png',
    });
  });

  it('blocks the images of the web, with their address', () => {
    for (const source of [
      'https://example.com/a.png',
      'http://example.com/a.png',
      '//cdn.example/a.png',
    ]) {
      expect(classify(source)).toEqual({ kind: 'blocked', reason: 'remote', shown: source });
    }
  });

  it('blocks embedded images, with no address to show', () => {
    expect(classify('data:image/png;base64,AAAA')).toEqual({
      kind: 'blocked',
      reason: 'inline',
      shown: '',
    });
  });

  it('blocks any other address as unsupported', () => {
    for (const source of [
      'javascript:alert(1)',
      'file:///etc/passwd',
      'blob:abc',
      '../up.png',
      '',
    ]) {
      expect(classify(source)).toMatchObject({ kind: 'blocked', reason: 'unsupported' });
    }
  });
});

describe('safeLinkHref', () => {
  it('keeps http, https and mailto addresses', () => {
    expect(safeLinkHref('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(safeLinkHref(' http://example.com ')).toBe('http://example.com');
    expect(safeLinkHref('mailto:me@example.com')).toBe('mailto:me@example.com');
    expect(safeLinkHref('HTTPS://EXAMPLE.COM')).toBe('HTTPS://EXAMPLE.COM');
  });

  it('refuses everything else', () => {
    for (const href of [
      'javascript:alert(1)',
      ' JavaScript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:x',
      'file:///etc/passwd',
      'assets/doc.pdf',
      '#section',
      '//example.com',
      '',
    ]) {
      expect(safeLinkHref(href), href).toBeNull();
    }
  });
});
