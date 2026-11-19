// Due dates: preset to date, buckets, and the bug scenario (an old todo edited with "today"
// must not fall into "overdue"). The clock is always passed in.
import { describe, expect, test } from 'vitest';
import { bucket, dueDateToTimestamp, presetToDate } from '../../src/core/due-dates.js';
import { updateTodo, addTodo } from '../../src/core/todos.js';
import { emptyData } from './support/data.js';

const DAY = 86400000;
// Wednesday 2026-11-18, 10:00 (local time).
const NOW = new Date(2026, 10, 18, 10, 0).getTime();
/**
 * @param {string | null} dueDate
 * @param {Partial<import('../../src/types.js').Todo>} [extra]
 * @returns {import('../../src/types.js').Todo}
 */
const todo = (dueDate, extra = {}) => ({
  id: 't',
  title: 'x',
  done: false,
  projectId: null,
  dueDate,
  createdAt: NOW,
  ...extra,
});

describe('presetToDate', () => {
  test('today, tomorrow, Friday, Monday, week, none', () => {
    expect(presetToDate('today', NOW)).toBe('2026-11-18');
    expect(presetToDate('tomorrow', NOW)).toBe('2026-11-19');
    expect(presetToDate('fri', NOW)).toBe('2026-11-20');
    expect(presetToDate('mon', NOW)).toBe('2026-11-23'); // Wednesday -> next Monday
    expect(presetToDate('wed', NOW)).toBe('2026-11-18'); // same day accepted
    expect(presetToDate('week', NOW)).toBe('2026-11-24');
    expect(presetToDate('none', NOW)).toBeNull();
    expect(presetToDate('n-importe-quoi', NOW)).toBeNull();
  });

  // The original test also checked "default ref = now": the reference is now always passed
  // explicitly (the Date.now() default lives in the Todos view).
  test('is anchored on the given reference', () => {
    expect(presetToDate('today', NOW)).toBe('2026-11-18');
    // Friday 20: "fri" = today; Saturday 21: next Friday
    expect(presetToDate('fri', new Date(2026, 10, 20, 23, 59).getTime())).toBe('2026-11-20');
    expect(presetToDate('fri', new Date(2026, 10, 21, 0, 1).getTime())).toBe('2026-11-27');
  });

  test('the daylight-saving change does not shift the day', () => {
    // 2026-10-25: end of summer time in Europe (25 h day); 2026-03-29: start (23 h).
    expect(presetToDate('tomorrow', new Date(2026, 9, 24, 12, 0).getTime())).toBe('2026-10-25');
    expect(presetToDate('tomorrow', new Date(2026, 9, 25, 12, 0).getTime())).toBe('2026-10-26');
    expect(presetToDate('tomorrow', new Date(2026, 2, 28, 12, 0).getTime())).toBe('2026-03-29');
    expect(presetToDate('tomorrow', new Date(2026, 2, 29, 12, 0).getTime())).toBe('2026-03-30');
  });
});

describe('dueDateToTimestamp', () => {
  test('local midnight, or null', () => {
    expect(dueDateToTimestamp('2026-11-18')).toBe(new Date(2026, 10, 18).getTime());
    expect(dueDateToTimestamp(null)).toBeNull();
    expect(dueDateToTimestamp('')).toBeNull();
    expect(dueDateToTimestamp('today')).toBeNull();
    expect(dueDateToTimestamp('2026-13-01')).toBeNull();
    expect(dueDateToTimestamp('2026-02-30')).toBeNull();
    expect(dueDateToTimestamp(20261118)).toBeNull();
  });
});

describe('bucket', () => {
  test('overdue, today, tomorrow, week, none, done', () => {
    expect(bucket(todo('2026-11-17'), NOW)).toBe('overdue');
    expect(bucket(todo('2025-01-01'), NOW)).toBe('overdue');
    expect(bucket(todo('2026-11-18'), NOW)).toBe('today');
    expect(bucket(todo('2026-11-19'), NOW)).toBe('tomorrow');
    expect(bucket(todo('2026-11-20'), NOW)).toBe('week');
    expect(bucket(todo('2027-06-01'), NOW)).toBe('week'); // everything beyond tomorrow
    expect(bucket(todo(null), NOW)).toBe('none');
    expect(bucket(todo('today'), NOW)).toBe('none'); // unmigrated label: unknown
    expect(bucket(todo('2026-11-17', { done: true }), NOW)).toBe('done');
    expect(bucket(todo(null, { done: true }), NOW)).toBe('done');
  });

  test('does not depend on createdAt, follows the given time', () => {
    const t = todo('2026-11-18', { createdAt: NOW - 30 * DAY });

    expect(bucket(t, NOW)).toBe('today');
    expect(bucket(t, new Date(2026, 10, 19, 0, 0, 1).getTime())).toBe('overdue');
    expect(bucket(t, new Date(2026, 10, 17, 23, 59).getTime())).toBe('tomorrow');
  });

  test('tomorrow is correct the day before a clock change', () => {
    const eve = new Date(2026, 9, 24, 12, 0).getTime();

    expect(bucket(todo('2026-10-25'), eve)).toBe('tomorrow');
    expect(bucket(todo('2026-10-26'), eve)).toBe('week');
  });
});

describe('bug scenario', () => {
  test('todo created 3 days ago, edited with "today" => today, not overdue', () => {
    const creation = NOW - 3 * DAY;
    let d = addTodo(
      emptyData(),
      { title: 'Vieux todo', projectId: null, dueDate: presetToDate('fri', creation) },
      creation,
      't1',
    );
    expect(d.todos[0]?.createdAt).toBe(creation);

    // three days later, the user edits the due date
    d = updateTodo(d, { id: 't1', patch: { dueDate: presetToDate('today', NOW) } });

    const t = d.todos[0];
    expect(t?.dueDate).toBe('2026-11-18');
    expect(t && bucket(t, NOW)).toBe('today');
  });
});
