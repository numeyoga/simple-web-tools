import { describe, it, expect } from 'vitest';
import { durationFormat } from '../src/formatters.js';

describe('duration without Intl.DurationFormat', () => {
  it('composes unit number formats', () => {
    const f = durationFormat('en', 'short', undefined);
    // `undefined` selects the default parameter; force the missing-constructor path with null.
    const none = durationFormat('en', 'short', null);
    expect(none.format(65)).toBe('1 hr 5 min');
    expect(none.format(120)).toBe('2 hr');
    expect(none.format(5)).toBe('5 min');
    expect(none.format(0)).toBe('0 min');
    expect(durationFormat('fr', 'long', null).format(65)).toMatch(/^1\sheure 5\sminutes$/);
    expect(typeof f.format(1)).toBe('string');
  });

  it('does not share cache entries between the two paths', () => {
    const native = durationFormat('en', 'narrow');
    const fallback = durationFormat('en', 'narrow', null);
    expect(native).not.toBe(fallback);
  });
});
