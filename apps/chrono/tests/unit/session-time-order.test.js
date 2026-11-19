// A finished session must end after it starts: equal or reversed times are refused.
// A zero-duration session that is already stored stays readable and editable.
import { describe, expect, test } from 'vitest';
import { addManualSession, updateSession } from '../../src/core/sessions.js';
import { H, emptyData, finishedSession, h, session } from './support/data.js';

const entry = (/** @type {number} */ start, /** @type {number} */ end) => ({
  projectId: 'p1',
  description: 'x',
  start,
  end,
});

describe('addManualSession', () => {
  test('refuses an end equal to the start', () => {
    const data = emptyData();

    expect(addManualSession(data, entry(h(9), h(9)), 's9')).toBe(data);
  });

  test('refuses an end before the start', () => {
    const data = emptyData();

    expect(addManualSession(data, entry(h(10), h(9)), 's9')).toBe(data);
  });

  test('accepts an end one millisecond after the start', () => {
    const after = addManualSession(emptyData(), entry(h(9), h(9) + 1), 's9');

    expect(session(after, 's9').duration).toBe(1);
  });
});

describe('updateSession', () => {
  const stored = () => ({ ...emptyData(), sessions: [finishedSession()] });

  test('refuses an end moved onto the start', () => {
    const data = stored();

    expect(updateSession(data, { id: 's1', patch: { end: h(9) } })).toBe(data);
  });

  test('refuses an end moved before the start', () => {
    const data = stored();

    expect(updateSession(data, { id: 's1', patch: { end: h(8) } })).toBe(data);
  });

  test('refuses a start moved onto or after the end', () => {
    const data = stored();

    expect(updateSession(data, { id: 's1', patch: { start: h(17) } })).toBe(data);
    expect(updateSession(data, { id: 's1', patch: { start: h(18) } })).toBe(data);
  });

  test('still applies a valid time change', () => {
    const after = updateSession(stored(), { id: 's1', patch: { end: h(18) } });

    expect(session(after, 's1').end).toBe(h(18));
    expect(session(after, 's1').duration).toBe(8 * H);
  });

  test('keeps a stored zero-duration session editable when its times are not touched', () => {
    const zero = finishedSession({ start: h(9), end: h(9), duration: 0 });
    const data = { ...emptyData(), sessions: [zero] };

    const after = updateSession(data, { id: 's1', patch: { description: 'renamed' } });

    expect(session(after, 's1').description).toBe('renamed');
    expect(session(after, 's1').end).toBe(h(9));
  });

  test('lets a zero-duration session be given a real duration', () => {
    const zero = finishedSession({ start: h(9), end: h(9), duration: 0 });
    const data = { ...emptyData(), sessions: [zero] };

    const after = updateSession(data, { id: 's1', patch: { end: h(10) } });

    expect(session(after, 's1').duration).toBe(H);
  });

  test('does not apply the rule to a session that is still running', () => {
    const running = finishedSession({ end: null, status: 'running', lastStart: h(9) });
    const data = { ...emptyData(), sessions: [running] };

    const after = updateSession(data, { id: 's1', patch: { start: h(8) } });

    expect(session(after, 's1').start).toBe(h(8));
  });
});
