// The timers of the presenter window, as values. Nothing here reads the clock: every function takes
// `now` (milliseconds), so the adapter owns the interval and the tests own the time.
//
// - The total timer runs between an explicit play and pause.
// - The slide timer counts from the moment the current slide appeared and starts again at every
//   change of slide. It does nothing else by itself.
//
// Timestamps rather than increments keep the figures exact when the browser slows a background tab.

/**
 * @typedef {{ slideStart: number, accumulated: number, runningSince: number | null }} Timers
 * @typedef {{ total: number, slide: number, running: boolean }} Readout
 */

/** @param {number} now @returns {Timers} */
export function createTimers(now) {
  return { slideStart: now, accumulated: 0, runningSince: null };
}

/** @param {Timers} timers @param {number} now @returns {Readout} */
export function readout(timers, now) {
  return {
    total: timers.accumulated + (timers.runningSince === null ? 0 : now - timers.runningSince),
    slide: now - timers.slideStart,
    running: timers.runningSince !== null,
  };
}

/** @param {Timers} timers @param {number} now @returns {Timers} */
export function play(timers, now) {
  return timers.runningSince === null ? { ...timers, runningSince: now } : timers;
}

/** @param {Timers} timers @param {number} now @returns {Timers} */
export function pause(timers, now) {
  if (timers.runningSince === null) return timers;
  return {
    ...timers,
    accumulated: timers.accumulated + (now - timers.runningSince),
    runningSince: null,
  };
}

/** The total goes back to zero; it keeps running when it was running. @param {Timers} timers @param {number} now @returns {Timers} */
export function resetTotal(timers, now) {
  return { ...timers, accumulated: 0, runningSince: timers.runningSince === null ? null : now };
}

/** @param {Timers} timers @param {number} now @returns {Timers} */
export function resetSlide(timers, now) {
  return { ...timers, slideStart: now };
}
