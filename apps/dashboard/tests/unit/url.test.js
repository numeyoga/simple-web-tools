import { describe, expect, test } from 'vitest';
import { normalizeUrl, parseUrl, safeHref } from '../../src/core/url.js';

describe('parseUrl', () => {
  test.each([
    ['https://example.org/a?b=1', 'https://example.org/a?b=1'],
    ['http://example.org', 'http://example.org'],
    ['  example.org/x  ', 'https://example.org/x'],
    ['localhost:3000', 'https://localhost:3000'],
    ['//example.org', 'https://example.org'],
  ])('%j is %j', (raw, url) => {
    expect(parseUrl(raw)).toEqual({ ok: true, url });
  });

  test.each([
    ['', 'empty'],
    ['   ', 'empty'],
    [null, 'empty'],
    ['javascript:alert(1)', 'unsupported'],
    ['data:text/html,x', 'unsupported'],
    ['file:///etc/passwd', 'unsupported'],
    ['ftp://example.org', 'unsupported'],
    ['mailto:someone@example.org', 'unsupported'],
    ['http:example.org', 'invalid'],
    ['https://', 'invalid'],
    [`https://example.org/${'a'.repeat(2100)}`, 'invalid'],
  ])('%j is refused as %s', (raw, reason) => {
    expect(parseUrl(raw)).toEqual({ ok: false, reason });
  });

  test('normalizeUrl and safeHref are the last gates', () => {
    expect(normalizeUrl('example.org')).toBe('https://example.org');
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(safeHref('https://example.org')).toBe('https://example.org');
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('not a url')).toBeNull();
  });
});
