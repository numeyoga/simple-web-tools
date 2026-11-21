import { describe, expect, it } from 'vitest';
import {
  allowsSingleKeyShortcut,
  formatCollapsedCategories,
  formatFlag,
  parseCollapsedCategories,
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

describe('the folded categories of the tree', () => {
  it('reads a JSON array of categories, in the order of the tree', () => {
    expect(parseCollapsedCategories('["archives","projects"]')).toEqual(['projects', 'archives']);
    expect(parseCollapsedCategories('[]')).toEqual([]);
  });

  it('ignores whatever is not a category, and a value that is not a list', () => {
    expect(parseCollapsedCategories('["areas","bogus",3,null,"areas"]')).toEqual(['areas']);
    for (const raw of [null, undefined, '', '{', 'areas', '{"areas":true}', '42', 'null']) {
      expect(parseCollapsedCategories(raw)).toEqual([]);
    }
  });

  it('writes a JSON array that reads back the same', () => {
    expect(formatCollapsedCategories(new Set(['resources', 'projects', 'bogus']))).toBe(
      '["projects","resources"]',
    );
    expect(parseCollapsedCategories(formatCollapsedCategories(['areas']))).toEqual(['areas']);
  });
});

describe('single-key shortcuts (WCAG 2.1.4)', () => {
  /** @param {Partial<Parameters<typeof allowsSingleKeyShortcut>[0]>} [over] */
  const press = (over = {}) => ({
    enabled: true,
    key: 'n',
    ctrl: false,
    alt: false,
    meta: false,
    shift: false,
    repeat: false,
    inTextField: false,
    dialogOpen: false,
    ...over,
  });

  it('runs on a plain key when nothing else uses it', () => {
    expect(allowsSingleKeyShortcut(press())).toBe(true);
    expect(allowsSingleKeyShortcut(press({ key: '1' }))).toBe(true);
  });

  it.each([
    ['the preference is off', { enabled: false }],
    ['the focus is in a text field', { inTextField: true }],
    ['a dialog is open', { dialogOpen: true }],
    ['Ctrl is held', { ctrl: true }],
    ['Alt is held', { alt: true }],
    ['Meta is held', { meta: true }],
    ['the key is held down', { repeat: true }],
  ])('does not run when %s', (_name, over) => {
    expect(allowsSingleKeyShortcut(press(over))).toBe(false);
    expect(allowsSingleKeyShortcut(press({ ...over, key: '1' }))).toBe(false);
  });

  it('refuses Shift on a letter: Shift+N is not N', () => {
    expect(allowsSingleKeyShortcut(press({ key: 'N', shift: true }))).toBe(false);
    expect(allowsSingleKeyShortcut(press({ key: 'é', shift: true }))).toBe(false);
  });

  it('allows a digit typed with Shift, as on an AZERTY keyboard', () => {
    expect(allowsSingleKeyShortcut(press({ key: '1', shift: true }))).toBe(true);
    expect(allowsSingleKeyShortcut(press({ key: '/', shift: true }))).toBe(true);
  });

  it('refuses AltGr, which reports Ctrl and Alt together', () => {
    expect(allowsSingleKeyShortcut(press({ key: '4', ctrl: true, alt: true }))).toBe(false);
  });
});
