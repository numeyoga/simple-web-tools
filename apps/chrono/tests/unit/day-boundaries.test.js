// Day arithmetic: a calendar day is 23, 24 or 25 hours long, so its end is the next local
// midnight, never `start + 24 h`. Each block runs in its own time zone.
import { describe, expect, test } from 'vitest';
import { attendanceState, recordAttendance } from '../../src/core/attendance.js';
import { dayBounds } from '../../src/core/dates.js';
import { stopSession } from '../../src/core/sessions.js';
import { emptyData } from './support/data.js';
import { DST_CASES, local, useTimeZone } from './support/timezone.js';

const H = 3_600_000;

describe.each(DST_CASES)('in $zone', ({ zone, short, long }) => {
  useTimeZone(zone);

  test('dayBounds spans 24 h on an ordinary day', () => {
    const bounds = dayBounds(local('2026-06-10', 15, 30));

    expect(bounds.start).toBe(local('2026-06-10', 0));
    expect(bounds.end).toBe(local('2026-06-11', 0));
    expect(bounds.end - bounds.start).toBe(24 * H);
  });

  test.runIf(short)('dayBounds spans 23 h on the spring-forward day', () => {
    const bounds = dayBounds(local(/** @type {string} */ (short), 12));

    expect(bounds.end - bounds.start).toBe(23 * H);
    expect(bounds.end).toBe(
      local(
        /** @type {string} */ (short).replace(/\d\d$/, (d) =>
          String(Number(d) + 1).padStart(2, '0'),
        ),
        0,
      ),
    );
  });

  test.runIf(long)('dayBounds spans 25 h on the fall-back day', () => {
    const bounds = dayBounds(local(/** @type {string} */ (long), 12));

    expect(bounds.end - bounds.start).toBe(25 * H);
  });

  test.runIf(long)(
    'stopping a timer late on a 25 h day counts the presence of the last hour',
    () => {
      const day = /** @type {string} */ (long);
      // Presence 08:00-22:00 and again from 23:10; the timer has run since 09:00 without a pause.
      const data = {
        ...emptyData(),
        attendance: [
          { id: 'a1', type: /** @type {const} */ ('arrival'), at: local(day, 8) },
          { id: 'a2', type: /** @type {const} */ ('break_start'), at: local(day, 22) },
          { id: 'a3', type: /** @type {const} */ ('break_end'), at: local(day, 23, 10) },
        ],
        sessions: [
          {
            id: 's1',
            projectId: 'p1',
            description: '',
            start: local(day, 9),
            lastStart: local(day, 9),
            end: null,
            duration: 0,
            status: /** @type {const} */ ('running'),
          },
        ],
      };

      const after = stopSession(data, { id: 's1' }, local(day, 23, 30));

      // 09:00-22:00 (13 h) + 23:10-23:30 (20 min), not 13 h only.
      expect(after.sessions[0]?.duration).toBe(13 * H + 20 * 60_000);
    },
  );

  test('attendance events of the next day do not count today', () => {
    const events = [
      { id: 'a1', type: /** @type {const} */ ('arrival'), at: local('2026-06-11', 9) },
    ];

    const state = attendanceState(events, local('2026-06-10', 12));

    expect(state).toEqual({ status: 'not_arrived', events: [] });
  });

  test('attendance events of the previous day do not count today', () => {
    const events = [
      { id: 'a1', type: /** @type {const} */ ('arrival'), at: local('2026-06-09', 23, 59) },
    ];

    const state = attendanceState(events, local('2026-06-10', 0, 1));

    expect(state.status).toBe('not_arrived');
  });

  test('an event at the very last minute of the day still counts', () => {
    const events = [
      { id: 'a1', type: /** @type {const} */ ('arrival'), at: local('2026-06-10', 23, 59) },
    ];

    const state = attendanceState(events, local('2026-06-10', 23, 59));

    expect(state.status).toBe('present');
  });

  test('a break end resumes only the break of the same day', () => {
    const data = {
      ...emptyData(),
      attendance: [
        {
          id: 'b1',
          type: /** @type {const} */ ('break_start'),
          at: local('2026-06-11', 12),
          suspendedSessionIds: ['s1'],
        },
      ],
      sessions: [
        {
          id: 's1',
          projectId: 'p1',
          description: '',
          start: local('2026-06-10', 9),
          lastStart: null,
          end: null,
          duration: H,
          status: /** @type {const} */ ('paused'),
        },
      ],
    };

    const after = recordAttendance(data, { type: 'break_end' }, local('2026-06-10', 14), 'a2');

    expect(after.sessions[0]?.status).toBe('paused');
  });
});
