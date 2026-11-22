import { describe, expect, it } from 'vitest';
import { clamp, decodeEntities, escapeHtml } from '../../src/core/text.js';

describe('text helpers', () => {
  it('escapes the characters that matter in HTML, quotes included', () => {
    expect(escapeHtml('<a href="x">&\'</a>')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;'&lt;/a&gt;");
  });

  it('decodes named, decimal and hexadecimal character references', () => {
    expect(decodeEntities('Tom &amp; Jerry &lt;3 &quot;x&quot; &#39;y&#39; &#x41;&#66;')).toBe(
      'Tom & Jerry <3 "x" \'y\' AB',
    );
  });

  it('leaves an unknown reference, and one out of range, as written', () => {
    expect(decodeEntities('&unknown; &#99999999; &#0;')).toBe('&unknown; &#99999999; &#0;');
  });

  it('clamps a number into a range', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});
