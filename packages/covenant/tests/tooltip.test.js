// Where a tooltip goes against its trigger: the pure geometry of `Covenant.placeTooltip`. The
// DOM part (top layer, hover and focus, Escape, ARIA links) is checked by the journeys of the
// apps (tests/e2e/tooltips*.spec.js).
import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(async () => {
  // The script is a browser IIFE: give it just enough of a page to start.
  Object.assign(globalThis, {
    window: { addEventListener() {} },
    document: {
      readyState: 'complete',
      addEventListener() {},
      querySelectorAll: () => [],
    },
  });
  await import('../src/covenant.js');
});

const VIEWPORT = { width: 1000, height: 600 };
const SIZE = { width: 120, height: 24 };
/** A trigger of 32 x 32 px with its top-left corner at (x, y). @param {number} x @param {number} y */
const trigger = (x, y) => ({ left: x, top: y, right: x + 32, bottom: y + 32 });

/**
 * @param {{ left: number, top: number, right: number, bottom: number }} anchor
 * @param {{ width: number, height: number }} size
 * @param {{ width: number, height: number }} viewport
 * @param {'top' | 'bottom'} [prefer]
 * @param {number} [gap]
 */
const place = (anchor, size, viewport, prefer, gap) => {
  const placeTooltip = window.Covenant?.placeTooltip;
  if (!placeTooltip) throw new Error('Covenant.placeTooltip is missing');
  return placeTooltip(anchor, size, viewport, prefer, gap);
};

describe('the tooltip API of covenant.js', () => {
  it('exposes setTooltip, hideTooltips and placeTooltip', () => {
    expect(window.Covenant?.setTooltip).toBeTypeOf('function');
    expect(window.Covenant?.hideTooltips).toBeTypeOf('function');
    expect(window.Covenant?.placeTooltip).toBeTypeOf('function');
  });

  it('ignores a missing trigger and hides nothing when nothing is shown', () => {
    expect(() => window.Covenant?.setTooltip?.(null, 'Text')).not.toThrow();
    expect(() => window.Covenant?.hideTooltips?.()).not.toThrow();
  });
});

describe('placeTooltip', () => {
  it('opens above the trigger, centred on it', () => {
    expect(place(trigger(400, 300), SIZE, VIEWPORT, 'top')).toEqual({
      side: 'top',
      left: 416 - 60,
      top: 300 - 8 - 24,
    });
  });

  it('opens below when that side is preferred and has room', () => {
    expect(place(trigger(400, 300), SIZE, VIEWPORT, 'bottom')).toEqual({
      side: 'bottom',
      left: 356,
      top: 332 + 8,
    });
  });

  it('prefers the top when no side is given', () => {
    expect(place(trigger(400, 300), SIZE, VIEWPORT).side).toBe('top');
  });

  it('falls back to the other side when the preferred one has no room', () => {
    expect(place(trigger(400, 10), SIZE, VIEWPORT, 'top').side).toBe('bottom');
    expect(place(trigger(400, 570), SIZE, VIEWPORT, 'bottom').side).toBe('top');
  });

  it('takes the side with more room when neither fits', () => {
    const tall = { width: 120, height: 400 };
    expect(place(trigger(400, 100), tall, VIEWPORT, 'top').side).toBe('bottom');
    expect(place(trigger(400, 400), tall, VIEWPORT, 'bottom').side).toBe('top');
  });

  it('stays inside the window horizontally', () => {
    expect(place(trigger(0, 300), SIZE, VIEWPORT, 'top').left).toBe(4);
    expect(place(trigger(980, 300), SIZE, VIEWPORT, 'top').left).toBe(1000 - 120 - 4);
  });

  it('keeps a larger gap when it is given (a larger text size)', () => {
    expect(place(trigger(400, 300), SIZE, VIEWPORT, 'top', 12).top).toBe(300 - 12 - 24);
  });
});
