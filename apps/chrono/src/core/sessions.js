// Session rules: start, pause, resume, stop, presence truncation, edits, manual entry.
// Every function takes the data, a payload and the time (and a new id when it creates a
// record) and returns NEW data; the input is never mutated. Unchanged records keep their
// reference, so the storage layer can write only what changed.
// When a function returns the very same `data` object, nothing changed.

import { startOfDay } from './dates.js';
import { presenceRanges } from './presence.js';

/** @typedef {import('../types.js').ChronoData} ChronoData */
/** @typedef {import('../types.js').Session} Session */

/**
 * Time elapsed since the session last started running.
 * @param {Session} s
 * @param {number} now
 */
const elapsed = (s, now) => now - /** @type {number} */ (s.lastStart);

/**
 * Pauses a running session: its elapsed time is added to the accumulated duration.
 * @param {Session} s
 * @param {number} now
 * @returns {Session}
 */
const toPaused = (s, now) => ({
  ...s,
  duration: (s.duration || 0) + elapsed(s, now),
  lastStart: null,
  status: 'paused',
});

/**
 * @param {Session} s
 * @param {number} now
 * @returns {Session}
 */
const toDone = (s, now) => {
  const addedDuration = s.status === 'running' ? elapsed(s, now) : 0;
  return {
    ...s,
    end: now,
    duration: (s.duration || 0) + addedDuration,
    lastStart: null,
    status: 'done',
  };
};

/**
 * Active timers: every session that is not 'done' (running or paused). Several timers can
 * run in parallel: starting one never stops the others.
 * @param {Session[]} sessions
 * @returns {Session[]}
 */
export function activeSessions(sessions) {
  return sessions.filter((s) => s.status !== 'done');
}

/**
 * Starts a timer.
 * @param {ChronoData} data
 * @param {{ projectId: string, description?: string }} payload
 * @param {number} now
 * @param {string} newId id of the new session
 * @returns {ChronoData}
 */
export function startSession(data, { projectId, description = '' }, now, newId) {
  return {
    ...data,
    sessions: [
      ...data.sessions,
      {
        id: newId,
        projectId,
        description: description || '',
        start: now,
        lastStart: now,
        end: null,
        duration: 0,
        status: 'running',
      },
    ],
  };
}

/**
 * @param {ChronoData} data
 * @param {{ id: string }} payload
 * @param {number} now
 * @returns {ChronoData}
 */
export function pauseSession(data, { id }, now) {
  return {
    ...data,
    sessions: data.sessions.map((s) => {
      if (s.id !== id || s.status !== 'running') return s;
      return toPaused(s, now);
    }),
  };
}

/**
 * @param {ChronoData} data
 * @param {{ id: string }} payload
 * @param {number} now
 * @returns {ChronoData}
 */
export function resumeSession(data, { id }, now) {
  return {
    ...data,
    sessions: data.sessions.map((s) =>
      s.id === id && s.status === 'paused' ? { ...s, status: 'running', lastStart: now } : s,
    ),
  };
}

/**
 * @param {ChronoData} data
 * @param {{ id: string }} payload
 * @param {number} now
 * @returns {ChronoData}
 */
export function stopSession(data, { id }, now) {
  const stopped = {
    ...data,
    sessions: data.sessions.map((s) => {
      if (s.id !== id || s.status === 'done') return s;
      return toDone(s, now);
    }),
  };
  return truncateToPresence(stopped, [id], now);
}

/**
 * A working time greater than the presence makes no sense. For each session that has just
 * been stopped, the duration must not exceed the presence time overlapping its interval
 * [start, end] (parallel timers are therefore allowed: each session is judged on its own).
 * Without a clock-in for that day, nothing changes (presence unknown).
 * If the session was never paused (duration == end - start), `start` is moved forward by the
 * amount cut so that the drawn block matches the counted time; otherwise only `duration` changes.
 * @param {ChronoData} data
 * @param {string[]} endedIds
 * @param {number} now
 * @returns {ChronoData} the same object when nothing is cut
 */
