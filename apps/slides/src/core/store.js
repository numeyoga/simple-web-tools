// The state of the main window and its transitions. `reduce(state, command)` is pure: it returns
// the next state and the effects the adapter must run (decision 0004). Nothing here touches the
// page, the channel or the clock.
import { clamp } from './text.js';
import { DEFAULT_RATIO } from './parser.js';

/** @typedef {import('./parser.js').Presentation} Presentation */
/** @typedef {import('./parser.js').Ratio} Ratio */
/** @typedef {{ code: import('./errors.js').PresentationErrorCode, detail: string }} LoadFailure */

/**
 * @typedef {object} State
 * @property {'empty' | 'ready'} status `empty`: nothing is open (the home screen)
 * @property {LoadFailure | null} error why the last folder could not be opened
 * @property {Presentation | null} presentation
 * @property {Readonly<Record<string, string>>} assets image path to object URL
 * @property {number} currentIndex
 * @property {'presentation' | 'overview'} mode
 * @property {Ratio} ratio
 */

/**
 * @typedef {{ type: 'loaded', presentation: Presentation, assets: Record<string, string> }
 *   | { type: 'failed', error: LoadFailure }
 *   | { type: 'dismiss_error' }
 *   | { type: 'closed' }
 *   | { type: 'navigate', index: number }
 *   | { type: 'next' } | { type: 'previous' } | { type: 'first' } | { type: 'last' }
 *   | { type: 'open_overview' } | { type: 'close_overview' } | { type: 'toggle_overview' }
 *   | { type: 'toggle_ratio' }} Command
 */

/**
 * @typedef {{ type: 'publish' }
 *   | { type: 'sync', index: number }
 *   | { type: 'release_assets', urls: string[] }} Effect
 *   `publish`: send the whole presentation to the presenter window; `sync`: send the slide
 *   number; `release_assets`: these object URLs are no longer used
 */

/** @type {State} */
export const initialState = Object.freeze({
  status: 'empty',
  error: null,
  presentation: null,
  assets: Object.freeze({}),
  currentIndex: 0,
  mode: 'presentation',
  ratio: DEFAULT_RATIO,
});

/** @param {State} state */
function lastIndex(state) {
  return state.presentation ? state.presentation.slides.length - 1 : 0;
}

/**
 * Moves to a slide; a move that goes nowhere changes nothing.
 * @param {State} state
 * @param {number} index
 * @returns {{ nextState: State, effects: Effect[] }}
 */
function moveTo(state, index) {
  if (state.status !== 'ready') return { nextState: state, effects: [] };
  const target = clamp(Number.isFinite(index) ? Math.trunc(index) : 0, 0, lastIndex(state));
  if (target === state.currentIndex) return { nextState: state, effects: [] };
  return {
    nextState: { ...state, currentIndex: target },
    effects: [{ type: 'sync', index: target }],
  };
}

/** @param {State} state @param {State['mode']} mode */
function withMode(state, mode) {
  if (state.status !== 'ready' || state.mode === mode) return { nextState: state, effects: [] };
  return { nextState: { ...state, mode }, effects: [] };
}

/** @param {State} state @returns {Effect[]} */
function releaseEffects(state) {
  const urls = Object.values(state.assets);
  return urls.length > 0 ? [{ type: 'release_assets', urls }] : [];
}

/**
 * @param {State} state
 * @param {Command} command
 * @returns {{ nextState: State, effects: Effect[] }}
 */
export function reduce(state, command) {
  switch (command.type) {
    case 'loaded':
      return {
        nextState: {
          ...state,
          status: 'ready',
          error: null,
          presentation: command.presentation,
          assets: Object.freeze({ ...command.assets }),
          currentIndex: 0,
          mode: 'presentation',
          ratio: command.presentation.meta.ratio,
        },
        effects: [...releaseEffects(state), { type: 'publish' }],
      };

    case 'failed':
      return { nextState: { ...state, error: command.error }, effects: [] };

    case 'dismiss_error':
      return state.error === null
        ? { nextState: state, effects: [] }
        : { nextState: { ...state, error: null }, effects: [] };

    case 'closed':
      return {
        nextState: { ...initialState, ratio: state.ratio },
        effects: releaseEffects(state),
      };

    case 'navigate':
      return moveTo(state, command.index);
    case 'next':
      return moveTo(state, state.currentIndex + 1);
    case 'previous':
      return moveTo(state, state.currentIndex - 1);
    case 'first':
      return moveTo(state, 0);
    case 'last':
      return moveTo(state, lastIndex(state));

    case 'open_overview':
      return withMode(state, 'overview');
    case 'close_overview':
      return withMode(state, 'presentation');
    case 'toggle_overview':
      return withMode(state, state.mode === 'overview' ? 'presentation' : 'overview');

    case 'toggle_ratio':
      return {
        nextState: { ...state, ratio: state.ratio === 'fixed' ? 'auto' : 'fixed' },
        effects: [],
      };

    default:
      return { nextState: state, effects: [] };
  }
}

/**
 * A small observable around `reduce`: the adapter subscribes, and runs the effects.
 * @param {State} [initial]
 */
export function createStore(initial = initialState) {
  let state = initial;
  /** @type {Set<(change: { state: State, command: Command, effects: Effect[] }) => void>} */
  const subscribers = new Set();

  return {
    getState: () => state,
    /** @param {Command} command */
    dispatch(command) {
      const { nextState, effects } = reduce(state, command);
      if (nextState === state && effects.length === 0) return;
      state = nextState;
      for (const subscriber of [...subscribers]) subscriber({ state, command, effects });
    },
    /** @param {(change: { state: State, command: Command, effects: Effect[] }) => void} subscriber */
    subscribe(subscriber) {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
  };
}
