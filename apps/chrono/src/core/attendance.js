// Attendance (clock-in): state machine of the day and the events that drive the timers.

import { dayBounds } from './dates.js';
import { truncateToPresence } from './sessions.js';

/** @typedef {import('../types.js').ChronoData} ChronoData */
/** @typedef {import('../types.js').AttendanceEvent} AttendanceEvent */
/** @typedef {import('../types.js').Session} Session */
/** @typedef {import('../types.js').AttendanceState} AttendanceState */
/** @typedef {import('../types.js').AttendanceType} AttendanceType */

/**
 * State of today's clock-in.
 * @param {AttendanceEvent[]} attendance
 * @param {number} now
 * @returns {AttendanceState}
 */
export function attendanceState(attendance, now) {
  const { start, end } = dayBounds(now);
  const events = attendance.filter((p) => p.at >= start && p.at < end).sort((a, b) => a.at - b.at);
  const last = events[events.length - 1];
  if (!last) return { status: 'not_arrived', events };
  if (last.type === 'arrival' || last.type === 'break_end') {
    return { status: 'present', since: last.at, events };
  }
  if (last.type === 'break_start') return { status: 'on_break', since: last.at, events };
  if (last.type === 'departure') return { status: 'left', events };
  return { status: 'present', events };
}

/**
 * Records a clock-in event now, and applies its effect on the timers:
 * - `departure`: stops EVERY active timer (no automatic resume the next day), then truncates
 *   them on the presence;
 * - `break_start`: pauses every running timer and remembers which, to resume exactly those;
 * - `break_end`: resumes the timers suspended by the last `break_start` of the day, if they
 *   are still paused.
 * @param {ChronoData} data
 * @param {{ type: AttendanceType }} payload
 * @param {number} now
 * @param {string} newId id of the new event
 * @returns {ChronoData}
 */
export function recordAttendance(data, { type }, now, newId) {
  /** @type {AttendanceEvent} */
  const event = { id: newId, type, at: now };
  let sessions = data.sessions;
  /** @type {string[]} */
  const departureEndedIds = [];

  if (type === 'departure') {
    const stoppedSessions = sessions.map((s) => {
      if (s.status === 'done') return s;
      departureEndedIds.push(s.id);
      const addedDuration = s.status === 'running' ? now - /** @type {number} */ (s.lastStart) : 0;
      return /** @type {Session} */ ({
        ...s,
        end: now,
        duration: (s.duration || 0) + addedDuration,
        lastStart: null,
        status: 'done',
      });
    });
    if (departureEndedIds.length) sessions = stoppedSessions;
  }

  if (type === 'break_start') {
    /** @type {string[]} */
    const suspended = [];
    const pausedSessions = sessions.map((s) => {
      if (s.status !== 'running') return s;
      suspended.push(s.id);
      return /** @type {Session} */ ({
        ...s,
        duration: (s.duration || 0) + (now - /** @type {number} */ (s.lastStart)),
        lastStart: null,
        status: 'paused',
      });
    });
    if (suspended.length) {
      event.suspendedSessionIds = suspended;
      sessions = pausedSessions;
    }
  }

  if (type === 'break_end') {
    const { start, end } = dayBounds(now);
    const lastBreakStart = data.attendance
      .filter((p) => p.type === 'break_start' && p.at >= start && p.at < end)
      .sort((a, b) => a.at - b.at)
      .slice(-1)[0];
    const ids = lastBreakStart?.suspendedSessionIds ?? [];
    if (ids.length) {
      const setIds = new Set(ids);
      sessions = sessions.map((s) =>
        setIds.has(s.id) && s.status === 'paused'
          ? /** @type {Session} */ ({ ...s, status: 'running', lastStart: now })
          : s,
      );
    }
  }

  const after = { ...data, sessions, attendance: [...data.attendance, event] };
  // The departure has just closed the presence: trim the sessions just stopped if needed so
  // that the work does not exceed the presence.
  if (type === 'departure' && departureEndedIds.length) {
    return truncateToPresence(after, departureEndedIds, now);
  }
  return after;
}

/**
 * @param {ChronoData} data
 * @param {{ type: AttendanceType, at: number }} payload
 * @param {string} newId
 * @returns {ChronoData}
 */
export function addAttendance(data, { type, at }, newId) {
  return { ...data, attendance: [...data.attendance, { id: newId, type, at }] };
}

/**
 * @param {ChronoData} data
 * @param {{ id: string, patch: Partial<AttendanceEvent> }} payload
 * @returns {ChronoData}
 */
export function updateAttendance(data, { id, patch }) {
  return {
    ...data,
    attendance: data.attendance.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  };
}

/**
 * @param {ChronoData} data
 * @param {{ id: string }} payload
 * @returns {ChronoData}
 */
export function deleteAttendance(data, { id }) {
  return { ...data, attendance: data.attendance.filter((p) => p.id !== id) };
}
