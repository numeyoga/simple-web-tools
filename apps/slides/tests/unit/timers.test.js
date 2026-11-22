import { describe, expect, it } from 'vitest';
import {
  createTimers,
  pause,
  play,
  readout,
  resetSlide,
  resetTotal,
} from '../../src/core/timers.js';
import { formatDuration } from '../../src/core/text.js';

describe('timers', () => {
  it('start stopped at zero, and the slide timer counts from the start', () => {
    const timers = createTimers(1000);
    expect(readout(timers, 1000)).toEqual({ total: 0, slide: 0, running: false });
    expect(readout(timers, 6000)).toEqual({ total: 0, slide: 5000, running: false });
  });

  it('count the total only between play and pause', () => {
    let timers = createTimers(0);
    timers = play(timers, 1000);
    expect(readout(timers, 4000)).toMatchObject({ total: 3000, running: true });
    timers = pause(timers, 4000);
    expect(readout(timers, 9000)).toMatchObject({ total: 3000, running: false });
    timers = play(timers, 10000);
    expect(readout(timers, 12000).total).toBe(5000);
  });

  it('ignore a play while running and a pause while paused', () => {
    const running = play(createTimers(0), 1000);
    expect(play(running, 5000)).toBe(running);
    const stopped = createTimers(0);
    expect(pause(stopped, 5000)).toBe(stopped);
  });

  it('reset the total to zero and keep running when it was running', () => {
    const running = play(createTimers(0), 1000);
    const again = resetTotal(running, 4000);
    expect(readout(again, 4500)).toMatchObject({ total: 500, running: true });
    const stopped = resetTotal(pause(running, 4000), 5000);
    expect(readout(stopped, 9000)).toMatchObject({ total: 0, running: false });
  });

  it('restart the slide timer at every change of slide, and leave the total alone', () => {
    let timers = play(createTimers(0), 0);
    timers = resetSlide(timers, 7000);
    expect(readout(timers, 9000)).toMatchObject({ total: 9000, slide: 2000 });
  });
});

describe('formatDuration', () => {
  it('writes MM:SS, and H:MM:SS from one hour', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(59_999)).toBe('00:59');
    expect(formatDuration(61_000)).toBe('01:01');
    expect(formatDuration(3_600_000)).toBe('1:00:00');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
  });

  it('never goes below zero', () => {
    expect(formatDuration(-5000)).toBe('00:00');
  });
});
