import { describe, expect, it } from 'vitest';
import {
  allowsSingleKeyShortcut,
  formatFlag,
  parseFlag,
  parseTextSize,
  parseTheme,
} from '../../src/core/preferences.js';

describe('stored values', () => {
  it('reads a theme, and treats anything else as the system theme', () => {
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('dark')).toBe('dark');
    for (const raw of [null, undefined, '', 'system', 'Dark', 'blue']) {
      expect(parseTheme(raw)).toBeNull();
    }
  });

  it('reads a text size, and treats anything else as automatic', () => {
    for (const size of ['standard', 'comfortable', 'large']) expect(parseTextSize(size)).toBe(size);
    for (const raw of [null, undefined, '', 'auto', 'huge', 'Large']) {
      expect(parseTextSize(raw)).toBe('auto');
    }
  });

  it('reads a flag written as 1 or 0, and falls back to the default for anything else', () => {
    expect(parseFlag('1', false)).toBe(true);
    expect(parseFlag('0', true)).toBe(false);
    for (const raw of [null, undefined, '', 'true', 'false', 'on', '2']) {
      expect(parseFlag(raw, true)).toBe(true);
      expect(parseFlag(raw, false)).toBe(false);
    }
  });

  it('writes a flag as 1 or 0', () => {
    expect(formatFlag(true)).toBe('1');
    expect(formatFlag(false)).toBe('0');
  });
});

describe('allowsSingleKeyShortcut (WCAG 2.1.4)', () => {
  const base = {
    enabled: true,
    key: 'o',
    ctrl: false,
    alt: false,
    meta: false,
    shift: false,
    repeat: false,
    inTextField: false,
    dialogOpen: false,
  };

  it('allows a plain key', () => {
    expect(allowsSingleKeyShortcut(base)).toBe(true);
  });

  it.each([
    ['the preference is off', { enabled: false }],
    ['the person types', { inTextField: true }],
    ['a dialog is open', { dialogOpen: true }],
    ['Ctrl is held', { ctrl: true }],
    ['Alt is held', { alt: true }],
    ['Meta is held', { meta: true }],
    ['the key repeats', { repeat: true }],
    ['Shift turns a letter into another key', { shift: true }],
  ])('refuses it when %s', (_why, change) => {
    expect(allowsSingleKeyShortcut({ ...base, ...change })).toBe(false);
  });

  it('allows a digit typed with Shift (AZERTY)', () => {
    expect(allowsSingleKeyShortcut({ ...base, key: '1', shift: true })).toBe(true);
  });
});
