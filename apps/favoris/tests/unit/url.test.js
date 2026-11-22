import { describe, expect, test } from 'vitest';
import {
  FAVICON_SERVICE,
  faviconUrl,
  hostOf,
  normalizeUrl,
  parseUrl,
  safeHref,
  siteInitial,
} from '../../src/core/url.js';

describe('parseUrl: only http and https are accepted', () => {
  test.each([
    ['https://example.org', 'https://example.org'],
    ['http://example.org/path?q=1#top', 'http://example.org/path?q=1#top'],
    ['HTTPS://Example.org', 'HTTPS://Example.org'],
    ['  https://example.org  ', 'https://example.org'],
    ['example.org', 'https://example.org'],
    ['www.example.org/a b', 'https://www.example.org/a b'],
    ['localhost:3000', 'https://localhost:3000'],
    ['localhost:3000/app', 'https://localhost:3000/app'],
    ['192.168.1.10:8080', 'https://192.168.1.10:8080'],
    ['//example.org/x', 'https://example.org/x'],
  ])('%s is kept as %s', (input, url) => {
    expect(parseUrl(input)).toEqual({ ok: true, url });
  });

  test.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    ' javascript:alert(document.domain)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'blob:https://example.org/uuid',
    'ftp://example.org/file',
    'mailto:someone@example.org',
    'tel:+33123456789',
    'chrome://settings',
    'about:blank',
  ])('%s is refused as an unsupported scheme', (input) => {
    expect(parseUrl(input)).toEqual({ ok: false, reason: 'unsupported' });
  });

  test('an address that smuggles a scheme with a control character does not get through', () => {
    // The URL parser drops tabs and line breaks, so "java\nscript:" would become "javascript:".
    const result = parseUrl('java\nscript:alert(1)');
    expect(result.ok).toBe(false);
  });

  test('empty, blank and non-text values are "empty"', () => {
    for (const input of ['', '   ', null, undefined, 42, {}]) {
      expect(parseUrl(input)).toEqual({ ok: false, reason: 'empty' });
    }
  });

  test('an address that does not parse is "invalid"', () => {
    for (const input of [
      'http://',
      'https://',
      'http:example.org',
      'https://exa mple.org',
      'http://[bad',
    ]) {
      expect(parseUrl(input)).toEqual({ ok: false, reason: 'invalid' });
    }
    expect(parseUrl(`https://example.org/${'a'.repeat(3000)}`)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  test('normalizeUrl is the address or null', () => {
    expect(normalizeUrl('example.org')).toBe('https://example.org');
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('safeHref, the last gate before the DOM', () => {
  test('lets http and https through and nothing else', () => {
    expect(safeHref('https://example.org')).toBe('https://example.org');
    expect(safeHref('http://example.org')).toBe('http://example.org');
    for (const url of ['javascript:alert(1)', 'data:text/html,x', 'example.org', '', 'file:///x']) {
      expect(safeHref(url)).toBeNull();
    }
  });
});

describe('the site of a link', () => {
  test('hostOf drops www.', () => {
    expect(hostOf('https://www.example.org/a')).toBe('example.org');
    expect(hostOf('https://docs.example.org')).toBe('docs.example.org');
    expect(hostOf('nope')).toBe('');
  });

  test('the initial is the first letter of the host, else of the name', () => {
    expect(siteInitial({ url: 'https://www.github.com', name: 'Code' })).toBe('G');
    expect(siteInitial({ url: 'broken', name: 'été' })).toBe('É');
    expect(siteInitial({ url: 'broken', name: '  ' })).toBe('?');
  });

  test('the icon address is Google’s service with the host and nothing else', () => {
    const url = faviconUrl('https://www.github.com/user/repo?token=secret#frag');
    expect(url).toBe(`${FAVICON_SERVICE}?sz=32&domain=www.github.com`);
    expect(url).not.toContain('secret');
    expect(faviconUrl('javascript:alert(1)')).toBe('');
    expect(faviconUrl('nope')).toBe('');
  });
});
