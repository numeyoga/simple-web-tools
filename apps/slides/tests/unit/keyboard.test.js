import { describe, expect, it } from 'vitest';
import {
  GOTO_RESET_DELAY,
  interpretKey,
  isCharacterShortcut,
  isNavigationKey,
} from '../../src/core/keyboard.js';

/** @param {string} key @param {string} [buffer] @param {boolean} [characterShortcuts] */
const press = (key, buffer = '', characterShortcuts = true) =>
  interpretKey(key, buffer, { characterShortcuts });

describe('interpretKey', () => {
  it.each([
    ['ArrowRight', 'next'],
    ['ArrowDown', 'next'],
    [' ', 'next'],
    ['PageDown', 'next'],
    ['ArrowLeft', 'previous'],
    ['ArrowUp', 'previous'],
    ['PageUp', 'previous'],
    ['Home', 'first'],
    ['End', 'last'],
  ])('%s is the command %s, and the browser does not scroll', (key, type) => {
    expect(press(key)).toMatchObject({
      intent: { type: 'command', command: { type } },
      handled: true,
    });
  });

  it('toggles the overview with O, the ratio with R, and closes the overview with Escape', () => {
    for (const key of ['o', 'O']) {
      expect(press(key).intent).toEqual({ type: 'command', command: { type: 'toggle_overview' } });
    }
    for (const key of ['r', 'R']) {
      expect(press(key).intent).toEqual({ type: 'command', command: { type: 'toggle_ratio' } });
    }
    expect(press('Escape').intent).toEqual({
      type: 'command',
      command: { type: 'close_overview' },
    });
    expect(press('Escape').handled).toBe(false);
  });

  it('asks for the full screen with F and the presenter window with S', () => {
    expect(press('f').intent).toEqual({ type: 'fullscreen' });
    expect(press('S').intent).toEqual({ type: 'presenter' });
  });

  it('collects digits and goes to the slide on Enter (numbered from 1)', () => {
    const one = press('1');
    expect(one).toMatchObject({ intent: null, buffer: '1', restartTimer: true });
    const two = press('2', one.buffer);
    expect(two.buffer).toBe('12');
    expect(press('Enter', two.buffer)).toMatchObject({
      intent: { type: 'command', command: { type: 'navigate', index: 11 } },
      buffer: '',
    });
  });

  it('does nothing on Enter without digits, and ignores other keys', () => {
    expect(press('Enter')).toMatchObject({ intent: null, handled: false });
    expect(press('x', '4')).toMatchObject({ intent: null, buffer: '4', handled: false });
    expect(press('Shift', '4').buffer).toBe('4');
  });

  it('drops the digits typed so far when a navigation key is pressed', () => {
    expect(press('ArrowRight', '12').buffer).toBe('');
  });

  it('with the letter and digit shortcuts off, only navigation keys and Escape work', () => {
    for (const key of ['o', 'r', 'f', 's', '5']) {
      expect(press(key, '', false)).toMatchObject({ intent: null, handled: false });
    }
    expect(press('ArrowRight', '', false).intent).toMatchObject({ type: 'command' });
    expect(press('Escape', '', false).intent).toMatchObject({ type: 'command' });
    expect(press('Home', '', false).intent).toMatchObject({ type: 'command' });
  });

  it('classifies the keys: letters and digits are character shortcuts, arrows are not', () => {
    for (const key of ['o', 'S', 'r', 'F', '0', '9']) expect(isCharacterShortcut(key)).toBe(true);
    for (const key of ['ArrowRight', ' ', 'Home', 'Escape', 'Enter', 'x']) {
      expect(isCharacterShortcut(key)).toBe(false);
    }
    expect(isNavigationKey('PageDown')).toBe(true);
    expect(isNavigationKey('o')).toBe(false);
  });

  it('waits one second for the Enter that follows the digits', () => {
    expect(GOTO_RESET_DELAY).toBe(1000);
  });
});
