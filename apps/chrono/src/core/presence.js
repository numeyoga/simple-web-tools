// Live duration of a session and presence computed from the clock-in events.

/** @typedef {import('../types.js').Session} Session */
/** @typedef {import('../types.js').AttendanceEvent} AttendanceEvent */
/** @typedef {import('../types.js').TimeRange} TimeRange */

/**
 * Live duration of a session: adds the time since `lastStart` when it is running.
 * @param {Session | null | undefined} session
 * @param {number} now
 * @returns {number}
 */
export function liveDuration(session, now) {
  if (!session) return 0;
  if (session.status === 'running' && session.lastStart) {
    return (session.duration || 0) + (now - session.lastStart);
  }
  return session.duration || 0;
}

/**
 * Presence ranges of a day from its clock-in events. `arrival` and `break_end` open a range,
 * `break_start` and `departure` close it; a range still open ends at `now`.
 * @param {Pick<AttendanceEvent, 'type' | 'at'>[] | null | undefined} events
 * @param {number} now
 * @returns {TimeRange[]}
 */
export function presenceRanges(events, now) {
  const evs = (events || []).slice().sort((a, b) => a.at - b.at);
  /** @type {TimeRange[]} */
  const ranges = [];
  /** @type {number | null} */
  let openAt = null;
  for (const e of evs) {
    if (e.type === 'arrival' || e.type === 'break_end') {
      if (openAt == null) openAt = e.at;
    } else if (e.type === 'break_start' || e.type === 'departure') {
      if (openAt != null) {
        ranges.push({ start: openAt, end: Math.max(openAt, e.at) });
        openAt = null;
      }
    }
  }
  if (openAt != null) ranges.push({ start: openAt, end: Math.max(openAt, now) });
  return ranges;
}

/**
 * Presence duration of a day: sum of the ranges. When the day is not closed, the last range
 * runs until `now`.
 * @param {Pick<AttendanceEvent, 'type' | 'at'>[] | null | undefined} events
 * @param {number} now
 * @returns {number}
 */
export function presenceDuration(events, now) {
  return presenceRanges(events, now).reduce((total, p) => total + (p.end - p.start), 0);
}
