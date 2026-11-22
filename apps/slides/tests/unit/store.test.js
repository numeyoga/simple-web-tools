import { describe, expect, it } from 'vitest';
import { parsePresentation } from '../../src/core/parser.js';
import { createStore, initialState, reduce } from '../../src/core/store.js';

const presentation = parsePresentation('# A\n---\n# B\n---\n# C');
const ready = reduce(initialState, {
  type: 'loaded',
  presentation,
  assets: { 'a.png': 'blob:one' },
}).nextState;

describe('reduce', () => {
  it('starts on the home screen, with nothing open', () => {
    expect(initialState).toMatchObject({ status: 'empty', presentation: null, currentIndex: 0 });
  });

  it('opens a presentation on its first slide, with its ratio, and publishes it', () => {
    const auto = parsePresentation('---\nratio: auto\n---\n# A\n---\n# B');
    const { nextState, effects } = reduce(initialState, {
      type: 'loaded',
      presentation: auto,
      assets: {},
    });
    expect(nextState).toMatchObject({
      status: 'ready',
      currentIndex: 0,
      ratio: 'auto',
      error: null,
    });
    expect(effects).toEqual([{ type: 'publish' }]);
  });

  it('releases the images of the presentation it replaces', () => {
    const { effects } = reduce(ready, { type: 'loaded', presentation, assets: {} });
    expect(effects).toEqual([{ type: 'release_assets', urls: ['blob:one'] }, { type: 'publish' }]);
  });

  it('moves with next and previous, stays in range, and syncs the presenter only when it moved', () => {
    const one = reduce(ready, { type: 'next' });
    expect(one.nextState.currentIndex).toBe(1);
    expect(one.effects).toEqual([{ type: 'sync', index: 1 }]);

    const atStart = reduce(ready, { type: 'previous' });
    expect(atStart.nextState).toBe(ready);
    expect(atStart.effects).toEqual([]);

    const last = reduce(reduce(one.nextState, { type: 'last' }).nextState, { type: 'next' });
    expect(last.nextState.currentIndex).toBe(2);
    expect(last.effects).toEqual([]);
  });

  it('goes to the first and the last slide', () => {
    const last = reduce(ready, { type: 'last' }).nextState;
    expect(last.currentIndex).toBe(2);
    expect(reduce(last, { type: 'first' }).nextState.currentIndex).toBe(0);
  });

  it('clamps a go-to to the slides that exist, and ignores what is not a number', () => {
    expect(reduce(ready, { type: 'navigate', index: 99 }).nextState.currentIndex).toBe(2);
    expect(reduce(ready, { type: 'navigate', index: -4 }).nextState.currentIndex).toBe(0);
    expect(reduce(ready, { type: 'navigate', index: 1.9 }).nextState.currentIndex).toBe(1);
    expect(reduce(ready, { type: 'navigate', index: Number.NaN }).nextState.currentIndex).toBe(0);
  });

  it('does nothing to navigate while nothing is open', () => {
    expect(reduce(initialState, { type: 'next' })).toEqual({
      nextState: initialState,
      effects: [],
    });
    expect(reduce(initialState, { type: 'open_overview' }).nextState).toBe(initialState);
  });

  it('opens, closes and toggles the overview', () => {
    const open = reduce(ready, { type: 'open_overview' }).nextState;
    expect(open.mode).toBe('overview');
    expect(reduce(open, { type: 'toggle_overview' }).nextState.mode).toBe('presentation');
    expect(reduce(ready, { type: 'toggle_overview' }).nextState.mode).toBe('overview');
    expect(reduce(open, { type: 'close_overview' }).nextState.mode).toBe('presentation');
    expect(reduce(ready, { type: 'close_overview' }).nextState).toBe(ready);
  });

  it('toggles the frame between fixed and auto', () => {
    const auto = reduce(ready, { type: 'toggle_ratio' }).nextState;
    expect(auto.ratio).toBe('auto');
    expect(reduce(auto, { type: 'toggle_ratio' }).nextState.ratio).toBe('fixed');
  });

  it('keeps the error of a failed load on the home screen, and clears it', () => {
    const error = { code: /** @type {const} */ ('no-slides'), detail: '' };
    const failed = reduce(initialState, { type: 'failed', error }).nextState;
    expect(failed).toMatchObject({ status: 'empty', error });
    expect(reduce(failed, { type: 'dismiss_error' }).nextState.error).toBeNull();
    expect(reduce(initialState, { type: 'dismiss_error' }).nextState).toBe(initialState);
  });

  it('closes the presentation: back to the home screen, images released, frame kept', () => {
    const auto = reduce(ready, { type: 'toggle_ratio' }).nextState;
    const { nextState, effects } = reduce(auto, { type: 'closed' });
    expect(nextState).toMatchObject({ status: 'empty', presentation: null, ratio: 'auto' });
    expect(effects).toEqual([{ type: 'release_assets', urls: ['blob:one'] }]);
  });
});

describe('createStore', () => {
  it('tells its subscribers the new state, the command and the effects', () => {
    const store = createStore();
    /** @type {unknown[]} */
    const seen = [];
    const stop = store.subscribe((change) => seen.push([change.command.type, change.effects]));

    store.dispatch({ type: 'loaded', presentation, assets: {} });
    store.dispatch({ type: 'next' });
    store.dispatch({ type: 'previous' });
    store.dispatch({ type: 'previous' }); // already on the first slide: nobody hears of it
    stop();
    store.dispatch({ type: 'next' });

    expect(seen).toEqual([
      ['loaded', [{ type: 'publish' }]],
      ['next', [{ type: 'sync', index: 1 }]],
      ['previous', [{ type: 'sync', index: 0 }]],
    ]);
    expect(store.getState().currentIndex).toBe(1);
  });
});
