import { describe, expect, test } from 'vitest';
import { updateSession } from '../../src/core/sessions.js';
import { H, h, session, finishedSession, emptyData } from './support/data.js';

/** 9h-17h with 1 h of pause already counted: duration = 7 h. */
const base = () => ({ ...emptyData(), sessions: [finishedSession()] });

describe('updateSession', () => {
  test('keeps the pauses already deducted', () => {
    let d = updateSession(base(), { id: 's1', patch: { end: h(18) } });
    expect(session(d, 's1').duration).toBe(8 * H); // 9h-18h minus 1h of pause

    d = updateSession(d, { id: 's1', patch: { start: h(10) } });
    expect(session(d, 's1').duration).toBe(7 * H); // 10h-18h minus 1h of pause
  });

  test('explicit duration wins, duration floored at 0', () => {
    let d = updateSession(base(), { id: 's1', patch: { end: h(18), duration: 2 * H } });
    expect(session(d, 's1').duration).toBe(2 * H);

    d = updateSession(d, { id: 's1', patch: { start: h(18), end: h(18) } });
    expect(session(d, 's1').duration).toBe(0);
  });

  test('session not done before the patch: end - start is computed', () => {
    const d = {
      ...emptyData(),
      sessions: [finishedSession({ end: null, duration: 30 * 60_000, status: 'paused' })],
    };

    const after = updateSession(d, { id: 's1', patch: { status: 'done', end: h(11) } });

    expect(session(after, 's1').duration).toBe(2 * H);
  });

  test('session without a pause: duration = end - start', () => {
    const d = { ...emptyData(), sessions: [finishedSession({ end: h(10), duration: H })] };

    const after = updateSession(d, { id: 's1', patch: { end: h(12) } });

    expect(session(after, 's1').duration).toBe(3 * H);
  });

  test('does not mutate the given data', () => {
    const d = base();
    const before = JSON.stringify(d);

    updateSession(d, { id: 's1', patch: { end: h(18) } });

    expect(JSON.stringify(d)).toBe(before);
  });
});