export function truncateToPresence(data, endedIds, now) {
  const dayStart = startOfDay(new Date(now));
  const dayEnd = dayStart + 86400000;
  const events = data.attendance.filter((p) => p.at >= dayStart && p.at < dayEnd);
  if (!events.some((e) => e.type === 'arrival')) return data;
  const ranges = presenceRanges(events, now);
  /** @type {Map<string, { covered: number, cut: number, withoutBreaks: boolean }>} */
  const cuts = new Map();
  for (const s of data.sessions) {
    if (!endedIds.includes(s.id) || s.status !== 'done') continue;
    if (s.start < dayStart || s.start >= dayEnd) continue;
    const end = /** @type {number} */ (s.end);
    const duration = s.duration || 0;
    const covered = ranges.reduce(
      (acc, p) => acc + Math.max(0, Math.min(end, p.end) - Math.max(s.start, p.start)),
      0,
    );
    if (duration > covered + 1000) {
      // 1 s tolerance
      cuts.set(s.id, {
        covered,
        cut: duration - covered,
        withoutBreaks: Math.abs(duration - (end - s.start)) <= 1000,
      });
    }
  }
  if (cuts.size === 0) return data;
  return {
    ...data,
    sessions: data.sessions.map((s) => {
      const c = cuts.get(s.id);
      if (!c) return s;
      return { ...s, duration: c.covered, start: c.withoutBreaks ? s.start + c.cut : s.start };
    }),
  };
}

/**
 * Pauses every running timer.
 * @param {ChronoData} data
 * @param {number} now
 * @returns {ChronoData} the same object when no timer is running
 */
export function pauseAll(data, now) {
  let changed = false;
  const sessions = data.sessions.map((s) => {
    if (s.status !== 'running') return s;
    changed = true;
    return toPaused(s, now);
  });
  return changed ? { ...data, sessions } : data;
}

/**
 * Resumes every paused timer.
 * @param {ChronoData} data
 * @param {number} now
 * @returns {ChronoData} the same object when no timer is paused
 */
export function resumeAll(data, now) {
  let changed = false;
  const sessions = data.sessions.map((s) => {
    if (s.status !== 'paused') return s;
    changed = true;
    return /** @type {Session} */ ({ ...s, status: 'running', lastStart: now });
  });
  return changed ? { ...data, sessions } : data;
}

/**
 * Stops every active timer.
 * @param {ChronoData} data
 * @param {number} now
 * @returns {ChronoData} the same object when no timer is active
 */
export function stopAll(data, now) {
  let changed = false;
  /** @type {string[]} */
  const endedIds = [];
  const sessions = data.sessions.map((s) => {
    if (s.status === 'done') return s;
    changed = true;
    endedIds.push(s.id);
    return toDone(s, now);
  });
  return changed ? truncateToPresence({ ...data, sessions }, endedIds, now) : data;
}

/**
 * @param {ChronoData} data
 * @param {{ id: string }} payload
 * @returns {ChronoData}
 */
export function deleteSession(data, { id }) {
  return { ...data, sessions: data.sessions.filter((s) => s.id !== id) };
}

/**
 * Edits a session. For a finished session, the duration follows `start` and `end` unless it
 * is given explicitly; pauses already counted are kept.
 * @param {ChronoData} data
 * @param {{ id: string, patch: Partial<Session> }} payload
 * @returns {ChronoData}
 */
export function updateSession(data, { id, patch }) {
  return {
    ...data,
    sessions: data.sessions.map((s) => {
      if (s.id !== id) return s;
      const next = { ...s, ...patch };
      if (next.status === 'done' && next.start != null && next.end != null) {
        if (patch.duration != null) {
          // explicit duration wins.
        } else if (s.status === 'done' && s.start != null && s.end != null) {
          // Keep the pause time already counted (old block - old duration).
          const pauses = Math.max(0, s.end - s.start - (s.duration || 0));
          next.duration = Math.max(0, next.end - next.start - pauses);
        } else {
          next.duration = Math.max(0, next.end - next.start);
        }
      } else if (next.status === 'running' && patch.start != null) {
        // A running session that was never paused (accumulated duration = 0 and
        // lastStart followed start): resynchronise lastStart on the new start so that
        // the live duration reflects the time correction at once and the block on the
        // timeline stays consistent.
        if ((s.duration || 0) === 0 && s.lastStart === s.start) {
          next.lastStart = patch.start;
        }
      }
      // A paused session: the accumulated duration is no longer tied to the start time, so
      // nothing is adjusted.
      return next;
    }),
  };
}

/**
 * Manual entry of an already finished session (correction / catch-up). It is NOT made
 * active: it has a start and an end, so status 'done' and the duration is computed at once.
 * @param {ChronoData} data
 * @param {{ projectId: string, description?: string, start: number, end: number }} payload
 * @param {string} newId
 * @returns {ChronoData} the same object when the entry is invalid
 */
export function addManualSession(data, { projectId, description = '', start, end }, newId) {
  if (!projectId || start == null || end == null) return data;
  if (end < start) return data;
  /** @type {Session} */
  const session = {
    id: newId,
    projectId,
    description: (description || '').trim(),
    start,
    end,
    lastStart: null,
    duration: Math.max(0, end - start),
    status: 'done',
  };
  return { ...data, sessions: [...data.sessions, session] };
}
