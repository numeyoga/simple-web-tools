// Where a tooltip goes against its trigger: pure geometry, the DOM part is checked by the
// journeys (tests/e2e/tooltips.spec.js).
import { describe, expect, test } from 'vitest';
import { placeTooltip } from '../../src/adapters/dom/tooltip.js';

const VIEWPORT = { width: 1000, height: 600 };
const SIZE = { width: 120, height: 24 };
/** A trigger of 32 x 32 px with its top-left corner at (x, y). @param {number} x @param {number} y */
const trigger = (x, y) => ({ left: x, top: y, right: x + 32, bottom: y + 32 });

describe('placeTooltip', () => {
  test('opens above the trigger, centred on it', () => {
    const place = placeTooltip(trigger(400, 300), SIZE, VIEWPORT, 'top');
    expect(place).toEqual({ side: 'top', left: 416 - 60, top: 300 - 8 - 24 });
  });

  test('opens below when that side is preferred and has room', () => {
    const place = placeTooltip(trigger(400, 300), SIZE, VIEWPORT, 'bottom');
    expect(place).toEqual({ side: 'bottom', left: 356, top: 332 + 8 });
  });

  test('falls back to the other side when the preferred one has no room', () => {
    expect(placeTooltip(trigger(400, 10), SIZE, VIEWPORT, 'top').side).toBe('bottom');
    expect(placeTooltip(trigger(400, 570), SIZE, VIEWPORT, 'bottom').side).toBe('top');
  });

  test('takes the side with more room when neither fits', () => {
    const tall = { width: 120, height: 400 };
    expect(placeTooltip(trigger(400, 100), tall, VIEWPORT, 'top').side).toBe('bottom');
    expect(placeTooltip(trigger(400, 400), tall, VIEWPORT, 'bottom').side).toBe('top');
  });

  test('stays inside the window horizontally', () => {
    expect(placeTooltip(trigger(0, 300), SIZE, VIEWPORT, 'top').left).toBe(4);
    expect(placeTooltip(trigger(980, 300), SIZE, VIEWPORT, 'top').left).toBe(1000 - 120 - 4);
  });
});
