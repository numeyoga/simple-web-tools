// presenceRanges / presenceDuration (core/presence.js) and truncateToPresence (core/sessions.js),
// the latter through the public rules that trigger it.
import { describe, expect, test } from 'vitest';
import { recordAttendance } from '../../src/core/attendance.js';
import { presenceDuration, presenceRanges } from '../../src/core/presence.js';
import {
  stopSession,
  stopAll,
  startSession,
  pauseSession,
  resumeSession,
} from '../../src/core/sessions.js';
import { H, h, session, emptyData } from './support/data.js';

describe('presenceRanges', () => {
  test('closed ranges, open range up to now', () => {
    /** @type {{ type: import('../../src/types.js').AttendanceType, at: number }[]} */
    const ev = [
      { type: 'break_start', at: h(12) },
      { type: 'arrival', at: h(9) },
      { type: 'break_end', at: h(13) },
      { type: 'departure', at: h(17) },
    ];
    const bounds = (/** @type {{ start: number, end: number }[]} */ ranges) =>
      ranges.map((p) => [p.start, p.end]);

    expect(bounds(presenceRanges(ev, h(18)))).toEqual([
      [h(9), h(12)],
      [h(13), h(17)],
    ]);
    expect(bounds(presenceRanges(ev.slice(0, 2), h(15)))).toEqual([[h(9), h(12)]]);
    expect(bounds(presenceRanges([{ type: 'arrival', at: h(9) }], h(11)))).toEqual([[h(9), h(11)]]);
    expect(presenceDuration(ev, h(18))).toBe(7 * H);
    expect(presenceDuration([], h(18))).toBe(0);
  });
});

describe('truncating the sessions to the presence', () => {
  test('two parallel timers from 9h to 10h, presence 9h-10h: no cut', () => {
    let d = recordAttendance(emptyData(), { type: 'arrival' }, h(9), 'pt1');
    d = startSession(d, { projectId: 'p1', description: 'a' }, h(9), 'a');
    d = startSession(d, { projectId: 'p2', description: 'b' }, h(9), 'b');
    d = stopAll(d, h(10));

    expect(session(d, 'a').duration).toBe(H);
    expect(session(d, 'b').duration).toBe(H);
    expect(session(d, 'a').start).toBe(h(9));
  });

  test('timer 8h-12h, arrival at 9h: duration 3h and start at 9h', () => {
    let d = startSession(emptyData(), { projectId: 'p1', description: 'x' }, h(8), 'a');
    d = recordAttendance(d, { type: 'arrival' }, h(9), 'pt1');
    d = stopSession(d, { id: 'a' }, h(12));

    expect(session(d, 'a').duration).toBe(3 * H);
    expect(session(d, 'a').start).toBe(h(9));
    expect(session(d, 'a').end).toBe(h(12));
  });

  test('timer 9h-17h with a clocked break 12h-13h: duration 7h, nothing cut', () => {
    let d = recordAttendance(emptyData(), { type: 'arrival' }, h(9), 'pt1');
    d = startSession(d, { projectId: 'p1', description: 'x' }, h(9), 'a');
    d = recordAttendance(d, { type: 'break_start' }, h(12), 'pt2');
    d = recordAttendance(d, { type: 'break_end' }, h(13), 'pt3');
    d = stopSession(d, { id: 'a' }, h(17));

    expect(session(d, 'a').duration).toBe(7 * H);
    expect(session(d, 'a').start).toBe(h(9));
    expect(session(d, 'a').end).toBe(h(17));
  });

  test('without an arrival that day: nothing is cut', () => {
    let d = startSession(emptyData(), { projectId: 'p1', description: 'x' }, h(8), 'a');
    d = stopSession(d, { id: 'a' }, h(12));

    expect(session(d, 'a').duration).toBe(4 * H);
    expect(session(d, 'a').start).toBe(h(8));
  });

  test('timer paused before the arrival: only the duration is cut, not the start', () => {
    let d = startSession(emptyData(), { projectId: 'p1', description: 'x' }, h(8), 'a');
    d = pauseSession(d, { id: 'a' }, h(9)); // 1h counted
    d = recordAttendance(d, { type: 'arrival' }, h(10), 'pt1');
    d = resumeSession(d, { id: 'a' }, h(10));
    d = stopSession(d, { id: 'a' }, h(10, 30)); // 1h30 counted, 2h30 of block

    // presence 10h-10h30 = 30 min: duration brought back to 30 min, start unchanged (existing pause)
    expect(session(d, 'a').duration).toBe(30 * 60_000);
    expect(session(d, 'a').start).toBe(h(8));
    expect(session(d, 'a').end).toBe(h(10, 30));
  });

  test('departure: the stopped timers are truncated to the presence', () => {
    let d = startSession(emptyData(), { projectId: 'p1', description: 'x' }, h(8), 'a');
    d = recordAttendance(d, { type: 'arrival' }, h(9), 'pt1');
    d = recordAttendance(d, { type: 'departure' }, h(11), 'pt2');

    expect(session(d, 'a').duration).toBe(2 * H);
    expect(session(d, 'a').start).toBe(h(9));
  });
});
